import os
import sys
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel

from .models import IssueSeverity
from .parsers import (
    InvoiceParser, PurchaseOrderParser, ReceiptParser, PaymentParser,
    RulesParser, get_default_rules
)
from .rules_engine import RulesEngine
from .matcher import DocumentMatcher
from .exporter import ReportExporter


console = Console()


SAMPLE_INVOICES = """invoice_number,vendor_id,vendor_name,amount,tax_amount,total_amount,currency,tax_rate,date,po_number,is_split,is_merged,split_from,merged_invoices
INV-2024-001,V001,华为技术有限公司,10000.00,1300.00,11300.00,CNY,0.13,2024-01-15,PO-2024-001,false,false,,
INV-2024-002,V001,华为技术有限公司,8000.00,1040.00,9040.00,CNY,0.13,2024-01-18,PO-2024-002,false,false,,
INV-2024-003,V002,中兴通讯股份有限公司,5000.00,650.00,5650.00,CNY,0.13,2024-01-20,PO-2024-003,true,false,INV-2024-003-ORIG,
INV-2024-004,V003,阿里巴巴集团,,1200.00,10200.00,CNY,,2024-01-22,PO-2024-004,false,false,,
INV-2024-005,V004,腾讯科技,15000.00,900.00,15900.00,CNY,0.06,2024-01-25,PO-2024-005,false,false,,
INV-2024-006,V001,华为技术有限公司,20000.00,2600.00,22600.00,USD,0.13,2024-01-28,PO-2024-006,false,false,,
"""

SAMPLE_PO_LINES = """po_number,po_line_number,vendor_id,vendor_name,item_code,item_description,quantity,unit_price,currency,tax_rate,date
PO-2024-001,1,V001,华为技术有限公司,MAT001,服务器主机,2,5000.00,CNY,0.13,2024-01-10
PO-2024-002,1,V001,华为技术有限公司,MAT002,网络交换机,4,2000.00,CNY,0.13,2024-01-12
PO-2024-003,1,V002,中兴通讯股份有限公司,MAT003,路由器,1,10000.00,CNY,0.13,2024-01-15
PO-2024-004,1,V003,阿里巴巴集团,MAT004,云服务套餐,1,9000.00,CNY,0.13,2024-01-18
PO-2024-005,1,V004,腾讯科技,MAT005,软件许可,3,5000.00,CNY,0.06,2024-01-20
PO-2024-006,1,V001,华为技术有限公司,MAT006,存储设备,1,20000.00,CNY,0.13,2024-01-22
PO-2024-007,1,V005,字节跳动,MAT007,办公电脑,10,5000.00,CNY,0.13,2024-01-25
"""

SAMPLE_RECEIPTS = """{"receipt_number": "REC-2024-001", "po_number": "PO-2024-001", "po_line_number": 1, "vendor_id": "V001", "vendor_name": "华为技术有限公司", "item_code": "MAT001", "received_quantity": 2, "unit_price": 5000.00, "currency": "CNY", "tax_rate": 0.13, "date": "2024-01-14", "warehouse": "WH-A"}
{"receipt_number": "REC-2024-002", "po_number": "PO-2024-002", "po_line_number": 1, "vendor_id": "V001", "vendor_name": "华为技术有限公司", "item_code": "MAT002", "received_quantity": 3, "unit_price": 2000.00, "currency": "CNY", "tax_rate": 0.13, "date": "2024-01-16", "warehouse": "WH-A"}
{"receipt_number": "REC-2024-003", "po_number": "PO-2024-003", "po_line_number": 1, "vendor_id": "V002", "vendor_name": "中兴通讯股份有限公司", "item_code": "MAT003", "received_quantity": 1, "unit_price": 5000.00, "currency": "CNY", "tax_rate": 0.13, "date": "2024-01-19", "warehouse": "WH-B"}
{"receipt_number": "REC-2024-004", "po_number": "PO-2024-004", "po_line_number": 1, "vendor_id": "V003", "vendor_name": "阿里巴巴集团", "item_code": "MAT004", "received_quantity": 1, "unit_price": 9000.00, "currency": "CNY", "tax_rate": 0.13, "date": "2024-01-20", "warehouse": "WH-C"}
{"receipt_number": "REC-2024-005", "po_number": "PO-2024-005", "po_line_number": 1, "vendor_id": "V004", "vendor_name": "腾讯科技", "item_code": "MAT005", "received_quantity": 3, "unit_price": 5000.00, "currency": "CNY", "tax_rate": 0.06, "date": "2024-01-24", "warehouse": "WH-A"}
"""

SAMPLE_PAYMENTS = """payment_number,vendor_id,vendor_name,amount,tax_amount,total_amount,currency,date,invoice_number,payment_method,bank_account,is_cross_month
PAY-2024-001,V001,华为技术有限公司,10000.00,1300.00,11300.00,CNY,2024-01-20,INV-2024-001,电汇,ACC-001,false
PAY-2024-002,V001,华为技术有限公司,8000.00,1040.00,9040.00,CNY,2024-02-05,INV-2024-002,电汇,ACC-001,true
PAY-2024-003,V002,中兴通讯股份有限公司,5000.00,650.00,5650.00,CNY,2024-01-25,INV-2024-003,承兑汇票,ACC-002,false
PAY-2024-004,V004,腾讯科技,15000.00,900.00,15900.00,CNY,2024-01-28,INV-2024-005,银行转账,ACC-001,false
"""

