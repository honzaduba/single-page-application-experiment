// AuthService.js

export class AuthService {

    /**
     * @param {Object} config
     * @param {RemoteService} config.remote          - RemoteService instanc epro HTTP volání
     * @param {Storage|null} [config.storage]        - např. window.localStorage; pokud null, nic se nepersistuje
     * @param {string} [config.storageKey='auth']    - klíč v úložišti
     * @param {string} [config.loginPath='/auth/login']
     * @param {string} [config.refreshPath='/auth/refresh']
     * @param {string} [config.userPath='/auth/me']
     */
    constructor({
        remote,
        storage = typeof window !== 'undefined' ? window.localStorage : null,
        storageKey = 'auth',
        loginPath = '/auth/login',
        refreshPath = '/auth/refresh',
        userPath = '/auth/me'
    }) {
        if (!remote) {
            throw new Error('AuthService: "remote" (RemoteService) is required.');
        }

        this.remote = remote;
        this.storage = storage;
        this.storageKey = storageKey;
        this.loginPath = loginPath;
        this.refreshPath = refreshPath;
        this.userPath = userPath;

        this.authToken = null;
        this.refreshToken = null;
        this.expiresAt = null; // timestamp (ms) nebo null
        this.currentUser = null;

        // event handlers
        this._onLoginHandlers = [];
        this._onLogoutHandlers = [];
        this._onAuthErrorHandlers = [];
        this._onTokenRefreshedHandlers = [];

        // shared promise pro current refresh
        this._refreshPromise = null;

        this._loadFromStorage();
    }

    // -----------------------------------------------------
    // Public API
    // -----------------------------------------------------

    /**
     * Přihlášení uživatele.
     * @param {Object} credentials - typicky { username, password } nebo podle API
     * @returns {Promise<Object>} - user object (pokud ho API vrací)
     */
    async login(credentials) {
        const response = await this.remote.post(this.loginPath, credentials, {
            responseType: 'json'
        });

        if (!response.ok) {
            // očekáváš-li chybové zprávy v JSON, můžeš je vytáhnout z response.data
            const error = new Error('Login failed');
            error.status = response.status;
            error.body = response.data ?? response.rawBody;
            throw error;
        }

        const { authToken, refreshToken, expiresAt, user } =
            this._extractTokensFromLogin(response.data);

        this._setAuth(authToken, refreshToken, expiresAt, user);
        this._emitLogin(user);

        return user;
    }

    /**
     * Odhlášení uživatele – smaže tokeny + user info a notifikuje posluchače.
     */
    logout() {
        this._clearAuth();
        this._emitLogout();
    }

    /**
     * Vrátí true, pokud máme authToken a ještě neexpiroval (pokud evidujeme expiresAt).
     */
    hasValidToken() {
        if (!this.authToken) return false;
        if (!this.expiresAt) return true;
        return Date.now() < this.expiresAt;
    }

    /**
     * Zda je uživatel považován za přihlášeného.
     */
    isAuthenticated() {
        return this.hasValidToken();
    }

    getAuthToken() {
        return this.authToken;
    }

    getRefreshToken() {
        return this.refreshToken;
    }

    /**
     * Zajistí platný authToken:
     *  - pokud je platný → vrátí ho
     *  - jinak se pokusí o refresh
     *  - pokud refresh selže → vyhodí chybu
     */
    async ensureValidToken() {
        if (this.hasValidToken()) {
            return this.authToken;
        }

        await this.refreshToken();
        return this.authToken;
    }

    /**
     * Volá /auth/refresh (nebo jiný konfigurovaný endpoint) a aktualizuje tokeny.
     * Řeší souběh více volání – probíhá vždy jen jeden refresh.
     *
     * @returns {Promise<string>} - nový authToken
     */
    async refreshToken() {
        if (!this.refreshToken) {
            // není co refreshnout
            this.logout();
            const err = new Error('No refresh token available.');
            this._emitAuthError(err);
            throw err;
        }

        // pokud refresh už běží, vrátíme existující Promise
        if (this._refreshPromise) {
            return this._refreshPromise;
        }

        this._refreshPromise = this._doRefresh()
            .catch(err => {
                // refresh fail → odhlásit + emitnout chybu
                this.logout();
                this._emitAuthError(err);
                throw err;
            })
            .finally(() => {
                this._refreshPromise = null;
            });

        return this._refreshPromise;
    }

    /**
     * Vrátí info o uživateli.
     * Pokud už ho máme v paměti a forceReload = false, vrátí cache.
     * Pokud ne, zavolá user endpoint.
     */
    async getUser(forceReload = false) {
        if (!this.isAuthenticated()) {
            return null;
        }

        if (!forceReload && this.currentUser) {
            return this.currentUser;
        }

        const response = await this.remote.get(this.userPath, { responseType: 'json' });

        if (!response.ok) {
            const err = new Error('Failed to load user info.');
            err.status = response.status;
            err.body = response.data ?? response.rawBody;
            this._emitAuthError(err);
            throw err;
        }

        this.currentUser = response.data || null;
        this._saveToStorage();
        return this.currentUser;
    }

