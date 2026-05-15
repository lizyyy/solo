#!/bin/bash
echo "============================================================"
echo "     业务事件重算 API - 服务启动脚本"
echo "============================================================"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

# 检查 Python3
if ! command -v python3 &> /dev/null; then
    echo "❌ 未找到 python3，请先安装 Python 3"
    exit 1
fi
echo "✅ Python 3 已找到: $(python3 --version)"

# 检查 pip3
if ! command -v pip3 &> /dev/null; then
    echo "❌ 未找到 pip3，请先安装 pip3"
    exit 1
fi

# 检查并安装 Flask
if ! python3 -c "import flask" 2>/dev/null; then
    echo "📦 Flask 未安装，正在安装..."
    pip3 install flask
    if [ $? -ne 0 ]; then
        echo "❌ Flask 安装失败"
        exit 1
    fi
    echo "✅ Flask 安装成功"
else
    echo "✅ Flask 已安装"
fi
echo ""

# 启动服务器
echo "🚀 启动业务事件重算 API 服务器..."
echo "   服务器将在后台运行，端口: 8080"
echo "   日志文件: recalculate_api.log"
echo ""

# 先杀掉可能存在的旧进程
pkill -f "recalculate_api_server.py" 2>/dev/null || true
sleep 1

nohup python3 recalculate_api_server.py > recalculate_api.log 2>&1 &
SERVER_PID=$!

echo "✅ 服务器已启动，PID: ${SERVER_PID}"
echo ""
echo "⏳ 等待服务器就绪..."
for i in {1..30}; do
    if curl -s http://localhost:8080/health > /dev/null 2>&1; then
        echo "✅ 服务器已就绪！"
        break
    fi
    sleep 1
done

echo ""
echo "============================================================"
echo "                    服务已启动"
echo "============================================================"
echo "  服务地址:    http://localhost:8080"
echo "  健康检查:    http://localhost:8080/health"
echo "  进程 PID:    ${SERVER_PID}"
echo "  日志文件:    recalculate_api.log"
echo ""
echo "  运行测试:    bash test-recalculate-api.sh"
echo "  停止服务:    kill ${SERVER_PID}"
echo "============================================================"
