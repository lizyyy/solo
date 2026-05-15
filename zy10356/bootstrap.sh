#!/bin/bash
set -e

# 特征开关命中审计 API - 自举启动脚本
# 功能：
#   1. 自动下载完整的 Maven Wrapper (mvnw + jar)
#   2. 检查 Java 版本 (兼容 Java 8+)
#   3. 自动构建项目
#   4. 启动服务

echo "=========================================="
echo "  🎯 特征开关命中审计 API - 自举启动"
echo "=========================================="
echo ""

PROJECT_DIR=$(cd "$(dirname "$0")" && pwd)
cd "$PROJECT_DIR"

MVNW_URL="https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar"
MVNW_SCRIPT_URL="https://raw.githubusercontent.com/apache/maven-wrapper/master/mvnw"

# ==================== 颜色输出 ====================
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

info() { echo -e "${BLUE}[INFO]${NC} $1"; }
success() { echo -e "${GREEN}[OK]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; }

# ==================== 检查 Java 版本 ====================
check_java() {
    info "检查 Java 环境..."
    
    if ! command -v java &> /dev/null; then
        error "未找到 java 命令，请先安装 JDK 8+"
        echo ""
        echo "下载地址 (推荐 Temurin JDK 8):"
        echo "  https://adoptium.net/temurin/releases/?version=8"
        exit 1
    fi

    JAVA_VERSION=$(java -version 2>&1 | head -n 1 | grep -oP '(?<=version ")[0-9]+' | head -n 1)
    JAVA_FULL_VERSION=$(java -version 2>&1 | head -n 1)
    
    if [ "$JAVA_VERSION" = "1" ]; then
        # Java 8 格式是 "1.8.x"
        JAVA_VERSION=$(java -version 2>&1 | head -n 1 | grep -oP '(?<=version "1\.)[0-9]+' | head -n 1)
    fi

    success "检测到 Java 版本: $JAVA_FULL_VERSION"

    if [ "$JAVA_VERSION" -lt 8 ]; then
        error "Java 版本过低，需要 Java 8+"
        exit 1
    fi
}

# ==================== 下载并验证 Maven Wrapper ====================
setup_maven_wrapper() {
    mkdir -p "$PROJECT_DIR/.mvn/wrapper"
    local JAR_FILE="$PROJECT_DIR/.mvn/wrapper/maven-wrapper.jar"

    # 检查现有 jar 是否有效
    if [ -f "$JAR_FILE" ] && [ -f "$PROJECT_DIR/mvnw" ]; then
        if java -jar "$JAR_FILE" --version 2>/dev/null | grep -q "Maven"; then
            success "Maven Wrapper 已存在且有效，跳过下载"
            return 0
        else
            warn "现有 Maven Wrapper 损坏，重新下载..."
            rm -f "$JAR_FILE"
        fi
    fi

    info "设置 Maven Wrapper..."

    # 下载 wrapper jar (最多重试 3 次)
    if [ ! -f "$JAR_FILE" ]; then
        info "下载 maven-wrapper.jar..."
        for attempt in 1 2 3; do
            if command -v curl &> /dev/null; then
                curl -sL "$MVNW_URL" -o "$JAR_FILE" && break
            elif command -v wget &> /dev/null; then
                wget -q "$MVNW_URL" -O "$JAR_FILE" && break
            else
                error "未找到 curl 或 wget，无法下载 Maven Wrapper"
                echo "请手动下载: $MVNW_URL"
                exit 1
            fi
            if [ $attempt -lt 3 ]; then
                warn "下载失败，重试 $attempt/3..."
                sleep 1
            fi
        done
    fi

    # 验证 jar 文件完整性
    if [ ! -f "$JAR_FILE" ] || [ ! -s "$JAR_FILE" ]; then
        error "maven-wrapper.jar 下载失败或文件为空"
        exit 1
    fi

    # 检查文件大小 (> 50KB)
    FILE_SIZE=$(du -k "$JAR_FILE" | cut -f1)
    if [ "$FILE_SIZE" -lt 50 ]; then
        error "maven-wrapper.jar 文件异常 (大小: ${FILE_SIZE}KB)"
        exit 1
    fi

    # 用 Java 验证是否能加载主类
    if ! java -cp "$JAR_FILE" org.apache.maven.wrapper.MavenWrapperMain --version 2>/dev/null | grep -q "Apache Maven"; then
        error "maven-wrapper.jar 无法正常加载"
        exit 1
    fi
    success "maven-wrapper.jar 下载并验证完成 (${FILE_SIZE}KB)"

    # 创建 mvnw 脚本（不依赖网络下载，直接生成）
    if [ ! -f "$PROJECT_DIR/mvnw" ]; then
        info "生成 mvnw 启动脚本..."
        cat > "$PROJECT_DIR/mvnw" << 'MVNW_SCRIPT'
#!/bin/bash
# ----------------------------------------------------------------------------
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
# ----------------------------------------------------------------------------

# ----------------------------------------------------------------------------
# Maven2 Start Up Batch script
#
# Required ENV vars:
# ------------------
#   JAVA_HOME - location of a JDK home dir
#
# Optional ENV vars
# -----------------
#   M2_HOME - location of maven2's installed home dir
#   MAVEN_OPTS - parameters passed to the Java VM when running Maven
#     e.g. to debug Maven itself, use
#       set MAVEN_OPTS=-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=8000
#   MAVEN_SKIP_RC - flag to disable loading of mavenrc files
# ----------------------------------------------------------------------------

if [ -z "$MAVEN_SKIP_RC" ] ; then

  if [ -f /etc/mavenrc ] ; then
    . /etc/mavenrc
  fi

  if [ -f "$HOME/.mavenrc" ] ; then
    . "$HOME/.mavenrc"
  fi

fi

# OS specific support.  $var _must_ be set to either true or false.
cygwin=false
mingw=false
case "`uname`" in
  CYGWIN*) cygwin=true ;;
  MINGW*) mingw=true;;
