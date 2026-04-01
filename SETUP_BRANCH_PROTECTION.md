# Quick Setup: Branch Protection for Main Branch

## 🎯 Goal
Protect the `main` branch from direct pushes and require pull request reviews before merging.

## ⚡ Quick Setup (5 minutes)

### Step 1: Go to Repository Settings
1. Open: https://github.com/birajdarushi/htreeml/settings/rules
2. Or navigate: **Settings** → **Rules** → **Rulesets**

### Step 2: Create New Branch Ruleset
Click **"New ruleset"** → **"New branch ruleset"**

### Step 3: Basic Configuration
- **Ruleset Name:** `Protect Main Branch`
- **Enforcement status:** **Active** ✅
- **Target branches:** Click **"Add target"** → **"Include default branch"**

### Step 4: Enable Protection Rules

Check these boxes:

#### ✅ Restrict deletions
> Prevents the main branch from being deleted

#### ✅ Require a pull request before merging
- **Required number of approvals before merging:** `1`
- ✅ **Dismiss stale pull request approvals when new commits are pushed**
- ✅ **Require conversation resolution before merging**

#### ✅ Require linear history
> Prevents merge commits, keeps history clean

#### ✅ Block force pushes
> Prevents rewriting history on main branch

### Step 5: Save
Click **"Create"** at the bottom

## ✅ Verification

After creating the ruleset, verify it's active:

```bash
gh api repos/birajdarushi/htreeml/rulesets
```

You should see a ruleset with `"enforcement": "active"` and `"name": "Protect Main Branch"`.

## 🚀 What This Means

### ✅ You CAN:
- Create feature branches
- Push to feature branches
- Create pull requests to main
- Merge approved PRs (with 1+ approval)

### ❌ You CANNOT:
- Push directly to main
- Force push to main
- Delete the main branch
- Merge unapproved PRs

## 📖 Next Steps

1. **Create a feature branch:**
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make your changes and push:**
   ```bash
   git add .
   git commit -m "Add my feature"
   git push -u origin feature/my-feature
   ```

3. **Create a pull request:**
   ```bash
   gh pr create --title "Add my feature" --body "Description of changes"
   ```

4. **Get it reviewed and merge**

## 📚 Full Documentation

For detailed information about all protection rules and best practices, see:
- [BRANCH_PROTECTION_GUIDE.md](BRANCH_PROTECTION_GUIDE.md)
- [Configuration File](.github/branch-ruleset-config.json)

## ❓ Troubleshooting

**Problem:** "Cannot push to main"
- **Solution:** This is expected! Create a feature branch instead.

**Problem:** "Need approval to merge"
- **Solution:** Request review from a team member.

**Problem:** "Ruleset not found"
- **Solution:** Follow the setup steps above to create it.

---

**Note:** Branch rulesets require repository admin permissions to create. If you don't have admin access, ask a repository owner to set this up.
