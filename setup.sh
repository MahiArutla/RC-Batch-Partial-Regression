#!/bin/bash
# Setup script to configure git hooks and install dependencies

echo "Setting up git hooks..."
git config core.hooksPath .githooks

echo "Making hooks executable..."
chmod +x .githooks/post-checkout
chmod +x .githooks/post-merge

echo "Installing dependencies..."
npm install

echo ""
echo "✓ Setup complete! Dependencies will now install automatically when package-lock.json changes."
