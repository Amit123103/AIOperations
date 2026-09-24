/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1F5FA8',
        brand: '#1F5FA8',
        'brand-hover': '#174C87',
        ink: '#17262A',
        'ink-muted': '#55636A',
        'ink-faint': '#8A959A',
        page: '#F4F4EE',
        surface: '#FBFBF7',
        border: '#E3E3DA',
        accent: '#C8F135',
        critical: '#DC2626',
        high: '#EA580C',
        medium: '#D97706',
        low: '#2563EB',
        success: '#16A34A',
      },
      boxShadow: {
        soft: '0 1px 2px rgba(23, 38, 42, 0.06)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['Inter Tight', 'Inter', 'ui-sans-serif', 'sans-serif'],
        serif: ['Instrument Serif', 'Newsreader', 'Georgia', 'serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      letterSpacing: {
        editorial: '-0.04em',
      },
    },
  },
  plugins: [],
}

