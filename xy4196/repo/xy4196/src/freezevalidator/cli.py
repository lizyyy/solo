import os
import sys
from pathlib import Path
from typing import Optional, List
import click

from . import __version__
from .models import FileType, ReviewEntry
from .parser import (
    PositionTableParser, ScanLogParser, TemperatureParser,
    TransferFormParser, calculate_file_hash
)
from .rules import run_all_rules
from .storage import SessionStorage
from .exporter import AuditExporter


def get_default_storage() -> Path:
    home = Path.home()
    if sys.platform == "win32":
        base = home / "AppData" / "Local" / "FreezeValidator"
    elif sys.platform == "darwin":
        base = home / "Library" / "Application Support" / "FreezeValidator"
    else:
        base = home / ".freezevalidator"
    return base


@click.group()
@click.version_option(__version__, prog_name="freezevalidator")
@click.option("--storage", "-s", type=click.Path(path_type=Path), 
              help="存储目录路径（默认: ~/.freezevalidator）")
@click.pass_context
def cli(ctx, storage: Optional[Path]):
    """
    冻存盒交接核对员 - 生物样本库本地自动化工具
    
    功能：
    - ingest: 导入多源数据文件
    - check: 执行校验规则
    - review: 记录人工复核
    - export: 导出审计报告
    - list: 列出所有会话
    """
    storage_path = storage or get_default_storage()
    ctx.obj = {
        "storage": SessionStorage(storage_path),
        "storage_path": storage_path
    }


@cli.command()
@click.option("--position-table", "-p", type=click.Path(exists=True, path_type=Path),
              help="冻存盒位置表 CSV 文件")
@click.option("--scan-log", "-l", type=click.Path(exists=True, path_type=Path),
              help="扫码枪日志 CSV 文件")
@click.option("--temperature", "-t", type=click.Path(exists=True, path_type=Path),
              help="温度记录 JSON 文件")
@click.option("--transfer-form", "-f", type=click.Path(exists=True, path_type=Path),
              help="交接单 JSON 文件")
@click.option("--session-id", "-i", help="指定会话ID（留空则创建新会话）")
@click.pass_context
def ingest(ctx, position_table: Optional[Path], scan_log: Optional[Path],
           temperature: Optional[Path], transfer_form: Optional[Path],
           session_id: Optional[str]):
    """
    导入多源数据文件并计算文件哈希
    
    支持一次导入多个文件，所有文件将关联到同一会话。
    每个文件的SHA256哈希会被记录以保证可追溯性。
    """
    storage = ctx.obj["storage"]
    
    if session_id:
        session = storage.load_session(session_id)
        if not session:
            click.echo(f"错误: 未找到会话 {session_id}")
            ctx.exit(1)
    else:
        session = storage.create_session()
    
    files_imported = 0
    
    if position_table:
        file_hash = calculate_file_hash(position_table)
        positions, metadata = PositionTableParser.parse(position_table)
        
        session.sample_positions.extend(positions)
        
        from .models import IngestedFile
        ingested = IngestedFile(
            file_type=FileType.POSITION_TABLE,
            original_path=str(position_table),
            file_name=position_table.name,
            file_hash=file_hash,
            row_count=len(positions),
            metadata=metadata
        )
        session.ingested_files.append(ingested)
        files_imported += 1
        click.echo(f"✓ 导入位置表: {position_table.name} ({len(positions)} 个样本)")
    
    if scan_log:
        file_hash = calculate_file_hash(scan_log)
        scans, metadata = ScanLogParser.parse(scan_log)
        
        session.scan_logs.extend(scans)
        
        from .models import IngestedFile
        ingested = IngestedFile(
            file_type=FileType.SCAN_LOG,
            original_path=str(scan_log),
            file_name=scan_log.name,
            file_hash=file_hash,
            row_count=len(scans),
            metadata=metadata
        )
        session.ingested_files.append(ingested)
        files_imported += 1
        click.echo(f"✓ 导入扫码日志: {scan_log.name} ({len(scans)} 条记录)")
    
    if temperature:
        file_hash = calculate_file_hash(temperature)
        readings, metadata = TemperatureParser.parse(temperature)
        
        session.temperature_readings.extend(readings)
        
        from .models import IngestedFile
        ingested = IngestedFile(
            file_type=FileType.TEMPERATURE,
            original_path=str(temperature),
            file_name=temperature.name,
            file_hash=file_hash,
            row_count=len(readings),
            metadata=metadata
        )
        session.ingested_files.append(ingested)
        files_imported += 1
        click.echo(f"✓ 导入温度记录: {temperature.name} ({len(readings)} 条记录)")
    
    if transfer_form:
        file_hash = calculate_file_hash(transfer_form)
        form, metadata = TransferFormParser.parse(transfer_form)
        
        if form:
            session.transfer_form = form
            
            from .models import IngestedFile
            ingested = IngestedFile(
                file_type=FileType.TRANSFER_FORM,
                original_path=str(transfer_form),
                file_name=transfer_form.name,
                file_hash=file_hash,
                row_count=1,
                metadata=metadata
            )
            session.ingested_files.append(ingested)
            files_imported += 1
            click.echo(f"✓ 导入交接单: {transfer_form.name} (交接单号: {form.transfer_id})")
        else:
            click.echo(f"✗ 交接单解析失败: {metadata.get('error', '未知错误')}")
    
    if files_imported > 0:
        storage.save_session(session)
        click.echo("")
        click.echo(f"会话ID: {session.session_id}")
        click.echo(f"共导入 {files_imported} 个文件")
    else:
        click.echo("未指定任何文件进行导入")
        click.echo("使用 --help 查看帮助")


