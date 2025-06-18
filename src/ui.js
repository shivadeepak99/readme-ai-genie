import inquirer from 'inquirer';
import chalk from 'chalk';

/**
 * Guides the user through reviewing the AI draft with advanced options.
 * @param {string} aiDraft The raw Markdown draft from the AI.
 * @param {Array<string>} [args=process.argv.slice(2)] CLI arguments for non-interactive mode.
 * @returns {Promise<string>} The final, user-approved README content.
 */
export async function reviewAndFinalize(aiDraft, args = process.argv.slice(2)) {
  // CI or --yes flag: skip all prompts and approve the draft immediately
  const autoApprove = args.includes('--yes') || process.env.CI === 'true';
  if (autoApprove) {
    console.log(chalk.yellow('CI or --yes flag detected. Auto-approving the AI draft.'));
    return aiDraft.trim();
  }

  // Split the draft into sections based on Markdown headers
  let sections = aiDraft.split(/(?=\n#+ )/).map(s => s.trim()).filter(Boolean);

  // Global action prompt: let the user decide the review strategy
  const { globalAction } = await inquirer.prompt([{
    type: 'list',
    name: 'globalAction',
    message: 'An AI draft is ready. How would you like to proceed?',
    choices: [
      { name: 'Go section-by-section for a detailed review', value: 'manual' },
      { name: '✅ Approve All (Accept the entire draft as is)', value: 'approveAll' },
      { name: '❌ Discard All (Cancel the operation)', value: 'discardAll' },
    ],
  }]);

  if (globalAction === 'approveAll') return aiDraft.trim();
  if (globalAction === 'discardAll') {
      console.log(chalk.yellow('Operation cancelled. No file will be written.'));
      return '';
  };

  // Optional reordering for ultimate control
  const { order } = await inquirer.prompt([{
    type: 'checkbox',
    name: 'order',
    message: 'You can reorder the sections. (Press space to select, enter to confirm)',
    choices: sections.map((s, i) => ({ name: s.split('\n')[0], value: i })),
  }]);
  if (order.length) sections = order.map(i => sections[i]);

  let finalContent = '';
  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    // Progress Indicator
    console.log(chalk.green(`\nReviewing Section ${i + 1}/${sections.length}`));

    // Auto-approve mundane sections like License
    if (section.toLowerCase().startsWith('# license')) {
      console.log(chalk.gray('Auto-approving License section...'));
      finalContent += section + '\n\n';
      continue;
    }

    // Preview with basic syntax highlighting
    console.log(chalk.blue('--- AI Draft Section ---'));
    console.log(chalk.gray(
      section.replace(/```([^\n]+)?/g, match => chalk.yellow(match))
    ));
    console.log(chalk.blue('------------------------'));

    const { action } = await inquirer.prompt([{
      type: 'list',
      name: 'action',
      message: 'How do you want to handle this section?',
      choices: [
        { name: '✅ Approve', value: 'approve' },
        { name: '✏️ Edit', value: 'edit' },
        { name: '❌ Discard', value: 'discard' },
      ],
    }]);

    if (action === 'approve') {
      finalContent += section + '\n\n';
    } else if (action === 'edit') {
      const { editedSection } = await inquirer.prompt([{
        type: 'editor',
        name: 'editedSection',
        message: 'Edit the section in your default editor. Save and close when done.',
        default: section,
      }]);
      finalContent += editedSection + '\n\n';
    }
    // If 'discard', we do nothing, effectively removing the section.
  }

  // Final check for empty content
  if (!finalContent.trim()) {
      console.log(chalk.yellow('All sections were discarded. No file will be written.'));
      return '';
  }

  return finalContent.trim();
}
