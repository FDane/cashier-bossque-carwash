import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: 'var(--surface-a0)',
        surface: 'var(--surface-a10)',
        'surface-border': 'var(--surface-a20)',
        foreground: 'var(--foreground)',
        border: 'var(--surface-a20)',
        primary: 'var(--primary-a0)',
        accent: 'var(--accent-a0)',
        success: 'var(--success-a0)',
        warning: 'var(--warning-a0)',
        danger: 'var(--danger-a0)',
        // Direct aliases for custom prefix classes
        'surface-a0': 'var(--surface-a0)',
        'surface-a10': 'var(--surface-a10)',
        'surface-a20': 'var(--surface-a20)',
        'surface-tonal': 'var(--surface-tonal)',
        'primary-a0': 'var(--primary-a0)',
        'accent-a0': 'var(--accent-a0)',
        'success-a0': 'var(--success-a0)',
        'warning-a0': 'var(--warning-a0)',
        'danger-a0': 'var(--danger-a0)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui'],
      },
      boxShadow: {
        'premium-sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'premium-lg': '0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)',
      },
      animation: {
        fadeIn: 'fadeIn 0.3s ease-in-out',
        slideInRight: 'slideInRight 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
  darkMode: 'class',
}

export default config