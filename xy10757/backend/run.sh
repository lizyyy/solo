#!/bin/bash

echo "=== 会员积分账本API 启动脚本 ==="

if [ ! -d "venv" ]; then
    echo "创建虚拟环境..."
    python3 -m venv venv
fi

echo "激活虚拟环境..."
source venv/bin/activate

echo "安装依赖..."
pip install -r requirements.txt

if [ ! -f "points_ledger.db" ]; then
    echo "初始化数据库..."
    python -c "from app.core.database import engine, Base; from app.models.models import PointBatch, FrozenBalance, PointTransaction, BalanceSnapshot, ReviewRecord; Base.metadata.create_all(bind=engine)"
    echo "初始化示例数据..."
    python init_data.py
fi

echo "启动服务..."
python main.py
