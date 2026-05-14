#!/bin/bash

echo "API 配额借用仲裁台 - 启动脚本"
echo "================================="

# 检查Java版本
if ! command -v java &> /dev/null; then
    echo "❌ 未找到Java命令，请先安装Java"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1 | awk -F '"' '{print $2}' | cut -d'.' -f1)
echo "检测到Java版本: $JAVA_VERSION"

# 如果系统Java版本低于17，尝试查找其他Java版本
if [ "$JAVA_VERSION" -lt 17 ]; then
    echo "⚠️  系统默认Java版本低于17，尝试查找其他Java安装..."
    
    # 尝试查找常见的Java安装位置
    JAVA_17_PATHS=(
        "/usr/lib/jvm/java-17-openjdk-amd64"
        "/usr/lib/jvm/java-17-openjdk"
        "/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home"
        "/opt/homebrew/opt/openjdk@17"
        "$HOME/.sdkman/candidates/java/17.*"
    )
    
    for path in "${JAVA_17_PATHS[@]}"; do
        if [ -d "$path" ] && [ -x "$path/bin/java" ]; then
            export JAVA_HOME="$path"
            export PATH="$JAVA_HOME/bin:$PATH"
            echo "✅ 找到Java 17: $JAVA_HOME"
            break
        fi
    done
    
    # 再次检查版本
    JAVA_VERSION=$(java -version 2>&1 | head -n 1 | awk -F '"' '{print $2}' | cut -d'.' -f1)
    if [ "$JAVA_VERSION" -lt 17 ]; then
        echo "❌ 未找到Java 17，请手动安装后重试"
        echo "   下载地址: https://adoptium.net/"
        exit 1
    fi
fi

echo "✅ Java环境检查通过"
echo ""

# 检查Maven
if command -v mvn &> /dev/null; then
    echo "使用系统Maven: $(mvn -v | head -n 1)"
    MVN_CMD="mvn"
else
    echo "未找到系统Maven，尝试使用内嵌Maven Wrapper..."
    if [ ! -f ".mvn/wrapper/maven-wrapper.jar" ]; then
        echo "正在创建Maven Wrapper..."
        mkdir -p .mvn/wrapper
        
        # 下载maven-wrapper.properties
        cat > .mvn/wrapper/maven-wrapper.properties << 'EOF'
distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.5/apache-maven-3.9.5-bin.zip
wrapperUrl=https://repo.maven.apache.org/maven2/io/takari/maven-wrapper/0.5.6/maven-wrapper-0.5.6.jar
EOF
        
        # 下载wrapper jar
        curl -s -o .mvn/wrapper/maven-wrapper.jar \
            https://repo.maven.apache.org/maven2/io/takari/maven-wrapper/0.5.6/maven-wrapper-0.5.6.jar
    fi
    MVN_CMD="./mvnw"
fi

# 创建mvnw脚本
if [ ! -f "mvnw" ]; then
    cat > mvnw << 'MVN'
#!/bin/bash
MAVEN_PROJECTBASEDIR="${0%/*}"
if [ -z "$MAVEN_PROJECTBASEDIR" ]; then
    MAVEN_PROJECTBASEDIR=.
fi
MAVEN_WRAPPER_JAR="$MAVEN_PROJECTBASEDIR/.mvn/wrapper/maven-wrapper.jar"
if [ -n "$JAVA_HOME" ] && [ -x "$JAVA_HOME/bin/java" ]; then
    JAVACMD="$JAVA_HOME/bin/java"
else
    JAVACMD=java
fi
exec "$JAVACMD" -classpath "$MAVEN_WRAPPER_JAR" org.apache.maven.wrapper.MavenWrapperMain "$@"
MVN
    chmod +x mvnw
fi

echo ""
echo "开始编译和启动服务..."
echo "================================="
echo ""

# 创建数据目录
mkdir -p data

# 编译并启动
$MVN_CMD spring-boot:run
