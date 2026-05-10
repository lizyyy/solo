import os
from typing import List, Optional
from datetime import datetime

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.text import Text
from rich import box

from .parser import parse_quote_file
from .storage import (
    load_all_quotes, save_quote, find_quote_by_supplier,
    find_quote_by_hash, delete_quote, add_correction,
    get_correction_history, clear_database,
)
from .comparison import normalize_quotes, generate_comparison_summary
from .exporter import (
    export_markdown, export_csv, format_price, format_tax_rate, format_date,
    generate_supplier_detail_markdown,
)


console = Console()
STORAGE_PATH = os.environ.get("PRICE_COMPARE_DB", ".price_compare_db.json")


@click.group()
@click.version_option(version="1.0.0")
def cli():
    """采购报价拆分比价 CLI - 整理供应商办公耗材报价，支持多供应商比价"""
    pass


@cli.command()
@click.argument('files', nargs=-1, type=click.Path(exists=True))
@click.option('--supplier', '-s', help='手动指定供应商名称（覆盖自动识别）')
@click.option('--force', '-f', is_flag=True, help='强制更新重复文件')
def import_cmd(files, supplier, force):
    """导入供应商报价表 (CSV 或 Excel)"""
    if not files:
        console.print("[red]错误: 请指定至少一个报价文件[/red]")
        return
    
    for file_path in files:
        try:
            quote = parse_quote_file(file_path)
            
            if supplier:
                quote.supplier_name = supplier
            
            existing = find_quote_by_hash(quote.file_hash, STORAGE_PATH)
            if existing and not force:
                console.print(f"[yellow]跳过重复文件: {os.path.basename(file_path)}[/yellow]")
                console.print(f"  已存在于供应商: {existing.supplier_name}")
                continue
            
            existing_by_supplier = find_quote_by_supplier(quote.supplier_name, STORAGE_PATH)
            if existing_by_supplier and existing_by_supplier.file_hash != quote.file_hash:
                if force:
                    console.print(f"[yellow]强制更新供应商 '{quote.supplier_name}' 的报价[/yellow]")
                else:
                    console.print(f"[yellow]供应商 '{quote.supplier_name}' 已有报价，使用 --force 覆盖[/yellow]")
                    continue
            
            is_new = save_quote(quote, STORAGE_PATH)
            status = "导入" if is_new else "更新"
            console.print(f"[green]✓ {status}: {quote.supplier_name}[/green]")
            console.print(f"  商品数: {len(quote.items)}, 套餐数: {len(quote.packages)}")
            console.print(f"  总价: {format_price(quote.grand_total)}")
        
        except Exception as e:
            console.print(f"[red]✗ 导入失败: {os.path.basename(file_path)}[/red]")
            console.print(f"  错误: {str(e)}")


@cli.command()
def list_cmd():
    """列出已导入的所有供应商报价"""
    quotes = load_all_quotes(STORAGE_PATH)
    
    if not quotes:
        console.print("[yellow]暂无已导入的报价[/yellow]")
        return
    
    table = Table(title="已导入的供应商报价", box=box.ROUNDED)
    table.add_column("供应商", style="cyan")
    table.add_column("报价ID", style="dim")
    table.add_column("日期")
    table.add_column("商品数", justify="right")
    table.add_column("套餐数", justify="right")
    table.add_column("运费", justify="right")
    table.add_column("总价(含税)", justify="right", style="bold")
    table.add_column("警告", justify="right")
    
    for quote in quotes:
        warning_count = len(quote.all_warnings)
        table.add_row(
            quote.supplier_name,
            quote.quote_id,
            format_date(quote.quote_date),
            str(len(quote.items)),
            str(len(quote.packages)),
            format_price(quote.shipping_fee),
            format_price(quote.grand_total),
            f"[yellow]{warning_count}[/yellow]" if warning_count > 0 else "0",
        )
    
    console.print(table)