@cli.command()
@click.argument("session_id")
@click.option("--min-temp", type=float, default=-85.0, 
              help="最低温度阈值（默认: -85.0）")
@click.option("--max-temp", type=float, default=-70.0,
              help="最高温度阈值（默认: -70.0）")
@click.option("--max-rows", type=int, default=10,
              help="冻存盒最大行数（默认: 10）")
@click.option("--max-cols", type=int, default=10,
              help="冻存盒最大列数（默认: 10）")
@click.option("--verbose", "-v", is_flag=True, help="显示详细信息")
@click.pass_context
def check(ctx, session_id: str, min_temp: float, max_temp: float,
          max_rows: int, max_cols: int, verbose: bool):
    """
    执行校验规则并生成问题列表
    
    校验内容：
    - 条码重复检测
    - 孔位有效性检查
    - 位置表与扫码记录对比
    - 温度超限及标记检查
    - 交接单签字检查
    - 冻存盒交接链完整性
    """
    storage = ctx.obj["storage"]
    session = storage.load_session(session_id)
    
    if not session:
        click.echo(f"错误: 未找到会话 {session_id}")
        ctx.exit(1)
    
    config = {
        "min_temp": min_temp,
        "max_temp": max_temp,
        "max_rows": max_rows,
        "max_cols": max_cols
    }
    
    issues = run_all_rules(
        sample_positions=session.sample_positions,
        scan_logs=session.scan_logs,
        temperature_readings=session.temperature_readings,
        transfer_form=session.transfer_form,
        config=config
    )
    
    session.validation_issues = issues
    storage.save_session(session)
    
    error_count = sum(1 for i in issues if i.severity.value == "error")
    warning_count = sum(1 for i in issues if i.severity.value == "warning")
    info_count = sum(1 for i in issues if i.severity.value == "info")
    
    click.echo("=" * 60)
    click.echo("校验结果")
    click.echo("=" * 60)
    click.echo("")
    click.echo(f"会话ID: {session_id}")
    click.echo("")
    click.echo(f"🔴 错误: {error_count}")
    click.echo(f"🟡 警告: {warning_count}")
    click.echo(f"🔵 提示: {info_count}")
    click.echo("")
    
    if error_count + warning_count + info_count == 0:
        click.echo("✅ 所有校验通过！")
    else:
        click.echo("问题列表:")
        click.echo("-" * 60)
        
        for idx, issue in enumerate(issues, 1):
            emoji = {
                "error": "🔴",
                "warning": "🟡",
                "info": "🔵"
            }[issue.severity.value]
            
            click.echo(f"{emoji} [{idx}] {issue.rule.value}: {issue.message}")
            
            if verbose and issue.affected_samples:
                click.echo(f"   影响样本: {', '.join(issue.affected_samples[:5])}")
                if len(issue.affected_samples) > 5:
                    click.echo(f"   ... 还有 {len(issue.affected_samples) - 5} 个")
            click.echo("")
    
    if error_count > 0:
        ctx.exit(1)


@cli.command()
@click.argument("session_id")
@click.option("--reviewer", "-r", required=True, help="复核人姓名")
@click.option("--issue-index", "-i", type=int, help="问题序号（对应check命令的输出）")
@click.option("--action", "-a", required=True, 
              type=click.Choice(["accept", "reject", "note", "escalate"]),
              help="处理动作: accept(接受), reject(拒绝), note(备注), escalate(升级)")
@click.option("--status", "-s", required=True,
              type=click.Choice(["resolved", "pending", "confirmed", "dismissed"]),
              help="状态: resolved(已解决), pending(待处理), confirmed(已确认), dismissed(忽略)")
