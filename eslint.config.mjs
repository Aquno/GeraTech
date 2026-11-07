import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const layerMessage = (layer) => `A camada ${layer} não pode depender de camadas externas (ver CLAUDE.md).`;

export default tseslint.config(
  // web/ tem o próprio ESLint (React), rodado de dentro da pasta.
  { ignores: ['dist/', 'coverage/', 'node_modules/', 'web/'] },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    files: ['**/*.mjs', '**/*.js'],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // Scripts k6 rodam no runtime do k6 (não no Node), que expõe estes globais.
    files: ['tests/load/**/*.js'],
    languageOptions: {
      globals: { __ENV: 'readonly', __VU: 'readonly', __ITER: 'readonly' },
    },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: ['knex', 'pg', 'fastify', 'dotenv'].map((name) => ({ name, message: layerMessage('domain') })),
        patterns: [{ regex: '(^|/)(application|infra|http|config)(/|$)', message: layerMessage('domain') }],
      }],
    },
  },
  {
    files: ['src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': ['error', {
        paths: ['knex', 'pg', 'fastify', 'dotenv'].map((name) => ({ name, message: layerMessage('application') })),
        patterns: [{ regex: '(^|/)(infra|http|config)(/|$)', message: layerMessage('application') }],
      }],
    },
  },
);
