import { GoogleGenerativeAI } from '@google/generative-ai';
import fetch from 'node-fetch';
import chalk from 'chalk';
import { personalities } from './styles.js';


const providers = [
  {
    name: 'Gemini',
    execute: async (prompt, key) => {
      const genAI = new GoogleGenerativeAI(key);
      const model = genAI.getGenerativeModel({ model: process.env.GEMINI_MODEL || 'gemini-1.5-flash' });
      const result = await model.generateContent(prompt);
      return result.response.text();
    },
  },

];



function getStylistPrompt(style = 'default') {
  const baseInstructions = `
You are a witty, stylish, and highly skilled open-source senior developer acting as a "beauty filter" for technical documentation.
Your job is to take the following raw README.md draft and elevate it to be professional, engaging, and fantastic.
# YOUR TASK
Rewrite the draft, applying these enhancements:
- **Tagline:** Add a bold, one-liner tagline under the main project title.
- **Emojis:** Sparsely but effectively add emojis to section headers and key points to add visual flair.
- **Formatting:** Ensure clean, readable Markdown.
- **Quote:** Add an inspirational or funny quote for developers at the very end.
Do not change the core technical information. Your goal is to apply a "glow-up" to the style, tone, and presentation.
`;
  const selectedPersonality = personalities[style] || personalities.default;
  return baseInstructions + selectedPersonality.prompt;
}

function getArchitectPrompt(files, pkg){
    const badgeBlock = `[![npm version](https://img.shields.io/npm/v/${pkg.name}.svg)](https://www.npmjs.com/package/${pkg.name})\n[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)`;
    return `
You are an expert technical writer. Your task is to generate a factually accurate and well-structured README.md file based on the provided project context.
Do not add extra personality or flair; focus on clear, structured information.
# EXPECTED SECTIONS
Generate these sections in this exact order:
1.  **# Project Title**
2.  **Badges** (use the markdown provided).
3.  **## Tech Stack**
4.  **## Features**
5.  **## Installation**
6.  **## Usage**
7.  **## How It Works** (with a mermaid.js diagram).
8.  **## Contributing**
9.  **## License**
---
# PROJECT CONTEXT
**Project Name:** ${pkg.name}
**Description:** ${pkg.description}
**Badges:**\n${badgeBlock}
**Project Files:**
${files.map(f => `// File: ${f.path}\n${f.content}`).join('\n\n---\n\n')}
`;
}

export async function generateReadmeContent(files, style = 'default', pkg) {
  const architectPrompt = getArchitectPrompt(files, pkg);
  const factualDraft = await callPantheon(architectPrompt, 'Architect');

  if (!factualDraft) {
      throw new Error('Failed to generate the initial draft.');
  }

  const stylistPrompt = getStylistPrompt(style) + `\n---\n# RAW README DRAFT TO ENHANCE:\n\n${factualDraft}`;
  const finalMasterpiece = await callPantheon(stylistPrompt, 'Stylist');

  return finalMasterpiece || factualDraft;
}

async function callPantheon(prompt, stage) {
  for (const provider of providers) {
    const key = process.env[`${provider.name.toUpperCase()}_API_KEY`];

    if (!key) {
      continue;
    }

    console.log(chalk.gray(`\n  └─ Calling the Pantheon (${provider.name}) for the ${stage} phase...`));

    try {
      const result = await provider.execute(prompt, key);
      console.log(chalk.green(`  └─ ${provider.name} succeeded!`));
      return result.trim();
    } catch (error) {
      console.log(error);
      console.log(chalk.yellow(`  └─ ${provider.name} key starting with "${key.slice(0, 4)}..." failed.`));
    }

    console.log(chalk.red(`  └─ ${provider.name} failed. Trying next provider if available...`));
  }

  throw new Error('All available AI providers failed. Please check your API keys and internet connection.');
}
