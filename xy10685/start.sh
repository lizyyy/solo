#!/bin/bash

echo "🚀 疫苗冷柜盘点冻结系统启动中..."

echo "📦 检查依赖..."
if [ ! -d "node_modules" ]; then
    npm install
fi

echo "🗄️  初始化数据库..."
node server/database/init.js

echo "🌱  生成样例数据..."
node server/database/seed.js

echo "🌐  启动服务器..."
node server/index.js
