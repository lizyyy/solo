#!/bin/bash

# 便利店鲜食报废预测器 - 一键演示脚本

echo "============================================"
echo " 🏪 便利店鲜食报废预测器 - 一键演示"
echo "============================================"
echo ""

# 检查Python是否安装
if ! command -v python3 &> /dev/null; then
    echo "❌ 错误：未检测到Python3，请先安装Python 3.8或更高版本"
    exit 1
fi

echo "📋 步骤1：安装依赖..."
pip3 install -r requirements.txt -q

if [ $? -ne 0 ]; then
    echo "⚠️  依赖安装失败，尝试使用国内镜像..."
    pip3 install -r requirements.txt -i https://pypi.tuna.tsinghua.edu.cn/simple -q
fi

echo "✅ 依赖安装完成"
echo ""

echo "🚀 步骤2：运行完整演示..."
echo ""

python3 main.py --mode demo

if [ $? -ne 0 ]; then
    echo "❌ 演示运行失败，请检查错误信息"
    exit 1
fi

echo ""
echo "============================================"
echo " ✅ 演示完成！"
echo "============================================"
echo ""
echo "📄 报告已保存到：results/prediction_report.txt"
echo ""
echo "🔍 查看报告请运行：cat results/prediction_report.txt"
echo ""
