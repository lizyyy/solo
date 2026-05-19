#!/bin/bash
echo "启动简历解析复核系统后端服务..."
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
