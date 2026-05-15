@echo off
chcp 65001 >nul
echo ==========================================
echo   数据修复脚本审批API - 启动脚本
echo ==========================================
echo.

REM 检查Java环境
java -version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到Java，请先安装JDK 11+
    pause
    exit /b 1
)

for /f "tokens=3" %%g in ('java -version 2^>^&1 ^| findstr /i "version"') do (
    set JAVA_VERSION=%%g
)
echo ✅ Java版本: %JAVA_VERSION%

REM 检查Maven环境
mvn -version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ 错误: 未找到Maven，请先安装Maven 3.6+
    pause
    exit /b 1
)

for /f "tokens=3" %%g in ('mvn -version ^| findstr /i "Apache Maven"') do (
    set MAVEN_VERSION=%%g
)
echo ✅ Maven版本: %MAVEN_VERSION%
echo.

REM 设置数据库配置（默认使用H2，无需外部依赖）
set PROFILE=%1
if "%PROFILE%"=="" set PROFILE=h2
echo ▶ 使用环境配置: %PROFILE%
echo.

REM 检查是否存在jar包，不存在则先编译
if not exist "target\data-repair-approval-api-1.0.0-SNAPSHOT.jar" (
    echo ▶ 开始编译项目...
    mvn clean package -DskipTests -q
    if %errorlevel% neq 0 (
        echo ❌ 编译失败，请检查代码
        pause
        exit /b 1
    )
    echo ✅ 编译完成
    echo.
)

REM 启动应用
echo ▶ 启动应用服务 (profile: %PROFILE%)...
echo   API地址: http://localhost:8080/api
echo   H2控制台: http://localhost:8080/api/h2-console (仅h2模式)
echo.
echo   按 Ctrl+C 停止服务
echo ==========================================
echo.

java -jar target\data-repair-approval-api-1.0.0-SNAPSHOT.jar ^
    --spring.profiles.active=%PROFILE%

pause
