import { Application } from '../lib/ui/application.js';

export class MyApp extends Application {

    showLogin() {
        // např. LoginModule
        import("./modules/login-module.js").then(({ LoginModule }) => {
            this.showModule(LoginModule);
        });
    }

    showMain(user) {
        // např. DashboardModule / UserProfileModule
        import("./modules/user-profile-module.js").then(({ UserProfileModule }) => {
            this.showModule(UserProfileModule, { user });
        });
    }

}