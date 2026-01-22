/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./frontend/**/*.{html,js}",
    "./frontend/modules/**/*.js",
  ],
  theme: {
    extend: {
      colors: {
        // Couleurs du système d'alertes
        'alerte-normal': '#10b981',     // vert
        'alerte-surveillance': '#fbbf24', // jaune
        'alerte-alerte': '#f97316',      // orange
        'alerte-urgence': '#ef4444',     // rouge
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
