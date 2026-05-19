@echo off
echo === 供应商目录映射系统启动脚本 (Windows) ===

echo 1. 启动后端服务...
cd backend
if not exist "venv" (
    echo 创建 Python 虚拟环境...
    python -m venv venv
)

call venv\Scripts\activate.bat

echo 安装 Python 依赖...
pip install -r requirements.txt -q

echo 后端服务启动中 (http://localhost:8000)...
start /B uvicorn app.main:app --host 0.0.0.0 --port 8000

echo.
echo 2. 启动前端服务...
cd ..\frontend

echo 安装 Node 依赖...
npm install -q

echo 前端服务启动中 (http://localhost:3000)...
start /B npm run dev

echo.
echo === 服务启动完成 ===
echo 后端 API: http://localhost:8000
echo API 文档: http://localhost:8000/docs
echo 前端界面: http://localhost:3000
echo.
pause