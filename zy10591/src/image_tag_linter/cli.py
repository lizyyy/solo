import sys
import time
from pathlib import Path
from typing import Optional, List, Tuple
import click
from . import __version__
from .models import ValidationReport, ValidationStatus, ValidationResult, ImageInfo
from .parser import TagParser
from .validator import TagValidator
from .reporter import ConsoleReporter, JsonReporter, MarkdownReporter


@click.group()
@click.version_option(version=__version__, prog_name="image-tag-linter")
def main():
    """镜像标签命名规范检查工具"""
    pass


@main.command()
@click.argument('input_file', type=click.Path(exists=True), required=False)
@click.option('--output-json', '-j', type=click.Path(), help='输出JSON结果文件')
@click.option('--output-md', '-m', type=click.Path(), help='输出Markdown报告文件')
@click.option('--show-all', '-a', is_flag=True, help='显示所有检查结果（包括通过的）')
@click.option('--quiet', '-q', is_flag=True, help='静默模式，仅输出错误摘要')
@click.option('--strict', '-s', is_flag=True, help='严格模式，警告也视为失败')
def lint(input_file: Optional[str], output_json: Optional[str], output_md: Optional[str], 
         show_all: bool, quiet: bool, strict: bool):
    """检查镜像标签命名规范"""
    start_time = time.time()
    
    console_reporter = ConsoleReporter()
    validator = TagValidator()
    
    try:
        images, bad_lines = _read_input(input_file)
    except Exception as e:
        click.echo(f"错误: 读取输入失败 - {str(e)}", err=True)
        sys.exit(1)
    
    results: List[ValidationResult] = []
    for image_info in images:
        result = validator.validate(image_info)
        results.append(result)
    
    valid_count = sum(1 for r in results if r.status == ValidationStatus.VALID)
    warning_count = sum(1 for r in results if r.status == ValidationStatus.WARNING)
    invalid_count = sum(1 for r in results if r.status == ValidationStatus.INVALID)
    error_count = sum(1 for r in results if r.status == ValidationStatus.ERROR)
    
    report = ValidationReport(
        total_images=len(images),
        valid_count=valid_count,
        warning_count=warning_count,
        invalid_count=invalid_count,
        error_count=error_count,
        results=results,
        rules=validator.rules,
        input_file=input_file,
        duration_seconds=time.time() - start_time,
    )
    
    if not quiet:
        console_reporter.print_summary(report)
        console_reporter.print_details(report, show_all=show_all)
        console_reporter.print_bad_lines(bad_lines)
    
    if output_json:
        try:
            JsonReporter.generate(report, output_json)
            if not quiet:
                click.echo(f"JSON结果已保存到: {output_json}")
        except Exception as e:
            click.echo(f"警告: 无法写入JSON文件 - {str(e)}", err=True)
    
    if output_md:
        try:
            MarkdownReporter.generate(report, output_md)
            if not quiet:
                click.echo(f"Markdown报告已保存到: {output_md}")
        except Exception as e:
            click.echo(f"警告: 无法写入Markdown文件 - {str(e)}", err=True)
    
    exit_code = 0
    if invalid_count > 0 or error_count > 0:
        exit_code = 1
    elif strict and warning_count > 0:
        exit_code = 1
    
    sys.exit(exit_code)


@main.command(name="list-rules")
def list_rules():
    """列出当前的命名规则"""
    validator = TagValidator()
    
    click.echo("\n命名规则列表:\n")
    
    for i, rule in enumerate(validator.rules, 1):
        required = "必需" if rule.required else "建议"
        click.echo(f"{i}. {rule.name} [{required}]")
        click.echo(f"   说明: {rule.description}")
        click.echo(f"   正则: {rule.pattern}")
        if rule.examples:
            click.echo(f"   正确: {', '.join(rule.examples)}")
        if rule.bad_examples:
            click.echo(f"   错误: {', '.join(rule.bad_examples)}")
        click.echo("")


@main.command()
@click.argument('tag')
def parse(tag: str):
    """解析单个镜像标签"""
    parsed = TagParser.parse_tag(tag)
    
    click.echo(f"\n解析标签: {tag}\n")
    click.echo(f"版本: {parsed['version'] or 'N/A'}")
    click.echo(f"提交: {parsed['commit'] or 'N/A'}")
    click.echo(f"阶段: {parsed['stage'] or 'N/A'}")
    click.echo(f"构建时间: {parsed['build_time'] or 'N/A'}")
    click.echo("")


def _read_input(input_file: Optional[str]) -> Tuple[List[ImageInfo], list]:
    """从文件或标准输入读取镜像列表"""
    images: List[ImageInfo] = []
    bad_lines = []
    
    if input_file:
        with open(input_file, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    else:
        if sys.stdin.isatty():
            click.echo("使用方法:")
            click.echo("  1. 从文件读取: image-tag-linter lint images.txt")
            click.echo("  2. 从管道输入: cat images.txt | image-tag-linter lint")
            click.echo("")
            click.echo("输入格式 (每行一个镜像):")
            click.echo("  registry.example.com/myapp:v1.2.3-dev a1b2c3d dev")
            click.echo("  myapp:2.0.0-prod abc123def456789 prod")
            sys.exit(0)
        lines = sys.stdin.readlines()
    
    for line_num, line in enumerate(lines, 1):
        try:
            image_info, errors = TagParser.parse_image_line(line, line_number=line_num)
            if errors:
                for error in errors:
                    bad_lines.append((line_num, line.rstrip(), error))
            if image_info:
                images.append(image_info)
        except Exception as e:
            bad_lines.append((line_num, line.rstrip(), str(e)))
    
    return images, bad_lines


if __name__ == '__main__':
    main()
