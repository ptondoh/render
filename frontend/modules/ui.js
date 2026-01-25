/**
 * Module UI - Composants réutilisables
 * Bibliothèque de composants UI en JavaScript pur
 */

/**
 * Créer un élément DOM avec attributs et classes
 */
function createElement(tag, attributes = {}, ...children) {
    const element = document.createElement(tag);

    // Appliquer les attributs
    Object.entries(attributes).forEach(([key, value]) => {
        if (key === 'className') {
            element.className = value;
        } else if (key === 'style' && typeof value === 'object') {
            Object.assign(element.style, value);
        } else if (key.startsWith('on') && typeof value === 'function') {
            const event = key.substring(2).toLowerCase();
            element.addEventListener(event, value);
        } else if (key === 'disabled' || key === 'checked' || key === 'selected') {
            // Pour les attributs booléens, ne les ajouter que si la valeur est true
            if (value) {
                element.setAttribute(key, key);
            }
        } else {
            element.setAttribute(key, value);
        }
    });

    // Ajouter les enfants
    children.forEach(child => {
        if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
        } else if (child instanceof Node) {
            element.appendChild(child);
        }
    });

    return element;
}

/**
 * Composant Button
 */
export function Button({ text, variant = 'primary', size = 'md', onClick, className = '', ...attrs }) {
    const baseClasses = 'font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2';

    const variantClasses = {
        primary: 'bg-blue-600 text-white hover:bg-blue-700 focus:ring-blue-500',
        secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-500',
        danger: 'bg-red-600 text-white hover:bg-red-700 focus:ring-red-500',
        success: 'bg-green-600 text-white hover:bg-green-700 focus:ring-green-500',
        outline: 'border-2 border-blue-600 text-blue-600 hover:bg-blue-50 focus:ring-blue-500',
    };

    const sizeClasses = {
        sm: 'px-3 py-1.5 text-sm',
        md: 'px-4 py-2 text-base',
        lg: 'px-6 py-3 text-lg',
    };

    return createElement(
        'button',
        {
            className: `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`,
            onClick,
            ...attrs,
        },
        text
    );
}

/**
 * Composant Input
 */
export function Input({ type = 'text', placeholder = '', value = '', onChange, error, label, className = '', ...attrs }) {
    const container = createElement('div', { className: 'mb-4' });

    if (label) {
        const labelEl = createElement('label', {
            className: 'block text-sm font-medium text-gray-700 mb-2',
        }, label);
        container.appendChild(labelEl);
    }

    const input = createElement('input', {
        type,
        placeholder,
        value,
        className: `w-full px-4 py-2 border ${error ? 'border-red-500' : 'border-gray-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 ${className}`,
        onInput: (e) => onChange && onChange(e.target.value, e),
        ...attrs,
    });

    container.appendChild(input);

    if (error) {
        const errorEl = createElement('p', {
            className: 'mt-1 text-sm text-red-600',
        }, error);
        container.appendChild(errorEl);
    }

    return container;
}

/**
 * Composant Card
 */
export function Card({ title, children, footer, className = '' }) {
    const card = createElement('div', {
        className: `bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden ${className}`,
    });

    if (title) {
        const header = createElement('div', {
            className: 'px-6 py-4 border-b border-gray-200',
        }, createElement('h3', { className: 'text-lg font-semibold text-gray-900' }, title));
        card.appendChild(header);
    }

    const body = createElement('div', { className: 'px-6 py-4' });
    if (Array.isArray(children)) {
        children.forEach(child => body.appendChild(child));
    } else if (children instanceof Node) {
        body.appendChild(children);
    }
    card.appendChild(body);

    if (footer) {
        const footerEl = createElement('div', {
            className: 'px-6 py-4 bg-gray-50 border-t border-gray-200',
        });
        if (footer instanceof Node) {
            footerEl.appendChild(footer);
        }
        card.appendChild(footerEl);
    }

    return card;
}

/**
 * Composant Modal
 */
export function Modal({ title, content, onClose, footer, className = '', isOpen, children }) {
    // Support du nouveau format avec isOpen et children
    if (isOpen !== undefined && !isOpen) {
        // Si isOpen est false, ne rien afficher
        return document.createElement('div'); // Retourner un div vide au lieu d'un textNode
    }

    // Si children est fourni, l'utiliser comme content
    if (children && !content) {
        content = children[0] || children;
    }

    // Overlay
    const overlay = createElement('div', {
        className: 'fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4',
        onClick: (e) => {
            if (e.target === overlay) onClose && onClose();
        },
    });

    // Modal container
    const modal = createElement('div', {
        className: `bg-white rounded-lg shadow-xl max-w-lg w-full max-h-screen overflow-y-auto ${className}`,
    });

    // Header
    if (title) {
        const header = createElement('div', {
            className: 'px-6 py-4 border-b border-gray-200 flex justify-between items-center',
        });

        const titleEl = createElement('h3', {
            className: 'text-lg font-semibold text-gray-900',
        }, title);

        const closeBtn = createElement('button', {
            className: 'text-gray-400 hover:text-gray-600 focus:outline-none',
            onClick: onClose,
        }, '×');
        closeBtn.style.fontSize = '2rem';

        header.appendChild(titleEl);
        header.appendChild(closeBtn);
        modal.appendChild(header);
    }

    // Content
    const body = createElement('div', { className: 'px-6 py-4' });
    if (content instanceof Node) {
        body.appendChild(content);
    } else if (typeof content === 'string') {
        body.textContent = content;
    }
    modal.appendChild(body);

    // Footer
    if (footer) {
        const footerEl = createElement('div', {
            className: 'px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-end space-x-2',
        });
        if (Array.isArray(footer)) {
            footer.forEach(btn => footerEl.appendChild(btn));
        } else if (footer instanceof Node) {
            footerEl.appendChild(footer);
        }
        modal.appendChild(footerEl);
    }

    overlay.appendChild(modal);

    return overlay;
}

