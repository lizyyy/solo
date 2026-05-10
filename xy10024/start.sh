#!/bin/bash

echo "========================================"
echo "设备借用管理系统 - 快速启动脚本"
echo "========================================"
echo ""

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo "错误: 未检测到 Docker，请先安装 Docker"
    exit 1
fi

if ! command -v docker-compose &> /dev/null; then
    echo "错误: 未检测到 Docker Compose，请先安装"
    exit 1
fi

echo "[1/4] 停止现有服务..."
docker-compose down 2>/dev/null || true

echo ""
echo "[2/4] 构建并启动服务..."
docker-compose up -d --build

echo ""
echo "[3/4] 等待服务启动..."
sleep 10

echo ""
echo "[4/4] 检查服务状态..."
docker-compose ps

echo ""
echo "========================================"
echo "服务启动完成！"
echo ""
echo "访问地址："
echo "  前端: http://localhost"
echo "  后端健康检查: http://localhost:8080/health"
echo ""
echo "默认管理员账号："
echo "  用户名: admin"
echo "  密码: admin123"
echo ""
echo "查看日志: docker-compose logs -f"
echo "停止服务: docker-compose down"
echo "========================================"
