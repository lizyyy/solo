"""命令行接口 - 电子回单归档核验员"""

import json
import os
from datetime import date
from pathlib import Path
from typing import List, Optional

import click

from . import __version__
from .archiver import ArchiveManager, archive_valid_receipts
from .list_parser import (
    ListImporter,
    import_erp_payments,
    import_invoices,
    import_suppliers,
)
from .models import (
    ERPPayment,
    InvoiceItem,
    PaymentVerification,
    ReceiptInfo,
    SupplierLedger,
    VerificationResult,
    VerificationStatus,
)
from .pdf_parser import PDFReceiptParser, parse_pdf_receipt
from .reporter import ReportGenerator, generate_audit_report
from .scanner import DirectoryScanner, scan_directory
from .validator import PaymentVerifier, verify_payments


@click.group()
@click.version_option(version=__version__, prog_name="receipt-verifier")
@click.pass_context
def main(ctx: click.Context) -> None:
    """电子回单归档核验员 - 小公司财务出纳自动化工具

    用于月底核对网银回单 PDF、ERP 付款导出、发票清单和供应商台账。
    """
    ctx.ensure_object(dict)


@main.command()
@click.argument("directory", type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option("-o", "--output", type=click.Path(), help="输出 JSON 文件路径")
@click.option("--recursive/--no-recursive", default=True, help="是否递归扫描子目录")
@click.option("--hash-algo", type=click.Choice(["md5", "sha1", "sha256", "sha512"]), default="sha256", help="哈希算法")
@click.option("--show-stats", is_flag=True, help="显示统计信息")
def scan(
    directory: str,
    output: Optional[str],
    recursive: bool,
    hash_algo: str,
    show_stats: bool,
) -> None:
    """扫描目录并计算文件哈希

    DIRECTORY: 要扫描的目录路径
    """
    click.echo(f"正在扫描目录: {directory}")
    click.echo(f"递归扫描: {'是' if recursive else '否'}")
    click.echo(f"哈希算法: {hash_algo}")
    click.echo("")

    scanner = DirectoryScanner(
        directory=directory,
        recursive=recursive,
        hash_algorithm=hash_algo,
    )

    if output:
        files = scanner.scan_and_save(output)
        click.echo(f"扫描结果已保存到: {output}")
    else:
        files = scanner.scan()

    click.echo(f"扫描完成，共发现 {len(files)} 个文件")

    if show_stats:
        stats = DirectoryScanner.get_file_stats(files)
        click.echo("")
        click.echo("统计信息:")
        click.echo(f"  总文件数: {stats['total_files']}")
        click.echo(f"  总大小: {stats['total_size_mb']} MB")
        click.echo(f"  文件类型分布:")
        for file_type, count in stats['file_type_counts'].items():
            click.echo(f"    {file_type}: {count} 个")

        duplicates = DirectoryScanner.find_duplicates(files)
        if duplicates:
            click.echo("")
            click.echo(f"⚠️  发现 {len(duplicates)} 组重复文件:")
            for i, group in enumerate(duplicates, 1):
                click.echo(f"  第 {i} 组 ({len(group)} 个文件):")
                for f in group:
                    click.echo(f"    - {f.file_path}")
        else:
            click.echo("")
            click.echo("✅ 未发现重复文件")


@main.command()
@click.option("--erp", type=click.Path(exists=True, dir_okay=False), help="ERP 付款 CSV 文件路径")
@click.option("--invoice", type=click.Path(exists=True, dir_okay=False), help="发票清单 JSON/CSV 文件路径")
@click.option("--supplier", type=click.Path(exists=True, dir_okay=False), help="供应商台账 CSV/Excel 文件路径")
@click.option("-o", "--output", type=click.Path(), help="输出目录（保存解析结果为 JSON）")
@click.option("--show-summary", is_flag=True, help="显示摘要信息")
def import_list(
    erp: Optional[str],
    invoice: Optional[str],
    supplier: Optional[str],
    output: Optional[str],
    show_summary: bool,
) -> None:
    """导入三类清单（ERP付款、发票清单、供应商台账）"""
    importer = ListImporter()

    results = {}

    if erp:
        click.echo(f"正在导入 ERP 付款记录: {erp}")
        payments = importer.import_erp_payments(erp)
        results['erp_payments'] = [
            {
                'payment_id': p.payment_id,
                'payee_name': p.payee_name,
                'payee_account': p.payee_account,
                'amount': str(p.amount),
                'payment_date': str(p.payment_date) if p.payment_date else None,
                'invoice_number': p.invoice_number,
                'supplier_code': p.supplier_code,
                'department': p.department,
                'remark': p.remark,
            }
            for p in payments
        ]
        click.echo(f"  导入了 {len(payments)} 条付款记录")

    if invoice:
        click.echo(f"正在导入发票清单: {invoice}")
        invoices = importer.import_invoices(invoice)
        results['invoices'] = [
            {
                'invoice_number': inv.invoice_number,
                'invoice_date': str(inv.invoice_date) if inv.invoice_date else None,
                'amount': str(inv.amount),
                'tax_amount': str(inv.tax_amount),
                'total_amount': str(inv.total_amount),
                'supplier_name': inv.supplier_name,
                'supplier_tax_id': inv.supplier_tax_id,
                'goods_name': inv.goods_name,
                'payment_id': inv.payment_id,
            }
            for inv in invoices
        ]
        click.echo(f"  导入了 {len(invoices)} 张发票")

    if supplier:
        click.echo(f"正在导入供应商台账: {supplier}")
        suppliers = importer.import_suppliers(supplier)
        results['suppliers'] = [
            {
                'supplier_code': s.supplier_code,
                'supplier_name': s.supplier_name,
                'bank_account': s.bank_account,
                'bank_name': s.bank_name,
                'tax_id': s.tax_id,
                'contact_person': s.contact_person,
                'contact_phone': s.contact_phone,
                'address': s.address,
            }
            for s in suppliers
        ]
        click.echo(f"  导入了 {len(suppliers)} 个供应商")

    if output and results:
        output_path = Path(output)
        if output_path.is_dir() or not output_path.suffix:
            output_path = output_path / "imported_data.json"

        output_path.parent.mkdir(parents=True, exist_ok=True)

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        click.echo(f"")
        click.echo(f"解析结果已保存到: {output_path}")


@main.command()
@click.option("--receipts-dir", type=click.Path(exists=True, file_okay=False), help="回单 PDF 目录")
@click.option("--erp", type=click.Path(exists=True, dir_okay=False), help="ERP 付款 CSV 文件")
@click.option("--invoice", type=click.Path(exists=True, dir_okay=False), help="发票清单 JSON/CSV 文件")
@click.option("--supplier", type=click.Path(exists=True, dir_okay=False), help="供应商台账 CSV/Excel 文件")
@click.option("--period-start", type=click.DateTime(formats=["%Y-%m-%d"]), help="账期开始日期 (YYYY-MM-DD)")
@click.option("--period-end", type=click.DateTime(formats=["%Y-%m-%d"]), help="账期结束日期 (YYYY-MM-DD)")
@click.option("-o", "--output", type=click.Path(), help="输出校验结果 JSON 文件")
@click.option("--show-details", is_flag=True, help="显示详细校验结果")
def check(
    receipts_dir: Optional[str],
    erp: Optional[str],
    invoice: Optional[str],
    supplier: Optional[str],
    period_start: Optional[click.DateTime],
    period_end: Optional[click.DateTime],
    output: Optional[str],
    show_details: bool,
) -> None:
    """校验付款金额、账号尾号、发票号、日期窗口、重复回单和缺失凭证"""
    receipts: List[ReceiptInfo] = []
    erp_payments: List[ERPPayment] = []
    invoices: List[InvoiceItem] = []
    suppliers: List[SupplierLedger] = []

    if receipts_dir:
        click.echo(f"正在解析回单目录: {receipts_dir}")
        scanner = DirectoryScanner(receipts_dir)
        scanned_files = scanner.scan()

        pdf_files = [f for f in scanned_files if f.file_name.lower().endswith('.pdf')]
        click.echo(f"  发现 {len(pdf_files)} 个 PDF 文件")

        parser = PDFReceiptParser()
        from tqdm import tqdm
        for scanned in tqdm(pdf_files, desc="解析回单"):
            try:
                receipt = parser.parse(scanned.file_path)
                receipts.append(receipt)
            except Exception as e:
                click.echo(f"警告: 无法解析 {scanned.file_path}: {e}")

        click.echo(f"  成功解析 {len(receipts)} 个回单")

    if erp:
        click.echo(f"正在加载 ERP 付款记录: {erp}")
        erp_payments = import_erp_payments(erp)
        click.echo(f"  加载 {len(erp_payments)} 条记录")

    if invoice:
        click.echo(f"正在加载发票清单: {invoice}")
        invoices = import_invoices(invoice)
        click.echo(f"  加载 {len(invoices)} 张发票")

    if supplier:
        click.echo(f"正在加载供应商台账: {supplier}")
        suppliers = import_suppliers(supplier)
        click.echo(f"  加载 {len(suppliers)} 个供应商")

    click.echo("")
    click.echo("开始执行校验...")

    start_date = period_start.date() if period_start else None
    end_date = period_end.date() if period_end else None

    verifier = PaymentVerifier(
        receipts=receipts,
        erp_payments=erp_payments,
        invoices=invoices,
        suppliers=suppliers,
    )

    verification_results = verifier.verify()
    summary = verifier.get_summary()

    click.echo("")
    click.echo("=" * 50)
    click.echo("校验结果摘要")
    click.echo("=" * 50)
    click.echo(f"总校验项: {summary['total_checks']}")
    click.echo(f"✅ 通过: {summary['passed']}")
    click.echo(f"❌ 失败: {summary['failed']}")
    click.echo(f"⚠️ 警告: {summary['warning']}")
    click.echo("")
    click.echo(f"回单总数: {summary['total_receipts']}")
    click.echo(f"重复回单组数: {summary['duplicate_receipts_count']}")
    click.echo(f"ERP付款记录数: {summary['total_erp_payments']}")
    click.echo(f"发票数: {summary['total_invoices']}")
    click.echo(f"供应商数: {summary['total_suppliers']}")

    if show_details:
        click.echo("")
        click.echo("详细校验结果:")
        click.echo("-" * 50)

        for result in verification_results:
            if result.status == VerificationStatus.FAILED:
                status_icon = "❌"
            elif result.status == VerificationStatus.WARNING:
                status_icon = "⚠️"
            else:
                status_icon = "✅"

            click.echo(f"{status_icon} [{result.rule_name}] {result.message}")

    if output:
        output_path = Path(output)
        if output_path.is_dir() or not output_path.suffix:
            output_path = output_path / "verification_results.json"

        output_path.parent.mkdir(parents=True, exist_ok=True)

        def convert_obj(obj):
            if hasattr(obj, '__dataclass_fields__'):
                return {k: convert_obj(v) for k, v in obj.__dict__.items()}
            if hasattr(obj, 'isoformat'):
                return obj.isoformat()
            if hasattr(obj, 'name'):
                return obj.name
            if isinstance(obj, list):
                return [convert_obj(item) for item in obj]
            if isinstance(obj, dict):
                return {k: convert_obj(v) for k, v in obj.items()}
            return str(obj)

        output_data = {
            'summary': summary,
            'results': [convert_obj(r) for r in verification_results],
        }

        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)

        click.echo("")
        click.echo(f"校验结果已保存到: {output_path}")


