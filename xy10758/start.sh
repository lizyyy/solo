#!/bin/bash

echo "====================================="
echo "订阅续费失败补偿系统"
echo "====================================="
echo ""

echo "📦 安装依赖..."
pip3 install -r requirements.txt

echo ""
echo "🚀 启动服务..."
echo "📊 后端服务将在 http://localhost:5000 启动"
echo "📝 然后请运行 'python3 sample_data.py' 导入样例数据"
echo ""

python3 app.py
