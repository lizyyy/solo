import json
from datetime import datetime
from typing import Any, Dict, List, Optional
from dataclasses import dataclass, asdict
from pathlib import Path
from collections import defaultdict
from ..utils.logger import get_logger
from .mutator import MutatedExample, MutationType
from .validator import ValidationResult, ValidationResultType

logger = get_logger(__name__)


@dataclass
class CoverageStats:
    total_mutations: int = 0
    passed_validations: int = 0
    failed_validations: int = 0
    false_positives: int = 0
    mutation_type_coverage: Dict[str, int] = None
    field_coverage: Dict[str, int] = None
    error_type_distribution: Dict[str, int] = None

    def __post_init__(self):
        if self.mutation_type_coverage is None:
            self.mutation_type_coverage = defaultdict(int)
        if self.field_coverage is None:
            self.field_coverage = defaultdict(int)
        if self.error_type_distribution is None:
            self.error_type_distribution = defaultdict(int)


@dataclass
class FuzzReport:
    schema_name: str
    timestamp: str
    original_example: Any
    coverage_stats: CoverageStats
    detailed_results: List[Dict[str, Any]]
    summary: Dict[str, Any]


class CoverageAnalyzer:
    def __init__(self):
        self.stats = CoverageStats()

    def analyze(self, results: List[ValidationResult]) -> CoverageStats:
        self.stats.total_mutations = len(results)

        for result in results:
            mutation_type = result.mutated_example.mutation_type.value
            self.stats.mutation_type_coverage[mutation_type] += 1

            path = result.mutated_example.path or "root"
            self.stats.field_coverage[path] += 1

            if result.result_type == ValidationResultType.PASS:
                self.stats.passed_validations += 1
            else:
                self.stats.failed_validations += 1
                for error in result.errors:
                    self.stats.error_type_distribution[error.error_type] += 1

            if result.is_false_positive:
                self.stats.false_positives += 1

        return self.stats


