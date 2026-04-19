import js from '@eslint/js';
import react from 'eslint-plugin-react';

export default [
  js.configs.recommended,
  {
    files: ['src/**/*.js', 'src/**/*.jsx'],
    plugins: {
      react
    },
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          jsx: true
        }
      },
      globals: {
        console: 'readonly',
        fetch: 'readonly',
        process: 'readonly',
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        TextDecoder: 'readonly',
        URLSearchParams: 'readonly'
      }
    },
    settings: {
      react: {
        version: 'detect'
      }
    },
    rules: {
      ...react.configs.flat.recommended.rules,
      'react/prop-types': 'off',
      'react/react-in-jsx-scope': 'off'
    }
  }
];
