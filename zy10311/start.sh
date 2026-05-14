#!/bin/bash
# API 变更投票门禁系统启动脚本
# 支持 Java 8+，无需安装 Maven

set +e  # 不立即退出，友好处理错误

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

echo "=============================================="
echo "  API 变更投票门禁系统 - 启动脚本"
echo "=============================================="
echo ""

# 检查 Java
if ! command -v java >/dev/null 2>&1; then
    echo "❌ 错误: 未找到 Java 命令"
    echo "   请安装 Java 8 或更高版本"
    echo ""
    echo "运行诊断脚本查看完整环境信息:"
    echo "  ./diagnose.sh"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1)
echo "检测到 $JAVA_VERSION"
echo ""

# 检查是否有编译好的类文件
NEED_BUILD=0

if [ ! -d "target/classes" ] || [ -z "$(find target/classes -name "*.class" 2>/dev/null | head -1)" ]; then
    echo "⚠️  未找到编译后的类文件"
    NEED_BUILD=1
fi

# 检查依赖 jar
if [ ! -d "target/dependency" ] || [ -z "$(find target/dependency -name "*.jar" 2>/dev/null | head -1)" ]; then
    echo "⚠️  未找到依赖 JAR 包"
    NEED_BUILD=1
fi

# 检查是否有主类
if [ ! -f "target/classes/com/apigate/voting/VotingGateApplication.class" ]; then
    echo "⚠️  主类文件缺失"
    NEED_BUILD=1
fi

if [ $NEED_BUILD -eq 1 ]; then
    echo ""
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "  系统尚未构建，无法直接启动"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo ""
    echo "【可用解决方案】"
    echo ""
    
    if command -v mvn >/dev/null 2>&1; then
        echo "方案 1：使用 Maven 构建并启动"
        echo "  mvn clean compile spring-boot:run"
        echo ""
    fi
    
    echo "方案 2：使用构建脚本（需要网络和写权限）"
    echo "  chmod +x build.sh && ./build.sh"
    echo "  ./start.sh"
    echo ""
    
    echo "方案 3：运行环境诊断，了解当前环境详情"
    echo "  chmod +x diagnose.sh && ./diagnose.sh"
    echo ""
    
    echo "方案 4：只读环境下的验证"
    echo "  检查源代码完整性，查看 API 文档"
    echo "  cat API_DOCUMENTATION.md"
    echo ""
    
    exit 1
fi

echo "✅ 编译类文件检查通过"
echo "✅ 依赖库检查通过"
echo ""
echo "启动服务中..."
echo "服务端口: 8080"
echo "H2 控制台: http://localhost:8080/h2-console"
echo "JDBC URL: jdbc:h2:mem:votingdb"
echo "Username: sa"
echo "Password: (空)"
echo ""
echo "服务完全启动后，可运行: ./verify.sh 进行接口验证"
echo "按 Ctrl+C 停止服务"
echo "=============================================="
echo ""

# 构建 classpath
CLASSPATH="target/classes"
for jar in target/dependency/*.jar; do
    CLASSPATH="$CLASSPATH:$jar"
done

# 启动应用
java -cp "$CLASSPATH" com.apigate.voting.VotingGateApplication
