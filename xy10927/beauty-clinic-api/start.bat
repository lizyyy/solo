@echo off
chcp 65001 >nul
echo =====================================
echo 美容院疗程核销API服务启动脚本
echo =====================================
echo.

echo 1. 检查并安装依赖...
if not exist "node_modules" (
    call npm install
) else (
    echo 依赖已存在，跳过安装
)

echo.
echo 2. 初始化数据库...
call node src/scripts/initDB.js

echo.
echo 3. 导入样例数据...
call node src/scripts/sampleData.js

echo.
echo 4. 启动API服务...
echo.
echo 服务将在 http://localhost:3000 启动
echo 按 Ctrl+C 停止服务
echo.
echo =====================================
echo.

call npm start

pause
