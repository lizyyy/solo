#!/bin/bash

echo "===================================="
echo "客服补发跟进系统 - 启动脚本"
echo "===================================="
echo ""

MODE=${1:-"dev"}

echo "选择模式: $MODE"
echo ""

if [ "$MODE" = "docker" ]; then
    echo "启动 Docker 模式..."
    echo ""
    
    if ! command -v docker &> /dev/null; then
        echo "❌ Docker 未安装，请先安装 Docker"
        exit 1
    fi
    
    echo "1/4 启动 PostgreSQL..."
    docker-compose up -d db
    
    echo "2/4 等待数据库就绪..."
    sleep 15
    
    echo "3/4 安装依赖..."
    pip3 install -q -r requirements.txt
    
    echo "4/4 初始化种子数据..."
    python3 seeds.py
    
    echo ""
    echo "✅ PostgreSQL 已启动"
    echo "✅ 数据已初始化"
    echo ""
    echo "启动服务: uvicorn app.main:app --reload"
    echo ""
    echo "访问:"
    echo "  API 文档: http://localhost:8000/docs"
    echo "  pgAdmin:  http://localhost:5050 (admin@example.com / admin123)"
    
elif [ "$MODE" = "dev" ]; then
    echo "启动开发模式（使用 SQLite）..."
    echo ""
    
    echo "1/3 安装依赖..."
    pip3 install -q -r requirements.txt
    
    echo "2/3 使用 SQLite 数据库"
    export DATABASE_URL="sqlite:///./reissue_tracker.db"
    
    echo "3/3 初始化种子数据..."
    python3 seeds.py
    
    echo ""
    echo "✅ 依赖已安装"
    echo "✅ SQLite 数据库已初始化"
    echo ""
    echo "🚀 启动服务:"
    echo "  uvicorn app.main:app --reload"
    echo ""
    echo "访问:"
    echo "  API 文档: http://localhost:8000/docs"
    echo ""
    echo "默认账号:"
    echo "  admin    / admin123    (管理员)"
    echo "  manager  / manager123  (经理)"
    echo "  cs01     / cs123456    (客服)"
    echo "  cs02     / cs123456    (客服)"
    echo "  operator01 / op123456  (运营)"
    
else
    echo "使用方法:"
    echo "  $0 dev      - 开发模式（SQLite，最简单）"
    echo "  $0 docker   - Docker 模式（PostgreSQL）"
    echo ""
    echo "示例:"
    echo "  bash start.sh dev"
fi
