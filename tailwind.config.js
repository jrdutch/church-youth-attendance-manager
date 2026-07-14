/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Roboto', 'Arial', 'sans-serif'],
      },
      colors: {
        // ── CHANGE YOUR CHURCH'S COLORS HERE ─────────────────────
        // "primary" is the main brand color (navbar, buttons, links).
        // "gold" is the accent stripe. Generate a matching 50-950
        // palette from one brand color at https://uicolors.app
        primary: {
          50:  '#edf6fb',
          100: '#cce4f2',
          200: '#99cae6',
          300: '#66afd8',
          400: '#4a9bc6',
          500: '#337da8',  // interactive blue
          600: '#2b6a8e',  // hover state
          700: '#042f40',  // dark navy — navbar/headers
          800: '#032535',
          900: '#021a26',
          950: '#010f16',
        },
        gold: {
          300: '#fdeea3',
          400: '#fbdd78',  // accent
          500: '#e8c840',
          600: '#c9a820',
        },
        // MD3 surface tokens
        surface: {
          DEFAULT: '#f4f7f9',       // app background
          container: '#edf1f5',     // card fill
          high:  '#e5ecf1',         // elevated card
          variant: '#dce5eb',       // alternate surface
        },
        // MD3 outline tokens
        outline: {
          DEFAULT: '#6f8996',
          variant: '#bfcdd6',
        },
      },
      borderRadius: {
        // MD3 shape scale
        'none': '0',
        'xs':   '4px',
        'sm':   '8px',
        DEFAULT: '12px',
        'md':   '12px',
        'lg':   '16px',
        'xl':   '20px',
        '2xl':  '24px',
        '3xl':  '28px',   // dialogs, large FABs
        'full': '9999px',
      },
      boxShadow: {
        // MD3 elevation levels
        'el0': 'none',
        'el1': '0 1px 2px rgba(0,0,0,0.10), 0 1px 3px 1px rgba(0,0,0,0.06)',
        'el2': '0 1px 2px rgba(0,0,0,0.12), 0 2px 6px 2px rgba(0,0,0,0.08)',
        'el3': '0 4px 8px 3px rgba(0,0,0,0.08), 0 1px 3px rgba(0,0,0,0.12)',
        'el4': '0 6px 10px 4px rgba(0,0,0,0.08), 0 2px 3px rgba(0,0,0,0.12)',
      },
    },
  },
  plugins: [],
};