@main.command()
@click.argument("source_dir", type=click.Path(exists=True, file_okay=False))
@click.argument("target_dir", type=click.Path())
@click.option("--erp", type=click.Path(exists=True, dir_okay=False), required=True, help="ERP 付款 CSV 文件（必需）")
@click.option("--invoice", type=click.Path(exists=True, dir_okay=False), help="发票清单 JSON/CSV 文件")
@click.option("--supplier", type=click.Path(exists=True, dir_okay=False), help="供应商台账 CSV/Excel 文件")
@click.option("--all/--valid-only", default=False, help="是否归档所有文件（默认仅归档校验通过的）")
@click.option("--no-copy", is_flag=True, help="仅生成清单，不实际复制文件")
def archive(
    source_dir: str,
    target_dir: str,
    erp: str,
    invoice: Optional[str],
    supplier: Optional[str],
    all: bool,
    no_copy: bool,
) -> None:
    """按供应商和月份复制合格文件并写 manifest

    SOURCE_DIR: 源目录（包含回单 PDF）
    TARGET_DIR: 目标归档目录
    """
    click.echo(f"源目录: {source_dir}")
    click.echo(f"目标目录: {target_dir}")
    click.echo(f"归档模式: {'所有文件' if all else '仅校验通过的文件'}")
    click.echo("")

    click.echo("步骤 1/4: 解析回单...")
    scanner = DirectoryScanner(source_dir)
    scanned_files = scanner.scan()

    pdf_files = [f for f in scanned_files if f.file_name.lower().endswith('.pdf')]
    click.echo(f"  发现 {len(pdf_files)} 个 PDF 文件")

    parser = PDFReceiptParser()
    receipts: List[ReceiptInfo] = []

    from tqdm import tqdm
    for scanned in tqdm(pdf_files, desc="解析回单"):
        try:
            receipt = parser.parse(scanned.file_path)
            receipts.append(receipt)
        except Exception as e:
            click.echo(f"警告: 无法解析 {scanned.file_path}: {e}")

    click.echo("")
    click.echo("步骤 2/4: 加载清单数据...")

    erp_payments = import_erp_payments(erp)
    click.echo(f"  ERP 付款记录: {len(erp_payments)} 条")

    invoices: List[InvoiceItem] = []
    if invoice:
        invoices = import_invoices(invoice)
        click.echo(f"  发票清单: {len(invoices)} 张")

    suppliers: List[SupplierLedger] = []
    if supplier:
        suppliers = import_suppliers(supplier)
        click.echo(f"  供应商台账: {len(suppliers)} 个")

    click.echo("")
    click.echo("步骤 3/4: 执行校验...")

    verifier = PaymentVerifier(
        receipts=receipts,
        erp_payments=erp_payments,
        invoices=invoices,
        suppliers=suppliers,
    )

    payment_verifications = verifier.verify_by_payment()
    summary = verifier.get_summary()

    click.echo(f"  校验结果: 通过 {summary['passed']}, 失败 {summary['failed']}, 警告 {summary['warning']}")

    click.echo("")
    click.echo("步骤 4/4: 执行归档...")

    if no_copy:
        click.echo("  (仅生成清单模式，不复制文件)")

    manager = ArchiveManager(
        source_directory=source_dir,
        target_directory=target_dir,
        receipts=receipts,
        erp_payments=erp_payments,
        invoices=invoices,
        suppliers=suppliers,
        payment_verifications=payment_verifications,
    )

    result = manager.archive_all(only_valid=not all, show_progress=True)

    click.echo("")
    click.echo("=" * 50)
    click.echo("归档完成")
    click.echo("=" * 50)
    click.echo(f"归档 ID: {result['archive_id']}")
    click.echo(f"归档日期: {result['archive_date']}")
    click.echo(f"目标目录: {result['target_directory']}")
    click.echo("")
    click.echo("统计:")
    click.echo(f"  总回单数: {result['statistics']['total_receipts']}")
    click.echo(f"  已归档: {result['statistics']['archived_receipts']}")
    click.echo(f"  成功: {result['statistics']['success_count']}")
    click.echo(f"  失败: {result['statistics']['failed_count']}")
    click.echo("")
    click.echo(f"清单文件: {result['manifest_path']}")


