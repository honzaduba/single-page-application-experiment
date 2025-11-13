// main.js

import { RemoteService } from './lib/data/remote/remote-service.js';
import { AuthService } from './lib/data/remote/auth-service.js';
import { RemoteApiService } from './lib/data/remote/remote-api-service.js';
import { MyApp } from './app/my-app.js';

const remote = new RemoteService({
    baseUrl: 'http://localhost:3000'
});

const auth = new AuthService({
    remote,
    storage: window.localStorage,  // pokud chceš persistentní login
    storageKey: 'demo-auth'
});

const api = new RemoteApiService({
    remote,
    auth
});

const app = new MyApp({
    authService: auth,
    apiService: api,
    // případně další domain služby, router, atd.
});

app.start(document.getElementById('app-root'));
