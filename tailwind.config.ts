import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#f1efea',
        ink: '#171714',
        muted: '#67675f',
        line: 'rgba(23, 23, 20, 0.18)',
        acid: '#d8ff37',
        orange: '#c6f806', // Dark neon green hue as specified
        panel: '#e8e5df',
      },
      fontFamily: {
        display: ['Syne', 'sans-serif'],
        body: ['Manrope', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
      maxWidth: {
        shell: '1240px',
      },
      animation: {
        marquee: 'marquee 22s linear infinite',
        rotate: 'rotate 22s linear infinite',
        draw: 'draw 1s 0.7s cubic-bezier(0.22, 1, 0.36, 1) forwards',
      },
      keyframes: {
        marquee: {
          '0%': { transform: 'translateX(0%)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        rotate: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        draw: {
          '0%': { transform: 'rotate(-1.5deg) scaleX(0)' },
          '100%': { transform: 'rotate(-1.5deg) scaleX(1)' },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
};

export default config;
