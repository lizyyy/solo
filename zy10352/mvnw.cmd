@echo off
REM Maven Wrapper 简化版
REM 如果系统有 mvn 则直接使用，否则提示安装

REM 检查系统是否有 mvn
where mvn >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    mvn %*
    goto end
)

REM 如果没有 mvn，显示错误提示
echo ========================================
echo Maven Wrapper - Maven 未找到
echo ========================================
echo.
echo 错误：系统未安装 Maven！
echo.
echo 请使用以下方式之一安装：
echo.
echo 1) Windows (使用 Chocolatey):
echo    choco install maven
echo.
echo 2) Windows (使用 Scoop):
echo    scoop install maven
echo.
echo 3) 手动下载:
echo    https://maven.apache.org/download.cgi
echo.
echo 安装后再次运行此脚本。
echo.
echo 或者使用项目启动脚本:
echo    start.bat build
echo.
goto end

:end
