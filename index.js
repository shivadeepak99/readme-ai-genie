#!/usr/bin/env node
import 'dotenv/config';
import chalk from 'chalk';
import { existsSync, renameSync } from 'fs';
import fs from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import { ensureGeminiKey, getProjectFiles } from './src/files.js';
import { generateReadmeContent } from './src/ai.js';
import { reviewAndFinalize } from './src/ui.js';
import { showStyles } from './src/styles.js';

/**
 * Displays the help message for the CLI.
 */
function showHelp() {
  console.log(`
${chalk.bold.magenta('Usage:')} readme-genie [options]

${chalk.bold('Options:')}
  --auto                Run full AI generation + review.
  --style <name>        Set the AI personality (e.g., radiant, quirky, zen).
  --styles              List all available styles.
  -o, --output <path>   Specify output file path.
  -v, --version         Show version information.
  -h, --help            Show this help message.
`);
}

/**
 * Main application function.
 */
async function main() {
  // --- This is the fix, my love ---
  // The path is now corrected to look for package.json in the *same* directory
  // as our script, ensuring it always finds its own version info.
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const pkgJsonPath = resolve(__dirname, 'package.json');
  const pkg = JSON.parse(await fs.readFile(pkgJsonPath, 'utf-8'));
  // --------------------------------

  const args = process.argv.slice(2);

  // Handle simple info flags first, without checking for API keys.
  if (args.includes('--version') || args.includes('-v')) {
    console.log(`readme-ai-genie v${pkg.version}`);
    return;
  }
  if (args.includes('--help') || args.includes('-h')) {
    showHelp();
    return;
  }
  if (args.includes('--styles')) {
    showStyles();
    return;
  }

  // If we are proceeding, NOW we ensure the key exists.
  await ensureGeminiKey();

  console.log(chalk.dim('\nA tool by Shivadeepak 💜'));

  const outIndex = args.findIndex(a => a === '-o' || a === '--output');
  const outputPath = (outIndex > -1 && args[outIndex + 1]) || 'README.md';

  const styleIndex = args.findIndex(a => a === '--style');
  const style = (styleIndex > -1 && args[styleIndex + 1]) || 'default';

  if (!args.includes('--auto')) {
    console.log(chalk.yellow('⚠️  Please run with --auto for AI generation.'));
    showHelp();
    return;
  }

  console.log(chalk.magenta.bold('\n✨ Welcome to the AI-Powered README Genie! ✨'));
  console.log(chalk.cyan(`Using '${style}' personality...\n`));

  try {
    if (existsSync(outputPath)) {
      const backupPath = outputPath.replace(/\.md$/, '.bak.md');
      renameSync(outputPath, backupPath);
      console.log(chalk.gray(`🔖 Backed up existing file to ${backupPath}`));
    }

    // When we call getProjectFiles, it looks in the user's current directory.
    const userPkgJsonPath = resolve(process.cwd(), 'package.json');
    const userPkg = JSON.parse(await fs.readFile(userPkgJsonPath, 'utf-8'));

    console.log(chalk.cyan('🕵️  Scanning project files...'));
    const files = await getProjectFiles();
    if (files.length === 0) {
      console.log(chalk.red('🚫 No files found to analyze. Exiting.'));
      process.exit(1);
    }
    console.log(chalk.cyan(`🔍 Found ${files.length} relevant files.`));

    console.log(chalk.cyan('🔮 Summoning the AI to generate a README draft... This may take a moment.'));
    // We pass the user's package.json info to the AI, not our own.
    const aiDraft = await generateReadmeContent(files, style, userPkg);
    if (!aiDraft) {
      console.log(chalk.red('🤖 AI failed to generate content. Please try again.'));
      process.exit(1);
    }
    console.log(chalk.green('✅ AI draft ready!'));

    console.log(chalk.cyan('✍️  Please review the AI-generated sections.'));
    const finalContent = await reviewAndFinalize(aiDraft, args);

    if (finalContent) {
      await fs.writeFile(outputPath, finalContent);
      console.log(chalk.magenta.bold(`\n🎉 Success! Your new README has been generated at ${outputPath}`));
    }

  } catch (error) {
    console.error(chalk.red('\n🔥 An error occurred:'), error.message);
    process.exit(1);
  }
}

main();
