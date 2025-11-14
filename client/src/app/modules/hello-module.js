import { Module } from '../../lib/ui/module.js';
import { defineElement } from 'domvm';

export class HelloModule extends Module {

    render(vm) {

        const el = defineElement;

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