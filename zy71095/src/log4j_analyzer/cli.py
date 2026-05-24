import sys
from pathlib import Path
from typing import List, Optional, Tuple

import click

from .analyzer import Log4jChainAnalyzer
from .constants import EXIT_CODE_DESCRIPTIONS, ExitCode, LOG_LEVELS
from .reporter import Reporter


def validate_log_level(ctx, param, value):
    if value is None:
        return None
    if value.upper() not in LOG_LEVELS:
        raise click.BadParameter(
            f"无效的日志级别 '{value}'. 有效值: {', '.join(LOG_LEVELS)}"
        )
    return value.upper()


def validate_package_name(ctx, param, value):
    if value is None:
        return None
    for pkg in value:
        if not pkg or not pkg.replace('.', '').replace('*', '').replace('?', '').replace('_', '').isalnum():
            raise click.BadParameter(f"无效的包名 '{pkg}'")
    return value


def validate_output_dir(ctx, param, value):
    if value is None:
        return Path.cwd()
    path = Path(value)
    if not path.exists():
        path.mkdir(parents=True, exist_ok=True)
    elif not path.is_dir():
        raise click.BadParameter(f"'{value}' 不是目录")
    return path


@click.group(invoke_without_command=True)
@click.version_option(version='1.0.0', prog_name='log4j-chain')
@click.pass_context
def main(ctx):
    """Log4j 配置链分析工具 - 追踪多层配置覆盖，生成完整配置链路报告"""
    if ctx.invoked_subcommand is None:
        click.echo(ctx.get_help())


@main.command()
@click.option('--config', '-c', multiple=True, type=click.Path(exists=True, dir_okay=False),
              help='Log4j 配置文件路径 (可多次指定)')
@click.option('--env-file', '-e', multiple=True, type=click.Path(exists=True, dir_okay=False),
              help='环境变量文件路径 (可多次指定)')
@click.option('--package', '-p', multiple=True, callback=validate_package_name,
              help='要分析的包名 (可多次指定，支持通配符)')
@click.option('--package-file', type=click.Path(exists=True, dir_okay=False),
              help='包含包名列表的文件，每行一个')
@click.option('--override', '-o', nargs=2, multiple=True,
              metavar='PACKAGE LEVEL',
              help='命令行覆盖指定包的日志级别 (如: -o com.example DEBUG)')
@click.option('--load-system-env/--no-system-env', default=False,
              help='是否加载系统环境变量中的 LOG4J_* 配置')
@click.option('--output-dir', '-d', type=click.Path(), callback=validate_output_dir,
              help='输出报告的目录 (默认: 当前目录)')
@click.option('--output-name', '-n', default='log4j-chain-report',
              help='输出文件的基础名称 (默认: log4j-chain-report)')
@click.option('--json/--no-json', default=True, help='是否生成 JSON 报告')
@click.option('--markdown/--no-markdown', default=True, help='是否生成 Markdown 报告')
@click.option('--quiet/--no-quiet', '-q', default=False, help='静默模式，不输出终端摘要')
@click.option('--base-dir', type=click.Path(exists=True, file_okay=False),
              help='基础目录，用于解析相对路径的 include 文件')
def analyze(config, env_file, package, package_file, override,
            load_system_env, output_dir, output_name, json, markdown, quiet, base_dir):
    """分析 Log4j 配置链并生成报告"""
    
    try:
        packages = list(package) if package else []
        if package_file:
            with open(package_file, 'r', encoding='utf-8') as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith('#'):
                        packages.append(line)

        if not packages:
            raise click.UsageError("请至少指定一个要分析的包名 (使用 --package 或 --package-file)")

        for pkg, level in override:
            if level.upper() not in LOG_LEVELS:
                raise click.BadParameter(
                    f"无效的日志级别 '{level}' 用于包 '{pkg}'. 有效值: {', '.join(LOG_LEVELS)}"
                )

        analyzer = Log4jChainAnalyzer(Path(base_dir) if base_dir else None)

        for cfg in config:
            analyzer.add_config_file(Path(cfg))

        for ef in env_file:
            analyzer.add_env_file(Path(ef))

        if load_system_env:
            analyzer.load_system_env()

        for pkg, level in override:
            analyzer.add_cli_override(pkg, level)

        result = analyzer.analyze(packages)

        reporter = Reporter(result)

        if not quiet:
            reporter.print_terminal_summary()

        output_dir = Path(output_dir) if output_dir else Path.cwd()
        
        if json:
            json_path = output_dir / f"{output_name}.json"
            reporter.generate_json(json_path)
            if not quiet:
                click.echo(f"\n📄 JSON 报告已生成: {json_path}")

        if markdown:
            md_path = output_dir / f"{output_name}.md"
            reporter.generate_markdown(md_path)
            if not quiet:
                click.echo(f"📄 Markdown 报告已生成: {md_path}")

        sys.exit(result.exit_code)

    except click.UsageError as e:
        click.echo(f"错误: {e}", err=True)
        sys.exit(ExitCode.INVALID_ARGS)
    except FileNotFoundError as e:
        click.echo(f"错误: 文件未找到 - {e}", err=True)
        sys.exit(ExitCode.CONFIG_NOT_FOUND)
    except Exception as e:
        click.echo(f"未知错误: {e}", err=True)
        sys.exit(ExitCode.UNKNOWN_ERROR)


@main.command()
def list_levels():
    """列出支持的日志级别"""
    click.echo("支持的日志级别（优先级从低到高）:")
    for i, level in enumerate(LOG_LEVELS):
        click.echo(f"  {i}. {level}")


@main.command()
def explain_exit_codes():
    """解释所有退出码的含义"""
    click.echo("退出码说明:")
    for code in sorted(ExitCode, key=lambda x: x.value):
        desc = EXIT_CODE_DESCRIPTIONS.get(code, "未知")
        click.echo(f"  {code.value:2d} - {desc}")


if __name__ == '__main__':
    main()
