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

:: 正确解析 Java 版本号（支持 1.8.x 和 9+ 格式）
set JAVA_VERSION_FULL=
for /f tokens^=2^ delims^=^" %%a in ('java -version 2^>^&1 ^| findstr /i "version"') do (
    set "JAVA_VERSION_FULL=%%a"
)
echo    Java 完整版本: %JAVA_VERSION_FULL%

:: 提取主版本号：1.8.x -> 8, 9.x -> 9, 11.x -> 11
for /f "delims=. tokens=1" %%a in ("%JAVA_VERSION_FULL%") do (
    set "JAVA_MAJOR=%%a"
)
if "%JAVA_MAJOR%"=="1" (
    :: Java 8 格式: 1.8.x
    for /f "delims=. tokens=2" %%a in ("%JAVA_VERSION_FULL%") do (
        set "JAVA_MAJOR=%%a"
    )
)
echo    Java 主版本: %JAVA_MAJOR%

if %JAVA_MAJOR% LSS 8 (
    echo ❌ 错误: 需要 Java 8 或更高版本，当前版本: %JAVA_VERSION_FULL%
    pause
    exit /b 1
)
echo    ✓ Java 版本符合要求

:: 关键修复：真正验证 javac 可用，而不是只检查文件是否存在
echo.
echo 🔍 验证 JDK 编译器...
set HAS_JAVAC=0
where javac >nul 2>&1
if not errorlevel 1 (
    :: 真正执行 javac -version 验证（关键！）
    javac -version >nul 2>&1
    if not errorlevel 1 (
        set HAS_JAVAC=1
        for /f "tokens=*" %%a in ('javac -version 2^>^&1') do set "JAVAC_VERSION=%%a"
        echo    ✓ JDK 编译器可用: %JAVAC_VERSION%
    ) else (
        echo    ⚠️  检测到 javac 命令但无法执行（JDK 未正确安装）
    )
)

if %HAS_JAVAC%==0 (
    echo    ✗ JDK 编译器不可用
)

echo.
echo 📦 编译状态检测...

set JAR_FILE=
:: 优先找 Spring Boot executable JAR
if exist "target\data-access-approval-1.0.0.jar" (
    set JAR_FILE=target\data-access-approval-1.0.0.jar
    echo    ✓ 发现完整 JAR: %JAR_FILE%
) else (
    :: 查找任何 JAR
    for %%f in (target\*.jar) do (
        set JAR_FILE=%%f
        echo    ✓ 发现 JAR: %%f
        goto :jar_found
    )
)
:jar_found

if "%JAR_FILE%"=="" (
    echo    ✗ 未发现可执行 JAR 文件
)

:: 编译策略：没有 JAR 时必须编译
set NEED_COMPILE=0
if "%JAR_FILE%"=="" (
    set NEED_COMPILE=1
)

if %NEED_COMPILE%==1 (
    if %HAS_JAVAC%==1 (
        echo.
        echo 🔨 开始编译项目...
        echo    正在下载依赖并编译（首次可能需要几分钟）...
        call mvnw.cmd clean package -DskipTests -q
        
        :: 再次查找 JAR
        if exist "target\data-access-approval-1.0.0.jar" (
            set JAR_FILE=target\data-access-approval-1.0.0.jar
        ) else (
            for %%f in (target\*.jar) do (
                set JAR_FILE=%%f
                goto :jar_found2
            )
        )
        :jar_found2
        
        if "%JAR_FILE%"=="" (
            echo.
            echo ⚠️  未找到标准 JAR，尝试查找任何可用 JAR...
            for %%f in (target\*.jar) do (
                set JAR_FILE=%%f
                echo    ✓ 找到 JAR: %%f
                goto :jar_found3
            )
        )
        :jar_found3
        
        if "%JAR_FILE%"=="" (
            echo.
            echo ❌ 编译失败或未生成 JAR 文件
            echo.
            echo 📋 故障排除建议：
            echo    1. 确保网络连接正常（需要下载 Maven 依赖）
            echo    2. 尝试手动编译查看详细错误：
            echo       mvnw.cmd clean package -DskipTests
            echo    3. 检查 Maven 下载镜像配置
            pause
            exit /b 1
        )
        echo    ✓ 编译完成
    ) else (
        echo.
        echo ❌ 无法编译（没有可用的 JDK 编译器）且没有预编译的 JAR 文件
        echo.
        echo ========================================
        echo 📋 解决方案（二选一）：
        echo ========================================
        echo.
        echo 方案一：安装完整 JDK 后重新运行 【推荐】
        echo.
        echo    Windows 安装步骤：
        echo    1. 访问: https://adoptium.net/
        echo    2. 下载 Temurin 8 (LTS) 或更高版本
        echo    3. 安装 msi 文件
        echo    4. 重新打开 cmd 执行: javac -version 验证
        echo    5. 再次运行: start.bat
        echo.
        echo 方案二：在有 JDK 的机器上预编译，复制 JAR 过来：
        echo.
        echo    1. 在有 JDK 的机器上执行:
        echo       mvnw.cmd clean package -DskipTests
        echo.
        echo    2. 复制以下文件到本机 target\ 目录：
        echo       target\data-access-approval-1.0.0.jar
        echo.
        echo    3. 重新运行此脚本
        echo.
        pause
        exit /b 1
    )
)

echo.
echo 🚀 启动应用...
echo ========================================
echo    JAR 文件: %JAR_FILE%
echo    服务地址: http://localhost:8080
echo    API 测试: http://localhost:8080/api/applications/statuses
echo    H2控制台: http://localhost:8080/h2-console
echo    数据库: jdbc:h2:file:./data/approvaldb
echo ========================================
echo.

java -jar "%JAR_FILE%"

pause
