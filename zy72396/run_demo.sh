#!/usr/bin/env bash
# 机械表摆轮误差系统 - 便捷启动脚本
# 用法：./run_demo.sh
set -e

cd "$(dirname "$0")"
echo "▶ 进入目录: $(pwd)"
echo "▶ 运行主演示（examples/demo.py）"
echo ""
PYTHONPATH=. python3 examples/demo.py
