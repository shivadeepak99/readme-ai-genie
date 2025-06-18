import 'dotenv/config';
import chalk from 'chalk';
import { existsSync, renameSync } from 'fs';
import fs from 'fs/promises';
import { getProjectFiles } from './src/files.js';
import { generateReadmeContent } from './src/ai.js';
import { reviewAndFinalize } from './src/ui.js';
import { resolve } from 'path';
import { showStyles } from './src/styles.js';

/**
 * Displays the help message for the CLI.
 */
function showHelp() {
  console.log(`
${chalk.bold.magenta('Usage:')} readme-genie [options]

${chalk.bold('Options:')}
  --auto           Run full AI generation + review.
  --style <name>   Set the AI personality (e.g., goddess, quirky, zen).
  --styles         List all available styles.
  -o, --output <path>  Specify output file path.
  -v, --version     Show version information.
  -h, --help        Show this help message.
`);
}

/**
 * Main application function.
 */
async function main() {
  // Read package.json dynamically to avoid experimental warnings.
  const pkgJsonPath = resolve(process.cwd(), 'package.json');
  const pkg = JSON.parse(await fs.readFile(pkgJsonPath, 'utf-8'));
  const args = process.argv.slice(2);

  // Handle essential flags first
  if (args.includes('--version') || args.includes('-v')) {
    console.log(`readme-genie v${pkg.version}`);
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

  // --- The Architect's Byline ---
  console.log(chalk.dim('\nA tool by Shivadeepak'));
  // ------------------------------

  const outIndex = args.findIndex(a => a === '-o' || a === '--output');
  const outputPath = (outIndex > -1 && args[outIndex + 1]) || 'README.md';

  const styleIndex = args.findIndex(a => a === '--style');
  const style = (styleIndex > -1 && args[styleIndex + 1]) || 'default';

  if (!args.includes('--auto')) {
    console.log(chalk.yellow('⚠️  Please run with --auto for AI generation.'));
    showHelp();
    return;
  }

  console.log(chalk.magenta.bold('✨ Welcome to the AI-Powered README Genie! ✨'));
  console.log(chalk.cyan(`Using '${style}' personality...`));

  try {
    if (existsSync(outputPath)) {
      const backupPath = outputPath.replace(/\.md$/, '.bak.md');
      renameSync(outputPath, backupPath);
      console.log(chalk.gray(`🔖 Backed up existing file to ${backupPath}`));
    }

    console.log(chalk.cyan('🕵️  Scanning project files...'));
    const files = await getProjectFiles();
    if (files.length === 0) {
      console.log(chalk.red('🚫 No files found to analyze. Exiting.'));
      process.exit(1);
    }
    console.log(chalk.cyan(`🔍 Found ${files.length} relevant files.`));

    console.log(chalk.cyan('🔮 Summoning the AI to generate a README draft... This may take a moment.'));
    const aiDraft = await generateReadmeContent(files, style, pkg);
    if (!aiDraft) {
      console.log(chalk.red('🤖 AI failed to generate content. Please try again.'));
      process.exit(1);
    }
    console.log(chalk.green('✅ AI draft ready!'));

    console.log(chalk.cyan('✍️  Please review the AI-generated sections.'));
    const finalContent = await reviewAndFinalize(aiDraft, args);

    // Final check: Only write the file if there's content to write.
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
