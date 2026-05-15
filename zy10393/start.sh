#!/bin/bash
# 数据修复脚本审批API - 启动脚本

set -e

echo "=========================================="
echo "  数据修复脚本审批API - 启动脚本"
echo "=========================================="
echo ""

# 获取脚本所在目录
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 检查Java环境
if ! command -v java &> /dev/null; then
    echo "❌ 错误: 未找到Java，请先安装JDK 8+"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1 | awk -F'"' '{print $2}' | cut -d'.' -f1)
echo "✅ Java版本: $(java -version 2>&1 | head -n 1)"

# 检查并设置MAVEN_HOME或使用mvnw
if command -v mvn &> /dev/null; then
    MAVEN_CMD="mvn"
    echo "✅ 使用系统Maven: $(mvn -version | head -n 1 | awk '{print $3}')"
elif [ -f "$SCRIPT_DIR/mvnw" ]; then
    chmod +x "$SCRIPT_DIR/mvnw" 2>/dev/null || true
    MAVEN_CMD="$SCRIPT_DIR/mvnw"
    echo "✅ 使用Maven Wrapper"
else
    echo "❌ 错误: 未找到Maven，且mvnw不存在"
    exit 1
fi
echo ""

# 设置数据库配置（默认使用H2，无需外部依赖）
PROFILE=${1:-h2}
echo "▶ 使用环境配置: $PROFILE"
echo ""

# 检查是否存在jar包，不存在则先编译
if [ ! -f "target/data-repair-approval-api-1.0.0-SNAPSHOT.jar" ]; then
    echo "▶ 开始编译项目..."
    $MAVEN_CMD clean package -DskipTests -q
    if [ $? -ne 0 ]; then
        echo "❌ 编译失败，请检查代码"
        exit 1
    fi
    echo "✅ 编译完成"
    echo ""
fi

# 检查端口是否被占用
if command -v lsof &> /dev/null; then
    if lsof -Pi :8080 -sTCP:LISTEN -t >/dev/null 2>&1; then
        echo "⚠️  警告: 端口8080已被占用，服务可能已在运行"
        echo ""
    fi
fi

# 启动应用
echo "▶ 启动应用服务 (profile: $PROFILE)..."
echo "  API地址: http://localhost:8080/api"
echo "  健康检查: http://localhost:8080/api/health"
if [ "$PROFILE" = "h2" ]; then
    echo "  H2控制台: http://localhost:8080/api/h2-console"
fi
echo ""
echo "  按 Ctrl+C 停止服务"
echo "=========================================="
echo ""

java -jar target/data-repair-approval-api-1.0.0-SNAPSHOT.jar \
    --spring.profiles.active=$PROFILE
