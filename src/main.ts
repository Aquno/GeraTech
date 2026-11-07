import 'dotenv/config';
import { createApplication } from './composition';
import { loadConfigOrExit } from './config';
import { createDatabase } from './infra/db/database';

async function main(): Promise<void> {
  const config = loadConfigOrExit();
  const db = createDatabase(config.databaseUrl);
  const app = createApplication(db, { logLevel: config.logLevel });

  const shutdown = async (signal: NodeJS.Signals): Promise<void> => {
    app.log.info({ signal }, 'shutting down');
    await app.close();
    await db.destroy();
    process.exit(0);
  };
  process.once('SIGINT', (signal) => void shutdown(signal));
  process.once('SIGTERM', (signal) => void shutdown(signal));

  await app.listen({ port: config.port, host: '0.0.0.0' });
}

main().catch((error: unknown) => {
  console.error('Falha ao iniciar a aplicação:', error);
  process.exit(1);
});
