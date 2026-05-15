@echo off
setlocal

set MAVEN_VERSION=3.9.6
set MAVEN_HOME=%USERPROFILE%\.m2\wrapper\dists\apache-maven-%MAVEN_VERSION%
set MAVEN_URL=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/%MAVEN_VERSION%/apache-maven-%MAVEN_VERSION%-bin.zip

if not exist "%MAVEN_HOME%" (
    echo Downloading Maven %MAVEN_VERSION%...
    mkdir "%MAVEN_HOME%"
    
    powershell -Command "& {[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12; Invoke-WebRequest '%MAVEN_URL%' -OutFile '%MAVEN_HOME%\maven.zip'}"
    
    powershell -Command "Expand-Archive -Path '%MAVEN_HOME%\maven.zip' -DestinationPath '%MAVEN_HOME%' -Force"
    
    move "%MAVEN_HOME%\apache-maven-%MAVEN_VERSION%\*" "%MAVEN_HOME%\"
    rmdir "%MAVEN_HOME%\apache-maven-%MAVEN_VERSION%"
    del "%MAVEN_HOME%\maven.zip"
    
    echo Maven %MAVEN_VERSION% installed successfully.
)

"%MAVEN_HOME%\bin\mvn.cmd" %*
