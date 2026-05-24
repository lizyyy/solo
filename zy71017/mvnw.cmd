@echo off
setlocal

set "WRAPPER_JAR=.mvn\wrapper\maven-wrapper.jar"

where mvn >nul 2>nul
if %ERRORLEVEL% equ 0 (
  mvn %*
  exit /b %ERRORLEVEL%
)

if exist "%WRAPPER_JAR%" (
  java -classpath "%WRAPPER_JAR%" org.apache.maven.wrapper.MavenWrapperMain %*
  exit /b %ERRORLEVEL%
)

echo Maven wrapper not found, please install Maven or use IDE to run the project
exit /b 1
