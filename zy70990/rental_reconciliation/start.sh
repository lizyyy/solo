#!/bin/bash

# 短租对账服务启动脚本

echo "========================================="
echo "    短租运营对账服务 - 启动脚本"
echo "========================================="
echo ""

# 检查 Python 是否安装
if ! command -v python3 &> /dev/null; then
    echo "错误: 未检测到 Python3，请先安装 Python3"
    exit 1
fi

# 创建虚拟环境
if [ ! -d "venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
fi

# 激活虚拟环境
source venv/bin/activate

# 安装依赖
echo "安装依赖包..."
pip install -r requirements.txt -q

# 创建必要目录
mkdir -p uploads exports

# 初始化数据库
echo "初始化数据库..."
python3 -c "
from app.database import Base, engine
Base.metadata.create_all(bind=engine)
print('数据库初始化完成')
"

# 启动服务
echo ""
echo "========================================="
echo "  服务已启动，访问 http://localhost:8000"
echo "  API文档: http://localhost:8000/docs"
echo "  按 Ctrl+C 停止服务"
echo "========================================="
echo ""

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload