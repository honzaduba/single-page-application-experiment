// main.js

import { RemoteService } from './lib/data/remote/remote-service.js';
import { AuthService } from './lib/data/remote/auth-service.js';
import { RemoteApiService } from './lib/data/remote/remote-api-service.js';
import { MyApp } from './app/my-app.js';
import { routes, defaultRoutes } from './app/routes.js';
import { getConfig, loadConfig } from './config.js';


loadConfig('/config/config.json')
    .then(() => {

        const config = getConfig();

        const remote = new RemoteService({
            baseUrl: config.apiBaseUrl
        });

        const authService = new AuthService({
            remote,
            storage: window.localStorage,  // pokud chceš persistentní login
            storageKey: 'demo-auth'
        });

        const apiService = new RemoteApiService({
            remote,
            auth: authService
        });

        const app = new MyApp({
            authService,
            apiService,
            routes,
            defaultRoutes
        });

        app.start(document.getElementById('app-root'));

    });

