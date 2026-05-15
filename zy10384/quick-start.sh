#!/bin/bash
# =====================================================
# 资源标签继承 API - 快速启动脚本
# 不依赖 Maven！自动下载依赖并编译运行
# 兼容 Java 8+
# =====================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "  资源标签继承 API - 快速启动"
echo "=========================================="
echo ""

# 检查 Java
if ! command -v java >/dev/null 2>&1; then
  echo "❌ 错误: 未找到 Java，请先安装 JDK 8 或更高版本"
  exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1)
echo "✅ $JAVA_VERSION"
echo ""

# 创建必要的目录
mkdir -p lib target/classes

# 下载核心依赖（如果不存在）
MAVEN_REPO="https://repo1.maven.org/maven2"

download_dep() {
  local path="$1"
  local filename="$2"
  if [ ! -f "lib/$filename" ]; then
    echo "📦 下载: $filename"
    curl -s -L -o "lib/$filename" "$MAVEN_REPO/$path"
  fi
}

echo "📋 检查依赖..."

# Spring Boot 2.7.18 + 相关依赖
download_dep "org/springframework/boot/spring-boot-starter-web/2.7.18/spring-boot-starter-web-2.7.18.jar" "spring-boot-starter-web-2.7.18.jar"
download_dep "org/springframework/boot/spring-boot-starter-data-jpa/2.7.18/spring-boot-starter-data-jpa-2.7.18.jar" "spring-boot-starter-data-jpa-2.7.18.jar"
download_dep "org/springframework/boot/spring-boot-starter-validation/2.7.18/spring-boot-starter-validation-2.7.18.jar" "spring-boot-starter-validation-2.7.18.jar"
download_dep "org/springframework/boot/spring-boot/2.7.18/spring-boot-2.7.18.jar" "spring-boot-2.7.18.jar"
download_dep "org/springframework/boot/spring-boot-autoconfigure/2.7.18/spring-boot-autoconfigure-2.7.18.jar" "spring-boot-autoconfigure-2.7.18.jar"

# Spring Framework
download_dep "org/springframework/spring-core/5.3.24/spring-core-5.3.24.jar" "spring-core-5.3.24.jar"
download_dep "org/springframework/spring-context/5.3.24/spring-context-5.3.24.jar" "spring-context-5.3.24.jar"
download_dep "org/springframework/spring-beans/5.3.24/spring-beans-5.3.24.jar" "spring-beans-5.3.24.jar"
download_dep "org/springframework/spring-web/5.3.24/spring-web-5.3.24.jar" "spring-web-5.3.24.jar"
download_dep "org/springframework/spring-webmvc/5.3.24/spring-webmvc-5.3.24.jar" "spring-webmvc-5.3.24.jar"
download_dep "org/springframework/spring-aop/5.3.24/spring-aop-5.3.24.jar" "spring-aop-5.3.24.jar"
download_dep "org/springframework/spring-jcl/5.3.24/spring-jcl-5.3.24.jar" "spring-jcl-5.3.24.jar"

# Lombok
download_dep "org/projectlombok/lombok/1.18.30/lombok-1.18.30.jar" "lombok-1.18.30.jar"

# H2 Database
download_dep "com/h2database/h2/2.1.214/h2-2.1.214.jar" "h2-2.1.214.jar"

# Jackson
download_dep "com/fasterxml/jackson/core/jackson-databind/2.13.4/jackson-databind-2.13.4.jar" "jackson-databind-2.13.4.jar"
download_dep "com/fasterxml/jackson/core/jackson-core/2.13.4/jackson-core-2.13.4.jar" "jackson-core-2.13.4.jar"
download_dep "com/fasterxml/jackson/core/jackson-annotations/2.13.4/jackson-annotations-2.13.4.jar" "jackson-annotations-2.13.4.jar"

# 构建 classpath
CLASSPATH="target/classes"
for jar in lib/*.jar; do
  CLASSPATH="$CLASSPATH:$jar"
done

echo ""
echo "🔨 编译源代码..."

# 查找所有 Java 文件
JAVA_FILES=$(find src/main/java -name "*.java" | tr '\n' ' ')

# 使用 Lombok 编译
javac -cp "$CLASSPATH" \
  -proc:full \
  -processorpath lib/lombok-1.18.30.jar \
  -d target/classes \
  -source 8 -target 8 \
  -Xlint:-options \
  $JAVA_FILES 2>&1 | grep -v "^注" || true

echo "✅ 编译完成！"
echo ""
echo "🚀 启动应用..."
echo "   API 地址: http://localhost:8080"
echo "   H2 控制台: http://localhost:8080/h2-console"
echo ""
echo "按 Ctrl+C 停止"
echo ""

# 运行应用
java -cp "$CLASSPATH" com.resource.tag.TagInheritanceApplication
