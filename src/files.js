import fg from 'fast-glob';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import ignore from 'ignore';
import readline from 'readline';
import chalk from 'chalk';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB cap
const ENV_FILE = '.env';
const API_KEY_NAME = 'GEMINI_API_KEY';
const GEMINI_KEY_URL = 'https://makersuite.google.com/app/apikey';

/**
 * Ensures a Gemini API key exists, prompting the user interactively if not.
 * This provides a seamless first-time user experience.
 */
export async function ensureGeminiKey() {
  const root = path.resolve(process.cwd());
  const envPath = path.join(root, ENV_FILE);

  let keyExists = false;

  // Check if .env file exists and if the key is present and has a value.
  if (fsSync.existsSync(envPath)) {
    const content = fsSync.readFileSync(envPath, 'utf8');
    const keyLine = content.split('\n').find(line => line.startsWith(`${API_KEY_NAME}=`));
    if (keyLine && keyLine.split('=')[1]?.trim()) {
      keyExists = true;
    }
  }

  // If the key doesn't exist, start the interactive setup flow.
  if (!keyExists) {
    // Dynamically import 'open' only when it's needed.
    const open = (await import('open')).default;

    console.log(chalk.yellow(`\n👀 Looks like this is your first time running the Genie!`));
    console.log(chalk.cyan(`🪄 You need a FREE Gemini API key to summon AI magic.`));
    console.log(chalk.magenta(`🌐 Opening the Gemini API key page for you now...`));

    await open(GEMINI_KEY_URL);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const userKey = await new Promise(resolve =>
      rl.question(chalk.green('\n🔑 Paste your new Gemini API key here and press Enter: '), answer => {
        rl.close();
        resolve(answer.trim());
      })
    );

    if (!userKey) {
      console.log(chalk.red('❌ No API key entered. Exiting.'));
      process.exit(1);
    }

    // Append the key to the .env file, creating it if it doesn't exist.
    const envLine = `\n${API_KEY_NAME}=${userKey}\n`;
    await fs.appendFile(envPath, envLine);

    // Manually set the environment variable for the current session.
    process.env[API_KEY_NAME] = userKey;

    console.log(chalk.green(`\n✅ Your Gemini API key has been saved to ${ENV_FILE}. You're all set!`));
  }
}

/**
 * Scans the project directory for relevant files.
 */
export async function getProjectFiles() {
  const root = path.resolve(process.cwd());
  const ig = ignore();

  ig.add(['node_modules', '.git', 'dist', 'coverage', 'README.md', '.env*']);

  try {
    const gitignoreContent = await fs.readFile(path.join(root, '.gitignore'), 'utf8');
    ig.add(gitignoreContent);
  } catch {
    // It's okay if .gitignore doesn't exist.
  }

  const allFiles = await fg(['**/*'], { cwd: root, dot: true, ignore: ['**/node_modules/**', 'dist/**'] });

  const files = [];
  for (const file of allFiles) {
    if (ig.ignores(file)) continue;

    const absolutePath = path.join(root, file);
    try {
      const stats = await fs.stat(absolutePath);
      if (stats.size > MAX_BYTES || /\.(png|jpe?g|zip|exe|dll|lock)$/.test(file)) continue;
    } catch { continue; }

    let content = '';
    try {
      content = await fs.readFile(absolutePath, 'utf8');
    } catch { content = '[Binary or unreadable file]'; }

    files.push({ path: file, content });
  }

  return Array.from(new Set(files)).sort((a, b) => a.path.localeCompare(b.path));
}
