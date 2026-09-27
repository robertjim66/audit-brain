import type { Config } from 'tailwindcss';

// 设计令牌：颜色全部走 CSS 变量（见 globals.css），由 .dark 类切换深浅色
const config: Config = {
  darkMode: 'class',
  content: [
    './src/app/**/*.{ts,tsx}',
    './src/components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: 'rgb(var(--c-primary) / <alpha-value>)',
          fg: 'rgb(var(--c-primary-fg) / <alpha-value>)',
        },
        success: 'rgb(var(--c-success) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        warning: 'rgb(var(--c-warning) / <alpha-value>)',
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        card: 'rgb(var(--c-card) / <alpha-value>)',
        border: 'rgb(var(--c-border) / <alpha-value>)',
        text: {
          DEFAULT: 'rgb(var(--c-text) / <alpha-value>)',
          secondary: 'rgb(var(--c-text-secondary) / <alpha-value>)',
          muted: 'rgb(var(--c-text-muted) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 3px rgba(15, 23, 42, 0.08), 0 1px 2px rgba(15, 23, 42, 0.04)',
      },
    },
  },
  plugins: [],
};

export default config;
