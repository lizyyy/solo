#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR"

cd "$ROOT_DIR"

echo "=========================================="
echo "  幕墙节点碰撞预审系统 · 一键启动"
echo "=========================================="
echo ""

BACKEND_PID=""
FRONTEND_PID=""

cleanup() {
    echo ""
    echo "正在停止服务..."
    if [ -n "$BACKEND_PID" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID" 2>/dev/null || true
        echo "  ✓ 后端已停止"
    fi
    if [ -n "$FRONTEND_PID" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null || true
        echo "  ✓ 前端已停止"
    fi
    echo ""
    echo "所有服务已停止。"
    exit 0
}
trap cleanup INT TERM

PYTHON_BIN=""
if command -v python3 &>/dev/null; then
    PYTHON_BIN="python3"
elif command -v python &>/dev/null; then
    PYTHON_BIN="python"
else
    echo "✗ 未找到 Python，请先安装 Python 3.8+"
    exit 1
fi

echo "[1/5] 检查后端依赖..."
if [ ! -d "$BACKEND_DIR/venv" ] && [ -z "$VIRTUAL_ENV" ]; then
    echo "  正在安装后端依赖..."
    cd "$BACKEND_DIR"
    $PYTHON_BIN -m pip install -q -r requirements.txt
    echo "  ✓ 后端依赖安装完成"
else
    echo "  ✓ 后端环境已就绪"
fi
cd "$ROOT_DIR"

echo ""
echo "[2/5] 检查前端依赖..."
if [ ! -d "node_modules" ]; then
    echo "  正在安装前端依赖..."
    npm install --silent
    echo "  ✓ 前端依赖安装完成"
else
    echo "  ✓ 前端环境已就绪"
fi

echo ""
echo "[3/5] 初始化数据库..."
cd "$BACKEND_DIR"
$PYTHON_BIN -c "
from app.database import engine, Base, DB_PATH
from app.models import CollisionRecord, CollisionHistory
from app.seed import seed_database
Base.metadata.create_all(bind=engine)
seed_database()
print(f'  ✓ 数据库已就绪: {DB_PATH}')
"
cd "$ROOT_DIR"

echo ""
echo "[4/5] 启动后端服务 (端口 8000)..."
cd "$BACKEND_DIR"
$PYTHON_BIN -m uvicorn app.main:app --host 0.0.0.0 --port 8000 &
BACKEND_PID=$!
sleep 2
if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo "  ✗ 后端启动失败"
    exit 1
fi
echo "  ✓ 后端已启动: http://localhost:8000"
cd "$ROOT_DIR"

echo ""
echo "[5/5] 启动前端服务..."
npm run dev -- --host 0.0.0.0 --port 5173 > /tmp/vite.log 2>&1 &
FRONTEND_PID=$!
sleep 3
if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo "  ✗ 前端启动失败，日志："
    cat /tmp/vite.log
    exit 1
fi
FRONTEND_PORT=$(grep -oE 'localhost:[0-9]+' /tmp/vite.log | head -1 | grep -oE '[0-9]+$' || echo "5173")
echo "  ✓ 前端已启动: http://localhost:$FRONTEND_PORT"

echo ""
echo "=========================================="
echo "  🎉 全部服务启动成功！"
echo ""
echo "  前端页面:  http://localhost:$FRONTEND_PORT"
echo "  后端 API:  http://localhost:8000/api/collisions"
echo "  数据库:    backend/data/curtain_wall.db"
echo ""
echo "  按 Ctrl+C 停止所有服务"
echo "=========================================="
echo ""

while true; do
    sleep 1
done