    // -----------------------------------------------------
    // Event API
    // -----------------------------------------------------

    onLogin(handler) {
        this._onLoginHandlers.push(handler);
        return () => this._removeHandler(this._onLoginHandlers, handler);
    }

    onLogout(handler) {
        this._onLogoutHandlers.push(handler);
        return () => this._removeHandler(this._onLogoutHandlers, handler);
    }

    onAuthError(handler) {
        this._onAuthErrorHandlers.push(handler);
        return () => this._removeHandler(this._onAuthErrorHandlers, handler);
    }

    onTokenRefreshed(handler) {
        this._onTokenRefreshedHandlers.push(handler);
        return () => this._removeHandler(this._onTokenRefreshedHandlers, handler);
    }

    // -----------------------------------------------------
    // Interní logika
    // -----------------------------------------------------

    _extractTokensFromLogin(data) {
        // Tady případně přizpůsobíš svému API.
        // Očekávám { authToken, refreshToken, expiresAt?, user? }

        if (!data || !data.authToken) {
            throw new Error('Login response does not contain authToken.');
        }

        return {
            authToken: data.authToken,
            refreshToken: data.refreshToken ?? null,
            // předpokládáme, že expiresAt je buď timestamp (ms), nebo ISO string
            expiresAt: data.expiresAt
                ? this._normalizeExpiresAt(data.expiresAt)
                : null,
            user: data.user ?? null
        };
    }

    _extractTokensFromRefresh(data) {
        // Opět přizpůsobitelné tvému API.
        if (!data || !data.authToken) {
            throw new Error('Refresh response does not contain authToken.');
        }

        return {
            authToken: data.authToken,
            refreshToken: data.refreshToken ?? this.refreshToken,
            expiresAt: data.expiresAt
                ? this._normalizeExpiresAt(data.expiresAt)
                : null
        };
    }

    _normalizeExpiresAt(value) {
        if (typeof value === 'number') {
            // předpokládáme ms
            return value;
        }
        // jinak zkusíme Date.parse
        const ts = Date.parse(value);
        return Number.isNaN(ts) ? null : ts;
    }

    async _doRefresh() {
        const payload = { refreshToken: this.refreshToken };

        const response = await this.remote.post(this.refreshPath, payload, {
            responseType: 'json'
        });

        if (!response.ok) {
            const err = new Error('Refresh token request failed.');
            err.status = response.status;
            err.body = response.data ?? response.rawBody;
            throw err;
        }

        const { authToken, refreshToken, expiresAt } =
            this._extractTokensFromRefresh(response.data);

        this._setAuth(authToken, refreshToken, expiresAt, this.currentUser);
        this._emitTokenRefreshed(authToken);

        return authToken;
    }

    _setAuth(authToken, refreshToken, expiresAt, user = null) {
        this.authToken = authToken;
        this.refreshToken = refreshToken;
        this.expiresAt = expiresAt;
        this.currentUser = user ?? this.currentUser;

        this._saveToStorage();
    }

    _clearAuth() {
        this.authToken = null;
        this.refreshToken = null;
        this.expiresAt = null;
        this.currentUser = null;

        this._clearStorage();
    }

    _loadFromStorage() {
        if (!this.storage) return;

        try {
            const raw = this.storage.getItem(this.storageKey);
            if (!raw) return;

            const data = JSON.parse(raw);
            this.authToken = data.authToken ?? null;
            this.refreshToken = data.refreshToken ?? null;
            this.expiresAt = data.expiresAt ?? null;
            this.currentUser = data.currentUser ?? null;
        } catch {
            // ignorujeme chyby
        }
    }

    _saveToStorage() {
        if (!this.storage) return;

        const data = {
            authToken: this.authToken,
            refreshToken: this.refreshToken,
            expiresAt: this.expiresAt,
            currentUser: this.currentUser
        };

        try {
            this.storage.setItem(this.storageKey, JSON.stringify(data));
        } catch {
            // ignorujeme, typicky quota exceeded apod.
        }
    }

    _clearStorage() {
        if (!this.storage) return;
        try {
            this.storage.removeItem(this.storageKey);
        } catch {
            // ignorujeme
        }
    }

    _emitLogin(user) {
        for (const h of this._onLoginHandlers) {
            try { h(user); } catch { /* swallow */ }
        }
    }

    _emitLogout() {
        for (const h of this._onLogoutHandlers) {
            try { h(); } catch { /* swallow */ }
        }
    }

    _emitAuthError(err) {
        for (const h of this._onAuthErrorHandlers) {
            try { h(err); } catch { /* swallow */ }
        }
    }

    _emitTokenRefreshed(token) {
        for (const h of this._onTokenRefreshedHandlers) {
            try { h(token); } catch { /* swallow */ }
        }
    }

    _removeHandler(list, handler) {
        const idx = list.indexOf(handler);
        if (idx >= 0) {
            list.splice(idx, 1);
        }
    }

}
