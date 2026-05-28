#!/bin/bash
# 启动Web界面脚本

echo "🎵 音乐音频片段谱聚类系统"
echo "================================"

# 检查虚拟环境
if [ -d "venv" ]; then
    source venv/bin/activate
fi

# 检查依赖
if ! python -c "import librosa, sklearn, flask" 2>/dev/null; then
    echo "📦 安装依赖..."
    pip install -r requirements.txt
fi

# 启动Web服务
echo "🌐 启动Web界面: http://localhost:5000"
echo "   按 Ctrl+C 停止"
echo ""

python cli.py web --port 5000
