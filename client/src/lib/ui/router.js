// Router.js

export class Router {
    /**
         * @param {Object} options
         * @param {Application} options.app
         * @param {AuthService} options.authService
         * @param {Array} options.routes
         * @param {function(routeMatch)|null} [options.onRouteChange]
         * @param {string|null} [options.defaultRouteName]   - preferovaná default routa
         * @param {string|null} [options.loginRouteName]     - routa pro login
         * @param {string|null} [options.forbiddenRouteName] - routa pro 403
         * @param {string|null} [options.notFoundRouteName]  - routa pro 404
         */
    constructor({
        app,
        authService,
        routes,
        onRouteChange = null,
        defaultRouteName = null,
        loginRouteName = null,
        forbiddenRouteName = null,
        notFoundRouteName = null,
    } = {}) {

        if (!app) throw new Error('Router: "app" (Application) is required.');
        if (!authService) throw new Error('Router: "authService" (AuthService) is required.');
        if (!routes) throw new Error('Router: "routes" (array) is required.');

        this.app = app;
        this.authService = authService;
        this.onRouteChange = onRouteChange;

        this.defaultRouteName = defaultRouteName;
        this.loginRouteName = loginRouteName;
        this.forbiddenRouteName = forbiddenRouteName;
        this.notFoundRouteName = notFoundRouteName;

        this.routes = routes.map(r => this._compileRoute(r));
        this.current = null;

        this._onHashChange = this._onHashChange.bind(this);
    }

    start() {
        window.addEventListener('hashchange', this._onHashChange);

        // zkus zpracovat aktuální hash; když není validní → reset
        const ok = this._onHashChange();
        if (!ok) {
            this.resetToDefaultRoute();
        }
    }

    stop() {
        window.removeEventListener('hashchange', this._onHashChange);
    }

    /**
     * Obecný reset aktivní routy:
     *  1) pokud je nastaven defaultRouteName → pokusí se na ni přejít
     *  2) jinak najde první dostupnou routu podle definic v routes.js
     */
    resetToDefaultRoute() {
        // 1) explicitně zadaná defaultní routa?
        if (this.defaultRouteName) {
            const route = this._findRoute(this.defaultRouteName);
            if (route && this._checkAccess(route.def).allowed) {
                this.navigateByName(this.defaultRouteName);
                return;
            }
        }

        // 2) první dostupná routa
        const first = this._findFirstAccessibleRoute();
        if (first) {
            this.navigateByName(first.def.name);
            return;
        }

        // 3) žádná dostupná routa → zatím jen warning (můžeš si tu vyrobit "no-access" modul)
        console.warn('Router.resetToDefaultRoute: no accessible routes found.');
    }

    /**
     * Navigace podle name + params + query.
     */
    navigateByName(name, params = {}, query = {}) {

        const route = this._findRoute(name);
        if (!route) {
            console.warn(`Route with name "${name}" not found.`);
            return;
        }

        const path = this._buildPath(route, params);
        const full = this._attachQuery(path, query);

        window.location.hash = '#' + full;

    }

    /**
     * Získání URL (bez změny location).
     */
    urlFor(name, params = {}, query = {}) {
        const route = this._findRoute(name);
        if (!route) return null;
        const path = this._buildPath(route, params);
        return this._attachQuery(path, query);
    }

    /**
     * Najde první routu s daným jménem.
     */
    _findRoute(name) {
        const route = this.routes.find(r => r.def.name === name) ?? null;
        return route;
    }

    /**
     * Najde první routu, na kterou má uživatel přístup (bere aktuální stav authService).
     */
    _findFirstAccessibleRoute() {
        for (const r of this.routes) {
            const access = this._checkAccess(r.def);
            if (access.allowed) {
                return r;
            }
        }
        return null;
    }

    // ----------------------------------------------------------
    // Interní část
    // ----------------------------------------------------------

    _onHashChange() {
        const raw = window.location.hash || '#';
        const pathWithQuery = raw.startsWith('#') ? raw.slice(1) : raw;

        const [path, queryString] = pathWithQuery.split('?', 2);
        const query = this._parseQuery(queryString || '');

        const match = this._matchPath(path);
        if (!match) {
            this._handleNotFound(path);
            return false;
        }

        const routeDef = match.def.def;

        const access = this._checkAccess(routeDef);
        if (!access.allowed) {
            this._handleAccessDenied(routeDef, access);
            return false;
        }

        const routeMatch = {
            def: routeDef,
            params: match.params,
            query,
            fullPath: path
        };

        this.current = routeMatch;

        if (this.onRouteChange) {
            this.onRouteChange(routeMatch);
        }

        return true;
    }