class ReportGenerator:
    def __init__(self, schema_name: str):
        self.schema_name = schema_name
        self.analyzer = CoverageAnalyzer()

    def generate_report(
        self,
        original_example: Any,
        results: List[ValidationResult],
        output_format: str = "json",
    ) -> FuzzReport:
        coverage_stats = self.analyzer.analyze(results)
        detailed_results = self._format_detailed_results(results)
        summary = self._generate_summary(coverage_stats, results)

        report = FuzzReport(
            schema_name=self.schema_name,
            timestamp=datetime.now().isoformat(),
            original_example=original_example,
            coverage_stats=coverage_stats,
            detailed_results=detailed_results,
            summary=summary,
        )

        return report

    def _format_detailed_results(
        self, results: List[ValidationResult]
    ) -> List[Dict[str, Any]]:
        formatted = []
        for result in results:
            result_dict = {
                "mutation_type": result.mutated_example.mutation_type.value,
                "path": result.mutated_example.path,
                "description": result.mutated_example.description,
                "result": result.result_type.value,
                "attribution": result.attribution,
                "is_false_positive": result.is_false_positive,
                "mutated_value": self._simplify_value(result.mutated_example.mutated),
                "errors": [
                    {
                        "error_type": e.error_type,
                        "message": e.message,
                        "path": e.path,
                    }
                    for e in result.errors
                ],
            }
            formatted.append(result_dict)
        return formatted

    def _simplify_value(self, value: Any, max_length: int = 100) -> Any:
        if isinstance(value, (dict, list)):
            try:
                json_str = json.dumps(value, ensure_ascii=False)
                if len(json_str) > max_length:
                    return f"<truncated, type={type(value).__name__}>"
            except Exception:
                pass
        return value

    def _generate_summary(
        self, stats: CoverageStats, results: List[ValidationResult]
    ) -> Dict[str, Any]:
        pass_rate = (
            (stats.passed_validations / stats.total_mutations * 100)
            if stats.total_mutations > 0
            else 0
        )

        top_errors = sorted(
            stats.error_type_distribution.items(), key=lambda x: x[1], reverse=True
        )[:5]

        top_fields = sorted(
            stats.field_coverage.items(), key=lambda x: x[1], reverse=True
        )[:10]

        false_positive_rate = (
            (stats.false_positives / stats.total_mutations * 100)
            if stats.total_mutations > 0
            else 0
        )

        return {
            "total_mutations": stats.total_mutations,
            "passed": stats.passed_validations,
            "failed": stats.failed_validations,
            "pass_rate": round(pass_rate, 2),
            "false_positives": stats.false_positives,
            "false_positive_rate": round(false_positive_rate, 2),
            "top_error_types": dict(top_errors),
            "top_covered_fields": dict(top_fields),
            "mutation_types_used": len(stats.mutation_type_coverage),
        }

    def save_report(
        self, report: FuzzReport, output_path: str, format: str = "json"
    ) -> None:
        path = Path(output_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        if format == "json":
            with open(path, "w", encoding="utf-8") as f:
                report.coverage_stats.mutation_type_coverage = dict(
                    report.coverage_stats.mutation_type_coverage
                )
                report.coverage_stats.field_coverage = dict(
                    report.coverage_stats.field_coverage
                )
                report.coverage_stats.error_type_distribution = dict(
                    report.coverage_stats.error_type_distribution
                )
                report_dict = asdict(report)
                json.dump(report_dict, f, ensure_ascii=False, indent=2)
        elif format == "html":
            self._save_html_report(report, path)
        elif format == "markdown":
            self._save_markdown_report(report, path)
        else:
            raise ValueError(f"Unsupported format: {format}")

        logger.info(f"报告已保存到: {output_path}")

    def _save_html_report(self, report: FuzzReport, path: Path) -> None:
        html_content = self._generate_html_content(report)
        with open(path, "w", encoding="utf-8") as f:
            f.write(html_content)

    def _generate_html_content(self, report: FuzzReport) -> str:
        summary = report.summary
        stats = report.coverage_stats

        html = f"""<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <title>OpenAPI 扰动兼容校验报告 - {report.schema_name}</title>
    <style>
        body {{ font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 20px; }}
        h1, h2, h3 {{ color: #333; }}
        .summary {{ background: #f5f5f5; padding: 20px; border-radius: 8px; margin-bottom: 20px; }}
        .stat-box {{ display: inline-block; margin: 10px; padding: 15px; background: white; border-radius: 4px; min-width: 120px; text-align: center; }}
        .stat-value {{ font-size: 24px; font-weight: bold; color: #2196F3; }}
        .stat-label {{ font-size: 12px; color: #666; margin-top: 5px; }}
        .pass {{ color: #4CAF50; }}
        .fail {{ color: #F44336; }}
        .warning {{ color: #FF9800; }}
        table {{ width: 100%; border-collapse: collapse; margin: 20px 0; }}
        th, td {{ padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }}
        th {{ background: #f5f5f5; font-weight: bold; }}
        tr:hover {{ background: #f9f9f9; }}
        .error-details {{ background: #FFF3E0; padding: 10px; border-radius: 4px; margin-top: 5px; }}
    </style>
</head>
<body>
    <h1>OpenAPI 扰动兼容校验报告</h1>
    <p><strong>Schema:</strong> {report.schema_name}</p>
    <p><strong>时间:</strong> {report.timestamp}</p>

    <div class="summary">
        <h2>概览统计</h2>
        <div class="stat-box">
            <div class="stat-value">{summary['total_mutations']}</div>
            <div class="stat-label">总扰动数</div>
        </div>
        <div class="stat-box">
            <div class="stat-value pass">{summary['passed']}</div>
            <div class="stat-label">通过验证</div>
        </div>
        <div class="stat-box">
            <div class="stat-value fail">{summary['failed']}</div>
            <div class="stat-label">验证失败</div>
        </div>
        <div class="stat-box">
            <div class="stat-value">{summary['pass_rate']}%</div>
            <div class="stat-label">通过率</div>
        </div>
        <div class="stat-box">
            <div class="stat-value warning">{summary['false_positives']}</div>
            <div class="stat-label">假阳性</div>
        </div>
    </div>

    <h2>错误类型分布</h2>
    <table>
        <tr><th>错误类型</th><th>数量</th></tr>
"""

        for error_type, count in stats.error_type_distribution.items():
            html += f"        <tr><td>{error_type}</td><td>{count}</td></tr>\n"

        html += """
    </table>

    <h2>详细结果</h2>
    <table>
        <tr><th>扰动类型</th><th>路径</th><th>结果</th><th>归因</th></tr>
"""

        for result in report.detailed_results:
            result_class = (
                "pass" if result["result"] == "pass" else "fail"
            )
            html += f"""        <tr>
            <td>{result['mutation_type']}</td>
            <td>{result['path'] or 'root'}</td>
            <td class="{result_class}">{result['result']}</td>
            <td>{result['attribution']}</td>
        </tr>
"""

        html += """
    </table>
</body>
</html>
"""
        return html

    def _save_markdown_report(self, report: FuzzReport, path: Path) -> None:
        summary = report.summary
        stats = report.coverage_stats

        md = f"""# OpenAPI 扰动兼容校验报告

**Schema:** {report.schema_name}  
**时间:** {report.timestamp}

## 概览统计

| 指标 | 值 |
|------|-----|
| 总扰动数 | {summary['total_mutations']} |
| 通过验证 | {summary['passed']} |
| 验证失败 | {summary['failed']} |
| 通过率 | {summary['pass_rate']}% |
| 假阳性 | {summary['false_positives']} |

## 错误类型分布

| 错误类型 | 数量 |
|----------|------|
"""

        for error_type, count in stats.error_type_distribution.items():
            md += f"| {error_type} | {count} |\n"

        md += """
## 详细结果

| 扰动类型 | 路径 | 结果 | 归因 |
|----------|------|------|------|
"""

        for result in report.detailed_results:
            md += f"| {result['mutation_type']} | {result['path'] or 'root'} | {result['result']} | {result['attribution']} |\n"

        with open(path, "w", encoding="utf-8") as f:
            f.write(md)

    def print_console_summary(self, report: FuzzReport) -> None:
        from rich.console import Console
        from rich.table import Table
        from rich.panel import Panel

        console = Console()
        summary = report.summary

        console.print(
            Panel.fit(
                f"[bold blue]OpenAPI 扰动兼容校验报告[/bold blue]\n"
                f"Schema: {report.schema_name}\n"
                f"时间: {report.timestamp}",
                title="报告概览",
            )
        )

        table = Table(title="统计概览")
        table.add_column("指标", style="cyan")
        table.add_column("值", style="magenta")
        table.add_row("总扰动数", str(summary["total_mutations"]))
        table.add_row("通过验证", str(summary["passed"]), style="green")
        table.add_row("验证失败", str(summary["failed"]), style="red")
        table.add_row("通过率", f"{summary['pass_rate']}%")
        table.add_row("假阳性", str(summary["false_positives"]), style="yellow")
        console.print(table)

        if report.coverage_stats.error_type_distribution:
            error_table = Table(title="错误类型分布")
            error_table.add_column("错误类型", style="cyan")
            error_table.add_column("数量", style="magenta")
            sorted_items = sorted(
                report.coverage_stats.error_type_distribution.items(),
                key=lambda item: item[1],
                reverse=True,
            )
            for error_type, count in sorted_items:
                error_table.add_row(error_type, str(count))
            console.print(error_table)

        failed_results = [
            r for r in report.detailed_results if r["result"] == "fail"
        ]
        if failed_results:
            fail_table = Table(title="验证失败详情 (前10条)")
            fail_table.add_column("扰动类型", style="cyan")
            fail_table.add_column("路径", style="blue")
            fail_table.add_column("归因", style="yellow")
            for result in failed_results[:10]:
                fail_table.add_row(
                    result["mutation_type"],
                    result["path"] or "root",
                    result["attribution"][:60] + "..."
                    if len(result["attribution"]) > 60
                    else result["attribution"],
                )
            console.print(fail_table)
