import { createDatabase } from '../../../src/infra/db/database';
import { TEST_DATABASE_URL, testDatabaseName } from './test-database';

/** Cria o banco de teste se ainda não existir. Migrations e seed rodam no próprio suite. */
export default async function setup(): Promise<void> {
  const name = testDatabaseName();
  const adminUrl = new URL(TEST_DATABASE_URL);
  adminUrl.pathname = '/postgres';

  const admin = createDatabase(adminUrl.toString());
  try {
    const result = await admin.raw<{ rows: unknown[] }>('select 1 from pg_database where datname = ?', [name]);
    if (result.rows.length === 0) {
      await admin.raw('create database ??', [name]);
    }
  } catch (error) {
    throw new Error(
      `Não foi possível preparar o banco de teste em ${adminUrl.host}. ` +
        'Localmente, suba o PostgreSQL com "docker compose up -d db" ou defina TEST_DATABASE_URL.',
      { cause: error },
    );
  } finally {
    await admin.destroy();
  }
}
