@echo off
rem Maven Wrapper for Windows
rem 无需系统安装 Maven，自动下载并使用指定版本的 Maven

setlocal

set MAVEN_VERSION=3.9.6
set MAVEN_BASE=apache-maven-%MAVEN_VERSION%
set MAVEN_ARCHIVE=%MAVEN_BASE%-bin.zip
set MAVEN_URL=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/%MAVEN_VERSION%/%MAVEN_ARCHIVE%

set WRAPPER_DIR=%USERPROFILE%\.m2\wrapper\dists\apache-maven-%MAVEN_VERSION%
set MAVEN_HOME=%WRAPPER_DIR%\%MAVEN_BASE%

if not exist "%MAVEN_HOME%" (
    echo ========================================
    echo   Maven Wrapper - 正在下载 Maven %MAVEN_VERSION%
    echo ========================================
    echo.
    
    if not exist "%WRAPPER_DIR%" mkdir "%WRAPPER_DIR%"
    
    echo   使用 PowerShell 下载...
    powershell -Command "& {Invoke-WebRequest -Uri '%MAVEN_URL%' -OutFile '%WRAPPER_DIR%\%MAVEN_ARCHIVE%'}"
    
    echo.
    echo   正在解压...
    powershell -Command "& {Expand-Archive -Path '%WRAPPER_DIR%\%MAVEN_ARCHIVE%' -DestinationPath '%WRAPPER_DIR%'}"
    del "%WRAPPER_DIR%\%MAVEN_ARCHIVE%"
    
    echo   Maven 安装完成: %MAVEN_HOME%
    echo.
)

set PATH=%MAVEN_HOME%\bin;%PATH%

echo ========================================
echo   Maven Wrapper - 使用 Maven %MAVEN_VERSION%
echo ========================================
echo.
echo   执行命令: mvn %*
echo.

call "%MAVEN_HOME%\bin\mvn.cmd" %*

endlocal
