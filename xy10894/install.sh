#!/bin/bash
set -e

echo "=== 安装根目录依赖 ==="
cd /Users/mac/pro/solo/workspaces/xy10894
npm install

echo ""
echo "=== 安装后端依赖 ==="
cd /Users/mac/pro/solo/workspaces/xy10894/backend
npm install

echo ""
echo "=== 安装前端依赖 ==="
cd /Users/mac/pro/solo/workspaces/xy10894/frontend
npm install

echo ""
echo "=== 所有依赖安装完成 ==="
echo ""
echo "启动项目："
echo "  cd /Users/mac/pro/solo/workspaces/xy10894"
echo "  npm run dev"