SAMPLE_RULES = """rules:
  - rule_id: R001
    rule_name: 金额一致性校验
    rule_type: amount
    description: 校验发票、采购订单、收货单、付款单的金额是否一致
    severity: critical
    enabled: true
    conditions:
      tolerance: 0.01
      check_tax: true

  - rule_id: R002
    rule_name: 供应商一致性校验
    rule_type: vendor
    description: 校验发票、采购订单、收货单的供应商是否一致
    severity: critical
    enabled: true
    conditions: {}

  - rule_id: R003
    rule_name: 数量一致性校验
    rule_type: quantity
    description: 校验发票明细、采购订单、收货单的数量是否一致
    severity: warning
    enabled: true
    conditions:
      tolerance: 0

  - rule_id: R004
    rule_name: 税率一致性校验
    rule_type: tax_rate
    description: 校验发票、采购订单的税率是否一致
    severity: warning
    enabled: true
    conditions: {}

  - rule_id: R005
    rule_name: 币种一致性校验
    rule_type: currency
    description: 校验所有单据的币种是否一致
    severity: warning
    enabled: true
    conditions: {}

  - rule_id: R006
    rule_name: 日期逻辑校验
    rule_type: date
    description: 校验单据日期的逻辑顺序（订单->收货->发票->付款）
    severity: info
    enabled: true
    conditions:
      allow_cross_month: true

  - rule_id: R007
    rule_name: 必填字段校验
    rule_type: required
    description: 校验币种、税率等必填字段是否缺失
    severity: warning
    enabled: true
    conditions:
      fields: ["currency", "tax_rate"]
"""


def get_sample_data_dir() -> Path:
    return Path.cwd() / "sample_data"


@click.group()
@click.version_option()
def main():
    """四流一致性复核工具 - 校验发票、采购订单、收货单、付款单一致性"""
    pass


@main.command()
@click.option('--output-dir', '-o', 
              type=click.Path(file_okay=False, dir_okay=True, writable=True),
              default='./sample_data',
              help='样例数据输出目录')
@click.option('--force', '-f', is_flag=True, help='覆盖已存在的文件')
def init(output_dir, force):
    """初始化样例数据文件"""
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    files_to_create = [
        ("invoices.csv", SAMPLE_INVOICES),
        ("po_lines.csv", SAMPLE_PO_LINES),
        ("receipts.jsonl", SAMPLE_RECEIPTS),
        ("payments.csv", SAMPLE_PAYMENTS),
        ("rules.yaml", SAMPLE_RULES),
    ]
    
    created_count = 0
    skipped_count = 0
    
    for filename, content in files_to_create:
        file_path = output_path / filename
        
        if file_path.exists() and not force:
            console.print(f"[yellow]跳过: {filename} 已存在 (使用 -f 强制覆盖)[/]")
            skipped_count += 1
            continue
        
        file_path.write_text(content, encoding='utf-8')
        console.print(f"[green]已创建: {file_path}[/]")
        created_count += 1
    
    console.print()
    console.print(Panel.fit(
        f"[bold]样例数据初始化完成[/]\n\n"
        f"创建文件: {created_count} 个\n"
        f"跳过文件: {skipped_count} 个\n\n"
        f"[dim]运行命令: four-flow verify --invoices {output_path}/invoices.csv --po {output_path}/po_lines.csv --receipts {output_path}/receipts.jsonl --payments {output_path}/payments.csv --rules {output_path}/rules.yaml[/]",
        title="成功",
        border_style="green"
    ))


@main.command()
@click.option('--invoices', '-i', 
              type=click.Path(exists=True, file_okay=True, dir_okay=False, readable=True),
              required=True,
              help='发票CSV文件路径')
@click.option('--po', '-p',
              type=click.Path(exists=True, file_okay=True, dir_okay=False, readable=True),
              required=True,
              help='采购订单CSV文件路径')
@click.option('--receipts', '-r',
              type=click.Path(exists=True, file_okay=True, dir_okay=False, readable=True),
              required=True,
              help='收货单JSONL文件路径')
@click.option('--payments', '-y',
              type=click.Path(exists=True, file_okay=True, dir_okay=False, readable=True),
              required=True,
              help='付款单CSV文件路径')
@click.option('--rules', '-l',
              type=click.Path(exists=True, file_okay=True, dir_okay=False, readable=True),
              help='校验规则YAML文件路径 (不提供则使用默认规则)')
