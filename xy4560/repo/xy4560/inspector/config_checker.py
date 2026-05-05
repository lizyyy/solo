"""配置文件核对器 - 与 package.json、pyproject.toml 等核对"""

import json
import os
import re
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple

try:
    import tomllib
except ImportError:
    import tomli as tomllib


@dataclass
class PackageInfo:
    """解析后的包信息"""
    
    package_type: str
    scripts: Dict[str, str] = field(default_factory=dict)
    dependencies: Dict[str, str] = field(default_factory=dict)
    dev_dependencies: Dict[str, str] = field(default_factory=dict)
    raw_config: Dict[str, Any] = field(default_factory=dict)


@dataclass
class CommandCheckResult:
    """命令核对结果"""
    
    command: str
    command_type: str
    is_valid: bool
    issue_type: str = ""
    issue_description: str = ""
    expected: str = ""
    actual: str = ""
    suggestion: str = ""


@dataclass
class ConfigCheckResult:
    """配置文件核对总结果"""
    
    package_info: Optional[PackageInfo] = None
    command_results: List[CommandCheckResult] = field(default_factory=list)
    missing_commands: List[str] = field(default_factory=list)
    extra_commands: List[str] = field(default_factory=list)
    issues: List[Dict[str, Any]] = field(default_factory=list)


