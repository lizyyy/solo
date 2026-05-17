#!/usr/bin/env python3
import click
import json
import sys
from pathlib import Path

from .core import (
    process_files,
    ReportGenerator
)

__version__ = "0.1.0"


@click.group()
@click.version_option(__version__)
def cli():
    """API 抓包归档工具 - 统一归档 HTTP 抓包数据"""
    pass


@cli.command()
@click.argument('files', nargs=-1, type=click.Path(exists=True))
@click.option('--output', '-o', type=click.Path(), help='输出目录')
@click.option('--format', '-f', 'fmt', type=click.Choice(['json', 'md', 'all']), default='all',
              help='输出格式 (json/md/all)')
@click.option('--no-mask', is_flag=True, help='不进行敏感数据脱敏')
@click.option('--sensitive-field', '-s', multiple=True, help='自定义敏感字段名')
@click.option('--quiet', '-q', is_flag=True, help='安静模式，只输出错误')
def archive(files, output, fmt, no_mask, sensitive_field, quiet):
    """归档 HTTP 抓包文件"""
    if not files:
        click.echo("错误: 请指定至少一个文件", err=True)
        sys.exit(1)
    
    try:
        result = process_files(
            list(files),
            sensitive_fields=list(sensitive_field) if sensitive_field else None,
            mask=not no_mask
        )
        
        reporter = ReportGenerator(result)
        
        if not quiet:
            click.echo(reporter.generate_terminal_summary())
        
        if output:
            output_path = Path(output)
            output_path.mkdir(parents=True, exist_ok=True)
            
            base_name = f"archive_{result.summary['generated_at'][:19].replace(':', '-')}"
            
            if fmt in ['json', 'all']:
                json_file = output_path / f"{base_name}.json"
                json_file.write_text(reporter.generate_json(), encoding='utf-8')
                if not quiet:
                    click.echo(f"已生成 JSON 报告: {json_file}")
            
            if fmt in ['md', 'all']:
                md_file = output_path / f"{base_name}.md"
                md_file.write_text(reporter.generate_markdown(), encoding='utf-8')
                if not quiet:
                    click.echo(f"已生成 Markdown 报告: {md_file}")
        else:
            if fmt in ['json', 'all']:
                click.echo(reporter.generate_json())
            
        
        if result.errors or result.summary['error_count'] > 0:
            sys.exit(2)
            
    except Exception as e:
        click.echo(f"处理失败: {str(e)}", err=True)
        sys.exit(1)


@cli.command()
@click.argument('files', nargs=-1, type=click.Path(exists=True))
def validate(files):
    """验证抓包文件格式"""
    for file_path in files:
        click.echo(f"检查: {file_path}")
        try:
            result = process_files([file_path], mask=False)
            if result.errors:
                click.echo(f"  ❌ 发现 {len(result.errors)} 个错误")
                for err in result.errors:
                    click.echo(f"     - {err['message']}")
            else:
                click.echo(f"  ✅ 有效，包含 {len(result.entries)} 个请求")
        except Exception as e:
            click.echo(f"  ❌ 读取失败: {str(e)}")


@cli.command()
def config():
    """显示默认配置"""
    from .core import DEFAULT_SENSITIVE_FIELDS
    
    click.echo("默认敏感字段:")
    for field in DEFAULT_SENSITIVE_FIELDS:
        click.echo(f"  - {field}")
    click.echo("")
    click.echo("支持的文件格式:")
    click.echo("  - .har (HAR 格式)")
    click.echo("  - .curl/.sh (curl 命令文件)")
    click.echo("  - .txt (纯文本 HTTP 请求)")


if __name__ == '__main__':
    cli()
