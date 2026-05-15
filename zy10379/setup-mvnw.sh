#!/bin/bash

# Maven Wrapper 自动安装脚本
# 自动下载并配置官方的 Maven Wrapper
# 适用于没有系统 Maven 的环境

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m'

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR"

print_header() {
    echo "${BLUE}╔══════════════════════════════════════════════════════════════╗${NC}"
    echo "${BLUE}║${NC}  ${GREEN}📦 Maven Wrapper 自动安装脚本${NC}                                 ${BLUE}║${NC}"
    echo "${BLUE}╚══════════════════════════════════════════════════════════════╝${NC}"
    echo ""
}

check_java() {
    if ! command -v java > /dev/null 2>&1; then
        echo "${RED}❌ 未检测到 Java，请先安装 Java 8+${NC}"
        echo "   下载地址: https://adoptium.net/"
        exit 1
    fi

    JAVA_VERSION=$(java -version 2>&1 | head -n 1 | awk -F'"' '{print $2}')
    echo "${GREEN}✅ 检测到 Java: $JAVA_VERSION${NC}"
}

check_curl_or_wget() {
    if command -v curl > /dev/null 2>&1; then
        echo "${GREEN}✅ 检测到 curl${NC}"
        DOWNLOADER="curl -L -o"
        return 0
    elif command -v wget > /dev/null 2>&1; then
        echo "${GREEN}✅ 检测到 wget${NC}"
        DOWNLOADER="wget -O"
        return 0
    else
        echo "${RED}❌ 未检测到 curl 或 wget，无法下载文件${NC}"
        echo "   请先安装 curl 或 wget，或使用 IDE 方式运行项目"
        exit 1
    fi
}

create_wrapper_properties() {
    echo "${BLUE}[1/4]${NC} 创建 maven-wrapper.properties..."
    mkdir -p .mvn/wrapper
    cat > .mvn/wrapper/maven-wrapper.properties << 'EOF'
distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.8.8/apache-maven-3.8.8-bin.zip
wrapperUrl=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar
EOF
    echo "${GREEN}✅ maven-wrapper.properties 已创建${NC}"
}

download_wrapper_jar() {
    echo "${BLUE}[2/4]${NC} 下载 Maven Wrapper JAR 文件..."

    WRAPPER_URL="https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.2.0/maven-wrapper-3.2.0.jar"
    WRAPPER_JAR=".mvn/wrapper/maven-wrapper.jar"

    echo "   下载地址: ${CYAN}$WRAPPER_URL${NC}"
    echo ""

    if $DOWNLOADER "$WRAPPER_JAR" "$WRAPPER_URL" 2>&1; then
        echo "${GREEN}✅ maven-wrapper.jar 下载成功${NC}"
        return 0
    else
        echo "${RED}❌ 下载失败，请检查网络连接${NC}"
        return 1
    fi
}

create_wrapper_scripts() {
    echo "${BLUE}[3/4]${NC} 创建 Maven Wrapper 脚本..."

    # 下载 mvnw
    echo "   下载 mvnw 脚本..."
    MVNW_URL="https://raw.githubusercontent.com/apache/maven-wrapper/master/mvnw"
    if $DOWNLOADER mvnw "$MVNW_URL" 2>&1; then
        chmod +x mvnw
        echo "${GREEN}✅ mvnw 脚本已创建${NC}"
    else
        echo "${YELLOW}⚠️  在线下载失败，使用内置脚本${NC}"
        create_builtin_mvnw
    fi

    # 下载 mvnw.cmd
    echo "   下载 mvnw.cmd 脚本..."
    MVNW_CMD_URL="https://raw.githubusercontent.com/apache/maven-wrapper/master/mvnw.cmd"
    if $DOWNLOADER mvnw.cmd "$MVNW_CMD_URL" 2>&1; then
        echo "${GREEN}✅ mvnw.cmd 脚本已创建${NC}"
    else
        echo "${YELLOW}⚠️  在线下载失败，使用内置脚本${NC}"
        create_builtin_mvnw_cmd
    fi
}

