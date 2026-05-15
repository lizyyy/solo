#!/bin/bash
# 附件元数据修复 API - 独立构建启动脚本
# 无需系统安装Maven，使用嵌入式方式构建和运行

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "========================================"
echo "  附件元数据修复 API - 构建启动脚本"
echo "========================================"
echo ""

# 检查Java版本
JAVA_VERSION=$(java -version 2>&1 | head -n 1 | awk -F'"' '{print $2}' | cut -d'.' -f1,2)
echo "检测到 Java 版本: $JAVA_VERSION"

# 检查是否有target目录，如果没有则创建
if [ ! -d "target" ]; then
    mkdir -p target/classes target/test-classes target/dependency
fi

# 下载依赖（如果不存在）
if [ ! -f "target/dependency/downloaded" ]; then
    echo ""
    echo "正在下载依赖包..."
    mkdir -p ~/.m2/repository

    # Spring Boot 2.7.18 核心依赖
    DEPENDENCIES=(
        "org/springframework/boot/spring-boot/2.7.18/spring-boot-2.7.18.jar"
        "org/springframework/boot/spring-boot-autoconfigure/2.7.18/spring-boot-autoconfigure-2.7.18.jar"
        "org/springframework/boot/spring-boot-starter-web/2.7.18/spring-boot-starter-web-2.7.18.jar"
        "org/springframework/boot/spring-boot-starter-data-jpa/2.7.18/spring-boot-starter-data-jpa-2.7.18.jar"
        "org/springframework/boot/spring-boot-starter-validation/2.7.18/spring-boot-starter-validation-2.7.18.jar"
        "org/springframework/boot/spring-boot-starter-logging/2.7.18/spring-boot-starter-logging-2.7.18.jar"
        "org/springframework/spring-core/5.3.24/spring-core-5.3.24.jar"
        "org/springframework/spring-context/5.3.24/spring-context-5.3.24.jar"
        "org/springframework/spring-web/5.3.24/spring-web-5.3.24.jar"
        "org/springframework/spring-webmvc/5.3.24/spring-webmvc-5.3.24.jar"
        "org/springframework/spring-beans/5.3.24/spring-beans-5.3.24.jar"
        "org/springframework/spring-expression/5.3.24/spring-expression-5.3.24.jar"
        "org/springframework/spring-aop/5.3.24/spring-aop-5.3.24.jar"
        "org/springframework/spring-tx/5.3.24/spring-tx-5.3.24.jar"
        "org/springframework/spring-jcl/5.3.24/spring-jcl-5.3.24.jar"
        "org/springframework/data/spring-data-jpa/2.7.11/spring-data-jpa-2.7.11.jar"
        "org/springframework/data/spring-data-commons/2.7.11/spring-data-commons-2.7.11.jar"
        "org/hibernate/hibernate-core/5.6.15.Final/hibernate-core-5.6.15.Final.jar"
        "javax/persistence/javax.persistence-api/2.2/javax.persistence-api-2.2.jar"
        "javax/validation/javax.validation-api/2.0.1.Final/javax.validation-api-2.0.1.Final.jar"
        "com/h2database/h2/2.1.214/h2-2.1.214.jar"
        "com/fasterxml/jackson/core/jackson-databind/2.13.5/jackson-databind-2.13.5.jar"
        "com/fasterxml/jackson/core/jackson-core/2.13.5/jackson-core-2.13.5.jar"
        "com/fasterxml/jackson/core/jackson-annotations/2.13.5/jackson-annotations-2.13.5.jar"
        "org/projectlombok/lombok/1.18.30/lombok-1.18.30.jar"
        "org/apache/tomcat/embed/tomcat-embed-core/9.0.82/tomcat-embed-core-9.0.82.jar"
        "org/apache/tomcat/embed/tomcat-embed-el/9.0.82/tomcat-embed-el-9.0.82.jar"
        "org/apache/tomcat/embed/tomcat-embed-websocket/9.0.82/tomcat-embed-websocket-9.0.82.jar"
        "org/slf4j/slf4j-api/1.7.36/slf4j-api-1.7.36.jar"
        "ch/qos/logback/logback-classic/1.2.12/logback-classic-1.2.12.jar"
        "ch/qos/logback/logback-core/1.2.12/logback-core-1.2.12.jar"
    )

    MAVEN_REPO="https://repo.maven.apache.org/maven2"
    LOCAL_REPO="$HOME/.m2/repository"

    for dep in "${DEPENDENCIES[@]}"; do
        local_file="$LOCAL_REPO/$dep"
        if [ ! -f "$local_file" ]; then
            echo "  下载: $dep"
            mkdir -p "$(dirname "$local_file")"
            curl -s -f -L "$MAVEN_REPO/$dep" -o "$local_file" 2>/dev/null || echo "    跳过 (无法下载)"
        fi
    done

    touch "target/dependency/downloaded"
    echo "依赖下载完成!"
fi

# 构建classpath
echo ""
echo "正在构建 classpath..."
CLASSPATH="target/classes"
for jar in $(find "$HOME/.m2/repository" -name "*.jar" 2>/dev/null | head -100); do
    CLASSPATH="$CLASSPATH:$jar"
done

# 编译源码
echo ""
echo "正在编译 Java 源码..."
find src/main/java -name "*.java" > target/sources.txt
javac -encoding UTF-8 -cp "$CLASSPATH" -d target/classes @target/sources.txt 2>&1 || {
    echo ""
    echo "编译失败！尝试简化编译..."
    # 简化编译 - 确保关键类能编译
    CLASSPATH_SIMPLE=""
    for j in $(find "$HOME/.m2/repository" -name "lombok*.jar" -o -name "spring-boot*.jar" -o -name "spring-context*.jar" -o -name "spring-core*.jar" -o -name "javax.persistence*.jar" -o -name "spring-data-jpa*.jar" -o -name "h2*.jar" -o -name "jackson*.jar" 2>/dev/null | head -30); do
        CLASSPATH_SIMPLE="$CLASSPATH_SIMPLE:$j"
    done
    CLASSPATH_SIMPLE="target/classes${CLASSPATH_SIMPLE}"
    
    # 使用lombok注解处理器编译
    LOMBOK_JAR=$(find "$HOME/.m2/repository" -name "lombok*.jar" 2>/dev/null | head -1)
    if [ -n "$LOMBOK_JAR" ]; then
        echo "使用 Lombok: $LOMBOK_JAR"
        javac -encoding UTF-8 -cp "$CLASSPATH_SIMPLE" -processorpath "$LOMBOK_JAR" -d target/classes @target/sources.txt 2>&1
    fi
}

echo ""
echo "复制配置文件..."
mkdir -p target/classes
cp -r src/main/resources/* target/classes/ 2>/dev/null || true

echo ""
echo "========================================"
echo "  编译完成！正在启动服务..."
echo "========================================"
echo ""
echo "服务地址: http://localhost:8080/api/repair"
echo "H2控制台: http://localhost:8080/api/h2-console"
echo ""
echo "按 Ctrl+C 停止服务"
echo "========================================"
echo ""

# 运行应用
java -cp "$CLASSPATH" com.metadata.repair.MetadataRepairApplication
