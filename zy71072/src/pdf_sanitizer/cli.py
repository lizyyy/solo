import os
import sys
import time
import logging
from pathlib import Path
from typing import List, Optional
import json

import click
from rich.console import Console
from rich.panel import Panel

from . import __version__
from .processor import PDFProcessor
from .models import SanitizationRule
from .result import BatchResult, SanitizationResult, calculate_file_hash
from .report import ReportGenerator
from .constants import (
    ExitCode, EXIT_CODE_DESCRIPTIONS,
    PDFEncryptedError, PDFCorruptError, IncrementalUpdateError,
    SanitizerError
)

console = Console()
logger = logging.getLogger(__name__)


def setup_logging(verbose: bool = False):
    level = logging.DEBUG if verbose else logging.WARNING
    logging.basicConfig(
        level=level,
        format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    )


def load_rule_config(config_path: Optional[str]) -> SanitizationRule:
    if not config_path:
        return SanitizationRule()
    
    config_file = Path(config_path)
    if not config_file.exists():
        raise SanitizerError(f"配置文件不存在: {config_path}", ExitCode.CONFIG_ERROR)
    
    try:
        with open(config_file, 'r', encoding='utf-8') as f:
            config = json.load(f)
        return SanitizationRule.from_dict(config)
    except json.JSONDecodeError as e:
        raise SanitizerError(f"配置文件格式错误: {e}", ExitCode.CONFIG_ERROR)
    except Exception as e:
        raise SanitizerError(f"加载配置文件失败: {e}", ExitCode.CONFIG_ERROR)


def collect_pdf_files(input_paths: List[str]) -> List[Path]:
    pdf_files = []
    
    for path_str in input_paths:
        path = Path(path_str)
        if not path.exists():
            console.print(f"[yellow]警告: 路径不存在，跳过 - {path}[/yellow]")
            continue
        
        if path.is_file():
            if path.suffix.lower() == '.pdf':
                pdf_files.append(path.resolve())
            else:
                console.print(f"[yellow]警告: 不是PDF文件，跳过 - {path}[/yellow]")
        elif path.is_dir():
            for pdf_path in path.rglob('*.pdf'):
                if pdf_path.is_file():
                    pdf_files.append(pdf_path.resolve())
    
    return sorted(set(pdf_files))


def generate_output_path(input_path: Path, output_dir: Path, 
                         suffix: str = "_sanitized", 
                         overwrite: bool = False) -> Path:
    output_name = f"{input_path.stem}{suffix}{input_path.suffix}"
    output_path = output_dir / output_name
    
    if output_path.exists() and not overwrite:
        counter = 1
        while True:
            output_name = f"{input_path.stem}{suffix}_{counter}{input_path.suffix}"
            output_path = output_dir / output_name
            if not output_path.exists():
                break
            counter += 1
    
    return output_path


def process_single_file(
    input_path: Path,
    output_dir: Path,
    rule: SanitizationRule,
    password: Optional[str] = None,
    overwrite: bool = False,
    fail_on_incremental: bool = False,
    force_rewrite: bool = True
) -> SanitizationResult:
    start_time = time.time()
    
    result = SanitizationResult(
        input_file=str(input_path),
        output_file=""
    )
    
    try:
        result.file_hash = calculate_file_hash(str(input_path))
        
        with PDFProcessor(str(input_path), password=password) as processor:
            result.has_incremental_updates = processor.check_incremental_updates()
            
            if result.has_incremental_updates and fail_on_incremental:
                raise IncrementalUpdateError(
                    "检测到增量更新残留，为确保安全请手动处理或使用 --allow-incremental 允许处理"
                )
            
            output_path = generate_output_path(input_path, output_dir, overwrite=overwrite)
            result.output_file = str(output_path)
            
            sanitize_result = processor.sanitize(
                rule=rule,
                output_path=str(output_path),
                force_full_rewrite=force_rewrite
            )
            
            result = sanitize_result
            result.file_hash = calculate_file_hash(str(input_path))
            result.output_hash = calculate_file_hash(str(output_path))
            result.exit_code = ExitCode.SUCCESS
            
    except PDFEncryptedError as e:
        result.success = False
        result.error_message = str(e)
        result.exit_code = ExitCode.PDF_ENCRYPTED
    except PDFCorruptError as e:
        result.success = False
        result.error_message = str(e)
        result.exit_code = ExitCode.PDF_CORRUPT
    except IncrementalUpdateError as e:
        result.success = False
        result.error_message = str(e)
        result.exit_code = ExitCode.INCREMENTAL_UPDATE_DETECTED
    except PermissionError as e:
        result.success = False
        result.error_message = f"权限错误: {e}"
        result.exit_code = ExitCode.PERMISSION_ERROR
    except Exception as e:
        logger.exception(f"处理文件失败: {input_path}")
        result.success = False
        result.error_message = f"未知错误: {str(e)}"
        result.exit_code = ExitCode.UNKNOWN_ERROR
    
    result.processing_time = time.time() - start_time
    return result


