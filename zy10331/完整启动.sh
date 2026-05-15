#!/bin/bash
# ============================================================================
# 批处理优先级队列 API - 完整依赖下载 + 启动脚本
# ============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIB_DIR="$PROJECT_DIR/lib"
CLASSES_DIR="$PROJECT_DIR/target/classes"
MAVEN_REPO="https://repo1.maven.org/maven2"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║       批处理优先级队列 API - 完整依赖下载 + 启动              ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================================
# 检查类文件
# ============================================================================
if [ ! -d "$CLASSES_DIR" ]; then
    echo "❌ 类文件不存在: $CLASSES_DIR"
    exit 1
fi

CLASS_COUNT=$(find "$CLASSES_DIR" -name "*.class" | wc -l | tr -d ' ')
echo "✅ 类文件已就绪 ($CLASS_COUNT 个类)"
echo ""

mkdir -p "$LIB_DIR"

# ============================================================================
# 完整依赖列表 - Spring Boot 2.7.18 + JPA
# ============================================================================
echo "📦 检查并下载依赖（共 50+ 个核心 JAR）..."
echo ""

dependencies=(
    # ===== Spring Boot 核心 =====
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
    
    # ===== Spring Framework 核心 =====
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
    
    # ===== Spring Data =====
    "org/springframework/data/spring-data-jpa/2.7.18/spring-data-jpa-2.7.18.jar"
    "org/springframework/data/spring-data-commons/2.7.18/spring-data-commons-2.7.18.jar"
    
    # ===== Hibernate ORM =====
    "org/hibernate/hibernate-core/5.6.15.Final/hibernate-core-5.6.15.Final.jar"
    "org/hibernate/common/hibernate-commons-annotations/5.1.2.Final/hibernate-commons-annotations-5.1.2.Final.jar"
    "net/bytebuddy/byte-buddy/1.12.23/byte-buddy-1.12.23.jar"
    "org/jboss/jandex/2.4.3.Final/jandex-2.4.3.Final.jar"
    "com/fasterxml/classmate/1.5.1/classmate-1.5.1.jar"
    "org/jboss/logging/jboss-logging/3.4.3.Final/jboss-logging-3.4.3.Final.jar"
    
    # ===== Jakarta / Java EE APIs =====
    "jakarta/persistence/jakarta.persistence-api/2.2.3/jakarta.persistence-api-2.2.3.jar"
    "jakarta/transaction/jakarta.transaction-api/1.3.3/jakarta.transaction-api-1.3.3.jar"
    "javax/validation/javax.validation-api/2.0.1.Final/javax.validation-api-2.0.1.Final.jar"
    "jakarta/annotation/jakarta.annotation-api/1.3.5/jakarta.annotation-api-1.3.5.jar"
    "jakarta/xml/bind/jakarta.xml.bind-api/2.3.3/jakarta.xml.bind-api-2.3.3.jar"
    
    # ===== 验证框架 =====
    "org/hibernate/validator/hibernate-validator/6.2.5.Final/hibernate-validator-6.2.5.Final.jar"
    "org/glassfish/jakarta.el/3.0.3/jakarta.el-3.0.3.jar"
    
    # ===== Jackson JSON =====
    "com/fasterxml/jackson/core/jackson-core/2.13.5/jackson-core-2.13.5.jar"
    "com/fasterxml/jackson/core/jackson-databind/2.13.5/jackson-databind-2.13.5.jar"
    "com/fasterxml/jackson/core/jackson-annotations/2.13.5/jackson-annotations-2.13.5.jar"
    "com/fasterxml/jackson/datatype/jackson-datatype-jsr310/2.13.5/jackson-datatype-jsr310-2.13.5.jar"
    "com/fasterxml/jackson/module/jackson-module-parameter-names/2.13.5/jackson-module-parameter-names-2.13.5.jar"
    
    # ===== Tomcat 嵌入 =====
    "org/apache/tomcat/embed/tomcat-embed-core/9.0.83/tomcat-embed-core-9.0.83.jar"
    "org/apache/tomcat/embed/tomcat-embed-el/9.0.83/tomcat-embed-el-9.0.83.jar"
    "org/apache/tomcat/embed/tomcat-embed-websocket/9.0.83/tomcat-embed-websocket-9.0.83.jar"
    
    # ===== 数据库 =====
    "com/h2database/h2/2.1.214/h2-2.1.214.jar"
    "com/zaxxer/HikariCP/4.0.3/HikariCP-4.0.3.jar"
    
    # ===== 日志 =====
    "ch/qos/logback/logback-classic/1.2.12/logback-classic-1.2.12.jar"
    "ch/qos/logback/logback-core/1.2.12/logback-core-1.2.12.jar"
    "org/slf4j/slf4j-api/1.7.36/slf4j-api-1.7.36.jar"
    
    # ===== 其他工具 =====
    "org/yaml/snakeyaml/1.30/snakeyaml-1.30.jar"
    "org/aspectj/aspectjweaver/1.9.7/aspectjweaver-1.9.7.jar"
    "antlr/antlr/2.7.7/antlr-2.7.7.jar"
)

