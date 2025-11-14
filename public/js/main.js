// main.js

import { RemoteService } from './lib/data/remote/remote-service.js';
import { AuthService } from './lib/data/remote/auth-service.js';
import { RemoteApiService } from './lib/data/remote/remote-api-service.js';
import { MyApp } from './app/my-app.js';
import { routes, defaultRoutes } from './app/routes.js';

const remote = new RemoteService({
    baseUrl: 'http://localhost:3000'
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
