export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: { ink: '#111410', panel: '#181c17', raise: '#20261f', line: '#2e362d', mute: '#8c9788', brass: '#c8a24b', ok: '#3fb67a', warn: '#e2a928', bad: '#e5484d' },
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'], serif: ['Fraunces', 'Georgia', 'serif'] },
    },
  },
  plugins: [],
}
