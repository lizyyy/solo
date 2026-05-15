#!/bin/bash
# 纯 JDK 编译脚本 - 不需要 Maven
# 使用说明: ./build.sh

set -e

cd "$(dirname "$0")"

echo "====================================="
echo "跨服务补偿指令 API - 编译脚本"
echo "====================================="
echo ""

# 检查 Java 环境
if command -v java &> /dev/null; then
    JAVA_CMD="java"
    JAVAC_CMD="javac"
elif [ -n "$JAVA_HOME" ] && [ -x "$JAVA_HOME/bin/java" ]; then
    JAVA_CMD="$JAVA_HOME/bin/java"
    JAVAC_CMD="$JAVA_HOME/bin/javac"
else
    echo "❌ 未找到 Java 环境，请先安装 JDK 8 或更高版本"
    exit 1
fi

JAVA_VERSION=$($JAVA_CMD -version 2>&1 | head -n 1)
echo "✅ 检测到 Java: $JAVA_VERSION"
echo ""

# 创建目录
mkdir -p lib target/classes

# 依赖列表 (Spring Boot 2.7.x + 相关)
DEPS=(
    "https://repo1.maven.org/maven2/org/springframework/boot/spring-boot/2.7.18/spring-boot-2.7.18.jar"
    "https://repo1.maven.org/maven2/org/springframework/boot/spring-boot-autoconfigure/2.7.18/spring-boot-autoconfigure-2.7.18.jar"
    "https://repo1.maven.org/maven2/org/springframework/spring-core/5.3.24/spring-core-5.3.24.jar"
    "https://repo1.maven.org/maven2/org/springframework/spring-beans/5.3.24/spring-beans-5.3.24.jar"
    "https://repo1.maven.org/maven2/org/springframework/spring-context/5.3.24/spring-context-5.3.24.jar"
    "https://repo1.maven.org/maven2/org/springframework/spring-web/5.3.24/spring-web-5.3.24.jar"
    "https://repo1.maven.org/maven2/org/springframework/spring-webmvc/5.3.24/spring-webmvc-5.3.24.jar"
    "https://repo1.maven.org/maven2/org/springframework/spring-expression/5.3.24/spring-expression-5.3.24.jar"
    "https://repo1.maven.org/maven2/org/springframework/spring-aop/5.3.24/spring-aop-5.3.24.jar"
    "https://repo1.maven.org/maven2/org/springframework/data/spring-data-jpa/2.7.11/spring-data-jpa-2.7.11.jar"
    "https://repo1.maven.org/maven2/org/springframework/spring-orm/5.3.24/spring-orm-5.3.24.jar"
    "https://repo1.maven.org/maven2/org/springframework/spring-tx/5.3.24/spring-tx-5.3.24.jar"
    "https://repo1.maven.org/maven2/org/springframework/data/spring-data-commons/2.7.11/spring-data-commons-2.7.11.jar"
    "https://repo1.maven.org/maven2/javax/persistence/javax.persistence-api/2.2/javax.persistence-api-2.2.jar"
    "https://repo1.maven.org/maven2/javax/validation/validation-api/2.0.1.Final/validation-api-2.0.1.Final.jar"
    "https://repo1.maven.org/maven2/org/hibernate/hibernate-core/5.6.15.Final/hibernate-core-5.6.15.Final.jar"
    "https://repo1.maven.org/maven2/com/h2database/h2/2.1.214/h2-2.1.214.jar"
    "https://repo1.maven.org/maven2/com/alibaba/fastjson/1.2.83/fastjson-1.2.83.jar"
    "https://repo1.maven.org/maven2/com/fasterxml/jackson/core/jackson-databind/2.13.5/jackson-databind-2.13.5.jar"
    "https://repo1.maven.org/maven2/com/fasterxml/jackson/core/jackson-core/2.13.5/jackson-core-2.13.5.jar"
    "https://repo1.maven.org/maven2/com/fasterxml/jackson/core/jackson-annotations/2.13.5/jackson-annotations-2.13.5.jar"
    "https://repo1.maven.org/maven2/org/apache/tomcat/embed/tomcat-embed-core/9.0.70/tomcat-embed-core-9.0.70.jar"
    "https://repo1.maven.org/maven2/org/apache/tomcat/embed/tomcat-embed-el/9.0.70/tomcat-embed-el-9.0.70.jar"
    "https://repo1.maven.org/maven2/org/apache/tomcat/embed/tomcat-embed-websocket/9.0.70/tomcat-embed-websocket-9.0.70.jar"
    "https://repo1.maven.org/maven2/org/slf4j/slf4j-api/1.7.36/slf4j-api-1.7.36.jar"
    "https://repo1.maven.org/maven2/ch/qos/logback/logback-classic/1.2.11/logback-classic-1.2.11.jar"
    "https://repo1.maven.org/maven2/ch/qos/logback/logback-core/1.2.11/logback-core-1.2.11.jar"
    "https://repo1.maven.org/maven2/org/projectlombok/lombok/1.18.30/lombok-1.18.30.jar"
)

# 下载依赖
echo "📦 检查并下载依赖..."
MISSING_DEPS=0
for url in "${DEPS[@]}"; do
    filename=$(basename "$url")
    if [ ! -f "lib/$filename" ]; then
        echo "  下载: $filename"
        if command -v curl &> /dev/null; then
            curl -s -L -o "lib/$filename" "$url" || MISSING_DEPS=$((MISSING_DEPS+1))
        elif command -v wget &> /dev/null; then
            wget -q -O "lib/$filename" "$url" || MISSING_DEPS=$((MISSING_DEPS+1))
        else
            echo "❌ 未找到 curl 或 wget，请手动下载依赖到 lib/ 目录"
            exit 1
        fi
    fi
done

if [ $MISSING_DEPS -gt 0 ]; then
    echo "⚠️   $MISSING_DEPS 个依赖下载失败，请检查网络"
else
    echo "✅ 所有依赖已就绪"
fi
echo ""

# 构建 classpath
CLASSPATH=""
for jar in lib/*.jar; do
    CLASSPATH="$CLASSPATH:$jar"
done

# Lombok 特殊处理 - 注解处理器
LOMBOK_JAR="$(ls lib/lombok-*.jar 2>/dev/null | head -n 1)"

# 清理旧的编译结果
rm -rf target/classes/*
mkdir -p target/classes

# 编译源码
echo "🔨 编译源码 (Java 8 兼容模式)..."
JAVA_FILES=$(find src/main/java -name "*.java" | tr '\n' ' ')

if [ -n "$LOMBOK_JAR" ]; then
    $JAVAC_CMD -source 1.8 -target 1.8 \
        -cp "$CLASSPATH" \
        -processorpath "$LOMBOK_JAR" \
        -d target/classes \
        $JAVA_FILES 2>&1 | head -n 50
else
    echo "⚠️   未找到 Lombok jar，尝试直接编译（可能失败）"
    $JAVAC_CMD -source 1.8 -target 1.8 \
        -cp "$CLASSPATH" \
        -d target/classes \
        $JAVA_FILES 2>&1 | head -n 50
fi

if [ $? -eq 0 ]; then
    CLASS_COUNT=$(find target/classes -name "*.class" | wc -l)
    echo ""
    echo "✅ 编译成功！生成了 $CLASS_COUNT 个 class 文件"
    echo ""
    echo "🚀 现在可以运行 ./start-standalone.sh 启动服务"
else
    echo ""
    echo "❌ 编译失败"
    exit 1
fi
