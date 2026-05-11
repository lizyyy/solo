import os
import uuid
from datetime import datetime
from decimal import Decimal
import click
from rich.console import Console
from rich.table import Table

from expense_audit.auditor import run_audit
from expense_audit.data_io import (
    load_invoices,
    load_itinerary,
    load_manual_overrides,
    load_rules,
    save_json,
    save_manual_override,
)
from expense_audit.models import ManualOverride
from expense_audit.reporter import format_text_report, generate_report

console = Console()


@click.group()
def main():
    """出差报销票据审核 CLI 工具"""
    pass


@main.command()
@click.option("--itinerary", "-i", required=True, help="行程单 JSON 文件路径")
@click.option("--invoices", "-v", required=True, help="票据清单 JSON 文件路径")
@click.option("--rules", "-r", required=True, help="报销规则 JSON 文件路径")
@click.option("--overrides", "-o", default=None, help="人工审批记录 JSON 文件路径（可选）")
@click.option("--output", "-O", default=None, help="输出报告文件路径（可选）")
def audit(itinerary, invoices, rules, overrides, output):
    """执行报销审核"""
    console.print("[bold blue]正在加载数据...[/bold blue]")

    itinerary_data = load_itinerary(itinerary)
    invoices_data = load_invoices(invoices)
    rules_data = load_rules(rules)
    manual_overrides = load_manual_overrides(overrides) if overrides else None

    console.print(f"[green]已加载:[/green] 行程 - {itinerary_data.employee_name}, 票据 - {len(invoices_data)} 笔, 规则 - {len(rules_data)} 条")

    if manual_overrides:
        console.print(f"[yellow]人工审批记录:[/yellow] {len(manual_overrides)} 条")

    console.print("\n[bold blue]正在执行审核...[/bold blue]")

    audit_results = run_audit(
        itinerary_data,
        invoices_data,
        rules_data,
        manual_overrides,
    )

    report = generate_report(itinerary_data, audit_results)
    text_report = format_text_report(report)

    if output:
        with open(output, "w", encoding="utf-8") as f:
            f.write(text_report)
        console.print(f"\n[bold green]报告已保存至:[/bold green] {output}")

        json_output = output.rsplit(".", 1)[0] + ".json"
        save_json(report.model_dump(), json_output)
        console.print(f"[bold green]JSON 报告已保存至:[/bold green] {json_output}")

    console.print("\n" + "=" * 70)
    console.print(text_report)


@main.command()
@click.option("--invoice-number", "-n", required=True, help="发票编号")
@click.option("--reason", "-r", required=True, help="人工审批原因")
@click.option("--approved-by", "-a", required=True, help="审批人")
@click.option("--amount", "-m", default=None, type=float, help="核准金额（可选，不指定则按发票金额）")
@click.option("--output", "-O", required=True, help="输出到的人工审批记录 JSON 文件")
def approve(invoice_number, reason, approved_by, amount, output):
    """登记人工审批通过记录"""
    override = ManualOverride(
        override_id=str(uuid.uuid4())[:8].upper(),
        invoice_number=invoice_number,
        reason=reason,
        approved_by=approved_by,
        approved_date=datetime.now(),
        override_amount=Decimal(str(amount)) if amount is not None else None,
    )

    save_manual_override(override, output)

    table = Table(title="人工审批登记", show_header=True, header_style="bold magenta")
    table.add_column("字段", style="cyan")
    table.add_column("值")
    table.add_row("审批编号", override.override_id)
    table.add_row("发票编号", override.invoice_number)
    table.add_row("审批人", override.approved_by)
    table.add_row("审批时间", override.approved_date.strftime("%Y-%m-%d %H:%M:%S"))
    table.add_row("核准金额", str(override.override_amount) if override.override_amount else "按发票金额")
    table.add_row("审批依据", override.reason)

    console.print(table)
    console.print(f"\n[bold green]人工审批记录已保存至:[/bold green] {output}")


@main.command()
@click.argument("name")
@click.option("--output", "-O", default="examples", help="输出目录")
def init_sample(name, output):
    """初始化样例数据（预设场景：normal/exceed/duplicate/missing）"""
    from pathlib import Path
    import shutil

    base_dir = Path(__file__).parent.parent.parent / "examples"
    target_dir = Path(output)

    samples = {
        "normal": "case_normal",
        "exceed": "case_exceed",
        "duplicate": "case_duplicate",
        "missing": "case_missing",
    }

    if name not in samples:
        console.print(f"[red]未知的样例名称: {name}[/red]")
        console.print(f"可用选项: {', '.join(samples.keys())}")
        return

    sample_dir = base_dir / samples[name]
    if not sample_dir.exists():
        console.print(f"[red]样例目录不存在: {sample_dir}[/red]")
        return

    target = target_dir / name
    if target.exists():
        console.print(f"[yellow]目标目录已存在: {target}[/yellow]")
        return

    shutil.copytree(sample_dir, target)

    console.print(f"[green]样例数据已初始化至:[/green] {target}")
    console.print(f"执行审核命令: [cyan]expense-audit audit -i {target}/itinerary.json -v {target}/invoices.json -r examples/rules.json[/cyan]")


@main.command()
def list_samples():
    """列出所有预设样例场景"""
    table = Table(title="预设样例场景", show_header=True, header_style="bold magenta")
    table.add_column("名称", style="cyan")
    table.add_column("描述")
    table.add_row("normal", "正常报销 - 所有票据符合标准")
    table.add_row("exceed", "超标待审 - 住宿费用超标")
    table.add_row("duplicate", "重复票据 - 同一天两笔餐费")
    table.add_row("missing", "缺票扣减 - 缺少审批编号+票据日期超出行程")

    console.print(table)


if __name__ == "__main__":
    main()
