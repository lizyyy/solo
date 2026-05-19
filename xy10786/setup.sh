#!/bin/bash
# 项目快速安装和验证脚本

set -e  # 遇到错误立即退出

echo "========================================"
echo "  内容发布队列系统 - 快速安装脚本"
echo "========================================"
echo ""

# 检查 Node.js 版本
echo "📋 步骤 1/6: 检查 Node.js 版本..."
NODE_VERSION=$(node --version | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 18 ]; then
    echo "❌ 错误: Node.js 版本过低，需要 18.x 或更高版本"
    echo "   当前版本: $(node --version)"
    exit 1
fi
echo "   ✓ Node.js 版本: $(node --version)"
echo "   ✓ npm 版本: $(npm --version)"
echo ""

# 安装后端依赖
echo "📦 步骤 2/6: 安装后端依赖..."
cd server
npm install --silent
if [ $? -eq 0 ]; then
    echo "   ✓ 后端依赖安装完成"
else
    echo "   ❌ 后端依赖安装失败"
    exit 1
fi
cd ..
echo ""

# 安装前端依赖
echo "📦 步骤 3/6: 安装前端依赖..."
cd client
npm install --silent
if [ $? -eq 0 ]; then
    echo "   ✓ 前端依赖安装完成"
else
    echo "   ❌ 前端依赖安装失败"
    exit 1
fi
cd ..
echo ""

# 后端类型检查
echo "🔍 步骤 4/6: 后端类型检查..."
cd server
npm run typecheck
if [ $? -eq 0 ]; then
    echo "   ✓ 后端类型检查通过"
else
    echo "   ❌ 后端类型检查失败"
    exit 1
fi
cd ..
echo ""

# 前端类型检查
echo "🔍 步骤 5/6: 前端类型检查..."
cd client
npm run typecheck
if [ $? -eq 0 ]; then
    echo "   ✓ 前端类型检查通过"
else
    echo "   ❌ 前端类型检查失败"
    exit 1
fi
cd ..
echo ""

# 验证完成
echo "========================================"
echo "  ✅ 安装和验证完成！"
echo "========================================"
echo ""
echo "下一步操作："
echo "  1. 启动后端: npm run dev:server"
echo "     (服务地址: http://localhost:3001)"
echo ""
echo "  2. 启动前端: npm run dev:client"
echo "     (应用地址: http://localhost:3000)"
echo ""
echo "详细文档请查看: INSTALL.md"
echo ""
