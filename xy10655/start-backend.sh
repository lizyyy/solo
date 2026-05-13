#!/bin/bash
cd backend
echo "安装后端依赖..."
npm install
echo "生成样例数据..."
node sampleData.js
echo "启动后端服务..."
npm start
