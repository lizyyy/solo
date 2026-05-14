#!/bin/bash
set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
MAVEN_DIR="$PROJECT_DIR/.mvn/wrapper"
MAVEN_HOME="$MAVEN_DIR/maven-home"

echo "=========================================="
echo "接口证据链追踪 API - 启动脚本"
echo "=========================================="
echo ""

# 检查 Java
if ! command -v java > /dev/null 2>&1; then
    echo "错误: 未找到 Java，请先安装 JDK 1.8 或更高版本"
    exit 1
fi
JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d '"' -f 2)
echo "✓ Java 版本: $JAVA_VERSION"

# 检查 curl 和 unzip
if ! command -v curl > /dev/null 2>&1; then
    echo "错误: 未找到 curl，请先安装 curl"
    exit 1
fi
echo "✓ curl 已就绪"

if ! command -v unzip > /dev/null 2>&1; then
    echo "错误: 未找到 unzip，请先安装 unzip"
    exit 1
fi
echo "✓ unzip 已就绪"
echo ""

# 下载 Maven（如果需要）
if [ ! -d "$MAVEN_HOME" ]; then
    echo "正在下载 Maven 3.8.8..."
    mkdir -p "$MAVEN_DIR"
    curl -f -L --progress-bar \
        https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.8.8/apache-maven-3.8.8-bin.zip \
        -o "$MAVEN_DIR/maven.zip"
    
    echo "正在解压 Maven..."
    unzip -q "$MAVEN_DIR/maven.zip" -d "$MAVEN_DIR/"
    mv "$MAVEN_DIR/apache-maven-3.8.8" "$MAVEN_HOME"
    rm "$MAVEN_DIR/maven.zip"
    echo "✓ Maven 安装完成"
    echo ""
fi

echo "正在编译并启动 Spring Boot 应用..."
echo "  - 首次启动需要下载依赖，请耐心等待"
echo "  - 服务启动后访问:"
echo "    • API 文档: http://localhost:8080/swagger-ui.html"
echo "    • H2 控制台: http://localhost:8080/h2-console"
echo ""
echo "按 Ctrl+C 停止服务"
echo "=========================================="
echo ""

# 设置 classpath
CLASSWORLDS_JAR=$(ls "$MAVEN_HOME"/boot/plexus-classworlds-*.jar | head -n 1)

cd "$PROJECT_DIR"
java -classpath "$CLASSWORLDS_JAR" \
    -Dclassworlds.conf="$MAVEN_HOME/bin/m2.conf" \
    -Dmaven.home="$MAVEN_HOME" \
    -Dmaven.multiModuleProjectDirectory="$PROJECT_DIR" \
    org.codehaus.classworlds.Launcher \
    spring-boot:run
