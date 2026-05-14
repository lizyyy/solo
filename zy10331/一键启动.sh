#!/bin/bash
# ============================================================================
# 批处理优先级队列 API - 终极一键启动脚本
# ============================================================================
# 功能: 自动检测环境、收集依赖、启动服务
# 运行: chmod +x 一键启动.sh && ./一键启动.sh
# ============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIB_DIR="$PROJECT_DIR/lib"
MAVEN_REPO="$HOME/.m2/repository"
CLASSES_DIR="$PROJECT_DIR/target/classes"
FINAL_JAR="$PROJECT_DIR/target/priority-queue-api-1.0.0.jar"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║         批处理优先级队列 API - 一键启动                        ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# ============================================================================
# 第一步: 检查是否有编译好的 JAR
# ============================================================================
if [ -f "$FINAL_JAR" ]; then
    echo "✅ 发现可执行 JAR: $FINAL_JAR"
    echo "🚀 直接启动..."
    echo ""
    echo "   API 地址: http://localhost:8080/api/tasks"
    echo "   H2 控制台: http://localhost:8080/h2-console"
    echo ""
    exec java -jar "$FINAL_JAR"
    exit 0
fi

# ============================================================================
# 第二步: 检查类文件
# ============================================================================
if [ ! -d "$CLASSES_DIR" ]; then
    echo "❌ 类文件不存在"
    exit 1
fi

echo "✅ 类文件已编译 ($(find "$CLASSES_DIR" -name "*.class" | wc -l | tr -d ' ') 个类)"
echo ""

# ============================================================================
# 第三步: 收集依赖
# ============================================================================
echo "📦 收集依赖..."
mkdir -p "$LIB_DIR"

dependencies=(
    "org/springframework/boot/spring-boot/2.7.18/spring-boot-2.7.18.jar"
    "org/springframework/boot/spring-boot-autoconfigure/2.7.18/spring-boot-autoconfigure-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter-web/2.7.18/spring-boot-starter-web-2.7.18.jar"
    "org/springframework/boot/spring-boot-starter/2.7.18/spring-boot-starter-2.7.18.jar"
    "org/springframework/spring-core/5.3.31/spring-core-5.3.31.jar"
    "org/springframework/spring-beans/5.3.31/spring-beans-5.3.31.jar"
    "org/springframework/spring-context/5.3.31/spring-context-5.3.31.jar"
    "org/springframework/spring-web/5.3.31/spring-web-5.3.31.jar"
    "org/springframework/spring-webmvc/5.3.31/spring-webmvc-5.3.31.jar"
    "org/springframework/spring-expression/5.3.31/spring-expression-5.3.31.jar"
    "org/springframework/spring-jcl/5.3.31/spring-jcl-5.3.31.jar"
    "com/h2database/h2/2.1.214/h2-2.1.214.jar"
)

count=0
for dep in "${dependencies[@]}"; do
    src="$MAVEN_REPO/$dep"
    filename=$(basename "$dep")
    if [ -f "$src" ]; then
        if [ ! -f "$LIB_DIR/$filename" ]; then
            cp "$src" "$LIB_DIR/"
        fi
        count=$((count + 1))
    fi
done

echo "   ✅ 已收集 $count 个核心依赖"
echo ""

# ============================================================================
# 第四步: 构建 classpath 并启动
# ============================================================================
CLASSPATH="$CLASSES_DIR"
for jar in "$LIB_DIR"/*.jar; do
    CLASSPATH="$CLASSPATH:$jar"
done

echo "🚀 启动服务..."
echo "   API 地址: http://localhost:8080/api/tasks"
echo "   H2 控制台: http://localhost:8080/h2-console"
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
    -Dserver.port=8080 \
    com.batchqueue.PriorityQueueApplication
