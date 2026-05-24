import os
import sys
import click
from pathlib import Path
from typing import List, Set, Optional
from rich.console import Console
from rich.panel import Panel
from rich.progress import Progress, SpinnerColumn, TextColumn, BarColumn, TaskProgressColumn, TimeRemainingColumn

from .exif_processor import ExifProcessor, CleanRules, ExifStatus
from .report_generator import ReportGenerator


console = Console()
error_console = Console(stderr=True, style="bold red")


def parse_fields_list(fields_str: Optional[str]) -> Set[str]:
    if not fields_str:
        return set()
    return {f.strip() for f in fields_str.split(",") if f.strip()}


def validate_input_path(ctx, param, value):
    if not value:
        return value
    path = Path(value)
    if not path.exists():
        raise click.BadParameter(f"路径不存在: {value}")
    if not path.is_dir() and not path.is_file():
        raise click.BadParameter(f"不是有效的文件或目录: {value}")
    return str(path.resolve())


def validate_output_path(ctx, param, value):
    if not value:
        return value
    path = Path(value)
    if path.exists() and path.is_file():
        raise click.BadParameter(f"输出路径不能是已存在的文件: {value}")
    return str(path.resolve())


def validate_extensions(ctx, param, value):
    if not value:
        return [".jpg", ".jpeg", ".png", ".tiff", ".webp"]
    exts = []
    for ext in value.split(","):
        ext = ext.strip().lower()
        if not ext.startswith("."):
            ext = "." + ext
        exts.append(ext)
    return exts


@click.group(invoke_without_command=True)
@click.version_option(version="1.0.0", prog_name="exifclean")
@click.pass_context
def main(ctx):
    """图片 EXIF 合规清理工具 - 批量移除敏感元数据，保留归档信息
    
    批量处理图片目录，移除 GPS 定位、设备信息等敏感数据，保留拍摄日期用于归档。
    支持生成终端摘要、JSON 报告和 Markdown 报告。
    """
    if ctx.invoked_subcommand is None:
        click.echo(ctx.get_help())


@main.command()
@click.argument("input_path", callback=validate_input_path)
@click.option("-o", "--output-dir", "output_dir", callback=validate_output_path,
              help="输出目录（不指定则覆盖原文件）")
@click.option("--report-dir", default="./exif_reports", callback=validate_output_path,
              help="报告输出目录（默认: ./exif_reports）")
@click.option("--no-preserve-date", is_flag=True,
              help="不保留拍摄日期（默认: 保留）")
@click.option("--preserve-camera", is_flag=True,
              help="保留相机型号信息（默认: 移除）")
@click.option("--no-preserve-orientation", is_flag=True,
              help="不保留图片方向信息（默认: 保留）")
@click.option("--keep-gps", is_flag=True,
              help="保留 GPS 定位信息（默认: 移除）")
@click.option("--keep-thumbnail", is_flag=True,
              help="保留缩略图元数据（默认: 移除）")
@click.option("--preserve-fields", 
              help="自定义保留的 EXIF 字段，用逗号分隔")
@click.option("--remove-fields",
              help="自定义移除的 EXIF 字段，用逗号分隔")
@click.option("--extensions", callback=validate_extensions,
              help="处理的文件扩展名，逗号分隔（默认: jpg,jpeg,png,tiff,webp）")
@click.option("--no-json-report", is_flag=True,
              help="不生成 JSON 报告")
@click.option("--no-markdown-report", is_flag=True,
              help="不生成 Markdown 报告")
@click.option("--detailed-json", is_flag=True,
              help="生成详细的 JSON 报告（包含 EXIF 字段摘要）")
@click.option("--dry-run", is_flag=True,
              help="仅预览，不实际修改文件")
@click.option("--quiet", "-q", is_flag=True,
              help="静默模式，减少输出")
