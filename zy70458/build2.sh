#!/bin/bash

set -e

PORT_INSPECTOR_HOME=$(cd "$(dirname "$0")" && pwd)

cd "$PORT_INSPECTOR_HOME"

mkdir -p target/classes
mkdir -p target/dependency/picocli
mkdir -p target/dependency/jackson
mkdir -p target/dependency/poi

echo "Downloading picocli..."
curl -sL "https://repo1.maven.org/maven2/info/picocli/picocli/4.7.5/picocli-4.7.5.jar" -o target/dependency/picocli/picocli-4.7.5.jar

echo "Downloading jackson..."
curl -sL "https://repo1.maven.org/maven2/com/fasterxml/jackson/core/jackson-databind/2.15.2/jackson-databind-2.15.2.jar" -o target/dependency/jackson/jackson-databind-2.15.2.jar
curl -sL "https://repo1.maven.org/maven2/com/fasterxml/jackson/core/jackson-annotations/2.15.2/jackson-annotations-2.15.2.jar" -o target/dependency/jackson/jackson-annotations-2.15.2.jar
curl -sL "https://repo1.maven.org/maven2/com/fasterxml/jackson/core/jackson-core/2.15.2/jackson-core-2.15.2.jar" -o target/dependency/jackson/jackson-core-2.15.2.jar
curl -sL "https://repo1.maven.org/maven2/com/fasterxml/jackson/datatype/jackson-datatype-jsr310/2.15.2/jackson-datatype-jsr310-2.15.2.jar" -o target/dependency/jackson/jackson-datatype-jsr310-2.15.2.jar

echo "Downloading poi and dependencies..."
curl -sL "https://repo1.maven.org/maven2/org/apache/poi/poi-ooxml/5.2.4/poi-ooxml-5.2.4.jar" -o target/dependency/poi/poi-ooxml-5.2.4.jar
curl -sL "https://repo1.maven.org/maven2/org/apache/poi/poi/5.2.4/poi-5.2.4.jar" -o target/dependency/poi/poi-5.2.4.jar
curl -sL "https://repo1.maven.org/maven2/org/apache/commons/commons-collections4/4.4/commons-collections4-4.4.jar" -o target/dependency/poi/commons-collections4-4.4.jar
curl -sL "https://repo1.maven.org/maven2/org/apache/xmlbeans/xmlbeans/5.1.1/xmlbeans-5.1.1.jar" -o target/dependency/poi/xmlbeans-5.1.1.jar
curl -sL "https://repo1.maven.org/maven2/org/apache/commons/commons-compress/1.23.0/commons-compress-1.23.0.jar" -o target/dependency/poi/commons-compress-1.23.0.jar
curl -sL "https://repo1.maven.org/maven2/commons-io/commons-io/2.13.0/commons-io-2.13.0.jar" -o target/dependency/poi/commons-io-2.13.0.jar
curl -sL "https://repo1.maven.org/maven2/org/apache/logging/log4j/log4j-api/2.20.0/log4j-api-2.20.0.jar" -o target/dependency/poi/log4j-api-2.20.0.jar
curl -sL "https://repo1.maven.org/maven2/org/apache/logging/log4j/log4j-core/2.20.0/log4j-core-2.20.0.jar" -o target/dependency/poi/log4j-core-2.20.0.jar
curl -sL "https://repo1.maven.org/maven2/org/apache/poi/poi-ooxml-lite/5.2.4/poi-ooxml-lite-5.2.4.jar" -o target/dependency/poi/poi-ooxml-lite-5.2.4.jar
curl -sL "https://repo1.maven.org/maven2/com/github/virtuald/curvesapi/1.07/curvesapi-1.07.jar" -o target/dependency/poi/curvesapi-1.07.jar

echo "Compiling..."
CLASSPATH="target/dependency/picocli/picocli-4.7.5.jar:target/dependency/jackson/*:target/dependency/poi/*"

find src/main/java -name "*.java" | xargs javac -cp "$CLASSPATH" -d target/classes -encoding UTF-8

echo "Build successful!"
