#!/usr/bin/env node

import fs from 'fs';
import path from 'path';

// Function to resolve relative paths
function resolveRelativePath(fromFile, relativePath) {
  // Remove .js extension and replace with .ts
  const tsPath = relativePath.replace(/\.js$/, '.ts');
  
  // Get directory of the importing file
  const fromDir = path.dirname(fromFile);
  
  // Resolve the full path
  return path.resolve(fromDir, tsPath);
}

// Find all TypeScript files in src
const srcDir = './src';
const tsFiles = [];

function findTsFiles(dir) {
  const items = fs.readdirSync(dir);
  for (const item of items) {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory()) {
      findTsFiles(fullPath);
    } else if (item.endsWith('.ts')) {
      tsFiles.push(fullPath);
    }
  }
}

findTsFiles(srcDir);

// Check imports in each file
const brokenImports = [];

for (const file of tsFiles) {
  const content = fs.readFileSync(file, 'utf8');
  
  // Split content into lines to process each line individually
  const lines = content.split('\n');

  // Process each line to identify import/export statements outside of comments
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Look for import/export from patterns in this line (named imports)
    const lineFromRegex = /(import|export)\s+[\s\S]*?\s+from\s+['"](\.\.?(?:\/[\w_-]+)+)\.js['"]/g;
    let fromMatch;

    while ((fromMatch = lineFromRegex.exec(line)) !== null) {
      // Check if this is in a comment by looking at the text before the match
      const beforeMatch = line.substring(0, fromMatch.index);

      // Simple check: if there's a '//' before the match, it's in a single-line comment
      if (beforeMatch.includes('//')) {
        continue; // Skip if in single-line comment
      }

      // For multi-line comments (/* */), check if we're inside one
      const contentUpToMatch = content.substring(0, content.indexOf(line) + fromMatch.index);
      const slashStarCount = (contentUpToMatch.match(/\*\//g) || []).length;
      const starSlashCount = (contentUpToMatch.match(/\/\*/g) || []).length;

      // If we're inside a multi-line comment (odd difference), skip
      if (starSlashCount > slashStarCount) {
        continue;
      }

      const relativePath = fromMatch[2] + '.js'; // The captured group [2] is the path
      const resolvedPath = resolveRelativePath(file, relativePath);

      // Check if the resolved path exists (as .ts file)
      if (!fs.existsSync(resolvedPath)) {
        // Also check if it's a directory with index.ts
        const dirIndexPath = path.join(path.dirname(resolvedPath), 'index.ts');
        if (!fs.existsSync(dirIndexPath)) {
          brokenImports.push({
            file: path.relative('./', file),
            import: relativePath,
            line: i + 1  // Line numbers start from 1
          });
        }
      }
    }

    // Look for direct import patterns (default imports, etc.)
    const lineImportRegex = /import\s+['"](\.\.?(?:\/[\w_-]+)+)\.js['"]/g;
    let importMatch;

    while ((importMatch = lineImportRegex.exec(line)) !== null) {
      // Check if this is in a comment by looking at the text before the match
      const beforeMatch = line.substring(0, importMatch.index);

      // Simple check: if there's a '//' before the match, it's in a single-line comment
      if (beforeMatch.includes('//')) {
        continue; // Skip if in single-line comment
      }

      // For multi-line comments (/* */), check if we're inside one
      const contentUpToMatch = content.substring(0, content.indexOf(line) + importMatch.index);
      const slashStarCount = (contentUpToMatch.match(/\*\//g) || []).length;
      const starSlashCount = (contentUpToMatch.match(/\/\*/g) || []).length;

      // If we're inside a multi-line comment (odd difference), skip
      if (starSlashCount > slashStarCount) {
        continue;
      }

      const relativePath = importMatch[1] + '.js'; // The captured group [1] is the path
      const resolvedPath = resolveRelativePath(file, relativePath);

      // Check if the resolved path exists (as .ts file)
      if (!fs.existsSync(resolvedPath)) {
        // Also check if it's a directory with index.ts
        const dirIndexPath = path.join(path.dirname(resolvedPath), 'index.ts');
        if (!fs.existsSync(dirIndexPath)) {
          brokenImports.push({
            file: path.relative('./', file),
            import: relativePath,
            line: i + 1  // Line numbers start from 1
          });
        }
      }
    }
  }
}

// Print broken imports in the requested format
if (brokenImports.length > 0) {
  console.log('Broken imports found:');
  for (const broken of brokenImports) {
    console.log(`- File: ${broken.file}`);
    console.log(`- Broken import: ${broken.import}`);
    console.log(`- Line: ${broken.line}`);
    console.log('');
  }
} else {
  console.log('No broken imports found.');
}