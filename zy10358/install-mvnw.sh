#!/bin/bash

echo "======================================"
echo "  安装 Maven Wrapper"
echo "======================================"
echo ""

# 检查Java
if ! command -v java &> /dev/null; then
    echo "❌ 错误: 未找到Java，请先安装JDK 8或更高版本"
    exit 1
fi

JAVA_VERSION=$(java -version 2>&1 | head -n 1 | cut -d'"' -f2)
echo "✅ Java版本: $JAVA_VERSION"

# 检查是否已有mvnw
if [ -f "./mvnw" ] && [ -d "./.mvn" ]; then
    echo "✅ Maven Wrapper已存在"
    chmod +x ./mvnw
    exit 0
fi

echo ""
echo "📦 正在下载 Maven Wrapper..."

# 创建目录
mkdir -p .mvn/wrapper

# 下载maven-wrapper.properties
cat > .mvn/wrapper/maven-wrapper.properties << 'EOF'
distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.8.8/apache-maven-3.8.8-bin.zip
wrapperUrl=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.1.0/maven-wrapper-3.1.0.jar
EOF

# 下载maven-wrapper.jar
echo "下载 maven-wrapper.jar..."
if command -v curl &> /dev/null; then
    curl -s -L -o .mvn/wrapper/maven-wrapper.jar \
        "https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.1.0/maven-wrapper-3.1.0.jar"
elif command -v wget &> /dev/null; then
    wget -q -O .mvn/wrapper/maven-wrapper.jar \
        "https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.1.0/maven-wrapper-3.1.0.jar"
else
    echo "❌ 错误: 未找到curl或wget"
    echo ""
    echo "请手动安装Maven: "
    echo "  Mac: brew install maven"
    echo "  Linux: sudo apt install maven / sudo yum install maven"
    echo "  或下载: https://maven.apache.org/download.cgi"
    exit 1
fi

# 创建mvnw脚本
cat > mvnw << 'MVNWEOF'
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
cygwin=false;
darwin=false;
mingw=false
case "`uname`" in
  CYGWIN*) cygwin=true ;;
  MINGW*) mingw=true;;
  Darwin*) darwin=true
           #
           # Look for the Apple JDKs first to preserve the existing behaviour, and then look
           # for other JDKs based on /usr/libexec/java_home.  Looking first for the Apple JDKs
           # because the Apple JDK 1.4 does not provide Java home in the expected way, which
           # causes java_home to select another installed JDK on the system which breaks backwards
           # compatibility.
           #
           if [ -z "$JAVA_HOME" ] ; then
             # Try to set Java home from java_home if it is available and works.
             # First test if java_home is present and works.
             /usr/libexec/java_home > /dev/null 2>&1
             if [ $? -eq 0 ] ; then
               JAVA_HOME="`/usr/libexec/java_home`"
             fi
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
    JAVACMD="`\\unset -f command; \\command -v java`"
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
    wdir=`cd "$wdir/.."; pwd`
  done
  echo "${basedir}"
}

find_file_argument_basedir() {
  basedir=`pwd`
  for var in "$@" ; do
    if [ "$var" = "-f" ] || [ "$var" = "--file" ] ; then
      found=1
    elif [ -n "$found" ] ; then
      # resolve the file path relative to the current directory, as per
      # https://maven.apache.org/ref/3-LATEST/maven-embedder/cli.html
      basedir=`dirname "$var"`
      break
    fi
  done
  echo "${basedir}"
}

# concatenates all lines of a file
concat_lines() {
  if [ -f "$1" ]; then
    echo "$(tr -s '\n' ' ' < "$1")"
  fi
}

BASE_DIR=`find_maven_basedir "$@"`
if [ -z "$BASE_DIR" ] ; then
  exit 1;
fi

export MAVEN_PROJECTBASEDIR=${MAVEN_BASEDIR:-"$BASE_DIR"}
if [ "$MVNW_VERBOSE" = true ]; then
  echo $MAVEN_PROJECTBASEDIR