create_builtin_mvnw() {
    cat > mvnw << 'MVNWEOF'
#!/bin/sh
# ----------------------------------------------------------------------------
# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#    https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
# ----------------------------------------------------------------------------

# ----------------------------------------------------------------------------
# Maven Start Up Batch script
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
cygwin=false;
darwin=false;
mingw=false
case "`uname`" in
  CYGWIN*) cygwin=true ;;
  MINGW*) mingw=true;;
  Darwin*) darwin=true
           #
           # Look for the Apple JDKs first to preserve the existing behaviour, and then look
           # for other JDKs based on /usr/libexec/java_home and $JAVA_HOME
           #
           if [ -z "$JAVA_HOME" -a -x /usr/libexec/java_home ]; then
              JAVA_HOME=`/usr/libexec/java_home`
           fi
           ;;
esac

# For Cygwin, ensure paths are in UNIX format before anything is touched
if $cygwin ; then
  [ -n "$JAVA_HOME" ] &&
    JAVA_HOME=`cygpath --unix "$JAVA_HOME"`
  [ -n "$M2_HOME" ] &&
    M2_HOME=`cygpath --unix "$M2_HOME"`
  [ -n "$CLASSPATH" ] &&
    CLASSPATH=`cygpath --path --unix "$CLASSPATH"`
fi

# For Mingw, ensure paths are in UNIX format before anything is touched
if $mingw ; then
  [ -n "$JAVA_HOME" ] &&
    JAVA_HOME="`(cd "$JAVA_HOME"; pwd)`"
fi

if [ -z "$JAVA_HOME" ]; then
  javaExecutable="`which javac`"
  if [ -n "$javaExecutable" ] && ! [ "`expr \"$javaExecutable\" : '\([^ ]*\)'`" = "no" ]; then
    # readlink(1) is not available as standard on Solaris 10.
    readLink=`which readlink`
    if [ ! `expr "$readLink" : '\([^ ]*\)'` = "no" ]; then
      if $darwin ; then
        javaHome="`dirname \"$javaExecutable\"`"
        javaExecutable="`cd \"$javaHome\" && pwd -P`/javac"
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
MAVEN_CMD_LINE_ARGS="$MAVEN_CONFIG $*"
export MAVEN_CMD_LINE_ARGS

WRAPPER_JAR="`dirname "$0"`/.mvn/wrapper/maven-wrapper.jar"

# traverses directory structure from process work directory to filesystem root
# first directory with .mvn subdirectory is considered project base directory
find_maven_basedir() {

  basedir=`find_file_argument_basedir "$@"`
  wdir="${basedir}"
  while [ "$wdir" != '/' ] ; do
    if [ -d "$wdir"/.mvn ] ; then
      basedir=$wdir
      break
    fi
    wdir=`dirname "$wdir"`
  done
  echo "${basedir}"
}

find_file_argument_basedir() {
  basedir=`pwd`

  for var in "$@" ; do
    if [ "$var" = "-f" ] || [ "$var" = "-file" ]; then
      FOUND=1
    elif [ -n "$FOUND" ]; then
      if [ -f "$var" ]; then
        basedir=`dirname "$var"`
        break
      fi
    fi
  done
  echo "${basedir}"
}

CLASSWORLDS_LAUNCHER=org.codehaus.classworlds.Launcher
MAVEN_PROJECTBASEDIR="${MAVEN_BASEDIR:-$(find_maven_basedir "$@")}"
export MAVEN_PROJECTBASEDIR

exec "$JAVACMD" \
  $MAVEN_OPTS \
  -classpath "$WRAPPER_JAR" \
  "-Dmaven.multiModuleProjectDirectory=$MAVEN_PROJECTBASEDIR" \
  org.apache.maven.wrapper.MavenWrapperMain "$@"
MVNWEOF
    chmod +x mvnw
}

