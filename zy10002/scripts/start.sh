#!/bin/bash

set -e

echo "🚀 Starting Chaos Payment Platform..."

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "📦 Checking dependencies..."
if [ ! -f "go.mod" ]; then
    echo "❌ go.mod not found. Are you in the right directory?"
    exit 1
fi

if ! command -v go &> /dev/null; then
    echo "❌ Go is not installed. Please install Go 1.21+."
    exit 1
fi

echo "🔧 Downloading dependencies..."
go mod download

echo "🏗️  Building the application..."
go build -o chaos-payment ./cmd

echo "✅ Build successful!"

echo ""
echo "📋 Quick Start Guide:"
echo ""
echo "1. Start PostgreSQL and Redis (if not running):"
echo "   docker-compose up -d"
echo ""
echo "2. Run the application:"
echo "   ./chaos-payment"
echo ""
echo "3. Open your browser and visit:"
echo "   http://localhost:8080"
echo ""
echo "🎮 Available operations:"
echo "   - Create orders and simulate duplicate callbacks"
echo "   - Inject various chaos scenarios"
echo "   - View real-time event timeline"
echo "   - Replay events and recover from failures"
echo ""

read -p "Do you want to start the application now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Starting server on http://localhost:8080"
    ./chaos-payment
fi
