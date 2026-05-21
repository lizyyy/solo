#!/bin/bash

echo "=========================================="
echo "    药品库存接口台 - 快速安装脚本"
echo "=========================================="

BASE_DIR=$(pwd)

echo ""
echo "[1/5] 安装后端依赖..."
cd "$BASE_DIR/backend"
rm -rf node_modules
npm install 2>&1
if [ $? -ne 0 ]; then
    echo "❌ 后端依赖安装失败"
    exit 1
fi
echo "✅ 后端依赖安装完成"

echo ""
echo "[2/5] 验证后端依赖..."
node -e "require('express'); require('sqlite3'); require('uuid'); require('joi'); console.log('后端依赖全部可用')"
if [ $? -ne 0 ]; then
    echo "❌ 后端依赖验证失败"
    exit 1
fi
echo "✅ 后端依赖验证通过"

echo ""
echo "[3/5] 安装前端依赖..."
cd "$BASE_DIR/frontend"
rm -rf node_modules
npm install 2>&1
if [ $? -ne 0 ]; then
    echo "❌ 前端依赖安装失败"
    exit 1
fi
echo "✅ 前端依赖安装完成"

echo ""
echo "[4/5] 构建前端项目..."
npm run build 2>&1
if [ $? -ne 0 ]; then
    echo "⚠️  前端构建失败，但可以用 dev 模式运行"
else
    echo "✅ 前端构建完成"
fi

echo ""
echo "[5/5] 清理旧数据库（可选）..."
read -p "是否清理旧数据库并重新初始化? (y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    rm -f "$BASE_DIR/backend/data/medicine-inventory.db"
    echo "✅ 旧数据库已清理，启动时将自动重新初始化"
else
    echo "保留现有数据库"
fi

echo ""
echo "=========================================="
echo "    安装完成！"
echo "=========================================="
echo ""
echo "启动命令："
echo "  后端: cd backend && npm start"
echo "  前端: cd frontend && npm run dev (仅开发用)"
echo ""
echo "注意："
echo "  - 后端启动时会自动检查并初始化数据库"
echo "  - 单端口访问: http://localhost:3001"
echo ""
echo "访问地址："
echo "  前端页面: http://localhost:3001"
echo "  健康检查: http://localhost:3001/api/health"
echo ""
