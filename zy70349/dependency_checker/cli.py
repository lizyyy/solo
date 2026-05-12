import click
import os
from .engine import DependencyCheckerEngine, CHECKER_REGISTRY
from .checkers import CheckStatus


DEFAULT_CONFIG = os.environ.get(
    "DEPENDENCY_CHECKER_CONFIG",
    "./dependency-check.yaml"
)


@click.group()
@click.version_option(version='1.0.0')
def cli():
    """服务启动依赖检查 CLI

    用于检查项目启动前的所有依赖是否满足要求。
    """
    pass


@cli.command()
@click.option('--config', '-c', default=DEFAULT_CONFIG,
              help='依赖配置文件路径 (YAML/JSON)')
@click.option('--format', '-f', 'fmt', default='text',
              type=click.Choice(['text', 'json', 'yaml']),
              help='输出格式')
@click.option('--no-color', is_flag=True, help='禁用彩色输出')
def doctor(config, fmt, no_color):
    """运行所有检查项，诊断依赖状态"""
    try:
        engine = DependencyCheckerEngine(config)
        results = engine.run_all()
        report = engine.generate_report(results, output_format=fmt)
        click.echo(report)

        summary = engine.get_results_summary(results)
        if not summary["can_start"]:
            click.get_current_context().exit(1)
    except FileNotFoundError as e:
        click.echo(f"❌ 错误: {e}", err=True)
        click.echo(f"💡 提示: 使用 --config 指定配置文件路径，或设置 DEPENDENCY_CHECKER_CONFIG 环境变量", err=True)
        click.get_current_context().exit(2)
    except Exception as e:
        click.echo(f"❌ 错误: {e}", err=True)
        click.get_current_context().exit(3)


@cli.command('check-one')
@click.argument('checker')
@click.option('--config', '-c', default=DEFAULT_CONFIG,
              help='依赖配置文件路径 (YAML/JSON)')
def check_one(checker, config):
    """运行单个检查项

    可用的检查器: database, cache, queue, port, config, version
    """
    try:
        engine = DependencyCheckerEngine(config)
        result = engine.run_one(checker)

        status_icon = {
            CheckStatus.PASS: "✅",
            CheckStatus.FAIL: "❌",
            CheckStatus.WARN: "⚠️",
            CheckStatus.SKIP: "⏭️"
        }.get(result.status, "?")

        click.echo(f"{status_icon} [{result.name}] {result.message}")

        if result.details:
            click.echo(f"   详情: {result.details}")

        if result.fix_hint:
            click.echo(f"   💡 修复建议: {result.fix_hint}")

        if result.status == CheckStatus.FAIL:
            click.get_current_context().exit(1)
    except ValueError as e:
        click.echo(f"❌ 错误: {e}", err=True)
        click.echo(f"💡 可用的检查器: {', '.join(CHECKER_REGISTRY.keys())}", err=True)
        click.get_current_context().exit(2)
    except Exception as e:
        click.echo(f"❌ 错误: {e}", err=True)
        click.get_current_context().exit(3)


@cli.command()
@click.argument('checker')
def explain(checker):
    """解释某个检查项的作用和重要性"""
    engine = DependencyCheckerEngine(None)
    explanation = engine.get_explaination(checker)
    click.echo(f"📖 检查器: {checker}")
    click.echo("-" * 50)
    click.echo(explanation)


@cli.command('fix-hint')
@click.option('--config', '-c', default=DEFAULT_CONFIG,
              help='依赖配置文件路径 (YAML/JSON)')
def fix_hint(config):
    """仅输出修复建议（适用于 CI/CD 或脚本处理）"""
    try:
        engine = DependencyCheckerEngine(config)
        results = engine.run_all()
        hints = engine.get_fix_hints(results)

        if not hints:
            click.echo("✅ 没有需要修复的问题")
            return

        click.echo("🔧 需要修复的问题 (按优先级排序):")
        click.echo("-" * 50)
        for i, hint in enumerate(hints, 1):
            click.echo(f"{i}. {hint}")

        if hints:
            click.get_current_context().exit(1)
    except Exception as e:
        click.echo(f"❌ 错误: {e}", err=True)
        click.get_current_context().exit(2)


@cli.command()
@click.option('--config', '-c', default=DEFAULT_CONFIG,
              help='依赖配置文件路径 (YAML/JSON)')
@click.option('--format', '-f', 'fmt', default='text',
              type=click.Choice(['text', 'json', 'yaml']),
              help='报告输出格式')
@click.option('--output', '-o', default=None,
              help='输出文件路径（如果不指定则输出到 stdout）')
def report(config, fmt, output):
    """生成完整的检查报告"""
    try:
        engine = DependencyCheckerEngine(config)
        results = engine.run_all()
        report_content = engine.generate_report(results, output_format=fmt)

        if output:
            with open(output, 'w', encoding='utf-8') as f:
                f.write(report_content)
            click.echo(f"✅ 报告已保存到: {output}")
        else:
            click.echo(report_content)

        summary = engine.get_results_summary(results)
        if not summary["can_start"]:
            click.get_current_context().exit(1)
    except Exception as e:
        click.echo(f"❌ 错误: {e}", err=True)
        click.get_current_context().exit(2)


@cli.command()
def list_checkers():
    """列出所有可用的检查器"""
    click.echo("📋 可用的检查器:")
    click.echo("-" * 50)

    for name, checker_cls in CHECKER_REGISTRY.items():
        click.echo(f"  • {name}: {checker_cls.description}")


if __name__ == '__main__':
    cli()
