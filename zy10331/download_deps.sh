#!/bin/bash
# ============================================================================
# 依赖下载脚本 - 无需 Maven，直接下载所有 JAR 到 lib 目录
# ============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIB_DIR="$PROJECT_DIR/lib"
MAVEN_REPO="https://repo1.maven.org/maven2"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║              批处理优先级队列 API - 依赖下载                    ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

mkdir -p "$LIB_DIR"

# 依赖列表
dependencies=(
    # Spring Boot 核心
    "org/springframework/boot/spring-boot/2.7.18/spring-boot-2.7.18.jar"
    "org/springframework/boot/spring-boot-autoconfigure/2.7.18/spring-boot-autoconfigure-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter/2.7.18/spring-boot-starter-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-web/2.7.18/spring-boot-starter-web-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-json/2.7.18/spring-boot-starter-json-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-tomcat/2.7.18/spring-boot-starter-tomcat-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-validation/2.7.18/spring-boot-starter-validation-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-data-jpa/2.7.18/spring-boot-starter-data-jpa-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-aop/2.7.18/spring-boot-starter-aop-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-jdbc/2.7.18/spring-boot-starter-jdbc-2.7.18.jar"
    
    # Spring Framework
    "org/springframework/spring-core/5.3.31/spring-core-5.3.31.jar"
    "org/springframework/spring-beans/5.3.31/spring-beans-5.3.31.jar"
    "org/springframework/spring-context/5.3.31/spring-context-5.3.31.jar"
    "org/springframework/spring-web/5.3.31/spring-web-5.3.31.jar"
    "org/springframework/spring-webmvc/5.3.31/spring-webmvc-5.3.31.jar"
    "org/springframework/spring-aop/5.3.31/spring-aop-5.3.31.jar"
    "org/springframework/spring-tx/5.3.31/spring-tx-5.3.31.jar"
    "org/springframework/spring-jdbc/5.3.31/spring-jdbc-5.3.31.jar"
    "org/springframework/spring-expression/5.3.31/spring-expression-5.3.31.jar"
    
    # Spring Data JPA
    "org/springframework/data/spring-data-jpa/2.7.18/spring-data-jpa-2.7.18.jar"
    "org/springframework/data/spring-data-commons/2.7.18/spring-data-commons-2.7.18.jar"
    
    # Hibernate
    "org/hibernate/hibernate-core/5.6.15.Final/hibernate-core-5.6.15.Final.jar"
    "org/hibernate/common/hibernate-commons-annotations/5.1.2.Final/hibernate-commons-annotations-5.1.2.Final.jar"
    
    # Jackson
    "com/fasterxml/jackson/core/jackson-core/2.13.5/jackson-core-2.13.5.jar"
    "com/fasterxml/jackson/core/jackson-databind/2.13.5/jackson-databind-2.13.5.jar"
    "com/fasterxml/jackson/core/jackson-annotations/2.13.5/jackson-annotations-2.13.5.jar"
    "com/fasterxml/jackson/datatype/jackson-datatype-jsr310/2.13.5/jackson-datatype-jsr310-2.13.5.jar"
    
    # Tomcat
    "org/apache/tomcat/embed/tomcat-embed-core/9.0.83/tomcat-embed-core-9.0.83.jar"
    "org/apache/tomcat/embed/tomcat-embed-el/9.0.83/tomcat-embed-el-9.0.83.jar"
    "org/apache/tomcat/embed/tomcat-embed-websocket/9.0.83/tomcat-embed-websocket-9.0.83.jar"
    
    # H2 Database
    "com/h2database/h2/2.1.214/h2-2.1.214.jar"
    
    # Validation
    "org/hibernate/validator/hibernate-validator/6.2.5.Final/hibernate-validator-6.2.5.Final.jar"
    "javax/validation/javax.validation-api/2.0.1.Final/javax.validation-api-2.0.1.Final.jar"
    "org/jboss/logging/jboss-logging/3.4.3.Final/jboss-logging-3.4.3.Final.jar"
    
    # Lombok (runtime only)
    "org/projectlombok/lombok/1.18.30/lombok-1.18.30.jar"
    
    # Logging
    "ch/qos/logback/logback-classic/1.2.12/logback-classic-1.2.12.jar"
    "ch/qos/logback/logback-core/1.2.12/logback-core-1.2.12.jar"
    "org/slf4j/slf4j-api/1.7.36/slf4j-api-1.7.36.jar"
    
    # Utilities
    "org/yaml/snakeyaml/1.30/snakeyaml-1.30.jar"
    "com/zaxxer/HikariCP/4.0.3/HikariCP-4.0.3.jar"
    "jakarta/persistence/jakarta.persistence-api/2.2.3/jakarta.persistence-api-2.2.3.jar"
    "jakarta/transaction/jakarta.transaction-api/1.3.3/jakarta.transaction-api-1.3.3.jar"
    "org/jboss/jandex/2.4.3.Final/jandex-2.4.3.Final.jar"
    "com/fasterxml/classmate/1.5.1/classmate-1.5.1.jar"
    "net/bytebuddy/byte-buddy/1.12.23/byte-buddy-1.12.23.jar"
    "org/aspectj/aspectjweaver/1.9.7/aspectjweaver-1.9.7.jar"
    "org/springframework/spring-jcl/5.3.31/spring-jcl-5.3.31.jar"
    "antlr/antlr/2.7.7/antlr-2.7.7.jar"
    "org/glassfish/jakarta.el/3.0.3/jakarta.el-3.0.3.jar"
)

total=${#dependencies[@]}
count=0

for dep in "${dependencies[@]}"; do
    count=$((count + 1))
    filename=$(basename "$dep")
    
    if [ -f "$LIB_DIR/$filename" ]; then
        echo "[$count/$total] ✅ 已存在: $filename"
    else
        echo "[$count/$total] 📥 下载: $filename"
        curl -s -L -o "$LIB_DIR/$filename" "$MAVEN_REPO/$dep" || {
            echo "     ⚠️  下载失败，跳过"
        }
    fi
done

echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ 依赖下载完成！"
echo "   共下载 $(ls "$LIB_DIR"/*.jar 2>/dev/null | wc -l | tr -d ' ') 个 JAR 文件"
echo "   目录: $LIB_DIR"
echo ""
echo "🚀 下一步: 运行 ./start.sh 启动服务"
echo "════════════════════════════════════════════════════════════════"