create_builtin_mvnw_cmd() {
    cat > mvnw.cmd << 'MVNWCMDEOF'
@REM ----------------------------------------------------------------------------
@REM Licensed to the Apache Software Foundation (ASF) under one
@REM or more contributor license agreements.  See the NOTICE file
@REM distributed with this work for additional information
@REM regarding copyright ownership.  The ASF licenses this file
@REM to you under the Apache License, Version 2.0 (the
@REM "License"); you may not use this file except in compliance
@REM with the License.  You may obtain a copy of the License at
@REM
@REM    https://www.apache.org/licenses/LICENSE-2.0
@REM
@REM Unless required by applicable law or agreed to in writing,
@REM software distributed under the License is distributed on an
@REM "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
@REM KIND, either express or implied.  See the License for the
@REM specific language governing permissions and limitations
@REM under the License.
@REM ----------------------------------------------------------------------------

@REM ----------------------------------------------------------------------------
@REM Maven2 Start Up Batch script
@REM
@REM Required ENV vars:
@REM ------------------
@REM   JAVA_HOME - location of a JDK home dir
@REM
@REM Optional ENV vars
@REM -----------------
@REM   M2_HOME - location of maven2's installed home dir
@REM   MAVEN_OPTS - parameters passed to the Java VM when running Maven
@REM     e.g. to debug Maven itself, use
@REM       set MAVEN_OPTS=-Xdebug -Xrunjdwp:transport=dt_socket,server=y,suspend=y,address=8000
@REM   MAVEN_SKIP_RC - flag to disable loading of mavenrc files
@REM ----------------------------------------------------------------------------

@REM Begin all REM lines with '@' in case MAVEN_BATCH_ECHO is 'on'
@echo off
@REM set title of command window
title %0
@REM enable echoing my setting MAVEN_BATCH_ECHO to 'on'
@if "%MAVEN_BATCH_ECHO%" == "on"  echo %MAVEN_BATCH_ECHO%

@REM set %HOME% to equivalent of $HOME
if "%HOME%" == "" (set "HOME=%HOMEDRIVE%%HOMEPATH%")

@REM Execute a user defined script before this one
if not "%MAVEN_SKIP_RC%" == "" goto skipRcPre
if not "%HOME%\mavenrc_pre.bat" == "" call "%HOME%\mavenrc_pre.bat"
:skipRcPre

@setlocal

set ERROR_CODE=0

@REM To isolate internal variables from possible post scripts, we use another setlocal
@setlocal

@REM ==== START VALIDATION ====
if not "%JAVA_HOME%" == "" goto OkJHome

echo.
echo Error: JAVA_HOME is not found in your environment. >&2
echo Please set the JAVA_HOME variable in your environment to match the >&2
echo location of your Java installation. >&2
echo.
goto error

:OkJHome
if exist "%JAVA_HOME%\bin\java.exe" goto chkMHome

echo.
echo Error: JAVA_HOME is set to an invalid directory. >&2
echo JAVA_HOME = "%JAVA_HOME%" >&2
echo Please set the JAVA_HOME variable in your environment to match the >&2
echo location of your Java installation. >&2
echo.
goto error

:chkMHome
if not "%M2_HOME%"=="" goto valMHome

SET "M2_HOME=%~dp0.."
if not "%M2_HOME%"=="" goto valMHome

echo.
echo Error: M2_HOME is not found in your environment. >&2
echo Please set the M2_HOME variable in your environment to match the >&2
echo location of the Maven installation. >&2
echo.
goto error

:valMHome

:stripMHome
if not "_%M2_HOME:~-1%"=="_\" goto checkMCmd
set "M2_HOME=%M2_HOME:~0,-1%"
goto stripMHome

:checkMCmd
if exist "%M2_HOME%\bin\mvn.cmd" goto init

echo.
echo Error: M2_HOME is set to an invalid directory. >&2
echo M2_HOME = "%M2_HOME%" >&2
echo Please set the M2_HOME variable in your environment to match the >&2
echo location of the Maven installation. >&2
echo.
goto error
@REM ==== END VALIDATION ====

:init

@REM Attempt to install M2_HOME before appending to the CLASSPATH
if not "%MAVEN_SKIP_RC%" == "" goto skipRcPost
if not "%HOME%\mavenrc_post.bat" == "" call "%HOME%\mavenrc_post.bat"
:skipRcPost

@REM For Cygwin, ensure paths are in UNIX format before anything is touched
if not "%HOME%"=="" goto homeDrivePathPre
%HOME:~0,2%
if errorlevel 1 (set HOME=C:)
set HOMEDRIVE=%HOME:~0,2%
set HOMEPATH=%HOME:~2%
:homeDrivePathPre

@REM For Cygwin, ensure paths are in UNIX format before anything is touched
if not "%HOME%"=="" goto homeDrivePathPost
set HOMEDRIVE=%HOME:~0,2%
set HOMEPATH=%HOME:~2%
:homeDrivePathPost

set MAVEN_JAVA_EXE="%JAVA_HOME%\bin\java.exe"
set WRAPPER_JAR="%~dp0\.mvn\wrapper\maven-wrapper.jar"
set WRAPPER_LAUNCHER=org.apache.maven.wrapper.MavenWrapperMain

%MAVEN_JAVA_EXE% %JVM_CONFIG_MAVEN_PROPS% %MAVEN_OPTS% %MAVEN_DEBUG_OPTS% -classpath %WRAPPER_JAR% "-Dmaven.multiModuleProjectDirectory=%MAVEN_PROJECTBASEDIR%" %WRAPPER_LAUNCHER% %MAVEN_CONFIG% %*
if ERRORLEVEL 1 goto error
goto end

:error
set ERROR_CODE=1

:end
@endlocal & set ERROR_CODE=%ERROR_CODE%

if not "%MAVEN_SKIP_RC%" == "" goto skipRcPost
if not "%HOME%\mavenrc_post.bat" == "" call "%HOME%\mavenrc_post.bat"
:skipRcPost

@REM pause the batch if MAVEN_BATCH_PAUSE is set to 'on'
if "%MAVEN_BATCH_PAUSE%"=="on" pause

if "%MAVEN_TERMINATE_CMD%"=="on" exit %ERROR_CODE%

cmd /C exit /B %ERROR_CODE%
MVNWCMDEOF
}

