#!/usr/bin/env python3
import click
import sys
from pathlib import Path
from datetime import datetime

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.parser.data_parser import DataParser
from src.validator.data_validator import DataValidator
from src.ranking.ranking_calculator import RankingCalculator
from src.reporter.report_generator import ReportGenerator


@click.group()
def cli():
    pass


@cli.command()
@click.argument('games_file', type=click.Path(exists=True))
@click.option('--appeals', '-a', type=click.Path(exists=True), help='申诉改判数据文件')
@click.option('--output', '-o', type=click.Path(), default='./data/output', help='输出目录')
@click.option('--skip-validation', is_flag=True, help='跳过数据校验')
def calculate(games_file, appeals, output, skip_validation):
    click.echo("=" * 60)
    click.echo("社区篮球联赛积分排行计算工具")
    click.echo("=" * 60)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    click.echo(f"\n[1/4] 解析比赛数据: {games_file}")
    parser = DataParser()
    games = parser.parse_games_csv(games_file)
    parse_errors = parser.get_parse_errors()

    if parse_errors:
        click.echo(f"  ⚠️  发现 {len(parse_errors)} 条解析错误")
    click.echo(f"  ✓ 成功解析 {len(games)} 场比赛数据")

    appeal_list = []
    if appeals:
        click.echo(f"\n[2/4] 解析申诉改判数据: {appeals}")
        appeal_list = parser.parse_appeals_csv(appeals)
        click.echo(f"  ✓ 成功解析 {len(appeal_list)} 条申诉改判")
    else:
        click.echo(f"\n[2/4] 无申诉改判数据")

    validation_result = None
    if not skip_validation:
        click.echo("\n[3/4] 数据校验中...")
        validator = DataValidator()
        validation_result = validator.validate_games(games)

        if validation_result.errors:
            click.echo(f"  ✗ 发现 {len(validation_result.errors)} 个严重错误")
        if validation_result.warnings:
            click.echo(f"  ⚠️  发现 {len(validation_result.warnings)} 个警告")

        if validation_result.is_valid:
            click.echo("  ✓ 数据校验通过")
    else:
        click.echo("\n[3/4] 跳过数据校验")

    click.echo("\n[4/4] 计算积分排行...")
    calculator = RankingCalculator()

    if appeal_list:
        click.echo("  应用申诉改判并计算排名对比...")
        result = calculator.calculate_rankings_with_appeals(games, appeal_list)
        reporter = ReportGenerator(output)
        reports = reporter.generate_appeal_rerun_report(result, timestamp)

        click.echo("\n申诉改判报告已生成:")
        for report_name, report_path in reports.items():
            click.echo(f"  - {report_name}: {report_path}")
    else:
        result = calculator.calculate_rankings(games)
        reporter = ReportGenerator(output)
        reports = reporter.generate_all_reports(result, validation_result, parse_errors, timestamp)

        click.echo("\n正常积分报告已生成:")
        for report_name, report_path in reports.items():
            click.echo(f"  - {report_name}: {report_path}")

    click.echo(f"\n✓ 处理完成！所有文件输出至: {output}")
    click.echo("=" * 60)


