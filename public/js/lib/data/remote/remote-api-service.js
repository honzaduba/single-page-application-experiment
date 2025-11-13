// RemoteApiService.js

export class RemoteApiService {

    /**
     * @param {Object} config
     * @param {RemoteService} config.remote      - RemoteService instance
     * @param {AuthService}   config.auth        - AuthService instance
     */
    constructor({ remote, auth }) {
        if (!remote) {
            throw new Error('RemoteApiService: "remote" (RemoteService) is required.');
        }
        if (!auth) {
            throw new Error('RemoteApiService: "auth" (AuthService) is required.');
        }

        this.remote = remote;
        this.auth = auth;
    }

    /**
     * Hlavní volací metoda.
     *
     * @param {string} method           - 'GET', 'POST', 'PUT', 'DELETE', ...
     * @param {string} url              - relativní nebo absolutní URL (stejně jako u RemoteService)
     * @param {any} [data=null]         - tělo požadavku
     * @param {Object} [options={}]
     * @param {Object} [options.headers]         - dodatečné hlavičky
     * @param {Object} [options.query]           - query parametry (?a=1&b=2)
     * @param {number} [options.timeoutMs]       - timeout pro request
     * @param {'json'|'text'} [options.responseType] - preferovaný typ odpovědi
     * @param {boolean} [options.skipAuth=false]      - pokud true, nebudeme přidávat Authorization
     * @param {boolean} [options.retryOnUnauthorized=true] - zda zkoušet refresh + retry při 401
     *
     * @returns {Promise<{
     *   ok: boolean,
     *   status: number,
     *   statusText: string,
     *   url: string,
     *   headers: Headers,
     *   data: any,
     *   rawBody: string
     * }>}
     */
    async call(method, url, data = null, options = {}) {
        const {
            skipAuth = false,
            retryOnUnauthorized = true,
            headers = {},
            ...restOptions
        } = options;

        // 1) připravíme hlavičky včetně Authorization (pokud není skipAuth)
        const initialHeaders = { ...headers };

        if (!skipAuth) {
            const token = this.auth.getAuthToken();
            if (token) {
                initialHeaders['Authorization'] = `Bearer ${token}`;
            }
        }

        // 2) první pokus o volání API
        let response = await this.remote.call(method, url, data, {
            ...restOptions,
            headers: initialHeaders
        });

        // 3) pokud není 401, vracíme rovnou výsledek
        if (response.status !== 401 || skipAuth || !retryOnUnauthorized) {
            return response;
        }

        // 4) máme 401 → zkusíme refresh tokenu a retry
        try {
            const newToken = await this.auth.refreshToken();

            const retryHeaders = { ...headers };
            if (newToken) {
                retryHeaders['Authorization'] = `Bearer ${newToken}`;
            }

            const retryResponse = await this.remote.call(method, url, data, {
                ...restOptions,
                headers: retryHeaders
            });

            return retryResponse;
        } catch (err) {
            // AuthService.refreshToken():
            //  - při neúspěchu vyhazuje chybu
            //  - typicky provede logout() + onAuthError
            // Tady chybu jen propustíme dál.
            throw err;
        }
    }

    // Syntaktický cukr pro běžné HTTP metody

    get(url, options = {}) {
        return this.call('GET', url, null, options);
    }

    post(url, data, options = {}) {
        return this.call('POST', url, data, options);
    }

    put(url, data, options = {}) {
        return this.call('PUT', url, data, options);
    }

    delete(url, data = null, options = {}) {
        return this.call('DELETE', url, data, options);
    }

}
