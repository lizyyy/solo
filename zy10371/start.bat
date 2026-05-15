@echo off
chcp 65001 > nul
echo =====================================
echo   敏感操作双人确认API - 启动脚本
echo =====================================
echo.

REM 检查Java版本
echo 检查Java环境...
java -version > nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到Java命令，请先安装JDK 8或更高版本
    pause
    exit /b 1
)

for /f tokens^=2^ delims^=.-_^" %%j in ('java -version 2^>^&1 ^| findstr /i "version"') do set "JAVA_VERSION=%%j"
echo ✅ Java版本: 1.%JAVA_VERSION%
echo.

REM 检查是否有预编译的JAR包
if exist "target\dual-confirmation-api-1.0.0.jar" (
    echo 找到预编译的JAR包，直接启动...
    java -jar target\dual-confirmation-api-1.0.0.jar
    exit /b 0
)

REM 检查Maven Wrapper
if exist "mvnw.cmd" (
    echo 使用Maven Wrapper编译并启动...
    call mvnw.cmd clean package -DskipTests
    if %errorlevel% equ 0 (
        echo.
        echo 编译成功，启动应用...
        java -jar target\dual-confirmation-api-1.0.0.jar
    ) else (
        echo ❌ 编译失败，请检查错误信息
        pause
        exit /b 1
    )
) else (
    echo ❌ 未找到mvnw.cmd脚本，请确保项目完整
    pause
    exit /b 1
)
