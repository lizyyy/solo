import click
import sys
from pathlib import Path
from typing import List

from .parser import AuditParser
from .rules import RuleEngine
from .reporter import ReportGenerator
from .models import AuditRecord, ValidationError


@click.group()
def cli():
    """日志留存冻结释放审计报告排查工具"""
    pass


@cli.command()
@click.argument("files", nargs=-1, type=click.Path(exists=True, readable=True))
@click.option("--output", "-o", default="./output", help="报告输出目录")
@click.option("--name", "-n", default="audit_report", help="报告文件名前缀")
@click.option("--verbose", "-v", is_flag=True, help="显示详细输出")
def audit(files: List[str], output: str, name: str, verbose: bool):
    """审计输入文件并生成报告"""
    if not files:
        click.echo("错误: 请指定至少一个输入文件")
        sys.exit(1)

    click.echo("=" * 60)
    click.echo("日志留存冻结释放审计报告排查工具")
    click.echo("=" * 60)
    click.echo(f"输入文件数: {len(files)}")
    click.echo(f"输出目录: {output}")
    click.echo("")

    all_records: List[AuditRecord] = []
    all_errors: List[ValidationError] = []

    parser = AuditParser()

    with click.progressbar(files, label="正在解析文件...") as bar:
        for file_path in bar:
            if verbose:
                click.echo(f"\n解析文件: {file_path}")

            records, errors = parser.parse_file(file_path)
            all_records.extend(records)
            all_errors.extend(errors)

            if verbose:
                click.echo(f"  成功解析: {len(records)} 条记录")
                if errors:
                    click.echo(f"  解析错误: {len(errors)} 个")

    click.echo(f"\n总计解析: {len(all_records)} 条有效记录")
    click.echo(f"总计错误: {len(all_errors)} 个")

    if not all_records and not all_errors:
        click.echo("\n未找到有效记录，退出")
        sys.exit(0)

    click.echo("\n正在执行规则校验...")
    rule_engine = RuleEngine()
    result = rule_engine.process_records(all_records)

    click.echo(f"  重复申请: {len(result.duplicates)} 条")
    click.echo(f"  时间范围重叠: {len(result.overlaps)} 处")
    click.echo(f"  待审批释放: {len(result.pending_releases)} 条")

    click.echo("\n正在生成报告...")
    reporter = ReportGenerator(output_dir=output)
    reports = reporter.generate_reports(result, all_errors, base_filename=name)

    click.echo("\n报告已生成:")
    for report_type, report_path in reports.items():
        click.echo(f"  [{report_type}] {report_path}")

    click.echo("\n" + "=" * 60)
    click.echo("审计完成!")
    click.echo("=" * 60)

    if all_errors or result.duplicates or result.overlaps or result.pending_releases:
        sys.exit(2)


@cli.command()
@click.argument("file_path", type=click.Path(exists=True, readable=True))
def validate(file_path: str):
    """验证单个文件格式是否正确"""
    click.echo(f"正在验证文件: {file_path}")

    parser = AuditParser()
    records, errors = parser.parse_file(file_path)

    if errors:
        click.echo(f"\n发现 {len(errors)} 个错误:")
        for error in errors:
            click.echo(f"\n  [{error.error_type}] {error.message}")
            if error.source_info:
                click.echo(f"  来源: {error.source_info.file_path}:{error.source_info.line_number or 'N/A'}")
                click.echo(f"  原始内容: {error.source_info.raw_content[:100]}")
        sys.exit(1)
    else:
        click.echo(f"\n验证通过! 成功解析 {len(records)} 条记录")
        for i, record in enumerate(records[:5], 1):
            click.echo(f"  {i}. ID: {record.id}, 主题: {record.log_topic}, 类型: {record.operation_type.value}")
        if len(records) > 5:
            click.echo(f"  ... 还有 {len(records) - 5} 条记录")


@cli.command()
def template():
    """生成示例数据模板"""
    click.echo("生成示例数据模板...")

    examples_dir = Path("./examples")
    examples_dir.mkdir(exist_ok=True)

    csv_template = examples_dir / "audit_data.csv"
    with open(csv_template, "w", encoding="utf-8-sig") as f:
        f.write("id,operation_type,log_topic,start_time,end_time,freeze_reason,applicant,release_condition,release_status,approval_time,approver\n")
        f.write("F001,freeze,user_access_log,2024-01-01 00:00:00,2024-01-31 23:59:59,complaint,zhang_san,,,\n")
        f.write("F002,freeze,user_access_log,2024-01-15 00:00:00,2024-02-15 23:59:59,audit,li_si,,,\n")
        f.write("F003,freeze,payment_log,2024-02-01 00:00:00,2024-02-28 23:59:59,legal,wang_wu,,,\n")
        f.write("R001,release,user_access_log,2024-01-01 00:00:00,2024-01-31 23:59:59,complaint,zhang_san,投诉已处理,approved,2024-02-20 10:00:00,zhao_liu\n")
        f.write("R002,release,user_access_log,2024-01-15 00:00:00,2024-02-15 23:59:59,audit,li_si,审计完成,pending,,\n")
        f.write(",freeze,bad_log,2024-01-01,2024-01-02,bad_reason,user1,,,\n")

    json_template = examples_dir / "audit_data.json"
    import json

    data = [
        {
            "id": "F001",
            "operation_type": "freeze",
            "log_topic": "user_access_log",
            "start_time": "2024-01-01 00:00:00",
            "end_time": "2024-01-31 23:59:59",
            "freeze_reason": "complaint",
            "applicant": "zhang_san",
        },
        {
            "id": "F002",
            "operation_type": "freeze",
            "log_topic": "user_access_log",
            "start_time": "2024-01-15 00:00:00",
            "end_time": "2024-02-15 23:59:59",
            "freeze_reason": "audit",
            "applicant": "li_si",
        },
        {
            "id": "R001",
            "operation_type": "release",
            "log_topic": "user_access_log",
            "start_time": "2024-01-01 00:00:00",
            "end_time": "2024-01-31 23:59:59",
            "freeze_reason": "complaint",
            "applicant": "zhang_san",
            "release_condition": "投诉已处理",
            "release_status": "approved",
            "approval_time": "2024-02-20 10:00:00",
            "approver": "zhao_liu",
        },
    ]

    with open(json_template, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    click.echo(f"CSV模板: {csv_template.absolute()}")
    click.echo(f"JSON模板: {json_template.absolute()}")


def main():
    cli()


if __name__ == "__main__":
    main()