@cli.command()
@click.argument('games_file', type=click.Path(exists=True))
@click.option('--output', '-o', type=click.Path(), default='./data/output', help='输出目录')
def validate(games_file, output):
    click.echo("=" * 60)
    click.echo("社区篮球联赛数据校验工具")
    click.echo("=" * 60)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    click.echo(f"\n解析比赛数据: {games_file}")
    parser = DataParser()
    games = parser.parse_games_csv(games_file)
    parse_errors = parser.get_parse_errors()

    click.echo(f"✓ 成功解析 {len(games)} 场比赛数据")

    if parse_errors:
        click.echo(f"⚠️  发现 {len(parse_errors)} 条解析错误")

    click.echo("\n数据校验中...")
    validator = DataValidator()
    validation_result = validator.validate_games(games)

    if validation_result.errors:
        click.echo(f"✗ 发现 {len(validation_result.errors)} 个严重错误:")
        for error in validation_result.errors[:5]:
            click.echo(f"  - {error['message']}")
        if len(validation_result.errors) > 5:
            click.echo(f"  ... 还有 {len(validation_result.errors) - 5} 个错误")

    if validation_result.warnings:
        click.echo(f"⚠️  发现 {len(validation_result.warnings)} 个警告:")
        for warning in validation_result.warnings[:5]:
            click.echo(f"  - {warning['message']}")
        if len(validation_result.warnings) > 5:
            click.echo(f"  ... 还有 {len(validation_result.warnings) - 5} 个警告")

    if validation_result.is_valid and not parse_errors:
        click.echo("\n✓ 数据校验全部通过！")
    else:
        click.echo("\n生成校验报告...")
        reporter = ReportGenerator(output)
        reports = reporter.generate_all_reports(
            rankings_data=None,
            validation_result=validation_result,
            parse_errors=parse_errors,
            run_timestamp=timestamp
        )
        click.echo(f"\n校验报告已输出至: {output}")

    click.echo("=" * 60)


@cli.command()
@click.argument('games_file', type=click.Path(exists=True))
@click.argument('appeals_file', type=click.Path(exists=True))
@click.option('--output', '-o', type=click.Path(), default='./data/output', help='输出目录')
def rerun(games_file, appeals_file, output):
    click.echo("=" * 60)
    click.echo("社区篮球联赛申诉改判重跑工具")
    click.echo("=" * 60)

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

    click.echo(f"\n[1/3] 解析比赛数据: {games_file}")
    parser = DataParser()
    games = parser.parse_games_csv(games_file)
    click.echo(f"  ✓ 成功解析 {len(games)} 场比赛数据")

    click.echo(f"\n[2/3] 解析申诉改判数据: {appeals_file}")
    appeals = parser.parse_appeals_csv(appeals_file)
    click.echo(f"  ✓ 成功解析 {len(appeals)} 条申诉改判")

    click.echo("\n[3/3] 应用申诉改判并重跑积分计算...")
    calculator = RankingCalculator()
    result = calculator.calculate_rankings_with_appeals(games, appeals)

    reporter = ReportGenerator(output)
    reports = reporter.generate_appeal_rerun_report(result, timestamp)

    click.echo("\n申诉改判重跑报告已生成:")
    for report_name, report_path in reports.items():
        click.echo(f"  - {report_name}: {report_path}")

    if result.get("changes"):
        click.echo("\n排名变动摘要:")
        for division, changes in result["changes"].items():
            click.echo(f"  {division}: {len(changes)} 支球队排名变动")

    click.echo(f"\n✓ 重跑完成！所有文件输出至: {output}")
    click.echo("=" * 60)


@cli.command()
def samples():
    click.echo("=" * 60)
    click.echo("社区篮球联赛积分排行 - 样例数据说明")
    click.echo("=" * 60)
    click.echo("")
    click.echo("样例数据目录: data/samples/")
    click.echo("")
    click.echo("1. 正常输入样例:")
    click.echo("   games_normal.csv - 干净的社区甲组比赛数据")
    click.echo("   包含4支球队，6场比赛，正常结果")
    click.echo("")
    click.echo("2. 脏数据输入样例:")
    click.echo("   games_dirty.csv - 包含各种数据问题")
    click.echo("   用于测试数据校验功能")
    click.echo("")
    click.echo("3. 申诉改判重跑样例:")
    click.echo("   games_rerun.csv - 原始比赛数据")
    click.echo("   appeals_rerun.csv - 申诉改判数据")
    click.echo("   用于测试重跑对照功能")
    click.echo("")
    click.echo("使用示例:")
    click.echo("  python cli/ranking_cli.py calculate data/samples/games_normal.csv")
    click.echo("  python cli/ranking_cli.py validate data/samples/games_dirty.csv")
    click.echo("  python cli/ranking_cli.py rerun data/samples/games_rerun.csv data/samples/appeals_rerun.csv")
    click.echo("")
    click.echo("=" * 60)


if __name__ == '__main__':
    cli()
