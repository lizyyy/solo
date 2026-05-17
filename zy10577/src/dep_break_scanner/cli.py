import click
from pathlib import Path
import sys

from . import __version__
from .models import ScanResult
from .scanner import DependencyScanner
from .version_diff import analyze_versions_sync
from .impact_analyzer import ImpactAnalyzer
from .reporter import ReportGenerator


@click.group()
@click.version_option(__version__, "-v", "--version")
def cli():
    """依赖升级破坏面CLI工具 - 分析依赖升级对代码库的影响"""
    pass


@cli.command()
@click.argument("dependency_name")
@click.argument("old_version")
@click.argument("new_version")
@click.option(
    "-s",
    "--source",
    type=click.Path(exists=True, file_okay=False, dir_okay=True, path_type=Path),
    default=".",
    help="源码目录 (默认: 当前目录)",
)
@click.option(
    "-o",
    "--output",
    type=click.Path(file_okay=False, dir_okay=True, path_type=Path),
    default="./break-reports",
    help="输出报告目录 (默认: ./break-reports)",
)
@click.option(
    "--cache-dir",
    type=click.Path(file_okay=False, dir_okay=True, path_type=Path),
    default=None,
    help="缓存目录 (默认: 在源码目录下的临时文件)",
)
@click.option("--no-terminal", is_flag=True, help="不输出终端摘要")
@click.option("--json-only", is_flag=True, help="只输出JSON结果，不生成其他报告")
def scan(
    dependency_name: str,
    old_version: str,
    new_version: str,
    source: Path,
    output: Path,
    cache_dir: Path,
    no_terminal: bool,
    json_only: bool,
):
    """扫描指定依赖的升级影响

    DEPENDENCY_NAME: 依赖包名称 (如: requests)
    OLD_VERSION: 当前版本 (如: 2.25.0)
    NEW_VERSION: 目标升级版本 (如: 2.31.0)
    """
    try:
        click.echo(f"🔍 开始扫描依赖: {dependency_name} {old_version} → {new_version}")
        click.echo(f"📂 源码目录: {source.resolve()}")
        click.echo(f"📤 输出目录: {output.resolve()}")

        scanner = DependencyScanner(dependency_name, source)
        click.echo("\n📝 扫描代码引用...")
        references, test_files, error_samples, files_scanned = scanner.scan()
        click.echo(f"   扫描了 {files_scanned} 个文件")
        click.echo(f"   发现 {len(references)} 个引用")
        click.echo(f"   关联 {len(test_files)} 个测试文件")
        if error_samples:
            click.echo(f"   ⚠️  {len(error_samples)} 个异常样本")

        click.echo("\n📊 分析版本差异...")
        version_diff = analyze_versions_sync(
            dependency_name, old_version, new_version, cache_dir or output / ".cache"
        )

        click.echo("\n🎯 评估影响等级...")
        impact_analyzer = ImpactAnalyzer(references, test_files, version_diff, source)
        impact_groups, test_suggestions = impact_analyzer.analyze()

        result = ScanResult(
            dependency_name=dependency_name,
            old_version=old_version,
            new_version=new_version,
            total_files_scanned=files_scanned,
            total_references=len(references),
            references=references,
            test_files=test_files,
            version_diff=version_diff,
            impact_groups=impact_groups,
            test_suggestions=test_suggestions,
            error_samples=error_samples,
        )

        click.echo("\n📄 生成报告...")
        reporter = ReportGenerator(result, output)

        if json_only:
            json_path = reporter.generate_json_report()
            click.echo(f"   ✅ JSON报告: {json_path}")
            err_path = reporter.generate_error_samples()
            click.echo(f"   ✅ 错误样本: {err_path}")
        else:
            output_files = reporter.generate_all()
            click.echo(f"   ✅ JSON报告: {output_files['json']}")
            click.echo(f"   ✅ Markdown报告: {output_files['markdown']}")
            if error_samples:
                click.echo(f"   ✅ 错误样本: {output_files['errors']}")

        click.echo("\n🎉 扫描完成!")
        return 0

    except KeyboardInterrupt:
        click.echo("\n❌ 操作被用户中断")
        return 1
    except Exception as e:
        click.echo(f"\n❌ 发生错误: {str(e)}", err=True)
        import traceback

        traceback.print_exc()
        return 1


@cli.command()
@click.argument("report_path", type=click.Path(exists=True, path_type=Path))
def view(report_path: Path):
    """查看已生成的报告文件"""
    import json

    try:
        with open(report_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        click.echo(f"📋 报告摘要:")
        click.echo(f"  依赖名称: {data.get('dependency_name', 'N/A')}")
        click.echo(f"  版本: {data.get('old_version', 'N/A')} → {data.get('new_version', 'N/A')}")
        click.echo(f"  引用数: {data.get('total_references', 0)}")
        click.echo(f"  扫描文件数: {data.get('total_files_scanned', 0)}")

        if "impact_groups" in data:
            click.echo("\n  影响分组:")
            for group in data["impact_groups"]:
                level = group.get("impact_level", "unknown").upper()
                file_count = len(group.get("affected_files", []))
                ref_count = len(group.get("references", []))
                click.echo(f"    {level}: {file_count} 文件, {ref_count} 引用")

    except Exception as e:
        click.echo(f"❌ 无法读取报告: {str(e)}", err=True)
        return 1

    return 0


@cli.command()
@click.option(
    "-o",
    "--output",
    type=click.Path(file_okay=False, dir_okay=True, path_type=Path),
    default="./break-reports",
    help="报告目录",
)
def list_reports(output: Path):
    """列出所有已生成的报告"""
    if not output.exists():
        click.echo(f"📭 报告目录不存在: {output}")
        return 0

    files = sorted(output.glob("*.json"))
    md_files = sorted(output.glob("*.md"))

    if not files and not md_files:
        click.echo("📭 没有找到报告文件")
        return 0

    click.echo(f"📂 报告目录: {output.resolve()}")
    click.echo(f"\n  JSON报告 ({len(files)}):")
    for f in files:
        click.echo(f"    {f.name}")

    if md_files:
        click.echo(f"\n  Markdown报告 ({len(md_files)}):")
        for f in md_files:
            click.echo(f"    {f.name}")

    return 0


def main():
    return cli(prog_name="dep-break")


if __name__ == "__main__":
    sys.exit(main())
