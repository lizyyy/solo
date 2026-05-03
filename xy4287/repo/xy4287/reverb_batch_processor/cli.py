"""命令行接口"""

import sys
from pathlib import Path
from typing import Optional, List

import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint

from . import __version__
from .processor import BatchProcessor
from .models import ValidationStatus, AnomalyType

console = Console()


@click.group()
@click.version_option(__version__, '-v', '--version')
@click.help_option('-h', '--help')
def main():
    """混响测量批处理员 - 声学实验室专用工具

    用于批量处理声级计导出的impulse/decay CSV文件，
    自动计算混响时间、清晰度等声学指标。
    """
    pass


@main.command()
@click.argument('input_path', type=click.Path(exists=True, path_type=Path))
@click.option('-o', '--output', type=click.Path(path_type=Path), help='输出目录')
@click.option('-r', '--room', help='房间名称')
@click.option('-R', '--recursive', is_flag=True, help='递归搜索子目录')
@click.option('-f', '--format', type=click.Choice(['markdown', 'csv', 'json', 'all']), 
              default='all', help='输出格式')
@click.option('-v', '--verbose', is_flag=True, help='显示详细信息')
def process(input_path: Path, output: Optional[Path], room: Optional[str], 
            recursive: bool, format: str, verbose: bool):
    """处理测量数据并生成报告

    INPUT_PATH: 输入文件或目录路径
    """
    console.print(Panel.fit(
        f"[bold green]混响测量批处理员 v{__version__}[/bold green]\n"
        f"开始处理: {input_path}",
        title="混响测量批处理员"
    ))

    processor = BatchProcessor()

    with console.status("[bold green]正在处理...") as status:
        if input_path.is_file():
            result = processor.process_files([input_path], room or "measurement")
        elif input_path.is_dir():
            result = processor.process_directory(input_path, room, recursive)
        else:
            console.print(f"[red]错误: 无效的输入路径 {input_path}[/red]")
            sys.exit(1)

    _display_summary(result, verbose)

    if output:
        output.mkdir(parents=True, exist_ok=True)

        from .reporter import ReportExporter
        exporter = ReportExporter()

        formats_to_export = []
        if format == 'all':
            formats_to_export = ['markdown', 'csv', 'json']
        else:
            formats_to_export = [format]

        for fmt in formats_to_export:
            if fmt == 'markdown':
                md_path = exporter.export_markdown(result, output)
                console.print(f"[green]Markdown报告已导出: {md_path}[/green]")
            elif fmt == 'csv':
                csv_path = exporter.export_csv(result, output)
                console.print(f"[green]CSV报告已导出: {csv_path}[/green]")
            elif fmt == 'json':
                json_path = exporter.export_json(result, output)
                console.print(f"[green]JSON报告已导出: {json_path}[/green]")

        console.print(f"\n[bold green]所有报告已导出到: {output}[/bold green]")
    else:
        console.print("\n[yellow]提示: 使用 -o 参数指定输出目录以生成报告[/yellow]")


@main.command()
@click.argument('input_path', type=click.Path(exists=True, path_type=Path))
@click.option('-R', '--recursive', is_flag=True, help='递归搜索子目录')
@click.option('-v', '--verbose', is_flag=True, help='显示详细信息')
def validate(input_path: Path, recursive: bool, verbose: bool):
    """仅验证数据质量，不计算指标

    INPUT_PATH: 输入文件或目录路径
    """
    console.print(Panel.fit(
        f"[bold blue]数据验证模式[/bold blue]\n"
        f"验证路径: {input_path}",
        title="混响测量批处理员"
    ))

    from .csv_parser import parse_csv_file
    from .validator import validate_measurement, DataValidator

    validator = DataValidator()

    csv_files: List[Path] = []
    if input_path.is_file():
        csv_files = [input_path]
    elif input_path.is_dir():
        if recursive:
            csv_files = list(input_path.rglob('*.csv'))
        else:
            csv_files = list(input_path.glob('*.csv'))

    if not csv_files:
        console.print(f"[yellow]未找到CSV文件[/yellow]")
        return

    table = Table(title="数据验证结果")
    table.add_column("文件", style="cyan")
    table.add_column("状态", style="bold")
    table.add_column("测点/频段", style="green")
    table.add_column("消息", style="yellow")

    total_files = 0
    passed_files = 0
    warning_files = 0
    failed_files = 0

    for csv_file in csv_files:
        total_files += 1

        measurements, parse_validation = parse_csv_file(csv_file)

        if parse_validation.status == ValidationStatus.FAIL:
            failed_files += 1
            table.add_row(
                csv_file.name,
                "[red]失败[/red]",
                "-",
                "\n".join(parse_validation.messages)
            )
            continue

        for measurement in measurements:
            validation = validator.validate(measurement)
            band = measurement.metadata.get('band', '未知')

            if validation.status == ValidationStatus.PASS:
                passed_files += 1
                table.add_row(
                    csv_file.name,
                    "[green]通过[/green]",
                    band,
                    "数据质量良好"
                )
            elif validation.status == ValidationStatus.WARNING:
                warning_files += 1
                table.add_row(
                    csv_file.name,
                    "[yellow]警告[/yellow]",
                    band,
                    "\n".join(validation.messages)
                )
            else:
                failed_files += 1
                table.add_row(
                    csv_file.name,
                    "[red]失败[/red]",
                    band,
                    "\n".join(validation.messages)
                )

    console.print(table)

    summary_table = Table(title="验证汇总")
    summary_table.add_column("统计项", style="cyan")
    summary_table.add_column("数量", style="bold")
    summary_table.add_row("总文件数", str(total_files))
    summary_table.add_row("[green]通过[/green]", str(passed_files))
    summary_table.add_row("[yellow]警告[/yellow]", str(warning_files))
    summary_table.add_row("[red]失败[/red]", str(failed_files))

    console.print(summary_table)


