import { Module } from '../../lib/ui/module.js';
import { defineElement } from 'domvm';

export class UserProfileModule extends Module {

    render(vm) {

        const el = defineElement;

        return el('div', [
            el('h1', [
                'User Profile Module'
            ]),
            el('p', [
                'Welcome to user profile!'
            ]),
        ]);

    }    

}