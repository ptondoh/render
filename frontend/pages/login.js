/**
 * Page de connexion
 */

import auth from '../modules/auth.js';
import { Input, Button, Card, Alert, Spinner } from '../modules/ui.js';

export default function LoginPage() {
    const container = document.createElement('div');
    container.className = 'min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-blue-100 px-4';

    // État de la page
    let isLoading = false;
    let mfaRequired = false;
    let tempToken = null;
    let errorMessage = '';
    let emailValue = '';
    let passwordValue = '';
    let mfaCode = '';

    // Formulaire de connexion
    function renderLoginForm() {
        const card = Card({
            className: 'w-full max-w-md',
            children: [
                // Header avec logo
                (() => {
                    const header = document.createElement('div');
                    header.className = 'text-center mb-8';

                    const logo = document.createElement('div');
                    logo.className = 'w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4';
                    logo.innerHTML = '<span class="text-white font-bold text-4xl">S</span>';

                    const title = document.createElement('h1');
                    title.className = 'text-3xl font-bold text-gray-900 mb-2';
                    title.textContent = 'Système d\'Alerte Précoce';

                    const subtitle = document.createElement('p');
                    subtitle.className = 'text-gray-600';
                    subtitle.textContent = 'Connectez-vous à votre compte';

                    header.appendChild(logo);
                    header.appendChild(title);
                    header.appendChild(subtitle);
                    return header;
                })(),

                // Message d'erreur
                (() => {
                    if (!errorMessage) return document.createTextNode('');

                    return Alert({
                        message: errorMessage,
                        type: 'error',
                        onClose: () => {
                            errorMessage = '';
                            render();
                        },
                        className: 'mb-4'
                    });
                })(),

                // Formulaire
                (() => {
                    const form = document.createElement('form');
                    form.className = 'space-y-4';

                    // Email
                    const emailInput = Input({
                        type: 'email',
                        label: 'Adresse email',
                        placeholder: 'exemple@sap.ht',
                        required: true,
                        id: 'email-input',
                        value: emailValue,
                        onChange: (value) => { emailValue = value; }
                    });
                    form.appendChild(emailInput);

                    // Mot de passe
                    const passwordInput = Input({
                        type: 'password',
                        label: 'Mot de passe',
                        placeholder: '••••••••',
                        required: true,
                        id: 'password-input',
                        value: passwordValue,
                        onChange: (value) => { passwordValue = value; }
                    });
                    form.appendChild(passwordInput);

                    // Se souvenir de moi
                    const rememberDiv = document.createElement('div');
                    rememberDiv.className = 'flex items-center';

                    const rememberCheckbox = document.createElement('input');
                    rememberCheckbox.type = 'checkbox';
                    rememberCheckbox.id = 'remember-me';
                    rememberCheckbox.className = 'h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500';

                    const rememberLabel = document.createElement('label');
                    rememberLabel.htmlFor = 'remember-me';
                    rememberLabel.className = 'ml-2 text-sm text-gray-600';
                    rememberLabel.textContent = 'Se souvenir de moi';

                    rememberDiv.appendChild(rememberCheckbox);
                    rememberDiv.appendChild(rememberLabel);
                    form.appendChild(rememberDiv);

                    // Bouton de connexion
                    const submitButton = Button({
                        text: isLoading ? 'Connexion...' : 'Se connecter',
                        variant: 'primary',
                        className: 'w-full mt-6',
                        disabled: isLoading,
                        type: 'submit'
                    });

                    if (isLoading) {
                        const spinner = Spinner({ size: 'sm', className: 'inline-block mr-2' });
                        submitButton.insertBefore(spinner, submitButton.firstChild);
                    }

                    form.appendChild(submitButton);

                    // Gestionnaire de soumission
                    form.addEventListener('submit', async (e) => {
                        e.preventDefault();

                        if (!emailValue || !passwordValue) {
                            errorMessage = 'Veuillez remplir tous les champs';
                            render();
                            return;
                        }

                        isLoading = true;
                        errorMessage = '';
                        render();

                        try {
                            const result = await auth.login(emailValue, passwordValue);

                            if (result.mfa_required) {
                                // Passer à l'étape MFA
                                mfaRequired = true;
                                tempToken = result.temp_token;
                                isLoading = false;
                                render();
                            } else {
                                // Connexion réussie, rediriger
                                window.location.hash = '#/dashboard';
                            }

                        } catch (error) {
                            errorMessage = error.message || 'Erreur lors de la connexion';
                            isLoading = false;
                            render();
                        }
                    });

                    return form;
                })()
            ]
        });

        return card;
    }

    // Formulaire MFA
    function renderMFAForm() {
        const card = Card({
            className: 'w-full max-w-md',
            children: [
                // Header
                (() => {
                    const header = document.createElement('div');
                    header.className = 'text-center mb-8';

                    const title = document.createElement('h2');
                    title.className = 'text-2xl font-bold text-gray-900 mb-2';
                    title.textContent = 'Authentification à deux facteurs';

                    const subtitle = document.createElement('p');
                    subtitle.className = 'text-gray-600';
                    subtitle.textContent = 'Entrez le code de votre application d\'authentification';

                    header.appendChild(title);
                    header.appendChild(subtitle);
                    return header;
                })(),

                // Message d'erreur
                (() => {
                    if (!errorMessage) return document.createTextNode('');

                    return Alert({
                        message: errorMessage,
                        type: 'error',
                        onClose: () => {
                            errorMessage = '';
                            render();
                        },
                        className: 'mb-4'
                    });
                })(),

                // Formulaire
                (() => {
                    const form = document.createElement('form');
                    form.className = 'space-y-4';

                    // Code MFA
                    const codeInput = Input({
                        type: 'text',
                        label: 'Code de vérification',
                        placeholder: '123456',
                        required: true,
                        id: 'mfa-code-input',
                        value: mfaCode,
                        onChange: (value) => { mfaCode = value; },
                        maxlength: '6',
                        pattern: '[0-9]{6}'
                    });
                    form.appendChild(codeInput);

                    // Bouton de validation
                    const submitButton = Button({
                        text: isLoading ? 'Vérification...' : 'Vérifier',
                        variant: 'primary',
                        className: 'w-full',
                        disabled: isLoading,
                        type: 'submit'
                    });

                    if (isLoading) {
                        const spinner = Spinner({ size: 'sm', className: 'inline-block mr-2' });
                        submitButton.insertBefore(spinner, submitButton.firstChild);
                    }

                    form.appendChild(submitButton);

                    // Bouton retour
                    const backButton = Button({
                        text: 'Retour',
                        variant: 'secondary',
                        className: 'w-full mt-2',
                        onClick: () => {
                            mfaRequired = false;
                            tempToken = null;
                            errorMessage = '';
                            mfaCode = '';
                            render();
                        }
                    });
                    form.appendChild(backButton);

                    // Gestionnaire de soumission
                    form.addEventListener('submit', async (e) => {
                        e.preventDefault();

                        if (!mfaCode || mfaCode.length !== 6) {
                            errorMessage = 'Veuillez entrer un code à 6 chiffres';
                            render();
                            return;
                        }

                        isLoading = true;
                        errorMessage = '';
                        render();

                        try {
                            await auth.verifyMFA(tempToken, mfaCode);
                            // Connexion réussie, rediriger
                            window.location.hash = '#/dashboard';

                        } catch (error) {
                            errorMessage = error.message || 'Code invalide';
                            isLoading = false;
                            render();
                        }
                    });

                    return form;
                })()
            ]
        });

        return card;
    }

    // Fonction de rendu
    function render() {
        container.innerHTML = '';

        const content = mfaRequired ? renderMFAForm() : renderLoginForm();
        container.appendChild(content);
    }

    // Rendu initial
    render();

    return container;
}
