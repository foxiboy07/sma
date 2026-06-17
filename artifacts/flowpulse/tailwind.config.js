/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        pulse: {
          base: '#0A0B0F',
          surface: '#111318',
          elevated: '#1A1C24',
          overlay: '#222530',
        },
        brand: {
          DEFAULT: '#3B82F6',
          hover: '#2563EB',
        },
        platform: {
          instagram: '#E1306C',
          facebook: '#1877F2',
          tiktok: '#69C9D0',
        },
        tier: {
          newbie: '#6B7280',
          fan: '#F59E0B',
          advocate: '#22C55E',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
    },
  },
  plugins: [],
};
