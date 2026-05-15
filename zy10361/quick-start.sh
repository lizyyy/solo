#!/bin/bash
# 跨服务补偿指令 API - 快速启动脚本
# 功能：自动处理 Lombok 移除、编译、启动
# 使用方法：./quick-start.sh

set -e

cd "$(dirname "$0")"

echo "====================================="
echo "跨服务补偿指令 API - 快速启动"
echo "====================================="
echo ""

# 步骤 1: 移除 Lombok 依赖（如果需要）
echo "📝 步骤 1: 清理代码依赖..."
if [ -f "remove-lombok.sh" ]; then
    bash remove-lombok.sh
else
    echo "⚠️  remove-lombok.sh 不存在，跳过"
fi

# 步骤 2: 更新 pom.xml，确保 Java 8 兼容
echo ""
echo "⚙️  步骤 2: 更新 Maven 配置..."
sed -i.bak 's/<java.version>11<\/java.version>/<java.version>1.8<\/java.version>/g' pom.xml 2>/dev/null || true
rm -f pom.xml.bak

# 步骤 3: 检查是否有 mvnw，如果没有则创建
if [ ! -f "mvnw" ]; then
    echo ""
    echo "📦 步骤 3: 创建 Maven Wrapper..."
    if command -v mvn &> /dev/null; then
        mvn -N io.takari:maven:0.7.7:wrapper -Dmaven=3.6.3
    else
        echo "⚠️  系统没有 Maven，正在手动创建 wrapper..."
        # 创建最小化的 mvnw
        cat > mvnw << 'MVNW'
#!/bin/bash
MAVEN_VERSION="3.9.5"
MAVEN_HOME="$HOME/.m2/wrapper/dists/apache-maven-$MAVEN_VERSION"
if [ ! -d "$MAVEN_HOME" ]; then
    echo "下载 Maven $MAVEN_VERSION..."
    mkdir -p "$HOME/.m2/wrapper/dists"
    curl -sL "https://archive.apache.org/dist/maven/maven-3/$MAVEN_VERSION/binaries/apache-maven-$MAVEN_VERSION-bin.tar.gz" | tar -xz -C "$HOME/.m2/wrapper/dists"
fi
export M2_HOME="$MAVEN_HOME/apache-maven-$MAVEN_VERSION"
export PATH="$M2_HOME/bin:$PATH"
mvn "$@"
MVNW
        chmod +x mvnw
    fi
fi

# 步骤 4: 清理旧的 class 文件
echo ""
echo "🧹 步骤 4: 清理旧编译文件..."
rm -rf target/classes target/test-classes

# 步骤 5: 编译并启动
echo ""
echo "🚀 步骤 5: 编译并启动服务..."
echo ""
echo "首次启动需要下载依赖，请耐心等待..."
echo ""

./mvnw spring-boot:run -DskipTests -q