@click.option("--comment", "-m", help="复核备注")
@click.pass_context
def review(ctx, session_id: str, reviewer: str, issue_index: Optional[int],
           action: str, status: str, comment: Optional[str]):
    """
    记录人工复核结果
    
    可以针对特定问题（通过--issue-index指定）或整体复核。
    复核记录将保存在会话中，导出时会包含在内。
    """
    import uuid
    storage = ctx.obj["storage"]
    session = storage.load_session(session_id)
    
    if not session:
        click.echo(f"错误: 未找到会话 {session_id}")
        ctx.exit(1)
    
    issue_reference = None
    if issue_index is not None:
        if 1 <= issue_index <= len(session.validation_issues):
            issue = session.validation_issues[issue_index - 1]
            issue_reference = issue.rule.value
            click.echo(f"针对问题 [{issue_index}] {issue.rule.value} 进行复核")
        else:
            click.echo(f"错误: 问题序号 {issue_index} 无效（共有 {len(session.validation_issues)} 个问题）")
            ctx.exit(1)
    
    review_id = f"rev_{uuid.uuid4().hex[:12]}"
    
    entry = ReviewEntry(
        review_id=review_id,
        reviewer_name=reviewer,
        issue_reference=issue_reference,
        action_taken=action,
        resolution_status=status,
        comments=comment,
        session_id=session_id
    )
    
    storage.add_review(session, entry)
    
    click.echo(f"✓ 复核记录已保存")
    click.echo(f"  复核人: {reviewer}")
    click.echo(f"  动作: {action}")
    click.echo(f"  状态: {status}")
    if comment:
        click.echo(f"  备注: {comment}")


@cli.command()
@click.argument("session_id")
@click.option("--output", "-o", type=click.Path(path_type=Path), required=True,
              help="输出目录或文件路径")
@click.option("--format", "-f", "fmt", default="all",
              type=click.Choice(["all", "markdown", "csv", "json"]),
              help="输出格式（默认: all）")
@click.pass_context
def export(ctx, session_id: str, output: Path, fmt: str):
    """
    导出审计报告
    
    支持格式：
    - markdown: 生成单个Markdown报告文件
    - csv: 生成多个CSV文件（概要、问题、样本、复核）
    - json: 生成JSON格式报告
    - all: 生成所有格式
    
    输出路径对于单个格式是文件路径，对于all或csv是目录路径。
    """
    storage = ctx.obj["storage"]
    session = storage.load_session(session_id)
    
    if not session:
        click.echo(f"错误: 未找到会话 {session_id}")
        ctx.exit(1)
    
    exporter = AuditExporter(session)
    
    if fmt == "all":
        output.mkdir(parents=True, exist_ok=True)
        
        md_path = output / "audit_report.md"
        exporter.export_markdown(md_path)
        click.echo(f"✓ 生成 Markdown: {md_path}")
        
        json_path = output / "audit_report.json"
        exporter.export_json(json_path)
        click.echo(f"✓ 生成 JSON: {json_path}")
        
        csv_dir = output / "csv"
        exporter.export_csv(csv_dir)
        click.echo(f"✓ 生成 CSV: {csv_dir}/")
        
    elif fmt == "markdown":
        if output.suffix != ".md":
            output = output.with_suffix(".md")
        output.parent.mkdir(parents=True, exist_ok=True)
        exporter.export_markdown(output)
        click.echo(f"✓ 导出 Markdown: {output}")
        
    elif fmt == "json":
        if output.suffix != ".json":
            output = output.with_suffix(".json")
        output.parent.mkdir(parents=True, exist_ok=True)
        exporter.export_json(output)
        click.echo(f"✓ 导出 JSON: {output}")
        
    elif fmt == "csv":
        output.mkdir(parents=True, exist_ok=True)
        exporter.export_csv(output)
        click.echo(f"✓ 导出 CSV 到: {output}/")
    
    click.echo("")
    click.echo(f"会话 {session_id} 导出完成")


@cli.command("list")
@click.option("--limit", "-n", type=int, default=10, help="显示最近N个会话")
@click.pass_context
def list_sessions(ctx, limit: int):
    """
    列出所有会话
    
    按时间倒序显示，最近的在前。
    """
    storage = ctx.obj["storage"]
    sessions = storage.list_sessions()
    
    if not sessions:
        click.echo("暂无会话记录")
        click.echo(f"存储位置: {ctx.obj['storage_path']}")
        return
    
    click.echo("=" * 70)
    click.echo("会话列表")
    click.echo("=" * 70)
    click.echo("")
    
    for idx, session_id in enumerate(sessions[:limit], 1):
        session = storage.load_session(session_id)
        if session:
            issue_count = len(session.validation_issues)
            review_count = len(session.review_entries)
            file_count = len(session.ingested_files)
            
            status = "✅" if issue_count == 0 else "⚠️"
            
            click.echo(f"{idx:2d}. {session_id}")
            click.echo(f"    创建时间: {session.created_at.strftime('%Y-%m-%d %H:%M:%S')}")
            click.echo(f"    文件: {file_count} | 问题: {issue_count} | 复核: {review_count} {status}")
            click.echo("")
    
    if len(sessions) > limit:
        click.echo(f"... 还有 {len(sessions) - limit} 个会话")
        click.echo("")


if __name__ == "__main__":
    cli()
