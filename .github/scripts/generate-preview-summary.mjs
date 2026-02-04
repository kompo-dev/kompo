import { execFileSync } from 'child_process';
import fs from 'fs';

function getLastTag() {
  try {
    // Get last release tag matching v* pattern
    const tag = execFileSync(
      'git',
      ['describe', '--tags', '--abbrev=0', '--match', 'v*'],
      { encoding: 'utf-8' }
    ).trim();
    return tag;
  } catch {
    return null;
  }
}

function getCommits(lastTag) {
  try {
    // Get all commits since last tag
    const commitMessages = execFileSync(
      'git',
      [
        'log',
        `${lastTag}..HEAD`,
        '--oneline',
        '--no-merges',
        '--format=%s',
      ],
      { encoding: 'utf-8' }
    ).trim();

    const commits = commitMessages
      .split('\n')
      .map((msg) => {
        const match = msg.match(/\(#(\d+)\)$/);
        return match ? `- #${match[1]}` : `- ${msg}`;
      })
      .join('\n');

    return commits;
  } catch {
    return null;
  }
}

const lastTag = getLastTag();
let summary = '';

if (!lastTag) {
  summary = '*Could not determine last release tag*\n';
} else {
  const commits = getCommits(lastTag);
  
  summary = `# 👀 Release Preview (next)\n\n`;
  summary += `> This PR is a **LIVE PREVIEW** of the next release.\n`;
  summary += `> It contains all changes since tag \`${lastTag}\`.\n\n`;
  
  if (commits) {
    summary += `## 📝 New Commits\n\n${commits}\n`;
  } else {
    summary += `*No new commits since ${lastTag}*\n`;
  }
}

fs.writeFileSync('RELEASE_SUMMARY_PREVIEW.md', summary);
console.log('Preview summary generated in RELEASE_SUMMARY_PREVIEW.md');
