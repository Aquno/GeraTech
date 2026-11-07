import 'dotenv/config';
import { loadConfigOrExit } from '../../config';
import { createDatabase } from './database';
import { MENU, seedMenu } from './menu-seed';

async function run(): Promise<void> {
  const config = loadConfigOrExit();
  const db = createDatabase(config.databaseUrl);
  try {
    await seedMenu(db);
    console.log(`Seed do cardápio aplicado: ${MENU.length} produtos.`);
  } finally {
    await db.destroy();
  }
}

run().catch((error: unknown) => {
  console.error('Falha ao rodar seed:', error);
  process.exit(1);
});
