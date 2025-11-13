import { defineElement as el } from './rendering/domvm.js';

// Control.js
export class Control {

    /**
     * @param {Control|null} parent
     */
    constructor(parent = null, params = {}) {
        if (!parent)
            throw new Error('Parent is required.');
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
    redraw() {
        this.parent.redraw();
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
