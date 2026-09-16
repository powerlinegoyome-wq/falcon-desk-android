/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./src/renderer/**/*.{js,ts,jsx,tsx,html}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        dark: {
          bg: '#000000',          // Pure pitch black
          card: '#0D0D0D',        // Pitch black container
          sidebar: '#0A0A0A',     // Pure black sidebar
          active: '#1F1F1F',      // Selected chat item
          hover: '#141414',       // Hover chat item
          bubbleIn: '#181818',    // User message bubble (pure neutral black/grey)
          bubbleInBorder: '#262626',
          bubbleOut: '#2563EB',   // Operator message bubble (sleek blue or customizable)
          header: '#0A0A0A',      // Header & bar background
          border: '#1A1A1A',      // Pure dark subtle borders
          input: '#121212',       // Input field background
          text: '#EDEDED',        // High contrast text
          muted: '#888888',       // Subtext / timestamps
          accent: '#3B82F6',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.15s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'scale-in': 'scaleIn 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'slide-up': 'slideUp 0.18s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.92)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(8px) scale(0.96)' },
          '100%': { opacity: '1', transform: 'translateY(0) scale(1)' },
        }
      }
    },
  },
  plugins: [],
}
