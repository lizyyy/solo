@echo off
chcp 65001 >nul
echo =============================================
echo     水站桶押金流转API服务启动脚本
echo =============================================

echo.
echo 1. 创建必要的目录...
if not exist "db" mkdir db
if not exist "exports" mkdir exports
if not exist "src\models" mkdir src\models
if not exist "src\controllers" mkdir src\controllers
if not exist "src\routes" mkdir src\routes
if not exist "src\services" mkdir src\services
if not exist "src\middleware" mkdir src\middleware
if not exist "scripts" mkdir scripts
echo    目录创建完成

echo.
echo 2. 检查 Node.js 环境...
node -v >nul 2>&1
if errorlevel 1 (
    echo    错误: 未找到 Node.js，请先安装 Node.js
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do echo    Node.js 版本: %%i

echo.
echo 3. 安装项目依赖...
call npm install
if errorlevel 1 (
    echo    依赖安装失败，请检查网络或 npm 配置
    pause
    exit /b 1
)
echo    依赖安装完成

echo.
echo 4. 初始化数据库...
call npm run init-db
if errorlevel 1 (
    echo    数据库初始化失败
    pause
    exit /b 1
)
echo    数据库初始化完成

echo.
echo 5. 导入样例数据...
call npm run seed-data
if errorlevel 1 (
    echo    样例数据导入失败
    pause
    exit /b 1
)
echo    样例数据导入完成

echo.
echo =============================================
echo     启动服务...
echo =============================================
echo.
echo 服务地址: http://localhost:3000
echo 健康检查: http://localhost:3000/api/health
echo.
echo 按 Ctrl+C 停止服务
echo.

call npm start
pause
