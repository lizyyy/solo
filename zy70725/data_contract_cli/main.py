import hashlib
import json
import uuid
from datetime import date, datetime, timedelta
from pathlib import Path
from typing import Optional, List
import click
from .models import ScanResult, ReportConfig, RecoveryItem, RecoveryStatus
from .parser import ConfigParser
from .rules import RuleEngine
from .reporter import ReportGenerator


def generate_stable_scan_id(*args) -> str:
    content = "|".join(str(arg) for arg in args)
    hash_obj = hashlib.md5(content.encode())
    return hash_obj.hexdigest()[:12]


def generate_stable_datetime(scan_id: str, unique_key: str) -> datetime:
    content = f"{scan_id}|{unique_key}"
    hash_bytes = hashlib.md5(content.encode()).digest()
    base_date = datetime(2024, 1, 1)
    days_offset = int.from_bytes(hash_bytes[:2], "big") % 365
    seconds_offset = int.from_bytes(hash_bytes[2:4], "big") % 86400
    return base_date.replace(hour=0, minute=0, second=0, microsecond=0) + \
           timedelta(days=days_offset, seconds=seconds_offset)


def load_scan_result(scan_id: str, output_dir: str = "./reports") -> Optional[ScanResult]:
    report_path = Path(output_dir) / f"scan_result_{scan_id}.json"
    if not report_path.exists():
        return None
    with open(report_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    return ScanResult(**data)


def save_scan_result(scan_result: ScanResult, output_dir: str = "./reports"):
    report_config = ReportConfig(output_dir=output_dir, formats=["json", "excel", "csv"])
    reporter = ReportGenerator(report_config)
    reporter.generate_all(scan_result)


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

    for exp in expired_exceptions:
        exp.created_at = generate_stable_datetime(scan_id, f"exp_{exp.rule_id}")

    for hit in hit_records:
        hit.detected_at = generate_stable_datetime(scan_id, f"hit_{hit.record_id}")

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


@cli.command()
@click.option("--scan-id", "-s", required=True, help="扫描结果ID")
@click.option("--rule-id", "-r", required=True, help="例外规则ID (可多次指定)", multiple=True)
@click.option("--note", "-n", required=True, help="审批意见")
@click.option("--by", "-b", required=True, help="审批人")
@click.option("--output-dir", "-o", default="./reports", help="报告目录")
def approve(scan_id, rule_id, note, by, output_dir):
    """批准恢复例外规则"""
    scan_result = load_scan_result(scan_id, output_dir)
    if not scan_result:
        click.echo(f"错误: 找不到扫描结果 {scan_id}")
        return

    approved_count = 0
    now = datetime.now()

    for item in scan_result.recovery_items:
        if item.rule_id in rule_id:
            item.recovery_status = RecoveryStatus.APPROVED
            item.approval_note = note
            item.approved_by = by
            item.approved_at = now
            approved_count += 1
            click.echo(f"已批准恢复: {item.rule_id} - {item.field_path}")

    if approved_count == 0:
        click.echo("警告: 未找到匹配的恢复项")
    else:
        save_scan_result(scan_result, output_dir)
        click.echo(f"完成: 已批准 {approved_count} 项恢复")


@cli.command()
@click.option("--scan-id", "-s", required=True, help="扫描结果ID")
@click.option("--rule-id", "-r", required=True, help="例外规则ID (可多次指定)", multiple=True)
@click.option("--note", "-n", required=True, help="拒绝理由")
@click.option("--by", "-b", required=True, help="审批人")
@click.option("--output-dir", "-o", default="./reports", help="报告目录")
def reject(scan_id, rule_id, note, by, output_dir):
    """拒绝恢复例外规则"""
    scan_result = load_scan_result(scan_id, output_dir)
    if not scan_result:
        click.echo(f"错误: 找不到扫描结果 {scan_id}")
        return

    rejected_count = 0
    now = datetime.now()

    for item in scan_result.recovery_items:
        if item.rule_id in rule_id:
            item.recovery_status = RecoveryStatus.REJECTED
            item.approval_note = note
            item.approved_by = by
            item.approved_at = now
            rejected_count += 1
            click.echo(f"已拒绝恢复: {item.rule_id} - {item.field_path}")

    if rejected_count == 0:
        click.echo("警告: 未找到匹配的恢复项")
    else:
        save_scan_result(scan_result, output_dir)
        click.echo(f"完成: 已拒绝 {rejected_count} 项恢复")


@cli.command(name="list")
@click.option("--scan-id", "-s", help="扫描结果ID (不指定则列出所有报告)")
@click.option("--output-dir", "-o", default="./reports", help="报告目录")
def list_reports(scan_id, output_dir):
    """列出扫描报告和恢复项状态"""
    if scan_id:
        scan_result = load_scan_result(scan_id, output_dir)
        if not scan_result:
            click.echo(f"错误: 找不到扫描结果 {scan_id}")
            return

        click.echo(f"\n扫描ID: {scan_result.scan_id}")
        click.echo(f"扫描日期: {scan_result.scan_date}")
        click.echo(f"\n恢复项状态:")
        click.echo("-" * 80)
        for item in scan_result.recovery_items:
            status_color = "yellow" if item.recovery_status == RecoveryStatus.PENDING else \
                           "green" if item.recovery_status == RecoveryStatus.APPROVED else "red"
            status_text = click.style(item.recovery_status.value.upper(), fg=status_color)
            click.echo(f"[{status_text}] {item.rule_id} - {item.field_path}")
            if item.approval_note:
                click.echo(f"      意见: {item.approval_note} (by {item.approved_by})")
            click.echo(f"      空值: {item.null_count}/{item.total_count} ({item.null_rate:.2%})")
        click.echo("-" * 80)
    else:
        report_dir = Path(output_dir)
        if not report_dir.exists():
            click.echo(f"报告目录不存在: {output_dir}")
            return

        json_files = sorted(report_dir.glob("scan_result_*.json"))
        click.echo(f"\n找到 {len(json_files)} 个扫描报告:")
        for f in json_files:
            scan_id = f.stem.replace("scan_result_", "")
            click.echo(f"  - {scan_id}")


if __name__ == "__main__":
    cli()
