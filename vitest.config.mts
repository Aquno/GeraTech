import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        // Bootstrap do servidor: lê env, abre porta e trata sinais. A montagem da aplicação
        // fica em src/composition.ts (coberta pela integração); este arquivo é provado pelo job de compose no CI.
        'src/main.ts',
        // Entrypoints de linha de comando (process.exit, console). A lógica que eles chamam
        // (migrationSource e seedMenu) é exercitada pelo teste de integração.
        'src/infra/db/migrate.ts',
        'src/infra/db/seed.ts',
        // DDL declarativo: validado ao ser aplicado num PostgreSQL real na integração, não tem lógica a medir.
        'src/infra/db/migrations/**',
        // Arquivos só com tipos/interfaces: não geram código executável.
        'src/domain/product.ts',
        'src/domain/order-repository.ts',
        'src/domain/product-repository.ts',
      ],
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      // Medido em 07/11/2026 (unit + integração): linhas 97,7%, statements 97,8%, funções 100%, branches 89,5%.
      // Os mínimos ficam ~2-5 pontos abaixo: pegam regressões reais sem quebrar por variação pequena.
      // Branches ficam mais baixos porque parte deles são fallbacks defensivos (ex.: status padrão no
      // error handler, lista de ids vazia no repositório de produtos) que o fluxo normal não alcança.
      thresholds: {
        lines: 95,
        statements: 95,
        functions: 95,
        branches: 85,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['tests/unit/**/*.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.ts'],
          globalSetup: ['tests/integration/support/global-setup.ts'],
          // Os arquivos compartilham o mesmo banco de teste e limpam as tabelas: nada de paralelismo.
          fileParallelism: false,
          hookTimeout: 30_000,
          testTimeout: 15_000,
        },
      },
    ],
  },
});
