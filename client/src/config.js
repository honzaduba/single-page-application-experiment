let _config = { ['#default']: true };

export async function loadConfig(url = '/config/config.json') {

    let response;

    try {
        response = await fetch(url, {
            method: 'GET',
            headers: {
                'Accept': 'application/json'
            },
            cache: 'no-cache'       // vždy fresh — JSON se načítá při startu
        });
    } catch (err) {
        throw new Error(`Config fetch failed: ${err.message}`);
    }

    if (!response.ok) {
        throw new Error(`Cannot load config: HTTP ${response.status}`);
    }

    _config = {};
    try {
        _config = await response.json();
    } catch (err) {
        throw new Error(`Config parse failed: ${err.message}`);
    }

    return _config;

}

export function getConfig() {

    return _config;

}
