#!/bin/bash

echo "API 配额借用仲裁台 - 启动脚本"
echo "================================="

# 查找JDK (优先使用Trae内置的JDK)
if [ -d "/Users/lzy/.trae-cn/extensions/redhat.java-"*"/jre/"*"/bin" ]; then
    JDK_BIN=$(ls -d /Users/lzy/.trae-cn/extensions/redhat.java-*/jre/*/bin/java | head -1)
    export JAVA_HOME=$(dirname "$JDK_BIN")/..
    export PATH="$JAVA_HOME/bin:$PATH"
    echo "✅ 使用Trae内置JDK: $JAVA_HOME"
fi

# 检查Java版本
if ! command -v java &> /dev/null; then
    echo "❌ 未找到Java命令，请先安装Java"
    exit 1
fi

if ! command -v javac &> /dev/null; then
    echo "❌ 找到的是JRE而不是JDK，需要完整JDK才能编译"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1 | awk -F '"' '{print $2}' | cut -d'.' -f1)
echo "检测到Java版本: $JAVA_VERSION"

echo "✅ Java环境检查通过"
echo ""

# 检查是否有Maven或使用Maven Wrapper
if command -v mvn &> /dev/null; then
    echo "使用系统Maven: $(mvn -v | head -n 1)"
    MVN_CMD="mvn"
else
    echo "未找到系统Maven，正在创建Maven Wrapper..."
    mkdir -p .mvn/wrapper
    
    # 创建maven-wrapper.properties
    cat > .mvn/wrapper/maven-wrapper.properties << 'EOF'
distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.8.8/apache-maven-3.8.8-bin.zip
wrapperUrl=https://repo.maven.apache.org/maven2/io/takari/maven-wrapper/0.5.6/maven-wrapper-0.5.6.jar
EOF
    
    # 下载wrapper jar
    echo "正在下载Maven Wrapper..."
    curl -s -L -o .mvn/wrapper/maven-wrapper.jar \
        https://repo.maven.apache.org/maven2/io/takari/maven-wrapper/0.5.6/maven-wrapper-0.5.6.jar
    
    # 创建mvnw脚本
    cat > mvnw << 'MVN'
#!/bin/bash
MAVEN_PROJECTBASEDIR="$(cd "$(dirname "$0")" && pwd)"
MAVEN_WRAPPER_JAR="$MAVEN_PROJECTBASEDIR/.mvn/wrapper/maven-wrapper.jar"
if [ -n "$JAVA_HOME" ] && [ -x "$JAVA_HOME/bin/java" ]; then
    JAVACMD="$JAVA_HOME/bin/java"
else
    JAVACMD=java
fi
exec "$JAVACMD" -Dmaven.multiModuleProjectDirectory="$MAVEN_PROJECTBASEDIR" \
    -classpath "$MAVEN_WRAPPER_JAR" org.apache.maven.wrapper.MavenWrapperMain "$@"
MVN
    chmod +x mvnw
    MVN_CMD="./mvnw"
fi

echo ""
echo "================================="
echo "开始编译和启动服务..."
echo "================================="
echo ""

# 创建数据目录
mkdir -p data

# 编译并启动 - 添加 -q 减少输出，同时显示错误
$MVN_CMD spring-boot:run
