@echo off
echo === 依赖破坏提醒系统 - 快速启动 ===
echo.

echo 1. 检查并安装后端依赖...
cd backend
if not exist "node_modules" (
    npm install
)
cd ..

echo.
echo 2. 检查并安装前端依赖...
cd frontend
if not exist "node_modules" (
    npm install
)
cd ..

echo.
echo 3. 请分别在两个终端中运行:
echo    - 后端: cd backend ^&^& npm start
echo    - 前端: cd frontend ^&^& npm start
echo.
pause
