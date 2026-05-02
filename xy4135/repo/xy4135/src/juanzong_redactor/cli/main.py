"""卷宗脱敏装订员 - 命令行接口"""
import click
import os
import json
from pathlib import Path
from datetime import datetime

from juanzong_redactor.file_parser import scan_directory
from juanzong_redactor.redaction_rules import Redactor
from juanzong_redactor.validation import Validator
from juanzong_redactor.review_storage import ReviewStorage
from juanzong_redactor.export import Exporter


@click.group()
@click.version_option(version="0.1.0")
@click.option("--verbose", "-v", is_flag=True, help="显示详细输出")
@click.option("--output", "-o", type=click.Path(), help="输出目录路径")
@click.pass_context
def cli(ctx, verbose, output):
    """卷宗脱敏装订员 - 给律师助理用的本地证据材料脱敏归档工具"""
    ctx.ensure_object(dict)
    ctx.obj["VERBOSE"] = verbose
    ctx.obj["OUTPUT"] = output or os.getcwd()
    
    if verbose:
        click.echo(f"输出目录: {ctx.obj['OUTPUT']}")


@cli.command()
@click.argument("directory", type=click.Path(exists=True, file_okay=False))
@click.option("--recursive", "-r", is_flag=True, help="递归扫描子目录")
@click.option("--include", "-i", multiple=True, help="包含的文件类型（如：pdf,jpg,png）")
@click.pass_context
def scan(ctx, directory, recursive, include):
    """扫描目录并生成文件清单
    
    DIRECTORY: 要扫描的目录路径
    """
    verbose = ctx.obj["VERBOSE"]
    output_dir = ctx.obj["OUTPUT"]
    
    click.echo(f"正在扫描目录: {directory}")
    
    file_types = None
    if include:
        file_types = [ft.strip().lstrip(".") for ft in ",".join(include).split(",")]
    
    scan_result = scan_directory(
        directory,
        recursive=recursive,
        file_types=file_types
    )
    
    if verbose:
        for item in scan_result["files"]:
            click.echo(f"  发现文件: {item['path']}")
    
    output_path = Path(output_dir) / "file_scan.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(scan_result, f, ensure_ascii=False, indent=2, default=str)
    
    click.echo(f"扫描完成，共发现 {scan_result['total_files']} 个文件")
    click.echo(f"文件清单已保存至: {output_path}")


@cli.command()
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--output", "-o", type=click.Path(), help="输出文件路径")
@click.option("--rules", "-r", multiple=True, help="脱敏规则（如：id,phone,address）")
@click.option("--preserve-words", "-p", multiple=True, help="需要保留的关键词")
@click.pass_context
def redact(ctx, file_path, output, rules, preserve_words):
    """识别敏感信息并输出可追溯副本
    
    FILE_PATH: 要处理的文件路径
    """
    verbose = ctx.obj["VERBOSE"]
    output_dir = ctx.obj["OUTPUT"]
    
    click.echo(f"正在处理文件: {file_path}")
    
    selected_rules = None
    if rules:
        selected_rules = [r.strip() for r in ",".join(rules).split(",")]
    
    preserve_list = None
    if preserve_words:
        preserve_list = [w.strip() for w in ",".join(preserve_words).split(",")]
    
    redactor = Redactor(
        rules=selected_rules,
        preserve_words=preserve_list
    )
    
    result = redactor.redact_file(
        file_path,
        output_path=output or (Path(output_dir) / f"redacted_{Path(file_path).name}")
    )
    
    if verbose:
        click.echo(f"  发现敏感信息: {result['found_items']} 处")
        for item in result["details"]:
            click.echo(f"    - {item['type']}: {item['masked']}")
    
    audit_path = Path(output_dir) / "redaction_audit.json"
    if audit_path.exists():
        with open(audit_path, "r", encoding="utf-8") as f:
            audit_log = json.load(f)
    else:
        audit_log = []
    
    audit_log.append({
        "timestamp": datetime.now().isoformat(),
        "source_file": file_path,
        "output_file": result["output_path"],
        "found_items": result["found_items"],
        "rules_used": selected_rules or ["all"]
    })
    
    with open(audit_path, "w", encoding="utf-8") as f:
        json.dump(audit_log, f, ensure_ascii=False, indent=2)
    
    click.echo(f"脱敏处理完成，发现 {result['found_items']} 处敏感信息")
    click.echo(f"脱敏后文件: {result['output_path']}")
    click.echo(f"审计日志已更新: {audit_path}")


