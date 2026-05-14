#!/bin/bash
echo "安装依赖..."
pip install -r requirements.txt

echo ""
echo "启动推荐规则调试台..."
echo "请在浏览器中访问: http://localhost:5000"
echo ""

python app.py
