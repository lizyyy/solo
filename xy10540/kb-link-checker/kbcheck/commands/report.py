import os
import json
import click
from datetime import datetime
from pathlib import Path
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text

from kbcheck.utils import Storage
from kbcheck.checkers import OwnerChecker

console = Console()


@click.command()
@click.option("--path", default=".", help="知识库项目路径")
@click.option("--format", type=click.Choice(['text', 'json', 'markdown']), default='text', help="报告格式")
@click.option("--output", help="输出文件路径")
@click.option("--by-owner", is_flag=True, help="按负责人分组生成修复清单")
@click.option("--risks", is_flag=True, help="展示整体迁移风险")
@click.option("--ignore-list", is_flag=True, help="展示忽略原因列表")
def report(path: str, format: str, output: str, by_owner: bool, risks: bool, ignore_list: bool):
    """生成完整报告：修复清单、迁移风险、忽略原因"""
    storage = Storage(os.path.abspath(path))

    if not storage.exists():
        console.print("[red]工作区未初始化[/red]")
        return

    docs = storage.get_documents()
    links = storage.get_links()
    results = storage.get_check_results()
    owners = storage.get_owners()
    duplicates = storage.get_duplicates()
    corrections = storage.get_corrections()

    report_data = _build_report_data(storage, docs, links, results, owners, duplicates, corrections)

    if by_owner:
        _render_owner_repair_list(report_data, owners, format, output)
        return

    if risks:
        _render_risk_report(report_data, format, output)
        return

    if ignore_list:
        _render_ignore_list(corrections, format, output)
        return

    _render_full_report(report_data, format, output)


def _build_report_data(storage, docs, links, results, owners, duplicates, corrections):
    owner_checker = OwnerChecker()

    passed = sum(1 for r in results if r.status == "passed")
    failed = sum(1 for r in results if r.status == "failed")
    warnings = sum(1 for r in results if r.status == "warning")

    error_types = {}
    for r in results:
        if r.error_type:
            error_types[r.error_type] = error_types.get(r.error_type, 0) + 1

    owner_analysis = owner_checker.analyze_owner_risks(docs, owners, results)
    repair_lists = owner_checker.get_repair_list_by_owner(docs, owners, results)

    ignored = [c for c in corrections if c.action == "ignore"]
    resolved = [c for c in corrections if c.action == "fix"]

    owner_analysis_json = {
        "active_owners": list(owner_analysis["active_owners"].keys()),
        "inactive_owners": list(owner_analysis["inactive_owners"].keys()),
        "unassigned_docs": [d.to_dict() for d in owner_analysis["unassigned_docs"]],
        "owner_error_counts": owner_analysis["owner_error_counts"],
    }

    duplicates_json = [d.to_dict() for d in duplicates]

    return {
        "generated_at": datetime.now().isoformat(),
        "summary": {
            "total_documents": len(docs),
            "total_links": len(links),
            "total_checks": len(results),
            "passed": passed,
            "failed": failed,
            "warnings": warnings,
            "duplicate_groups": len(duplicates),
            "error_types": error_types,
        },
        "owners": {
            "total": len(owners),
            "active": len(owner_analysis["active_owners"]),
            "inactive": len(owner_analysis["inactive_owners"]),
            "unassigned_docs": len(owner_analysis["unassigned_docs"]),
            "error_counts": owner_analysis["owner_error_counts"],
        },
        "repair_lists": repair_lists,
        "owner_analysis": owner_analysis_json,
        "duplicates": duplicates_json,
        "corrections": {
            "total": len(corrections),
            "ignored": len(ignored),
            "resolved": len(resolved),
        },
        "risk_level": _calculate_risk_level(failed, warnings, len(duplicates), len(owner_analysis["inactive_owners"])),
    }


def _calculate_risk_level(failed, warnings, duplicate_groups, inactive_owners):
    score = 0
    score += min(failed * 10, 40)
    score += min(warnings * 3, 30)
    score += min(duplicate_groups * 5, 15)
    score += min(inactive_owners * 8, 15)

    if score >= 70:
        return {"level": "high", "score": score, "description": "高风险，需要立即处理"}
    elif score >= 40:
        return {"level": "medium", "score": score, "description": "中风险，需要制定修复计划"}
    else:
        return {"level": "low", "score": score, "description": "低风险，可以定期检查"}


