@echo off
chcp 65001 >nul
setlocal

echo ========================================
echo 跨境数据访问审批 API - 启动脚本
echo ========================================

echo.
echo 检查 Java 环境...
java -version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到 Java，请安装 Java 17 或更高版本
    pause
    exit /b 1
)

for /f tokens^=2^ delims^=^" %%a in ('java -version 2^>^&1 ^| findstr /i "version"') do (
    set "JAVA_VERSION=%%a"
)
for /f "delims=. tokens=1" %%a in ("%JAVA_VERSION%") do set JAVA_MAJOR=%%a
echo ✓ Java 版本: %JAVA_MAJOR%

if %JAVA_MAJOR% LSS 8 (
    echo ❌ 错误: 需要 Java 8 或更高版本，当前版本: %JAVA_MAJOR%
    pause
    exit /b 1
)

echo.
echo 准备数据目录...
if not exist "data" mkdir data
echo ✓ 数据目录已就绪

if not exist "target\classes" (
    echo.
    echo 编译项目...
    call mvnw.cmd clean package -DskipTests
)

if not exist "target\*.jar" (
    echo.
    echo 重新编译项目...
    call mvnw.cmd clean package -DskipTests
)

for %%f in (target\*.jar) do (
    set JAR_FILE=%%f
    goto :found
)
:found

echo.
echo 启动应用...
echo ========================================
echo 服务地址: http://localhost:8080
echo H2控制台: http://localhost:8080/h2-console
echo 数据库: jdbc:h2:file:./data/approvaldb
echo ========================================
echo.

java -jar "%JAR_FILE%"

pause
