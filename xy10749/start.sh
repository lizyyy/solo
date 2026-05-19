#!/bin/bash

echo "🚀 启动实时协作文档锁系统"
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查并创建终端启动后端
echo "${GREEN}[1/2]${NC} 启动后端服务 (port 5000)..."
osascript -e 'tell application "Terminal" to do script "cd '"$(pwd)"'/backend && source venv/bin/activate 2>/dev/null || true && pip install -r requirements.txt -q && python app.py"' &

sleep 3

# 检查并创建终端启动前端
echo "${GREEN}[2/2]${NC} 启动前端服务 (port 3000)..."
osascript -e 'tell application "Terminal" to do script "cd '"$(pwd)"'/frontend && npm install -q && npm start"' &

echo ""
echo "✅ 启动命令已发送到新的终端窗口"
echo ""
echo "${YELLOW}📖 使用说明：${NC}"
echo "   - 等待两个服务都启动完成"
echo "   - 浏览器会自动打开 http://localhost:3000"
echo "   - 点击首页的「📦 初始化示例数据」加载演示数据"
echo "   - 查看 README.md 了解更多功能"
echo ""
