#!/bin/bash
# ============================================================================
# 批处理优先级队列 API - 直接启动脚本
# ============================================================================
# 功能: 直接使用 JRE 启动服务，无需 Maven 打包
# 前置: 1. 运行 ./download_deps.sh 下载依赖
#       2. 类文件已编译在 target/classes
# ============================================================================

set -e

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
LIB_DIR="$PROJECT_DIR/lib"
CLASSES_DIR="$PROJECT_DIR/target/classes"

echo "╔═══════════════════════════════════════════════════════════════╗"
echo "║           批处理优先级队列 API - 服务启动                      ║"
echo "╚═══════════════════════════════════════════════════════════════╝"
echo ""

# 检查依赖
if [ ! -d "$LIB_DIR" ] || [ -z "$(ls "$LIB_DIR"/*.jar 2>/dev/null)" ]; then
    echo "⚠️  依赖未下载，正在自动下载..."
    cd "$PROJECT_DIR"
    ./download_deps.sh
    echo ""
fi

# 检查类文件
if [ ! -d "$CLASSES_DIR" ]; then
    echo "❌ 类文件不存在: $CLASSES_DIR"
    echo "   请先编译或重新获取项目"
    exit 1
fi

# 构建 classpath
CLASSPATH="$CLASSES_DIR"
for jar in "$LIB_DIR"/*.jar; do
    CLASSPATH="$CLASSPATH:$jar"
done

echo "📊 启动信息:"
echo "   类目录: $CLASSES_DIR"
echo "   依赖数: $(ls "$LIB_DIR"/*.jar 2>/dev/null | wc -l | tr -d ' ') JARs"
echo ""
echo "🚀 启动服务..."
echo "   API 地址: http://localhost:8080/api/tasks"
echo "   H2 控制台: http://localhost:8080/h2-console"
echo ""
echo "   按 Ctrl+C 停止服务"
echo ""
echo "════════════════════════════════════════════════════════════════"
echo ""

# 启动 Spring Boot
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
    com.batchqueue.PriorityQueueApplication
