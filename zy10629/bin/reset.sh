#!/bin/bash

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "======================================"
echo "  重置数据库数据"
echo "======================================"
echo ""
echo "⚠️  警告: 此操作将删除所有数据并重新初始化!"
read -p "请输入 YES 确认继续: " confirm

if [ "$confirm" != "YES" ]; then
    echo "操作已取消"
    exit 0
fi

echo ""
echo "[1/3] 停止并删除容器..."
docker-compose down -v

echo ""
echo "[2/3] 重新启动服务..."
docker-compose up -d

echo ""
echo "[3/3] 等待数据库就绪..."
MAX_RETRIES=30
RETRY_COUNT=0

while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
    if docker exec coupon-withdraw-db pg_isready -U admin -d coupon_withdraw -h localhost &> /dev/null; then
        echo "✅ 数据库已重置并就绪"
        break
    fi
    RETRY_COUNT=$((RETRY_COUNT + 1))
    echo -n "."
    sleep 2
done

echo ""
echo "数据重置完成！"
echo ""