total=${#dependencies[@]}
count=0
downloaded=0
cached=0

for dep in "${dependencies[@]}"; do
    count=$((count + 1))
    filename=$(basename "$dep")
    
    # 先检查本地 Maven 仓库
    local_jar="$HOME/.m2/repository/$dep"
    if [ -f "$local_jar" ]; then
        if [ ! -f "$LIB_DIR/$filename" ]; then
            cp "$local_jar" "$LIB_DIR/"
        fi
        cached=$((cached + 1))
        printf "\r   进度: [%3d/%d] 💾 本地缓存: %-50s" "$count" "$total" "$filename"
        continue
    fi
    
    # 检查是否已下载
    if [ -f "$LIB_DIR/$filename" ]; then
        cached=$((cached + 1))
        printf "\r   进度: [%3d/%d] ✅ 已存在: %-50s" "$count" "$total" "$filename"
        continue
    fi
    
    # 下载
    printf "\r   进度: [%3d/%d] 📥 下载中: %-50s" "$count" "$total" "$filename"
    curl -s -L -o "$LIB_DIR/$filename" "$MAVEN_REPO/$dep" 2>/dev/null && {
        downloaded=$((downloaded + 1))
    }
done

echo ""
echo ""
echo "════════════════════════════════════════════════════════════════"
echo "✅ 依赖处理完成!"
echo "   本地缓存: $cached 个"
echo "   新下载:   $downloaded 个"
echo "   总计:     $(ls "$LIB_DIR"/*.jar 2>/dev/null | wc -l | tr -d ' ') 个 JAR 文件"
echo "════════════════════════════════════════════════════════════════"
echo ""

# ============================================================================
# 构建 classpath
# ============================================================================
echo "🔧 构建 classpath..."
CLASSPATH="$CLASSES_DIR"
for jar in "$LIB_DIR"/*.jar; do
    CLASSPATH="$CLASSPATH:$jar"
done

# 检查关键类
echo ""
echo "🔍 验证关键依赖..."
check_deps=(
    "org/springframework/context/ApplicationContext"
    "org/springframework/boot/SpringApplication"
    "org/springframework/orm/jpa/support/PersistenceAnnotationBeanPostProcessor"
    "org/hibernate/Session"
)

all_ok=true
for dep in "${check_deps[@]}"; do
    class_file=$(echo "$dep" | tr '.' '/').class
    found=false
    
    # 检查 jar 中是否有该类
    for jar in "$LIB_DIR"/*.jar; do
        if unzip -l "$jar" 2>/dev/null | grep -q "$class_file"; then
            found=true
            break
        fi
    done
    
    if $found; then
        echo "   ✅ $dep"
    else
        echo "   ❌ $dep (缺失)"
        all_ok=false
    fi
done

echo ""
if ! $all_ok; then
    echo "⚠️  部分依赖缺失，尝试继续启动..."
    echo ""
fi

# ============================================================================
# 启动服务
# ============================================================================
echo "🚀 启动 Spring Boot 服务..."
echo ""
echo "   API 地址:  http://localhost:8080/api/tasks"
echo "   H2 控制台: http://localhost:8080/h2-console"
echo "   JDBC URL:  jdbc:h2:file:./data/batchqueue"
echo "   用户名:    sa"
echo "   密码:      (空)"
echo ""
echo "   按 Ctrl+C 停止服务"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""

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
    -Djava.awt.headless=true \
    com.batchqueue.PriorityQueueApplication
