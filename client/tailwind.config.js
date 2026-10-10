/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Citizen (light) surfaces
        paper: '#F4EFE6',
        'paper-2': '#EBE4D4',
        ink: '#12211D',
        'ink-soft': '#4B5B55',
        hairline: '#D9D0BC',
        // Brand
        moss: '#1F4D3F',
        'moss-light': '#3E7A66',
        // Severity
        lagoon: '#2A8C82',
        saffron: '#E9A23B',
        brick: '#C8412B',
        // Status accents
        verified: '#2E7D5B',
        disputed: '#B4308B',
        delayed: '#C8412B',
        // Department (dark) surfaces
        night: '#0D1513',
        panel: '#15201D',
        'panel-2': '#1C2A26',
        line: '#2A3A35',
        dtext: '#E8EFEA',
        muted: '#8FA39B',
        signal: '#F2B14B',
      },
      fontFamily: {
        heading: ['Fraunces', 'serif'],
        body: ['Instrument Sans', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'fluid-xs': 'clamp(0.75rem, 0.7rem + 0.25vw, 0.875rem)',
        'fluid-sm': 'clamp(0.875rem, 0.8rem + 0.375vw, 1rem)',
        'fluid-base': 'clamp(1rem, 0.9rem + 0.5vw, 1.125rem)',
        'fluid-lg': 'clamp(1.125rem, 1rem + 0.625vw, 1.25rem)',
        'fluid-xl': 'clamp(1.25rem, 1.1rem + 0.75vw, 1.5rem)',
        'fluid-2xl': 'clamp(1.5rem, 1.25rem + 1.25vw, 2rem)',
        'fluid-3xl': 'clamp(2rem, 1.5rem + 2.5vw, 3rem)',
        'fluid-4xl': 'clamp(2.5rem, 1.75rem + 3.75vw, 4rem)',
      },
      borderRadius: {
        'card': '14px',
        'card-lg': '18px',
        'border': '8px',
        'lg': '12px',
      },
      boxShadow: {
        'paper': '0 2px 8px -2px rgba(18, 33, 29, 0.08), 0 1px 3px -1px rgba(18, 33, 29, 0.06)',
        'paper-lg': '0 10px 30px -5px rgba(18, 33, 29, 0.12), 0 4px 12px -4px rgba(18, 33, 29, 0.08)',
        'panel': '0 2px 8px -2px rgba(0, 0, 0, 0.3), 0 1px 3px -1px rgba(0, 0, 0, 0.2)',
      },
      backgroundImage: {
        'paper-grain': "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
      },
    },
  },
  plugins: [],
}