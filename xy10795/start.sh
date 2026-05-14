#!/bin/bash

echo "启动项目风险周报生成器..."

echo "1. 启动后端服务..."
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000 &

echo "2. 启动前端服务..."
cd ../frontend
npm install
npm run dev &

echo "服务启动完成！"
echo "后端API: http://localhost:8000"
echo "前端页面: http://localhost:3000"
echo "API文档: http://localhost:8000/docs"
