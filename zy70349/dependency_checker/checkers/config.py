from .base import Checker, CheckResult
from typing import Dict, Any, List
import os


class ConfigChecker(Checker):
    name = "config"
    description = "检查配置文件和环境变量"

    def check(self, config: Dict[str, Any]) -> CheckResult:
        issues = []
        warnings = []

        required_configs = config.get("required_configs", [])
        required_env_vars = config.get("required_env_vars", [])
        config_files = config.get("config_files", [])

        for cfg in required_configs:
            path = cfg.get("path") if isinstance(cfg, dict) else cfg
            name = cfg.get("name", path) if isinstance(cfg, dict) else path
            required = cfg.get("required", True) if isinstance(cfg, dict) else True

            if required:
                value = self._get_nested_value(config, path)
                if value is None or value == "":
                    issues.append({
                        "config": path,
                        "name": name,
                        "issue": "缺失或为空"
                    })

        for env_var in required_env_vars:
            var_name = env_var.get("name") if isinstance(env_var, dict) else env_var
            description = env_var.get("description", var_name) if isinstance(env_var, dict) else var_name
            required = env_var.get("required", True) if isinstance(env_var, dict) else True

            if required:
                if var_name not in os.environ:
                    issues.append({
                        "env_var": var_name,
                        "description": description,
                        "issue": "环境变量未设置"
                    })

        for cfg_file in config_files:
            path = cfg_file.get("path") if isinstance(cfg_file, dict) else cfg_file
            name = cfg_file.get("name", path) if isinstance(cfg_file, dict) else path
            required = cfg_file.get("required", True) if isinstance(cfg_file, dict) else True

            if required:
                if not os.path.exists(path):
                    issues.append({
                        "file": path,
                        "name": name,
                        "issue": "文件不存在"
                    })

        if issues:
            hints = []
            for issue in issues:
                if "config" in issue:
                    hints.append(f"{issue['name']}: 请在配置文件中设置 {issue['config']}")
                elif "env_var" in issue:
                    hints.append(f"{issue['description']}: 请设置环境变量 export {issue['env_var']}=<value>")
                elif "file" in issue:
                    hints.append(f"{issue['name']}: 请确保文件存在于 {issue['file']}")

            return self._fail(
                f"发现 {len(issues)} 个配置问题",
                details={"issues": issues, "warnings": warnings},
                fix_hint="\n".join(hints),
                severity=9
            )

        if warnings:
            return self._warn(
                f"配置检查通过，但有 {len(warnings)} 个警告",
                details={"warnings": warnings},
                fix_hint="建议检查上述警告项",
                severity=2
            )

        return self._pass(
            "配置文件和环境变量检查通过",
            details={
                "required_configs": len(required_configs),
                "required_env_vars": len(required_env_vars),
                "config_files": len(config_files)
            }
        )

    def _get_nested_value(self, config: Dict[str, Any], path: str) -> Any:
        keys = path.split('.')
        value = config
        for key in keys:
            if isinstance(value, dict) and key in value:
                value = value[key]
            else:
                return None
        return value