@cli.command()
@click.argument("scan_result", type=click.Path(exists=True))
@click.option("--catalog", "-c", type=click.Path(exists=True), help="材料目录文件路径")
@click.option("--checks", "-k", multiple=True, help="检查项目（如：page,hash,signature,preserve）")
@click.pass_context
def check(ctx, scan_result, catalog, checks):
    """校验目录页码、重复哈希、缺签名页和保留词误伤
    
    SCAN_RESULT: 扫描结果JSON文件路径
    """
    verbose = ctx.obj["VERBOSE"]
    output_dir = ctx.obj["OUTPUT"]
    
    click.echo(f"正在执行校验...")
    
    check_list = None
    if checks:
        check_list = [c.strip() for c in ",".join(checks).split(",")]
    
    with open(scan_result, "r", encoding="utf-8") as f:
        scan_data = json.load(f)
    
    validator = Validator()
    
    result = validator.validate(
        scan_data=scan_data,
        catalog_path=catalog,
        checks=check_list
    )
    
    if verbose:
        for issue in result["issues"]:
            click.echo(f"  [{issue['severity'].upper()}] {issue['message']}")
    
    output_path = Path(output_dir) / "validation_report.json"
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2, default=str)
    
    click.echo(f"校验完成，发现 {len(result['issues'])} 个问题")
    click.echo(f"校验报告已保存至: {output_path}")


@cli.command()
@click.argument("item_id", type=str)
@click.option("--status", "-s", type=click.Choice(["approved", "rejected", "pending"]), 
              required=True, help="复核状态")
@click.option("--notes", "-n", help="复核备注")
@click.option("--reviewer", "-r", help="复核人姓名")
@click.pass_context
def review(ctx, item_id, status, notes, reviewer):
    """保存人工确认记录
    
    ITEM_ID: 复核项目ID
    """
    output_dir = ctx.obj["OUTPUT"]
    
    click.echo(f"正在保存复核记录: {item_id}")
    
    storage = ReviewStorage(output_dir)
    
    result = storage.save_review(
        item_id=item_id,
        status=status,
        notes=notes,
        reviewer=reviewer
    )
    
    click.echo(f"复核记录已保存")
    click.echo(f"状态: {status}")
    if notes:
        click.echo(f"备注: {notes}")


@cli.command()
@click.option("--scan-result", "-s", type=click.Path(exists=True), required=True, help="扫描结果JSON文件")
@click.option("--validation-report", "-v", type=click.Path(exists=True), help="校验报告JSON文件")
@click.option("--redaction-audit", "-r", type=click.Path(exists=True), help="脱敏审计日志文件")
@click.option("--review-log", "-l", type=click.Path(exists=True), help="复核记录文件")
@click.option("--format", "-f", multiple=True, 
              help="导出格式（如：catalog,report,audit），默认全部导出")
@click.pass_context
def export(ctx, scan_result, validation_report, redaction_audit, review_log, format):
    """导出装订目录、Markdown风险报告和JSON审计包
    
    示例: juanzong export -s file_scan.json -f catalog -f report
    """
    output_dir = ctx.obj["OUTPUT"]
    verbose = ctx.obj["VERBOSE"]
    
    click.echo("正在准备导出...")
    
    export_formats = list(format) if format else ["catalog", "report", "audit"]
    
    with open(scan_result, "r", encoding="utf-8") as f:
        scan_data = json.load(f)
    
    validation_data = None
    if validation_report:
        with open(validation_report, "r", encoding="utf-8") as f:
            validation_data = json.load(f)
    
    redaction_data = None
    if redaction_audit:
        with open(redaction_audit, "r", encoding="utf-8") as f:
            redaction_data = json.load(f)
    
    review_data = None
    if review_log:
        with open(review_log, "r", encoding="utf-8") as f:
            review_data = json.load(f)
    
    exporter = Exporter(output_dir)
    
    result = exporter.export(
        scan_data=scan_data,
        validation_data=validation_data,
        redaction_data=redaction_data,
        review_data=review_data,
        formats=export_formats
    )
    
    if verbose:
        for file_type, file_path in result["exported_files"].items():
            click.echo(f"  已导出: {file_path}")
    
    click.echo("导出完成！")
    click.echo(f"装订目录: {result['exported_files'].get('catalog', '未导出')}")
    click.echo(f"风险报告: {result['exported_files'].get('report', '未导出')}")
    click.echo(f"审计包: {result['exported_files'].get('audit', '未导出')}")


if __name__ == "__main__":
    cli()
