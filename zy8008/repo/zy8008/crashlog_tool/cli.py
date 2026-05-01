"""
CLI 入口模块

命令行工具主入口，整合所有模块功能
"""

import os
import sys
import click
from typing import Optional

from . import __version__
from .log_parser import LogParser
from .stack_merger import merge_log_entries
from .sanitizer import LogSanitizer, create_default_sanitizer
from .validator import validate_inputs, ValidationResult, ValidationSeverity
from .packager import export_results


@click.group()
@click.version_option(__version__, '--version', '-v', help='显示版本信息')
def main():
    """
    崩溃日志整理工具 - Mobile Crash Log Processor

    帮助移动端研发把用户反馈里的崩溃日志整理成可转交的最小复现包。
    """
    pass


@main.command()
@click.argument('log_dir', type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option('--sanitize-rules', '-s', type=click.Path(exists=True, file_okay=True, dir_okay=False),
              help='脱敏规则 JSON 文件路径')
@click.option('--build-meta', '-b', type=click.Path(exists=True, file_okay=True, dir_okay=False),
              help='构建元信息 YAML 文件路径')
@click.option('--output', '-o', type=click.Path(file_okay=False, dir_okay=True),
              default='./out', help='输出目录 (默认: ./out)')
@click.option('--verbose/--quiet', default=True, help='显示详细输出')
@click.option('--force', '-f', is_flag=True, help='覆盖已存在的输出目录')
def process(log_dir, sanitize_rules, build_meta, output, verbose, force):
    """
    处理崩溃日志目录

    输入: 日志目录、脱敏规则 JSON、构建元信息 YAML
    输出: 脱敏日志、崩溃时间线、可疑堆栈、report.md、package.zip
    """
    log_dir = os.path.abspath(log_dir)
    output = os.path.abspath(output)

    if verbose:
        click.echo(f"📁 日志目录: {log_dir}")
        click.echo(f"📤 输出目录: {output}")
        if sanitize_rules:
            click.echo(f"📋 脱敏规则: {sanitize_rules}")
        if build_meta:
            click.echo(f"📦 构建元信息: {build_meta}")
        click.echo("")

    if os.path.exists(output):
        if not force:
            click.confirm(
                f"输出目录 '{output}' 已存在，是否继续？",
                abort=True
            )
        import shutil
        shutil.rmtree(output)

    os.makedirs(output, exist_ok=True)

    click.echo("🔍 校验输入文件...")
    validation = validate_inputs(log_dir, sanitize_rules, build_meta)

    _print_validation_result(validation, verbose)

    if not validation.valid:
        click.echo("❌ 输入校验失败，无法继续处理", err=True)
        sys.exit(1)

    click.echo("✅ 输入校验通过")
    click.echo("")

    click.echo("🔧 加载脱敏规则...")
    if sanitize_rules and os.path.exists(sanitize_rules):
        sanitizer = LogSanitizer.from_json_config(sanitize_rules)
        click.echo(f"✅ 已加载自定义脱敏规则")
    else:
        sanitizer = create_default_sanitizer()
        click.echo(f"✅ 已使用默认脱敏规则")
    click.echo("")

    click.echo("📖 解析日志文件...")
    parser = LogParser()
    log_entries = parser.parse_directory(log_dir)
    click.echo(f"✅ 共解析 {len(log_entries)} 条日志")

    click.echo("⏳ 按时间排序日志...")
    log_entries = parser.sort_by_time(log_entries)
    click.echo("✅ 日志已按时间排序")
    click.echo("")

    click.echo("🔍 分析崩溃并归并堆栈...")
    crash_groups, suspicious_stacks, timeline = merge_log_entries(log_entries)
    click.echo(f"✅ 发现 {len(crash_groups)} 个崩溃分组")
    click.echo(f"✅ 识别 {len(suspicious_stacks)} 个可疑堆栈")
    click.echo(f"✅ 生成 {len(timeline)} 个时间线事件")
    click.echo("")

    build_meta_data = validation.build_meta if validation.build_meta else {}

    click.echo("📦 生成输出文件...")
    export_result = export_results(
        output_dir=output,
        log_entries=log_entries,
        crash_groups=crash_groups,
        suspicious_stacks=suspicious_stacks,
        timeline=timeline,
        sanitizer=sanitizer,
        build_meta=build_meta_data
    )

    click.echo("")
    click.echo("📋 生成的文件:")
    for file_path in export_result.files_generated:
        rel_path = os.path.relpath(file_path, output)
        click.echo(f"  - {rel_path}")

    click.echo("")
    click.echo(f"🎉 处理完成！输出目录: {output}")
    click.echo("")
    click.echo("输出文件说明:")
    click.echo("  - sanitized_logs.txt: 脱敏后的完整日志")
    click.echo("  - crash_timeline.json: 按时间排序的崩溃事件")
    click.echo("  - suspicious_stacks.json: 可疑堆栈摘要")
    click.echo("  - report.md: 分析报告（Markdown 格式）")
    click.echo("  - package.zip: 包含所有文件的压缩包")


@main.command()
@click.argument('log_file', type=click.Path(exists=True, file_okay=True, dir_okay=False))
@click.option('--output', '-o', type=click.Path(), help='输出文件路径')
@click.option('--sanitize-rules', '-s', type=click.Path(exists=True), help='自定义脱敏规则')
def sanitize(log_file, output, sanitize_rules):
    """
    仅脱敏单个日志文件

    不进行崩溃分析，只进行脱敏处理
    """
    if sanitize_rules:
        sanitizer = LogSanitizer.from_json_config(sanitize_rules)
    else:
        sanitizer = create_default_sanitizer()

    click.echo(f"📖 读取文件: {log_file}")

    with open(log_file, 'r', encoding='utf-8', errors='ignore') as f:
        content = f.read()

    click.echo("🔒 脱敏处理中...")
    sanitized, result = sanitizer.sanitize_log_content(content)

    click.echo(f"✅ 发现 {result.matches_found} 处敏感信息")
    if result.applied_rules:
        click.echo(f"✅ 应用规则: {', '.join(result.applied_rules)}")

    if output:
        with open(output, 'w', encoding='utf-8') as f:
            f.write(sanitized)
        click.echo(f"💾 已保存到: {output}")
    else:
        click.echo("")
        click.echo(sanitized)


@main.command()
@click.argument('log_dir', type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option('--json', '-j', is_flag=True, help='以 JSON 格式输出')
def validate(log_dir, json):
    """
    校验日志目录

    检查日志目录是否包含有效日志文件
    """
    import json as json_module

    validation = validate_inputs(log_dir)

    if json:
        output = {
            "valid": validation.valid,
            "log_files_count": len(validation.log_files),
            "log_files": validation.log_files,
            "issues": [
                {
                    "severity": i.severity.value,
                    "field": i.field,
                    "message": i.message,
                    "suggestion": i.suggestion
                }
                for i in validation.issues
            ]
        }
        click.echo(json_module.dumps(output, ensure_ascii=False, indent=2))
    else:
        _print_validation_result(validation, verbose=True)


def _print_validation_result(validation: ValidationResult, verbose: bool):
    """打印校验结果"""
    errors = validation.get_errors()
    warnings = validation.get_warnings()

    if errors:
        click.echo(f"❌ 错误 ({len(errors)}):")
        for issue in errors:
            click.echo(f"   - [{issue.field}] {issue.message}")
            if issue.suggestion:
                click.echo(f"     💡 {issue.suggestion}")

    if warnings and verbose:
        click.echo(f"⚠️  警告 ({len(warnings)}):")
        for issue in warnings:
            click.echo(f"   - [{issue.field}] {issue.message}")
            if issue.suggestion:
                click.echo(f"     💡 {issue.suggestion}")

    if validation.log_files and verbose:
        click.echo(f"📋 找到的日志文件 ({len(validation.log_files)}):")
        for log_file in validation.log_files[:10]:
            click.echo(f"   - {os.path.basename(log_file)}")
        if len(validation.log_files) > 10:
            click.echo(f"   - ... 还有 {len(validation.log_files) - 10} 个文件")


if __name__ == '__main__':
    main()
