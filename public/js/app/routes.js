// routes.js

const routes = [
    {
        name: 'login',
        path: '/login',
        module: '/app/modules/login-module.js',
        export: 'LoginModule', // default by mohl být 'default', když nepřidáš
        public: true,
        title: 'Login uživatele'
    },
    {
        name: 'user-profile',
        path: '/users/{id:num}/profile',
        module: '/app/modules/user-profile-module.js',
        export: 'UserProfileModule',
        privileges: ['open', 'browse', 'edit'],
        public: false,
        title: 'Profil uživatele'
    },
    {
        name: 'hello',
        path: '/hello',
        module: '/app/modules/hello-module.js',
        export: 'HelloModule',
        public: true,
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
