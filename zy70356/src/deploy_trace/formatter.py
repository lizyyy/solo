from typing import List, Dict, Any
from tabulate import tabulate
from colorama import Fore, Style, init
from .models import (
    TraceResult, CompareResult, VerifyResult, ReportItem, ArtifactStatus
)


class OutputFormatter:
    def __init__(self):
        init(autoreset=True)

    def format_trace(self, result: TraceResult, output_format: str = "text") -> str:
        if output_format == "json":
            return self._format_trace_json(result)
        return self._format_trace_text(result)

    def _format_trace_json(self, result: TraceResult) -> str:
        import json
        data = {
            "environment": result.environment,
            "summary": result.summary,
            "risks": result.risks,
            "trace_chain": result.trace_chain,
            "artifact": {
                "artifact_id": result.artifact.artifact_id,
                "name": result.artifact.name,
                "version": result.artifact.version,
                "environment": result.artifact.environment,
                "deploy_time": result.artifact.deploy_time.isoformat(),
                "status": result.artifact.status.value,
                "issues": result.artifact.issues
            }
        }
        return json.dumps(data, indent=2, ensure_ascii=False)

    def _format_trace_text(self, result: TraceResult) -> str:
        lines = []

        lines.append(f"{Fore.CYAN}={'*' * 60}=")
        lines.append(f"{Fore.CYAN}  制品追溯报告")
        lines.append(f"{Fore.CYAN}={'*' * 60}=")
        lines.append("")

        lines.append(f"{Fore.YELLOW}【摘要】")
        lines.append(f"  {result.summary}")
        lines.append("")

        if result.risks:
            lines.append(f"{Fore.RED}【风险项】")
            for risk in result.risks:
                lines.append(f"  ! {risk}")
            lines.append("")

        lines.append(f"{Fore.GREEN}【追溯链】")
        lines.append("")

        level_prefix = {
            "environment": f"{Fore.BLUE}●",
            "artifact": f"{Fore.MAGENTA}○",
            "build": f"{Fore.CYAN}⊗",
            "commit": f"{Fore.YELLOW}⊕",
            "config": f"{Fore.GREEN}⊛",
            "approval": f"{Fore.RED}⊚"
        }

        for item in result.trace_chain:
            prefix = level_prefix.get(item["level"], "○")
            lines.append(f"  {prefix} {item['level'].upper()}: {item['name']}")

            details = item.get("details", {})
            for key, value in details.items():
                if value is not None:
                    if isinstance(value, dict):
                        import json
                        value_str = json.dumps(value, ensure_ascii=False, indent=4)
                        lines.append(f"      {key}:")
                        for line in value_str.split('\n'):
                            lines.append(f"        {line}")
                    elif isinstance(value, list):
                        lines.append(f"      {key}: {', '.join(str(v) for v in value)}")
                    else:
                        lines.append(f"      {key}: {value}")
            lines.append("")

        return "\n".join(lines)

    def format_compare(self, result: CompareResult, output_format: str = "text") -> str:
        if output_format == "json":
            return self._format_compare_json(result)
        return self._format_compare_text(result)

    def _format_compare_json(self, result: CompareResult) -> str:
        import json
        data = {
            "artifacts_count": len(result.artifacts),
            "common_attributes": result.common_attributes,
            "differences": result.differences
        }
        return json.dumps(data, indent=2, ensure_ascii=False)

    def _format_compare_text(self, result: CompareResult) -> str:
        lines = []

        lines.append(f"{Fore.CYAN}={'*' * 60}=")
        lines.append(f"{Fore.CYAN}  制品对比报告")
        lines.append(f"{Fore.CYAN}={'*' * 60}=")
        lines.append("")

        lines.append(f"{Fore.YELLOW}【参与对比的制品】")
        for i, artifact in enumerate(result.artifacts, 1):
            lines.append(f"  [{i}] {artifact.name}:{artifact.version} ({artifact.environment})")
            lines.append(f"      ID: {artifact.artifact_id}")
        lines.append("")

        if result.common_attributes:
            lines.append(f"{Fore.GREEN}【共同属性】")
            for key, value in result.common_attributes.items():
                lines.append(f"  ✓ {key}: {value}")
            lines.append("")

        if result.differences:
            lines.append(f"{Fore.RED}【差异项】")
            for field, diffs in result.differences.items():
                lines.append(f"")
                lines.append(f"  ✗ {field}:")
                for diff in diffs:
                    artifact = next(
                        (a for a in result.artifacts if a.artifact_id == diff["artifact_id"]),
                        None
                    )
                    name = f"{artifact.name}:{artifact.version}" if artifact else diff["artifact_id"]
                    lines.append(f"      {name}: {diff['value']}")
            lines.append("")

        return "\n".join(lines)

    def format_verify(self, result: VerifyResult, output_format: str = "text") -> str:
        if output_format == "json":
            return self._format_verify_json(result)
        return self._format_verify_text(result)

    def _format_verify_json(self, result: VerifyResult) -> str:
        import json
        data = {
            "artifact": {
                "artifact_id": result.artifact.artifact_id,
                "name": result.artifact.name,
                "version": result.artifact.version,
                "environment": result.artifact.environment,
            },
            "is_valid": result.is_valid,
            "errors": result.errors,
            "warnings": result.warnings,
            "missing_fields": result.missing_fields
        }
        return json.dumps(data, indent=2, ensure_ascii=False)

    def _format_verify_text(self, result: VerifyResult) -> str:
        lines = []

        lines.append(f"{Fore.CYAN}={'*' * 60}=")
        lines.append(f"{Fore.CYAN}  制品完整性验证报告")
        lines.append(f"{Fore.CYAN}={'*' * 60}=")
        lines.append("")

        lines.append(f"{Fore.YELLOW}【制品信息】")
        lines.append(f"  名称: {result.artifact.name}:{result.artifact.version}")
        lines.append(f"  环境: {result.artifact.environment}")
        lines.append(f"  ID: {result.artifact.artifact_id}")
        lines.append("")

        if result.is_valid:
            lines.append(f"{Fore.GREEN}【验证结果】{Fore.WHITE} 通过 ✓")
        else:
            lines.append(f"{Fore.RED}【验证结果】{Fore.WHITE} 未通过 ✗")
        lines.append("")

        if result.missing_fields:
            lines.append(f"{Fore.RED}【缺失字段】")
            for field in result.missing_fields:
                lines.append(f"  ✗ {field}")
            lines.append("")

        if result.errors:
            lines.append(f"{Fore.RED}【错误】")
            for error in result.errors:
                lines.append(f"  ✗ {error}")
            lines.append("")

        if result.warnings:
            lines.append(f"{Fore.YELLOW}【警告】")
            for warning in result.warnings:
                lines.append(f"  ! {warning}")
            lines.append("")

        if result.is_valid and not result.warnings:
            lines.append(f"{Fore.GREEN}制品元数据完整，无问题。")
            lines.append("")

        return "\n".join(lines)

    def format_report(self, report: Dict[str, Any], output_format: str = "text") -> str:
        if output_format == "json":
            return self._format_report_json(report)
        return self._format_report_text(report)

    def _format_report_json(self, report: Dict[str, Any]) -> str:
        import json
        data = {
            "generated_at": report["generated_at"],
            "statistics": report["statistics"],
            "items": [
                {
                    "artifact": {
                        "artifact_id": item.artifact.artifact_id,
                        "name": item.artifact.name,
                        "version": item.artifact.version,
                        "environment": item.artifact.environment,
                        "deploy_time": item.artifact.deploy_time.isoformat(),
                        "status": item.artifact.status.value,
                    },
                    "issues": item.issues,
                    "severity": item.severity
                }
                for item in report["items"]
            ]
        }
        return json.dumps(data, indent=2, ensure_ascii=False)

    def _format_report_text(self, report: Dict[str, Any]) -> str:
        lines = []

        lines.append(f"{Fore.CYAN}={'*' * 60}=")
        lines.append(f"{Fore.CYAN}  部署制品追溯汇总报告")
        lines.append(f"{Fore.CYAN}  生成时间: {report['generated_at']}")
        lines.append(f"{Fore.CYAN}={'*' * 60}=")
        lines.append("")

        stats = report["statistics"]
        lines.append(f"{Fore.YELLOW}【统计信息】")
        lines.append(f"  总制品数: {stats['total']}")
        lines.append(f"  正常制品: {stats['normal']}")
        if stats['missing_approval'] > 0:
            lines.append(f"  {Fore.RED}缺少审批: {stats['missing_approval']}")
        if stats['config_mismatch'] > 0:
            lines.append(f"  {Fore.RED}配置不匹配: {stats['config_mismatch']}")
        if stats['rollback'] > 0:
            lines.append(f"  {Fore.YELLOW}回滚版本: {stats['rollback']}")
        if stats['missing_build'] > 0:
            lines.append(f"  {Fore.RED}缺少构建信息: {stats['missing_build']}")
        if stats['duplicate_build'] > 0:
            lines.append(f"  {Fore.YELLOW}重复构建: {stats['duplicate_build']}")
        lines.append("")

        items = report["items"]
        high_severity = [i for i in items if i.severity == "high"]
        medium_severity = [i for i in items if i.severity == "medium"]
        low_severity = [i for i in items if i.severity == "low"]

        if high_severity:
            lines.append(f"{Fore.RED}【高风险问题】")
            for item in high_severity:
                a = item.artifact
                lines.append(f"  ✗ {a.name}:{a.version} ({a.environment})")
                for issue in item.issues:
                    lines.append(f"      - {issue}")
            lines.append("")

        if medium_severity:
            lines.append(f"{Fore.YELLOW}【中风险问题】")
            for item in medium_severity:
                a = item.artifact
                lines.append(f"  ! {a.name}:{a.version} ({a.environment})")
                for issue in item.issues:
                    lines.append(f"      - {issue}")
            lines.append("")

        if low_severity:
            lines.append(f"{Fore.GREEN}【正常制品】")
            table_data = []
            for item in low_severity:
                a = item.artifact
                table_data.append([
                    a.name,
                    a.version,
                    a.environment,
                    a.deploy_time.strftime("%Y-%m-%d %H:%M"),
                    ", ".join(item.issues)
                ])
            lines.append(tabulate(
                table_data,
                headers=["名称", "版本", "环境", "部署时间", "状态"],
                tablefmt="simple"
            ))
            lines.append("")

        issues_count = stats['missing_approval'] + stats['config_mismatch'] + stats['rollback'] + stats['missing_build'] + stats['duplicate_build']
        if issues_count > 0:
            lines.append(f"{Fore.RED}⚠ 共发现 {issues_count} 个需要关注的问题，建议在故障复盘中重点审查。")
        else:
            lines.append(f"{Fore.GREEN}✓ 所有制品状态正常，无风险项。")

        return "\n".join(lines)