fi

##########################################################################################
# Extension to allow automatically downloading the maven-wrapper.jar from Maven-central
# This allows using the maven wrapper in projects that prohibit checking in binary data.
##########################################################################################
if [ -r "$BASE_DIR/.mvn/wrapper/maven-wrapper.jar" ]; then
    if [ "$MVNW_VERBOSE" = true ]; then
      echo "Found .mvn/wrapper/maven-wrapper.jar"
    fi
else
    if [ "$MVNW_VERBOSE" = true ]; then
      echo "Couldn't find .mvn/wrapper/maven-wrapper.jar, downloading it ..."
    fi
    if [ -n "$MVNW_REPOURL" ]; then
      jarUrl="$MVNW_REPOURL/org/apache/maven/wrapper/maven-wrapper/3.1.0/maven-wrapper-3.1.0.jar"
    else
      jarUrl="https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.1.0/maven-wrapper-3.1.0.jar"
    fi
    while IFS="=" read key value; do
      case "$key" in (wrapperUrl) jarUrl="$value" ;;
      esac
    done < "$BASE_DIR/.mvn/wrapper/maven-wrapper.properties"
    if [ "$MVNW_VERBOSE" = true ]; then
      echo "Downloading from: $jarUrl"
    fi
    wrapperJarPath="$BASE_DIR/.mvn/wrapper/maven-wrapper.jar"
    if $cygwin; then
      wrapperJarPath=`cygpath --path --unix "$wrapperJarPath"`
    fi

    if command -v curl > /dev/null; then
      if [ "$MVNW_VERBOSE" = true ]; then
        echo "Executing: curl $jarUrl -o $wrapperJarPath"
      fi
      curl --fail --show-error --location --output "$wrapperJarPath" "$jarUrl"
    else
      if [ "$MVNW_VERBOSE" = true ]; then
        echo "Executing: wget $jarUrl -O $wrapperJarPath"
      fi
      wget "$jarUrl" -O "$wrapperJarPath"
    fi
fi
##########################################################################################
# End of extension
##########################################################################################

MAVEN_OPTS="$(concat_lines "$MAVEN_PROJECTBASEDIR/.mvn/jvm.config") $MAVEN_OPTS"

# For Cygwin, ensure paths are in UNIX format before anything is touched
if $cygwin ; then
  [ -n "$M2_HOME" ] &&
    M2_HOME=`cygpath --unix "$M2_HOME"`
  [ -n "$MAVEN_PROJECTBASEDIR" ] &&
    MAVEN_PROJECTBASEDIR=`cygpath --unix "$MAVEN_PROJECTBASEDIR"`
fi

# Provide a "standardized" way to retrieve the CLI args that will
# work with both Windows and non-Windows executions.
MAVEN_CMD_LINE_ARGS="$MAVEN_CONFIG $*"
export MAVEN_CMD_LINE_ARGS

WRAPPER_JAR="`expr "$0" : '\(.*\)/mvnw'`/.mvn/wrapper/maven-wrapper.jar"
if [ "x$WRAPPER_JAR" = "x/.mvn/wrapper/maven-wrapper.jar" ]; then
    WRAPPER_JAR=".mvn/wrapper/maven-wrapper.jar"
fi
WRAPPER_LAUNCHER=org.apache.maven.wrapper.MavenWrapperMain

# avoid using MAVEN_CMD_LINE_ARGS below since that would loose parameter escaping in $@
if $cygwin; then
  JAVACMD=`cygpath --path --windows "$JAVACMD"`
fi

exec "$JAVACMD" \
  $MAVEN_OPTS \
  -classpath "$WRAPPER_JAR" \
  "-Dmaven.multiModuleProjectDirectory=$MAVEN_PROJECTBASEDIR" \
  $WRAPPER_LAUNCHER "$@"
MVNWEOF

chmod +x mvnw

echo ""
echo "✅ Maven Wrapper 安装完成！"
echo "   使用: ./mvnw spring-boot:run"
echo ""
