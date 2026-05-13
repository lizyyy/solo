import click
import os
from typing import List
from .loader import DataLoader
from .analyzer import TraceAnalyzer
from .formatter import OutputFormatter


@click.group()
@click.option(
    "--data-dir",
    "-d",
    default="data",
    show_default=True,
    help="数据目录路径"
)
@click.option(
    "--output-format",
    "-f",
    type=click.Choice(["text", "json"]),
    default="text",
    show_default=True,
    help="输出格式"
)
@click.pass_context
def cli(ctx: click.Context, data_dir: str, output_format: str):
    """部署制品追溯 CLI 工具

    支持 trace、compare、verify、report 四个主要命令。
    """
    ctx.ensure_object(dict)
    ctx.obj["data_dir"] = data_dir
    ctx.obj["output_format"] = output_format
    ctx.obj["loader"] = DataLoader(data_dir)
    ctx.obj["analyzer"] = TraceAnalyzer()
    ctx.obj["formatter"] = OutputFormatter()


@cli.command()
@click.argument("version")
@click.option("--environment", "-e", help="环境名称（可选）")
@click.pass_context
def trace(ctx: click.Context, version: str, environment: str = None):
    """追溯指定版本的制品信息

    VERSION: 制品版本号
    """
    loader: DataLoader = ctx.obj["loader"]
    analyzer: TraceAnalyzer = ctx.obj["analyzer"]
    formatter: OutputFormatter = ctx.obj["formatter"]
    output_format = ctx.obj["output_format"]

    artifacts = loader.load_all()

    if environment:
        matches = loader.get_artifact_by_version(version, environment)
    else:
        matches = loader.get_artifact_by_version(version)

    if not matches:
        click.echo(f"未找到版本 {version} 的制品")
        ctx.exit(1)

    if len(matches) > 1:
        click.echo(f"找到 {len(matches)} 个同名版本的制品：")
        for i, art in enumerate(matches, 1):
            click.echo(f"  [{i}] {art.name}:{art.version} ({art.environment})")
        click.echo("")

    for artifact in matches:
        result = analyzer.trace_artifact(artifact, artifacts)
        output = formatter.format_trace(result, output_format)
        click.echo(output)


@cli.command()
@click.argument("versions", nargs=-1, required=True)
@click.pass_context
def compare(ctx: click.Context, versions: List[str]):
    """对比多个版本的制品信息

    VERSIONS: 一个或多个版本号
    """
    loader: DataLoader = ctx.obj["loader"]
    analyzer: TraceAnalyzer = ctx.obj["analyzer"]
    formatter: OutputFormatter = ctx.obj["formatter"]
    output_format = ctx.obj["output_format"]

    artifacts = loader.load_all()

    artifacts_to_compare = []
    for version in versions:
        matches = loader.get_artifact_by_version(version)
        if not matches:
            click.echo(f"警告: 未找到版本 {version} 的制品")
            continue
        artifacts_to_compare.extend(matches)

    if len(artifacts_to_compare) < 2:
        click.echo("错误: 需要至少 2 个制品进行对比")
        ctx.exit(1)

    result = analyzer.compare_artifacts(artifacts_to_compare)
    output = formatter.format_compare(result, output_format)
    click.echo(output)


@cli.command()
@click.argument("version")
@click.option("--environment", "-e", help="环境名称（可选）")
@click.pass_context
def verify(ctx: click.Context, version: str, environment: str = None):
    """验证制品元数据完整性

    VERSION: 制品版本号
    """
    loader: DataLoader = ctx.obj["loader"]
    analyzer: TraceAnalyzer = ctx.obj["analyzer"]
    formatter: OutputFormatter = ctx.obj["formatter"]
    output_format = ctx.obj["output_format"]

    artifacts = loader.load_all()

    if environment:
        matches = loader.get_artifact_by_version(version, environment)
    else:
        matches = loader.get_artifact_by_version(version)

    if not matches:
        click.echo(f"未找到版本 {version} 的制品")
        ctx.exit(1)

    all_valid = True
    for artifact in matches:
        result = analyzer.verify_artifact(artifact)
        if not result.is_valid:
            all_valid = False
        output = formatter.format_verify(result, output_format)
        click.echo(output)

    if not all_valid:
        ctx.exit(1)


@cli.command()
@click.option("--environment", "-e", help="仅显示指定环境的制品（可选）")
@click.pass_context
def report(ctx: click.Context, environment: str = None):
    """生成部署制品追溯汇总报告"""
    loader: DataLoader = ctx.obj["loader"]
    analyzer: TraceAnalyzer = ctx.obj["analyzer"]
    formatter: OutputFormatter = ctx.obj["formatter"]
    output_format = ctx.obj["output_format"]

    artifacts = loader.load_all()

    if environment:
        artifacts = [a for a in artifacts if a.environment == environment]
        if not artifacts:
            click.echo(f"未找到环境 {environment} 的制品")
            ctx.exit(1)

    report = analyzer.generate_report(artifacts)
    output = formatter.format_report(report, output_format)
    click.echo(output)


def main():
    cli()


if __name__ == "__main__":
    main()
