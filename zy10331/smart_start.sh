#!/bin/bash
# ============================================================================
# 智能启动脚本 - 自动从本地 Maven 仓库收集依赖
# ============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIB_DIR="$PROJECT_DIR/lib"
MAVEN_REPO="$HOME/.m2/repository"
CLASSES_DIR="$PROJECT_DIR/target/classes"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║         批处理优先级队列 API - 智能启动模式                    ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# 检查类文件
if [ ! -d "$CLASSES_DIR" ]; then
    echo "❌ 类文件不存在: $CLASSES_DIR"
    exit 1
fi

mkdir -p "$LIB_DIR"

# 从本地 Maven 仓库复制核心依赖
echo "📦 从本地 Maven 仓库收集依赖..."

dependencies=(
    "org/springframework/boot/spring-boot/2.7.18/spring-boot-2.7.18.jar"
    "org/springframework/boot/spring-boot-autoconfigure/2.7.18/spring-boot-autoconfigure-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-web/2.7.18/spring-boot-starter-web-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter/2.7.18/spring-boot-starter-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-json/2.7.18/spring-boot-starter-json-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-tomcat/2.7.18/spring-boot-starter-tomcat-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-data-jpa/2.7.18/spring-boot-starter-data-jpa-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-jdbc/2.7.18/spring-boot-starter-jdbc-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-validation/2.7.18/spring-boot-starter-validation-2.7.18.jar"
    "org/springframework/spring-core/5.3.31/spring-core-5.3.31.jar"
    "org/springframework/spring-beans/5.3.31/spring-beans-5.3.31.jar"
    "org/springframework/spring-context/5.3.31/spring-context-5.3.31.jar"
    "org/springframework/spring-web/5.3.31/spring-web-5.3.31.jar"
    "org/springframework/spring-webmvc/5.3.31/spring-webmvc-5.3.31.jar"
    "org/springframework/spring-aop/5.3.31/spring-aop-5.3.31.jar"
    "org/springframework/spring-tx/5.3.31/spring-tx-5.3.31.jar"
    "org/springframework/spring-jdbc/5.3.31/spring-jdbc-5.3.31.jar"
    "org/springframework/spring-expression/5.3.31/spring-expression-5.3.31.jar"
    "org/springframework/spring-jcl/5.3.31/spring-jcl-5.3.31.jar"
    "org/springframework/data/spring-data-jpa/2.7.18/spring-data-jpa-2.7.18.jar"
    "org/springframework/data/spring-data-commons/2.7.18/spring-data-commons-2.7.18.jar"
    "com/h2database/h2/2.1.214/h2-2.1.214.jar"
    "com/zaxxer/HikariCP/4.0.3/HikariCP-4.0.3.jar"
    "org/yaml/snakeyaml/1.30/snakeyaml-1.30.jar"
    "com/fasterxml/jackson/core/jackson-core/2.13.5/jackson-core-2.13.5.jar"
    "com/fasterxml/jackson/core/jackson-databind/2.13.5/jackson-databind-2.13.5.jar"
    "com/fasterxml/jackson/core/jackson-annotations/2.13.5/jackson-annotations-2.13.5.jar"
    "com/fasterxml/jackson/datatype/jackson-datatype-jsr310/2.13.5/jackson-datatype-jsr310-2.13.5.jar"
    "org/apache/tomcat/embed/tomcat-embed-core/9.0.83/tomcat-embed-core-9.0.83.jar"
    "org/apache/tomcat/embed/tomcat-embed-el/9.0.83/tomcat-embed-el-9.0.83.jar"
    "org/apache/tomcat/embed/tomcat-embed-websocket/9.0.83/tomcat-embed-websocket-9.0.83.jar"
    "ch/qos/logback/logback-classic/1.2.12/logback-classic-1.2.12.jar"
    "ch/qos/logback/logback-core/1.2.12/logback-core-1.2.12.jar"
    "org/slf4j/slf4j-api/1.7.36/slf4j-api-1.7.36.jar"
    "org/hibernate/hibernate-core/5.6.15.Final/hibernate-core-5.6.15.Final.jar"
    "javax/validation/javax.validation-api/2.0.1.Final/javax.validation-api-2.0.1.Final.jar"
    "org/hibernate/validator/hibernate-validator/6.2.5.Final/hibernate-validator-6.2.5.Final.jar"
    "org/jboss/logging/jboss-logging/3.4.3.Final/jboss-logging-3.4.3.Final.jar"
    "com/fasterxml/classmate/1.5.1/classmate-1.5.1.jar"
    "org/glassfish/jakarta.el/3.0.3/jakarta.el-3.0.3.jar"
    "jakarta/persistence/jakarta.persistence-api/2.2.3/jakarta.persistence-api-2.2.3.jar"
    "jakarta/transaction/jakarta.transaction-api/1.3.3/jakarta.transaction-api-1.3.3.jar"
    "net/bytebuddy/byte-buddy/1.12.23/byte-buddy-1.12.23.jar"
    "org/aspectj/aspectjweaver/1.9.7/aspectjweaver-1.9.7.jar"
    "org/jboss/jandex/2.4.3.Final/jandex-2.4.3.Final.jar"
    "antlr/antlr/2.7.7/antlr-2.7.7.jar"
    "org/hibernate/common/hibernate-commons-annotations/5.1.2.Final/hibernate-commons-annotations-5.1.2.Final.jar"
)

count=0
missing=0
for dep in "${dependencies[@]}"; do
    src="$MAVEN_REPO/$dep"
    filename=$(basename "$dep")
    if [ -f "$src" ]; then
        if [ ! -f "$LIB_DIR/$filename" ]; then
            cp "$src" "$LIB_DIR/"
        fi
        count=$((count + 1))
    else
        missing=$((missing + 1))
    fi
done

echo "   ✅ 已收集 $count 个依赖"
if [ $missing -gt 0 ]; then
    echo "   ⚠️  $missing 个依赖在本地仓库中未找到"
    echo "   运行 ./download_deps.sh 下载所有依赖"
fi
echo ""

# 构建 classpath
CLASSPATH="$CLASSES_DIR"
for jar in "$LIB_DIR"/*.jar; do
    CLASSPATH="$CLASSPATH:$jar"
done

echo "🚀 启动服务..."
echo "   API 地址: http://localhost:8080/api/tasks"
echo "   H2 控制台: http://localhost:8080/h2-console"
echo "   JDBC URL: jdbc:h2:file:./data/batchqueue"
echo "   用户名: sa"
echo "   密码: (空)"
echo ""
echo "   按 Ctrl+C 停止服务"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""

# 启动 Spring Boot
cd "$PROJECT_DIR"
exec java \
    -cp "$CLASSPATH" \
    -Dspring.jpa.hibernate.ddl-auto=update \
    -Dspring.datasource.url=jdbc:h2:file:./data/batchqueue \
    -Dspring.datasource.driver-class-name=org.h2.Driver \
    -Dspring.datasource.username=sa \
    -Dspring.datasource.password= \
    -Dspring.h2.console.enabled=true \
    -Dspring.h2.console.path=/h2-console \
    -Dserver.port=8080 \
    -Dlogging.level.root=INFO \
    -Dlogging.level.com.batchqueue=DEBUG \
    com.batchqueue.PriorityQueueApplication
