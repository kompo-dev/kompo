import fs from 'fs';
import path from 'path';

const CHANGELOG_NAME = 'CHANGELOG.md';

function getNewEntries(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  // Match everything between the first ## header and the second one (or end of file)
  const matches = content.match(/## [0-9.]+(?:-[a-z0-9.]+)?[\s\S]*?(?=## [0-9.]+(?:-[a-z0-9.]+)?|$)/);
  if (!matches) return null;
  
  return matches[0].trim();
}

const packagesDir = path.join(process.cwd(), 'packages');
const packages = fs.readdirSync(packagesDir);
let summary = '## 📦 Packages in this release\n\n';
let hasChanges = false;

// Group by common version if possible, but for now just list them
for (const pkg of packages) {
  const changelogPath = path.join(packagesDir, pkg, CHANGELOG_NAME);
  const entries = getNewEntries(changelogPath);
  if (entries) {
    summary += `### 📦 \`${pkg}\`\n\n${entries}\n\n`;
    hasChanges = true;
  }
}

if (!hasChanges) {
  summary = 'Initial release or internal updates.';
} else {
  summary = '## � Package Changes\n\n' + summary;
}

fs.writeFileSync('RELEASE_SUMMARY.md', summary);
console.log('Release summary generated in RELEASE_SUMMARY.md');
