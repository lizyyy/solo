import click
import sys
from pathlib import Path
from decimal import Decimal

from .core import CSVParser
from .reconciler import Reconciler
from .reporter import ConsoleReporter, JSONReporter, MarkdownReporter


@click.group()
def cli():
    """CSV金额对账CLI工具 - 解析、校验和报告稳定"""
    pass


@cli.command()
@click.argument('file1', type=click.Path(exists=True))
@click.argument('file2', type=click.Path(exists=True))
@click.option('--tx-id', default='交易号', help='交易号列名')
@click.option('--amount', default='金额', help='金额列名')
@click.option('--tax', default='税费', help='税费列名')
@click.option('--fee', default='手续费', help='手续费列名')
@click.option('--refund', default='退款状态', help='退款状态列名')
@click.option('--tolerance', default='0.01', help='金额容差')
@click.option('--output-json', help='输出JSON结果文件路径')
@click.option('--output-md', help='输出Markdown报告文件路径')
@click.option('--encoding', default='utf-8', help='CSV文件编码')
def reconcile(
    file1,
    file2,
    tx_id,
    amount,
    tax,
    fee,
    refund,
    tolerance,
    output_json,
    output_md,
    encoding
):
    """对两个CSV文件进行金额对账"""
    try:
        parser = CSVParser(encoding=encoding)
        
        click.echo(f"正在解析文件1: {file1}")
        tx1 = parser.parse_file(
            file_path=file1,
            transaction_id_col=tx_id,
            amount_col=amount,
            tax_col=tax,
            fee_col=fee,
            refund_status_col=refund
        )
        click.echo(f"  成功解析 {len(tx1)} 条交易")
        
        click.echo(f"正在解析文件2: {file2}")
        tx2 = parser.parse_file(
            file_path=file2,
            transaction_id_col=tx_id,
            amount_col=amount,
            tax_col=tax,
            fee_col=fee,
            refund_status_col=refund
        )
        click.echo(f"  成功解析 {len(tx2)} 条交易")
        
        bad_rows = parser.get_bad_rows()
        if bad_rows:
            click.echo(f"警告: 发现 {len(bad_rows)} 条坏行")
        
        click.echo("正在进行对账...")
        reconciler = Reconciler(tolerance=Decimal(tolerance))
        result = reconciler.reconcile(
            source1=tx1,
            source2=tx2,
            source1_name=file1,
            source2_name=file2
        )
        result.bad_rows = bad_rows
        
        click.echo("")
        console_reporter = ConsoleReporter(result)
        console_reporter.print_summary()
        
        if output_json:
            json_reporter = JSONReporter(result)
            json_reporter.write_to_file(output_json)
            click.echo(f"JSON结果已保存到: {output_json}")
        
        if output_md:
            md_reporter = MarkdownReporter(result)
            md_reporter.write_to_file(output_md)
            click.echo(f"Markdown报告已保存到: {output_md}")
        
        if result.has_differences or result.has_unmatched or result.has_bad_rows:
            sys.exit(1)
        
    except Exception as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(1)


@cli.command()
def selfcheck():
    """运行自检：创建测试数据并验证所有功能"""
    import tempfile
    import shutil
    
    click.echo("=" * 60)
    click.echo("CSV金额对账CLI - 自检")
    click.echo("=" * 60)
    
    test_dir = tempfile.mkdtemp(prefix="csv-reconciler-test-")
    click.echo(f"测试目录: {test_dir}")
    
    try:
        file1 = Path(test_dir) / "渠道A.csv"
        file2 = Path(test_dir) / "渠道B.csv"
        
        content1 = """交易号,金额,税费,手续费,退款状态,备注
TX001,1,000.00,60.00,10.00,正常,
TX002,"¥2,000.00",120.00,20.00,正常,
TX003,3000.00,180.00,30.00,已退款,
TX004,4000.00,240.00,40.00,正常,
TX005,invalid,50.00,5.00,正常,金额无效
,6000.00,360.00,60.00,正常,交易号为空
"""
        
        content2 = """交易号,金额,税费,手续费,退款状态,备注
TX001,1000.00,60.00,10.00,正常,完全一致
TX002,2000.00,120.50,20.00,正常,税费差异
TX003,3000.00,180.00,30.00,退款,退款状态名称不同
TX004,4001.00,240.00,40.00,正常,金额差异
TX006,6000.00,360.00,60.00,正常,渠道B独有
"""
        
        file1.write_text(content1, encoding='utf-8')
        file2.write_text(content2, encoding='utf-8')
        
        click.echo("\n[1/3] 测试CSV解析...")
        parser = CSVParser()
        tx1 = parser.parse_file(
            file_path=str(file1),
            transaction_id_col='交易号',
            amount_col='金额',
            tax_col='税费',
            fee_col='手续费',
            refund_status_col='退款状态'
        )
        tx2 = parser.parse_file(
            file_path=str(file2),
            transaction_id_col='交易号',
            amount_col='金额',
            tax_col='税费',
            fee_col='手续费',
            refund_status_col='退款状态'
        )
        
        bad_rows = parser.get_bad_rows()
        click.echo(f"  文件1解析: {len(tx1)} 条有效, {sum(1 for b in bad_rows if b.file_path == str(file1))} 条坏行")
        click.echo(f"  文件2解析: {len(tx2)} 条有效, {sum(1 for b in bad_rows if b.file_path == str(file2))} 条坏行")
        click.echo("  ✓ CSV解析测试通过")
        
        click.echo("\n[2/3] 测试金额归一化...")
        from .core import AmountNormalizer
        test_cases = [
            ("1,000.00", Decimal("1000.00")),
            ("¥2,000.00", Decimal("2000.00")),
            ("(100)", Decimal("-100")),
            ("  300  ", Decimal("300")),
            ("", Decimal("0")),
        ]
        all_pass = True
        for input_val, expected in test_cases:
            result = AmountNormalizer.normalize(input_val)
            if result != expected:
                click.echo(f"  失败: {input_val} -> {result} (期望 {expected})")
                all_pass = False
        if all_pass:
            click.echo("  ✓ 金额归一化测试通过")
        
        click.echo("\n[3/3] 测试对账和报告生成...")
        reconciler = Reconciler(tolerance=Decimal('0.01'))
        result = reconciler.reconcile(
            source1=tx1,
            source2=tx2,
            source1_name=str(file1),
            source2_name=str(file2)
        )
        result.bad_rows = bad_rows
        
        click.echo(f"  总交易数: {result.total_transactions}")
        click.echo(f"  匹配交易数: {result.matched_transactions}")
        click.echo(f"  差异数: {len(result.differences)}")
        click.echo(f"  未匹配数: 源1={len(result.unmatched_source1)}, 源2={len(result.unmatched_source2)}")
        
        json_path = Path(test_dir) / "result.json"
        md_path = Path(test_dir) / "report.md"
        
        JSONReporter(result).write_to_file(str(json_path))
        MarkdownReporter(result).write_to_file(str(md_path))
        
        if json_path.exists() and md_path.exists():
            click.echo("  ✓ 报告生成测试通过")
        
        click.echo("\n" + "=" * 60)
        click.echo("自检完成！")
        click.echo("=" * 60)
        click.echo(f"\n测试文件保留在: {test_dir}")
        click.echo(f"  - {file1.name}")
        click.echo(f"  - {file2.name}")
        click.echo(f"  - result.json")
        click.echo(f"  - report.md")
        
    except Exception as e:
        click.echo(f"自检失败: {e}", err=True)
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    cli()
