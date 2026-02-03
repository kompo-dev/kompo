# Kompo Release Workflow

This document describes the release process for the Kompo monorepo.

## Branch Strategy

```
feature/* ──┐
            ├──> staging ──> main
hotfix/*  ──┘
```

- **feature/\*** : Feature branches for development
- **staging** : Integration branch, contains next release
- **main** : Production branch, always stable

## Workflows Overview

| Workflow        | Trigger                                 | Purpose                              |
| --------------- | --------------------------------------- | ------------------------------------ |
| CI Gate         | PR to main/staging                      | Lint, Build, Test                    |
| Release Preview | Push to staging                         | Creates/updates preview PR to main   |
| Release Prepare | Merge PR with "chore: version packages" | Tags release, updates PR to official |
| Release Publish | Push tag `v*` to main                   | Publishes to npm                     |

## Release Process

### 1. During Sprint (Feature Development)

```bash
# Work on feature branch
git checkout -b feature/my-feature
# ... make changes ...
git commit -m "feat: add new feature"

# Create PR to staging
gh pr create --base staging
```

When merged to staging, **Release Preview** creates a PR `👀 Release Preview (next)` showing upcoming changes.

### 2. Preparing a Release

When ready to release:

```bash
# Create release branch from staging
git checkout staging
git pull
git checkout -b release/vX.X.X

# Review what's included since last release
git log v0.1.3-beta.1..HEAD --oneline

# Run changeset version (updates package versions and changelogs)
pnpm changeset version

# Commit the version changes
git add .
git commit -m "chore: version packages for vX.X.X"

# Push and create PR with specific title
git push -u origin release/vX.X.X
gh pr create --base staging --title "chore: release vX.X.X"
```

**⚠️ CRITICAL:** When merging this PR, do **NOT** use "Squash and Merge".
Use **"Rebase and Merge"** or **"Create a merge commit"**.
_Why?_ The tag is created on the PR commit. If you squash, the commit hash changes, and the tag will point to an orphaned commit not present in `staging`/`main` history.

**Important:** The PR title `chore: release vX.X.X` triggers the **Release Prepare** workflow, which creates the tag on your exact commit.

### 3. Tag Creation (Automatic)

When you open the PR with title `chore: release vX.X.X`:

1. **Release Prepare** workflow triggers immediately
2. Creates git tag `vX.X.X` on your PR commit (not the merge commit!)
3. This anchors the release to exactly what you reviewed

> **Note:** If you push more commits to the PR, the workflow runs again but will error if the tag already exists on a different commit. Delete the old tag first if needed.

### 4. Publishing

Merge the release PR from `staging` to `main`:

1. **Release Publish** workflow triggers on the `v*` tag
2. Publishes all packages to npm
3. Creates GitHub Release with notes

## Quick Reference

```bash
# Check current version
cat packages/cli/package.json | jq .version

# Create changeset for a change
pnpm changeset

# Version packages (before release)
pnpm changeset version

# See what would be published
pnpm changeset status
```

## Branch Protection

- **staging**: Require PRs, no direct push
- **main**: Require PRs, require CI pass, require reviews

## Troubleshooting

### Workflow not triggering?

Check the commit message contains exactly: `chore: version packages` or `ci: release`

### Tag already exists?

The workflow skips tagging if the tag already exists. Delete the tag if needed:

```bash
git tag -d vX.X.X
git push origin :refs/tags/vX.X.X
```
