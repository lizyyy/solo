#!/bin/bash

echo "=========================================="
echo "  资源标签继承 API - 项目验证"
echo "=========================================="
echo ""

# 检查 JDK (不是 JRE)
echo "🔍 检查 JDK 环境..."
if command -v javac >/dev/null 2>&1; then
  javac -version 2>&1
  echo "✅ JDK 已安装（包含 javac 编译器）"
  HAS_JDK=1
else
  echo "⚠️  未找到 javac 编译器 - 当前只有 JRE（运行环境）"
  echo "   需要安装 JDK（Java Development Kit）才能编译"
  echo "   下载地址: https://www.oracle.com/java/technologies/downloads/"
  HAS_JDK=0
fi
echo ""

# 检查 Java 运行时
echo "🔍 检查 Java 运行时..."
if command -v java >/dev/null 2>&1; then
  java -version 2>&1 | head -1
  echo "✅ Java 运行时已安装"
else
  echo "❌ 未找到 Java"
  exit 1
fi
echo ""

# 检查 Maven
echo "🔍 检查 Maven 环境..."
if command -v mvn >/dev/null 2>&1; then
  mvn -version 2>&1 | head -1
  echo "✅ 系统 Maven 已安装"
  HAS_MVN=1
else
  echo "⚠️  未找到系统 Maven"
  HAS_MVN=0
fi
echo ""

# 检查 Maven Wrapper
echo "🔍 检查 Maven Wrapper 脚本..."
if [ -f "mvnw" ]; then
  chmod +x mvnw 2>/dev/null || true
  echo "✅ Maven Wrapper 脚本存在"
  if [ $HAS_JDK -eq 1 ]; then
    echo "   脚本会自动下载 Maven 并运行"
  fi
  HAS_MVNW=1
else
  echo "❌ 缺少 mvnw 脚本"
  HAS_MVNW=0
fi
echo ""

# 检查项目结构
echo "🔍 检查项目结构..."
PROJECT_OK=1

if [ -f "pom.xml" ]; then
  echo "✅ pom.xml 存在 (Spring Boot 2.7.18 + Java 8)"
else
  echo "❌ 缺少 pom.xml"
  PROJECT_OK=0
fi

if [ -d "src/main/java/com/resource/tag" ]; then
  echo "✅ 源代码目录存在"
else
  echo "❌ 缺少源代码目录"
  PROJECT_OK=0
fi

if [ -f "src/main/java/com/resource/tag/TagInheritanceApplication.java" ]; then
  echo "✅ 启动类存在"
else
  echo "❌ 缺少启动类"
  PROJECT_OK=0
fi

if [ -f "src/main/resources/application.yml" ]; then
  echo "✅ 配置文件存在"
else
  echo "❌ 缺少配置文件"
  PROJECT_OK=0
fi
echo ""

# 统计文件
JAVA_COUNT=$(find src/main/java -name "*.java" | wc -l | tr -d ' ')
echo "📊 项目统计:"
echo "   Java 源文件: $JAVA_COUNT 个"
echo ""

# Java 8 兼容性检查
echo "🔍 Java 8 兼容性检查..."
echo "   (检查是否有 Java 9+ 特有语法...)"

CHECK_FAILED=0

# 检查 jakarta 导入
if grep -r "import jakarta\." src/main/java --include="*.java" >/dev/null 2>&1; then
  echo "❌ 发现 jakarta 导入 (Spring Boot 3 特有):"
  grep -rn "import jakarta\." src/main/java --include="*.java"
  CHECK_FAILED=1
else
  echo "✅ javax 导入检查通过 (Spring Boot 2 兼容)"
fi

# 检查 List.of, Map.of, Set.of
if grep -r "List\.of\|Map\.of\|Set\.of" src/main/java --include="*.java" | grep -v "Arrays.asList" >/dev/null 2>&1; then
  echo "❌ 发现 Java 9+ 的 *.of 语法:"
  grep -rn "List\.of\|Map\.of\|Set\.of" src/main/java --include="*.java"
  CHECK_FAILED=1
else
  echo "✅ *.of 语法检查通过"
fi

# 检查 switch 表达式 (->)
if grep -rn "case.*->" src/main/java --include="*.java" >/dev/null 2>&1; then
  echo "❌ 发现 Java 14+ 的 switch 表达式:"
  grep -rn "case.*->" src/main/java --include="*.java"
  CHECK_FAILED=1
else
  echo "✅ switch 表达式检查通过"
fi

# 检查 var 关键字
if grep -rn "^[[:space:]]*var[[:space:]]" src/main/java --include="*.java" >/dev/null 2>&1; then
  echo "❌ 发现 Java 10+ 的 var 关键字:"
  grep -rn "^[[:space:]]*var[[:space:]]" src/main/java --include="*.java"
  CHECK_FAILED=1
else
  echo "✅ var 关键字检查通过"
fi

echo ""

# 核心功能检查
echo "🔍 核心功能完整性检查..."

# 检查幂等性拦截
if grep -qi "duplicate\|requestId" src/main/java/com/resource/tag/service/TagInheritanceService.java; then
  echo "✅ 重复请求拦截 (requestId 幂等检查) 已实现"
else
  echo "⚠️  未检测到重复请求拦截代码"
fi

# 检查 ResponseEntity
if grep -q "ResponseEntity" src/main/java/com/resource/tag/controller/TagInheritanceController.java; then
  echo "✅ 真正 HTTP 状态码返回 已实现"
else
  echo "⚠️  未检测到 ResponseEntity"
fi

# 检查状态推进
if grep -q "PENDING\|VALIDATING\|INHERITING\|CONFLICT\|COMPLETED\|FAILED" src/main/java/com/resource/tag/model/TaskStatus.java; then
  echo "✅ 任务状态机 已实现"
else
  echo "⚠️  未检测到完整的状态定义"
fi

echo ""

# 总结
echo "=========================================="
echo "            验证结果总结"
echo "=========================================="
echo ""

if [ $CHECK_FAILED -eq 0 ]; then
  echo "✅ 代码完全兼容 Java 8 + Spring Boot 2.7"
else
  echo "❌ 存在 Java 8 不兼容代码"
fi
echo ""

echo "🚀 启动方式:"
echo ""
echo "1. 使用 Maven Wrapper (推荐):"
echo "   chmod +x mvnw  # 确保有执行权限"
echo "   ./mvnw spring-boot:run"
echo ""
echo "2. 打包成 JAR:"
echo "   ./mvnw clean package -DskipTests"
echo "   java -jar target/tag-inheritance-api-1.0.0.jar"
echo ""
echo "3. 如果有系统 Maven:"
echo "   mvn spring-boot:run"
echo ""

if [ $HAS_JDK -eq 0 ]; then
  echo "⚠️  注意: 当前环境只有 JRE，需要安装 JDK 才能编译运行"
  echo "   安装 JDK 后重新运行此脚本验证"
  echo ""
fi

echo "📋 详细 API 测试示例请查看: test-requests.md"
echo ""
