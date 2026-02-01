import fs from 'fs';
import path from 'path';

const CHANGELOG_NAME = 'CHANGELOG.md';

function getNewEntries(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  // Match everything between the first ## header and the second one (or end of file)
  const matches = content.match(/## ([0-9.]+(?:-[a-z0-9.]+)?)([\s\S]*?)(?=## [0-9.]+(?:-[a-z0-9.]+)?|$)/);
  if (!matches) return null;
  
  return {
    version: matches[1],
    content: matches[2].trim()
  };
}

const packagesDir = path.join(process.cwd(), 'packages');
const packages = fs.readdirSync(packagesDir);
let summary = '';
let hasChanges = false;

for (const pkg of packages) {
  const changelogPath = path.join(packagesDir, pkg, CHANGELOG_NAME);
  const result = getNewEntries(changelogPath);
  if (result) {
    const pkgContent = result.content || '*no update*';
    summary += `## 📦 ${pkg} \`${result.version}\`\n\n${pkgContent}\n\n`;
    hasChanges = true;
  }
}

if (!hasChanges) {
  summary = '*no update*';
}

fs.writeFileSync('RELEASE_SUMMARY.md', summary);
console.log('Release summary generated in RELEASE_SUMMARY.md');
