#!/bin/bash
# 直接启动脚本（不依赖编译步骤）

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_DIR"

echo "========================================"
echo "  API 回放隐私预算 - 启动"
echo "========================================"

# 检查并设置权限
chmod +x mvnw 2>/dev/null || true

# 检查 wrapper jar
if [ ! -f ".mvn/wrapper/maven-wrapper.jar" ]; then
    echo "⚠️  Maven Wrapper 不存在，尝试下载..."
    curl -sL "https://repo1.maven.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar" -o .mvn/wrapper/maven-wrapper.jar
fi

echo "✅ Maven Wrapper 就绪"
echo "   文件大小: $(du -h .mvn/wrapper/maven-wrapper.jar | cut -f1)"
echo ""
echo "正在启动 Spring Boot 服务..."
echo "   首次启动会下载依赖，请耐心等待..."
echo "   服务地址: http://localhost:8080"
echo "   H2控制台: http://localhost:8080/h2-console"
echo "   按 Ctrl+C 停止服务"
echo "========================================"
echo ""

./mvnw spring-boot:run
