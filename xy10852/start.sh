#!/bin/bash
# 通知偏好系统启动脚本

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "========================================"
echo "  通知偏好系统 - 启动脚本"
echo "========================================"

# 检查Python环境
check_python() {
    echo -n "检查Python环境..."
    if command -v python3 &> /dev/null; then
        echo " ✓"
        return 0
    else
        echo " ✗"
        echo "错误: 未找到Python3，请先安装Python"
        exit 1
    fi
}

# 检查Node环境
check_node() {
    echo -n "检查Node环境..."
    if command -v node &> /dev/null && command -v npm &> /dev/null; then
        echo " ✓"
        return 0
    else
        echo " ✗"
        echo "警告: 未找到Node/npm，前端功能将不可用"
        return 1
    fi
}

# 安装后端依赖
install_backend_deps() {
    echo -n "安装后端依赖..."
    cd "$PROJECT_ROOT/backend"
    if [ ! -d "venv" ]; then
        python3 -m venv venv
    fi
    source venv/bin/activate
    pip install -q -r requirements.txt 2>/dev/null || true
    echo " ✓"
}

# 安装前端依赖
install_frontend_deps() {
    echo -n "安装前端依赖..."
    cd "$PROJECT_ROOT/frontend"
    if [ ! -d "node_modules" ]; then
        npm install --silent 2>/dev/null || true
    fi
    echo " ✓"
}

# 运行核心规则测试
run_tests() {
    echo ""
    echo "运行核心规则测试..."
    cd "$PROJECT_ROOT/backend"
    source venv/bin/activate
    cd "$PROJECT_ROOT"
    python3 tests/test_core_rules.py
}

# 启动后端
start_backend() {
    echo ""
    echo "启动后端服务 (端口: 8000)"
    cd "$PROJECT_ROOT/backend"
    source venv/bin/activate
    
    # 静默启动，重定向输出
    uvicorn main:app --host 0.0.0.0 --port 8000 --log-level warning >/tmp/backend.log 2>&1 &
    BACKEND_PID=$!
    
    # 等待更长时间确保启动
    sleep 3
    
    # 检查进程是否存在
    if kill -0 $BACKEND_PID 2>/dev/null; then
        echo "✓ 后端服务启动成功: http://localhost:8000"
        echo "  API文档: http://localhost:8000/docs"
        echo $BACKEND_PID
        return 0
    else
        echo "✗ 后端服务启动失败"
        echo "  日志: /tmp/backend.log"
        cat /tmp/backend.log 2>/dev/null || true
        return 1
    fi
}

# 启动前端
start_frontend() {
    echo ""
    echo "启动前端服务 (端口: 3000)"
    cd "$PROJECT_ROOT/frontend"
    
    # 静默启动，重定向输出
    npm run dev >/tmp/frontend.log 2>&1 &
    FRONTEND_PID=$!
    
    # 等待更长时间确保启动
    sleep 4
    
    # 检查进程是否存在
    if kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "✓ 前端服务启动成功: http://localhost:3000"
        echo $FRONTEND_PID
        return 0
    else
        echo "✗ 前端服务启动失败"
        echo "  日志: /tmp/frontend.log"
        cat /tmp/frontend.log 2>/dev/null || true
        echo "  继续运行后端服务..."
        return 0  # 前端失败不终止整个系统
    fi
}

# 清理函数
cleanup() {
    echo ""
    echo "正在停止服务..."
    if [ -n "$BACKEND_PID" ]; then
        kill $BACKEND_PID 2>/dev/null || true
    fi
    if [ -n "$FRONTEND_PID" ]; then
        kill $FRONTEND_PID 2>/dev/null || true
    fi
    echo "服务已停止"
    exit 0
}

# 主函数
main() {
    echo ""
    check_python
    NODE_AVAILABLE=0
    if check_node; then
        NODE_AVAILABLE=1
    fi
    
    echo ""
    echo "安装依赖..."
    install_backend_deps
    if [ $NODE_AVAILABLE -eq 1 ]; then
        install_frontend_deps
    fi
    
    # 运行测试
    run_tests || true  # 测试失败不终止启动
    
    # 启动服务
    echo ""
    echo "========================================"
    echo "  启动服务"
    echo "========================================"
    
    # 使用临时文件存储 PID，避免命令替换的 set -e 问题
    BACKEND_PID_FILE=$(mktemp)
    start_backend >"$BACKEND_PID_FILE" || true
    BACKEND_PID=$(cat "$BACKEND_PID_FILE" | tail -n 1 | grep -E '^[0-9]+$' || echo "")
    rm -f "$BACKEND_PID_FILE"
    
    FRONTEND_PID=""
    if [ $NODE_AVAILABLE -eq 1 ]; then
        FRONTEND_PID_FILE=$(mktemp)
        start_frontend >"$FRONTEND_PID_FILE" || true
        FRONTEND_PID=$(cat "$FRONTEND_PID_FILE" | tail -n 1 | grep -E '^[0-9]+$' || echo "")
        rm -f "$FRONTEND_PID_FILE"
    else
        echo "跳过前端服务 (Node未安装)"
    fi
    
    # 确保后端至少是运行的
    if [ -z "$BACKEND_PID" ] || ! kill -0 $BACKEND_PID 2>/dev/null; then
        echo ""
        echo "✗ 错误: 后端服务未能成功启动"
        exit 1
    fi
    
    # 设置陷阱
    trap cleanup SIGINT SIGTERM
    
    echo ""
    echo "========================================"
    echo "  系统已启动!"
    echo "========================================"
    echo "  后端API: http://localhost:8000"
    echo "  API文档: http://localhost:8000/docs"
    if [ -n "$FRONTEND_PID" ] && kill -0 $FRONTEND_PID 2>/dev/null; then
        echo "  前端界面: http://localhost:3000"
    fi
    echo ""
    echo "  按 Ctrl+C 停止服务"
    echo "========================================"
    echo ""
    
    # 等待
    wait
}

# 仅测试模式
test_only() {
    check_python
    install_backend_deps
    run_tests
}

# 显示帮助
show_help() {
    echo "用法: $0 [选项]"
    echo ""
    echo "选项:"
    echo "  start    启动完整系统 (默认)"
    echo "  test     仅运行核心规则测试"
    echo "  backend  仅启动后端服务"
    echo "  frontend 仅启动前端服务"
    echo "  help     显示帮助"
    echo ""
    echo "示例:"
    echo "  $0          # 启动完整系统"
    echo "  $0 test     # 运行测试"
}

# 命令处理
case "${1:-start}" in
    start)
        main
        ;;
    test)
        test_only
        ;;
    backend)
        check_python
        install_backend_deps
        run_tests || true
        start_backend
        wait
        ;;
    frontend)
        check_node || exit 1
        install_frontend_deps
        start_frontend
        wait
        ;;
    help|--help|-h)
        show_help
        ;;
    *)
        echo "未知命令: $1"
        show_help
        exit 1
        ;;
esac