esac

# Darwin (macOS) specific support
darwin=false
case "`uname`" in
  Darwin*) darwin=true
    #
    # Look for the Apple JDKs first to preserve the existing behaviour, and then look
    # for other JDKs based on /usr/libexec/java_home
    #
    if [ -z "$JAVA_HOME" ] && [ -x /usr/libexec/java_home ]; then
      JAVA_HOME="`/usr/libexec/java_home`"
      export JAVA_HOME
    fi
    ;;
esac

if [ -z "$JAVA_HOME" ] ; then
  javaExecutable="`which javac`"
  if [ -n "$javaExecutable" ] && ! [ "`expr \"$javaExecutable\" : '\([^ ]*\)'`" = "no" ]; then
    # readlink(1) is not available as standard on Solaris 10.
    readLink=`which readlink`
    if [ ! `expr "$readLink" : '\([^ ]*\)'` = "no" ]; then
      if $darwin ; then
        javaHome="`dirname \"$javaExecutable\"`"
        javaExecutable="`cd \"$javaHome\" && pwd -P`/java"
      else
        javaExecutable="`readlink -f \"$javaExecutable\"`"
      fi
      javaHome="`dirname \"$javaExecutable\"`"
      javaHome=`expr "$javaHome" : '\(.*\)/bin'`
      JAVA_HOME="$javaHome"
      export JAVA_HOME
    fi
  fi
fi

if [ -z "$JAVACMD" ] ; then
  if [ -n "$JAVA_HOME"  ] ; then
    if [ -x "$JAVA_HOME/jre/sh/java" ] ; then
      # IBM's JDK on AIX uses strange locations for the executables
      JAVACMD="$JAVA_HOME/jre/sh/java"
    else
      JAVACMD="$JAVA_HOME/bin/java"
    fi
  else
    JAVACMD="`which java`"
  fi
fi

if [ ! -x "$JAVACMD" ] ; then
  echo "Error: JAVA_HOME is not defined correctly." >&2
  echo "  We cannot execute $JAVACMD" >&2
  exit 1
fi

if [ -z "$JAVA_HOME" ] ; then
  echo "Warning: JAVA_HOME environment variable is not set." >&2
fi

# For Cygwin, ensure paths are in UNIX format before anything is touched
if $cygwin ; then
  [ -n "$M2_HOME" ] &&
    M2_HOME=`cygpath --unix "$M2_HOME"`
  [ -n "$JAVA_HOME" ] &&
    JAVA_HOME=`cygpath --unix "$JAVA_HOME"`
  [ -n "$CLASSPATH" ] &&
    CLASSPATH=`cygpath --path --unix "$CLASSPATH"`
fi

