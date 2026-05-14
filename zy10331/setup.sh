#!/bin/bash

set -e

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MAVEN_VERSION="3.8.8"
MAVEN_DIR="$PROJECT_DIR/.maven"
MAVEN_HOME="$MAVEN_DIR/apache-maven-$MAVEN_VERSION"
MAVEN_BIN="$MAVEN_HOME/bin/mvn"

echo "========================================="
echo "批处理优先级队列 API - 项目初始化脚本"
echo "========================================="
echo ""

# 检查 Java
if ! command -v java &> /dev/null; then
    echo "❌ 未找到 Java，请先安装 Java 8 或更高版本"
    exit 1
fi

# 设置 JAVA_HOME
if [ -x /usr/libexec/java_home ]; then
    export JAVA_HOME="$(/usr/libexec/java_home)"
fi

echo "✅ Java 已安装"
echo "JAVA_HOME: $JAVA_HOME"
java -version
echo ""

# 创建目录
mkdir -p "$MAVEN_DIR"

# 下载 Maven
if [ ! -d "$MAVEN_HOME" ]; then
    echo "📦 正在下载 Maven $MAVEN_VERSION..."
    cd "$MAVEN_DIR"
    curl -L "https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/$MAVEN_VERSION/apache-maven-$MAVEN_VERSION-bin.zip" -o maven.zip
    unzip -q maven.zip
    rm maven.zip
    cd "$PROJECT_DIR"
    echo "✅ Maven 下载完成"
else
    echo "✅ Maven 已存在"
fi

echo ""
echo "========================================="
echo "开始构建项目..."
echo "========================================="

# 构建项目
cd "$PROJECT_DIR"
"$MAVEN_BIN" clean package -DskipTests

echo ""
echo "========================================="
echo "构建完成！"
echo "========================================="

# 检查 JAR 文件
JAR_FILE="$PROJECT_DIR/target/priority-queue-api-1.0.0.jar"
if [ -f "$JAR_FILE" ]; then
    echo ""
    echo "✅ JAR 文件已生成: $JAR_FILE"
    echo ""
    echo "运行服务命令："
    echo "  cd $PROJECT_DIR && $MAVEN_BIN spring-boot:run"
    echo "  或"
    echo "  java -jar $JAR_FILE"
    echo ""
    echo "服务启动后访问："
    echo "  API: http://localhost:8080/api/tasks"
    echo "  H2控制台: http://localhost:8080/h2-console"
else
    echo "❌ JAR 文件未生成，请检查构建日志"
    exit 1
fi
