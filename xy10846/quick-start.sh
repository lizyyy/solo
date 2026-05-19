#!/bin/bash

echo "========================================="
echo "📄 文档切片策略台 - 快速启动脚本"
echo "========================================="
echo ""

PROJECT_DIR="/Users/mac/pro/solo/workspaces/xy10846"
cd "$PROJECT_DIR"

echo "📦 Step 1: 检查并安装依赖..."
echo "-----------------------------------------"
if [ ! -d "node_modules" ]; then
    echo "node_modules 不存在，开始安装依赖..."
    npm install
    if [ $? -ne 0 ]; then
        echo ""
        echo "❌ 依赖安装失败！"
        echo "尝试使用国内镜像: npm install --registry=https://registry.npmmirror.com"
        exit 1
    fi
    echo "✅ 依赖安装成功"
else
    echo "✅ node_modules 已存在，跳过安装"
fi

echo ""
echo "🔍 Step 2: 验证依赖安装..."
echo "-----------------------------------------"
npm ls --depth=0 2>&1 | head -10

echo ""
echo "🗄️  Step 3: 确保 data 目录存在..."
echo "-----------------------------------------"
mkdir -p data
echo "✅ data 目录已准备"

echo ""
echo "🧪 Step 4: 运行代码验证..."
echo "-----------------------------------------"
node verify.js
if [ $? -ne 0 ]; then
    echo "❌ 代码验证失败"
    exit 1
fi

echo ""
echo "========================================="
echo "✅ 前置检查全部通过！"
echo "========================================="
echo ""
echo "🚀 现在启动服务..."
echo "   服务地址: http://localhost:3000"
echo "   健康检查: http://localhost:3000/api/health"
echo ""
echo "💡 提示: 保持此窗口打开，服务在前台运行"
echo "   新开一个终端窗口执行以下命令进行 API 测试:"
echo "   cd $PROJECT_DIR && bash test-api.sh"
echo ""
echo "⏹️  按 Ctrl+C 停止服务"
echo "========================================="
echo ""

npm start
