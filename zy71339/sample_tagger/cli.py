from __future__ import annotations

import logging
from pathlib import Path

import click

from . import __version__
from .pipeline import TaggingPipeline

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)

logger = logging.getLogger(__name__)


@click.group()
@click.version_option(version=__version__)
def cli():
    pass


@cli.command()
@click.argument("inputs", nargs=-1, type=click.Path(exists=True, path_type=Path))
@click.option(
    "-o", "--output",
    type=click.Path(path_type=Path),
    default=Path("./reports"),
    help="输出报告目录 (默认: ./reports)",
)
@click.option(
    "--recursive/--no-recursive",
    default=True,
    help="递归扫描子目录 (默认: 开启)",
)
@click.option(
    "--conflict-threshold",
    type=float,
    default=0.3,
    help="多标签冲突阈值 (默认: 0.3)",
)
@click.option(
    "--low-confidence",
    type=float,
    default=0.5,
    help="低置信度标签阈值 (默认: 0.5)",
)
def tag(inputs: tuple[Path], output: Path, recursive: bool, conflict_threshold: float, low_confidence: float):
    """扫描音频文件并自动标注鼓、贝斯、环境声和可疑噪声"""
    if not inputs:
        click.echo("错误: 请提供至少一个输入路径")
        raise SystemExit(1)
    
    click.echo(f"采样音色标签器 v{__version__}")
    click.echo(f"输入路径: {', '.join(str(p) for p in inputs)}")
    click.echo(f"输出目录: {output}")
    click.echo("-" * 60)
    
    try:
        pipeline = TaggingPipeline()
        pipeline.conflict_detector.multi_tag_threshold = conflict_threshold
        pipeline.conflict_detector.low_confidence_threshold = low_confidence
        
        bundle = pipeline.run(
            input_paths=list(inputs),
            output_dir=output,
            recursive=recursive,
        )
        
        click.echo("\n处理完成!")
    except Exception as e:
        logger.exception("处理失败")
        click.echo(f"\n错误: {e}", err=True)
        raise SystemExit(1)


@cli.command()
@click.argument("report_path", type=click.Path(exists=True, path_type=Path))
def inspect(report_path: Path):
    """查看已生成的报告摘要"""
    import json
    
    with open(report_path, encoding="utf-8") as f:
        data = json.load(f)
    
    if "summary" in data:
        summary = data["summary"]
    elif "report" in data and "summary" in data["report"]:
        summary = data["report"]["summary"]
    else:
        click.echo("无法识别报告格式")
        raise SystemExit(1)
    
    click.echo("=" * 60)
    click.echo("报告摘要")
    click.echo("=" * 60)
    click.echo(f"运行ID: {summary.get('run_id', 'N/A')}")
    click.echo(f"生成时间: {summary.get('generated_at', 'N/A')}")
    click.echo(f"处理时间: {summary.get('processing_time_seconds', 0):.2f} 秒")
    click.echo("-" * 60)
    click.echo(f"总文件数: {summary.get('total_files', 0)}")
    click.echo(f"已标注文件: {summary.get('tagged_files', 0)}")
    click.echo(f"静音样本: {summary.get('silent_files', 0)}")
    click.echo(f"可疑噪声: {summary.get('suspicious_files', 0)}")
    click.echo(f"冲突数量: {summary.get('conflict_count', 0)}")
    click.echo(f"重复样本: {summary.get('duplicate_count', 0)}")
    click.echo("-" * 60)
    click.echo("标签分布:")
    for tag, count in summary.get("tag_breakdown", {}).items():
        click.echo(f"  {tag}: {count}")
    click.echo("=" * 60)


@cli.command()
@click.argument("report_path", type=click.Path(exists=True, path_type=Path))
@click.option(
    "--sample-id",
    help="根据样本ID反查详细信息",
)
def lookup(report_path: Path, sample_id: str | None):
    """反查报告中的样本详情"""
    import json
    
    with open(report_path, encoding="utf-8") as f:
        data = json.load(f)
    
    samples = data.get("report", {}).get("samples", []) if "report" in data else data.get("samples", [])
    
    if sample_id:
        found = [s for s in samples if s.get("sample_id") == sample_id]
        if found:
            for s in found:
                click.echo(json.dumps(s, ensure_ascii=False, indent=2))
        else:
            click.echo(f"未找到样本ID: {sample_id}")
    else:
        click.echo("样本列表:")
        for s in samples[:20]:
            click.echo(f"  {s.get('sample_id', '')} - {s.get('file_name', '')} - {s.get('status', '')}")
        if len(samples) > 20:
            click.echo(f"  ... 还有 {len(samples) - 20} 个样本")


@cli.command(name="list-formats")
def list_formats():
    """列出支持的音频格式"""
    from .feature_extractor import SUPPORTED_FORMATS
    click.echo("支持的音频格式:")
    for fmt in sorted(SUPPORTED_FORMATS):
        click.echo(f"  {fmt}")


if __name__ == "__main__":
    cli()
