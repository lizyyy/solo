@echo off
setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0
cd /d "%SCRIPT_DIR%"

echo === 二手车整备重试补偿队列服务 ===
echo.

echo 正在下载依赖...
go mod download

if %errorlevel% neq 0 (
    echo 依赖下载失败
    pause
    exit /b 1
)

echo.
echo 正在编译...
go build -o used-car-retry-queue.exe .

if %errorlevel% neq 0 (
    echo 编译失败
    pause
    exit /b 1
)

echo.
echo 启动服务...
echo 服务地址: http://localhost:8080
echo API文档请查看 API.md
echo.
echo 按 Ctrl+C 停止服务
echo.

used-car-retry-queue.exe

pause