def _render_full_report(data, format, output):
    if format == "json":
        content = json.dumps(data, ensure_ascii=False, indent=2)
        if output:
            Path(output).write_text(content, encoding='utf-8')
            console.print(f"[green]报告已写入: {output}[/green]")
        else:
            console.print(content)
        return

    if format == "markdown":
        content = _markdown_report(data)
        if output:
            Path(output).write_text(content, encoding='utf-8')
            console.print(f"[green]报告已写入: {output}[/green]")
        else:
            console.print(content)
        return

    _text_report(data)


def _text_report(data):
    console.print()

    risk_colors = {"high": "red", "medium": "yellow", "low": "green"}
    risk_color = risk_colors[data["risk_level"]["level"]]

    console.print(Panel(
        f"[bold]知识库迁移链接检查报告[/bold]\n\n"
        f"生成时间: {data['generated_at']}\n"
        f"整体风险等级: [{risk_color}]{data['risk_level']['level'].upper()}[/{risk_color}] (分数: {data['risk_level']['score']})\n"
        f"风险说明: {data['risk_level']['description']}",
        title="报告概览",
    ))

    console.print()
    table = Table(title="检查汇总", show_header=True)
    table.add_column("项目", style="cyan")
    table.add_column("数值", justify="right")
    table.add_column("说明")

    table.add_row("文档总数", str(data["summary"]["total_documents"]), "导入的文档数量")
    table.add_row("链接总数", str(data["summary"]["total_links"]), "提取的链接数量")
    table.add_row("[green]通过[/green]", str(data["summary"]["passed"]), "验证通过的链接")
    table.add_row("[red]失败[/red]", str(data["summary"]["failed"]), "需要紧急修复")
    table.add_row("[yellow]警告[/yellow]", str(data["summary"]["warnings"]), "需要关注")
    table.add_row("重复页面", str(data["summary"]["duplicate_groups"]), "需要合并处理")

    console.print(table)

    if data["summary"]["error_types"]:
        console.print()
        et_table = Table(title="错误类型分布", show_header=True)
        et_table.add_column("错误类型", style="cyan")
        et_table.add_column("数量", justify="right")
        et_table.add_column("说明")

        type_descriptions = {
            "404": "页面不存在或已删除",
            "redirect": "需要重定向到新地址",
            "permission": "权限受限，仅部分角色可见",
            "owner_inactive": "目标页面负责人已离职",
            "duplicate_reference": "同一链接多处引用",
            "attachment_missing": "附件引用可能失效",
        }

        for err_type, count in sorted(data["summary"]["error_types"].items(), key=lambda x: -x[1]):
            et_table.add_row(err_type, str(count), type_descriptions.get(err_type, ""))

        console.print(et_table)

    console.print()
    owner_table = Table(title="负责人情况", show_header=True)
    owner_table.add_column("项目", style="cyan")
    owner_table.add_column("数值", justify="right")

    owner_table.add_row("负责人总数", str(data["owners"]["total"]))
    owner_table.add_row("[green]在职[/green]", str(data["owners"]["active"]))
    owner_table.add_row("[red]离职[/red]", str(data["owners"]["inactive"]))
    owner_table.add_row("[yellow]未分配文档[/yellow]", str(data["owners"]["unassigned_docs"]))

    console.print(owner_table)

    console.print()
    console.print(Panel(
        "[cyan]下一步操作建议:[/cyan]\n\n"
        "1. 运行 [green]kbcheck report --by-owner[/green] 查看各负责人的修复清单\n"
        "2. 运行 [green]kbcheck report --risks[/green] 详细评估迁移风险\n"
        "3. 运行 [green]kbcheck detail[/green] 查看具体问题详情",
        title="操作建议",
    ))


