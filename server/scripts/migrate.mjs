// Apply pending database migrations. The server also runs this on start; this script is for explicit runs.
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db/index.js';

const config = loadConfig();
const db = openDatabase(config.dbFile);
const version = db.prepare('SELECT MAX(id) AS v FROM schema_migrations').get().v;
db.close();
console.info(`Database ${config.dbFile} is at schema version ${version}.`);
