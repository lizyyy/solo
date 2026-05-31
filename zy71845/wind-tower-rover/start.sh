#!/bin/bash
echo "===================================="
echo "  风电场塔筒漫游 - 启动本地服务"
echo "===================================="
echo ""
echo "正在启动 HTTP 服务 (端口 8080)..."
echo "启动后请在浏览器打开: http://localhost:8080"
echo "按 Ctrl+C 停止服务"
echo ""
cd "$(dirname "$0")"
python3 -m http.server 8080
