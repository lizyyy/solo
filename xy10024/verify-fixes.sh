#!/bin/bash

set -e

echo "========================================"
echo "设备借用管理系统 - 修复验证脚本"
echo "========================================"
echo ""

# 检查关键文件是否存在
echo "[1/8] 检查关键文件..."

check_file() {
    if [ -f "$1" ]; then
        echo "  ✓ $1 存在"
    else
        echo "  ✗ $1 不存在"
        exit 1
    fi
}

check_file "backend/go.mod"
check_file "backend/go.sum"
check_file "backend/main.go"
check_file "backend/Dockerfile"
check_file "frontend/package.json"
check_file "docker-compose.yml"
check_file "database/schema.sql"

echo ""
echo "[2/8] 验证后端 Dockerfile 修复..."

if grep -q "go mod tidy" "backend/Dockerfile"; then
    echo "  ✓ Dockerfile 使用 go mod tidy"
else
    echo "  ✗ Dockerfile 缺少 go mod tidy"
    exit 1
fi

echo ""
echo "[3/8] 验证 middleware.go log 导入..."

if grep -q '"log"' "backend/internal/middleware/middleware.go"; then
    echo "  ✓ middleware.go 导入了 log 包"
else
    echo "  ✗ middleware.go 缺少 log 包导入"
    exit 1
fi

echo ""
echo "[4/8] 验证 JWT Secret 统一..."

if grep -q "cfg.JWT.Secret" "backend/main.go"; then
    echo "  ✓ main.go 传递 cfg.JWT.Secret 给 UserService"
else
    echo "  ✗ main.go 未正确传递 JWT Secret"
    exit 1
fi

if grep -q "jwtSecret string" "backend/internal/service/service.go"; then
    echo "  ✓ UserService 接收 jwtSecret 参数"
else
    echo "  ✗ UserService 未接收 jwtSecret 参数"
    exit 1
fi

echo ""
echo "[5/8] 验证前端 Devices.vue 命名冲突修复..."

if grep -q "apiDeleteDevice" "frontend/src/views/Devices.vue"; then
    echo "  ✓ API 导入已重命名为 apiDeleteDevice"
else
    echo "  ✗ Devices.vue 仍有命名冲突"
    exit 1
fi

if grep -q "import { computed } from 'vue'" "frontend/src/views/Devices.vue"; then
    echo "  ✓ computed 已在顶部导入"
else
    echo "  ✗ computed 导入位置错误"
    exit 1
fi

echo ""
echo "[6/8] 验证数据库 schema..."

if grep -q "users" "database/schema.sql" && grep -q "devices" "database/schema.sql" && grep -q "events" "database/schema.sql"; then
    echo "  ✓ 数据库 schema 包含核心表"
else
    echo "  ✗ 数据库 schema 不完整"
    exit 1
fi

echo ""
echo "[7/8] 验证 docker-compose 配置..."

if grep -q "device-borrow-postgres" "docker-compose.yml" && grep -q "device-borrow-backend" "docker-compose.yml" && grep -q "device-borrow-frontend" "docker-compose.yml"; then
    echo "  ✓ Docker Compose 配置完整"
else
    echo "  ✗ Docker Compose 配置不完整"
    exit 1
fi

echo ""
echo "[8/8] 检查环境变量配置..."

if [ -f ".env" ]; then
    echo "  ✓ .env 文件存在"
else
    echo "  ⚠ .env 文件不存在，将使用默认配置"
fi

echo ""
echo "========================================"
echo "所有关键修复验证通过！"
echo ""
echo "启动命令："
echo "  docker-compose up -d"
echo ""
echo "访问地址："
echo "  前端: http://localhost"
echo "  后端: http://localhost:8080"
echo "  默认账号: admin / admin123"
echo "========================================"
