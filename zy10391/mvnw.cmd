@REM Maven Wrapper Bootstrap Script for Windows
@REM 兼容 Java 8 和没有系统 Maven 的环境

@echo off
setlocal

set "PROJECT_ROOT=%~dp0"
set "WRAPPER_JAR=%PROJECT_ROOT%.mvn\wrapper\maven-wrapper.jar"
set "WRAPPER_PROPERTIES=%PROJECT_ROOT%.mvn\wrapper\maven-wrapper.properties"

@REM Check if system Maven is available
where mvn >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Using system Maven
    mvn %*
    goto end
)

@REM Check if wrapper jar exists
if exist "%WRAPPER_JAR%" (
    echo Using Maven Wrapper
    java -classpath "%WRAPPER_JAR%" org.apache.maven.wrapper.MavenWrapperMain %*
    goto end
)

@REM If neither, show error
echo ERROR: Maven is not installed and Maven Wrapper JAR not found.
echo Please install Maven 3.6+ manually, or download the wrapper jar to:
echo %WRAPPER_JAR%
echo.
echo You can download it from:
echo https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/3.1.1/maven-wrapper-3.1.1.jar
exit /b 1

:end
endlocal
