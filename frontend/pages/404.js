/**
 * Page 404 - Non trouvée
 */

import { Button } from '../modules/ui.js';

export default function NotFoundPage() {
    const container = document.createElement('div');
    container.className = 'flex items-center justify-center min-h-[60vh]';

    const content = document.createElement('div');
    content.className = 'text-center';

    // Code 404
    const code = document.createElement('h1');
    code.className = 'text-9xl font-bold text-blue-600 mb-4';
    code.textContent = '404';

    // Titre
    const title = document.createElement('h2');
    title.className = 'text-3xl font-bold text-gray-900 mb-4';
    title.textContent = 'Page non trouvée';

    // Description
    const description = document.createElement('p');
    description.className = 'text-gray-600 mb-8 max-w-md mx-auto';
    description.textContent = 'Désolé, la page que vous recherchez n\'existe pas ou a été déplacée.';

    // Boutons
    const buttonsDiv = document.createElement('div');
    buttonsDiv.className = 'flex gap-4 justify-center';

    const homeButton = Button({
        text: 'Retour à l\'accueil',
        variant: 'primary',
        onClick: () => window.location.hash = '#/dashboard'
    });

    const backButton = Button({
        text: 'Page précédente',
        variant: 'secondary',
        onClick: () => window.history.back()
    });

    buttonsDiv.appendChild(homeButton);
    buttonsDiv.appendChild(backButton);

    // Assemblage
    content.appendChild(code);
    content.appendChild(title);
    content.appendChild(description);
    content.appendChild(buttonsDiv);

    container.appendChild(content);

    return container;
}