@main.command()
@click.option('--output', '-o', type=click.Path(path_type=Path), required=True,
              help='输出目录路径')
@click.option('--num-files', '-n', type=int, default=3, help='生成的示例文件数量')
@click.option('--include-anomalies', is_flag=True, help='包含异常示例数据')
def generate_samples(output: Path, num_files: int, include_anomalies: bool):
    """生成示例数据用于测试

    创建模拟的混响测量CSV文件，包含正常和异常情况。
    """
    console.print(Panel.fit(
        f"[bold magenta]生成示例数据[/bold magenta]\n"
        f"输出目录: {output}\n"
        f"文件数量: {num_files}",
        title="混响测量批处理员"
    ))

    output.mkdir(parents=True, exist_ok=True)

    from .sample_data import SampleDataGenerator

    generator = SampleDataGenerator()

    files_generated = []

    for i in range(num_files):
        rt = 0.8 + (i * 0.3)
        snr = 35 - (i * 5)

        file_path = output / f"room1_point{i+1}_1kHz.csv"
        generator.generate_decay_csv(
            file_path,
            rt60=rt,
            snr_db=snr,
            sample_rate=100.0,
            duration=5.0
        )
        files_generated.append(file_path)
        console.print(f"[green]已生成: {file_path.name} (RT60={rt:.2f}s, SNR={snr:.0f}dB)[/green]")

    if include_anomalies:
        clipping_path = output / "anomaly_clipping.csv"
        generator.generate_clipping_csv(clipping_path)
        files_generated.append(clipping_path)
        console.print(f"[red]已生成异常示例: {clipping_path.name} (削波)[/red]")

        noisy_path = output / "anomaly_noise.csv"
        generator.generate_high_noise_csv(noisy_path)
        files_generated.append(noisy_path)
        console.print(f"[red]已生成异常示例: {noisy_path.name} (高噪声)[/red]")

        multi_reflect_path = output / "anomaly_reflections.csv"
        generator.generate_multiple_reflections_csv(multi_reflect_path)
        files_generated.append(multi_reflect_path)
        console.print(f"[red]已生成异常示例: {multi_reflect_path.name} (多次反射)[/red]")

    console.print(f"\n[bold green]共生成 {len(files_generated)} 个示例文件[/bold green]")
    console.print(f"[bold green]输出目录: {output}[/bold green]")


def _display_summary(result, verbose: bool):
    """显示处理摘要"""
    console.print("\n[bold]处理摘要:[/bold]")

    table = Table(title="批处理统计")
    table.add_column("项目", style="cyan")
    table.add_column("数值", style="bold")

    table.add_row("总测量数", str(result.total_measurements))
    table.add_row("[green]成功处理[/green]", str(result.passed_measurements))
    table.add_row("[red]处理失败[/red]", str(result.failed_measurements))
    table.add_row("房间数", str(len(result.rooms)))

    total_points = sum(len(room.points) for room in result.rooms.values())
    table.add_row("测点数", str(total_points))

    console.print(table)

    if verbose:
        for room_id, room in result.rooms.items():
            console.print(f"\n[bold]房间: {room.name}[/bold]")

            point_table = Table()
            point_table.add_column("测点", style="cyan")
            point_table.add_column("频段", style="green")
            point_table.add_column("RT20 (s)", style="yellow")
            point_table.add_column("RT30 (s)", style="yellow")
            point_table.add_column("EDT (s)", style="yellow")
            point_table.add_column("C80 (dB)", style="magenta")
            point_table.add_column("置信度", style="blue")
            point_table.add_column("状态", style="bold")

            for point_id, point in room.points.items():
                for band, metrics in point.metrics.items():
                    rt20 = f"{metrics.rt20.rt_value:.3f}" if metrics.rt20 else "-"
                    rt30 = f"{metrics.rt30.rt_value:.3f}" if metrics.rt30 else "-"
                    edt = f"{metrics.edt.rt_value:.3f}" if metrics.edt else "-"
                    c80 = f"{metrics.c80:.1f}" if metrics.c80 is not None else "-"

                    conf = "-"
                    if metrics.rt30:
                        conf = f"{metrics.rt30.confidence:.1%}"

                    status = "[green]正常[/green]"
                    if metrics.rt30 and metrics.rt30.anomalies:
                        status = "[yellow]异常[/yellow]"

                    point_table.add_row(
                        point.name, band, rt20, rt30, edt, c80, conf, status
                    )

            console.print(point_table)


if __name__ == '__main__':
    main()
