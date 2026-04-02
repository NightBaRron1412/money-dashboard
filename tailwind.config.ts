import type { Config } from "tailwindcss";
import animatePlugin from "tailwindcss-animate";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./data/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}"
  ],
  theme: {
		extend: {
			colors: {
				bg: {
					main: 'var(--bg-main)',
					secondary: 'var(--bg-secondary)',
					elevated: 'var(--bg-elevated)'
				},
				text: {
					primary: 'var(--text-primary)',
					secondary: 'var(--text-secondary)',
					'on-accent': 'var(--text-on-accent)'
				},
				border: {
					subtle: 'var(--border-subtle)'
				},
				accent: {
					blue: 'var(--accent-blue)',
					purple: 'var(--accent-purple)',
					pink: 'var(--accent-pink)'
				}
			},
			boxShadow: {
				glow: '0 10px 40px -12px var(--accent-pink, rgba(180, 36, 132, 0.35))',
				soft: '0 20px 60px -24px rgba(0,0,0,0.35)',
				card: 'var(--card-shadow)'
			},
			borderRadius: {
				xl: '1rem',
				'2xl': '1.25rem'
			},
			keyframes: {
				gradient: {
					'0%, 100%': {
						backgroundPosition: '0% 50%'
					},
					'50%': {
						backgroundPosition: '100% 50%'
					}
				},
				shimmer: {
					from: {
						backgroundPosition: '0% 0%'
					},
					to: {
						backgroundPosition: '-200% 0%'
					}
				},
				'accordion-down': {
					from: {
						height: '0'
					},
					to: {
						height: 'var(--radix-accordion-content-height)'
					}
				},
				'accordion-up': {
					from: {
						height: 'var(--radix-accordion-content-height)'
					},
					to: {
						height: '0'
					}
				},
				shake: {
					'0%, 100%': { transform: 'translateX(0)' },
					'20%': { transform: 'translateX(-8px)' },
					'40%': { transform: 'translateX(8px)' },
					'60%': { transform: 'translateX(-6px)' },
					'80%': { transform: 'translateX(6px)' }
				},
				glitch: {
					'0%': { transform: 'translate(0)' },
					'20%': { transform: 'translate(-3px, 3px)' },
					'40%': { transform: 'translate(-3px, -3px)' },
					'60%': { transform: 'translate(3px, 3px)' },
					'80%': { transform: 'translate(3px, -3px)' },
					'100%': { transform: 'translate(0)' }
				},
				'shimmer-line': {
					'0%': { transform: 'translateX(-100%)' },
					'100%': { transform: 'translateX(400%)' }
				}
			},
			animation: {
				gradient: 'gradient 12s ease infinite',
				shimmer: 'shimmer-line 2s ease-in-out infinite',
				'accordion-down': 'accordion-down 0.2s ease-out',
				'accordion-up': 'accordion-up 0.2s ease-out',
				shake: 'shake 0.4s ease-in-out',
				glitch: 'glitch 0.2s ease-in-out'
			}
		}
  },
  plugins: [animatePlugin]
};

export default config;
