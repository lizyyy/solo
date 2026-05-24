#!/bin/bash
# 县域防汛安置物资 API - 自动部署启动脚本

set -e

echo "========================================"
echo "  县域防汛安置物资 API - 启动脚本"
echo "========================================"
echo ""

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

# 检查并安装 Java
check_java() {
    if ! command -v java >/dev/null 2>&1; then
        echo "❌ 未找到 Java"
        echo "请安装 JDK 17 或更高版本:"
        echo "  macOS: brew install openjdk@17"
        echo "  或下载: https://adoptium.net/"
        exit 1
    fi
    
    JAVA_VERSION=$(java -version 2>&1 | head -n 1 | awk -F'"' '{print $2}' | cut -d'.' -f1)
    echo "✅ Java 版本: $JAVA_VERSION"
}

# 检查并安装 Maven
check_maven() {
    if command -v mvn >/dev/null 2>&1; then
        echo "✅ Maven 已安装"
        return 0
    fi
    
    echo "⚠️  未找到 Maven，尝试自动安装..."
    
    # 尝试 brew 安装
    if command -v brew >/dev/null 2>&1; then
        echo "使用 Homebrew 安装 Maven..."
        brew install maven
        return 0
    fi
    
    # 尝试使用 Maven Wrapper 下载
    if [ -f ".mvn/wrapper/maven-wrapper.jar" ]; then
        echo "使用 Maven Wrapper..."
        return 0
    fi
    
    # 下载 Maven Wrapper jar
    echo "下载 Maven Wrapper..."
    mkdir -p .mvn/wrapper
    if command -v curl >/dev/null 2>&1; then
        curl -sL -o .mvn/wrapper/maven-wrapper.jar \
            "https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar"
        echo "✅ Maven Wrapper 下载完成"
        return 0
    fi
    
    echo ""
    echo "❌ 无法自动安装 Maven"
    echo "请手动安装:"
    echo "  macOS: brew install maven"
    echo "  或下载: https://maven.apache.org/download.cgi"
    exit 1
}

# 检查端口
check_port() {
    PORT=8080
    if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  端口 $PORT 已被占用"
        echo "请先停止占用该端口的进程，或修改 application.yml 中的端口号"
    fi
}

# 主流程
main() {
    check_java
    check_maven
    check_port
    
    echo ""
    echo "========================================"
    echo "  开始构建并启动服务..."
    echo "========================================"
    echo ""
    echo "📡 API 地址: http://localhost:8080/api"
    echo "🔍 H2 控制台: http://localhost:8080/api/h2-console"
    echo "💾 JDBC URL: jdbc:h2:file:./data/floodrelief"
    echo "👤 用户名/密码: admin / admin"
    echo ""
    echo "启动后可运行 ./verify-api.sh 验证 API 闭环"
    echo ""
    
    # 运行 Spring Boot
    if command -v mvn >/dev/null 2>&1; then
        mvn clean spring-boot:run
    else
        ./mvnw clean spring-boot:run
    fi
}

main "$@"
