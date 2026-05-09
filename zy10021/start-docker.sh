#!/bin/bash

# PaymentGuard 使用 Docker Compose 启动
# 包含 PostgreSQL、Redis、RabbitMQ 和应用

echo "=========================================="
echo "   PaymentGuard Docker 启动"
echo "=========================================="
echo ""

if ! command -v docker &> /dev/null; then
    echo "❌ 错误: 未找到 Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ 错误: 未找到 Docker Compose"
    exit 1
fi

echo "📦 构建镜像..."
docker-compose build

echo ""
echo "🚀 启动所有服务..."
docker-compose up -d

echo ""
echo "✅ 服务启动中..."
echo ""
echo "访问地址:"
echo "  - 应用: http://localhost:8080"
echo "  - Actuator: http://localhost:8080/actuator"
echo "  - Prometheus: http://localhost:8080/actuator/prometheus"
echo "  - H2 Console (开发模式): http://localhost:8080/h2-console"
echo "  - RabbitMQ 管理: http://localhost:15672 (user/pass: paymentguard/paymentguard123)"
echo ""
echo "查看日志: docker-compose logs -f paymentguard-app"
