#!/bin/bash
# 环境诊断脚本
# 检测当前环境是否满足运行条件，并给出明确的解决方案

set +e  # 不立即退出，完成所有诊断

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=============================================="
echo "  API 变更投票门禁系统 - 环境诊断"
echo "=============================================="
echo ""

PASS=0
WARN=0
FAIL=0

check_item() {
    local name="$1"
    local status="$2"
    local msg="$3"
    
    case $status in
        PASS)
            echo "✅ $name - $msg"
            ((PASS++))
            ;;
        WARN)
            echo "⚠️  $name - $msg"
            ((WARN++))
            ;;
        FAIL)
            echo "❌ $name - $msg"
            ((FAIL++))
            ;;
    esac
}

echo "【基础环境检测】"
echo ""

# 1. 检查 Java
if command -v java >/dev/null 2>&1; then
    JAVA_VER=$(java -version 2>&1 | head -n 1)
    check_item "Java 运行时" "PASS" "$JAVA_VER"
else
    check_item "Java 运行时" "FAIL" "未找到 java 命令"
fi

# 2. 检查 Java 编译器
if command -v javac >/dev/null 2>&1; then
    JAVAC_VER=$(javac -version 2>&1 | head -n 1)
    check_item "Java 编译器" "PASS" "$JAVAC_VER"
else
    check_item "Java 编译器" "FAIL" "未找到 javac 命令（需要 JDK，不是 JRE）"
fi

# 3. 检查 Maven
if command -v mvn >/dev/null 2>&1; then
    MVN_VER=$(mvn -version 2>&1 | head -n 1)
    check_item "Maven" "PASS" "$MVN_VER"
else
    check_item "Maven" "WARN" "未找到 mvn 命令（不必须，可使用脚本方式）"
fi

# 4. 检查网络工具
HAS_NETWORK=0
if command -v curl >/dev/null 2>&1; then
    check_item "网络工具" "PASS" "curl 可用"
    HAS_NETWORK=1
elif command -v wget >/dev/null 2>&1; then
    check_item "网络工具" "PASS" "wget 可用"
    HAS_NETWORK=1
else
    check_item "网络工具" "FAIL" "curl 和 wget 都没有（无法下载依赖）"
fi

echo ""
echo "【项目文件检测】"
echo ""

# 5. 源代码检查
if [ -d "src/main/java" ]; then
    JAVA_COUNT=$(find src/main/java -name "*.java" 2>/dev/null | wc -l | tr -d ' ')
    check_item "源代码" "PASS" "找到 $JAVA_COUNT 个 Java 源文件"
else
    check_item "源代码" "FAIL" "src/main/java 目录不存在"
fi

# 6. 配置文件检查
if [ -f "src/main/resources/application.yml" ]; then
    check_item "配置文件" "PASS" "application.yml 存在"
else
    check_item "配置文件" "FAIL" "配置文件不存在"
fi

echo ""
echo "【构建产物检测】"
echo ""

# 7. 检查编译后的类文件
if [ -d "target/classes" ] && [ -n "$(find target/classes -name "*.class" 2>/dev/null | head -1)" ]; then
    CLASS_COUNT=$(find target/classes -name "*.class" | wc -l | tr -d ' ')
    check_item "已编译类文件" "PASS" "找到 $CLASS_COUNT 个类文件"
else
    check_item "已编译类文件" "FAIL" "target/classes 为空或不存在（需要编译）"
fi

# 8. 检查依赖 jar
if [ -d "target/dependency" ] && [ -n "$(find target/dependency -name "*.jar" 2>/dev/null | head -1)" ]; then
    JAR_COUNT=$(find target/dependency -name "*.jar" | wc -l | tr -d ' ')
    check_item "依赖 JAR 包" "PASS" "找到 $JAR_COUNT 个依赖包"
else
    check_item "依赖 JAR 包" "FAIL" "target/dependency 为空或不存在（需要下载依赖）"
fi

# 9. 检查主类文件
if [ -f "target/classes/com/apigate/voting/VotingGateApplication.class" ]; then
    check_item "主类文件" "PASS" "VotingGateApplication.class 存在"
else
    check_item "主类文件" "FAIL" "主类不存在（需要编译）"
fi

# 10. 检查 Maven Wrapper
if [ -f ".mvn/wrapper/maven-wrapper.jar" ]; then
    check_item "Maven Wrapper" "PASS" "maven-wrapper.jar 存在"
else
    check_item "Maven Wrapper" "WARN" "maven-wrapper.jar 不存在（不必须）"
fi

echo ""
echo "【端口检测】"
echo ""

# 11. 检查 8080 端口
if command -v lsof >/dev/null 2>&1; then
    if lsof -i :8080 >/dev/null 2>&1; then
        check_item "8080 端口" "WARN" "端口已被占用，服务可能已启动"
    else
        check_item "8080 端口" "PASS" "端口可用"
    fi
elif command -v netstat >/dev/null 2>&1; then
    if netstat -tuln 2>/dev/null | grep -q ":8080 "; then
        check_item "8080 端口" "WARN" "端口已被占用，服务可能已启动"
    else
        check_item "8080 端口" "PASS" "端口可用"
    fi
else
    check_item "8080 端口" "WARN" "无法检测（缺少 lsof/netstat）"
fi

echo ""
echo "=============================================="
echo "  诊断结果汇总"
echo "=============================================="
echo "  通过: $PASS | 警告: $WARN | 失败: $FAIL"
echo ""

if [ $FAIL -eq 0 ]; then
    echo "✅ 环境就绪！可以直接启动服务"
    echo ""
    echo "  bash start.sh"
elif [ $FAIL -le 2 ] && [ -f "target/classes/com/apigate/voting/VotingGateApplication.class" ]; then
    echo "⚠️  部分缺失，但核心文件已就绪"
    echo ""
    echo "  可能可以直接启动: bash start.sh"
else
    echo "❌ 环境未就绪，需要准备"
    echo ""
    echo "【推荐方案 ⭐⭐⭐⭐⭐】"
    echo ""
    echo "  一键准备（自动下载依赖 + 编译）"
    echo "  bash prepare.sh"
    echo ""
    echo "【其他方案】"
    echo ""
    
    if command -v mvn >/dev/null 2>&1; then
        echo "• 使用 Maven 构建"
        echo "  mvn clean compile dependency:copy-dependencies -DoutputDirectory=target/dependency"
        echo "  mvn spring-boot:run"
        echo ""
    fi
    
    echo "• 只读环境验证"
    echo "  检查源代码和配置文件是否完整"
    echo "  详细请查看 API_DOCUMENTATION.md"
fi

echo ""
echo "【脚本说明】"
echo "  ./diagnose.sh - 运行此环境诊断"
echo "  ./build.sh    - 下载依赖并编译"
echo "  ./start.sh    - 启动服务"
echo "  ./verify.sh   - 验证接口（服务启动后）"
echo ""

exit 0
