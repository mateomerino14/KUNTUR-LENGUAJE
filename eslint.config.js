import tseslint from 'typescript-eslint';
import stylistic from '@stylistic/eslint-plugin';

export default tseslint.config(
  {ignores: ['dist', 'node_modules']},
  ...tseslint.configs.recommended,
  {
    plugins: {'@stylistic': stylistic},
    rules: {
      '@stylistic/semi': ['error', 'always'],
      '@stylistic/quotes': ['error', 'single', {avoidEscape: true}],
      '@stylistic/indent': ['error', 2, {SwitchCase: 1}],
      '@stylistic/brace-style': ['error', 'stroustrup'],
      '@stylistic/object-curly-spacing': ['error', 'never'],
      '@stylistic/comma-dangle': ['error', 'always-multiline'],
      '@stylistic/eol-last': ['error', 'always'],
      '@stylistic/no-trailing-spaces': 'error',
      'no-ternary': 'error',
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always'],
    },
  },
);
