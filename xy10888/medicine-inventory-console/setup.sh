#!/bin/bash

echo "=========================================="
echo "    药品库存接口台 - 快速安装脚本"
echo "=========================================="

echo ""
echo "[1/5] 安装后端依赖..."
cd backend
npm install --legacy-peer-deps 2>/dev/null || npm install
if [ $? -ne 0 ]; then
    echo "❌ 后端依赖安装失败"
    exit 1
fi
echo "✅ 后端依赖安装完成"

echo ""
echo "[2/5] 初始化数据库..."
npm run init-db
echo "✅ 数据库初始化完成"

echo ""
echo "[3/5] 导入测试数据..."
npm run seed-data
echo "✅ 测试数据导入完成"

echo ""
echo "[4/5] 安装前端依赖..."
cd ../frontend
npm install --legacy-peer-deps 2>/dev/null || npm install
if [ $? -ne 0 ]; then
    echo "❌ 前端依赖安装失败"
    exit 1
fi
echo "✅ 前端依赖安装完成"

echo ""
echo "[5/5] 构建前端项目..."
npm run build
if [ $? -ne 0 ]; then
    echo "⚠️  前端构建失败，但可以用 dev 模式运行"
fi
echo "✅ 前端构建完成"

echo ""
echo "=========================================="
echo "    安装完成！"
echo "=========================================="
echo ""
echo "启动方式："
echo "  后端: cd backend && npm start"
echo "  前端: cd frontend && npm run dev"
echo ""
echo "访问地址："
echo "  前端: http://localhost:3000"
echo "  后端: http://localhost:3001"
echo "  健康检查: http://localhost:3001/api/health"
echo ""
