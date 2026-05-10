#!/bin/bash

echo "=========================================="
echo "  实时指标迟到修正服务 - 运行样例"
echo "=========================================="
echo ""

if [ ! -d "venv" ]; then
    echo "错误：未检测到虚拟环境"
    echo "请先运行 ./start_server.sh 安装依赖并启动服务"
    exit 1
fi

source venv/bin/activate

echo "检查服务是否运行..."
response=$(curl -s http://localhost:8000/health 2>/dev/null)
if [ "$response" != '{"status":"healthy"}' ]; then
    echo "错误：服务未运行"
    echo "请在另一个终端运行: ./start_server.sh"
    exit 1
fi

echo "服务运行正常 ✓"
echo ""

echo "运行样例数据脚本..."
echo ""
python3 scripts/init_sample_data.py
