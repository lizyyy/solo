#!/bin/bash

echo "=== 会员积分账本前端 启动脚本 ==="

if [ ! -d "node_modules" ]; then
    echo "安装依赖..."
    npm install
fi

echo "启动开发服务器..."
npm run dev
