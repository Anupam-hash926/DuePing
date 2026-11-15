import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--bg)',
        'bg-grouped': 'var(--bg-grouped)',
        surface: 'var(--surface)',
        'surface-solid': 'var(--surface-solid)',
        hairline: 'var(--hairline)',
        text: 'var(--text)',
        'text-2': 'var(--text-2)',
        'text-3': 'var(--text-3)',
        tint: 'var(--tint)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        danger: 'var(--danger)',
        purple: 'var(--purple)',
        teal: 'var(--teal)',
      },
      borderRadius: {
        card: 'var(--r-card)',
        sheet: 'var(--r-sheet)',
        pill: 'var(--r-pill)',
        input: 'var(--r-input)',
      },
      boxShadow: {
        float: 'var(--shadow-float)',
      },
      fontFamily: {
        sans: [
          'SF Pro Display',
          'SF Pro Text',
          '-apple-system',
          'BlinkMacSystemFont',
          'InterVariable',
          'Inter',
          'system-ui',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      backdropBlur: {
        ios: '20px',
      },
    },
  },
  plugins: [],
} satisfies Config
