import os
import sys
from pathlib import Path
from typing import List, Optional

import click
from rich.console import Console
from rich.panel import Panel

from .scanner import YAMLSecretScanner
from .reporter import Reporter
from .config import ScannerConfig

console = Console()


@click.group()
@click.version_option(version="0.1.0")
def cli():
    """YAML密钥泄漏检测CLI工具"""
    pass


@cli.command()
@click.argument("path", type=click.Path(exists=True, path_type=Path))
@click.option("--config", "-c", type=click.Path(exists=True, path_type=Path), help="配置文件路径")
@click.option("--whitelist", "-w", multiple=True, help="白名单字段路径")
@click.option("--output", "-o", type=click.Path(path_type=Path), help="报告输出目录")
@click.option("--json-output", type=click.Path(path_type=Path), help="JSON结果输出路径")
@click.option("--markdown-output", type=click.Path(path_type=Path), help="Markdown报告输出路径")
@click.option("--min-risk", type=click.Choice(["low", "medium", "high", "critical"]), default="low", help="最低风险等级")
@click.option("--no-color", is_flag=True, help="禁用彩色输出")
@click.option("--verbose", "-v", is_flag=True, help="详细输出")
def scan(
    path: Path,
    config: Optional[Path],
    whitelist: tuple,
    output: Optional[Path],
    json_output: Optional[Path],
    markdown_output: Optional[Path],
    min_risk: str,
    no_color: bool,
    verbose: bool,
):
    """扫描YAML文件中的密钥泄漏

    PATH: 要扫描的文件或目录路径
    """
    if no_color:
        os.environ["NO_COLOR"] = "1"

    console.print(Panel.fit("[bold blue]YAML 密钥泄漏扫描工具[/bold blue]", border_style="blue"))

    scanner_config = ScannerConfig.load(config)
    scanner_config.whitelist.extend(whitelist)
    scanner_config.min_risk_level = min_risk

    scanner = YAMLSecretScanner(scanner_config)

    if verbose:
        console.print(f"[cyan]扫描路径:[/cyan] {path}")
        console.print(f"[cyan]白名单条目:[/cyan] {len(scanner_config.whitelist)} 项")
        console.print(f"[cyan]最低风险等级:[/cyan] {min_risk}")
        console.print()

    with console.status("[bold green]正在扫描..."):
        results = scanner.scan(path)

    reporter = Reporter(results, console)

    reporter.print_summary(verbose=verbose)

    if output:
        output.mkdir(parents=True, exist_ok=True)
        reporter.export_json(output / "results.json")
        reporter.export_markdown(output / "report.md")
        reporter.export_text(output / "summary.txt")
        console.print(f"\n[green]报告已导出到:[/green] {output}")

    if json_output:
        reporter.export_json(json_output)

    if markdown_output:
        reporter.export_markdown(markdown_output)

    has_findings = any(len(r.findings) > 0 for r in results if hasattr(r, 'findings'))
    has_errors = any(len(r.errors) > 0 for r in results if hasattr(r, 'errors'))

    if has_findings or has_errors:
        sys.exit(1)
    sys.exit(0)


@cli.command()
@click.argument("path", type=click.Path(exists=True, path_type=Path))
@click.option("--output", "-o", type=click.Path(path_type=Path), default=Path("whitelist.txt"), help="白名单输出路径")
def gen_whitelist(path: Path, output: Path):
    """生成字段路径白名单模板"""
    from .parser import YAMLParser

    parser = YAMLParser()
    paths = set()

    def collect_paths(yaml_path: Path):
        try:
            result = parser.parse(yaml_path)
            for finding in result.findings:
                paths.add(finding.field_path)
        except Exception:
            pass

    if path.is_file():
        collect_paths(path)
    else:
        for yaml_file in path.rglob("*.yaml"):
            collect_paths(yaml_file)
        for yaml_file in path.rglob("*.yml"):
            collect_paths(yaml_file)

    with open(output, "w") as f:
        for p in sorted(paths):
            f.write(f"{p}\n")

    console.print(f"[green]白名单模板已生成:[/green] {output}")
    console.print(f"共 {len(paths)} 个字段路径")


def main():
    cli()


if __name__ == "__main__":
    main()
