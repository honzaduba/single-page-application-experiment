// Component.js

import { defineElement as el } from './rendering/domvm.js';
import { Control } from "./control.js";

export class Component extends Control {

    constructor(parent = null) {
        super(parent);
        this.children = [];
    }

    addChild(child) {
        this.children.push(child);
        return child;
    }

    removeChild(child) {
        const idx = this.children.indexOf(child);
        if (idx >= 0) {
            this.children.splice(idx, 1);
        }
    }

    clearChildren() {
        this.children.length = 0;
    }

    render(vm) {

        return el('div', this.children.reduce((vmnodes, child) => {
            const vmnode = child.render(vm);
            if (vmnode)
                vmnodes.add(vmnode);
            return vmnodes;
        }, []));

    }
}
