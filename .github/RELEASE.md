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

# Commit the version changes
git add .
git commit -m "chore: version packages for vX.X.X"

# Push to staging (Directly triggers release tag)
git push origin staging
```

> **Note:** The push to `staging` with commit message `chore: version packages` or `ci: release` triggers the **Release Prepare** workflow.

### 3. Tag Creation (Automatic)

When you push the release commit:

1. **Release Prepare** workflow triggers immediately
2. Creates git tag `vX.X.X` on this commit
3. Creates/Updates the PR `staging` -> `main` with release notes

> **Why direct push?** This avoids the need for a separate release PR waiting for strict review, and prevents accidental Squash Merges that would orphan the version tag.

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