/**
 * Composant Toast (notification)
 */
export function showToast({ message, type = 'info', duration = 3000 }) {
    const typeClasses = {
        success: 'bg-green-500',
        error: 'bg-red-500',
        warning: 'bg-yellow-500',
        info: 'bg-blue-500',
    };

    const toast = createElement('div', {
        className: `${typeClasses[type]} text-white px-6 py-3 rounded-lg shadow-lg flex items-center space-x-2 animate-slide-in`,
    });

    const icon = getToastIcon(type);
    if (icon) toast.appendChild(icon);

    const text = createElement('span', {}, message);
    toast.appendChild(text);

    const container = document.getElementById('toast-container');
    container.appendChild(toast);

    // Auto-remove après duration
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

function getToastIcon(type) {
    const iconClasses = 'w-5 h-5';
    let path;

    switch (type) {
        case 'success':
            path = 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
            break;
        case 'error':
            path = 'M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z';
            break;
        case 'warning':
            path = 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z';
            break;
        case 'info':
            path = 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z';
            break;
    }

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', iconClasses);
    svg.setAttribute('fill', 'none');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('stroke', 'currentColor');

    const pathEl = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    pathEl.setAttribute('stroke-linecap', 'round');
    pathEl.setAttribute('stroke-linejoin', 'round');
    pathEl.setAttribute('stroke-width', '2');
    pathEl.setAttribute('d', path);

    svg.appendChild(pathEl);
    return svg;
}

/**
 * Composant Spinner (chargement)
 */
export function Spinner({ size = 'md', className = '' }) {
    const sizeClasses = {
        sm: 'h-4 w-4',
        md: 'h-8 w-8',
        lg: 'h-12 w-12',
    };

    return createElement('div', {
        className: `inline-block animate-spin rounded-full border-b-2 border-blue-600 ${sizeClasses[size]} ${className}`,
    });
}

/**
 * Composant Badge (statut)
 */
export function Badge({ text, variant = 'default', className = '' }) {
    const variantClasses = {
        default: 'bg-gray-100 text-gray-800',
        success: 'bg-green-100 text-green-800',
        danger: 'bg-red-100 text-red-800',
        warning: 'bg-yellow-100 text-yellow-800',
        info: 'bg-blue-100 text-blue-800',
        // Niveaux d'alerte SAP
        normal: 'bg-green-100 text-green-800',
        surveillance: 'bg-yellow-100 text-yellow-800',
        alerte: 'bg-orange-100 text-orange-800',
        urgence: 'bg-red-100 text-red-800',
    };

    return createElement('span', {
        className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variantClasses[variant]} ${className}`,
    }, text);
}

/**
 * Composant Alert (message)
 */
export function Alert({ message, type = 'info', onClose, className = '' }) {
    const typeClasses = {
        success: 'bg-green-50 text-green-800 border-green-200',
        error: 'bg-red-50 text-red-800 border-red-200',
        warning: 'bg-yellow-50 text-yellow-800 border-yellow-200',
        info: 'bg-blue-50 text-blue-800 border-blue-200',
    };

    const alert = createElement('div', {
        className: `border rounded-lg p-4 flex justify-between items-start ${typeClasses[type]} ${className}`,
    });

    const content = createElement('div', { className: 'flex-1' }, message);
    alert.appendChild(content);

    if (onClose) {
        const closeBtn = createElement('button', {
            className: 'ml-4 text-current opacity-50 hover:opacity-100',
            onClick: () => {
                alert.remove();
                onClose && onClose();
            },
        }, '×');
        closeBtn.style.fontSize = '1.5rem';
        alert.appendChild(closeBtn);
    }

    return alert;
}

/**
 * Composant StatusIndicator pour les niveaux d'alerte SAP
 */
export function StatusIndicator({ level }) {
    const levels = {
        normal: { color: 'bg-green-500', text: 'Normal', label: 'Situation normale' },
        surveillance: { color: 'bg-yellow-500', text: 'Surveillance', label: 'Sous surveillance (+15%)' },
        alerte: { color: 'bg-orange-500', text: 'Alerte', label: 'Alerte (+30%)' },
        urgence: { color: 'bg-red-500', text: 'Urgence', label: 'Urgence (+50%)' },
    };

    const config = levels[level] || levels.normal;

    const indicator = createElement('div', { className: 'flex items-center space-x-2' });

    const dot = createElement('div', {
        className: `w-3 h-3 rounded-full ${config.color}`,
    });

    const text = createElement('span', {
        className: 'text-sm font-medium text-gray-900',
    }, config.text);

    indicator.appendChild(dot);
    indicator.appendChild(text);

    return indicator;
}

/**
 * Afficher un loader en plein écran
 */
export function showLoader() {
    const loader = createElement('div', {
        id: 'global-loader',
        className: 'fixed inset-0 bg-white bg-opacity-90 z-50 flex items-center justify-center',
    });

    const content = createElement('div', { className: 'text-center' });
    content.appendChild(Spinner({ size: 'lg' }));
    content.appendChild(createElement('p', { className: 'mt-4 text-gray-600' }, 'Chargement...'));

    loader.appendChild(content);
    document.body.appendChild(loader);
}

/**
 * Masquer le loader
 */
export function hideLoader() {
    const loader = document.getElementById('global-loader');
    if (loader) loader.remove();
}

// Export toutes les fonctions
export default {
    createElement,
    Button,
    Input,
    Card,
    Modal,
    showToast,
    Spinner,
    Badge,
    Alert,
    StatusIndicator,
    showLoader,
    hideLoader,
};