@main.command()
@click.option("--erp", type=click.Path(exists=True, dir_okay=False), required=True, help="ERP 付款 CSV 文件（必需）")
@click.option("--receipts-dir", type=click.Path(exists=True, file_okay=False), help="回单 PDF 目录")
@click.option("--invoice", type=click.Path(exists=True, dir_okay=False), help="发票清单 JSON/CSV 文件")
@click.option("--supplier", type=click.Path(exists=True, dir_okay=False), help="供应商台账 CSV/Excel 文件")
@click.option("-o", "--output-dir", type=click.Path(), required=True, help="输出目录（必需）")
@click.option("--base-name", type=str, help="报告基础文件名")
@click.option("--period-start", type=click.DateTime(formats=["%Y-%m-%d"]), help="账期开始日期")
@click.option("--period-end", type=click.DateTime(formats=["%Y-%m-%d"]), help="账期结束日期")
def report(
    erp: str,
    receipts_dir: Optional[str],
    invoice: Optional[str],
    supplier: Optional[str],
    output_dir: str,
    base_name: Optional[str],
    period_start: Optional[click.DateTime],
    period_end: Optional[click.DateTime],
) -> None:
    """导出 Markdown、CSV 和 JSON 审计包"""
    click.echo("正在准备报告数据...")

    receipts: List[ReceiptInfo] = []
    if receipts_dir:
        click.echo(f"解析回单目录: {receipts_dir}")
        scanner = DirectoryScanner(receipts_dir)
        scanned_files = scanner.scan()
        pdf_files = [f for f in scanned_files if f.file_name.lower().endswith('.pdf')]

        parser = PDFReceiptParser()
        from tqdm import tqdm
        for scanned in tqdm(pdf_files, desc="解析回单"):
            try:
                receipt = parser.parse(scanned.file_path)
                receipts.append(receipt)
            except Exception as e:
                pass

    erp_payments = import_erp_payments(erp)
    click.echo(f"ERP 付款记录: {len(erp_payments)} 条")

    invoices: List[InvoiceItem] = []
    if invoice:
        invoices = import_invoices(invoice)
        click.echo(f"发票清单: {len(invoices)} 张")

    suppliers: List[SupplierLedger] = []
    if supplier:
        suppliers = import_suppliers(supplier)
        click.echo(f"供应商台账: {len(suppliers)} 个")

    verifier = PaymentVerifier(
        receipts=receipts,
        erp_payments=erp_payments,
        invoices=invoices,
        suppliers=suppliers,
    )

    payment_verifications = verifier.verify_by_payment()

    start_date = period_start.date() if period_start else None
    end_date = period_end.date() if period_end else None

    click.echo("")
    click.echo("生成报告...")

    generator = ReportGenerator(
        payment_verifications=payment_verifications,
        period_start=start_date,
        period_end=end_date,
    )

    output_files = generator.generate_all(output_dir, base_name=base_name)

    click.echo("")
    click.echo("=" * 50)
    click.echo("报告生成完成")
    click.echo("=" * 50)
    click.echo(f"报告 ID: {generator.report_id}")
    click.echo("")
    click.echo("生成的文件:")
    for fmt, path in output_files.items():
        click.echo(f"  - {fmt.upper()}: {path}")


