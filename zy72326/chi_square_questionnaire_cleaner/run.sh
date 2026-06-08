#!/bin/bash
# 快速启动卡方检验问卷清洗 Web 交互计算器
set -e
cd "$(dirname "$0")"

PORT="${PORT:-5001}"

if ! python3 -c "import flask" 2>/dev/null; then
  echo "[1/2] 检测到 Flask 未安装，正在安装依赖（requirements.txt）..."
  python3 -m pip install -r requirements.txt
fi

echo "[2/2] 启动 Web 交互计算器：http://127.0.0.1:${PORT}/"
python3 app.py
