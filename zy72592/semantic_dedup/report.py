from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich import box
import json
from typing import Optional

from .models import PlaybackReport, SampleStatus, NextAction, AuditLog, TrialRun


STATUS_STYLES = {
    SampleStatus.NORMAL: "green",
    SampleStatus.MINORITY_MASKED: "bold red",
    SampleStatus.NEED_ALGO_REVIEW: "yellow",
    SampleStatus.NEED_OP_REVIEW: "blue",
    SampleStatus.CONFIRMED: "cyan",
}

STATUS_LABELS = {
    SampleStatus.NORMAL: "正常",
    SampleStatus.MINORITY_MASKED: "⚠️ 少数类被总指标盖住",
    SampleStatus.NEED_ALGO_REVIEW: "🔍 待算法工程师复核",
    SampleStatus.NEED_OP_REVIEW: "📋 待评测运营确认",
    SampleStatus.CONFIRMED: "✅ 已确认",
}

NEXT_ACTION_ICONS = {
    NextAction.ALGO_ENGINEER: "👨‍💻 算法工程师",
    NextAction.OPERATIONS: "👩‍💼 评测运营小孟",
    NextAction.NONE: "✅ 无需处理",
}


def print_playback_report(report: PlaybackReport, console: Optional[Console] = None):
    if console is None:
        console = Console()
    
    console.print()
    console.print(Panel.fit(
        f"[bold cyan]🎯 语义去重阈值试算回放报告[/bold cyan]\n"
        f"[dim]运行ID: {report.run_id}[/dim]",
        border_style="cyan",
    ))
    console.print()
    
    console.print("[bold]📊 总体概览[/bold]")
    summary_table = Table(box=box.SIMPLE, show_header=True)
    summary_table.add_column("指标", style="cyan")
    summary_table.add_column("数值", justify="right", style="bold")
    summary_table.add_column("占比", justify="right")
    
    summary_table.add_row("总样本数", str(report.total_samples), "-")
    summary_table.add_row("通过阈值", str(report.passed_count), f"{report.passed_count/report.total_samples:.1%}")
    summary_table.add_row("被过滤", str(report.removed_count), f"{report.removed_count/report.total_samples:.1%}")
    if report.minority_masked_count > 0:
        summary_table.add_row(
            "[bold red]⚠️ 少数类被总指标盖住",
            f"[bold red]{report.minority_masked_count}[/bold red]",
            f"[bold red]{report.minority_masked_count/report.total_samples:.1%}[/bold red]"
        )
    
    console.print(summary_table)
    console.print()
    
    console.print(f"[bold]📝 摘要:[/bold] {report.summary}")
    console.print()
    
    console.print("[bold]📌 下一步行动[/bold]")
    for i, step in enumerate(report.next_steps, 1):
        console.print(f"  {i}. {step}")
    console.print()
    
    console.print("[bold]⚙️ 当前参数配置[/bold]")
    params_table = Table(box=box.SIMPLE, show_header=True)
    params_table.add_column("参数名", style="cyan")
    params_table.add_column("当前值")
    params_table.add_row("去重阈值", f"{report.params.dedup_threshold:.3f}")
    params_table.add_row("少数类加权系数", f"{report.params.minority_weight}")
    params_table.add_row("总指标权重", f"{report.params.overall_metric_weight}")
    params_table.add_row("少数类增强", "启用" if report.params.minority_boost_enabled else "禁用")
    params_table.add_row("最小少数类占比", f"{report.params.min_minority_ratio:.1%}")
    console.print(params_table)
    console.print()
    
    console.print("[bold]🔍 样本详情[/bold]")
    console.print()
    
    for item in report.items:
        status_style = STATUS_STYLES.get(item.status, "white")
        status_label = STATUS_LABELS.get(item.status, item.status)
        next_action_label = NEXT_ACTION_ICONS.get(item.next_action, item.next_action)
        
        title_parts = [
            f"[bold]样本 {item.sample_id}[/bold]",
            f"[{status_style}]{status_label}[/{status_style}]",
        ]
        if item.is_minority:
            title_parts.append("[magenta]少数类[/magenta]")
        
        panel_title = " | ".join(title_parts)
        
        content_lines = []
        content_lines.append(f"[dim]类别:[/dim] {item.category}")
        content_lines.append(f"[dim]内容:[/dim] {item.content[:80]}{'...' if len(item.content) > 80 else ''}")
        content_lines.append("")
        
        score_color = "green" if item.passed else "red"
        content_lines.append(
            f"得分: 原始 [bold]{item.original_score:.3f}[/bold] → "
            f"调整后 [{score_color}]{item.adjusted_score:.3f}[/{score_color}] "
            f"(阈值 {item.threshold:.3f})"
        )
        content_lines.append(f"结果: [{'green' if item.passed else 'red'}]{'✅ 通过' if item.passed else '❌ 被过滤'}[/{'green' if item.passed else 'red'}]")
        content_lines.append("")
        
        content_lines.append("[bold]💡 为什么是这个结果:[/bold]")
        content_lines.append(f"  {item.explanation}")
        
        if item.minority_note:
            content_lines.append("")
            content_lines.append(f"[bold orange3]{item.minority_note}[/bold orange3]")
        
        if item.missing_materials:
            content_lines.append("")
            content_lines.append("[bold]📋 还缺什么材料:[/bold]")
            for mat in item.missing_materials:
                content_lines.append(f"  • {mat}")
        
        content_lines.append("")
        content_lines.append(f"[bold]👤 下一步找谁:[/bold] {next_action_label}")
        
        panel_content = "\n".join(content_lines)
        console.print(Panel(panel_content, title=panel_title, border_style=status_style))
        console.print()


