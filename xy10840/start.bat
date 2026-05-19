@echo off
chcp 65001 >nul
echo ========================================
echo   提示词模板审批台 - 启动脚本
echo ========================================
echo.

REM 检查Python是否安装
python --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到 Python，请先安装 Python
    pause
    exit /b 1
)

REM 检查Node.js是否安装
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)

echo ✅ Python 和 Node.js 环境检查通过
echo.

REM 创建必要的目录
if not exist "backend\data" mkdir backend\data
if not exist "backend\exports" mkdir backend\exports

echo 📦 安装后端依赖...
cd backend
pip install -r requirements.txt -q
if errorlevel 1 (
    echo ❌ 后端依赖安装失败
    pause
    exit /b 1
)
echo ✅ 后端依赖安装完成
echo.

echo 📦 安装前端依赖...
cd ..\frontend
npm install --silent
if errorlevel 1 (
    echo ❌ 前端依赖安装失败
    pause
    exit /b 1
)
echo ✅ 前端依赖安装完成
echo.

echo ========================================
echo   启动服务...
echo ========================================
echo.

echo 🚀 启动后端服务 (端口 5000)...
cd ..\backend
start "后端服务" cmd /k "python app.py"

REM 等待后端启动
timeout /t 3 /nobreak >nul

echo 🚀 启动前端服务 (端口 3000)...
cd ..\frontend
start "前端服务" cmd /k "npm run dev"

echo.
echo ========================================
echo   服务启动成功！
echo ========================================
echo.
echo 🌐 前端地址: http://localhost:3000
echo 🔧 后端地址: http://localhost:5000
echo.
echo 请在浏览器中打开前端地址访问应用
echo.
pause
