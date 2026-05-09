#!/bin/bash

set -e

echo "=== 客服跟进系统启动脚本 ==="
echo ""

if [ ! -d "node_modules" ]; then
  echo "正在安装根目录依赖..."
  npm install
fi

echo ""
echo "正在安装后端依赖..."
cd backend
if [ ! -d "node_modules" ]; then
  npm install
fi

if [ ! -f ".env" ]; then
  echo "正在创建后端环境配置..."
  cp .env.example .env
fi

echo ""
echo "正在安装前端依赖..."
cd ../frontend
if [ ! -d "node_modules" ]; then
  npm install
fi

cd ..

echo ""
echo "=== 依赖安装完成 ==="
echo ""
echo "=== 下一步操作 ==="
echo ""
echo "1. 确保 PostgreSQL 和 Redis 正在运行"
echo "   - PostgreSQL: 默认端口 5432"
echo "   - Redis: 默认端口 6379"
echo ""
echo "2. 配置数据库连接（如果需要修改）"
echo "   - 编辑 backend/.env 中的 DATABASE_URL"
echo ""
echo "3. 初始化数据库"
echo "   cd backend && npm run db:generate"
echo "   cd backend && npm run db:migrate"
echo "   cd backend && npm run db:seed"
echo ""
echo "4. 启动开发服务器"
echo "   npm run dev"
echo ""
echo "   - 后端将在 http://localhost:3001 运行"
echo "   - 前端将在 http://localhost:5173 运行"
echo ""
echo "5. 测试账号"
echo "   - 管理员: admin@example.com / password123"
echo "   - 客服: agent1@example.com / password123"
echo "   - 客服: agent2@example.com / password123"
echo ""