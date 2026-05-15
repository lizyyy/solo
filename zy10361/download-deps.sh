#!/bin/bash
# 完全独立的依赖下载脚本 - 不依赖 Maven
# 直接从 Maven 中央仓库下载所有必需的 JAR

set -e

cd "$(dirname "$0")"

echo "====================================="
echo "跨服务补偿指令 API - 依赖下载"
echo "====================================="
echo ""

# 创建 lib 目录
mkdir -p lib
cd lib

# 检查下载工具
if command -v curl &> /dev/null; then
    DOWNLOAD_CMD="curl -sL -o"
elif command -v wget &> /dev/null; then
    DOWNLOAD_CMD="wget -q -O"
else
    echo "❌ 未找到 curl 或 wget，请先安装其中一个"
    exit 1
fi

download_jar() {
    local url="$1"
    local filename=$(basename "$url")
    if [ ! -f "$filename" ]; then
        echo "  下载: $filename"
        $DOWNLOAD_CMD "$filename" "$url"
    else
        echo "  已存在: $filename"
    fi
}

echo "📦 正在下载 Spring Boot 运行依赖..."
echo ""

# Spring Boot 核心
MAVEN_BASE="https://repo1.maven.org/maven2"

# Spring Boot 2.7.18
download_jar "$MAVEN_BASE/org/springframework/boot/spring-boot/2.7.18/spring-boot-2.7.18.jar"
download_jar "$MAVEN_BASE/org/springframework/boot/spring-boot-autoconfigure/2.7.18/spring-boot-autoconfigure-2.7.18.jar"
download_jar "$MAVEN_BASE/org/springframework/boot/spring-boot-starter/2.7.18/spring-boot-starter-2.7.18.jar"
download_jar "$MAVEN_BASE/org/springframework/boot/spring-boot-starter-web/2.7.18/spring-boot-starter-web-2.7.18.jar"
download_jar "$MAVEN_BASE/org/springframework/boot/spring-boot-starter-data-jpa/2.7.18/spring-boot-starter-data-jpa-2.7.18.jar"
download_jar "$MAVEN_BASE/org/springframework/boot/spring-boot-starter-validation/2.7.18/spring-boot-starter-validation-2.7.18.jar"

# Spring Framework 5.3.24
download_jar "$MAVEN_BASE/org/springframework/spring-core/5.3.24/spring-core-5.3.24.jar"
download_jar "$MAVEN_BASE/org/springframework/spring-beans/5.3.24/spring-beans-5.3.24.jar"
download_jar "$MAVEN_BASE/org/springframework/spring-context/5.3.24/spring-context-5.3.24.jar"
download_jar "$MAVEN_BASE/org/springframework/spring-web/5.3.24/spring-web-5.3.24.jar"
download_jar "$MAVEN_BASE/org/springframework/spring-webmvc/5.3.24/spring-webmvc-5.3.24.jar"
download_jar "$MAVEN_BASE/org/springframework/spring-expression/5.3.24/spring-expression-5.3.24.jar"
download_jar "$MAVEN_BASE/org/springframework/spring-aop/5.3.24/spring-aop-5.3.24.jar"
download_jar "$MAVEN_BASE/org/springframework/spring-tx/5.3.24/spring-tx-5.3.24.jar"
download_jar "$MAVEN_BASE/org/springframework/spring-orm/5.3.24/spring-orm-5.3.24.jar"
download_jar "$MAVEN_BASE/org/springframework/spring-jdbc/5.3.24/spring-jdbc-5.3.24.jar"

# Spring Data
download_jar "$MAVEN_BASE/org/springframework/data/spring-data-jpa/2.7.11/spring-data-jpa-2.7.11.jar"
download_jar "$MAVEN_BASE/org/springframework/data/spring-data-commons/2.7.11/spring-data-commons-2.7.11.jar"

# Persistence API
download_jar "$MAVEN_BASE/javax/persistence/javax.persistence-api/2.2/javax.persistence-api-2.2.jar"
download_jar "$MAVEN_BASE/javax/validation/validation-api/2.0.1.Final/validation-api-2.0.1.Final.jar"

# Hibernate
download_jar "$MAVEN_BASE/org/hibernate/hibernate-core/5.6.15.Final/hibernate-core-5.6.15.Final.jar"

# H2 Database
download_jar "$MAVEN_BASE/com/h2database/h2/2.1.214/h2-2.1.214.jar"

# Jackson JSON
download_jar "$MAVEN_BASE/com/fasterxml/jackson/core/jackson-databind/2.13.5/jackson-databind-2.13.5.jar"
download_jar "$MAVEN_BASE/com/fasterxml/jackson/core/jackson-core/2.13.5/jackson-core-2.13.5.jar"
download_jar "$MAVEN_BASE/com/fasterxml/jackson/core/jackson-annotations/2.13.5/jackson-annotations-2.13.5.jar"
download_jar "$MAVEN_BASE/com/fasterxml/jackson/datatype/jackson-datatype-jsr310/2.13.5/jackson-datatype-jsr310-2.13.5.jar"

# Tomcat Embedded
download_jar "$MAVEN_BASE/org/apache/tomcat/embed/tomcat-embed-core/9.0.70/tomcat-embed-core-9.0.70.jar"
download_jar "$MAVEN_BASE/org/apache/tomcat/embed/tomcat-embed-el/9.0.70/tomcat-embed-el-9.0.70.jar"
download_jar "$MAVEN_BASE/org/apache/tomcat/embed/tomcat-embed-websocket/9.0.70/tomcat-embed-websocket-9.0.70.jar"

# Logging
download_jar "$MAVEN_BASE/org/slf4j/slf4j-api/1.7.36/slf4j-api-1.7.36.jar"
download_jar "$MAVEN_BASE/ch/qos/logback/logback-classic/1.2.11/logback-classic-1.2.11.jar"
download_jar "$MAVEN_BASE/ch/qos/logback/logback-core/1.2.11/logback-core-1.2.11.jar"

# 其他依赖
download_jar "$MAVEN_BASE/javax/annotation/javax.annotation-api/1.3.2/javax.annotation-api-1.3.2.jar"
download_jar "$MAVEN_BASE/org/jboss/logging/jboss-logging/3.4.3.Final/jboss-logging-3.4.3.Final.jar"
download_jar "$MAVEN_BASE/com/fasterxml/classmate/1.5.1/classmate-1.5.1.jar"
download_jar "$MAVEN_BASE/net/bytebuddy/byte-buddy/1.12.23/byte-buddy-1.12.23.jar"
download_jar "$MAVEN_BASE/org/glassfish/jakarta.el/3.0.3/jakarta.el-3.0.3.jar"
download_jar "$MAVEN_BASE/org/javassist/javassist/3.27.0-GA/javassist-3.27.0-GA.jar"

echo ""
echo "✅ 所有依赖下载完成！"
echo "   共下载: $(ls -1 *.jar 2>/dev/null | wc -l | tr -d ' ') 个文件"
echo ""