@click.group()
@click.version_option(version=__version__, prog_name='pdf-sanitizer')
@click.option('-v', '--verbose', is_flag=True, help='显示详细日志')
def cli(verbose: bool):
    """PDF 元数据脱敏 CLI 工具
    
    清理 PDF 文件中的元数据、批注和隐藏附件，用于法务发外部材料前的脱敏处理。
    """
    setup_logging(verbose)


@cli.command()
@click.argument('inputs', nargs=-1, type=click.Path(exists=False), required=True)
@click.option('-o', '--output-dir', type=click.Path(), default='./sanitized',
              help='输出目录 (默认: ./sanitized)')
@click.option('-p', '--password', help='加密PDF的密码')
@click.option('--overwrite', is_flag=True, help='覆盖已存在的输出文件')
@click.option('--suffix', default='_sanitized', help='输出文件名后缀 (默认: _sanitized)')
@click.option('--config', type=click.Path(exists=True), help='脱敏规则配置文件(JSON)')
@click.option('--keep-metadata', is_flag=True, help='保留元数据')
@click.option('--keep-annotations', is_flag=True, help='保留批注')
@click.option('--keep-attachments', is_flag=True, help='保留附件')
@click.option('--fail-on-incremental', is_flag=True, 
              help='检测到增量更新时失败（默认：警告并继续）')
@click.option('--no-report', is_flag=True, help='不生成报告文件')
@click.option('--report-dir', type=click.Path(), help='报告输出目录（默认与输出目录相同）')
def sanitize(
    inputs,
    output_dir,
    password,
    overwrite,
    suffix,
    config,
    keep_metadata,
    keep_annotations,
    keep_attachments,
    fail_on_incremental,
    no_report,
    report_dir
):
    """对PDF文件进行脱敏处理
    
    INPUTS 可以是一个或多个PDF文件或目录。如果是目录，将递归处理所有PDF文件。
    """
    output_path = Path(output_dir).resolve()
    output_path.mkdir(parents=True, exist_ok=True)
    
    try:
        rule = load_rule_config(config)
    except SanitizerError as e:
        console.print(f"[red]错误: {e}[/red]")
        sys.exit(e.exit_code)
    
    if keep_metadata:
        rule.clean_metadata = False
    if keep_annotations:
        rule.clean_annotations = False
    if keep_attachments:
        rule.clean_attachments = False
    
    pdf_files = collect_pdf_files(inputs)
    
    if not pdf_files:
        console.print("[yellow]未找到任何PDF文件[/yellow]")
        sys.exit(ExitCode.NO_FILES_PROCESSED)
    
    console.print()
    console.print(Panel.fit(
        f"[bold cyan]开始处理 {len(pdf_files)} 个PDF文件[/bold cyan]",
        border_style="cyan"
    ))
    console.print()
    
    batch_result = BatchResult(
        output_directory=str(output_path),
        total_files=len(pdf_files),
        rule_config=rule.__dict__
    )
    
    with click.progressbar(
        pdf_files,
        label='处理进度',
        show_eta=True,
        item_show_func=lambda p: p.name if p else ''
    ) as files:
        for input_file in files:
            result = process_single_file(
                input_path=input_file,
                output_dir=output_path,
                rule=rule,
                password=password,
                overwrite=overwrite,
                fail_on_incremental=fail_on_incremental
            )
            batch_result.results.append(result)
            if result.success:
                batch_result.success_count += 1
            else:
                batch_result.failed_count += 1
    
    if not no_report:
        report_directory = Path(report_dir).resolve() if report_dir else output_path
        reporter = ReportGenerator(batch_result, str(report_directory))
        reporter.generate_all()
    
    if batch_result.failed_count == 0 and batch_result.success_count > 0:
        exit_code = ExitCode.SUCCESS
    elif batch_result.success_count > 0:
        exit_code = ExitCode.PARTIAL_SUCCESS
    else:
        exit_code = ExitCode.NO_FILES_PROCESSED
    
    console.print(f"[bold]完成! 退出码: {exit_code.value} ({EXIT_CODE_DESCRIPTIONS[exit_code]})[/bold]")
    sys.exit(exit_code)


