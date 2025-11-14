// RemoteService.js

export class RemoteService {

    /**
     * @param {Object} config
     * @param {string} [config.baseUrl]        - Volitelný base URL (např. '/api')
     * @param {Object} [config.defaultHeaders] - Výchozí hlavičky pro všechna volání
     * @param {number} [config.timeoutMs]      - Výchozí timeout v ms (např. 15000)
     */
    constructor({ baseUrl = '', defaultHeaders = {}, timeoutMs = 15000 } = {}) {
        this.baseUrl = baseUrl.replace(/\/+$/, ''); // odstraní trailing slash
        this.defaultHeaders = { ...defaultHeaders };
        this.timeoutMs = timeoutMs;
    }

    /**
     * Přidá / přepíše defaultní hlavičky.
     */
    setDefaultHeader(name, value) {
        if (value == null) {
            delete this.defaultHeaders[name];
        } else {
            this.defaultHeaders[name] = value;
        }
    }

    /**
     * Hlavní volací metoda.
     *
     * @param {string} method            - 'GET', 'POST', 'PUT', 'DELETE', ...
     * @param {string} url               - relativní nebo absolutní URL
     * @param {any} [data=null]          - tělo požadavku (objekt se serializuje do JSON)
     * @param {Object} [options={}]
     * @param {Object} [options.headers] - dodatečné hlavičky
     * @param {Object} [options.query]   - query parametry (object → ?a=1&b=2)
     * @param {number} [options.timeoutMs]       - timeout pro konkrétní request
     * @param {'json'|'text'} [options.responseType] - preferovaný typ odpovědi
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
            headers = {},
            query,
            timeoutMs = this.timeoutMs,
            responseType
        } = options;

        const fullUrl = this._buildUrl(url, query);

        // sloučíme default + per-request hlavičky
        const requestHeaders = new Headers({
            ...this.defaultHeaders,
            ...headers
        });

        const fetchOptions = {
            method: method.toUpperCase(),
            headers: requestHeaders
        };

        // tělo požadavku – pro jednoduchost:
        //  - string → pošleme "as is" (např. text/plain)
        //  - jinak object/number/bool → JSON
        if (data != null && method.toUpperCase() !== 'GET' && method.toUpperCase() !== 'HEAD') {
            if (typeof data === 'string' || data instanceof Blob || data instanceof FormData) {
                fetchOptions.body = data;
                // pokud uživatel nenastavil Content-Type, necháme to na browseru
            } else {
                // JSON payload
                if (!requestHeaders.has('Content-Type')) {
                    requestHeaders.set('Content-Type', 'application/json; charset=utf-8');
                }
                fetchOptions.body = JSON.stringify(data);
            }
        }

        const controller = new AbortController();
        fetchOptions.signal = controller.signal;

        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        let response;
        try {
            response = await fetch(fullUrl, fetchOptions);
        } catch (err) {
            clearTimeout(timeoutId);
            // sem spadnou typicky síťové chyby, timeout (AbortError), CORS atd.
            // necháme je jako Error, ať si je vyšší vrstva (UI / RemoteApiService) ošetří.
            throw err;
        } finally {
            clearTimeout(timeoutId);
        }

        const contentType = response.headers.get('content-type') || '';
        const wantJson =
            responseType === 'json' ||
            (responseType == null && contentType.includes('application/json'));

        let rawBody;
        let parsedData = null;

        try {
            rawBody = await response.text(); // vždy si uložíme raw text
            if (wantJson && rawBody) {
                parsedData = JSON.parse(rawBody);
            } else {
                parsedData = rawBody; // pokud chceme text, prostě vrátíme string
            }
        } catch (parseErr) {
            // když se JSON nepodaří rozparsovat, necháme parsedData = null
            // a rawBody zůstane k dispozici
            parsedData = null;
        }

        return {
            ok: response.ok,
            status: response.status,
            statusText: response.statusText,
            url: response.url,
            headers: response.headers,
            data: parsedData,
            rawBody
        };
    }

    // syntaktický cukr pro běžné metody

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

    // -----------------------------------------------------
    // interní pomocné funkce
    // -----------------------------------------------------

    _buildUrl(url, query) {
        let full = url;

        // pokud máme baseUrl a url není absolutní, spojíme
        if (this.baseUrl && !/^https?:\/\//i.test(url) && !url.startsWith('//')) {
            const left = this.baseUrl.replace(/\/+$/, '');
            const right = url.replace(/^\/+/, '');
            full = left + '/' + right;
        }

        if (query && typeof query === 'object') {
            const params = new URLSearchParams();
            for (const [key, value] of Object.entries(query)) {
                if (value === undefined || value === null) continue;
                if (Array.isArray(value)) {
                    for (const item of value) {
                        params.append(key, String(item));
                    }
                } else {
                    params.append(key, String(value));
                }
            }
            const q = params.toString();
            if (q) {
                full += (full.includes('?') ? '&' : '?') + q;
            }
        }

        return full;
    }

}
