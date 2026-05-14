#!/bin/bash

echo "=== 启动API性能压测面板前端 ==="

cd frontend

echo "安装依赖..."
npm install

echo "启动Vue开发服务器..."
npm run serve