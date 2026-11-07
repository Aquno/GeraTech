import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const layerMessage = (layer) => `A camada ${layer} não pode depender de camadas externas (ver CLAUDE.md).`;

export default tseslint.config(
  { ignores: ['dist/', 'coverage/', 'node_modules/'] },
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
