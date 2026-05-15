@echo off
REM API 字段血缘服务启动脚本 (Windows)

setlocal enabledelayedexpansion

set SCRIPT_DIR=%~dp0
set PROJECT_DIR=%SCRIPT_DIR%
set DATA_DIR=%PROJECT_DIR%data
set MVN_CMD=

REM 颜色定义
set GREEN=[INFO]
set YELLOW=[WARN]
set RED=[ERROR]

:check_java
echo %GREEN% 检查 Java 版本...
java -version >nul 2>&1
if errorlevel 1 (
    echo %RED% 未找到 Java，请先安装 Java 11 或更高版本
    exit /b 1
)

for /f tokens^=2^ delims^=^" %%i in ('java -version 2^>^&1 ^| findstr /i "version"') do (
    set JAVA_VERSION=%%i
)
for /f "delims=." %%i in ("%JAVA_VERSION%") do set JAVA_MAJOR=%%i
echo %GREEN% 当前 Java 版本: %JAVA_MAJOR%

if %JAVA_MAJOR% lss 11 (
    echo %RED% 需要 Java 11 或更高版本，当前版本: %JAVA_MAJOR%
    exit /b 1
)

:check_maven
echo %GREEN% 检查 Maven...

if exist "%PROJECT_DIR%mvnw.cmd" (
    set MVN_CMD=%PROJECT_DIR%mvnw.cmd
    echo %GREEN% 使用项目 Maven Wrapper
    goto :check_maven_done
)

mvn -version >nul 2>&1
if not errorlevel 1 (
    set MVN_CMD=mvn
    echo %GREEN% 使用系统 Maven
    goto :check_maven_done
)

echo %RED% 未找到 Maven，请先安装 Maven 或配置 mvnw
exit /b 1
:check_maven_done

:build_project
if "%1"=="start" goto :start_service

echo %GREEN% 开始构建项目...
cd "%PROJECT_DIR%"
%MVN_CMD% clean package -DskipTests
if errorlevel 1 (
    echo %RED% 项目构建失败
    exit /b 1
)
echo %GREEN% 项目构建完成

if "%1"=="build" goto :build_done

:start_service
echo %GREEN% 启动 API 字段血缘服务...

if not exist "%DATA_DIR%" mkdir "%DATA_DIR%"

set JAR_FILE=
for %%f in ("%PROJECT_DIR%target\api-field-lineage-service-*.jar") do (
    set JAR_FILE=%%f
    goto :jar_found
)
:jar_found

if "%JAR_FILE%"=="" (
    echo %RED% 未找到 jar 文件，请先构建项目
    exit /b 1
)

echo %GREEN% 使用 jar 文件: %JAR_FILE%
java -jar "%JAR_FILE%"
goto :end

:build_done
echo %GREEN% 构建完成！运行 '%~nx0 start' 启动服务
goto :end

:show_usage
echo API 字段血缘服务 - 启动脚本
echo.
echo 用法: %~nx0 [命令]
echo.
echo 命令:
echo   build    仅构建项目
echo   start    仅启动服务（需先构建）
echo   all      构建并启动（默认）
echo   help     显示帮助信息
echo.
echo 示例:
echo   %~nx0          # 构建并启动
echo   %~nx0 build    # 仅构建
echo   %~nx0 start    # 仅启动
goto :end

:end
endlocal

if "%1"=="help" goto :show_usage
if "%1"=="--help" goto :show_usage
if "%1"=="-h" goto :show_usage

if "%1"=="" goto :check_java
