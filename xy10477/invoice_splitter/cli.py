"""CLI入口"""

import os
import sys
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from .importer import DataImporter
from .splitter import InvoiceSplitter
from .report import ReportGenerator

console = Console()


def print_header(text: str):
    """打印标题"""
    console.print(Panel.fit(f"[bold cyan]{text}[/bold cyan]"))


def print_success(text: str):
    """打印成功信息"""
    console.print(f"[green]✓ {text}[/green]")


def print_error(text: str):
    """打印错误信息"""
    console.print(f"[red]✗ {text}[/red]")


def print_warning(text: str):
    """打印警告信息"""
    console.print(f"[yellow]⚠ {text}[/yellow]")


def print_info(text: str):
    """打印信息"""
    console.print(f"[blue]ℹ {text}[/blue]")


def display_summary(result):
    """显示汇总信息"""
    table = Table(title="拆票汇总", show_header=True, header_style="bold magenta")
    table.add_column("统计项", style="cyan")
    table.add_column("数值", justify="right", style="green")
    table.add_row("总订单数", f"{result.total_orders} 笔")
    table.add_row("有效订单", f"{result.valid_orders} 笔")
    table.add_row("发票分组", f"{result.total_invoice_groups} 组")
    table.add_row("异常总数", f"{result.total_issues} 个")
    table.add_row("未解决异常", f"{result.unresolved_issues} 个")
    table.add_row("开票总金额", f"{result.total_amount:,.2f} 元")
    table.add_row("人工调整", f"{len(result.adjustments)} 次")
    console.print(table)


def display_issues(result):
    """显示异常信息"""
    if not result.issues:
        print_success("没有发现异常")
        return

    table = Table(title="异常记录", show_header=True, header_style="bold magenta")
    table.add_column("类型", style="cyan")
    table.add_column("严重程度", style="yellow")
    table.add_column("订单ID", style="white")
    table.add_column("异常信息", style="white", overflow="fold")

    severity_colors = {
        "error": "red",
        "warning": "yellow",
        "info": "blue",
    }

    for issue in result.issues:
        color = severity_colors.get(issue.severity, "white")
        table.add_row(
            f"[{color}]{issue.type.value}[/{color}]",
            f"[{color}]{issue.severity}[/{color}]",
            issue.order_id or "-",
            issue.message,
        )
    console.print(table)


def display_invoice_groups(result):
    """显示发票分组"""
    if not result.invoice_groups:
        print_warning("没有可开票的分组")
        return

    table = Table(title="发票分组详情", show_header=True, header_style="bold magenta")
    table.add_column("分组ID", style="cyan")
    table.add_column("抬头", style="green")
    table.add_column("类型", style="yellow")
    table.add_column("税率", style="blue")
    table.add_column("订单数", justify="right")
    table.add_column("净金额", justify="right", style="green")
    table.add_column("拆票原因", style="white", overflow="fold")

    for group in result.invoice_groups:
        adjusted_mark = " [red](调整)[/red]" if group.is_adjusted else ""
        table.add_row(
            f"{group.group_id}{adjusted_mark}",
            group.header_name,
            group.header_type.value,
            f"{float(group.tax_rate) * 100}%",
            str(len(group.order_ids)),
            f"{float(group.net_amount):,.2f}",
            group.split_reason,
        )
    console.print(table)


@click.group()
@click.version_option()
def cli():
    """多渠道订单拆票CLI工具

    用于处理多平台订单的发票拆分，支持按抬头和税率拆票，
    处理退款冲抵，检测异常情况，并支持人工调整。
    """
    pass


