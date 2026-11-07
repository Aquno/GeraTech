import 'dotenv/config';
import { loadConfigOrExit } from '../../config';
import { createDatabase } from './database';
import { migrationSource } from './migration-source';

async function run(): Promise<void> {
  const config = loadConfigOrExit();
  const db = createDatabase(config.databaseUrl);
  try {
    const [batch, applied] = (await db.migrate.latest({ migrationSource })) as [number, string[]];
    console.log(
      applied.length > 0
        ? `Migrations aplicadas (lote ${batch}): ${applied.join(', ')}`
        : 'Migrations: nada a aplicar, banco já está atualizado.',
    );
  } finally {
    await db.destroy();
  }
}

run().catch((error: unknown) => {
  console.error('Falha ao rodar migrations:', error);
  process.exit(1);
});
