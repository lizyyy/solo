import hashlib
import uuid
from datetime import date, datetime
from pathlib import Path
from typing import Optional
import click
from .models import ScanResult, ReportConfig
from .parser import ConfigParser
from .rules import RuleEngine
from .reporter import ReportGenerator


def generate_stable_scan_id(*args) -> str:
    content = "|".join(str(arg) for arg in args)
    hash_obj = hashlib.md5(content.encode())
    return hash_obj.hexdigest()[:12]


@click.group()
@click.version_option()
def cli():
    """数据契约例外到期恢复排查CLI"""
    pass


@cli.command()
@click.option("--contracts", "-c", required=True, help="数据契约文件路径 (JSON/CSV)")
@click.option("--exceptions", "-e", required=True, help="例外规则文件路径 (JSON/CSV)")
@click.option("--hits", "-h", required=True, help="命中记录文件路径 (JSON/CSV)")
@click.option("--output-dir", "-o", default="./reports", help="报告输出目录")
@click.option("--scan-date", "-d", default=None, help="扫描日期 (YYYY-MM-DD)，默认当天")
@click.option("--match-type", "-m", default="exact", type=click.Choice(["exact", "wildcard", "regex"]), help="字段匹配方式")
@click.option("--formats", "-f", multiple=True, default=["json", "excel"], type=click.Choice(["json", "excel", "csv"]), help="输出格式")
@click.option("--verbose", "-v", is_flag=True, help="显示详细信息")
def scan(contracts, exceptions, hits, output_dir, scan_date, match_type, formats, verbose):
    """执行完整扫描并生成恢复报告"""
    parser = ConfigParser()

    click.echo("正在解析配置文件...")
    contract_list = parser.parse_contracts(contracts)
    exception_list = parser.parse_exceptions(exceptions)
    hit_records = parser.parse_hit_records(hits)
    bad_lines = parser.get_bad_lines()

    click.echo(f"  数据契约: {len(contract_list)} 个")
    click.echo(f"  例外规则: {len(exception_list)} 个")
    click.echo(f"  命中记录: {len(hit_records)} 条")
    if bad_lines:
        click.echo(f"  坏行记录: {len(bad_lines)} 条 (已记录)")

    check_date = None
    if scan_date:
        check_date = datetime.strptime(scan_date, "%Y-%m-%d").date()

    scan_id = generate_stable_scan_id(
        Path(contracts).stat().st_mtime,
        Path(exceptions).stat().st_mtime,
        Path(hits).stat().st_mtime,
        check_date or date.today(),
    )

    click.echo(f"\n开始扫描 (ID: {scan_id})...")

    rule_engine = RuleEngine(match_type=match_type)
    expired_exceptions, recovery_items, summary = rule_engine.run_full_scan(
        contract_list, exception_list, hit_records, check_date
    )

    scan_result = ScanResult(
        scan_id=scan_id,
        scan_date=check_date or date.today(),
        total_contracts=len(contract_list),
        total_exceptions=len(exception_list),
        expired_exceptions=len(expired_exceptions),
        hit_records=hit_records,
        recovery_items=recovery_items,
        bad_lines=bad_lines,
        summary=summary,
    )

    report_config = ReportConfig(output_dir=output_dir, formats=list(formats))
    reporter = ReportGenerator(report_config)

    click.echo("\n正在生成报告...")
    generated_files = reporter.generate_all(scan_result)

    reporter.print_summary(scan_result)
    if verbose:
        reporter.print_recovery_items(scan_result)

    click.echo("报告已生成:")
    for fmt, file_path in generated_files.items():
        click.echo(f"  [{fmt}] {file_path}")