    _handleNotFound(path) {

        console.warn('Route not found for path:', path);
        if (this.notFoundRouteName && this._findRoute(this.notFoundRouteName)) {
            this.navigateByName(this.notFoundRouteName);
            return;
        }
        // zkus najít nějakou použitelnou routu
        this.resetToDefaultRoute();

    }

    _handleAccessDenied(routeDef, access) {

        console.warn('Access denied:', routeDef.name, access.reason);

        if (access.reason === 'unauthenticated' && this.loginRouteName) {

            // přesměrování na login (s případným redirect parametrem)
            this.navigateByName(this.loginRouteName, {}, { redirect: routeDef.path });

        } else if (access.reason === 'forbidden' && this.forbiddenRouteName) {

            this.navigateByName(this.forbiddenRouteName);

        } else {

            // fallback – opět zkusíme nějakou jinou routu
            this.resetToDefaultRoute();

        }
    }

    _matchPath(path) {
        for (const r of this.routes) {
            const m = r.regex.exec(path);
            if (!m) continue;

            const params = {};
            r.params.forEach((p, idx) => {
                const rawVal = m[idx + 1];
                params[p.name] = this._convertParam(rawVal, p.type);
            });

            return { def: r, params };
        }
        return null;
    }

    _compileRoute(def) {
        // path typu '/users/{id:num}/profile'
        const paramRegex = /\{([\w]+)(?::([\w*]+))?\}/g;

        const params = [];
        let pattern = '^';
        let lastIndex = 0;

        let match;
        while ((match = paramRegex.exec(def.path)) !== null) {
            const [token, name, type = 'str'] = match;
            const staticPart = def.path.slice(lastIndex, match.index);
            pattern += this._escapeRegex(staticPart);

            params.push({ name, type });

            pattern += '(' + this._typeToRegex(type) + ')';
            lastIndex = match.index + token.length;
        }

        pattern += this._escapeRegex(def.path.slice(lastIndex));
        pattern += '$';

        const regex = new RegExp(pattern);

        return {
            def,      // původní definice
            regex,
            params    // [{name, type}, ...]
        };
    }

    _typeToRegex(type) {
        switch (type) {
            case 'num':
                return '\\d+';
            case 'slug':
                return '[a-zA-Z0-9-]+';
            case 'alpha':
                return '[a-zA-Z]+';
            case '*':
                return '.+';
            default:
                return '[^/]+';
        }
    }

    _convertParam(value, type) {
        if (type === 'num') {
            const n = Number(value);
            return Number.isNaN(n) ? null : n;
        }
        return value;
    }

    _escapeRegex(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    _parseQuery(str) {
        if (!str) return {};
        const params = new URLSearchParams(str);
        const obj = {};
        for (const [k, v] of params.entries()) {
            if (obj.hasOwnProperty(k)) {
                if (!Array.isArray(obj[k])) {
                    obj[k] = [obj[k]];
                }
                obj[k].push(v);
            } else {
                obj[k] = v;
            }
        }
        return obj;
    }

    _attachQuery(path, query) {
        const params = new URLSearchParams();
        for (const [k, v] of Object.entries(query)) {
            if (v === undefined || v === null) continue;
            if (Array.isArray(v)) {
                v.forEach(x => params.append(k, String(x)));
            } else {
                params.append(k, String(v));
            }
        }
        const qs = params.toString();
        return qs ? `${path}?${qs}` : path;
    }

    _buildPath(compiledRoute, params) {
        const def = compiledRoute.def;
        let path = def.path;

        for (const p of compiledRoute.params) {
            const val = params[p.name];
            if (val === undefined || val === null) {
                throw new Error(`Missing param "${p.name}" for route "${def.name}".`);
            }
            path = path.replace(
                new RegExp(`\\{${p.name}(?::[\\w*]+)?\\}`),
                encodeURIComponent(String(val))
            );
        }

        return path;
    }

    _checkAccess(routeDef) {
        // public route → vždy ok
        if (routeDef.public) {
            return { allowed: true, reason: 'public' };
        }

        // private → musí být přihlášený
        if (!this.authService.isAuthenticated()) {
            return { allowed: false, reason: 'unauthenticated' };
        }

        // privileges – pokud nejsou definované, neřešíme
        if (!routeDef.privileges || routeDef.privileges.length === 0) {
            return { allowed: true, reason: 'no-priv-check' };
        }

        const user = this.authService.currentUser; // nebo nějaký getter
        const userPrivileges = user?.privileges || [];

        const hasAll = routeDef.privileges.every(p => userPrivileges.includes(p));

        if (!hasAll) {
            return { allowed: false, reason: 'forbidden' };
        }

        return { allowed: true, reason: 'ok' };
    }

}
