#!/bin/bash

echo "==================================="
echo "  机器学习建模对比台"
echo "==================================="
echo ""

# 检查是否有虚拟环境
if [ -d "venv" ]; then
    echo "检测到虚拟环境，正在激活..."
    source venv/bin/activate
else
    echo "未检测到虚拟环境，使用系统 Python..."
fi

# 检查依赖
echo "检查依赖..."
python -c "import flask, pandas, sklearn, xgboost" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "安装依赖..."
    pip install -r requirements.txt
fi

echo ""
echo "启动服务..."
echo "服务地址: http://localhost:5000"
echo ""
echo "示例数据位置:"
echo "  - 回归任务: sample_data/regression_sample.csv"
echo "  - 分类任务: sample_data/classification_sample.csv"
echo ""
echo "按 Ctrl+C 停止服务"
echo "==================================="

python app.py
