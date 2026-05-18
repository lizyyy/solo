import json
import sys

import click
from tqdm import tqdm

from .processor import SampleAppealProcessor
from . import __version__


def print_banner():
    banner = f"""
╔══════════════════════════════════════════════════════════════╗
║           审核样本目录误封申诉整理 CLI v{__version__}           ║
║           Audit Sample Directory Appeal Organizer            ║
╚══════════════════════════════════════════════════════════════╝
"""
    click.echo(click.style(banner, fg='cyan'))


def print_summary(report: dict):
    summary = report["summary"]
    click.echo("\n" + click.style("━━━━━━━━━━━━━━━━━━ 处理汇总 ━━━━━━━━━━━━━━━━━━", fg='yellow', bold=True))
    click.echo(f"  总样本数:      {click.style(str(summary['total_samples']), fg='white', bold=True)}")
    click.echo(f"  正常样本:      {click.style(str(summary['normal_samples']), fg='green')}")
    click.echo(f"  缩略图样本:    {click.style(str(summary['thumbnail_samples']), fg='bright_yellow')}")
    click.echo(f"  重复图片:      {click.style(str(summary['duplicate_samples']), fg='red')}")
    click.echo(f"  模型版本数:    {click.style(str(summary['model_version_count']), fg='blue')}")
    click.echo(click.style("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", fg='yellow', bold=True))


def print_details(report: dict):
    click.echo("\n" + click.style("详细分析:", fg='cyan', bold=True))
    
    if report["details"]["thumbnail_samples"]:
        click.echo(f"\n  {click.style('缩略图样本列表:', fg='bright_yellow', bold=True)}")
        for s in report["details"]["thumbnail_samples"]:
            reason = s["thumbnail_info"].get("reason", "未知")
            click.echo(f"    - {s['relative_path']} ({reason})")
    
    if report["details"]["duplicate_samples"]:
        click.echo(f"\n  {click.style('重复图片列表:', fg='red', bold=True)}")
        for s in report["details"]["duplicate_samples"]:
            dup_type = "内容重复" if s.get("duplicate_type") == "image_content" else "文件完全相同"
            group_size = s.get("duplicate_group_size", 2)
            click.echo(f"    - {s['relative_path']} [{dup_type}, 共{group_size}个]")
    
    if report["details"]["model_version_groups"]:
        click.echo(f"\n  {click.style('模型版本分组:', fg='blue', bold=True)}")
        for version, samples in report["details"]["model_version_groups"].items():
            click.echo(f"    版本 {version}: {len(samples)} 个样本")
            for s in samples[:3]:
                click.echo(f"      - {s['relative_path']}")
            if len(samples) > 3:
                click.echo(f"      ... 还有 {len(samples) - 3} 个")


@click.command()
@click.argument('input_path', type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.argument('rules_file', type=click.Path(exists=True, file_okay=True, dir_okay=False))
@click.option('--output-dir', '-o', required=True, type=click.Path(), help='输出目录路径')
@click.option('--dry-run', '-n', is_flag=True, help='试运行模式，不生成实际文件')
@click.option('--overwrite', '-f', is_flag=True, help='覆盖已存在的输出目录')
@click.option('--verbose', '-v', is_flag=True, help='显示详细信息')
@click.version_option(version=__version__, prog_name='audit-sample-appeal')
def main(input_path, rules_file, output_dir, dry_run, overwrite, verbose):
    """
    审核样本目录误封申诉整理 CLI
    
    扫描样本目录，识别缩略图、重复图片和模型版本，生成误封申诉包。
    
    INPUT_PATH: 待处理的样本目录路径
    RULES_FILE: 规则配置文件路径 (YAML格式)
    """
    print_banner()
    
    click.echo(f"  输入目录:  {click.style(input_path, fg='white')}")
    click.echo(f"  规则文件:  {click.style(rules_file, fg='white')}")
    click.echo(f"  输出目录:  {click.style(output_dir, fg='white')}")
    if dry_run:
        click.echo(f"  {click.style('试运行模式', fg='bright_magenta')}: 不生成输出文件")
    
    try:
        processor = SampleAppealProcessor(
            input_path=input_path,
            rules_file=rules_file,
            output_dir=output_dir,
            dry_run=dry_run,
            overwrite=overwrite
        )
        
        click.echo("\n" + click.style("正在扫描样本...", fg='cyan'))
        processor.scan_samples()
        
        click.echo(click.style("正在生成申诉包...", fg='cyan'))
        report = processor.create_appeal_package()
        
        print_summary(report)
        
        if verbose:
            print_details(report)
        
        if not dry_run:
            report_path = processor.output_dir / "appeal_report.json"
            click.echo(f"\n  {click.style('✓', fg='green', bold=True)} 处理完成！")
            click.echo(f"    输出目录: {click.style(str(processor.output_dir), fg='green')}")
            click.echo(f"    报告文件: {click.style(str(report_path), fg='green')}")
        else:
            click.echo(f"\n  {click.style('✓', fg='green', bold=True)} 试运行完成！")
            click.echo(f"    移除 --dry-run 参数以生成实际输出")
        
        sys.exit(0)
        
    except FileExistsError as e:
        click.echo(f"\n  {click.style('✗ 错误:', fg='red', bold=True)} {str(e)}")
        click.echo(f"    使用 --overwrite 选项强制覆盖已存在的输出目录")
        sys.exit(1)
    except Exception as e:
        click.echo(f"\n  {click.style('✗ 处理失败:', fg='red', bold=True)} {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
