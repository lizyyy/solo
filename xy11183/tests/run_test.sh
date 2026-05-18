#!/bin/bash

echo "========================================"
echo "  汽车试驾中心试驾里程审计 - 测试脚本"
echo "========================================"
echo ""

cd "$(dirname "$0")/.."

echo "[测试1: 审计正常文件"
echo "-------------------------"
python3 src/drive_audit.py -i input/normal/
echo ""
echo "✓ 正常文件测试完成"
echo ""

echo "[测试2: 审计问题文件"
echo "-------------------------"
python3 src/drive_audit.py -i input/bad/
echo ""
echo "✓ 问题文件测试完成"
echo ""

echo "[测试3: 完整审计所有文件"
echo "-------------------------"
python3 src/drive_audit.py -i input/
echo ""
echo "✓ 完整审计测试完成"
echo ""

echo "========================================"
echo "  所有测试完成！请查看 output/ 目录下的审计报告"
echo "========================================"
echo ""
echo "生成的文件列表："
ls -la output/
