#!/bin/bash
cd "$(dirname "$0")"

if command -v python3 &> /dev/null; then
    echo "正在启动本地服务器 (Python 3)..."
    python3 -m http.server 8080
elif command -v python &> /dev/null; then
    echo "正在启动本地服务器 (Python)..."
    python -m SimpleHTTPServer 8080
else
    echo "未检测到 Python，直接使用文件协议打开..."
    if [[ "$OSTYPE" == "darwin"* ]]; then
        open "index.html"
    elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
        xdg-open "index.html"
    else
        start "index.html"
    fi
    exit 0
fi

echo ""
echo "服务器已启动，请在浏览器中访问："
echo "http://localhost:8080"
echo ""
echo "按 Ctrl+C 停止服务器"
