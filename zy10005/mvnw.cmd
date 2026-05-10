@REM Maven Wrapper script for Windows
@REM Attempts to download and use Maven 3.9.6

@echo off
setlocal enabledelayedexpansion

set MAVEN_VERSION=3.9.6
set MAVEN_HOME=%USERPROFILE%\.m2\wrapper\dists\apache-maven-%MAVEN_VERSION%
set MAVEN_URL=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/%MAVEN_VERSION%/apache-maven-%MAVEN_VERSION%-bin.zip

if not exist "%MAVEN_HOME%" (
    echo Downloading Maven %MAVEN_VERSION%...
    if not exist "%USERPROFILE%\.m2\wrapper\dists" mkdir "%USERPROFILE%\.m2\wrapper\dists"
    powershell -Command "Invoke-WebRequest -Uri '%MAVEN_URL%' -OutFile '%TEMP%\apache-maven-%MAVEN_VERSION%.zip'"
    powershell -Command "Expand-Archive -Path '%TEMP%\apache-maven-%MAVEN_VERSION%.zip' -DestinationPath '%USERPROFILE%\.m2\wrapper\dists' -Force"
    del "%TEMP%\apache-maven-%MAVEN_VERSION%.zip"
)

set M2_HOME=%MAVEN_HOME%\apache-maven-%MAVEN_VERSION%
set PATH=%M2_HOME%\bin;%PATH%

call mvn %*