# For MinGW, ensure paths are in UNIX format before anything is touched
if $mingw ; then
  [ -n "$M2_HOME" ] &&
    M2_HOME="`(cd "$M2_HOME"; pwd -W)`"
  [ -n "$JAVA_HOME" ] &&
    JAVA_HOME="`(cd "$JAVA_HOME"; pwd -W)`"
  # TODO classpath?
fi

if [ -z "$M2_HOME" ] ; then
  ## resolve links - $0 may be a link to maven's home
  PRG="$0"

  # need this for relative symlinks
  while [ -h "$PRG" ] ; do
    ls=`ls -ld "$PRG"`
    link=`expr "$ls" : '.*-> \(.*\)$'`
    if expr "$link" : '/.*' > /dev/null; then
      PRG="$link"
    else
      PRG="`dirname "$PRG"`/$link"
    fi
  done

  saveddir=`pwd`

  M2_HOME=`dirname "$PRG"`/..

  # make it fully qualified
  M2_HOME=`cd "$M2_HOME" && pwd`

  cd "$saveddir"
  # echo Using m2 at $M2_HOME
fi

# For Cygwin, switch paths to Windows format before running java
if $cygwin; then
  [ -n "$M2_HOME" ] &&
    M2_HOME=`cygpath --path --windows "$M2_HOME"`
  [ -n "$JAVA_HOME" ] &&
    JAVA_HOME=`cygpath --path --windows "$JAVA_HOME"`
  [ -n "$CLASSPATH" ] &&
    CLASSPATH=`cygpath --path --windows "$CLASSPATH"`
fi

# Provide a "standardized" way to retrieve the CLI args that will
# work with both Windows and non-Windows executions.
MAVEN_CMD_LINE_ARGS="$MAVEN_CONFIG $@"
export MAVEN_CMD_LINE_ARGS

WRAPPER_JAR="`dirname "$0"`/.mvn/wrapper/maven-wrapper.jar"
if [ -n "$MAVEN_PROJECTBASEDIR" ]; then
  WRAPPER_JAR="$MAVEN_PROJECTBASEDIR/.mvn/wrapper/maven-wrapper.jar"
fi

# Determine the Java command options to use when launching the Maven Wrapper
if [ -n "$MAVEN_OPTS" ]; then
    WRAPPER_OPTS="$MAVEN_OPTS"
fi

exec "$JAVACMD" \
  $WRAPPER_OPTS \
  -classpath "$WRAPPER_JAR" \
  org.apache.maven.wrapper.MavenWrapperMain \
  "$@"
MVNW_SCRIPT
        chmod +x "$PROJECT_DIR/mvnw"
        success "mvnw 脚本生成完成"
    fi
}

# ==================== 清理旧的编译产物 ====================
clean_target() {
    info "清理旧的编译产物 (防止 Java 17 class 残留)..."
    rm -rf "$PROJECT_DIR/target"
    success "target 目录已清理"
}

# ==================== 构建项目 ====================
build_project() {
    info "开始构建项目 (Java 8 兼容模式)..."
    echo ""
    echo "  这可能需要几分钟，取决于网络速度..."
    echo "  (首次运行会下载 Maven 和所有依赖)"
    echo ""
    
    cd "$PROJECT_DIR"
    # 使用 clean compile 确保从干净状态重新编译
    if ! ./mvnw clean compile -DskipTests -q; then
        error "构建失败！"
        echo ""
        echo "尝试使用以下命令查看详细错误:"
        echo "  ./mvnw clean compile"
        exit 1
    fi
    success "项目构建完成 (Java 8 字节码)"
}

# ==================== 启动服务 ====================
start_service() {
    echo ""
    info "启动服务..."
    echo ""
    echo "  =========================================="
    echo "  📊 管理页面:   http://localhost:8080"
    echo "  🗄️  H2控制台:    http://localhost:8080/h2-console"
    echo "  🧪 测试脚本:    ./test.sh (新开终端)"
    echo "  =========================================="
    echo ""
    
    cd "$PROJECT_DIR"
    ./mvnw spring-boot:run -q
}

# ==================== 主流程 ====================
main() {
    check_java
    echo ""
    clean_target                    # 1. 先清理旧编译产物
    echo ""
    setup_maven_wrapper             # 2. 再下载/设置 Maven Wrapper
    echo ""
    build_project                   # 3. 构建项目
    echo ""
    start_service                   # 4. 启动服务
}

main "$@"
