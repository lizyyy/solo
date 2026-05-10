#!/bin/bash

echo "🎬 Chaos Payment Platform - Quick Demo"
echo "======================================"
echo ""

if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker first."
    exit 1
fi

if ! command -v go &> /dev/null; then
    echo "❌ Go is not installed. Please install Go 1.21+."
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_DIR"

echo "🐳 Starting PostgreSQL and Redis..."
docker-compose up -d

echo "⏳ Waiting for services to be ready..."
sleep 8

echo "📦 Downloading dependencies..."
go mod download

echo "🏗️  Building the application..."
go build -o chaos-payment ./cmd

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Demo Steps:"
echo ""
echo "1. Open a new terminal and run the server:"
echo "   ./chaos-payment"
echo ""
echo "2. Open your browser and visit:"
echo "   http://localhost:8080"
echo ""
echo "3. Try these scenarios:"
echo ""
echo "   📦 Scenario 1: Duplicate Payment Callback"
echo "   - Click '创建订单' to create an order"
echo "   - Select the order in the orders list"
echo "   - Click '模拟重复回调'"
echo "   - Watch the event timeline for: PAYMENT_CALLBACK → DUPLICATE_CALLBACK"
echo ""
echo "   🔄 Scenario 2: Event Replay & Recovery"
echo "   - After creating some events, click '事件回放'"
echo "   - Or click '回滚到快照' to restore state"
echo ""
echo "   🔥 Scenario 3: Chaos Injection"
echo "   - Enable scenarios in the '混沌场景' section"
echo "   - Or use '故障注入' buttons for specific tests"
echo "   - Monitor: 连接池耗尽 | 消息积压 | Goroutine泄漏 | 数据库锁 | 缓存脏数据"
echo ""
echo "4. Verify order consistency:"
echo "   - Click '验证一致性' to check for issues"
echo "   - Click '修复重复回调' or '修复缓存脏数据' to recover"
echo ""
echo "5. Stop the demo:"
echo "   - Ctrl+C to stop the server"
echo "   - Run: docker-compose down"
echo ""

read -p "Do you want to start the server now? (y/n) " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "🚀 Starting server on http://localhost:8080"
    echo "   (Press Ctrl+C to stop)"
    echo ""
    ./chaos-payment
fi
