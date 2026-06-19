#!/usr/bin/env bash
# 机械表摆轮误差系统 - 端到端验证脚本
# 用法：./run_e2e.sh
set -e

cd "$(dirname "$0")"
echo "▶ 进入目录: $(pwd)"
echo "▶ 运行端到端验证（examples/e2e_verification.py）"
echo ""
PYTHONPATH=. python3 examples/e2e_verification.py
