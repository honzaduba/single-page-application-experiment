import { defineElement as el } from './rendering/domvm.js';

// Control.js
export class Control {

    /**
     * @param {Control|null} parent
     */
    constructor(parent = null, params = {}) {
        if (!parent) throw new Error('Control: "parent" (Control) is required.');
        this.parent = parent;
    }

    /**
     * Vrátí Application (root).
     */
    getApp() {
        return this.parent.getApp();
    }

    /**
     * Požádá parenta o překreslení.
     */
    invalidate() {
        this.parent.invalidate();
    }

    /**
     * Základní render – potomci MUSÍ přepsat.
     * @param {*} vm domvm viewmodel – můžeš ignorovat, když ho nepotřebuješ
     */
    render(vm) {

        return el("div", [
            'Control'
        ]);

    }
}