def _markdown_report(data) -> str:
    lines = []
    lines.append("# 知识库迁移链接检查报告")
    lines.append("")
    lines.append(f"- 生成时间: {data['generated_at']}")
    lines.append(f"- 风险等级: **{data['risk_level']['level'].upper()}** (分数: {data['risk_level']['score']})")
    lines.append(f"- 风险说明: {data['risk_level']['description']}")
    lines.append("")

    lines.append("## 检查汇总")
    lines.append("")
    lines.append("| 项目 | 数值 | 说明 |")
    lines.append("|------|------|------|")
    lines.append(f"| 文档总数 | {data['summary']['total_documents']} | 导入的文档数量 |")
    lines.append(f"| 链接总数 | {data['summary']['total_links']} | 提取的链接数量 |")
    lines.append(f"| 通过 | {data['summary']['passed']} | 验证通过的链接 |")
    lines.append(f"| 失败 | {data['summary']['failed']} | 需要紧急修复 |")
    lines.append(f"| 警告 | {data['summary']['warnings']} | 需要关注 |")
    lines.append(f"| 重复页面 | {data['summary']['duplicate_groups']} | 需要合并处理 |")
    lines.append("")

    if data["summary"]["error_types"]:
        lines.append("## 错误类型分布")
        lines.append("")
        lines.append("| 错误类型 | 数量 |")
        lines.append("|----------|------|")
        for err_type, count in sorted(data["summary"]["error_types"].items(), key=lambda x: -x[1]):
            lines.append(f"| {err_type} | {count} |")
        lines.append("")

    lines.append("## 负责人情况")
    lines.append("")
    lines.append("| 项目 | 数值 |")
    lines.append("|------|------|")
    lines.append(f"| 负责人总数 | {data['owners']['total']} |")
    lines.append(f"| 在职 | {data['owners']['active']} |")
    lines.append(f"| 离职 | {data['owners']['inactive']} |")
    lines.append(f"| 未分配文档 | {data['owners']['unassigned_docs']} |")
    lines.append("")

    return "\n".join(lines)


def _render_owner_repair_list(data, owners, format, output):
    repair_lists = data["repair_lists"]
    owners_info = {o.owner_id: o for o in owners}

    if not repair_lists:
        console.print("[green]所有链接检查通过，无需修复[/green]")
        return

    if format == "json":
        content = json.dumps({
            "generated_at": datetime.now().isoformat(),
            "repair_lists": repair_lists,
        }, ensure_ascii=False, indent=2)
        if output:
            Path(output).write_text(content, encoding='utf-8')
            console.print(f"[green]修复清单已写入: {output}[/green]")
        else:
            console.print(content)
        return

    console.print()
    console.print(Panel(
        f"[bold]按负责人分组的修复清单[/bold]\n\n"
        f"涉及负责人: {len(repair_lists)} 位\n"
        f"待修复问题: {sum(len(items) for items in repair_lists.values())} 个",
        title="修复清单",
    ))

    priority_colors = {"critical": "red", "high": "yellow", "medium": "cyan", "low": "green"}

    for owner_id, items in sorted(repair_lists.items(), key=lambda x: len(x[1]), reverse=True):
        owner = owners_info.get(owner_id)
        owner_name = owner.name if owner else owner_id
        owner_status = "[green]在职[/green]" if (owner and owner.is_active) else "[red]离职[/red]"

        console.print()
        console.print(f"[bold cyan]👤 {owner_name}[/bold cyan] ({owner_status}) - {len(items)} 个待处理")

        table = Table(show_header=True)
        table.add_column("#", justify="right", width=3)
        table.add_column("优先级", width=10)
        table.add_column("文档", overflow="fold")
        table.add_column("问题类型", width=16)
        table.add_column("目标 URL", overflow="fold")

        for idx, item in enumerate(items, 1):
            priority_style = priority_colors.get(item["priority"], "white")
            table.add_row(
                str(idx),
                f"[{priority_style}]{item['priority']}[/{priority_style}]",
                item["document"]["title"],
                item["issue"]["error_type"] or "N/A",
                item["issue"]["target_url"][:50] + "..." if len(item["issue"]["target_url"]) > 50 else item["issue"]["target_url"],
            )

        console.print(table)


