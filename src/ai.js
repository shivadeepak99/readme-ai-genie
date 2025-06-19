import 'dotenv/config';
import { GoogleGenerativeAI } from '@google/generative-ai';
import chalk from 'chalk';
import { personalities } from './styles.js';

// === Provider Logic (Single Provider Only) ===
const provider = {
  name: 'Gemini',
  execute: async (prompt) => {
    // Key validation is now implicitly handled before this is ever called.
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("Gemini API key not found in process.env.");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
    });
    const result = await model.generateContent(prompt);
    return result.response.text();
  },
};

// === Prompt Builder: Architect ===
function getArchitectPrompt(files, pkg) {
  const badgeBlock = `[![npm version](https://img.shields.io/npm/v/${pkg.name}.svg)](https://www.npmjs.com/package/${pkg.name})\n[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)`;
  return `
You are an expert technical writer. Your task is to generate a factually accurate and well-structured README.md file based on the provided project context.

# EXPECTED SECTIONS
1.  **# Project Title**
2.  **Badges** (use the markdown provided below).
3.  **## Tech Stack**
4.  **## Features**
5.  **## Installation**
6.  **## Usage**
7.  **## How It Works** (include a mermaid.js diagram).
8.  **## Contributing**
9.  **## License**

---
# PROJECT CONTEXT
**Project Name:** ${pkg.name}
**Description:** ${pkg.description}
**Badges:**
${badgeBlock}

**Project Files:**
${files.map(f => `// File: ${f.path}\n${f.content}`).join('\n\n---\n\n')}
`;
}

// === Prompt Builder: Stylist ===
function getStylistPrompt(style = 'default') {
  const baseInstructions = `
You are a witty, stylish, and highly skilled open-source senior developer acting as a "beauty filter" for technical documentation.

# YOUR TASK
Rewrite the draft, applying these enhancements:
- **Tagline:** Add a bold, one-liner tagline under the main project title.
- **Emojis:** Sparsely add emojis to headers and key points for flair.
- **Formatting:** Ensure clean, readable Markdown.
- **Quote:** Add an inspirational or funny quote for developers at the end.
`;

  const selected = personalities[style] || personalities.default;
  return baseInstructions + '\n---\n' + selected.prompt;
}

// === Master Orchestrator ===
export async function generateReadmeContent(files, style = 'default', pkg) {
  const validStyles = Object.keys(personalities);
  if (!validStyles.includes(style)) {
    console.warn(chalk.yellow(`⚠️  Invalid style '${style}' provided. Falling back to 'default' style.`));
    style = 'default';
  }

  console.log(chalk.cyan(`✨ Styling with '${style}' personality`));

  // Generate factual base
  const architectPrompt = getArchitectPrompt(files, pkg);
  console.log(chalk.gray('🔍 Generating factual draft...'));
  const factualDraft = await callProvider(architectPrompt);
  if (!factualDraft) throw new Error('Failed to generate initial draft.');

  // Generate styled final
  const stylistPrompt = getStylistPrompt(style) + `\n---\n# RAW DRAFT:\n\n${factualDraft}`;
  console.log(chalk.gray('💅 Styling the draft...'));
  const finalDraft = await callProvider(stylistPrompt);

  return finalDraft || factualDraft;
}

// === Provider Call (With Timeout Protection) ===
async function callProvider(prompt) {
  console.log(chalk.gray(`\n  └─ Calling ${provider.name}...`));
  try {
    const timeout = (ms) => new Promise((_, reject) =>
      setTimeout(() => reject(new Error("Request timed out")), ms)
    );
    const result = await Promise.race([provider.execute(prompt), timeout(30000)]);
    console.log(chalk.green(`  └─ ${provider.name} succeeded!`));
    return result.trim();
  } catch (err) {
    console.error(chalk.red(`  └─ ${provider.name} failed:`), err.message);
    throw new Error('AI provider failed.');
  }
}
