import fs from 'fs';
import path from 'path';

const CHANGELOG_NAME = 'CHANGELOG.md';

function getNewEntries(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  // Match everything between the first ## header and the second one (or end of file)
  // Match header line starting with "## " followed by version, capturing until logic next header or EOF
  // Improved Regex:
  // ^##\s+              => Starts with ## and whitespace
  // (\[?[0-9.]+.*)      => Captures the version (potentially linked like [1.2.3])
  // ([\s\S]*?)          => Captures content non-greedily
  // (?=^##\s+|$)        => Lookahead for next header or End of File (multiline mode)
  const matches = content.match(/^##\s+(?:\[?v?([0-9]+\.[0-9]+\.[0-9]+(?:-[a-z0-9.]+)?))[\s\S]*?^((?:.|\n)*?)(?=^##\s+|$)/m);
  
  // Alternative simpler approach often used: Split by "## " and take the second chunk (first is title/preamble)
  // But let's stick to regex to extract version clean.
  
  // Make regex more permissive: match "## " then capture version, then content until next "## "
  const secureMatches = content.match(/^##\s+v?([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9a-zA-Z.]+)?)(?:.*?)\n([\s\S]*?)(?=^##\s+|$)/m);

  if (!secureMatches) return null;

  return {
    version: secureMatches[1],
    content: secureMatches[2].trim()
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
