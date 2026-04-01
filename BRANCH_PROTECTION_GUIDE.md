# Branch Protection Setup Guide

## Overview
This guide explains how to protect the `main` branch using GitHub Branch Rulesets to prevent accidental changes and ensure code quality.

## Branch Ruleset Configuration

### Ruleset Name
**Protect Main Branch**

### Target Branch
- `main` (default branch)

## Recommended Protection Rules

### 1. **Require Pull Request Before Merging**
- **Required Approvals:** 1 reviewer minimum
- **Dismiss stale reviews:** Yes (when new commits are pushed)
- **Require review from Code Owners:** Optional (enable if you have a CODEOWNERS file)
- **Require approval of most recent push:** No
- **Require conversation resolution:** Yes (all review comments must be resolved)

**Purpose:** Ensures all changes are reviewed before being merged into main.

### 2. **Prevent Force Pushes**
- **Rule:** Block non-fast-forward pushes
- **Purpose:** Prevents rewriting commit history on the main branch.

### 3. **Prevent Branch Deletion**
- **Rule:** Block deletion of the main branch
- **Purpose:** Ensures the main branch cannot be accidentally deleted.

### 4. **Require Linear History**
- **Rule:** Require linear history (no merge commits)
- **Purpose:** Keeps a clean, linear commit history. Use squash or rebase merges.

### 5. **Additional Recommended Rules** (Optional)

#### Status Checks (When CI/CD is added)
When you add GitHub Actions workflows in the future:
- Require status checks to pass before merging
- Require branches to be up to date before merging
- Examples: `build`, `test`, `lint`

#### Signed Commits (Advanced)
- Require signed commits for additional security
- All contributors must sign their commits with GPG keys

## How to Apply the Ruleset

### Option 1: GitHub Web UI (Recommended)

1. **Navigate to Repository Settings**
   - Go to: https://github.com/birajdarushi/htreeml
   - Click **Settings** tab
   - Click **Rules** → **Rulesets** in the left sidebar

2. **Create New Ruleset**
   - Click **New ruleset** → **New branch ruleset**
   - Name: `Protect Main Branch`
   - Enforcement status: **Active**

3. **Add Target Branches**
   - Under "Target branches"
   - Click **Add target** → **Include default branch**
   - Or manually add: `main`

4. **Configure Branch Protection Rules**

   Enable the following rules:

   ✅ **Restrict deletions**
   - Prevents branch deletion

   ✅ **Restrict force pushes**
   - Prevents force pushes and history rewrites

   ✅ **Require linear history**
   - Enforces linear commit history

   ✅ **Require a pull request before merging**
   - Required approvals: `1`
   - ✅ Dismiss stale pull request approvals when new commits are pushed
   - ✅ Require conversation resolution before merging
   - ⬜ Require review from Code Owners (optional)
   - ⬜ Require approval of the most recent reviewable push (optional)

   ✅ **Require status checks to pass** (Enable when you add CI/CD)
   - Add status check names when workflows are added
   - ✅ Require branches to be up to date before merging

5. **Bypass Permissions** (Optional)
   - You can allow repository admins to bypass these rules
   - For most projects, leave this empty for maximum protection

6. **Save the Ruleset**
   - Click **Create** to activate the ruleset

### Option 2: GitHub CLI (Requires Admin Token)

If you have a GitHub Personal Access Token with `admin:repo` permissions:

```bash
gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  /repos/birajdarushi/htreeml/rulesets \
  -f name='Protect Main Branch' \
  -f enforcement='active' \
  -f target='branch' \
  -F conditions='{"ref_name":{"include":["refs/heads/main"],"exclude":[]}}' \
  -F rules='[
    {"type": "deletion"},
    {"type": "non_fast_forward"},
    {"type": "required_linear_history"},
    {
      "type": "pull_request",
      "parameters": {
        "required_approving_review_count": 1,
        "dismiss_stale_reviews_on_push": true,
        "require_code_owner_review": false,
        "require_last_push_approval": false,
        "required_review_thread_resolution": true
      }
    }
  ]'
```

## Verifying the Ruleset

After creating the ruleset:

1. **Check Active Rulesets**
   ```bash
   gh api repos/birajdarushi/htreeml/rulesets
   ```

2. **View Ruleset Details**
   ```bash
   gh api repos/birajdarushi/htreeml/rulesets/{ruleset_id}
   ```

3. **Test Protection**
   - Try to push directly to main (should be blocked)
   - Try to force push to main (should be blocked)
   - Create a PR and verify review is required

## Impact on Workflow

After enabling these protections:

### ✅ Allowed Actions
- Create feature branches from main
- Open pull requests to main
- Merge approved pull requests (with 1+ approval)
- Push to feature branches

### ❌ Blocked Actions
- Direct pushes to main
- Force pushes to main
- Deleting the main branch
- Merging unapproved pull requests
- Merging PRs with unresolved conversations

## Best Practices

1. **Branch Naming Convention**
   - Feature: `feature/description`
   - Bug fix: `fix/description`
   - Hotfix: `hotfix/description`
   - Agent work: `claude/description` or `copilot/description`

2. **Commit Messages**
   - Use clear, descriptive commit messages
   - Follow conventional commits format when possible:
     - `feat: add new feature`
     - `fix: resolve bug`
     - `docs: update documentation`
     - `refactor: improve code structure`

3. **Pull Request Process**
   - Create PR from your feature branch
   - Fill in PR description with changes summary
   - Request review from team member
   - Address review comments
   - Resolve all conversations
   - Squash or rebase merge to keep history clean

4. **Code Review Guidelines**
   - Review code for correctness and quality
   - Check for security vulnerabilities
   - Verify tests are included
   - Ensure documentation is updated

## Future Enhancements

When adding CI/CD to this project:

1. **GitHub Actions Workflows**
   - Create `.github/workflows/ci.yml` for automated testing
   - Add build, test, and lint jobs
   - Require these checks to pass before merging

2. **Code Coverage**
   - Add code coverage reporting
   - Set minimum coverage thresholds

3. **Security Scanning**
   - Enable Dependabot for dependency updates
   - Add security scanning for vulnerabilities
   - Scan for secrets in commits

4. **Automated Testing**
   - Unit tests for server components
   - Integration tests for extension
   - E2E tests with Playwright

## Troubleshooting

### "Cannot push to main"
- This is expected! Create a feature branch and open a PR instead
- Use: `git checkout -b feature/my-feature`

### "Need approval to merge PR"
- Request review from a team member
- Wait for approval before merging

### "Unresolved conversations"
- Address all review comments
- Mark conversations as resolved

### "Ruleset not working"
- Verify ruleset is set to "Active" status
- Check that main branch is correctly targeted
- Ensure you're not a bypass actor

## Additional Resources

- [GitHub Branch Rulesets Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets)
- [GitHub Branch Protection Best Practices](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-protected-branches/about-protected-branches)
- [Creating a Pull Request](https://docs.github.com/en/pull-requests/collaborating-with-pull-requests/proposing-changes-to-your-work-with-pull-requests/creating-a-pull-request)
