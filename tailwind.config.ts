import type { Config } from 'tailwindcss';

// 设计令牌：颜色 / 阴影全部走 CSS 变量（见 globals.css），由 .dark 类切换深浅色
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
          hover: 'rgb(var(--c-primary-hover) / <alpha-value>)',
          fg: 'rgb(var(--c-primary-fg) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--c-accent) / <alpha-value>)',
          fg: 'rgb(var(--c-accent-fg) / <alpha-value>)',
        },
        success: 'rgb(var(--c-success) / <alpha-value>)',
        danger: 'rgb(var(--c-danger) / <alpha-value>)',
        warning: 'rgb(var(--c-warning) / <alpha-value>)',
        info: 'rgb(var(--c-info) / <alpha-value>)',
        bg: 'rgb(var(--c-bg) / <alpha-value>)',
        card: 'rgb(var(--c-card) / <alpha-value>)',
        surface2: 'rgb(var(--c-surface-2) / <alpha-value>)',
        border: {
          DEFAULT: 'rgb(var(--c-border) / <alpha-value>)',
          strong: 'rgb(var(--c-border-strong) / <alpha-value>)',
        },
        text: {
          DEFAULT: 'rgb(var(--c-text) / <alpha-value>)',
          secondary: 'rgb(var(--c-text-secondary) / <alpha-value>)',
          muted: 'rgb(var(--c-text-muted) / <alpha-value>)',
        },
      },
      fontFamily: {
        sans: [
          'Inter',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'PingFang SC',
          'Hiragino Sans GB',
          'Microsoft YaHei',
          'sans-serif',
        ],
      },
      fontSize: {
        // 专业系统字号偏紧：正文 14，辅助 13/12/11
        '2xs': ['11px', { lineHeight: '1.45' }],
        xs: ['12px', { lineHeight: '1.5' }],
        sm: ['13px', { lineHeight: '1.55' }],
        base: ['14px', { lineHeight: '1.65' }],
      },
      boxShadow: {
        card: 'var(--shadow-card)',
        'card-hover': 'var(--shadow-card-hover)',
        pop: 'var(--shadow-pop)',
      },
      borderRadius: {
        // 更小的圆角 = 更严肃
        lg: '8px',
        xl: '10px',
        '2xl': '14px',
      },
      transitionTimingFunction: {
        smooth: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(8px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.18s ease-out both',
        'fade-in-up': 'fade-in-up 0.22s cubic-bezier(0.22, 0.61, 0.36, 1) both',
        'slide-in-right': 'slide-in-right 0.22s cubic-bezier(0.22, 0.61, 0.36, 1) both',
      },
    },
  },
  plugins: [require('@tailwindcss/typography')],
};

export default config;
