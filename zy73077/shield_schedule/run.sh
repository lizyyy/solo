#!/bin/bash
cd "$(dirname "$0")"
echo "🚀 盾构刀盘备件排程系统"
echo "================================"
if [ ! -d "venv" ]; then
  echo "📦 创建虚拟环境..."
  python3 -m venv venv
fi
source venv/bin/activate
echo "🔧 安装依赖..."
pip install -q flask 2>/dev/null || pip install flask
if [ ! -f "data/sample_input.json" ]; then
  echo "🧪 生成样例数据..."
  python3 seed_samples.py
fi
echo ""
echo "✅ 启动服务中... 浏览器打开 http://localhost:5001"
echo "   Ctrl+C 停止"
echo ""
python3 app.py
