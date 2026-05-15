#!/bin/bash
# 数据修复脚本审批API - 启动脚本

echo "=========================================="
echo "  数据修复脚本审批API - 启动脚本"
echo "=========================================="
echo ""

# 检查Java环境
if ! command -v java &> /dev/null; then
    echo "❌ 错误: 未找到Java，请先安装JDK 11+"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1 | awk -F'"' '{print $2}' | cut -d'.' -f1)
echo "✅ Java版本: $(java -version 2>&1 | head -n 1)"

# 检查Maven环境
if ! command -v mvn &> /dev/null; then
    echo "❌ 错误: 未找到Maven，请先安装Maven 3.6+"
    exit 1
fi
echo "✅ Maven版本: $(mvn -version | head -n 1)"
echo ""

# 设置数据库配置（默认使用H2，无需外部依赖）
PROFILE=${1:-h2}
echo "▶ 使用环境配置: $PROFILE"
echo ""

# 检查是否存在jar包，不存在则先编译
if [ ! -f "target/data-repair-approval-api-1.0.0-SNAPSHOT.jar" ]; then
    echo "▶ 开始编译项目..."
    mvn clean package -DskipTests -q
    if [ $? -ne 0 ]; then
        echo "❌ 编译失败，请检查代码"
        exit 1
    fi
    echo "✅ 编译完成"
    echo ""
fi

# 启动应用
echo "▶ 启动应用服务 (profile: $PROFILE)..."
echo "  API地址: http://localhost:8080/api"
echo "  H2控制台: http://localhost:8080/api/h2-console (仅h2模式)"
echo ""
echo "  按 Ctrl+C 停止服务"
echo "=========================================="
echo ""

java -jar target/data-repair-approval-api-1.0.0-SNAPSHOT.jar \
    --spring.profiles.active=$PROFILE
