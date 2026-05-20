@echo off

echo 安装依赖...
pip install -r requirements.txt

echo.
echo 启动服务...
python main.py
