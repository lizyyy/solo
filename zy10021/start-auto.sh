#!/bin/bash

# PaymentGuard 无 Maven 启动脚本
# 这个脚本会：
# 1. 自动下载 Maven Wrapper（如果没有 Maven）
# 2. 使用 Maven Wrapper 编译项目
# 3. 启动应用

set -e

echo "=========================================="
echo "   PaymentGuard 支付回调幂等性验证平台"
echo "=========================================="
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 检查 Java
if ! command -v java &> /dev/null; then
    echo "❌ 错误: 未找到 Java 运行环境"
    echo "   请安装 Java 8 或更高版本"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2 | cut -d'.' -f1)
echo "✅ 检测到 Java 版本: $JAVA_VERSION"
echo ""

# 检查是否有 Maven
if command -v mvn &> /dev/null; then
    echo "✅ 使用系统 Maven"
    MVN_CMD="mvn"
else
    echo "📦 未检测到 Maven，正在下载 Maven Wrapper..."
    
    # 创建 Maven Wrapper
    if [ ! -f ".mvn/wrapper/maven-wrapper.jar" ]; then
        mkdir -p .mvn/wrapper
        
        # 下载 Maven Wrapper
        MVNW_VERSION="3.9.6"
        MVNW_URL="https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/$MVNW_VERSION/maven-wrapper-$MVNW_VERSION.jar"
        
        if command -v curl &> /dev/null; then
            curl -sL "$MVNW_URL" -o .mvn/wrapper/maven-wrapper.jar
        elif command -v wget &> /dev/null; then
            wget -q "$MVNW_URL" -O .mvn/wrapper/maven-wrapper.jar
        else
            echo "❌ 错误: 没有 curl 或 wget，无法下载 Maven"
            echo "   请先安装 curl 或 wget，或者手动安装 Maven"
            exit 1
        fi
        
        # 创建 maven-wrapper.properties
        cat > .mvn/wrapper/maven-wrapper.properties << 'EOF'
distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.6/apache-maven-3.9.6-bin.zip
wrapperUrl=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.9.6/maven-wrapper-3.9.6.jar
EOF
    fi
    
    # 创建 mvnw 脚本
    if [ ! -f "mvnw" ]; then
        cat > mvnw << 'MAVEN_WRAPPER'
#!/bin/sh
# Maven Wrapper bootstrap script

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

WRAPPER_JAR=".mvn/wrapper/maven-wrapper.jar"
if [ ! -f "$WRAPPER_JAR" ]; then
    echo "Maven Wrapper JAR not found: $WRAPPER_JAR" >&2
    exit 1
fi

exec java -jar "$WRAPPER_JAR" "$@"
MAVEN_WRAPPER
        chmod +x mvnw
    fi
    
    MVN_CMD="./mvnw"
    echo "✅ Maven Wrapper 准备就绪"
fi

echo ""
echo "📦 正在编译项目（首次运行可能需要几分钟下载依赖）..."
echo ""

# 使用 H2 内存数据库运行测试并打包
$MVN_CMD clean package -DskipTests -q

JAR_FILE="target/payment-guard-1.0.0.jar"

if [ ! -f "$JAR_FILE" ]; then
    echo "❌ 编译失败，未找到 JAR 文件"
    exit 1
fi

echo ""
echo "🚀 正在启动 PaymentGuard..."
echo ""
echo "访问地址:"
echo "  - 应用: http://localhost:8080"
echo "  - 健康检查: http://localhost:8080/actuator/health"
echo "  - 指标: http://localhost:8080/actuator/prometheus"
echo "  - H2 控制台: http://localhost:8080/h2-console (JDBC URL: jdbc:h2:mem:paymentguard)"
echo ""
echo "按 Ctrl+C 停止服务"
echo ""

# 使用 H2 内存数据库配置启动
JAVA_OPTS="-Xms512m -Xmx1024m"
java $JAVA_OPTS -jar "$JAR_FILE"
