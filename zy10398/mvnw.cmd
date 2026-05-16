@echo off
@rem Maven Wrapper bootstrap script for Windows

setlocal

set MAVEN_VERSION=3.8.8
set WRAPPER_DIR=.mvn\wrapper
set WRAPPER_JAR=%WRAPPER_DIR%\maven-wrapper.jar
set WRAPPER_PROPERTIES=%WRAPPER_DIR%\maven-wrapper.properties
set MAVEN_BASE=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper

if not exist "%WRAPPER_DIR%" mkdir "%WRAPPER_DIR%"

if not exist "%WRAPPER_JAR%" (
    echo Downloading Maven Wrapper...
    set WRAPPER_VERSION=3.2.0
    powershell -Command "& {Invoke-WebRequest '%MAVEN_BASE%/%WRAPPER_VERSION%/maven-wrapper-%WRAPPER_VERSION%.jar' -OutFile '%WRAPPER_JAR%'}"
)

if not exist "%WRAPPER_PROPERTIES%" (
    echo distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/%MAVEN_VERSION%/apache-maven-%MAVEN_VERSION%-bin.zip > "%WRAPPER_PROPERTIES%"
)

java -classpath "%WRAPPER_JAR%" org.apache.maven.wrapper.MavenWrapperMain %*

endlocal
