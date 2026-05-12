from typing import Dict, Any, List, Optional
from .checkers import (
    Checker, CheckResult, CheckStatus,
    DatabaseChecker, CacheChecker, QueueChecker,
    PortChecker, ConfigChecker, VersionChecker
)
import yaml
import json
from datetime import datetime
from pathlib import Path


CHECKER_REGISTRY = {
    "database": DatabaseChecker,
    "cache": CacheChecker,
    "queue": QueueChecker,
    "port": PortChecker,
    "config": ConfigChecker,
    "version": VersionChecker,
}

CHECKER_ORDER = [
    "config",
    "version",
    "port",
    "database",
    "cache",
    "queue",
]


class DependencyCheckerEngine:
    def __init__(self, config_path: str = None):
        self.config_path = config_path
        self.config = {}
        self.checkers: Dict[str, Checker] = {}
        self._load_config()
        self._init_checkers()

    def _load_config(self):
        if not self.config_path:
            self.config = {}
            return

        path = Path(self.config_path)
        if not path.exists():
            raise FileNotFoundError(f"配置文件不存在: {self.config_path}")

        with open(path, 'r', encoding='utf-8') as f:
            if path.suffix in ('.yaml', '.yml'):
                self.config = yaml.safe_load(f) or {}
            elif path.suffix == '.json':
                self.config = json.load(f) or {}
            else:
                raise ValueError(f"不支持的配置文件格式: {path.suffix}")

    def _init_checkers(self):
        for name in CHECKER_ORDER:
            if name in CHECKER_REGISTRY:
                self.checkers[name] = CHECKER_REGISTRY[name]()

    def run_all(self) -> List[CheckResult]:
        results = []
        for name in CHECKER_ORDER:
            if name in self.checkers:
                checker = self.checkers[name]
                result = checker.check(self.config)
                results.append(result)
        return results

    def run_one(self, checker_name: str) -> CheckResult:
        if checker_name not in self.checkers:
            raise ValueError(f"未知的检查器: {checker_name}")
        checker = self.checkers[checker_name]
        return checker.check(self.config)

    def sort_results_by_severity(self, results: List[CheckResult]) -> List[CheckResult]:
        return sorted(
            results,
            key=lambda r: (
                0 if r.status == CheckStatus.FAIL else
                1 if r.status == CheckStatus.WARN else
                2 if r.status == CheckStatus.SKIP else 3,
                -r.severity,
                CHECKER_ORDER.index(r.name) if r.name in CHECKER_ORDER else 999
            )
        )

    def get_results_summary(self, results: List[CheckResult]) -> Dict[str, Any]:
        passed = [r for r in results if r.status == CheckStatus.PASS]
        failed = [r for r in results if r.status == CheckStatus.FAIL]
        warnings = [r for r in results if r.status == CheckStatus.WARN]
        skipped = [r for r in results if r.status == CheckStatus.SKIP]

        can_start = len(failed) == 0

        return {
            "total": len(results),
            "passed": len(passed),
            "failed": len(failed),
            "warnings": len(warnings),
            "skipped": len(skipped),
            "can_start": can_start,
            "timestamp": datetime.now().isoformat()
        }

    def generate_report(self, results: List[CheckResult],
                        output_format: str = "text") -> str:
        sorted_results = self.sort_results_by_severity(results)
        summary = self.get_results_summary(results)

        if output_format == "json":
            report = {
                "summary": summary,
                "results": [r.to_dict() for r in sorted_results]
            }
            return json.dumps(report, indent=2, ensure_ascii=False)

        elif output_format == "yaml":
            report = {
                "summary": summary,
                "results": [r.to_dict() for r in sorted_results]
            }
            return yaml.dump(report, allow_unicode=True, sort_keys=False)

        else:
            return self._generate_text_report(sorted_results, summary)

    def _generate_text_report(self, results: List[CheckResult],
                              summary: Dict[str, Any]) -> str:
        lines = []
        lines.append("=" * 60)
        lines.append("  服务启动依赖检查报告")
        lines.append("=" * 60)
        lines.append("")
        lines.append(f"检查时间: {summary['timestamp']}")
        lines.append(f"总计: {summary['total']} 项 | "
                     f"通过: {summary['passed']} | "
                     f"失败: {summary['failed']} | "
                     f"警告: {summary['warnings']} | "
                     f"跳过: {summary['skipped']}")
        lines.append("")

        if summary["can_start"]:
            lines.append("✅ 所有依赖检查通过，可以启动服务")
        else:
            lines.append("❌ 发现问题，服务可能无法启动")
        lines.append("")
        lines.append("-" * 60)
        lines.append("详细结果 (按影响优先级排序):")
        lines.append("-" * 60)
        lines.append("")

        for result in results:
            status_icon = {
                CheckStatus.PASS: "✅",
                CheckStatus.FAIL: "❌",
                CheckStatus.WARN: "⚠️",
                CheckStatus.SKIP: "⏭️"
            }.get(result.status, "?")

            lines.append(f"{status_icon} [{result.name}] {result.message}")

            if result.status in (CheckStatus.FAIL, CheckStatus.WARN):
                if result.fix_hint:
                    lines.append(f"   💡 修复建议: {result.fix_hint}")

            if result.details:
                detail_str = ", ".join(
                    f"{k}={v}" for k, v in result.details.items()
                    if v is not None
                )
                if detail_str:
                    lines.append(f"   详情: {detail_str}")
            lines.append("")

        lines.append("=" * 60)
        return "\n".join(lines)

    def get_explaination(self, checker_name: str) -> str:
        explanations = {
            "database": """数据库检查器检查以下内容：
1. 配置完整性（host、user、database 是否设置）
2. 凭证格式（密码是否包含非法字符）
3. 端口有效性（1-65535）
4. 版本要求（实际版本 >= min_version）
5. Schema 版本匹配（schema_version == expected_schema_version）
6. 连接性测试

为什么重要：数据库是大多数应用的核心依赖，
连接失败会导致服务无法启动或运行时崩溃。""",
            "cache": """缓存检查器检查以下内容：
1. 缓存地址配置
2. 端口有效性
3. 连接性测试
4. 安全警告（空密码）

为什么重要：缓存服务不可用会导致应用响应变慢，
甚至在强依赖缓存的场景下导致错误。""",
            "queue": """消息队列检查器检查以下内容：
1. 队列地址配置
2. 连接性测试
3. 必需主题是否配置

为什么重要：消息队列是异步处理的核心，
队列不可用会导致任务堆积和功能异常。""",
            "port": """端口检查器检查以下内容：
1. 端口号有效性（1-65535）
2. 端口是否被占用

为什么重要：端口冲突会导致服务启动失败，
这是本地开发环境最常见的问题之一。""",
            "config": """配置检查器检查以下内容：
1. 必填配置项是否存在
2. 必需环境变量是否设置
3. 配置文件是否存在

为什么重要：配置缺失或错误是新同事拉项目后
最常见的启动失败原因。""",
            "version": """版本检查器检查以下内容：
1. Python 版本
2. Node.js 版本
3. Docker 版本

为什么重要：版本不匹配会导致依赖安装失败、
运行时错误或功能异常。"""
        }
        return explanations.get(checker_name, f"无 {checker_name} 的详细说明")

    def get_fix_hints(self, results: List[CheckResult]) -> List[str]:
        hints = []
        sorted_results = self.sort_results_by_severity(results)

        for result in sorted_results:
            if result.status in (CheckStatus.FAIL, CheckStatus.WARN):
                if result.fix_hint:
                    hints.append(f"[{result.name}] {result.fix_hint}")

        return hints
