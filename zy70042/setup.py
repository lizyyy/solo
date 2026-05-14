#!/usr/bin/env python3
"""
模具寿命预警服务 - 环境配置脚本

功能：
1. 检测当前环境（Java、Python、网络）
2. 自动下载 Maven Wrapper 所需的所有组件
3. 提供清晰的安装指引

使用方法：
    python3 setup.py          # 完整环境检测和配置
    python3 setup.py --download-wrapper   # 仅下载 Maven Wrapper
    python3 setup.py --check  # 仅检测环境
"""

import os
import sys
import subprocess
import urllib.request
import urllib.error
import argparse
import json
import platform

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MVN_DIR = os.path.join(SCRIPT_DIR, ".mvn", "wrapper")

# Maven Wrapper 配置
WRAPPER_VERSION = "3.2.0"
MAVEN_VERSION = "3.9.6"

WRAPPER_JAR_URL = (
    f"https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/"
    f"maven-wrapper/{WRAPPER_VERSION}/maven-wrapper-{WRAPPER_VERSION}.jar"
)

MVNW_SH_URL = (
    "https://raw.githubusercontent.com/apache/maven-wrapper/master/mvnw"
)

MVNW_CMD_URL = (
    "https://raw.githubusercontent.com/apache/maven-wrapper/master/mvnw.cmd"
)

# 颜色输出
class Colors:
    GREEN = "\033[92m"
    RED = "\033[91m"
    YELLOW = "\033[93m"
    BLUE = "\033[94m"
    BOLD = "\033[1m"
    RESET = "\033[0m"

def print_color(msg, color=Colors.BLUE):
    print(f"{color}{msg}{Colors.RESET}")

def print_success(msg):
    print_color(f"✓ {msg}", Colors.GREEN)

def print_warning(msg):
    print_color(f"⚠ {msg}", Colors.YELLOW)

def print_error(msg):
    print_color(f"✗ {msg}", Colors.RED)

def print_info(msg):
    print_color(f"ℹ {msg}", Colors.BLUE)

def check_command(cmd):
    """检查命令是否存在"""
    try:
        result = subprocess.run(
            [cmd, "--version"] if cmd != "java" else [cmd, "-version"],
            capture_output=True,
            text=True
        )
        return True, result.stdout or result.stderr
    except FileNotFoundError:
        return False, ""
    except Exception as e:
        return False, str(e)

def check_java():
    """检查 Java 环境"""
    print_info("检查 Java 环境...")
    
    has_java, output = check_command("java")
    
    if not has_java:
        print_error("Java 未安装")
        return False, None
    
    if "Unable to locate a Java Runtime" in output:
        print_error("Java 命令存在但 JDK/JRE 未正确安装")
        return False, None
    
    # 提取版本号
    version = None
    for line in output.split('\n'):
        if 'version' in line.lower():
            # 典型输出: java version "17.0.5" 或 openjdk 17.0.5
            import re
            match = re.search(r'"?(\d+\.?\d*)', line)
            if match:
                version = match.group(1)
            break
    
    if version:
        try:
            major = int(version.split('.')[0])
            if major >= 17:
                print_success(f"Java 版本: {version} (满足要求: JDK 17+)")
                return True, version
            else:
                print_warning(f"Java 版本: {version} (需要 JDK 17+，当前版本可能不兼容)")
                return True, version
        except:
            print_success(f"Java 已安装 (版本检测: {version})")
            return True, version
    else:
        print_success(f"Java 已安装")
        return True, None

def check_python():
    """检查 Python 环境"""
    print_info("检查 Python 环境...")
    version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
    print_success(f"Python 版本: {version}")
    return True

def check_network():
    """检查网络连接"""
    print_info("检查网络连接...")
    test_urls = [
        "https://www.google.com",
        "https://repo.maven.apache.org"
    ]
    
    for url in test_urls:
        try:
            urllib.request.urlopen(url, timeout=10)
            print_success(f"网络连接正常 ({url})")
            return True
        except Exception as e:
            continue
    
    print_warning("无法访问外部网络，可能无法下载依赖")
    return False