@cli.command()
@click.argument('supplier_name')
def show(supplier_name):
    """展示指定供应商的报价明细"""
    quote = find_quote_by_supplier(supplier_name, STORAGE_PATH)
    if not quote:
        console.print(f"[red]未找到供应商: {supplier_name}[/red]")
        return
    
    console.print(Panel.fit(
        f"[cyan]{quote.supplier_name}[/cyan]\n"
        f"报价ID: {quote.quote_id}\n"
        f"报价日期: {format_date(quote.quote_date)}\n"
        f"[bold]总价(含税): {format_price(quote.grand_total)}[/bold]",
        title="报价汇总",
        border_style="cyan"
    ))
    
    if quote.items:
        table = Table(title="商品明细", box=box.ROUNDED)
        table.add_column("SKU")
        table.add_column("商品名称")
        table.add_column("数量", justify="right")
        table.add_column("单位")
        table.add_column("不含税单价", justify="right")
        table.add_column("税率")
        table.add_column("含税小计", justify="right")
        table.add_column("备注")
        
        for item in quote.items:
            note = ""
            if item.is_gift:
                note = "[green]🎁 赠品[/green]"
            warnings = [w.value for w in item.warnings]
            if warnings:
                note = f"[yellow]⚠️ {'、'.join(warnings)}[/yellow]" if not note else f"{note} | [yellow]⚠️ {'、'.join(warnings)}[/yellow]"
            
            table.add_row(
                item.sku,
                item.name,
                f"{item.quantity:g}",
                item.unit,
                format_price(item.unit_price),
                format_tax_rate(item.tax_rate),
                format_price(item.total),
                note,
            )
        
        console.print(table)
    
    if quote.packages:
        pkg_table = Table(title="套餐包", box=box.ROUNDED)
        pkg_table.add_column("SKU")
        pkg_table.add_column("套餐名称")
        pkg_table.add_column("数量", justify="right")
        pkg_table.add_column("套餐价", justify="right")
        pkg_table.add_column("备注")
        
        for pkg in quote.packages:
            warnings = [w.value for w in pkg.warnings]
            note = f"[yellow]⚠️ {'、'.join(warnings)}[/yellow]" if warnings else ""
            pkg_table.add_row(
                pkg.sku,
                pkg.name,
                f"{pkg.quantity:g}",
                format_price(pkg.package_price),
                note,
            )
        console.print(pkg_table)
    
    if quote.corrections:
        corr_table = Table(title="修正历史", box=box.ROUNDED)
        corr_table.add_column("时间")
        corr_table.add_column("字段")
        corr_table.add_column("原值")
        corr_table.add_column("新值")
        corr_table.add_column("原因")
        
        for corr in quote.corrections:
            corr_table.add_row(
                format_date(corr.timestamp) + (f" {corr.timestamp.strftime('%H:%M:%S')}" if corr.timestamp else ""),
                corr.field,
                str(corr.old_value),
                str(corr.new_value),
                corr.reason,
            )
        console.print(corr_table)


@cli.command()
@click.option('--format', '-f', 'fmt', type=click.Choice(['markdown', 'csv']), default='markdown')
@click.option('--output', '-o', help='输出文件路径')
def compare(fmt, output):
    """比价 - 比较所有供应商报价"""
    quotes = load_all_quotes(STORAGE_PATH)
    
    if len(quotes) < 1:
        console.print("[red]至少需要导入1份报价才能比价[/red]")
        return
    
    result = normalize_quotes(quotes)
    summary = generate_comparison_summary(result)
    
    console.print(Panel.fit(
        f"[bold]比价摘要[/bold]\n"
        f"供应商数: {len(result.supplier_totals)}\n"
        f"商品总数: {summary['total_products']}\n"
        f"比价商品: {summary['products_with_multiple_quotes']}\n"
        f"单位问题: {summary['products_with_unit_issues']}\n"
        f"[green]估算节省: {format_price(summary['estimated_savings'])}[/green]",
        title="比价结果",
        border_style="green"
    ))
    
    if result.supplier_totals:
        supplier_names = list(result.supplier_totals.keys())
        total_table = Table(title="供应商总价对比", box=box.ROUNDED)
        total_table.add_column("项目")
        for name in supplier_names:
            total_table.add_column(name, justify="right")
        
        for label, key in [
            ("商品小计(不含税)", "items_subtotal"),
            ("商品税额", "items_tax"),
            ("运费", "shipping_fee"),
            ("运费税额", "shipping_tax"),
            ("[bold]总价(含税)[/bold]", "grand_total"),
        ]:
            values = [format_price(result.supplier_totals[s].get(key, 0)) for s in supplier_names]
            total_table.add_row(label, *values)
        
        console.print(total_table)
    
    if result.products:
        all_suppliers = list(result.supplier_totals.keys())
        prod_table = Table(title="商品比价明细", box=box.ROUNDED)
        prod_table.add_column("商品")
        prod_table.add_column("标准单位")
        for s in all_suppliers:
            prod_table.add_column(f"{s} 含税单价", justify="right")
        prod_table.add_column("最优")
        
        for prod_key, product in result.products.items():
            row = []
            unit_note = " ⚠️" if not product.all_same_unit else ""
            row.append(f"{product.name}{unit_note}")
            row.append(product.normalized_unit)
            
            for supplier in all_suppliers:
                if supplier in product.supplier_quotations:
                    data = product.supplier_quotations[supplier]
                    if data['is_gift']:
                        row.append("[green]🎁 赠品[/green]")
                    elif supplier == product.best_supplier:
                        row.append(f"[green][bold]{format_price(data['unit_price_tax_incl'])}[/bold][/green]")
                    else:
                        row.append(format_price(data['unit_price_tax_incl']))
                else:
                    row.append("-")
            
            row.append(product.best_supplier or "-")
            prod_table.add_row(*row)
        
        console.print(prod_table)
    
    if result.warnings:
        console.print("\n[yellow]⚠️ 警告信息:[/yellow]")
        for w in result.warnings[:10]:
            console.print(f"  - {w}")
        if len(result.warnings) > 10:
            console.print(f"  ... 还有 {len(result.warnings) - 10} 条警告")
    
    if output:
        if fmt == 'markdown':
            export_markdown(result, quotes, output)
        else:
            export_csv(result, output)
        console.print(f"\n[green]✓ 已导出报告: {output}[/green]")


