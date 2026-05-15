#!/bin/bash
# ============================================================================
# 仅下载所有依赖，不启动服务
# ============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIB_DIR="$PROJECT_DIR/lib"
MAVEN_REPO="https://repo1.maven.org/maven2"
LOCAL_M2="$HOME/.m2/repository"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║           批处理优先级队列 API - 依赖下载                      ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

mkdir -p "$LIB_DIR"

dependencies=(
    "org/springframework/boot/spring-boot/2.7.18/spring-boot-2.7.18.jar"
    "org/springframework/boot/spring-boot-autoconfigure/2.7.18/spring-boot-autoconfigure-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter/2.7.18/spring-boot-starter-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-web/2.7.18/spring-boot-starter-web-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-json/2.7.18/spring-boot-starter-json-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-tomcat/2.7.18/spring-boot-starter-tomcat-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-data-jpa/2.7.18/spring-boot-starter-data-jpa-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-jdbc/2.7.18/spring-boot-starter-jdbc-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-aop/2.7.18/spring-boot-starter-aop-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-validation/2.7.18/spring-boot-starter-validation-2.7.18.jar"
    "org/springframework/spring-core/5.3.31/spring-core-5.3.31.jar"
    "org/springframework/spring-beans/5.3.31/spring-beans-5.3.31.jar"
    "org/springframework/spring-context/5.3.31/spring-context-5.3.31.jar"
    "org/springframework/spring-web/5.3.31/spring-web-5.3.31.jar"
    "org/springframework/spring-webmvc/5.3.31/spring-webmvc-5.3.31.jar"
    "org/springframework/spring-aop/5.3.31/spring-aop-5.3.31.jar"
    "org/springframework/spring-tx/5.3.31/spring-tx-5.3.31.jar"
    "org/springframework/spring-jdbc/5.3.31/spring-jdbc-5.3.31.jar"
    "org/springframework/spring-orm/5.3.31/spring-orm-5.3.31.jar"
    "org/springframework/spring-expression/5.3.31/spring-expression-5.3.31.jar"
    "org/springframework/spring-jcl/5.3.31/spring-jcl-5.3.31.jar"
    "org/springframework/data/spring-data-jpa/2.7.18/spring-data-jpa-2.7.18.jar"
    "org/springframework/data/spring-data-commons/2.7.18/spring-data-commons-2.7.18.jar"
    "org/hibernate/hibernate-core/5.6.15.Final/hibernate-core-5.6.15.Final.jar"
    "org/hibernate/common/hibernate-commons-annotations/5.1.2.Final/hibernate-commons-annotations-5.1.2.Final.jar"
    "net/bytebuddy/byte-buddy/1.12.23/byte-buddy-1.12.23.jar"
    "org/jboss/jandex/2.4.3.Final/jandex-2.4.3.Final.jar"
    "com/fasterxml/classmate/1.5.1/classmate-1.5.1.jar"
    "org/jboss/logging/jboss-logging/3.4.3.Final/jboss-logging-3.4.3.Final.jar"
    "jakarta/persistence/jakarta.persistence-api/2.2.3/jakarta.persistence-api-2.2.3.jar"
    "jakarta/transaction/jakarta.transaction-api/1.3.3/jakarta.transaction-api-1.3.3.jar"
    "javax/validation/javax.validation-api/2.0.1.Final/javax.validation-api-2.0.1.Final.jar"
    "jakarta/annotation/jakarta.annotation-api/1.3.5/jakarta.annotation-api-1.3.5.jar"
    "jakarta/xml/bind/jakarta.xml.bind-api/2.3.3/jakarta.xml.bind-api-2.3.3.jar"
    "org/hibernate/validator/hibernate-validator/6.2.5.Final/hibernate-validator-6.2.5.Final.jar"
    "org/glassfish/jakarta.el/3.0.3/jakarta.el-3.0.3.jar"
    "com/fasterxml/jackson/core/jackson-core/2.13.5/jackson-core-2.13.5.jar"
    "com/fasterxml/jackson/core/jackson-databind/2.13.5/jackson-databind-2.13.5.jar"
    "com/fasterxml/jackson/core/jackson-annotations/2.13.5/jackson-annotations-2.13.5.jar"
    "com/fasterxml/jackson/datatype/jackson-datatype-jsr310/2.13.5/jackson-datatype-jsr310-2.13.5.jar"
    "com/fasterxml/jackson/module/jackson-module-parameter-names/2.13.5/jackson-module-parameter-names-2.13.5.jar"
    "org/apache/tomcat/embed/tomcat-embed-core/9.0.83/tomcat-embed-core-9.0.83.jar"
    "org/apache/tomcat/embed/tomcat-embed-el/9.0.83/tomcat-embed-el-9.0.83.jar"
    "org/apache/tomcat/embed/tomcat-embed-websocket/9.0.83/tomcat-embed-websocket-9.0.83.jar"
    "com/h2database/h2/2.1.214/h2-2.1.214.jar"
    "com/zaxxer/HikariCP/4.0.3/HikariCP-4.0.3.jar"
    "ch/qos/logback/logback-classic/1.2.12/logback-classic-1.2.12.jar"
    "ch/qos/logback/logback-core/1.2.12/logback-core-1.2.12.jar"
    "org/slf4j/slf4j-api/1.7.36/slf4j-api-1.7.36.jar"
    "org/yaml/snakeyaml/1.30/snakeyaml-1.30.jar"
    "org/aspectj/aspectjweaver/1.9.7/aspectjweaver-1.9.7.jar"
    "antlr/antlr/2.7.7/antlr-2.7.7.jar"
)

total=${#dependencies[@]}
count=0
downloaded=0
cached=0

echo "📦 开始下载 $total 个依赖..."
echo ""

for dep in "${dependencies[@]}"; do
    count=$((count + 1))
    filename=$(basename "$dep")
    
    # 先检查本地 Maven 仓库
    local_jar="$LOCAL_M2/$dep"
    if [ -f "$local_jar" ]; then
        if [ ! -f "$LIB_DIR/$filename" ]; then
            cp "$local_jar" "$LIB_DIR/"
        fi
        cached=$((cached + 1))
        printf "\r   [%3d/%d] 💾 本地缓存: %-45s" "$count" "$total" "$filename"
        continue
    fi
    
    # 检查是否已下载
    if [ -f "$LIB_DIR/$filename" ]; then
        cached=$((cached + 1))
        printf "\r   [%3d/%d] ✅ 已存在: %-45s" "$count" "$total" "$filename"
        continue
    fi
    
    # 下载
    printf "\r   [%3d/%d] 📥 下载中: %-45s" "$count" "$total" "$filename"
    curl -s -L -o "$LIB_DIR/$filename" "$MAVEN_REPO/$dep" 2>/dev/null && {
        downloaded=$((downloaded + 1))
    }
done

echo ""
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ 依赖下载完成!"
echo "   本地缓存: $cached 个"
echo "   新下载:   $downloaded 个"
echo "   目录:     $LIB_DIR"
echo "   总计:     $(ls "$LIB_DIR"/*.jar 2>/dev/null | wc -l | tr -d ' ') 个 JAR 文件"
echo ""
echo "🚀 现在可以运行: ./完整启动.sh 启动服务"
echo "════════════════════════════════════════════════════════════════"