def download_file(url, dest_path):
    """下载文件"""
    print_info(f"下载: {url}")
    print_info(f"保存到: {dest_path}")
    
    try:
        os.makedirs(os.path.dirname(dest_path), exist_ok=True)
        
        def progress(block_num, block_size, total_size):
            downloaded = block_num * block_size
            if total_size > 0:
                percent = min(100, downloaded * 100 / total_size)
                print(f"\r  进度: {percent:.1f}% ({downloaded}/{total_size} bytes)", end="", flush=True)
        
        urllib.request.urlretrieve(url, dest_path, reporthook=progress)
        print()  # 换行
        print_success(f"下载完成: {os.path.basename(dest_path)}")
        return True
    except urllib.error.URLError as e:
        print_error(f"下载失败: {e}")
        return False
    except Exception as e:
        print_error(f"下载出错: {e}")
        return False

def download_wrapper_jar():
    """下载 Maven Wrapper JAR"""
    wrapper_jar = os.path.join(MVN_DIR, "maven-wrapper.jar")
    
    if os.path.exists(wrapper_jar):
        print_success(f"Maven Wrapper JAR 已存在: {wrapper_jar}")
        return True
    
    print_info("下载 Maven Wrapper JAR...")
    return download_file(WRAPPER_JAR_URL, wrapper_jar)

def ensure_wrapper_properties():
    """确保 wrapper 配置文件存在"""
    props_file = os.path.join(MVN_DIR, "maven-wrapper.properties")
    
    if os.path.exists(props_file):
        print_success(f"Maven Wrapper 配置已存在: {props_file}")
        return True
    
    print_info("创建 Maven Wrapper 配置...")
    os.makedirs(MVN_DIR, exist_ok=True)
    
    content = f"""\
distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/{MAVEN_VERSION}/apache-maven-{MAVEN_VERSION}-bin.zip
wrapperUrl=https://repo.maven.apache.org/maven2/org/apache/maven/wrapper/maven-wrapper/{WRAPPER_VERSION}/maven-wrapper-{WRAPPER_VERSION}.jar
"""
    
    with open(props_file, 'w') as f:
        f.write(content)
    
    print_success(f"配置文件已创建: {props_file}")
    return True

def download_mvnw_scripts():
    """下载 mvnw 脚本"""
    scripts = [
        ("mvnw", MVNW_SH_URL, 0o755),
        ("mvnw.cmd", MVNW_CMD_URL, None)
    ]
    
    success = True
    for name, url, mode in scripts:
        script_path = os.path.join(SCRIPT_DIR, name)
        
        # 如果已经存在（我们自己创建的），跳过
        if os.path.exists(script_path):
            print_success(f"{name} 脚本已存在")
            continue
        
        print_info(f"下载 {name} 脚本...")
        if download_file(url, script_path):
            if mode:
                os.chmod(script_path, mode)
        else:
            print_warning(f"无法下载 {name}，但当前项目已包含该脚本")
    
    return success

def print_environment_report(java_ok, java_version, python_ok, network_ok):
    """打印环境检测报告"""
    print()
    print_color("=" * 60, Colors.BOLD)
    print_color("环境检测报告", Colors.BOLD)
    print_color("=" * 60, Colors.BOLD)
    
    status = []
    if java_ok and java_version:
        major = int(java_version.split('.')[0])
        if major >= 17:
            status.append(("Java", "OK"))
        else:
            status.append(("Java", "警告 (需要 JDK 17+)"))
    elif java_ok:
        status.append(("Java", "OK (版本未知)"))
    else:
        status.append(("Java", "缺失"))
    
    status.append(("Python", "OK" if python_ok else "缺失"))
    status.append(("网络", "OK" if network_ok else "可能受限"))
    
    for item, stat in status:
        color = Colors.GREEN if stat == "OK" else (Colors.YELLOW if "警告" in stat else Colors.RED)
        print(f"  {item}: {color}{stat}{Colors.RESET}")
    
    print_color("=" * 60, Colors.BOLD)

