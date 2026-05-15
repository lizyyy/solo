#!/bin/bash
# 环境检查脚本

echo "========================================"
echo "  API 可观测标签校验系统 - 环境检查"
echo "========================================"
echo ""

# 检查 Java
echo "[1/3] 检查 Java 环境..."
if command -v java >/dev/null 2>&1; then
    JAVA_VERSION=$(java -version 2>&1 | head -1 | grep -Eo '[0-9]+\.[0-9]+\.[0-9]+' | head -1)
    JAVA_MAJOR=$(echo $JAVA_VERSION | cut -d. -f1)
    
    # Java 8 显示 1.8.x，Java 9+ 直接显示版本号
    if [ "$JAVA_MAJOR" = "1" ]; then
        JAVA_MAJOR=$(echo $JAVA_VERSION | cut -d. -f2)
    fi
    
    echo "  ✓ Java 已安装: $JAVA_VERSION"
    if [ "$JAVA_MAJOR" -ge 17 ]; then
        echo "  ✓ Java 版本符合要求 (>= 17)"
        JAVA_OK=true
    else
        echo "  ✗ Java 版本不符合要求，需要 >= 17，当前 $JAVA_MAJOR"
        JAVA_OK=false
    fi
else
    echo "  ✗ Java 未安装"
    JAVA_OK=false
fi
echo ""

# 检查 Maven 或 mvnw
echo "[2/3] 检查 Maven 环境..."
if command -v mvn >/dev/null 2>&1; then
    if mvn -version >/dev/null 2>&1; then
        echo "  ✓ 系统 Maven 已安装: $(mvn -v | head -1 | awk '{print $3}')"
        MVN_OK=true
    else
        echo "  ✗ 系统 Maven 存在但无法执行"
        MVN_OK=false
    fi
elif [ -f "./mvnw" ]; then
    echo "  ⚠  Maven Wrapper 脚本存在，将尝试首次运行..."
    echo "     注意：首次运行需要联网下载依赖"
    # 尝试执行 mvnw -version 检查是否真的可用
    if ./mvnw -version >/dev/null 2>&1; then
        echo "  ✓ Maven Wrapper 可用"
        MVN_OK=true
    else
        echo "  ✗ Maven Wrapper 无法正常执行（可能是网络/代理问题）"
        MVN_OK=false
    fi
else
    echo "  ✗ 未找到 Maven 或 Maven Wrapper"
    MVN_OK=false
fi
echo ""

# 检查 curl (用于测试 API)
echo "[3/3] 检查 curl 环境..."
if command -v curl >/dev/null 2>&1; then
    echo "  ✓ curl 已安装: $(curl --version | head -1 | awk '{print $2}')"
    CURL_OK=true
else
    echo "  ✗ curl 未安装（无法运行测试脚本）"
    CURL_OK=false
fi
echo ""

echo "========================================"
echo "  检查结果汇总"
echo "========================================"
echo "  Java:   $($JAVA_OK && echo ✓ 就绪 || echo ✗ 需升级)"
echo "  Maven:  $($MVN_OK && echo ✓ 就绪 || echo ✗ 需配置)"
echo "  curl:   $($CURL_OK && echo ✓ 就绪 || echo ✗ 需安装)"
echo ""

if $JAVA_OK && $MVN_OK; then
    echo "  ✓ 环境检查通过！"
    echo ""
    echo "  下一步："
    echo "    1. 编译: ./mvnw clean package -DskipTests"
    echo "    2. 启动: ./mvnw spring-boot:run"
    echo "    3. 测试: ./test_demo.sh"
elif $JAVA_OK; then
    echo "  ⚠  Java 就绪，但 Maven 不可用"
    echo ""
    echo "  备用方案（按优先级）："
    echo ""
    echo "    🚀 方案 1: 使用一键启动脚本（推荐）"
    echo "        ./quick-start.sh"
    echo ""
    echo "    📦 方案 2: 手动下载 Maven Wrapper"
    echo "        1. 创建目录: mkdir -p .mvn/wrapper"
    echo "        2. 下载文件到: .mvn/wrapper/maven-wrapper.jar"
    echo "        3. 下载地址: https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar"
    echo "        4. 然后运行: ./mvnw spring-boot:run"
    echo ""
    echo "    🔧 方案 3: 检查网络/代理设置"
    echo "        当前代理: ${http_proxy:-未设置}"
    echo "        如需设置: export http_proxy=http://your-proxy:port"
    echo "                  export https_proxy=http://your-proxy:port"
    echo ""
    echo "    💻 方案 4: 使用 IDE 直接运行"
    echo "        运行主类: com.observability.tagvalidation.TagValidationApplication"
    exit 1
else
    echo "  ✗ 环境存在问题，请先解决上述问题"
    exit 1
fi
echo ""