@main.command()
@click.argument("target_dir", type=click.Path())
@click.option("--force", is_flag=True, help="如果目录已存在，强制覆盖")
def demo(target_dir: str, force: bool) -> None:
    """创建示例数据目录结构（用于测试）

    TARGET_DIR: 目标目录路径
    """
    from pathlib import Path
    import shutil

    target = Path(target_dir)

    if target.exists():
        if not force:
            click.echo(f"错误: 目录已存在: {target}")
            click.echo("使用 --force 选项强制覆盖")
            return
        shutil.rmtree(target)

    target.mkdir(parents=True)

    (target / "回单").mkdir()
    (target / "清单").mkdir()
    (target / "归档").mkdir()
    (target / "报告").mkdir()

    erp_content = """付款单号,收款单位,收款账号,金额,付款日期,发票号,供应商编码,备注
PAY001,北京科技有限公司,6222021234567890123,50000.00,2024-01-15,INV202401001,SUP001,办公用品采购
PAY002,上海贸易公司,6222021234567890456,30000.00,2024-01-18,INV202401002,SUP002,原材料采购
PAY003,广州服务有限公司,6222021234567890789,15000.00,2024-01-20,INV202401003,SUP003,服务费
"""

    with open(target / "清单" / "erp_payments.csv", "w", encoding="utf-8") as f:
        f.write(erp_content)

    invoice_content = """[
    {
        "发票号": "INV202401001",
        "开票日期": "2024-01-10",
        "金额": 47169.81,
        "税额": 2830.19,
        "价税合计": 50000.00,
        "供应商": "北京科技有限公司",
        "货物名称": "办公用品"
    },
    {
        "发票号": "INV202401002",
        "开票日期": "2024-01-15",
        "金额": 28301.89,
        "税额": 1698.11,
        "价税合计": 30000.00,
        "供应商": "上海贸易公司",
        "货物名称": "原材料"
    }
]
"""

    with open(target / "清单" / "invoices.json", "w", encoding="utf-8") as f:
        f.write(invoice_content)

    supplier_content = """供应商编码,供应商名称,银行账号,开户银行,税号,联系人,联系电话
SUP001,北京科技有限公司,6222021234567890123,中国工商银行北京分行,91110000MA001ABC12,张三,13800138001
SUP002,上海贸易公司,6222021234567890456,中国工商银行上海分行,91310000MA002DEF34,李四,13800138002
SUP003,广州服务有限公司,6222021234567890789,中国工商银行广州分行,91440000MA003GHI56,王五,13800138003
"""

    with open(target / "清单" / "suppliers.csv", "w", encoding="utf-8") as f:
        f.write(supplier_content)

    readme_content = """示例数据目录结构
================

目录说明:
- 回单/: 存放网银回单 PDF 文件
- 清单/: 存放 ERP 导出、发票清单、供应商台账
- 归档/: 执行 archive 命令后的输出目录
- 报告/: 执行 report 命令后的输出目录

快速开始:
1. 将真实的回单 PDF 放入"回单"目录
2. 或直接使用示例清单进行测试

测试命令示例:
  # 扫描目录
  receipt-verifier scan 回单/ --show-stats

  # 导入清单
  receipt-verifier import-list --erp 清单/erp_payments.csv --invoice 清单/invoices.json --supplier 清单/suppliers.csv

  # 执行校验
  receipt-verifier check --receipts-dir 回单/ --erp 清单/erp_payments.csv --invoice 清单/invoices.json --supplier 清单/suppliers.csv --show-details

  # 归档（需要真实的 PDF 回单文件）
  # receipt-verifier archive 回单/ 归档/ --erp 清单/erp_payments.csv

  # 生成报告
  receipt-verifier report --erp 清单/erp_payments.csv --invoice 清单/invoices.json --supplier 清单/suppliers.csv -o 报告/
"""

    with open(target / "README.txt", "w", encoding="utf-8") as f:
        f.write(readme_content)

    click.echo(f"✅ 示例数据目录已创建: {target}")
    click.echo("")
    click.echo("目录结构:")
    click.echo(f"  {target}/")
    click.echo(f"  ├── 回单/          (放入 PDF 回单)")
    click.echo(f"  ├── 清单/")
    click.echo(f"  │   ├── erp_payments.csv")
    click.echo(f"  │   ├── invoices.json")
    click.echo(f"  │   └── suppliers.csv")
    click.echo(f"  ├── 归档/          (archive 命令输出)")
    click.echo(f"  ├── 报告/          (report 命令输出)")
    click.echo(f"  └── README.txt")
    click.echo("")
    click.echo("测试命令:")
    click.echo(f"  receipt-verifier check --erp {target}/清单/erp_payments.csv --invoice {target}/清单/invoices.json --supplier {target}/清单/suppliers.csv --show-details")


if __name__ == "__main__":
    main()