@cli.command()
@click.argument('supplier_name')
@click.option('--output', '-o', help='输出文件路径 (Markdown)')
def export_detail(supplier_name, output):
    """导出单个供应商的报价详情"""
    quote = find_quote_by_supplier(supplier_name, STORAGE_PATH)
    if not quote:
        console.print(f"[red]未找到供应商: {supplier_name}[/red]")
        return
    
    content = generate_supplier_detail_markdown(quote)
    
    if output:
        with open(output, 'w', encoding='utf-8') as f:
            f.write(content)
        console.print(f"[green]✓ 已导出: {output}[/green]")
    else:
        console.print(content)


@cli.command()
@click.argument('supplier_name')
@click.option('--field', '-f', required=True, help='要修正的字段 (如 shipping_fee, tax_rate:SKU001)')
@click.option('--old', '-o', required=True, help='原值')
@click.option('--new', '-n', required=True, help='新值')
@click.option('--reason', '-r', required=True, help='修正原因')
def correct(supplier_name, field, old, new, reason):
    """人工修正报价数据（留痕）"""
    added = add_correction(supplier_name, field, old, new, reason, STORAGE_PATH)
    if added:
        console.print(f"[green]✓ 已记录修正: {field} = {old} → {new}[/green]")
        console.print(f"  原因: {reason}")
    else:
        console.print(f"[red]未找到供应商: {supplier_name}[/red]")


@cli.command()
@click.argument('supplier_name')
def history(supplier_name):
    """查看供应商的修正历史"""
    corrections = get_correction_history(supplier_name, STORAGE_PATH)
    if not corrections:
        console.print(f"[yellow]供应商 '{supplier_name}' 暂无修正记录[/yellow]")
        return
    
    table = Table(title=f"{supplier_name} - 修正历史", box=box.ROUNDED)
    table.add_column("时间")
    table.add_column("字段")
    table.add_column("原值")
    table.add_column("新值")
    table.add_column("原因")
    
    for corr in corrections:
        table.add_row(
            format_date(corr.timestamp) + (f" {corr.timestamp.strftime('%H:%M:%S')}" if corr.timestamp else ""),
            corr.field,
            str(corr.old_value),
            str(corr.new_value),
            corr.reason,
        )
    
    console.print(table)


@cli.command()
@click.argument('supplier_name')
def remove(supplier_name):
    """删除指定供应商的报价"""
    deleted = delete_quote(supplier_name, STORAGE_PATH)
    if deleted:
        console.print(f"[green]✓ 已删除: {supplier_name}[/green]")
    else:
        console.print(f"[yellow]未找到: {supplier_name}[/yellow]")


