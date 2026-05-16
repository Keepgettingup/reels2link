#!/usr/bin/env bash
# WSL Setup Script for SPOOL (Instagram Reels conversion service architecture)
# Run this inside your WSL MyLinux environment after copying the folder.

set -e

PROJECT_NAME="Instagram Reels conversion service architecture"
PROJECT_DIR="$HOME/$PROJECT_NAME"

echo "==> Setting up SPOOL in WSL MyLinux..."

# Update system packages
sudo apt-get update -qq

# Install Node.js 20 (LTS) if not present
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" != "20" ]; then
  echo "==> Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
  sudo apt-get install -y -qq nodejs
fi

# Install ffmpeg and yt-dlp
echo "==> Installing ffmpeg..."
sudo apt-get install -y -qq ffmpeg

echo "==> Installing yt-dlp..."
if ! command -v yt-dlp &> /dev/null; then
  sudo curl -L https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp -o /usr/local/bin/yt-dlp
  sudo chmod a+rx /usr/local/bin/yt-dlp
fi

cd "$PROJECT_DIR"

# Install Node dependencies
echo "==> Installing npm dependencies..."
npm install

# Create .env from example if missing
if [ ! -f .env ]; then
  echo "==> Creating .env from .env.example..."
  cp .env.example .env
  echo "⚠️  Please edit .env with your real Bunny Storage and Stripe keys before starting."
fi

echo ""
echo "✅ SPOOL is ready in WSL MyLinux at: $PROJECT_DIR"
echo "   Next step: edit .env, then run 'npm start'"
