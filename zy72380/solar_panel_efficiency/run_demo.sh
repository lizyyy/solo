#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

rm -rf output/*
echo "已清空 output/ 目录，准备重新跑全流程..."
echo ""

python3 scripts/process.py

echo "=============================="
echo "输出文件："
ls -la output/
echo "=============================="
