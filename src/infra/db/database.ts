import { knex, type Knex } from 'knex';

export function createDatabase(connectionString: string): Knex {
  return knex({
    client: 'pg',
    connection: connectionString,
    pool: { min: 0, max: 10 },
    // Falha rápido quando o banco está fora, em vez do padrão de 60s (importante para o /health).
    acquireConnectionTimeout: 5_000,
  });
}
