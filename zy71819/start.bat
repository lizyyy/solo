@echo off
setlocal

cd /d "%~dp0"

echo ==========================================
echo   票据到期提醒系统
echo ==========================================
echo.

set PYTHON_BIN=python
where python3 >nul 2>nul
if %errorlevel%==0 set PYTHON_BIN=python3

echo 检查依赖...
%PYTHON_BIN% -c "import fastapi, uvicorn, sqlalchemy, pandas, openpyxl" 2>nul || (
    echo 正在安装依赖...
    %PYTHON_BIN% -m pip install fastapi uvicorn sqlalchemy pydantic python-multipart pandas openpyxl xlsxwriter jinja2 python-dateutil
)

echo 创建数据目录...
if not exist "data\uploads" mkdir data\uploads
if not exist "data\exports" mkdir data\exports
if not exist "data\sample_data" mkdir data\sample_data

echo 生成示例数据...
%PYTHON_BIN% scripts\generate_sample_data.py

echo.
echo 启动服务中...
echo ==========================================
echo   服务地址: http://127.0.0.1:8000
echo   API文档:  http://127.0.0.1:8000/docs
echo   按 Ctrl+C 停止服务
echo ==========================================
echo.

%PYTHON_BIN% main.py

pause
