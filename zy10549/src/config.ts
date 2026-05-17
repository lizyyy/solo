import { CliOptions } from './types';

export const DEFAULT_OPTIONS: Partial<CliOptions> = {
  routePatterns: [
    '**/router/**/*.{ts,js,tsx,jsx}',
    '**/route*/**/*.{ts,js,tsx,jsx}',
    '**/router.{ts,js,tsx,jsx}'
  ],
  pagePatterns: [
    '**/pages/**/*.{vue,tsx,jsx,ts,js}',
    '**/views/**/*.{vue,tsx,jsx,ts,js}',
    '**/page*/**/*.{vue,tsx,jsx,ts,js}'
  ],
  excludePatterns: [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/*.d.ts',
    '**/*.test.{ts,tsx,js,jsx}',
    '**/*.spec.{ts,tsx,js,jsx}',
    '**/__tests__/**',
    '**/components/**'
  ],
  framework: 'auto',
  format: ['terminal', 'json', 'html'],
  strict: false,
  quiet: false
};

export const FILE_EXTENSIONS = {
  vue: ['.vue'],
  react: ['.tsx', '.jsx', '.ts', '.js'],
  all: ['.vue', '.tsx', '.jsx', '.ts', '.js']
};

export const ROUTE_KEYWORDS = {
  vue: ['path', 'name', 'component', 'children', 'redirect'],
  react: ['path', 'element', 'Component', 'children', 'index']
};