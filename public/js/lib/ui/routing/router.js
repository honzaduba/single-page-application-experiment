// Router.js

export class Router {
    /**
     * @param {Object} options
     * @param {Application} options.app           - tvoje Application
     * @param {AuthService} options.authService   - kvůli public/privileges
     * @param {function(routeMatch)|null} [options.onRouteChange]
     */
    constructor({ app, authService, routes, onRouteChange = null } = {}) {

        if (!app) throw new Error('Router: "app" (Application) is required.');
        if (!authService) throw new Error('Router: "authService" (AuthService) is required.');
        if (!routes) throw new Error('Router: "routes" (array) is required.');

        this.app = app;
        this.authService = authService;
        this.onRouteChange = onRouteChange;

        this.routes = routes?.map(r => this._compileRoute(r)) ?? [];
        this.current = null;

        this._onHashChange = this._onHashChange.bind(this);
    }

    start() {
        window.addEventListener('hashchange', this._onHashChange);
        this._onHashChange(); // zpracuj aktuální hash
    }

    stop() {
        window.removeEventListener('hashchange', this._onHashChange);
    }

    /**
     * Navigace podle name + params + query.
     */
    navigateByName(name, params = {}, query = {}) {
        const route = this.routes.find(r => r.def.name === name);
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
        const route = this.routes.find(r => r.def.name === name);
        if (!route) return null;
        const path = this._buildPath(route, params);
        return this._attachQuery(path, query);
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
            return;
        }

        const routeDef = match.def.def;

        // kontrola public / auth / privileges
        const access = this._checkAccess(routeDef);
        if (!access.allowed) {
            this._handleAccessDenied(routeDef, access);
            return;
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

    _handleNotFound(path) {
        console.warn('Route not found for path:', path);
        // sem můžeš přesměrovat na 404 modul, nebo zavolat app.showNotFound()
        if (this.onRouteChange) {
            this.onRouteChange({
                def: null,
                params: {},
                query: {},
                fullPath: path,
                notFound: true
            });
        }
    }

    _handleAccessDenied(routeDef, access) {
        console.warn('Access denied:', routeDef.name, access.reason);

        if (access.reason === 'unauthenticated') {
            // přesměrování na login
            this.navigateByName('login', {}, { redirect: window.location.hash.slice(1) });
        } else {
            // přesměrování na nějakou "forbidden" stránku
            this.navigateByName('forbidden');
        }
    }
}