@click.option('--output-dir', '-o',
              type=click.Path(file_okay=False, dir_okay=True, writable=True),
              default='./output',
              help='输出目录路径')
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
def verify(invoices, po, receipts, payments, rules, output_dir, verbose):
    """执行四流一致性复核"""
    
    console.print(Panel.fit(
        "[bold]四流一致性复核[/]\n\n"
        f"发票文件: {invoices}\n"
        f"采购订单: {po}\n"
        f"收货单: {receipts}\n"
        f"付款单: {payments}\n"
        f"规则文件: {rules or '使用默认规则'}",
        title="开始复核",
        border_style="blue"
    ))
    
    with console.status("[bold green]正在解析数据...[/]"):
        invoice_list = InvoiceParser.parse_file(invoices)
        po_list = PurchaseOrderParser.parse_file(po)
        receipt_list = ReceiptParser.parse_file(receipts)
        payment_list = PaymentParser.parse_file(payments)
        
        if rules:
            rule_list = RulesParser.parse_file(rules)
        else:
            rule_list = get_default_rules()
    
    console.print(f"[green]✓[/] 解析完成:")
    console.print(f"  - 发票: {len(invoice_list)} 条")
    console.print(f"  - 采购订单行: {len(po_list)} 条")
    console.print(f"  - 收货单: {len(receipt_list)} 条")
    console.print(f"  - 付款单: {len(payment_list)} 条")
    console.print(f"  - 校验规则: {len(rule_list)} 条")
    
    with console.status("[bold green]正在执行规则引擎...[/]"):
        rules_engine = RulesEngine(rule_list)
        matcher = DocumentMatcher(rules_engine)
    
    with console.status("[bold green]正在匹配单据...[/]"):
        match_results, issues = matcher.match_all(
            invoices=invoice_list,
            po_lines=po_list,
            receipts=receipt_list,
            payments=payment_list
        )
    
    matched_count = sum(1 for mr in match_results if mr.is_matched)
    critical_count = sum(1 for i in issues if i.severity == IssueSeverity.CRITICAL)
    warning_count = sum(1 for i in issues if i.severity == IssueSeverity.WARNING)
    info_count = sum(1 for i in issues if i.severity == IssueSeverity.INFO)
    
    console.print()
    console.print("[bold]复核结果统计:[/]")
    
    result_table = Table(show_header=False, box=None)
    result_table.add_column("项", style="dim")
    result_table.add_column("值", style="bold")
    
    result_table.add_row("匹配组总数", str(len(match_results)))
    result_table.add_row("完全匹配", f"[green]{matched_count}[/]")
    result_table.add_row("部分匹配", f"[yellow]{len(match_results) - matched_count}[/]")
    result_table.add_row("", "")
    result_table.add_row("问题总数", str(len(issues)))
    result_table.add_row("严重问题", f"[red]{critical_count}[/]")
    result_table.add_row("警告问题", f"[yellow]{warning_count}[/]")
    result_table.add_row("提示信息", f"[blue]{info_count}[/]")
    
    console.print(result_table)
    
    if critical_count > 0:
        console.print(f"\n[red bold]⚠ 发现 {critical_count} 个严重问题，请优先处理！[/]")
    elif warning_count > 0:
        console.print(f"\n[yellow bold]⚠ 发现 {warning_count} 个警告问题，建议核查。[/]")
    else:
        console.print(f"\n[green bold]✓ 所有单据匹配良好！[/]")
    
    with console.status("[bold green]正在导出报告...[/]"):
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)
        
        exporter = ReportExporter(
            invoices=invoice_list,
            po_lines=po_list,
            receipts=receipt_list,
            payments=payment_list,
            match_results=match_results,
            issues=issues
        )
        
        report_path = output_path / "mismatch_report.md"
        issues_path = output_path / "issues.csv"
        timeline_path = output_path / "timeline.html"
        
        exporter.export_mismatch_report(str(report_path))
        exporter.export_issues_csv(str(issues_path))
        exporter.export_timeline_html(str(timeline_path))
    
    console.print()
    console.print("[bold]输出文件:[/]")
    console.print(f"  [green]✓[/] 不匹配报告: {report_path}")
    console.print(f"  [green]✓[/] 问题清单: {issues_path}")
    console.print(f"  [green]✓[/] 时间线/关系图: {timeline_path}")
    
    console.print()
    console.print(f"[dim]提示: 使用浏览器打开 {timeline_path} 查看可视化图表[/]")
    
    if verbose and issues:
        console.print()
        console.print(Panel.fit("[bold]详细问题列表[/]", title="详情", border_style="yellow"))
        
        for idx, issue in enumerate(issues, 1):
            severity_color = {
                IssueSeverity.CRITICAL: "red",
                IssueSeverity.WARNING: "yellow",
                IssueSeverity.INFO: "blue"
            }.get(issue.severity, "white")
            
            console.print(f"\n[{severity_color}][{issue.severity.value.upper()}][/{severity_color}] {issue.description}")
            console.print(f"  单据: {issue.primary_doc_id} ({issue.primary_doc_type.value})")
            if issue.expected_value is not None:
                console.print(f"  期望: {issue.expected_value}")
            if issue.actual_value is not None:
                console.print(f"  实际: {issue.actual_value}")
            if issue.difference is not None:
                console.print(f"  差异: {issue.difference}")
    
    sys.exit(1 if critical_count > 0 else 0)


if __name__ == '__main__':
    main()
