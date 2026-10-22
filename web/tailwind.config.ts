import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#6C5CE7', // Friendly Violet
          action: '#FF7675',  // Vibrant Coral
          reward: '#FDCB6E',  // Sun Yellow
          mint: '#00CEC9',    // Fresh Mint
        },
        surface: {
          light: '#F8F9FA',   // Warm Cream
          tv: '#1E1E2E',      // Space Night
        },
        ink: {
          main: '#2D3436',    // Soft Charcoal
          muted: '#636E72',
        },
        quiz: {
          a: '#FF6B6B',
          b: '#48DBFB',
          c: '#FECA57',
          d: '#1DD1A1',
        },
      },
      fontFamily: {
        heading: ['var(--font-fredoka)', 'sans-serif'],
        body: ['var(--font-inter)', 'sans-serif'],
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '24px',
      },
    },
  },
  plugins: [],
};

export default config;
