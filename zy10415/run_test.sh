#!/bin/bash

echo "=========================================="
echo "  翻译记忆版本API - 验收测试"
echo "=========================================="
echo ""

echo "请确保服务已在 http://localhost:8000 启动"
echo ""
echo "按任意键继续..."
read -n 1

echo ""
echo "运行验收测试..."
echo ""

python3 test_sample.py