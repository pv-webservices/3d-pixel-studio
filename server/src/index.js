// Process entry point: open the database, prepare storage and start listening.
import { createApp, defaultLogger } from './app.js';
import { loadConfig } from './config.js';
import { openDatabase } from './db/index.js';
import { createLocalStorage } from './media/storage.js';

const config = loadConfig();
const db = openDatabase(config.dbFile);
const storage = createLocalStorage(config);
await storage.init();

const app = createApp({ config, db, storage });
const server = app.listen(config.port, () => {
  defaultLogger.info(`3d Pixel Studio API listening on ${config.publicUrl} (data: ${config.dataDir})`);
});

const shutdown = () => {
  server.close(() => {
    db.close();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
};
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
