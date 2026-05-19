#!/bin/bash

echo "========================================"
echo "脱敏规则回归差异报告API - 自检脚本"
echo "========================================"

echo ""
echo "检查 Python 环境..."
python3 --version

echo ""
echo "安装依赖..."
pip3 install -r requirements.txt

echo ""
echo "运行自检测试..."
python3 tests/selftest.py
TEST_EXIT_CODE=$?

echo ""
echo "========================================"
if [ $TEST_EXIT_CODE -eq 0 ]; then
    echo "自检通过！"
    echo "启动服务命令: uvicorn app.main:app --reload --host 0.0.0.0 --port 8000"
else
    echo "自检失败！请检查错误信息。"
    echo "退出码: $TEST_EXIT_CODE"
fi
echo "========================================"

exit $TEST_EXIT_CODE
