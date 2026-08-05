import type { Config } from 'tailwindcss';

// Mapea las variables de :root de src/styles/globals.css (el mismo diseño de
// siempre) a tokens de Tailwind/shadcn. Sitio fijo en modo oscuro — no hay
// toggle de tema, así que no se generó el bloque light de shadcn.
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      maxWidth: { site: '1160px' },
      colors: {
        background: 'var(--bg)',
        foreground: 'var(--fg)',
        'bg-soft': 'var(--bg-soft)',
        border: 'var(--line)',
        input: 'var(--line)',
        ring: 'var(--fg)',
        card: { DEFAULT: 'var(--card)', foreground: 'var(--fg)' },
        popover: { DEFAULT: 'var(--card)', foreground: 'var(--fg)' },
        primary: { DEFAULT: 'var(--fg)', foreground: '#000000' },
        secondary: { DEFAULT: 'var(--bg-soft)', foreground: 'var(--fg)' },
        muted: { DEFAULT: 'var(--bg-soft)', foreground: 'var(--muted)' },
        accent: { DEFAULT: '#1a1a1a', foreground: 'var(--fg)' },
        destructive: { DEFAULT: '#ff8686', foreground: '#000000' },
        success: '#7CFFB2',
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      fontFamily: {
        heading: ['Archivo', 'sans-serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
