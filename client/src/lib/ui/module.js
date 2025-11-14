// Module.js

import { Component } from "./component.js";

export class Module extends Component {

    constructor(parent = null) {
        super(parent);
        this.state = {};
        this.loading = false;
        this.error = null;
    }

    async load(params) {
        // potomci: načtení dat z API
    }

    async save() {
        // potomci: uložení dat
    }

    async enter(params) {
        // default: jen zavolá load
        this.loading = true;
        this.error = null;
        this.render();

        try {
            await this.load(params);
        } catch (err) {
            this.error = err;
        } finally {
            this.loading = false;
            this.render();
        }
    }

    setState(patch) {
        this.state = {
            ...this.state,
            ...patch,
        };
        this.render();
    }

    // render(vm) si implementují konkrétní moduly
}
