// Create an admin account, or reset an existing admin's password (which also signs out their sessions).
// There is no public registration; this script is the only way to provision access.
// Usage:  npm run admin:create -- --email owner@example.com          (prompts for the password)
//         printf '%s' "$PASSWORD" | npm run admin:create -- --email owner@example.com --password-stdin
import { createInterface } from 'node:readline';
import { loadConfig } from '../src/config.js';
import { openDatabase } from '../src/db/index.js';
import { createAdminsRepo } from '../src/repos/admins.js';
import { MIN_PASSWORD_LENGTH } from '../src/lib/security.js';

const argv = process.argv.slice(2);
const email = argv[argv.indexOf('--email') + 1];
const fail = (msg) => {
  console.error(msg);
  process.exit(1);
};

if (!argv.includes('--email') || !email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail('Usage: npm run admin:create -- --email you@example.com [--password-stdin]');

async function readStdin() {
  let data = '';
  for await (const chunk of process.stdin) data += chunk;
  return data.replace(/\r?\n$/, '');
}

function promptHidden(question) {
  return new Promise((resolve) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => rl.output.write(s.startsWith(question) ? s : '');
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write('\n');
      resolve(answer);
    });
  });
}

let password;
if (argv.includes('--password-stdin')) password = await readStdin();
else if (process.stdin.isTTY) {
  password = await promptHidden('Password: ');
  if ((await promptHidden('Repeat password: ')) !== password) fail('Passwords do not match.');
} else fail('No terminal available. Pipe the password with --password-stdin.');

if (password.length < MIN_PASSWORD_LENGTH) fail(`Use a password of at least ${MIN_PASSWORD_LENGTH} characters.`);

const config = loadConfig();
const db = openDatabase(config.dbFile);
const { created } = await createAdminsRepo(db, config).upsert(email, password);
db.close();
console.info(created ? `Admin ${email} created.` : `Password updated for ${email}; existing sessions were signed out.`);
