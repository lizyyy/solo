import click
import os

from .parser import ScheduleParser
from .rules import RuleEngine
from .reporter import ReportGenerator
from .models import CheckResult


@click.group()
def cli():
    """直播排班人员冲突脚本缺失排查工具"""
    pass


@cli.command()
@click.argument("files", nargs=-1, type=click.Path(exists=True))
@click.option("--output-json", "-j", type=click.Path(), help="输出JSON报告路径")
@click.option("--output-csv", "-c", type=click.Path(), help="输出CSV报告路径")
@click.option("--stable/--no-stable", default=True, help="确保输出结果稳定（排序）")
@click.option("--verbose", "-v", is_flag=True, help="显示详细报告")
def check(files, output_json, output_csv, stable, verbose):
    """检查排班表中的冲突和缺失问题"""
    if not files:
        click.echo("错误: 请指定至少一个文件")
        return

    all_rows = []
    parser = ScheduleParser()

    for file_path in files:
        click.echo(f"正在解析: {file_path}")
        try:
            rows = parser.parse_file(file_path)
            all_rows.extend(rows)
            click.echo(f"  解析完成: {len(rows)} 行")
        except Exception as e:
            click.echo(f"  解析失败: {str(e)}", err=True)

    click.echo(f"\n总计解析: {len(all_rows)} 行")

    engine = RuleEngine()

    slots_by_date = engine.expand_time_slots(all_rows)
    conflict_issues = engine.check_person_conflicts(slots_by_date)
    script_issues = engine.check_script_missing(all_rows)
    bad_row_issues = engine.check_bad_rows(all_rows)
    account_stats, person_stats = engine.calculate_stats(all_rows)

    all_issues = conflict_issues + script_issues + bad_row_issues

    result = CheckResult(
        schedule_rows=all_rows,
        issues=all_issues,
        account_stats=account_stats,
        person_stats=person_stats
    )

    reporter = ReportGenerator()

    if verbose:
        reporter.print_console_report(result)

    if output_json:
        reporter.generate_json_report(result, output_json, ensure_stable=stable)
        click.echo(f"\nJSON报告已生成: {output_json}")

    if output_csv:
        reporter.generate_csv_report(result, output_csv, ensure_stable=stable)
        click.echo(f"CSV报告已生成: {output_csv}")

    if not output_json and not output_csv and not verbose:
        summary = reporter._generate_summary(result)
        click.echo(f"\n发现 {summary['total_issues']} 个问题")
        for itype, count in sorted(summary["issues_by_type"].items()):
            click.echo(f"  {itype}: {count}")


@cli.command()
def sample():
    """生成示例排班表（CSV格式）"""
    import csv
    sample_path = "sample_schedule.csv"
    sample_data = [
        ["日期", "开始时间", "结束时间", "主播", "账号", "场控", "商品脚本"],
        ["2025-05-20", "19:00", "21:00", "小美", "美妆旗舰店", "场控A", "脚本1"],
        ["2025-05-20", "20:00", "22:00", "小美", "服饰旗舰店", "场控B", ""],
        ["2025-05-20", "18:00", "20:00", "大强", "数码专营店", "", "脚本3"],
        ["2025-05-21", "14:00", "16:00", "小美", "美妆旗舰店", "场控A", "脚本4"],
        ["2025-05-21", "19:00", "21:00", "大强", "数码专营店", "场控C", "脚本5"],
        ["", "10:00", "12:00", "", "食品旗舰店", "场控D", "脚本6"],
    ]

    with open(sample_path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerows(sample_data)

    click.echo(f"示例文件已生成: {sample_path}")
    click.echo("\n使用以下命令检查:")
    click.echo(f"  python -m schedule_checker.cli check {sample_path} -v")


if __name__ == "__main__":
    cli()