@cli.command()
@click.option("--orders", "-o", required=True, help="订单文件路径 (CSV/Excel)")
@click.option("--order-items", "-i", help="订单项文件路径 (CSV/Excel)")
@click.option("--headers", "-H", help="发票抬头文件路径 (CSV/Excel)")
@click.option("--categories", "-c", help="商品类目文件路径 (CSV/Excel)")
@click.option("--refunds", "-r", help="退款记录文件路径 (CSV/Excel)")
@click.option("--output", "-O", required=True, help="输出报告路径 (Excel文件)")
@click.option("--format", "-f", "fmt", type=click.Choice(["excel", "csv", "json", "all"]), default="excel", help="输出格式")
@click.option("--output-dir", "-d", help="CSV输出目录 (format=csv时使用)")
@click.option("--verbose", "-v", is_flag=True, help="显示详细信息")
def split(
    orders: str,
    order_items: Optional[str],
    headers: Optional[str],
    categories: Optional[str],
    refunds: Optional[str],
    output: str,
    fmt: str,
    output_dir: Optional[str],
    verbose: bool,
):
    """执行拆票分析

    导入订单、订单项、抬头、类目和退款数据，自动进行拆票分析，
    检测异常，并生成开票建议报告。
    """
    print_header("多渠道订单拆票分析")

    try:
        importer = DataImporter()

        print_info("正在导入数据...")

        if headers:
            print_info(f"  导入抬头: {headers}")
            importer.import_headers(headers)
            print_success(f"  已导入 {len(importer.headers_map)} 个抬头")

        if categories:
            print_info(f"  导入类目: {categories}")
            importer.import_categories(categories)
            print_success(f"  已导入 {len(importer.categories_map)} 个类目")

        print_info(f"  导入订单: {orders}")
        orders_list, _ = importer.import_orders(orders)
        print_success(f"  已导入 {len(orders_list)} 个订单")

        if order_items:
            print_info(f"  导入订单项: {order_items}")
            items = importer.import_order_items(order_items)
            print_success(f"  已导入 {len(items)} 个订单项")

        if refunds:
            print_info(f"  导入退款: {refunds}")
            refunds_list = importer.import_refunds(refunds)
            print_success(f"  已导入 {len(refunds_list)} 条退款记录")

        print_info("正在处理数据...")
        if headers:
            importer.enrich_orders_with_header()
        if categories:
            importer.enrich_items_with_category_tax_rate()
        if refunds:
            importer.apply_refunds_to_orders()

        orders, headers_list, categories_list, refunds_list = importer.get_all_data()

        print_info("正在执行拆票分析...")
        splitter = InvoiceSplitter(orders, headers_list, categories_list, refunds_list)
        result = splitter.split()

        print_success("拆票分析完成!")
        console.print()

        display_summary(result)
        console.print()

        if result.issues:
            display_issues(result)
            console.print()

        if verbose:
            display_invoice_groups(result)
            console.print()

        print_info("正在导出报告...")

        if fmt in ["excel", "all"]:
            ReportGenerator.export_to_excel(result, output)
            print_success(f"  Excel报告已导出: {output}")

        if fmt in ["csv", "all"]:
            out_dir = output_dir or os.path.dirname(output) or "."
            ReportGenerator.export_to_csv(result, out_dir)
            print_success(f"  CSV报告已导出到: {out_dir}")

        if fmt in ["json", "all"]:
            json_path = os.path.splitext(output)[0] + ".json"
            ReportGenerator.export_to_json(result, json_path)
            print_success(f"  JSON报告已导出: {json_path}")

        console.print()
        print_success("所有操作完成!")

        if result.unresolved_issues > 0:
            print_warning(f"注意: 仍有 {result.unresolved_issues} 个异常未解决，建议先处理后再开票")

    except Exception as e:
        print_error(f"处理失败: {str(e)}")
        if verbose:
            import traceback
            traceback.print_exc()
        sys.exit(1)