@cli.command()
@click.argument('inputs', nargs=-1, type=click.Path(exists=True), required=True)
@click.option('-f', '--format', 'output_format', 
              type=click.Choice(['text', 'json', 'markdown']), 
              default='text', help='输出格式')
@click.option('-p', '--password', help='加密PDF的密码')
def scan(inputs, output_format, password):
    """扫描PDF文件，显示敏感信息但不修改
    
    显示文件中的元数据、批注和附件信息，用于检查脱敏前的状态。
    """
    pdf_files = collect_pdf_files(inputs)
    
    if not pdf_files:
        console.print("[yellow]未找到任何PDF文件[/yellow]")
        sys.exit(ExitCode.NO_FILES_PROCESSED)
    
    results = []
    
    for input_file in pdf_files:
        try:
            with PDFProcessor(str(input_file), password=password) as processor:
                metadata = processor.read_metadata()
                annotations = processor.scan_annotations()
                attachments = processor.scan_attachments()
                has_incremental = processor.check_incremental_updates()
                
                results.append({
                    "file": str(input_file),
                    "page_count": processor.get_page_count(),
                    "encrypted": processor.is_encrypted(),
                    "has_incremental_updates": has_incremental,
                    "metadata": metadata.to_dict(),
                    "annotations_count": len(annotations),
                    "annotations": [a.to_dict() for a in annotations],
                    "attachments_count": len(attachments),
                    "attachments": [a.to_dict() for a in attachments]
                })
        except Exception as e:
            results.append({
                "file": str(input_file),
                "error": str(e)
            })
    
    if output_format == 'json':
        print(json.dumps(results, indent=2, ensure_ascii=False))
    elif output_format == 'markdown':
        print("# PDF 扫描报告\n")
        for r in results:
            print(f"## {Path(r['file']).name}\n")
            if 'error' in r:
                print(f"**错误**: {r['error']}\n")
                continue
            print(f"- 页数: {r['page_count']}")
            print(f"- 加密: {'是' if r['encrypted'] else '否'}")
            print(f"- 增量更新: {'是' if r['has_incremental_updates'] else '否'}")
            print(f"- 批注数量: {r['annotations_count']}")
            print(f"- 附件数量: {r['attachments_count']}")
            print()
    else:
        for r in results:
            console.print(f"[cyan]{Path(r['file']).name}[/cyan]")
            if 'error' in r:
                console.print(f"  [red]错误: {r['error']}[/red]")
                continue
            console.print(f"  页数: {r['page_count']}")
            console.print(f"  加密: {'是' if r['encrypted'] else '否'}")
            if r['has_incremental_updates']:
                console.print(f"  [yellow]⚠️ 增量更新: 是[/yellow]")
            if r['annotations_count'] > 0:
                console.print(f"  [yellow]批注: {r['annotations_count']} 个[/yellow]")
            if r['attachments_count'] > 0:
                console.print(f"  [yellow]附件: {r['attachments_count']} 个[/yellow]")
            if not r['metadata'].get('is_empty', True):
                console.print(f"  [yellow]包含元数据[/yellow]")
            console.print()


@cli.command()
def exitcodes():
    """显示所有退出码及其说明"""
    console.print()
    console.print("[bold cyan]PDF 脱敏工具退出码说明[/bold cyan]")
    console.print()
    
    for code in ExitCode:
        console.print(f"  [bold]{code.value:2d}[/bold] - {EXIT_CODE_DESCRIPTIONS[code]}")
    console.print()


def main():
    try:
        cli()
    except KeyboardInterrupt:
        console.print("\n[yellow]操作已取消[/yellow]")
        sys.exit(ExitCode.UNKNOWN_ERROR)
    except Exception as e:
        logger.exception("未捕获的异常")
        console.print(f"\n[red]发生错误: {e}[/red]")
        sys.exit(ExitCode.UNKNOWN_ERROR)


if __name__ == '__main__':
    main()
