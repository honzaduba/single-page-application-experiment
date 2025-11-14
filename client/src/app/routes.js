// routes.js

const routes = [
    {
        name: 'login',
        path: '/login',
        module: '/app/modules/login-module',
        export: 'LoginModule', // default by mohl být 'default', když nepřidáš
        public: true,
        title: 'Login uživatele'
    },
    {
        name: 'user-profile',
        path: '/users/{id:num}/profile',
        module: '/app/modules/user-profile-module',
        export: 'UserProfileModule',
        privileges: ['open', 'browse', 'edit'],
        public: false,
        title: 'Profil uživatele'
    },
    {
        name: 'hello',
        path: '/hello',
        module: '/app/modules/hello-module',
        export: 'HelloModule',
        public: false,
        title: 'Hello stránka'
    }
];

const defaultRoutes = {
    defaultRouteName: 'hello',
    loginRouteName: 'login',
    notFoundRouteName: 'error-not-found',
    unauthorizedRouteName: 'error-unauthorized',
    forbiddenRoutename: 'error-forbidden',
};

export { routes, defaultRoutes };
