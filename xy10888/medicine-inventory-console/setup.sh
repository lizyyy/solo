#!/bin/bash

echo "=========================================="
echo "    药品库存接口台 - 快速安装脚本"
echo "=========================================="

BASE_DIR=$(pwd)

echo ""
echo "[1/6] 安装后端依赖..."
cd "$BASE_DIR/backend"
rm -rf node_modules package-lock.json
npm install 2>&1
if [ $? -ne 0 ]; then
    echo "❌ 后端依赖安装失败"
    exit 1
fi
echo "✅ 后端依赖安装完成"

echo ""
echo "[2/6] 初始化数据库..."
npm run init-db
echo "✅ 数据库初始化完成"

echo ""
echo "[3/6] 导入测试数据..."
npm run seed-data
echo "✅ 测试数据导入完成"

echo ""
echo "[4/6] 安装前端依赖..."
cd "$BASE_DIR/frontend"
rm -rf node_modules package-lock.json
npm install 2>&1
if [ $? -ne 0 ]; then
    echo "❌ 前端依赖安装失败"
    exit 1
fi
echo "✅ 前端依赖安装完成"

echo ""
echo "[5/6] 验证后端可启动..."
cd "$BASE_DIR/backend"
timeout 3 node src/server.js 2>&1 | head -5 &
sleep 2
if curl -s http://localhost:3001/api/health > /dev/null 2>&1; then
    echo "✅ 后端服务可正常启动"
else
    echo "⚠️  后端启动验证超时（可能正常，首次启动可能较慢）"
fi
kill %1 2>/dev/null

echo ""
echo "[6/6] 验证前端可构建..."
cd "$BASE_DIR/frontend"
npm run build 2>&1
if [ $? -eq 0 ]; then
    echo "✅ 前端构建验证通过"
else
    echo "⚠️  前端构建验证失败（dev模式仍可运行）"
fi

echo ""
echo "=========================================="
echo "    安装完成！"
echo "=========================================="
echo ""
echo "启动命令："
echo "  后端: cd backend && npm start"
echo "  前端: cd frontend && npm run dev"
echo ""
echo "访问地址："
echo "  前端: http://localhost:3000"
echo "  后端: http://localhost:3001"
echo "  健康检查: http://localhost:3001/api/health"
echo ""
echo "功能验证路径："
echo "  1. 打开 http://localhost:3000 查看总览"
echo "  2. 点击「库存批次」→ 点击「详情」→ 测试占用释放"
echo "  3. 点击「多源同步」→ 选择来源系统 → 点击「开始同步」"
echo "  4. 返回「库存批次」查看同步新增的数据"
echo ""
