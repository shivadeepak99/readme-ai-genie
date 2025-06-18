import fg from 'fast-glob';
import fs from 'fs/promises';
import path from 'path';
import ignore from 'ignore';

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB cap

/**
 * Scans the project directory for relevant files, respecting .gitignore and .env rules.
 * @returns {Promise<Array<{path: string, content: string}>>} A list of files with their content.
 */
export async function getProjectFiles() {
  const root = path.resolve(process.cwd());
  const ig = ignore();

  // Default ignore rules - robust and secure
  ig.add(['node_modules', '.git', 'dist', 'coverage', 'README.md', '.env*']);

  // Load .gitignore from the project root
  try {
    const gitignoreContent = await fs.readFile(path.join(root, '.gitignore'), 'utf8');
    ig.add(gitignoreContent);
  } catch {
    // No .gitignore found, that's okay.
  }

  // Honor ENV-based patterns for ultimate flexibility
  const includePatterns = process.env.GLOB_INCLUDE?.split(',') || ['**/*'];
  const excludePatterns = process.env.GLOB_EXCLUDE?.split(',') || ['**/node_modules/**', 'dist/**'];

  // Collect all matching files relative to the project root
  const allFiles = await fg(includePatterns, { cwd: root, dot: true, ignore: excludePatterns });

  // Filter, read content, and build our final list
  const files = [];
  for (const file of allFiles) {
    if (ig.ignores(file)) {
      continue;
    }

    const absolutePath = path.join(root, file);
    try {
      const stats = await fs.stat(absolutePath);
      // Skip huge files or common binary types to be efficient
      if (stats.size > MAX_BYTES || /\.(png|jpg|jpeg|zip|exe|dll)$/.test(file)) {
        continue;
      }
    } catch {
      // Ignore stat errors for things like broken symlinks
    }

    let content = '';
    try {
      content = await fs.readFile(absolutePath, 'utf8');
    } catch {
      content = '[Binary or unreadable file]';
    }

    files.push({ path: file, content });
  }

  // Deduplicate and sort for a predictable, clean output every time
  return Array.from(new Set(files)).sort((a, b) => a.path.localeCompare(b.path));
}
