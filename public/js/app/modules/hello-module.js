import { Module } from '../../lib/ui/module.js';
import { defineElement as el } from '../../lib/ui/rendering/domvm.js';

export class HelloModule extends Module {

    render(vm) {

        return el('div', [
            el('h1', [
                'Hello'
            ]),
            el('p', [
                'Welcome to The Single Page Application Experiment!'
            ]),
        ]);

    }

}