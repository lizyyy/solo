@echo off
chcp 65001 >nul
setlocal

echo ========================================
echo 跨境数据访问审批 API - 启动脚本
echo ========================================

if not exist "data" mkdir data

echo.
echo 🔍 环境检查...
java -version >nul 2>&1
if errorlevel 1 (
    echo ❌ 错误: 未找到 Java
    echo    请安装 Java 8 或更高版本的 JDK
    echo    下载地址: https://adoptium.net/
    pause
    exit /b 1
)

for /f tokens^=2^ delims^=^" %%a in ('java -version 2^>^&1 ^| findstr /i "version"') do (
    set "JAVA_VERSION=%%a"
)
for /f "delims=. tokens=1" %%a in ("%JAVA_VERSION%") do set JAVA_MAJOR=%%a
echo    Java 版本: %JAVA_MAJOR%

if %JAVA_MAJOR% LSS 8 (
    echo ❌ 错误: 需要 Java 8 或更高版本，当前版本: %JAVA_MAJOR%
    pause
    exit /b 1
)

set HAS_JAVAC=0
javac -version >nul 2>&1
if not errorlevel 1 (
    set HAS_JAVAC=1
    echo    ✓ JDK 编译器已就绪
) else (
    echo    ⚠️  JRE 环境（无 javac 编译器）
)

echo.
echo 📦 编译状态检测...

set JAR_FILE=
if exist "target\data-access-approval-1.0.0.jar" (
    set JAR_FILE=target\data-access-approval-1.0.0.jar
    echo    ✓ 发现 JAR 文件: %JAR_FILE%
) else if exist "target\data-access-approval.jar" (
    set JAR_FILE=target\data-access-approval.jar
    echo    ✓ 发现 JAR 文件: %JAR_FILE%
) else (
    for %%f in (target\*.jar) do (
        set JAR_FILE=%%f
        echo    ✓ 发现 JAR 文件: %%f
        goto :jar_found
    )
)
:jar_found

if "%JAR_FILE%"=="" (
    echo    ✗ 未发现 JAR 文件
)

if "%JAR_FILE%"=="" (
    if %HAS_JAVAC%==1 (
        echo.
        echo 🔨 开始编译项目...
        call mvnw.cmd clean package -DskipTests -q
        
        for %%f in (target\*.jar) do (
            set JAR_FILE=%%f
            goto :jar_found2
        )
        :jar_found2
        
        if "%JAR_FILE%"=="" (
            echo ❌ 编译失败或未生成 JAR 文件
            pause
            exit /b 1
        )
        echo    ✓ 编译完成
    ) else (
        echo.
        echo ❌ 无法编译（当前是 JRE 环境）且没有预编译文件
        echo.
        echo 📋 解决方案：
        echo    方案一：安装完整 JDK 后重新运行
        echo            下载地址: https://adoptium.net/
        echo.
        echo    方案二：在有 JDK 的机器上先编译，再复制过来：
        echo            mvnw.cmd clean package -DskipTests
        echo            复制 target\*.jar 到本机 target\ 目录
        pause
        exit /b 1
    )
)

echo.
echo 🚀 启动应用...
echo ========================================
echo    服务地址: http://localhost:8080
echo    API 测试: http://localhost:8080/api/applications/statuses
echo    H2控制台: http://localhost:8080/h2-console
echo    数据库: jdbc:h2:file:./data/approvaldb
echo ========================================
echo.

java -jar "%JAR_FILE%"

pause