def print_install_guide(java_ok, java_version):
    """打印安装指引"""
    print()
    print_color("安装指引", Colors.BOLD)
    print_color("-" * 40)
    
    if not java_ok or (java_version and int(java_version.split('.')[0]) < 17):
        print()
        print_warning("需要安装 JDK 17 或更高版本")
        print()
        print_info("macOS (推荐 Homebrew):")
        print_color("  brew install openjdk@17", Colors.BLUE)
        print_color('  echo \'export PATH="/usr/local/opt/openjdk@17/bin:$PATH"\' >> ~/.zshrc', Colors.BLUE)
        print_color('  source ~/.zshrc', Colors.BLUE)
        print()
        print_info("Linux (Ubuntu/Debian):")
        print_color("  sudo apt-get update", Colors.BLUE)
        print_color("  sudo apt-get install -y openjdk-17-jdk", Colors.BLUE)
        print()
        print_info("Windows:")
        print_color("  下载并安装: https://adoptium.net/ (选择 Temurin 17)", Colors.BLUE)
        print()
    
    print_info("安装好 JDK 后，运行以下命令启动服务:")
    print_color("  ./mvnw spring-boot:run", Colors.GREEN)
    print()
    print_info("或者使用 Maven (如果已安装):")
    print_color("  mvn spring-boot:run", Colors.GREEN)
    print()

def download_wrapper_only():
    """仅下载 Maven Wrapper 组件"""
    print_color("\n下载 Maven Wrapper 组件...\n", Colors.BOLD)
    
    success = True
    success &= ensure_wrapper_properties()
    success &= download_wrapper_jar()
    
    return success

def full_setup():
    """完整环境检测和配置"""
    print_color("\n模具寿命预警服务 - 环境配置", Colors.BOLD)
    print_color("=" * 50 + "\n", Colors.BOLD)
    
    # 环境检测
    java_ok, java_version = check_java()
    python_ok = check_python()
    network_ok = check_network()
    
    print_environment_report(java_ok, java_version, python_ok, network_ok)
    
    # 下载 Wrapper 组件
    print()
    print_color("配置 Maven Wrapper...\n", Colors.BOLD)
    wrapper_ok = download_wrapper_only()
    
    # 下载脚本
    download_mvnw_scripts()
    
    print()
    print_color("=" * 50, Colors.BOLD)
    
    if wrapper_ok and java_ok:
        print_success("环境配置完成！")
    else:
        print_warning("部分组件配置失败，请查看上方信息")
    
    print_install_guide(java_ok, java_version)

def main():
    parser = argparse.ArgumentParser(
        description="模具寿命预警服务 - 环境配置脚本",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例:
  python3 setup.py              # 完整环境检测和配置
  python3 setup.py --download-wrapper   # 仅下载 Maven Wrapper
  python3 setup.py --check      # 仅检测环境
        """
    )
    parser.add_argument("--download-wrapper", action="store_true", 
                        help="仅下载 Maven Wrapper 组件")
    parser.add_argument("--check", action="store_true",
                        help="仅检测当前环境，不下载任何文件")
    
    args = parser.parse_args()
    
    if args.check:
        java_ok, java_version = check_java()
        python_ok = check_python()
        network_ok = check_network()
        print_environment_report(java_ok, java_version, python_ok, network_ok)
        print_install_guide(java_ok, java_version)
        return 0 if java_ok else 1
    
    if args.download_wrapper:
        success = download_wrapper_only()
        if success:
            print_success("\nMaven Wrapper 下载完成！")
            print_info("运行 ./mvnw -v 验证")
        return 0 if success else 1
    
    full_setup()
    return 0

if __name__ == "__main__":
    sys.exit(main())