@cli.command()
@click.option("--contracts", "-c", required=True, help="数据契约文件路径 (JSON/CSV)")
@click.option("--output", "-o", help="输出文件路径")
def parse_contracts(contracts, output):
    """解析并验证数据契约文件"""
    parser = ConfigParser()
    contract_list = parser.parse_contracts(contracts)
    bad_lines = parser.get_bad_lines()

    click.echo(f"成功解析 {len(contract_list)} 个数据契约")
    if bad_lines:
        click.echo(f"发现 {len(bad_lines)} 条坏行")
        for bad in bad_lines:
            click.echo(f"  行 {bad.line_number}: {bad.error_message}")


@cli.command()
@click.option("--exceptions", "-e", required=True, help="例外规则文件路径 (JSON/CSV)")
@click.option("--scan-date", "-d", default=None, help="检查日期 (YYYY-MM-DD)")
def check_expired(exceptions, scan_date):
    """仅检查已过期的例外规则"""
    parser = ConfigParser()
    exception_list = parser.parse_exceptions(exceptions)

    check_date = None
    if scan_date:
        check_date = datetime.strptime(scan_date, "%Y-%m-%d").date()

    rule_engine = RuleEngine()
    expired = rule_engine.check_expired_exceptions(exception_list, check_date)

    click.echo(f"例外规则总数: {len(exception_list)}")
    click.echo(f"已过期例外: {len(expired)}")
    for idx, exp in enumerate(expired, 1):
        click.echo(f"\n{idx}. 规则ID: {exp.rule_id}")
        click.echo(f"   字段路径: {exp.field_path}")
        click.echo(f"   到期日期: {exp.exception_date}")
        click.echo(f"   例外原因: {exp.reason}")


@cli.command()
def template():
    """生成示例配置文件模板"""
    template_dir = Path("./templates")
    template_dir.mkdir(exist_ok=True)

    contract_template = [
        {
            "contract_id": "ORD-001",
            "name": "订单数据表",
            "version": "1.0",
            "created_at": "2024-01-01",
            "fields": [
                {"field_path": "order_id", "is_nullable": False, "description": "订单ID"},
                {"field_path": "user_id", "is_nullable": False, "description": "用户ID"},
                {"field_path": "amount", "is_nullable": True, "description": "订单金额"},
            ],
        }
    ]

    exception_template = [
        {
            "rule_id": "EXP-001",
            "contract_id": "ORD-001",
            "field_path": "user_id",
            "reason": "历史数据迁移期间临时允许为空",
            "exception_date": "2024-06-30",
            "owner": "张三",
            "status": "active",
        },
        {
            "rule_id": "EXP-002",
            "contract_id": "ORD-001",
            "field_path": "amount",
            "reason": "订单金额字段校验规则调整",
            "exception_date": "2024-03-15",
            "owner": "李四",
            "status": "active",
        },
    ]

    hits_template = [
        {
            "record_id": "HIT-001",
            "contract_id": "ORD-001",
            "field_path": "user_id",
            "rule_id": "EXP-001",
            "null_count": 150,
            "total_count": 10000,
            "sample_values": ["", "", ""],
        },
        {
            "record_id": "HIT-002",
            "contract_id": "ORD-001",
            "field_path": "amount",
            "rule_id": "EXP-002",
            "null_count": 0,
            "total_count": 10000,
            "sample_values": [],
        },
    ]

    import json

    with open(template_dir / "contracts.json", "w", encoding="utf-8") as f:
        json.dump(contract_template, f, ensure_ascii=False, indent=2)

    with open(template_dir / "exceptions.json", "w", encoding="utf-8") as f:
        json.dump(exception_template, f, ensure_ascii=False, indent=2)

    with open(template_dir / "hit_records.json", "w", encoding="utf-8") as f:
        json.dump(hits_template, f, ensure_ascii=False, indent=2)

    click.echo(f"模板文件已生成到 {template_dir.resolve()}")
    click.echo("  - contracts.json: 数据契约模板")
    click.echo("  - exceptions.json: 例外规则模板")
    click.echo("  - hit_records.json: 命中记录模板")


if __name__ == "__main__":
    cli()
