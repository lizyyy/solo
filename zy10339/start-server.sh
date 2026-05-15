#!/bin/bash
# 资源锁冲突解释 API - Python HTTP 服务器启动脚本

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "============================================================"
echo "  \U0001F512 资源锁冲突解释 API - Python HTTP 服务器版本"
echo "  \u2728 零依赖！Python 3 标准库，直接运行"
echo "============================================================"
echo ""
echo "[1/2] 检查Python环境..."

if ! command -v python3 &> /dev/null; then
    echo "❌ 未找到 python3，请先安装 Python 3"
    exit 1
fi

PYTHON_VERSION=$(python3 --version)
echo "✅ Python版本: $PYTHON_VERSION"
echo ""

echo "[2/2] 启动HTTP服务器..."
echo "  服务地址: http://localhost:8080"
echo "  管理界面: http://localhost:8080/"
echo ""
echo "  按 Ctrl+C 停止服务"
echo "============================================================"
echo ""

cd "$SCRIPT_DIR"
python3 lock-server.py
