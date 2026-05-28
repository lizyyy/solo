#!/bin/bash

echo "========================================"
echo "  信用证单据不符API - 启动脚本"
echo "========================================"
echo ""

echo "📦 检查并安装依赖..."
pip3 install -r requirements.txt -q

if [ $? -ne 0 ]; then
    echo "❌ 依赖安装失败"
    exit 1
fi

echo "✅ 依赖安装完成"
echo ""

echo "🧪 运行完整测试..."
python3 test_full_workflow.py

TEST_RESULT=$?
echo ""

if [ $TEST_RESULT -eq 0 ]; then
    echo "✅ 所有测试通过！"
    echo ""
    echo "🚀 启动API服务..."
    echo ""
    echo "📖 在线文档: http://localhost:8000/docs"
    echo "📖 备选文档: http://localhost:8000/redoc"
    echo ""
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
else
    echo "❌ 测试失败，请检查错误信息"
    exit 1
fi
