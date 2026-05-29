from typing import List
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich import box

from ..core.models import AnalysisResult, AnomalyRecord, AnomalyType
from ..core.config import Config
from ..utils.security import mask_sensitive_data, MaskingContext


console = Console()


def _get_severity_color(severity: str) -> str:
    return {
        "high": "bold red",
        "medium": "bold yellow",
        "low": "bold blue",
    }.get(severity, "white")


def _get_anomaly_icon(anomaly_type: AnomalyType) -> str:
    return {
        AnomalyType.COST_SPIKE: "📈",
        AnomalyType.COST_DROP: "📉",
        AnomalyType.MISSING_TAG: "🏷️",
        AnomalyType.INVALID_TAG: "⚠️",
        AnomalyType.DUPLICATE_RI_CREDIT: "🔄",
        AnomalyType.CURRENCY_ERROR: "💱",
        AnomalyType.BUDGET_EXCEEDED: "💰",
        AnomalyType.MISSING_REQUIRED_FIELD: "❌",
    }.get(anomaly_type, "🔍")


def print_terminal_summary(
    result: AnalysisResult,
    config: Config,
    verbose: bool = False,
) -> None:
    summary = result.summary
    currency = summary.get("target_currency", "CNY")

    title = Text("多云账单异常检测报告", style="bold cyan", justify="center")
    console.print()
    console.print(Panel(title, border_style="cyan", expand=False))
    console.print()

    stats_table = Table(
        title="总体统计",
        show_header=True,
        header_style="bold magenta",
        box=box.ROUNDED,
    )
    stats_table.add_column("指标", style="bold")
    stats_table.add_column("数值", justify="right")
    stats_table.add_row("总记录数", str(summary.get("total_records", 0)))
    stats_table.add_row("归一化账单数", str(summary.get("total_normalized_bills", 0)))
    stats_table.add_row("异常总数", f"[bold red]{summary.get('total_anomalies', 0)}[/bold red]")
    stats_table.add_row("标签问题数", f"[bold yellow]{summary.get('total_tag_issues', 0)}[/bold yellow]")
    stats_table.add_row(
        "总费用(不含RI)",
        f"[bold green]{summary.get('total_normalized_cost', 0):,.2f} {currency}[/bold green]",
    )
    period_range = summary.get("period_range", [])
    if period_range:
        stats_table.add_row("账期范围", f"{period_range[0]} ~ {period_range[1]}")

    provider_breakdown = summary.get("provider_breakdown", {})
    if provider_breakdown:
        provider_str = ", ".join(f"{k}: {v}" for k, v in provider_breakdown.items())
        stats_table.add_row("云厂商分布", provider_str)

    console.print(stats_table)
    console.print()

    anomaly_breakdown = summary.get("anomaly_breakdown", {})
    by_type = anomaly_breakdown.get("by_type", {})
    by_severity = anomaly_breakdown.get("by_severity", {})

    if by_type or by_severity:
        anomaly_table = Table(
            title="异常类型分布",
            show_header=True,
            header_style="bold magenta",
            box=box.ROUNDED,
        )
        anomaly_table.add_column("异常类型", style="bold")
        anomaly_table.add_column("数量", justify="right")

        for atype, count in sorted(by_type.items()):
            icon = _get_anomaly_icon(AnomalyType(atype))
            anomaly_table.add_row(f"{icon} {atype}", str(count))

        console.print(anomaly_table)
        console.print()

        severity_table = Table(
            title="严重程度分布",
            show_header=True,
            header_style="bold magenta",
            box=box.ROUNDED,
        )
        severity_table.add_column("严重程度", style="bold")
        severity_table.add_column("数量", justify="right")

        for severity in ["high", "medium", "low"]:
            count = by_severity.get(severity, 0)
            color = _get_severity_color(severity)
            severity_name = {"high": "高", "medium": "中", "low": "低"}[severity]
            severity_table.add_row(
                f"[{color}]{severity_name}[/]",
                f"[{color}]{count}[/]",
            )

        console.print(severity_table)
        console.print()

    high_anomalies = [a for a in result.anomalies if a.severity == "high"]
    if high_anomalies:
        high_table = Table(
            title="🚨 高优先级异常",
            show_header=True,
            header_style="bold red",
            box=box.ROUNDED,
        )
        high_table.add_column("类型", style="bold")
        high_table.add_column("服务/项目")
        high_table.add_column("描述", overflow="fold")
        high_table.add_column("金额", justify="right")

        for a in high_anomalies[:10]:
            icon = _get_anomaly_icon(a.anomaly_type)
            cost_str = ""
            if a.current_cost is not None:
                cost_str = f"{a.current_cost:,.2f} {currency}"
            target = a.project or a.service or a.resource_id or "N/A"
            high_table.add_row(
                f"{icon} {a.anomaly_type.value}",
                str(target),
                a.message,
                cost_str,
            )

        if len(high_anomalies) > 10:
            high_table.add_row(
                "",
                f"... 还有 {len(high_anomalies) - 10} 条高优先级异常",
                "",
                "",
            )

        console.print(high_table)
        console.print()

    medium_anomalies = [a for a in result.anomalies if a.severity == "medium"]
    if medium_anomalies and verbose:
        medium_table = Table(
            title="⚠️  中优先级异常",
            show_header=True,
            header_style="bold yellow",
            box=box.ROUNDED,
        )
        medium_table.add_column("类型", style="bold")
        medium_table.add_column("服务/项目")
        medium_table.add_column("描述", overflow="fold")

        for a in medium_anomalies[:15]:
            icon = _get_anomaly_icon(a.anomaly_type)
            target = a.project or a.service or a.resource_id or "N/A"
            medium_table.add_row(
                f"{icon} {a.anomaly_type.value}",
                str(target),
                a.message,
            )

        if len(medium_anomalies) > 15:
            medium_table.add_row(
                "",
                f"... 还有 {len(medium_anomalies) - 15} 条中优先级异常",
                "",
            )

        console.print(medium_table)
        console.print()

    if result.duplicate_ri_credits:
        ri_panel = Panel(
            f"[bold red]检测到 {len(result.duplicate_ri_credits)} 条疑似重复的预留实例抵扣记录[/bold red]\n"
            f"请人工核对这些记录，避免重复抵扣导致成本计算错误",
            title="🔄 预留实例重复抵扣警告",
            border_style="red",
        )
        console.print(ri_panel)
        console.print()

    if result.currency_errors:
        curr_panel = Panel(
            f"[bold yellow]检测到 {len(result.currency_errors)} 条货币相关错误[/bold yellow]\n"
            f"请检查汇率配置和账单币种字段",
            title="💱 货币错误警告",
            border_style="yellow",
        )
        console.print(curr_panel)
        console.print()

    if result.budget_comparison:
        budget_table = Table(
            title="💰 预算执行情况",
            show_header=True,
            header_style="bold magenta",
            box=box.ROUNDED,
        )
        budget_table.add_column("项目", style="bold")
        budget_table.add_column("预算", justify="right")
        budget_table.add_column("实际", justify="right")
        budget_table.add_column("使用率", justify="right")
        budget_table.add_column("状态")

        for project, data in sorted(result.budget_comparison.items()):
            status = data.get("status", "normal")
            status_style = {
                "exceeded": "bold red",
                "warning": "bold yellow",
                "normal": "bold green",
                "no_budget": "dim",
            }.get(status, "white")
            status_text = {
                "exceeded": "🚨 超支",
                "warning": "⚠️  预警",
                "normal": "✅ 正常",
                "no_budget": "❓ 无预算",
            }.get(status, status)

            budget_table.add_row(
                project,
                f"{data.get('budget', 0):,.2f} {currency}",
                f"{data.get('actual', 0):,.2f} {currency}",
                f"{data.get('usage_percent', 0):.1f}%",
                f"[{status_style}]{status_text}[/{status_style}]",
            )

        console.print(budget_table)
        console.print()

    if result.tag_issues_count:
        tag_table = Table(
            title="🏷️  标签问题明细",
            show_header=True,
            header_style="bold magenta",
            box=box.ROUNDED,
        )
        tag_table.add_column("标签字段", style="bold")
        tag_table.add_column("问题类型")
        tag_table.add_column("数量", justify="right")

        for key, count in sorted(result.tag_issues_count.items()):
            field_name, issue_type = key.split(":", 1)
            tag_table.add_row(field_name, issue_type, str(count))

        console.print(tag_table)
        console.print()

    footer = Text(
        f"共 {len(result.anomalies)} 条异常  "
        f"| 高: {by_severity.get('high', 0)} "
        f"| 中: {by_severity.get('medium', 0)} "
        f"| 低: {by_severity.get('low', 0)}",
        style="bold",
        justify="center",
    )
    console.print(Panel(footer, border_style="cyan", expand=False))
    console.print()
