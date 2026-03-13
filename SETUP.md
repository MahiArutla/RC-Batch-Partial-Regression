# Setup Instructions

## First Time Setup

After cloning this repository, run:

```bash
npm install
```

That's it! The `postinstall` script will automatically configure git hooks that will install dependencies whenever `package-lock.json` changes.

Alternatively, you can run the setup script:

```bash
bash setup.sh
```

## What This Does

The setup configures git hooks that automatically run `npm install` when:
- Switching branches (if `package-lock.json` changed)
- Pulling changes (if `package-lock.json` changed)

This ensures that dependencies are always up-to-date and prevents "Cannot find module" errors.

## Manual Installation

If you need to install dependencies manually at any time, simply run:

```bash
npm install
```