def print_audit_logs(audit_logs: list[AuditLog], console: Optional[Console] = None):
    if console is None:
        console = Console()
    
    console.print()
    console.print(Panel.fit(
        "[bold magenta]📜 审计日志 - 谁改了什么、为什么改[/bold magenta]",
        border_style="magenta",
    ))
    console.print()
    
    for i, log in enumerate(audit_logs, 1):
        console.print(f"[bold]--- 操作 #{i} ---[/bold]")
        console.print(f"  [cyan]时间:[/cyan] {log.timestamp.strftime('%Y-%m-%d %H:%M:%S')}")
        console.print(f"  [cyan]操作人:[/cyan] {log.operator}")
        console.print(f"  [cyan]操作类型:[/cyan] {log.action}")
        console.print(f"  [cyan]原因:[/cyan] {log.reason}")
        
        if log.field_changed:
            console.print(f"  [cyan]修改字段:[/cyan] {log.field_changed}")
            console.print(f"  [cyan]旧值:[/cyan] {log.old_value} → [green]新值:[/green] {log.new_value}")
        
        if log.affected_samples:
            console.print(f"  [cyan]影响样本数:[/cyan] {len(log.affected_samples)}")
            if len(log.affected_samples) <= 5:
                console.print(f"  [cyan]影响样本:[/cyan] {', '.join(log.affected_samples)}")
            else:
                console.print(f"  [cyan]影响样本:[/cyan] {', '.join(log.affected_samples[:5])} ... 等共 {len(log.affected_samples)} 条")
        
        console.print()


def export_report_to_json(report: PlaybackReport, file_path: str):
    with open(file_path, "w", encoding="utf-8") as f:
        json.dump(report.model_dump(mode="json"), f, ensure_ascii=False, indent=2)


def export_report_to_markdown(report: PlaybackReport, file_path: str):
    lines = []
    lines.append(f"# 语义去重阈值试算回放报告")
    lines.append("")
    lines.append(f"- **运行ID**: {report.run_id}")
    lines.append(f"- **生成时间**: {report.generated_at.strftime('%Y-%m-%d %H:%M:%S')}")
    lines.append("")
    
    lines.append("## 📊 总体概览")
    lines.append("")
    lines.append(f"| 指标 | 数值 | 占比 |")
    lines.append(f"|------|------|------|")
    lines.append(f"| 总样本数 | {report.total_samples} | - |")
    lines.append(f"| 通过阈值 | {report.passed_count} | {report.passed_count/report.total_samples:.1%} |")
    lines.append(f"| 被过滤 | {report.removed_count} | {report.removed_count/report.total_samples:.1%} |")
    if report.minority_masked_count > 0:
        lines.append(f"| ⚠️ 少数类被总指标盖住 | **{report.minority_masked_count}** | **{report.minority_masked_count/report.total_samples:.1%}** |")
    lines.append("")
    
    lines.append("## 📝 摘要")
    lines.append("")
    lines.append(report.summary)
    lines.append("")
    
    lines.append("## 📌 下一步行动")
    lines.append("")
    for i, step in enumerate(report.next_steps, 1):
        lines.append(f"{i}. {step}")
    lines.append("")
    
    lines.append("## ⚙️ 参数配置")
    lines.append("")
    lines.append(f"| 参数名 | 当前值 |")
    lines.append(f"|--------|--------|")
    lines.append(f"| 去重阈值 | {report.params.dedup_threshold:.3f} |")
    lines.append(f"| 少数类加权系数 | {report.params.minority_weight} |")
    lines.append(f"| 总指标权重 | {report.params.overall_metric_weight} |")
    lines.append(f"| 少数类增强 | {'启用' if report.params.minority_boost_enabled else '禁用'} |")
    lines.append(f"| 最小少数类占比 | {report.params.min_minority_ratio:.1%} |")
    lines.append("")
    
    lines.append("## 🔍 样本详情")
    lines.append("")
    
    for item in report.items:
        status_label = STATUS_LABELS.get(item.status, item.status)
        next_action_label = NEXT_ACTION_ICONS.get(item.next_action, item.next_action)
        
        lines.append(f"### 样本 {item.sample_id}")
        lines.append("")
        lines.append(f"- **状态**: {status_label}")
        lines.append(f"- **类别**: {item.category}")
        lines.append(f"- **是否少数类**: {'是' if item.is_minority else '否'}")
        lines.append(f"- **原始得分**: {item.original_score:.3f}")
        lines.append(f"- **调整后得分**: {item.adjusted_score:.3f}")
        lines.append(f"- **阈值**: {item.threshold:.3f}")
        lines.append(f"- **结果**: {'✅ 通过' if item.passed else '❌ 被过滤'}")
        lines.append("")
        lines.append("#### 💡 为什么是这个结果")
        lines.append("")
        lines.append(item.explanation)
        lines.append("")
        
        if item.minority_note:
            lines.append(f"> {item.minority_note}")
            lines.append("")
        
        if item.missing_materials:
            lines.append("#### 📋 还缺什么材料")
            lines.append("")
            for mat in item.missing_materials:
                lines.append(f"- {mat}")
            lines.append("")
        
        lines.append(f"#### 👤 下一步找谁")
        lines.append("")
        lines.append(next_action_label)
        lines.append("")
    
    with open(file_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
