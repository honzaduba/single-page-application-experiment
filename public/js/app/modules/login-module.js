// modules/LoginModule.js

import { Module } from '../../lib/ui/module.js';
import { defineElement as el } from '../../lib/ui/rendering/domvm.js';

export class LoginModule extends Module {
    constructor(parent) {
        super(parent);

        this.state = {
            username: '',
            password: '',
            message: '',
            busy: false,
        };
    }

    async doLogin() {
        const app = this.getApp();
        const auth = app.authService;

        this.setState({ busy: true, message: '' });

        try {
            await auth.login({
                username: this.state.username,
                password: this.state.password,
            });

            // onLogin event v Application už přepne modul na main
        } catch (err) {
            this.setState({
                message: 'Chyba přihlášení',
            });
        } finally {
            this.setState({ busy: false });
        }
    }

    render(vm) {
        
        if (this.loading) {
            return el('div.login', 'Načítám...');
        }

        if (this.error) {
            return el('div.login', 'Chyba: ' + this.error.message);
        }

        const { username, password, message, busy } = this.state;

        const onSubmit = e => {
            e.preventDefault();
            if (!busy) {
                this.doLogin();
            }
        };

        const onUserChange = e => {
            this.setState({ username: e.target.value });
        };

        const onPassChange = e => {
            this.setState({ password: e.target.value });
        };

        return el('div.login', [
            el('h2', 'Přihlášení'),
            el('form', { onsubmit: onSubmit }, [
                el('div.field', [
                    el('label', 'Uživatel'),
                    el('input', {
                        type: 'text',
                        value: username,
                        oninput: onUserChange,
                    }),
                ]),
                el('div.field', [
                    el('label', 'Heslo'),
                    el('input', {
                        type: 'password',
                        value: password,
                        oninput: onPassChange,
                    }),
                ]),
                el('button', { type: 'submit', disabled: busy }, busy ? 'Přihlašuji...' : 'Přihlásit'),
            ]),
            message ? el('div.message', message) : null,
        ]);
    }
}