def clean(
    input_path: str,
    output_dir: Optional[str],
    report_dir: str,
    no_preserve_date: bool,
    preserve_camera: bool,
    no_preserve_orientation: bool,
    keep_gps: bool,
    keep_thumbnail: bool,
    preserve_fields: Optional[str],
    remove_fields: Optional[str],
    extensions: List[str],
    no_json_report: bool,
    no_markdown_report: bool,
    detailed_json: bool,
    dry_run: bool,
    quiet: bool,
):
    """清理图片 EXIF 元数据
    
    INPUT_PATH: 输入文件或目录路径
    """
    try:
        rules = CleanRules(
            preserve_date=not no_preserve_date,
            preserve_camera=preserve_camera,
            preserve_orientation=not no_preserve_orientation,
            remove_gps=not keep_gps,
            remove_thumbnail=not keep_thumbnail,
            custom_preserve_fields=parse_fields_list(preserve_fields),
            custom_remove_fields=parse_fields_list(remove_fields),
        )

        processor = ExifProcessor(rules=rules)

        if not quiet:
            console.print(Panel.fit(
                "[bold green]图片 EXIF 合规清理工具[/bold green]",
                border_style="green"
            ))
            console.print()
            console.print(f"[cyan]输入路径:[/cyan] {input_path}")
            if output_dir:
                console.print(f"[cyan]输出目录:[/cyan] {output_dir}")
            else:
                console.print("[yellow]警告: 未指定输出目录，将直接覆盖原文件[/yellow]")
            console.print(f"[cyan]报告目录:[/cyan] {report_dir}")
            console.print(f"[cyan]处理扩展名:[/cyan] {', '.join(extensions)}")
            
            if dry_run:
                console.print()
                console.print(Panel("[yellow]预览模式: 不会实际修改文件[/yellow]", border_style="yellow"))
            console.print()

        input_path_obj = Path(input_path)
        
        if input_path_obj.is_file():
            files_to_process = [input_path_obj]
        else:
            files_to_process = [
                f for f in input_path_obj.rglob("*")
                if f.is_file() and f.suffix.lower() in extensions
            ]

        if not files_to_process:
            error_console.print("未找到需要处理的图片文件")
            sys.exit(3)

        if not quiet:
            console.print(f"发现 {len(files_to_process)} 个待处理文件")
            console.print()

        actual_output_dir = None if dry_run else output_dir
        
        with Progress(
            SpinnerColumn(),
            TextColumn("[progress.description]{task.description}"),
            BarColumn(),
            TaskProgressColumn(),
            TimeRemainingColumn(),
            console=console,
            disable=quiet,
        ) as progress:
            task = progress.add_task("处理中...", total=len(files_to_process))
            
            for file_path in files_to_process:
                if input_path_obj.is_file():
                    rel_path = file_path.name
                else:
                    rel_path = str(file_path.relative_to(input_path_obj))
                
                progress.update(task, description=f"处理: {rel_path[:50]}")
                
                if actual_output_dir:
                    output_path = str(Path(actual_output_dir) / rel_path)
                else:
                    output_path = None if dry_run else str(file_path)
                
                processor.process_image(str(file_path), output_path)
                progress.advance(task)

        report_generator = ReportGenerator(processor.records)

        if not quiet:
            report_generator.print_terminal_summary()

        os.makedirs(report_dir, exist_ok=True)

        if not no_json_report:
            json_path = os.path.join(report_dir, "exif_report.json")
            if detailed_json:
                report_generator.generate_detailed_json(json_path)
            else:
                report_generator.generate_json(json_path)
            if not quiet:
                console.print(f"[green]✓[/green] JSON 报告已生成: {json_path}")

        if not no_markdown_report:
            md_path = os.path.join(report_dir, "exif_report.md")
            report_generator.generate_markdown(md_path)
            if not quiet:
                console.print(f"[green]✓[/green] Markdown 报告已生成: {md_path}")

        if not quiet:
            console.print()

        exit_code = report_generator.get_exit_code()
        sys.exit(exit_code)

    except Exception as e:
        error_console.print(f"处理失败: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(99)


@main.command("inspect")
@click.argument("file_path", callback=validate_input_path)
@click.option("--all", "show_all", is_flag=True,
              help="显示所有 EXIF 字段（默认只显示关键字段）")
@click.option("--json", "output_json", is_flag=True,
              help="以 JSON 格式输出")
def inspect(file_path: str, show_all: bool, output_json: bool):
    """查看图片 EXIF 信息
    
    FILE_PATH: 图片文件路径
    """
    try:
        processor = ExifProcessor()
        exif_dict, error = processor.read_exif(file_path)
        
        if error:
            error_console.print(f"读取失败: {error}")
            sys.exit(1)
        
        if exif_dict is None:
            console.print("[yellow]该图片无 EXIF 数据[/yellow]")
            sys.exit(0)

        if output_json:
            import json
            serializable = processor._exif_to_serializable(exif_dict)
            console.print(json.dumps(serializable, ensure_ascii=False, indent=2))
            return

        console.print(Panel.fit(f"[bold blue]EXIF 信息: {Path(file_path).name}[/bold blue]"))
        console.print()

        key_fields = {
            "DateTimeOriginal": "拍摄时间",
            "DateTimeDigitized": "数字化时间",
            "Make": "相机厂商",
            "Model": "相机型号",
            "Software": "软件",
            "Orientation": "方向",
        }

        found_keys = {}
        all_fields = []

        for ifd, data in exif_dict.items():
            if ifd == "thumbnail":
                continue
            if isinstance(data, dict):
                for tag, value in data.items():
                    tag_name = processor._get_tag_name(ifd, tag)
                    if isinstance(value, bytes):
                        value_str = value.decode("utf-8", errors="replace")[:100]
                    else:
                        value_str = str(value)[:100]
                    
                    if tag_name in key_fields:
                        found_keys[key_fields[tag_name]] = value_str
                    
                    all_fields.append((f"{ifd}:{tag_name}", value_str))

        if found_keys:
            console.print("[bold]关键字段:[/bold]")
            for name, value in found_keys.items():
                console.print(f"  [cyan]{name}:[/cyan] {value}")
            console.print()

        if "GPS" in exif_dict and exif_dict["GPS"]:
            console.print("[bold red]⚠ 发现 GPS 定位数据[/bold red]")
            console.print(f"  GPS 字段数: {len(exif_dict['GPS'])}")
            console.print()

        if exif_dict.get("1st") or exif_dict.get("thumbnail"):
            console.print("[bold yellow]⚠ 发现缩略图元数据[/bold yellow]")
            console.print()

        if show_all:
            console.print("[bold]所有字段:[/bold]")
            for field_name, value in sorted(all_fields):
                console.print(f"  [cyan]{field_name}:[/cyan] {value}")
        else:
            console.print("[dim]使用 --all 参数查看所有 EXIF 字段[/dim]")

    except Exception as e:
        error_console.print(f"检查失败: {str(e)}")
        sys.exit(99)


@main.command("ls")
@click.argument("input_dir", callback=validate_input_path)
@click.option("--extensions", callback=validate_extensions,
              help="过滤的文件扩展名，逗号分隔")
def list_images(input_dir: str, extensions: List[str]):
    """列出目录中的图片文件
    
    INPUT_DIR: 输入目录路径
    """
    input_path = Path(input_dir)
    
    if input_path.is_file():
        files = [input_path]
    else:
        files = [
            f for f in input_path.rglob("*")
            if f.is_file() and f.suffix.lower() in extensions
        ]

    if not files:
        console.print("[yellow]未找到图片文件[/yellow]")
        return

    processor = ExifProcessor()
    
    console.print(f"找到 {len(files)} 个图片文件:")
    console.print()
    
    for f in sorted(files):
        exif_dict, _ = processor.read_exif(str(f))
        has_exif = exif_dict is not None
        has_gps = exif_dict is not None and bool(exif_dict.get("GPS"))
        
        status = []
        if has_exif:
            status.append("[green]EXIF[/green]")
        if has_gps:
            status.append("[bold red]GPS[/bold red]")
        
        status_str = f" ({', '.join(status)})" if status else ""
        console.print(f"  {f.name}{status_str}")


if __name__ == "__main__":
    main()