def _render_risk_report(data, format, output):
    if format == "json":
        content = json.dumps({
            "generated_at": datetime.now().isoformat(),
            "risk_assessment": {
                "level": data["risk_level"]["level"],
                "score": data["risk_level"]["score"],
                "description": data["risk_level"]["description"],
            },
            "risk_factors": {
                "failed_links": data["summary"]["failed"],
                "warnings": data["summary"]["warnings"],
                "duplicate_pages": data["summary"]["duplicate_groups"],
                "inactive_owners": data["owners"]["inactive"],
                "unassigned_docs": data["owners"]["unassigned_docs"],
            },
            "error_types": data["summary"]["error_types"],
        }, ensure_ascii=False, indent=2)
        if output:
            Path(output).write_text(content, encoding='utf-8')
            console.print(f"[green]风险报告已写入: {output}[/green]")
        else:
            console.print(content)
        return

    console.print()

    risk_colors = {"high": "red", "medium": "yellow", "low": "green"}
    risk_icon = {"high": "🔴", "medium": "🟡", "low": "🟢"}
    risk = data["risk_level"]
    risk_color = risk_colors[risk["level"]]

    console.print(Panel(
        f"[bold]整体迁移风险评估[/bold]\n\n"
        f"{risk_icon[risk['level']]} 风险等级: [{risk_color}]{risk['level'].upper()}[/{risk_color}]\n"
        f"📊 风险分数: {risk['score']} / 100\n"
        f"📝 风险说明: {risk['description']}",
        title="风险报告",
    ))

    console.print()
    table = Table(title="风险因素分析", show_header=True)
    table.add_column("风险因素", style="cyan")
    table.add_column("数量", justify="right")
    table.add_column("严重程度", width=15)
    table.add_column("建议")

    factors = [
        ("失效链接 (404)", data["summary"]["failed"], "critical" if data["summary"]["failed"] > 5 else "high"),
        ("警告链接", data["summary"]["warnings"], "medium" if data["summary"]["warnings"] > 10 else "low"),
        ("重复页面", data["summary"]["duplicate_groups"], "medium"),
        ("离职负责人", data["owners"]["inactive"], "high" if data["owners"]["inactive"] > 0 else "low"),
        ("未分配文档", data["owners"]["unassigned_docs"], "medium"),
    ]

    severity_colors = {"critical": "red", "high": "yellow", "medium": "cyan", "low": "green"}

    for name, count, severity in factors:
        severity_style = severity_colors.get(severity, "white")
        suggestion = _get_suggestion(name, count, severity)
        table.add_row(
            name,
            str(count),
            f"[{severity_style}]{severity}[/{severity_style}]",
            suggestion,
        )

    console.print(table)

    console.print()
    console.print(Panel(
        "[cyan]闭环验证建议:[/cyan]\n\n"
        "1. [red]高风险[/red]: 失效链接 > 5 个，立即组织修复\n"
        "2. [yellow]中风险[/yellow]: 有警告或重复页面，制定修复计划\n"
        "3. [green]低风险[/green]: 定期检查，确认所有问题已解决\n\n"
        "[bold]业务闭环判断标准:[/bold]\n"
        "  ✓ 失效链接 = 0\n"
        "  ✓ 离职负责人数 = 0\n"
        "  ✓ 所有警告已处理或记录忽略原因",
        title="业务闭环建议",
    ))


def _get_suggestion(name, count, severity):
    if count == 0:
        return "✓ 无问题"
    if "失效链接" in name:
        return "立即修复"
    if "警告" in name:
        return "分类处理"
    if "重复" in name:
        return "合并去重"
    if "离职" in name:
        return "重新分配"
    if "未分配" in name:
        return "指定负责人"
    return "关注"


def _render_ignore_list(corrections, format, output):
    ignored = [c for c in corrections if c.action == "ignore"]

    if format == "json":
        content = json.dumps({
            "generated_at": datetime.now().isoformat(),
            "total_ignored": len(ignored),
            "ignored_items": [c.to_dict() for c in ignored],
        }, ensure_ascii=False, indent=2)
        if output:
            Path(output).write_text(content, encoding='utf-8')
            console.print(f"[green]忽略列表已写入: {output}[/green]")
        else:
            console.print(content)
        return

    if not ignored:
        console.print("[yellow]暂无人工忽略的记录[/yellow]")
        console.print()
        console.print("[dim]提示: 人工修正时需要记录前后差异和操作者[/dim]")
        return

    console.print()
    table = Table(title="人工忽略记录", show_header=True)
    table.add_column("#", justify="right", width=3)
    table.add_column("时间", style="cyan", width=20)
    table.add_column("操作者", width=10)
    table.add_column("原链接", overflow="fold")
    table.add_column("忽略原因", overflow="fold")

    for idx, c in enumerate(ignored, 1):
        table.add_row(
            str(idx),
            c.corrected_at.strftime("%Y-%m-%d %H:%M"),
            c.operator,
            c.original_url[:30] + "..." if len(c.original_url) > 30 else c.original_url,
            c.ignore_reason or "N/A",
        )

    console.print(table)
