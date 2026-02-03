import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const CHANGELOG_NAME = 'CHANGELOG.md';

function getNewEntries(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  
  // Match header and content until next header or EOF
  const secureMatches = content.match(/^##\s+v?([0-9]+\.[0-9]+\.[0-9]+(?:-[0-9a-zA-Z.]+)?)(?:.*?)\n([\s\S]*?)(?=^##\s+|$)/m);

  if (!secureMatches) return null;

  return {
    version: secureMatches[1],
    content: secureMatches[2].trim()
  };
}

function getCommitsForPackage(pkg, lastTag) {
  try {
    const commits = execSync(
      `git log ${lastTag}..HEAD --oneline --no-merges --format="- %s" -- packages/${pkg}`,
      { encoding: 'utf-8' }
    ).trim();
    if (!commits) return null;
    // Deduplicate commits (same commit message can appear multiple times)
    const uniqueCommits = [...new Set(commits.split('\n'))].join('\n');
    return uniqueCommits;
  } catch {
    return null;
  }
}

function getLastTag() {
  try {
    // Get last release tag matching v* pattern (e.g., v0.1.3-beta.1)
    return execSync('git describe --tags --abbrev=0 --match "v*"', { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

const packagesDir = path.join(process.cwd(), 'packages');
const packages = fs.readdirSync(packagesDir).filter(p => 
  fs.statSync(path.join(packagesDir, p)).isDirectory()
);

let summary = '';
let hasChangelogContent = false;

// 1. Check if any package has new changelog content (RELEASE MODE)
for (const pkg of packages) {
  const changelogPath = path.join(packagesDir, pkg, CHANGELOG_NAME);
  const result = getNewEntries(changelogPath);
  if (result?.content && result.content !== '') {
    hasChangelogContent = true;
    break;
  }
}

if (hasChangelogContent) {
  // RELEASE MODE: Use changelogs (existing behavior)
  for (const pkg of packages) {
    const changelogPath = path.join(packagesDir, pkg, CHANGELOG_NAME);
    const result = getNewEntries(changelogPath);
    if (result) {
      const pkgContent = result.content || '*no update*';
      summary += `## 📦 ${pkg} \`${result.version}\`\n\n${pkgContent}\n\n`;
    }
  }
} else {
  // PREVIEW MODE: Use git commits since last tag
  const lastTag = getLastTag();
  
  if (!lastTag) {
    summary = '*Could not determine last release tag*\n';
  } else {
    summary = `## 📦 Packages (next)\n\n`;
    
    let hasAnyCommits = false;
    for (const pkg of packages) {
      const commits = getCommitsForPackage(pkg, lastTag);
      if (commits) {
        hasAnyCommits = true;
        summary += `### ${pkg} - Changes since ${lastTag}\n\n${commits}\n\n`;
      }
    }
    
    if (!hasAnyCommits) {
      summary += `*No changes since ${lastTag}*\n`;
    }
  }
}

fs.writeFileSync('RELEASE_SUMMARY.md', summary);
console.log('Release summary generated in RELEASE_SUMMARY.md');