@cli.command("adjust")
@click.option("--input", "-i", "input_file", required=True, help="之前生成的JSON报告路径")
@click.option("--action", "-a", required=True, type=click.Choice(["merge", "split"]), help="操作类型: merge(合并) 或 split(拆分)")
@click.option("--groups", "-g", required=True, help="目标分组ID，多个用逗号分隔")
@click.option("--operator", "-O", default="系统", help="操作人名称")
@click.option("--reason", "-r", required=True, help="调整原因")
@click.option("--notes", "-n", help="调整说明")
@click.option("--output", "-o", required=True, help="输出报告路径")
def adjust(
    input_file: str,
    action: str,
    groups: str,
    operator: str,
    reason: str,
    notes: Optional[str],
    output: str,
):
    """人工调整拆票结果

    对自动拆票结果进行人工调整，支持合并或拆分发票分组。
    调整记录将被保存，报告中会显示调整前后对比。
    """
    print_header("人工调整拆票")

    try:
        import json
        from decimal import Decimal
        from .models import (
            InvoiceGroup, Issue, SplitResult, Order, InvoiceHeader,
            ProductCategory, RefundRecord, InvoiceType, OrderStatus
        )

        print_info(f"读取之前的结果: {input_file}")
        with open(input_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        orders: List[Order] = []
        headers: List[InvoiceHeader] = []
        categories: List[ProductCategory] = []
        refunds: List[RefundRecord] = []
        invoice_groups: List[InvoiceGroup] = []
        issues: List[Issue] = []

        for g_data in data["invoice_groups"]:
            from .models import InvoiceGroup, InvoiceType
            group = InvoiceGroup(
                group_id=g_data["group_id"],
                header_name=g_data["header_name"],
                header_type=InvoiceType(g_data["header_type"]) if g_data["header_type"] in ["企业", "个人", "未知"] else InvoiceType.UNKNOWN,
                tax_rate=Decimal(str(g_data["tax_rate"])),
                order_ids=g_data["order_ids"].split(",") if g_data["order_ids"] else [],
                split_reason=g_data["split_reason"],
                is_adjusted=g_data.get("is_adjusted", False),
                adjustment_notes=g_data.get("adjustment_notes"),
                original_group_ids=g_data.get("original_group_ids", []),
            )
            invoice_groups.append(group)

        target_group_ids = [g.strip() for g in groups.split(",")]

        existing_ids = [g.group_id for g in invoice_groups]
        invalid_ids = [g for g in target_group_ids if g not in existing_ids]
        if invalid_ids:
            print_error(f"无效的分组ID: {', '.join(invalid_ids)}")
            print_info(f"有效分组ID: {', '.join(existing_ids)}")
            sys.exit(1)

        result = SplitResult(
            original_orders=orders,
            headers=headers,
            categories=categories,
            refunds=refunds,
            issues=issues,
            invoice_groups=invoice_groups,
        )

        splitter = InvoiceSplitter(orders, headers, categories, refunds)

        action_text = "合并" if action == "merge" else "拆分"
        print_info(f"执行 {action_text} 操作...")
        print_info(f"  目标分组: {', '.join(target_group_ids)}")
        print_info(f"  操作人: {operator}")
        print_info(f"  原因: {reason}")

        new_result = splitter.adjust_split(
            result=result,
            action=action,
            target_group_ids=target_group_ids,
            operator=operator,
            reason=reason,
            notes=notes,
        )

        if new_result == result:
            print_warning("没有进行任何调整，请检查参数是否正确")
            print_info("  merge 需要至少2个分组")
            print_info("  split 需要正好1个分组")
            sys.exit(1)

        print_success("调整完成!")
        console.print()
        display_summary(new_result)
        console.print()
        display_invoice_groups(new_result)

        print_info("正在导出报告...")
        ReportGenerator.export_to_excel(new_result, output)
        print_success(f"Excel报告已导出: {output}")

        json_path = os.path.splitext(output)[0] + ".json"
        ReportGenerator.export_to_json(new_result, json_path)
        print_success(f"JSON报告已导出: {json_path}")

        console.print()
        print_success("调整完成!")

    except Exception as e:
        print_error(f"调整失败: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@cli.command("view")
@click.option("--input", "-i", "input_file", required=True, help="JSON报告路径")
@click.option("--type", "-t", "view_type", type=click.Choice(["all", "summary", "issues", "groups", "text"]), default="all", help="查看类型")
def view(input_file: str, view_type: str):
    """查看拆票报告

    在终端中查看已生成的拆票报告内容。
    """
    print_header("查看拆票报告")

    try:
        import json
        from decimal import Decimal
        from .models import (
            InvoiceGroup, Issue, SplitResult, InvoiceType
        )

        print_info(f"读取报告: {input_file}")
        with open(input_file, "r", encoding="utf-8") as f:
            data = json.load(f)

        invoice_groups: List[InvoiceGroup] = []
        issues: List[Issue] = []

        for g_data in data["invoice_groups"]:
            header_type_value = g_data.get("header_type", "未知")
            if header_type_value == "企业":
                header_type = InvoiceType.ENTERPRISE
            elif header_type_value == "个人":
                header_type = InvoiceType.PERSONAL
            else:
                header_type = InvoiceType.UNKNOWN

            group = InvoiceGroup(
                group_id=g_data["group_id"],
                header_name=g_data["header_name"],
                header_type=header_type,
                tax_rate=Decimal(str(g_data["tax_rate"])),
                order_ids=g_data["order_ids"].split(",") if g_data.get("order_ids") else [],
                split_reason=g_data["split_reason"],
                is_adjusted=g_data.get("is_adjusted", False),
                adjustment_notes=g_data.get("adjustment_notes"),
            )
            invoice_groups.append(group)

        from .models import Issue as IssueModel, IssueType
        for i_data in data.get("issues", []):
            issue = IssueModel(
                issue_id=i_data["issue_id"],
                type=IssueType(i_data["type"]) if i_data["type"] in [e.value for e in IssueType] else IssueType.HEADER_MISSING,
                order_id=i_data.get("order_id"),
                item_id=i_data.get("item_id"),
                category_id=i_data.get("category_id"),
                header_id=i_data.get("header_id"),
                message=i_data["message"],
                severity=i_data.get("severity", "error"),
                resolved=i_data.get("resolved", False),
                resolution_notes=i_data.get("resolution_notes"),
            )
            issues.append(issue)

        result = SplitResult(
            original_orders=[],
            headers=[],
            categories=[],
            refunds=[],
            issues=issues,
            invoice_groups=invoice_groups,
        )

        summary_data = data.get("summary", {})
        result._summary_data = summary_data

        console.print()

        if view_type in ["all", "summary", "text"]:
            table = Table(title="拆票汇总", show_header=True, header_style="bold magenta")
            table.add_column("统计项", style="cyan")
            table.add_column("数值", justify="right", style="green")
            table.add_row("总订单数", f"{summary_data.get('total_orders', 0)} 笔")
            table.add_row("有效订单", f"{summary_data.get('valid_orders', 0)} 笔")
            table.add_row("发票分组", f"{summary_data.get('total_invoice_groups', 0)} 组")
            table.add_row("异常总数", f"{summary_data.get('total_issues', 0)} 个")
            table.add_row("未解决异常", f"{summary_data.get('unresolved_issues', 0)} 个")
            table.add_row("开票总金额", f"{summary_data.get('total_amount', 0):,.2f} 元")
            table.add_row("人工调整", f"{summary_data.get('adjustment_count', 0)} 次")
            console.print(table)

        if view_type in ["all", "issues"]:
            console.print()
            if issues:
                table = Table(title="异常记录", show_header=True, header_style="bold magenta")
                table.add_column("类型", style="cyan")
                table.add_column("严重程度", style="yellow")
                table.add_column("订单ID", style="white")
                table.add_column("异常信息", style="white", overflow="fold")
                for issue in issues:
                    table.add_row(
                        issue.type.value if hasattr(issue.type, 'value') else str(issue.type),
                        issue.severity,
                        issue.order_id or "-",
                        issue.message,
                    )
                console.print(table)
            else:
                print_success("没有异常")

        if view_type in ["all", "groups"]:
            console.print()
            if invoice_groups:
                table = Table(title="发票分组", show_header=True, header_style="bold magenta")
                table.add_column("分组ID", style="cyan")
                table.add_column("抬头", style="green")
                table.add_column("类型", style="yellow")
                table.add_column("税率", style="blue")
                table.add_column("订单数", justify="right")
                table.add_column("净金额", justify="right", style="green")
                for group in invoice_groups:
                    adjusted_mark = " [red](调整)[/red]" if group.is_adjusted else ""
                    table.add_row(
                        f"{group.group_id}{adjusted_mark}",
                        group.header_name,
                        group.header_type.value,
                        f"{float(group.tax_rate) * 100}%",
                        str(len(group.order_ids)),
                        f"{float(group.net_amount):,.2f}",
                    )
                console.print(table)
            else:
                print_warning("没有发票分组")

    except Exception as e:
        print_error(f"查看失败: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


@cli.command("generate-samples")
@click.option("--output-dir", "-o", required=True, help="样例文件输出目录")
def generate_samples(output_dir: str):
    """生成样例数据文件

    创建包含各种场景的样例数据文件，包括：
    - 企业抬头和个人抬头
    - 部分退款和全额退款
    - 不同税率商品（税率冲突）
    - 抬头缺失的订单
    - 重复开票的订单
    - 类目没有税率的商品
    """
    print_header("生成样例数据")

    try:
        os.makedirs(output_dir, exist_ok=True)

        print_info(f"生成样例文件到: {output_dir}")

        import pandas as pd
        from datetime import datetime, timedelta

        base_date = datetime.now()

        headers_df = pd.DataFrame([
            {"header_id": "H001", "name": "北京科技有限公司", "type": "企业",
             "tax_number": "91110105MA00ABC123", "address": "北京市朝阳区xxx路xxx号",
             "phone": "010-12345678", "bank_name": "中国工商银行北京分行",
             "bank_account": "6222020000000000001", "email": "finance@tech.com", "is_valid": "true"},
            {"header_id": "H002", "name": "上海贸易有限公司", "type": "企业",
             "tax_number": "91310101MA00DEF456", "address": "上海市黄浦区yyy路yyy号",
             "phone": "021-87654321", "bank_name": "中国建设银行上海分行",
             "bank_account": "6217000000000000002", "email": "finance@trade.com", "is_valid": "true"},
            {"header_id": "H003", "name": "张三", "type": "个人", "email": "zhangsan@example.com", "is_valid": "true"},
            {"header_id": "H004", "name": "李四", "type": "个人", "email": "lisi@example.com", "is_valid": "true"},
            {"header_id": "H005", "name": "无效测试公司", "type": "企业", "is_valid": "false"},
        ])
        headers_path = os.path.join(output_dir, "headers.csv")
        headers_df.to_csv(headers_path, index=False)
        print_success(f"  发票抬头: {headers_path}")

        categories_df = pd.DataFrame([
            {"category_id": "C001", "name": "电子产品", "tax_rate": 0.13, "description": "电子设备及配件"},
            {"category_id": "C002", "name": "图书音像", "tax_rate": 0.09, "description": "图书、音像制品"},
            {"category_id": "C003", "name": "食品饮料", "tax_rate": 0.09, "description": "食品、饮料、烟酒"},
            {"category_id": "C004", "name": "服务类", "tax_rate": 0.06, "description": "各类服务"},
            {"category_id": "C005", "name": "未知类目", "description": "未分类商品，税率未定义"},
        ])
        categories_path = os.path.join(output_dir, "categories.csv")
        categories_df.to_csv(categories_path, index=False)
        print_success(f"  商品类目: {categories_path}")

        orders_df = pd.DataFrame([
            {"order_id": "ORD001", "platform": "天猫", "order_date": base_date - timedelta(days=3),
             "header_id": "H001", "header_type": "企业", "total_amount": 3390.00, "has_invoiced": "false"},
            {"order_id": "ORD002", "platform": "京东", "order_date": base_date - timedelta(days=2),
             "header_id": "H002", "header_type": "企业", "total_amount": 565.00, "has_invoiced": "false"},
            {"order_id": "ORD003", "platform": "拼多多", "order_date": base_date - timedelta(days=2),
             "header_id": "H003", "header_type": "个人", "total_amount": 226.00, "has_invoiced": "false"},
            {"order_id": "ORD004", "platform": "天猫", "order_date": base_date - timedelta(days=1),
             "header_id": "H001", "header_type": "企业", "total_amount": 1356.00, "has_invoiced": "false"},
            {"order_id": "ORD005", "platform": "京东", "order_date": base_date - timedelta(days=1),
             "header_name": "王五", "header_type": "个人", "total_amount": 113.00, "has_invoiced": "false"},
            {"order_id": "ORD006", "platform": "淘宝", "order_date": base_date - timedelta(days=5),
             "header_type": "", "total_amount": 565.00, "has_invoiced": "false"},
            {"order_id": "ORD007", "platform": "天猫", "order_date": base_date - timedelta(days=10),
             "header_id": "H002", "header_type": "企业", "total_amount": 1130.00,
             "has_invoiced": "true", "invoice_ids": "INV2024001"},
            {"order_id": "ORD008", "platform": "京东", "order_date": base_date - timedelta(days=4),
             "header_id": "H004", "header_type": "个人", "total_amount": 2260.00, "has_invoiced": "false"},
        ])
        orders_path = os.path.join(output_dir, "orders.csv")
        orders_df.to_csv(orders_path, index=False)
        print_success(f"  订单: {orders_path}")

        order_items_df = pd.DataFrame([
            {"item_id": "ITEM001", "order_id": "ORD001", "product_name": "智能手机",
             "category_id": "C001", "category_name": "电子产品", "quantity": 1,
             "unit_price": 2260.00, "amount": 2260.00, "tax_rate": 0.13},
            {"item_id": "ITEM002", "order_id": "ORD001", "product_name": "编程入门书籍",
             "category_id": "C002", "category_name": "图书音像", "quantity": 10,
             "unit_price": 113.00, "amount": 1130.00, "tax_rate": 0.09},
            {"item_id": "ITEM003", "order_id": "ORD002", "product_name": "蓝牙耳机",
             "category_id": "C001", "category_name": "电子产品", "quantity": 5,
             "unit_price": 113.00, "amount": 565.00, "tax_rate": 0.13},
            {"item_id": "ITEM004", "order_id": "ORD003", "product_name": "数据线",
             "category_id": "C001", "category_name": "电子产品", "quantity": 2,
             "unit_price": 113.00, "amount": 226.00, "tax_rate": 0.13},
            {"item_id": "ITEM005", "order_id": "ORD004", "product_name": "平板电脑",
             "category_id": "C001", "category_name": "电子产品", "quantity": 1,
             "unit_price": 1130.00, "amount": 1130.00, "tax_rate": 0.13},
            {"item_id": "ITEM006", "order_id": "ORD004", "product_name": "技术咨询服务",
             "category_id": "C004", "category_name": "服务类", "quantity": 1,
             "unit_price": 212.00, "amount": 212.00, "tax_rate": 0.06,
             "refunded_quantity": 1, "refunded_amount": 212.00},
            {"item_id": "ITEM007", "order_id": "ORD005", "product_name": "茶叶礼盒",
             "category_id": "C003", "category_name": "食品饮料", "quantity": 1,
             "unit_price": 109.00, "amount": 109.00, "tax_rate": 0.09},
            {"item_id": "ITEM008", "order_id": "ORD005", "product_name": "神秘商品",
             "category_id": "C005", "category_name": "未知类目", "quantity": 1,
             "unit_price": 4.00, "amount": 4.00},
            {"item_id": "ITEM009", "order_id": "ORD006", "product_name": "键盘",
             "category_id": "C001", "category_name": "电子产品", "quantity": 5,
             "unit_price": 113.00, "amount": 565.00, "tax_rate": 0.13},
            {"item_id": "ITEM010", "order_id": "ORD007", "product_name": "显示器",
             "category_id": "C001", "category_name": "电子产品", "quantity": 1,
             "unit_price": 1130.00, "amount": 1130.00, "tax_rate": 0.13},
            {"item_id": "ITEM011", "order_id": "ORD008", "product_name": "智能手表",
             "category_id": "C001", "category_name": "电子产品", "quantity": 2,
             "unit_price": 1130.00, "amount": 2260.00, "tax_rate": 0.13,
             "refunded_quantity": 1, "refunded_amount": 1130.00},
        ])
        order_items_path = os.path.join(output_dir, "order_items.csv")
        order_items_df.to_csv(order_items_path, index=False)
        print_success(f"  订单项: {order_items_path}")

        refunds_df = pd.DataFrame([
            {"refund_id": "REF001", "order_id": "ORD004", "refund_date": base_date - timedelta(hours=12),
             "refund_type": "部分退款", "amount": 212.00, "item_id": "ITEM006",
             "reason": "服务取消", "is_processed": "true"},
            {"refund_id": "REF002", "order_id": "ORD008", "refund_date": base_date - timedelta(days=2),
             "refund_type": "部分退款", "amount": 1130.00, "item_id": "ITEM011",
             "reason": "商品质量问题，退回1个", "is_processed": "true"},
            {"refund_id": "REF003", "order_id": "ORD001", "refund_date": base_date - timedelta(hours=6),
             "refund_type": "售后申请", "amount": 500.00,
             "reason": "用户申请退款，待处理", "is_processed": "false"},
        ])
        refunds_path = os.path.join(output_dir, "refunds.csv")
        refunds_df.to_csv(refunds_path, index=False)
        print_success(f"  退款记录: {refunds_path}")

        console.print()
        print_success("所有样例文件生成完成!")
        console.print()
        print_info("样例包含以下场景:")
        console.print("  • 企业抬头 (ORD001, ORD002, ORD004, ORD007)")
        console.print("  • 个人抬头 (ORD003, ORD005, ORD008)")
        console.print("  • 抬头缺失 (ORD006)")
        console.print("  • 不同税率混单 (ORD001: 13%电子产品 + 9%图书)")
        console.print("  • 部分退款 (ORD004, ORD008)")
        console.print("  • 未处理退款 (REF003)")
        console.print("  • 重复开票检测 (ORD007已开票)")
        console.print("  • 类目无税率 (C005未知类目)")
        console.print()
        print_info("使用以下命令进行拆票分析:")
        console.print(f"  invoice-splitter split -o {orders_path} -i {order_items_path} -H {headers_path} -c {categories_path} -r {refunds_path} -O {os.path.join(output_dir, 'report.xlsx')}")

    except Exception as e:
        print_error(f"生成失败: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


def main():
    cli()


if __name__ == "__main__":
    main()
