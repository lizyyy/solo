#!/bin/bash

# 资源标签继承 API 启动脚本
# 支持 Java 8+，无需预先安装 Maven

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "========================================"
echo "  资源标签继承 API - 启动脚本"
echo "========================================"
echo ""

# 检查 Java 版本
if ! command -v java &> /dev/null; then
    echo "❌ 错误: 未找到 Java，请先安装 JDK 8 或更高版本"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1)
echo "✅ 检测到 Java 版本: $JAVA_VERSION"

# 检查并下载 Maven Wrapper（如果需要）
if [ ! -f "mvnw" ]; then
    echo ""
    echo "📦 正在设置 Maven Wrapper..."
    
    # 创建 .mvn 目录
    mkdir -p .mvn/wrapper
    
    # 创建 maven-wrapper.properties
    cat > .mvn/wrapper/maven-wrapper.properties << 'EOF'
distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar
wrapperUrl=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar
EOF

    # 创建 mvnw 脚本
    cat > mvnw << 'MVNEOF'
#!/bin/sh

# Maven Wrapper 启动脚本

set -e

# 尝试使用系统 Maven（如果有）
if command -v mvn &> /dev/null; then
    exec mvn "$@"
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
WRAPPER_JAR="$SCRIPT_DIR/.mvn/wrapper/maven-wrapper.jar"

if [ ! -f "$WRAPPER_JAR" ]; then
    echo "Downloading Maven Wrapper..."
    mkdir -p "$(dirname "$WRAPPER_JAR")"
    curl -s -o "$WRAPPER_JAR" "https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar"
fi

exec java -jar "$WRAPPER_JAR" "$@"
MVNEOF

    chmod +x mvnw
    
    # Windows 版本
    cat > mvnw.cmd << 'WINEOF'
@echo off
setlocal

set "SCRIPT_DIR=%~dp0"
set "WRAPPER_JAR=%SCRIPT_DIR%.mvn\wrapper\maven-wrapper.jar"

where mvn >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    call mvn %*
    exit /b %ERRORLEVEL%
)

if not exist "%WRAPPER_JAR%" (
    echo Downloading Maven Wrapper...
    if not exist "%SCRIPT_DIR%.mvn\wrapper" mkdir "%SCRIPT_DIR%.mvn\wrapper"
    powershell -Command "Invoke-WebRequest -Uri 'https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar' -OutFile '%WRAPPER_JAR%'"
)

java -jar "%WRAPPER_JAR%" %*
WINEOF
fi

echo ""
echo "🚀 编译并启动应用..."
echo ""

# 使用 Maven Wrapper 编译并运行
./mvnw spring-boot:run

echo ""
echo "✅ 应用已停止"