@cli.command()
@click.option('--yes', '-y', is_flag=True, help='确认清空')
def clear(yes):
    """清空所有报价数据"""
    if not yes:
        confirm = click.confirm("确定要清空所有报价数据吗？此操作不可撤销")
        if not confirm:
            return
    
    clear_database(STORAGE_PATH)
    console.print("[green]✓ 已清空所有数据[/green]")


@cli.command()
def demo():
    """使用内置样例数据演示比价流程"""
    samples_dir = os.path.join(os.path.dirname(__file__), 'samples')
    
    if not os.path.exists(samples_dir):
        console.print("[red]样例数据目录不存在[/red]")
        return
    
    sample_files = [
        os.path.join(samples_dir, f)
        for f in ['supplier_晨光.csv', 'supplier_得力.csv', 'supplier_齐心.csv']
        if os.path.exists(os.path.join(samples_dir, f))
    ]
    
    if len(sample_files) < 3:
        console.print("[yellow]请确保样例文件已创建[/yellow]")
        return
    
    console.print(Panel(
        "[cyan]采购报价比价演示[/cyan]\n\n"
        "本演示将：\n"
        "1. 清空现有数据库\n"
        "2. 导入3家供应商的样例报价\n"
        "3. 展示所有供应商\n"
        "4. 执行比价并展示结果\n"
        "5. 导出 Markdown 和 CSV 报告",
        title="演示模式",
        border_style="cyan"
    ))
    
    if not click.confirm("开始演示？"):
        return
    
    clear_database(STORAGE_PATH)
    console.print("[green]✓ 已清空数据库[/green]")
    
    console.print("\n[bold]步骤1: 导入样例报价[/bold]")
    for f in sample_files:
        try:
            quote = parse_quote_file(f)
            save_quote(quote, STORAGE_PATH)
            console.print(f"  [green]✓ {quote.supplier_name}[/green]")
        except Exception as e:
            console.print(f"  [red]✗ {os.path.basename(f)}: {e}[/red]")
    
    console.print("\n[bold]步骤2: 列出已导入的报价[/bold]")
    quotes = load_all_quotes(STORAGE_PATH)
    list_table = Table(box=box.ROUNDED)
    list_table.add_column("供应商")
    list_table.add_column("商品数")
    list_table.add_column("总价(含税)")
    for q in quotes:
        list_table.add_row(q.supplier_name, str(len(q.items)), format_price(q.grand_total))
    console.print(list_table)
    
    console.print("\n[bold]步骤3: 比价分析[/bold]")
    result = normalize_quotes(quotes)
    summary = generate_comparison_summary(result)
    
    all_suppliers = list(result.supplier_totals.keys())
    compare_table = Table(title="按商品比价", box=box.ROUNDED)
    compare_table.add_column("商品")
    for s in all_suppliers:
        compare_table.add_column(f"{s}", justify="right")
    compare_table.add_column("最优")
    
    for prod_key, product in result.products.items():
        row = [product.name]
        for supplier in all_suppliers:
            if supplier in product.supplier_quotations:
                data = product.supplier_quotations[supplier]
                if data['is_gift']:
                    row.append("[green]🎁[/green]")
                elif supplier == product.best_supplier:
                    row.append(f"[green]{format_price(data['unit_price_tax_incl'])}[/green]")
                else:
                    row.append(format_price(data['unit_price_tax_incl']))
            else:
                row.append("-")
        row.append(product.best_supplier or "-")
        compare_table.add_row(*row)
    
    console.print(compare_table)
    
    console.print(f"\n[green]✓ 估算可节省: {format_price(summary['estimated_savings'])}[/green]")
    
    md_output = "comparison_report.md"
    csv_output = "comparison_report.csv"
    
    console.print(f"\n[bold]步骤4: 导出报告[/bold]")
    export_markdown(result, quotes, md_output)
    export_csv(result, csv_output)
    console.print(f"  [green]✓ Markdown: {md_output}[/green]")
    console.print(f"  [green]✓ CSV: {csv_output}[/green]")
    
    console.print("\n[bold]演示完成！[/bold]")
    console.print(f"运行 [cyan]price_compare compare -f markdown -o report.md[/cyan] 再次生成报告")
    console.print(f"运行 [cyan]price_compare show 晨光[/cyan] 查看供应商详情")


def main():
    cli()


if __name__ == '__main__':
    main()
