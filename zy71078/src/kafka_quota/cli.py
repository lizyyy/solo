from __future__ import annotations

import sys
from pathlib import Path

import click

from . import __version__
from .engine import QuotaEngine
from .models import AnomalyLevel
from .parser import InputValidator, RetentionParser, TeamParser, TopicParser
from .reporter import MarkdownReporter, ReportSerializer, TerminalReporter
from .selfcheck import run_selfcheck


EXIT_OK = 0
EXIT_INPUT_ERROR = 1
EXIT_QUOTA_ERROR = 2
EXIT_SELFCHECK_FAIL = 3


@click.group(invoke_without_command=True)
@click.version_option(__version__, prog_name="kafka-quota")
@click.pass_context
def main(ctx: click.Context):
    """Kafka Topic 配额管理命令行工具"""
    if ctx.invoked_subcommand is None:
        click.echo(ctx.get_help())


@main.command()
@click.option("--topics", "-t", required=True, type=click.Path(exists=True, dir_okay=False), help="Topic 清单文件 (CSV/YAML)")
@click.option("--teams", "-T", required=True, type=click.Path(exists=True, dir_okay=False), help="团队配置文件 (CSV/YAML)")
@click.option("--output-dir", "-o", type=click.Path(file_okay=False), default="./quota-report", help="输出目录")
@click.option("--no-terminal", is_flag=True, help="不输出终端摘要")
@click.option("--skip-validation", is_flag=True, help="跳过输入校验")
def check(topics: str, teams: str, output_dir: str, no_terminal: bool, skip_validation: bool):
    """检查 Kafka Topic 配额使用情况"""
    try:
        topics_path = Path(topics)
        teams_path = Path(teams)
        output_path = Path(output_dir)

        output_path.mkdir(parents=True, exist_ok=True)

        click.echo(f"📄 解析 Topic 清单: {topics_path}")
        topic_list = TopicParser.parse_auto(topics_path)
        click.echo(f"   共加载 {len(topic_list)} 个 Topic")

        click.echo(f"👥 解析团队配置: {teams_path}")
        team_list = TeamParser.parse_auto(teams_path)
        click.echo(f"   共加载 {len(team_list)} 个团队")

        if not skip_validation:
            click.echo("✅ 输入校验...")
            topics_ok, topic_errors = InputValidator.validate_topics(topic_list)
            teams_ok, team_errors = InputValidator.validate_teams(team_list)

            if not topics_ok:
                click.echo("❌ Topic 校验失败:", err=True)
                for err in topic_errors:
                    click.echo(f"   - {err}", err=True)

            if not teams_ok:
                click.echo("❌ 团队校验失败:", err=True)
                for err in team_errors:
                    click.echo(f"   - {err}", err=True)

            if not (topics_ok and teams_ok):
                sys.exit(EXIT_INPUT_ERROR)
            click.echo("   校验通过")

        click.echo("🧮 计算配额...")
        engine = QuotaEngine(team_list)
        input_files = {
            "topics": str(topics_path),
            "teams": str(teams_path),
        }
        report = engine.calculate(topic_list, input_files)

        if not no_terminal:
            click.echo()
            TerminalReporter.print_summary(report)

        json_path = output_path / "quota-report.json"
        click.echo(f"\n💾 导出 JSON 报告: {json_path}")
        ReportSerializer.to_json(report, json_path)

        md_path = output_path / "quota-report.md"
        click.echo(f"💾 导出 Markdown 报告: {md_path}")
        MarkdownReporter.generate(report, md_path)

        if report.has_errors:
            counts = report.anomaly_counts
            click.echo(
                f"\n⚠️  发现 {counts[AnomalyLevel.ERROR]} 个 ERROR 和 "
                f"{counts[AnomalyLevel.CRITICAL]} 个 CRITICAL 异常",
                err=True,
            )
            sys.exit(EXIT_QUOTA_ERROR)

        click.echo("\n✅ 检查完成")
        sys.exit(EXIT_OK)

    except Exception as e:
        click.echo(f"❌ 错误: {e}", err=True)
        import traceback
        traceback.print_exc()
        sys.exit(EXIT_INPUT_ERROR)


@main.command()
@click.option("--output-dir", "-o", type=click.Path(file_okay=False), default="./selfcheck-output", help="输出目录")
@click.option("--verbose", "-v", is_flag=True, help="详细输出")
def selfcheck(output_dir: str, verbose: bool):
    """运行自检，验证解析、边界和报告功能"""
    click.echo("🔍 运行自检...")
    click.echo()

    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)

    passed, failed, results = run_selfcheck(output_path, verbose)

    click.echo()
    click.echo("=" * 50)
    click.echo(f"自检结果: {passed} 通过, {failed} 失败")
    click.echo("=" * 50)

    if failed > 0:
        click.echo("\n❌ 自检失败项:", err=True)
        for name, success, detail in results:
            if not success:
                click.echo(f"   - {name}: {detail}", err=True)
        sys.exit(EXIT_SELFCHECK_FAIL)
    else:
        click.echo("\n✅ 所有自检通过!")
        sys.exit(EXIT_OK)


@main.command()
@click.option("--unit", "-u", type=click.Choice(["ms", "s", "m", "h", "d", "w"]), default="d", help="输出单位")
@click.argument("value")
def parse_retention(value: str, unit: str):
    """解析 retention 字符串并转换为指定单位"""
    try:
        td = RetentionParser.parse(value)
        result = RetentionParser.format(td, unit)
        click.echo(f"{value} = {result}")
        click.echo(f"总秒数: {td.total_seconds()}s")
    except ValueError as e:
        click.echo(f"❌ 解析失败: {e}", err=True)
        sys.exit(EXIT_INPUT_ERROR)


if __name__ == "__main__":
    main()
