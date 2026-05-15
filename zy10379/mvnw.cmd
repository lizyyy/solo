@echo off
setlocal enabledelayedexpansion

REM Maven Wrapper for Windows
REM 允许在没有全局安装 Maven 的情况下运行 Maven

echo ========================================
echo   Service Token Exchange - Maven Run
echo ========================================
echo.

REM 检测 Maven
where mvn >nul 2>&1
if %ERRORLEVEL% equ 0 (
    echo [OK] 检测到系统 Maven
    echo.
    mvn %*
) else (
    echo [WARN] 未检测到全局 Maven，请检查:
    echo.
    echo   1. 是否安装了 Maven (https://maven.apache.org/install.html)
    echo   2. 是否配置了 MAVEN_HOME 和 PATH 环境变量
    echo   3. 或使用 IDE (IntelliJ IDEA, Eclipse) 直接打开项目
    echo.
    echo 或使用 IDE 直接打开项目运行 TokenExchangeApplication.java
    exit /b 1
)

endlocal
