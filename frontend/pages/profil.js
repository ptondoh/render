/**
 * Page Mon Profil
 * Gestion des infos personnelles, changement de mot de passe et MFA.
 */

import auth from '../modules/auth.js';
import api from '../modules/api.js';
import { Card, Modal, showToast, Spinner, Badge } from '../modules/ui.js';

export default function ProfilPage() {
    const container = document.createElement('div');
    container.className = 'space-y-6 max-w-2xl mx-auto';

    // ── État ─────────────────────────────────────────────────────────────────
    let isLoading = true;
    let user = auth.getCurrentUser();
    let isEditingProfile = false;
    let profileForm = {
        nom: user?.nom || '',
        prenom: user?.prenom || '',
        telephone: user?.telephone || ''
    };
    let passwordForm = { current: '', new: '', confirm: '' };
    // Méthode 2FA
    let mfaSetupData = null;      // { secret, qr_code, backup_codes }
    let mfaVerifyCode = '';
    let backupCodesToShow = [];
    let showBackupCodesModal = false;
    // Méthode 2FA sélectionnée dans l'UI (avant sauvegarde)
    let pendingTwoFaMethod = null; // null = pas de changement en cours

    // ── Header ────────────────────────────────────────────────────────────────
    function renderHeader() {
        const header = document.createElement('div');
        header.className = 'mb-2';

        const title = document.createElement('h1');
        title.className = 'text-3xl font-bold text-gray-900';
        title.textContent = 'Mon Profil';

        const subtitle = document.createElement('p');
        subtitle.className = 'text-gray-500 mt-1';
        subtitle.textContent = user?.email || '';

        header.appendChild(title);
        header.appendChild(subtitle);
        return header;
    }

    // ── Section 1 : Informations personnelles ─────────────────────────────────
    function renderSectionInfos() {
        const body = document.createElement('div');
        body.className = 'space-y-4';

        if (!isEditingProfile) {
            // Mode lecture
            const fields = [
                { label: 'Email', value: user?.email, readonly: true },
                { label: 'Nom', value: user?.nom || '—' },
                { label: 'Prénom', value: user?.prenom || '—' },
                { label: 'Téléphone', value: user?.telephone || '—' },
            ];

            fields.forEach(({ label, value, readonly }) => {
                const row = document.createElement('div');
                row.className = 'flex justify-between items-center py-2 border-b border-gray-100 last:border-0';

                const labelEl = document.createElement('span');
                labelEl.className = 'text-sm font-medium text-gray-500';
                labelEl.textContent = label;

                const valueEl = document.createElement('span');
                valueEl.className = `text-sm ${readonly ? 'text-gray-400' : 'text-gray-900'} text-right`;
                valueEl.textContent = value;

                row.appendChild(labelEl);
                row.appendChild(valueEl);
                body.appendChild(row);
            });

            // Rôles
            const roleRow = document.createElement('div');
            roleRow.className = 'flex justify-between items-center py-2 border-b border-gray-100';

            const roleLabel = document.createElement('span');
            roleLabel.className = 'text-sm font-medium text-gray-500';
            roleLabel.textContent = 'Rôles';

            const badgesDiv = document.createElement('div');
            badgesDiv.className = 'flex flex-wrap gap-1 justify-end';

            const roleList = user?.role_names || user?.roles || [];
            if (roleList.length === 0) {
                badgesDiv.textContent = '—';
            } else {
                roleList.forEach(role => {
                    const variant = role === 'agent' ? 'info' :
                                    role === 'décideur' ? 'success' :
                                    role === 'bailleur' ? 'warning' : 'default';
                    const badge = Badge({ text: role.charAt(0).toUpperCase() + role.slice(1), variant });
                    badgesDiv.appendChild(badge);
                });
            }

            roleRow.appendChild(roleLabel);
            roleRow.appendChild(badgesDiv);
            body.appendChild(roleRow);

            // Bouton Modifier
            const btnRow = document.createElement('div');
            btnRow.className = 'pt-2';
            const editBtn = document.createElement('button');
            editBtn.className = 'px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700';
            editBtn.textContent = 'Modifier';
            editBtn.addEventListener('click', () => {
                profileForm = {
                    nom: user?.nom || '',
                    prenom: user?.prenom || '',
                    telephone: user?.telephone || ''
                };
                isEditingProfile = true;
                render();
            });
            btnRow.appendChild(editBtn);
            body.appendChild(btnRow);

        } else {
            // Mode édition
            [
                { label: 'Nom', key: 'nom', placeholder: 'Dupont' },
                { label: 'Prénom', key: 'prenom', placeholder: 'Jean' },
                { label: 'Téléphone', key: 'telephone', placeholder: '+509 3700-0000' },
            ].forEach(({ label, key, placeholder }) => {
                const group = document.createElement('div');

                const lbl = document.createElement('label');
                lbl.className = 'block text-sm font-medium text-gray-700 mb-1';
                lbl.textContent = label;

                const input = document.createElement('input');
                input.type = 'text';
                input.value = profileForm[key];
                input.placeholder = placeholder;
                input.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent';
                input.addEventListener('input', () => { profileForm[key] = input.value; });

                group.appendChild(lbl);
                group.appendChild(input);
                body.appendChild(group);
            });

            // Boutons
            const btnRow = document.createElement('div');
            btnRow.className = 'flex gap-3 pt-2';

            const saveBtn = document.createElement('button');
            saveBtn.className = 'px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700';
            saveBtn.textContent = 'Enregistrer';
            saveBtn.addEventListener('click', handleSaveProfile);

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300';
            cancelBtn.textContent = 'Annuler';
            cancelBtn.addEventListener('click', () => { isEditingProfile = false; render(); });

            btnRow.appendChild(saveBtn);
            btnRow.appendChild(cancelBtn);
            body.appendChild(btnRow);
        }

        return Card({ title: 'Informations personnelles', children: body });
    }

    // ── Section 2 : Changer le mot de passe ───────────────────────────────────
    function renderSectionPassword() {
        const body = document.createElement('div');
        body.className = 'space-y-4';

        const fields = [
            { label: 'Mot de passe actuel', key: 'current', placeholder: '••••••••' },
            { label: 'Nouveau mot de passe', key: 'new', placeholder: '8 caractères minimum' },
            { label: 'Confirmer le nouveau', key: 'confirm', placeholder: '••••••••' },
        ];

        fields.forEach(({ label, key, placeholder }) => {
            const group = document.createElement('div');

            const lbl = document.createElement('label');
            lbl.className = 'block text-sm font-medium text-gray-700 mb-1';
            lbl.textContent = label;

            const wrapper = document.createElement('div');
            wrapper.className = 'relative';

            const input = document.createElement('input');
            input.type = 'password';
            input.value = passwordForm[key];
            input.placeholder = placeholder;
            input.className = 'w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent';
            input.addEventListener('input', () => { passwordForm[key] = input.value; });

            const toggle = document.createElement('button');
            toggle.type = 'button';
            toggle.className = 'absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600';
            toggle.textContent = '👁';
            toggle.setAttribute('aria-label', 'Afficher/masquer le mot de passe');
            toggle.addEventListener('click', () => {
                input.type = input.type === 'password' ? 'text' : 'password';
                toggle.textContent = input.type === 'password' ? '👁' : '🙈';
            });

            wrapper.appendChild(input);
            wrapper.appendChild(toggle);
            group.appendChild(lbl);
            group.appendChild(wrapper);
            body.appendChild(group);
        });

        const hint = document.createElement('p');
        hint.className = 'text-xs text-gray-500';
        hint.textContent = 'Le nouveau mot de passe doit contenir au moins 8 caractères.';
        body.appendChild(hint);

        const btn = document.createElement('button');
        btn.className = 'px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700';
        btn.textContent = 'Changer le mot de passe';
        btn.addEventListener('click', handleChangePassword);
        body.appendChild(btn);

        return Card({ title: 'Changer le mot de passe', children: body });
    }

    // ── Section 3 : Méthode de 2e facteur ────────────────────────────────────
    function renderSection2FA() {
        const body = document.createElement('div');
        body.className = 'space-y-5';

        // Méthode actuelle (depuis la BDD ou dérivée)
        const currentMethod = user?.two_fa_method || (user?.mfa_enabled ? 'totp' : 'none');
        const displayMethod = pendingTwoFaMethod !== null ? pendingTwoFaMethod : currentMethod;

        // ── Sélecteur de méthode ─────────────────────────────────
        const selectorDiv = document.createElement('div');
        selectorDiv.className = 'space-y-3';

        const methods = [
            {
                value: 'none',
                label: 'Aucune vérification',
                desc: 'Connexion directe avec email et mot de passe uniquement.',
                icon: '🔓'
            },
            {
                value: 'totp',
                label: 'Application d\'authentification (TOTP)',
                desc: 'Google Authenticator, Authy, etc. Code valide 30 secondes.',
                icon: '📱'
            },
            {
                value: 'email',
                label: 'Code par email',
                desc: 'Un code à 6 chiffres est envoyé à votre email à chaque connexion.',
                icon: '✉️'
            }
        ];

        methods.forEach(({ value, label, desc, icon }) => {
            const option = document.createElement('label');
            option.className = `flex items-start gap-3 p-3 border-2 rounded-lg cursor-pointer transition-colors ${
                displayMethod === value ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
            }`;

            const radio = document.createElement('input');
            radio.type = 'radio';
            radio.name = 'two-fa-method';
            radio.value = value;
            radio.checked = displayMethod === value;
            radio.className = 'mt-0.5 shrink-0';
            radio.addEventListener('change', () => {
                pendingTwoFaMethod = value;
                mfaSetupData = null;
                mfaVerifyCode = '';
                render();
            });

            const textDiv = document.createElement('div');
            textDiv.className = 'flex-1';

            const labelTitle = document.createElement('div');
            labelTitle.className = 'text-sm font-medium text-gray-900';
            labelTitle.textContent = `${icon} ${label}`;

            const labelDesc = document.createElement('div');
            labelDesc.className = 'text-xs text-gray-500 mt-0.5';
            labelDesc.textContent = desc;

            textDiv.appendChild(labelTitle);
            textDiv.appendChild(labelDesc);
            option.appendChild(radio);
            option.appendChild(textDiv);
            selectorDiv.appendChild(option);
        });

        body.appendChild(selectorDiv);

        // ── Contenu contextuel selon la méthode sélectionnée ─────
        if (pendingTwoFaMethod !== null && pendingTwoFaMethod !== currentMethod) {

            if (pendingTwoFaMethod === 'totp' && !mfaSetupData) {
                // Démarrer le setup TOTP
                const startBtn = document.createElement('button');
                startBtn.className = 'w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700';
                startBtn.textContent = 'Configurer l\'application d\'authentification →';
                startBtn.addEventListener('click', handleSetupMFA);
                body.appendChild(startBtn);

            } else if (pendingTwoFaMethod === 'none' || pendingTwoFaMethod === 'email') {
                // Bouton de confirmation
                const confirmBtn = document.createElement('button');
                confirmBtn.className = 'w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700';
                confirmBtn.textContent = 'Enregistrer';
                confirmBtn.addEventListener('click', () => handleSaveTwoFaMethod(pendingTwoFaMethod));
                body.appendChild(confirmBtn);

                const cancelBtn = document.createElement('button');
                cancelBtn.className = 'w-full px-4 py-2 text-sm text-gray-500 hover:text-gray-700';
                cancelBtn.textContent = 'Annuler';
                cancelBtn.addEventListener('click', () => { pendingTwoFaMethod = null; render(); });
                body.appendChild(cancelBtn);
            }
        }

        // ── Flow TOTP setup (QR code + vérification) ─────────────
        if (mfaSetupData) {
            const setupDiv = document.createElement('div');
            setupDiv.className = 'space-y-4 border-t pt-4';

            const step1 = document.createElement('p');
            step1.className = 'text-sm font-medium text-gray-700';
            step1.textContent = 'Étape 1 — Scannez ce QR code avec votre application :';
            setupDiv.appendChild(step1);

            const qrImg = document.createElement('img');
            qrImg.src = mfaSetupData.qr_code;
            qrImg.alt = 'QR Code MFA';
            qrImg.className = 'w-48 h-48 border border-gray-200 rounded-lg mx-auto block';
            setupDiv.appendChild(qrImg);

            const secretLabel = document.createElement('p');
            secretLabel.className = 'text-xs text-gray-500 text-center';
            secretLabel.textContent = 'Code manuel :';
            setupDiv.appendChild(secretLabel);

            const secretBox = document.createElement('div');
            secretBox.className = 'bg-gray-100 rounded-lg px-4 py-2 text-center';
            secretBox.innerHTML = `<code class="text-sm font-mono tracking-widest text-gray-800 break-all">${mfaSetupData.secret}</code>`;
            setupDiv.appendChild(secretBox);

            const step2 = document.createElement('p');
            step2.className = 'text-sm font-medium text-gray-700 pt-2';
            step2.textContent = 'Étape 2 — Entrez le code à 6 chiffres pour confirmer :';
            setupDiv.appendChild(step2);

            const codeInput = document.createElement('input');
            codeInput.type = 'text';
            codeInput.inputMode = 'numeric';
            codeInput.maxLength = 6;
            codeInput.value = mfaVerifyCode;
            codeInput.placeholder = '000000';
            codeInput.className = 'w-full px-3 py-2 border border-gray-300 rounded-lg text-center text-lg font-mono tracking-widest focus:ring-2 focus:ring-blue-500';
            codeInput.addEventListener('input', () => {
                mfaVerifyCode = codeInput.value.replace(/\D/g, '').slice(0, 6);
                codeInput.value = mfaVerifyCode;
            });
            setupDiv.appendChild(codeInput);

            const btnRow = document.createElement('div');
            btnRow.className = 'flex gap-3';

            const confirmBtn = document.createElement('button');
            confirmBtn.className = 'flex-1 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700';
            confirmBtn.textContent = 'Confirmer l\'activation';
            confirmBtn.addEventListener('click', handleVerifyMFASetup);

            const cancelBtn = document.createElement('button');
            cancelBtn.className = 'px-4 py-2 bg-gray-200 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-300';
            cancelBtn.textContent = 'Annuler';
            cancelBtn.addEventListener('click', () => {
                mfaSetupData = null;
                mfaVerifyCode = '';
                pendingTwoFaMethod = null;
                render();
            });

            btnRow.appendChild(confirmBtn);
            btnRow.appendChild(cancelBtn);
            setupDiv.appendChild(btnRow);
            body.appendChild(setupDiv);
        }

        return Card({ title: 'Méthode de vérification en 2 étapes', children: body });
    }

    // ── Modal : codes de secours ───────────────────────────────────────────────
    function renderBackupCodesModal() {
        if (!showBackupCodesModal) return document.createElement('div');

        const content = document.createElement('div');
        content.className = 'space-y-4';

        const warning = document.createElement('div');
        warning.className = 'bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3';
        warning.innerHTML = '<p class="text-sm font-medium text-yellow-800">⚠️ Ces codes ne seront affichés qu\'une seule fois. Conservez-les dans un endroit sûr.</p>';
        content.appendChild(warning);

        const desc = document.createElement('p');
        desc.className = 'text-sm text-gray-600';
        desc.textContent = 'Si vous perdez accès à votre application d\'authentification, vous pouvez utiliser ces codes de secours (un seul usage chacun) :';
        content.appendChild(desc);

        const codesGrid = document.createElement('div');
        codesGrid.className = 'grid grid-cols-2 gap-2 bg-gray-50 rounded-lg p-4';
        backupCodesToShow.forEach(code => {
            const codeEl = document.createElement('code');
            codeEl.className = 'font-mono text-sm text-center bg-white border border-gray-200 rounded px-2 py-1';
            codeEl.textContent = code;
            codesGrid.appendChild(codeEl);
        });
        content.appendChild(codesGrid);

        const copyBtn = document.createElement('button');
        copyBtn.className = 'w-full px-4 py-2 bg-gray-100 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-200';
        copyBtn.textContent = '📋 Copier tous les codes';
        copyBtn.addEventListener('click', () => {
            navigator.clipboard.writeText(backupCodesToShow.join('\n')).then(() => {
                showToast({ message: 'Codes copiés dans le presse-papiers', type: 'success' });
            });
        });
        content.appendChild(copyBtn);

        const footer = document.createElement('button');
        footer.className = 'w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700';
        footer.textContent = 'J\'ai sauvegardé mes codes — Fermer';
        footer.addEventListener('click', () => {
            backupCodesToShow = [];
            showBackupCodesModal = false;
            render();
        });

        return Modal({
            title: '🔑 Codes de secours MFA',
            content,
            footer,
            onClose: () => {
                backupCodesToShow = [];
                showBackupCodesModal = false;
                render();
            }
        });
    }

    // ── Handlers ──────────────────────────────────────────────────────────────
    async function handleSaveProfile() {
        try {
            const updated = await api.request('/api/auth/profile', {
                method: 'PATCH',
                body: JSON.stringify({
                    nom: profileForm.nom.trim() || null,
                    prenom: profileForm.prenom.trim() || null,
                    telephone: profileForm.telephone.trim() || null
                })
            });
            // Fusionner les nouvelles données dans le cache
            const merged = { ...(auth.getCurrentUser() || {}), ...updated };
            auth.saveUserToStorage(merged);
            user = auth.getCurrentUser();
            isEditingProfile = false;
            showToast({ message: 'Profil mis à jour avec succès', type: 'success' });
            render();
        } catch (error) {
            showToast({ message: error.message || 'Erreur lors de la mise à jour', type: 'error' });
        }
    }

    async function handleChangePassword() {
        if (!passwordForm.current) {
            showToast({ message: 'Entrez votre mot de passe actuel', type: 'error' });
            return;
        }
        if (passwordForm.new.length < 8) {
            showToast({ message: 'Le nouveau mot de passe doit contenir au moins 8 caractères', type: 'error' });
            return;
        }
        if (passwordForm.new !== passwordForm.confirm) {
            showToast({ message: 'Les nouveaux mots de passe ne correspondent pas', type: 'error' });
            return;
        }
        try {
            await api.post('/api/auth/change-password', {
                current_password: passwordForm.current,
                new_password: passwordForm.new
            });
            passwordForm = { current: '', new: '', confirm: '' };
            showToast({ message: 'Mot de passe changé avec succès', type: 'success' });
            render();
        } catch (error) {
            showToast({ message: error.message || 'Erreur lors du changement de mot de passe', type: 'error' });
        }
    }

    async function handleSetupMFA() {
        try {
            const data = await auth.setupMFA();
            mfaSetupData = data;
            mfaVerifyCode = '';
            render();
        } catch (_) {
            // toast déjà affiché par auth.setupMFA()
        }
    }

    async function handleVerifyMFASetup() {
        if (!/^\d{6}$/.test(mfaVerifyCode)) {
            showToast({ message: 'Le code doit contenir exactement 6 chiffres', type: 'error' });
            return;
        }
        try {
            await auth.verifyMFASetup(mfaVerifyCode);
            backupCodesToShow = mfaSetupData?.backup_codes || [];
            mfaSetupData = null;
            mfaVerifyCode = '';
            pendingTwoFaMethod = null;
            showBackupCodesModal = backupCodesToShow.length > 0;
            // Rafraîchir depuis le serveur pour obtenir two_fa_method = "totp"
            user = await auth.refreshUserData();
            render();
        } catch (_) {
            // toast déjà affiché par auth.verifyMFASetup()
        }
    }

    async function handleDisableMFA() {
        if (!confirm('Désactiver le MFA réduira la sécurité de votre compte.\n\nContinuer ?')) return;
        try {
            await auth.disableMFA();
            user = auth.getCurrentUser();
            render();
        } catch (_) {
            // toast déjà affiché par auth.disableMFA()
        }
    }

    async function handleSaveTwoFaMethod(method) {
        try {
            await api.request('/api/auth/two-fa-method', {
                method: 'PATCH',
                body: JSON.stringify({ method })
            });
            // Rafraîchir les données utilisateur depuis le serveur
            user = await auth.refreshUserData();
            pendingTwoFaMethod = null;
            const labels = { none: 'désactivée', email: 'Email OTP', totp: 'Application TOTP' };
            showToast({ message: `Vérification en 2 étapes : ${labels[method] || method}`, type: 'success' });
            render();
        } catch (error) {
            showToast({ message: error.message || 'Erreur lors de la mise à jour', type: 'error' });
        }
    }

    // ── Chargement initial ────────────────────────────────────────────────────
    async function loadUserData() {
        try {
            isLoading = true;
            render();
            const freshUser = await auth.refreshUserData();
            user = freshUser;
            profileForm = {
                nom: user?.nom || '',
                prenom: user?.prenom || '',
                telephone: user?.telephone || ''
            };
            isLoading = false;
            render();
        } catch (_) {
            isLoading = false;
            render();
        }
    }

    // ── Rendu principal ───────────────────────────────────────────────────────
    function render() {
        container.innerHTML = '';
        container.appendChild(renderHeader());

        if (isLoading) {
            const loader = document.createElement('div');
            loader.className = 'flex justify-center py-16';
            const spinner = Spinner({ size: 'lg' });
            loader.appendChild(spinner);
            container.appendChild(loader);
            return;
        }

        container.appendChild(renderSectionInfos());
        container.appendChild(renderSectionPassword());
        container.appendChild(renderSection2FA());

        if (showBackupCodesModal) {
            container.appendChild(renderBackupCodesModal());
        }
    }

    loadUserData();
    return container;
}
