// Application.js

import { Component } from './component.js';
import { defineElement as el, createView } from './rendering/domvm.js';
import { Router } from './routing/router.js';
import { config } from '../../config.js';

export class Application extends Component {

    constructor({
        authService,
        apiService,
        routes,
        defaultRoutes
    }) {

        super({}); // Application nemá parent

        this._authService = authService;
        this._apiService = apiService;

        defaultRoutes ??= {};

        this.router = new Router({
            app: this,
            authService,
            routes,
            onRouteChange: (routeMatch) => this._handleRouteChange(routeMatch),
            defaultRouteName: defaultRoutes.defaultRouteName,
            loginRouteName: defaultRoutes.loginRouteName,
            forbiddenRouteName: defaultRoutes.forbiddenRouteName,
            notFoundRouteName: defaultRoutes.notFoundRouteName,
        });

        this._vm = null;          // domvm viewmodel
        this._rootElement = null; // DOM node
        this.currentModule = null;

        // auth eventy
        this._authService.onLogin(user => {
            // uživatel má nová práva → reset
            this.router.resetToDefaultRoute();
        });

        this._authService.onLogout(() => {
            // po logoutu znovu navolíme první public/accessible routu
            this.router.resetToDefaultRoute();
        });

    }

    getApp() {
        return this; // tohle je root
    }

    get authService() {
        return this._authService;
    }

    get apiService() {
        return this._apiService;
    }

    start(rootElement) {
        this.mount(rootElement);
        this.router.start();
        this.invalidate();
    }

    async _handleRouteChange(routeMatch) {

        if (routeMatch.notFound) {
            // TODO: 404 modul
            this.currentModule = null;
            this.invalidate();
            return;
        }

        const def = routeMatch.def;

        if (!def) {
            this.currentModule = null;
            this.invalidate();
            return;
        }

        // lazy import modulu podle routeDef.module + export
        const modulePath = config.codeBasePath + def.module;
        const exportName = def.export || 'default';

        try {
            const modFile = await import(modulePath);
            const ModuleClass = modFile[exportName];

            if (!ModuleClass) {
                console.error(`Export "${exportName}" not found in ${modulePath}`);
                return;
            }

            const modInstance = new ModuleClass(this);
            this.currentModule = modInstance;

            if (typeof modInstance.enter === 'function') {
                await modInstance.enter({
                    params: routeMatch.params,
                    query: routeMatch.query
                });
            }

            this.invalidate();
        } catch (err) {
            console.error('Failed to load module for route:', def.name, err);
            // TODO: error modul / stránka
        }
    }

    /**
     * Vytvoří domvm view a namountuje app do DOM.
     */
    mount(rootElement) {

        this._rootElement = rootElement;

        const view = (vm, app) => () => app.render(vm);

        this._vm = createView(view, this).mount(rootElement);

        // initial route/state
        if (this.authService.hasValidToken()) {
            this.showMain();
        } else {
            this.showLogin();
        }
    }

    /**
     * Helper pro přepnutí modulu.
     */
    async showModule(ModuleClass, params) {
        const mod = new ModuleClass(this);
        this.currentModule = mod;

        // pokud modul umí enter(), necháme ho načíst data
        if (typeof mod.enter === "function") {
            await mod.enter(params);
        } else if (typeof mod.load === "function") {
            await mod.load(params);
        }

        this.invalidate();
    }

    /**
     * Požádá domvm o překreslení.
     */
    invalidate() {
        if (!this._vm)
            return;
        this._vm.redraw();
    }

    /**
     * Hlavní render celé aplikace – vrací v-tree.
     */
    render(vm) {

        const body = [];

        // jednoduchý header
        body.push(
            el("header.app-header", [
                el("h1", "Moje SPA"),
                this.authService.isAuthenticated()
                    ? el("button", {
                        onclick: () => this.authService.logout(),
                    }, "Odhlásit")
                    : null,
            ])
        );

        // hlavní obsah – aktuální modul
        if (this.currentModule) {
            body.push(
                el("main.app-main", [
                    this.currentModule.render(vm), // modul vrátí svůj v-tree
                ])
            );
        } else {
            body.push(
                el("main.app-main", [
                    el("p", "Načítám..."),
                ])
            );
        }

        return el("div.app-root", body);

    }
}