class ConfigChecker:
    """配置文件核对器"""
    
    def __init__(self, project_dir: str):
        self.project_dir = project_dir
        self.package_info = self._load_package_info()
    
    def _load_package_info(self) -> Optional[PackageInfo]:
        """加载项目包信息"""
        package_json_path = os.path.join(self.project_dir, "package.json")
        if os.path.exists(package_json_path):
            return self._load_package_json(package_json_path)
        
        pyproject_path = os.path.join(self.project_dir, "pyproject.toml")
        if os.path.exists(pyproject_path):
            return self._load_pyproject_toml(pyproject_path)
        
        requirements_path = os.path.join(self.project_dir, "requirements.txt")
        if os.path.exists(requirements_path):
            return self._load_requirements_txt(requirements_path)
        
        return None
    
    def _load_package_json(self, path: str) -> PackageInfo:
        """加载 package.json"""
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        info = PackageInfo(
            package_type="npm",
            scripts=data.get("scripts", {}),
            dependencies=data.get("dependencies", {}),
            dev_dependencies=data.get("devDependencies", {}),
            raw_config=data
        )
        return info
    
    def _load_pyproject_toml(self, path: str) -> PackageInfo:
        """加载 pyproject.toml"""
        with open(path, "rb") as f:
            data = tomllib.load(f)
        
        info = PackageInfo(
            package_type="python",
            raw_config=data
        )
        
        project = data.get("project", {})
        dependencies = project.get("dependencies", [])
        info.dependencies = {
            dep.split("==")[0].split(">=")[0].split("<=")[0]: dep
            for dep in dependencies
        }
        
        optional_deps = project.get("optional-dependencies", {})
        for group, deps in optional_deps.items():
            for dep in deps:
                pkg_name = dep.split("==")[0].split(">=")[0].split("<=")[0]
                info.dev_dependencies[f"{group}:{pkg_name}"] = dep
        
        return info
    
    def _load_requirements_txt(self, path: str) -> PackageInfo:
        """加载 requirements.txt"""
        info = PackageInfo(package_type="python")
        
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#"):
                    pkg_name = line.split("==")[0].split(">=")[0].split("<=")[0]
                    info.dependencies[pkg_name] = line
        
        return info
    
    def check_commands(self, extracted_commands: List[Any]) -> ConfigCheckResult:
        """核对提取的命令"""
        result = ConfigCheckResult(package_info=self.package_info)
        
        for cmd in extracted_commands:
            check_result = self._check_single_command(cmd)
            result.command_results.append(check_result)
            
            if not check_result.is_valid:
                result.issues.append({
                    "command": cmd.command,
                    "type": check_result.issue_type,
                    "description": check_result.issue_description,
                    "suggestion": check_result.suggestion
                })
        
        result.missing_commands = self._find_missing_commands(extracted_commands)
        result.extra_commands = self._find_extra_commands(extracted_commands)
        
        return result
    
    def _check_single_command(self, extracted_cmd: Any) -> CommandCheckResult:
        """检查单个命令"""
        cmd_str = extracted_cmd.command
        cmd_type = extracted_cmd.command_type
        
        result = CommandCheckResult(
            command=cmd_str,
            command_type=cmd_type,
            is_valid=True
        )
        
        if cmd_type in ["npm", "pnpm", "yarn"]:
            return self._check_npm_like_command(cmd_str, cmd_type, result)
        elif cmd_type == "python":
            return self._check_python_command(cmd_str, result)
        elif cmd_type in ["curl", "wget"]:
            return self._check_network_command(cmd_str, cmd_type, result)
        
        result.is_valid = True
        return result
    
    def _check_npm_like_command(
        self, cmd_str: str, cmd_type: str, result: CommandCheckResult
    ) -> CommandCheckResult:
        """检查 npm/pnpm/yarn 类命令"""
        parts = cmd_str.split()
        if len(parts) < 2:
            result.is_valid = False
            result.issue_type = "invalid_command"
            result.issue_description = f"无效的 {cmd_type} 命令格式"
            return result
        
        subcommand = parts[1]
        
        if subcommand == "run":
            if len(parts) < 3:
                result.is_valid = False
                result.issue_type = "missing_script_name"
                result.issue_description = f"{cmd_type} run 命令缺少脚本名称"
                result.suggestion = "请指定要运行的脚本名称"
                return result
            
            script_name = parts[2]
            
            if self.package_info and self.package_info.scripts:
                if script_name not in self.package_info.scripts:
                    result.is_valid = False
                    result.issue_type = "script_not_found"
                    result.issue_description = f"脚本 '{script_name}' 在 package.json 中不存在"
                    result.expected = f"脚本 '{script_name}' 应存在于 scripts 中"
                    result.actual = f"scripts 中可用的脚本: {list(self.package_info.scripts.keys())}"
                    result.suggestion = f"请检查 README 中的脚本名称是否正确，或在 package.json 中添加 '{script_name}' 脚本"
                else:
                    actual_script = self.package_info.scripts[script_name]
                    result.expected = f"脚本 '{script_name}' 存在"
                    result.actual = f"脚本内容: {actual_script}"
            else:
                result.is_valid = False
                result.issue_type = "no_package_json"
                result.issue_description = "未找到 package.json 文件"
                result.suggestion = "请确保项目根目录存在 package.json"
        
        elif subcommand in ["install", "add"]:
            pass
        
        elif subcommand in ["test", "start", "build"]:
            if self.package_info and self.package_info.scripts:
                if subcommand not in self.package_info.scripts:
                    result.is_valid = False
                    result.issue_type = "script_not_found"
                    result.issue_description = f"默认脚本 '{subcommand}' 在 package.json 中不存在"
                    result.suggestion = f"请在 package.json 的 scripts 中添加 '{subcommand}' 脚本"
        
        return result
    
    def _check_python_command(
        self, cmd_str: str, result: CommandCheckResult
    ) -> CommandCheckResult:
        """检查 Python 命令"""
        parts = cmd_str.split()
        
        if len(parts) >= 2:
            if parts[1] == "-m":
                if len(parts) >= 3:
                    module_name = parts[2]
                    
                    module_map = {
                        "pip": "pip",
                        "pytest": "pytest",
                        "flask": "flask",
                        "django": "django",
                        "uvicorn": "uvicorn",
                        "gunicorn": "gunicorn",
                    }
                    
                    pkg_name = module_map.get(module_name, module_name)
                    
                    if self.package_info:
                        all_deps = {**self.package_info.dependencies, **self.package_info.dev_dependencies}
                        if pkg_name not in all_deps and not any(
                            pkg_name in k for k in all_deps.keys()
                        ):
                            result.is_valid = False
                            result.issue_type = "missing_dependency"
                            result.issue_description = f"模块 '{module_name}' 未在依赖中声明"
                            result.expected = f"依赖应包含 '{pkg_name}'"
                            result.suggestion = f"请在 requirements.txt 或 pyproject.toml 中添加 '{pkg_name}' 依赖"
            
            elif parts[1].endswith(".py"):
                script_file = parts[1]
                script_path = os.path.join(self.project_dir, script_file)
                
                if not os.path.exists(script_path):
                    result.is_valid = False
                    result.issue_type = "file_not_found"
                    result.issue_description = f"Python 脚本 '{script_file}' 不存在"
                    result.expected = f"文件 {script_file} 应存在"
                    result.suggestion = f"请确保 {script_file} 存在于项目目录中"
        
        return result
    
    def _check_network_command(
        self, cmd_str: str, cmd_type: str, result: CommandCheckResult
    ) -> CommandCheckResult:
        """检查网络命令（curl/wget）"""
        url_pattern = re.compile(
            r"https?://[^\s\"'<>]+"
        )
        
        urls = url_pattern.findall(cmd_str)
        if urls:
            pass
        
        return result
    
    def _find_missing_commands(self, extracted_commands: List[Any]) -> List[str]:
        """查找文档中提到但配置中不存在的命令"""
        missing = []
        
        if not self.package_info or not self.package_info.scripts:
            return missing
        
        documented_scripts = set()
        for cmd in extracted_commands:
            parts = cmd.command.split()
            if len(parts) >= 3 and parts[1] == "run":
                documented_scripts.add(parts[2])
        
        for script_name in documented_scripts:
            if script_name not in self.package_info.scripts:
                missing.append(script_name)
        
        return missing
    
    def _find_extra_commands(self, extracted_commands: List[Any]) -> List[str]:
        """查找配置中存在但文档中未提到的命令"""
        extra = []
        
        if not self.package_info or not self.package_info.scripts:
            return extra
        
        documented_scripts = set()
        for cmd in extracted_commands:
            parts = cmd.command.split()
            if len(parts) >= 3 and parts[1] == "run":
                documented_scripts.add(parts[2])
            elif len(parts) >= 2 and parts[1] in ["test", "start", "build"]:
                documented_scripts.add(parts[1])
        
        common_scripts = {"test", "start", "build", "dev", "lint", "format"}
        for script_name in self.package_info.scripts:
            if script_name in common_scripts and script_name not in documented_scripts:
                extra.append(script_name)
        
        return extra
    
    def get_available_scripts(self) -> List[str]:
        """获取所有可用的脚本"""
        if self.package_info and self.package_info.scripts:
            return list(self.package_info.scripts.keys())
        return []
    
    def get_dependency_status(self, dependency_name: str) -> Tuple[bool, str]:
        """检查依赖状态"""
        if not self.package_info:
            return (False, "未找到包配置文件")
        
        all_deps = {**self.package_info.dependencies, **self.package_info.dev_dependencies}
        
        if dependency_name in all_deps:
            return (True, all_deps[dependency_name])
        
        for key in all_deps:
            if dependency_name in key:
                return (True, all_deps[key])
        
        return (False, "依赖未找到")
