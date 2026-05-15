@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

echo ========================================
echo 设备命令确认 API - 启动脚本 (Windows)
echo ========================================

set PROJECT_DIR=%~dp0
set MAVEN_VERSION=3.8.8
set MAVEN_DIR=%PROJECT_DIR%.maven
set MAVEN_HOME=%MAVEN_DIR%\apache-maven-%MAVEN_VERSION%
set MAVEN_ZIP=%MAVEN_DIR%\apache-maven-%MAVEN_VERSION%-bin.zip
set MAVEN_URL=https://archive.apache.org/dist/maven/maven-3/%MAVEN_VERSION%/binaries/apache-maven-%MAVEN_VERSION%-bin.zip

echo.
echo [1/5] 检查 Java 环境...
java -version >nul 2>&1
if errorlevel 1 (
    echo 错误: 未找到 Java，请先安装 JDK 8 或更高版本
    pause
    exit /b 1
)
for /f "tokens=3" %%v in ('java -version 2^>^&1 ^| findstr /i "version"') do (
    set JAVA_VERSION=%%v
    echo 检测到 Java 版本: !JAVA_VERSION!
)

echo.
echo [2/5] 检查 Maven 环境...
if not exist "%MAVEN_HOME%" (
    echo 正在下载 Maven %MAVEN_VERSION%...
    if not exist "%MAVEN_DIR%" mkdir "%MAVEN_DIR%"
    
    powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -Uri '%MAVEN_URL%' -OutFile '%MAVEN_ZIP%'}"
    
    echo 解压 Maven...
    powershell -Command "Expand-Archive -Path '%MAVEN_ZIP%' -DestinationPath '%MAVEN_DIR%'"
    del "%MAVEN_ZIP%"
)
set PATH=%MAVEN_HOME%\bin;%PATH%
for /f "tokens=*" %%v in ('call mvn -version 2^>^&1 ^| findstr /i "Apache Maven"') do (
    echo Maven 已就绪: %%v
)

echo.
echo [3/5] 清理并编译项目...
cd /d "%PROJECT_DIR%"
if exist target rd /s /q target
if exist data rd /s /q data

call mvn clean package -DskipTests -q

if not exist "target\device-command-confirmation-api-1.0.0.jar" (
    echo 错误: JAR 包生成失败
    pause
    exit /b 1
)
echo 编译成功，JAR 包已生成

if not exist data mkdir data

echo.
echo [4/5] 启动 API 服务...
echo 服务端口: 8080
echo H2 控制台: http://localhost:8080/h2-console
echo API 文档: 请参考 README.md
echo.
echo 按 Ctrl+C 停止服务
echo.
echo ========================================

java -jar target\device-command-confirmation-api-1.0.0.jar

pause