verify_installation() {
    echo "${BLUE}[4/4]${NC} 验证安装..."
    echo ""

    if [ -f "mvnw" ] && [ -f ".mvn/wrapper/maven-wrapper.jar" ]; then
        echo "${GREEN}✅ Maven Wrapper 安装成功！${NC}"
        echo ""
        echo "${PURPLE}使用方法:${NC}"
        echo "  ${CYAN}./mvnw -version${NC}           # 查看 Maven 版本"
        echo "  ${CYAN}./mvnw clean compile${NC}     # 编译项目"
        echo "  ${CYAN}./mvnw spring-boot:run${NC}   # 启动应用"
        echo ""
        echo "${YELLOW}💡 提示: 首次运行会自动下载 Maven 和项目依赖，请耐心等待${NC}"
        return 0
    else
        echo "${RED}❌ 安装失败，请检查错误信息并重试${NC}"
        return 1
    fi
}

print_success_message() {
    echo ""
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
    echo "${GREEN}🎉 Maven Wrapper 安装完成！${NC}"
    echo ""
    echo "接下来可以运行: ${CYAN}./start.sh${NC} 启动项目"
    echo ""
    echo "或者直接运行: ${CYAN}./mvnw spring-boot:run${NC}"
    echo "${BLUE}══════════════════════════════════════════════════════════════${NC}"
}

print_fallback_message() {
    echo ""
    echo "${YELLOW}══════════════════════════════════════════════════════════════${NC}"
    echo "${YELLOW}⚠️  网络下载失败，提供以下替代方案：${NC}"
    echo ""
    echo "方案 1: 使用 IDE 运行（推荐）"
    echo "   ${CYAN}cat IDE_QUICKSTART.md${NC} 查看详细步骤"
    echo ""
    echo "方案 2: 手动安装 Maven"
    echo "   macOS: ${CYAN}brew install maven${NC}"
    echo "   Linux: ${CYAN}sudo apt install maven${NC} 或 ${CYAN}sudo yum install maven${NC}"
    echo ""
    echo "方案 3: 手动下载 Maven Wrapper"
    echo "   访问: https://maven.apache.org/wrapper/"
    echo "${YELLOW}══════════════════════════════════════════════════════════════${NC}"
}

# 主流程
print_header
check_java

echo ""
check_curl_or_wget
echo ""

create_wrapper_properties
echo ""

if download_wrapper_jar; then
    echo ""
    create_wrapper_scripts
    echo ""
    verify_installation
    print_success_message
else
    print_fallback_message
    exit 1
fi
