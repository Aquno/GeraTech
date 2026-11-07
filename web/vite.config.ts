import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Em desenvolvimento (npm run dev), /api é encaminhado para a API local, como o nginx faz em produção:
// o navegador fala sempre com a mesma origem.
const apiTarget = process.env.API_URL ?? 'http://localhost:3000';

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': { target: apiTarget, rewrite: (path) => path.replace(/^\/api/, '') },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    restoreMocks: true,
    coverage: {
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        // Bootstrap: só monta <App /> no DOM e aplica o tema salvo; o App é testado diretamente.
        'src/main.tsx',
        // Infraestrutura dos testes, não código da aplicação.
        'src/test/**',
        'src/**/*.test.{ts,tsx}',
        // Só declarações de tipo.
        'src/api/types.ts',
        'src/vite-env.d.ts',
      ],
      reporter: ['text', 'html', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      // Medido em 07/11/2026: linhas 99,5%, statements 99,0%, funções 98,7%, branches 95,3%.
      // Mínimos alguns pontos abaixo (mesmo critério da API): pegam regressões sem quebrar por pouco.
      thresholds: {
        lines: 95,
        statements: 95,
        functions: 95,
        branches: 90,
      },
    },
  },
});
