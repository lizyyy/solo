from .base import Checker, CheckResult
from typing import Dict, Any
import sys
import subprocess
from packaging.version import Version, InvalidVersion


class VersionChecker(Checker):
    name = "version"
    description = "检查运行时版本要求"

    def check(self, config: Dict[str, Any]) -> CheckResult:
        version_requirements = config.get("version_requirements", {})
        if not version_requirements:
            return self._skip()

        issues = []
        passed = []

        python_min = version_requirements.get("python")
        if python_min:
            py_version = f"{sys.version_info.major}.{sys.version_info.minor}.{sys.version_info.micro}"
            try:
                if Version(py_version) < Version(python_min):
                    issues.append({
                        "name": "Python",
                        "current": py_version,
                        "required": python_min,
                        "issue": "版本过低"
                    })
                else:
                    passed.append({"name": "Python", "version": py_version})
            except InvalidVersion as e:
                issues.append({
                    "name": "Python",
                    "current": py_version,
                    "required": python_min,
                    "issue": f"版本解析失败: {e}"
                })

        node_min = version_requirements.get("node")
        if node_min:
            node_version = self._get_node_version()
            if node_version:
                try:
                    if Version(node_version.lstrip('v')) < Version(node_min):
                        issues.append({
                            "name": "Node.js",
                            "current": node_version,
                            "required": node_min,
                            "issue": "版本过低"
                        })
                    else:
                        passed.append({"name": "Node.js", "version": node_version})
                except InvalidVersion:
                    passed.append({"name": "Node.js", "version": node_version, "note": "无法解析版本，手动检查"})
            else:
                issues.append({
                    "name": "Node.js",
                    "current": "未安装或不在 PATH",
                    "required": node_min,
                    "issue": "未找到"
                })

        docker_min = version_requirements.get("docker")
        if docker_min:
            docker_version = self._get_docker_version()
            if docker_version:
                try:
                    if Version(docker_version) < Version(docker_min):
                        issues.append({
                            "name": "Docker",
                            "current": docker_version,
                            "required": docker_min,
                            "issue": "版本过低"
                        })
                    else:
                        passed.append({"name": "Docker", "version": docker_version})
                except InvalidVersion:
                    passed.append({"name": "Docker", "version": docker_version, "note": "无法解析版本，手动检查"})
            else:
                issues.append({
                    "name": "Docker",
                    "current": "未安装或不在 PATH",
                    "required": docker_min,
                    "issue": "未找到"
                })

        if issues:
            hints = []
            for issue in issues:
                if issue["issue"] == "版本过低":
                    hints.append(f"{issue['name']}: 当前版本 {issue['current']} < 最低要求 {issue['required']}，请升级")
                elif issue["issue"] == "未找到":
                    hints.append(f"{issue['name']}: 请安装 {issue['name']} 并确保在 PATH 中，最低版本要求 {issue['required']}")
                else:
                    hints.append(f"{issue['name']}: {issue['issue']}")

            return self._fail(
                f"发现 {len(issues)} 个版本问题",
                details={"issues": issues, "passed": passed},
                fix_hint="\n".join(hints),
                severity=6
            )

        return self._pass(
            "版本检查通过",
            details={"checked": passed}
        )

    def _get_node_version(self) -> str:
        try:
            result = subprocess.run(
                ['node', '--version'],
                capture_output=True,
                text=True,
                timeout=5
            )
            return result.stdout.strip()
        except Exception:
            return None

    def _get_docker_version(self) -> str:
        try:
            result = subprocess.run(
                ['docker', '--version'],
                capture_output=True,
                text=True,
                timeout=5
            )
            output = result.stdout.strip()
            if 'version' in output.lower():
                parts = output.split(',')[0].split()
                for part in parts:
                    if '.' in part:
                        return part.strip(',')
            return None
        except Exception:
            return None
