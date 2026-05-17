#!/bin/bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "======================================"
echo "  主播优惠券撤回系统 - 数据库启动"
echo "======================================"
echo ""

echo "[1/3] 检查Docker环境..."
if ! command -v docker &> /dev/null; then
    echo "❌ 错误: 未检测到Docker，请先安装Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "❌ 错误: 未检测到Docker Compose，请先安装Docker Compose"
    exit 1
fi
echo "✅ Docker环境检查通过"

echo ""
echo "[2/3] 启动数据库服务..."
docker-compose up -d

echo ""
echo "[3/3] 等待数据库就绪..."
echo "正在等待PostgreSQL启动..."

MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker exec coupon-withdraw-db pg_isready -U admin -d coupon_withdraw -h localhost &> /dev/null; then
        echo "✅ 数据库已就绪"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -n "."
    sleep 2
done

if [ $RETRY_COUNT -eq $MAX_RETRIES ]; then
    echo ""
    echo "⚠️  警告: 数据库启动超时，请手动检查状态"
fi

echo ""
echo "======================================"
echo "  服务启动完成！"
echo "======================================"
echo ""
echo "数据库连接信息:"
echo "  主机:     localhost"
echo "  端口:     5432"
echo "  数据库:   coupon_withdraw"
echo "  用户名:   admin"
echo "  密码:     coupon123456"
echo ""
echo "pgAdmin 管理界面:"
echo "  地址:     http://localhost:5050"
echo "  邮箱:     admin@example.com"
echo "  密码:     admin123"
echo ""
echo "常用命令:"
echo "  停止服务: ./bin/stop.sh"
echo "  查看日志: ./bin/logs.sh"
echo "  重置数据: ./bin/reset.sh"
echo "  连接数据库: ./bin/psql.sh"
echo ""
