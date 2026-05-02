import os
import sys
from pathlib import Path
from typing import Optional, List

import click

project_root = Path(__file__).parent
sys.path.insert(0, str(project_root))

from models import (
    WorkSession,
    PackageEvidence,
    FileEntry,
    ServiceNote,
    ClaimApplication,
    ReviewStatus,
    IssueSeverity,
)
from indexers import FileIndexer, WaybillExtractor
from parsers import ServiceNoteParser, ClaimApplicationParser, CSVParseError
from validators import ValidationEngine
from storage import SessionStore
from reports import ReportExporter, ExportResult


def get_storage_dir() -> Path:
    return Path.home() / ".package_archivist" / "sessions"


def get_exporter_dir() -> Path:
    return Path.cwd() / "exports"


def create_session_store() -> SessionStore:
    storage_dir = get_storage_dir()
    storage_dir.mkdir(parents=True, exist_ok=True)
    return SessionStore(str(storage_dir))


def print_severity(severity: IssueSeverity) -> str:
    if severity == IssueSeverity.CRITICAL:
        return click.style("严重", fg="red", bold=True)
    elif severity == IssueSeverity.WARNING:
        return click.style("警告", fg="yellow")
    else:
        return click.style("提示", fg="cyan")


def print_status(status: ReviewStatus) -> str:
    if status == ReviewStatus.PENDING:
        return click.style("待处理", fg="yellow")
    elif status == ReviewStatus.REVIEWED:
        return click.style("已复核", fg="cyan")
    elif status == ReviewStatus.RESOLVED:
        return click.style("已解决", fg="green")
    else:
        return click.style("已忽略", fg="bright_black")


@click.group()
@click.version_option("1.0.0", prog_name="package-archivist")
def cli():
    """异常包裹证据包归档员 - 快递驿站本地自动化工具"""
    pass


@cli.command()
@click.argument("directory", type=click.Path(exists=True, file_okay=False, dir_okay=True))
@click.option("--session-name", "-n", default=None, help="会话名称")
@click.option("--recursive/--no-recursive", "-r/-R", default=True, help="是否递归扫描子目录")
@click.option("--exclude", "-e", multiple=True, help="排除的目录或文件模式")
def scan(directory: str, session_name: Optional[str], recursive: bool, exclude: tuple):
    """扫描指定目录并按运单号归集文件"""
    
    click.echo(click.style("🔍 开始扫描目录...", fg="cyan", bold=True))
    click.echo(f"   目录: {directory}")
    click.echo(f"   递归扫描: {'是' if recursive else '否'}")
    
    if exclude:
        click.echo(f"   排除模式: {', '.join(exclude)}")
    
    indexer = FileIndexer()
    
    try:
        result = indexer.scan_directory(
            directory=directory,
            recursive=recursive,
            exclude_patterns=list(exclude) if exclude else None
        )
    except Exception as e:
        click.echo(click.style(f"❌ 扫描失败: {str(e)}", fg="red"), err=True)
        sys.exit(1)
    
    click.echo("")
    click.echo(click.style("📊 扫描结果:", fg="green", bold=True))
    click.echo(f"   总文件数: {result.total_files}")
    click.echo(f"   成功索引: {result.indexed_files}")
    click.echo(f"   失败文件: {result.failed_files}")
    click.echo(f"   归集包裹: {result.packages_count}")
    
    if result.unclassified_files:
        click.echo("")
        click.echo(click.style(f"⚠️  {len(result.unclassified_files)} 个文件无法识别运单号:", fg="yellow"))
        for f in result.unclassified_files[:5]:
            click.echo(f"   - {Path(f).name}")
        if len(result.unclassified_files) > 5:
            click.echo(f"   ... 还有 {len(result.unclassified_files) - 5} 个文件")
    
    if result.errors:
        click.echo("")
        click.echo(click.style("❌ 错误:", fg="red"))
        for e in result.errors[:5]:
            click.echo(f"   - {e}")
    
    session_name = session_name or f"扫描_{Path(directory).name}"
    store = create_session_store()
    session = store.create_session(session_name, f"扫描目录: {directory}")
    session.scanned_directory = directory
    session.files = result.files
    session.packages = result.packages
    store.save_session(session)
    
    click.echo("")
    click.echo(click.style("✅ 会话已保存", fg="green"))
    click.echo(f"   会话ID: {session.session_id}")
    click.echo(f"   会话名称: {session.name}")


@cli.command()
@click.option("--session-id", "-s", help="指定会话ID（默认使用最新会话）")
@click.option("--csv-file", "-c", multiple=True, type=click.Path(exists=True), help="客服备注CSV文件")
@click.option("--claim-file", "-f", multiple=True, type=click.Path(exists=True), help="赔付申请表CSV文件")
@click.option("--all/--no-all", "-a/-A", default=True, help="是否运行所有校验规则")
def check(session_id: Optional[str], csv_file: tuple, claim_file: tuple, all: bool):
    """校验缺照片、备注冲突、重复运单、时间倒序和赔付金额异常"""
    
    store = create_session_store()
    
    if session_id:
        session = store.load_session(session_id)
        if not session:
            click.echo(click.style(f"❌ 会话不存在: {session_id}", fg="red"), err=True)
            sys.exit(1)
    else:
        sessions = store.list_sessions()
        if not sessions:
            click.echo(click.style("❌ 没有可用的会话，请先运行 scan 命令", fg="red"), err=True)
            sys.exit(1)
        
        sessions_sorted = sorted(
            sessions,
            key=lambda x: x.get("created_at", ""),
            reverse=True
        )
        session = store.load_session(sessions_sorted[0]["session_id"])
        click.echo(click.style(f"📂 使用最新会话: {session.session_id}", fg="cyan"))
        click.echo(f"   会话名称: {session.name}")
    
    if csv_file:
        click.echo("")
        click.echo(click.style("📄 解析客服备注CSV...", fg="cyan"))
        parser = ServiceNoteParser()
        
        for csv_path in csv_file:
            try:
                notes = parser.parse_file(csv_path)
                click.echo(f"   文件: {Path(csv_path).name}")
                click.echo(f"   解析到 {len(notes)} 条备注")
                
                for note in notes:
                    if note.waybill_number:
                        if note.waybill_number not in session.packages:
                            session.packages[note.waybill_number] = PackageEvidence(
                                waybill_number=note.waybill_number
                            )
                        session.packages[note.waybill_number].service_notes.append(note)
            except CSVParseError as e:
                click.echo(click.style(f"   ⚠️ 解析失败: {str(e)}", fg="yellow"))
    
    if claim_file:
        click.echo("")
        click.echo(click.style("💰 解析赔付申请CSV...", fg="cyan"))
        parser = ClaimApplicationParser()
        
        for csv_path in claim_file:
            try:
                claims = parser.parse_file(csv_path)
                click.echo(f"   文件: {Path(csv_path).name}")
                click.echo(f"   解析到 {len(claims)} 条赔付申请")
                
                for claim in claims:
                    if claim.waybill_number:
                        if claim.waybill_number not in session.packages:
                            session.packages[claim.waybill_number] = PackageEvidence(
                                waybill_number=claim.waybill_number
                            )
                        session.packages[claim.waybill_number].claim_applications.append(claim)
            except CSVParseError as e:
                click.echo(click.style(f"   ⚠️ 解析失败: {str(e)}", fg="yellow"))
    
    click.echo("")
    click.echo(click.style("🔍 运行校验规则...", fg="cyan", bold=True))
    
    engine = ValidationEngine()
    result = engine.validate_session(session)
    
    click.echo("")
    click.echo(click.style("📋 校验结果:", fg="green", bold=True))
    click.echo(f"   总问题数: {result.total_issues}")
    click.echo(f"   🔴 严重问题: {result.critical_count}")
    click.echo(f"   🟡 警告问题: {result.warning_count}")
    click.echo(f"   ℹ️ 提示信息: {result.info_count}")
    
    if result.issues:
        click.echo("")
        click.echo(click.style("问题详情:", fg="cyan"))
        
        for issue in result.issues:
            severity_label = print_severity(issue.severity)
            status_label = print_status(issue.review_status)
            
            click.echo("")
            click.echo(f"   [{severity_label}] [{issue.waybill_number}]")
            click.echo(f"   {issue.message}")
            click.echo(f"   状态: {status_label}")
    
    store.save_session(session)
    click.echo("")
    click.echo(click.style(f"✅ 会话已更新: {session.session_id}", fg="green"))


@cli.command()
@click.argument("issue_id", required=False)
@click.option("--session-id", "-s", help="指定会话ID")
@click.option("--waybill", "-w", help="指定运单号添加备注")
@click.option("--content", "-c", help="备注内容")
@click.option("--author", "-a", default="站长", help="作者名称")
@click.option("--status", "-t", type=click.Choice(["pending", "reviewed", "resolved", "dismissed"]),
              help="变更状态")
@click.option("--list", "-l", "list_issues", is_flag=True, help="列出所有问题")
def review(
    issue_id: Optional[str],
    session_id: Optional[str],
    waybill: Optional[str],
    content: Optional[str],
    author: str,
    status: Optional[str],
    list_issues: bool
):
    """保存人工处理意见"""
    
    store = create_session_store()
    
    if session_id:
        session = store.load_session(session_id)
        if not session:
            click.echo(click.style(f"❌ 会话不存在: {session_id}", fg="red"), err=True)
            sys.exit(1)
    else:
        sessions = store.list_sessions()
        if not sessions:
            click.echo(click.style("❌ 没有可用的会话", fg="red"), err=True)
            sys.exit(1)
        
        sessions_sorted = sorted(
            sessions,
            key=lambda x: x.get("created_at", ""),
            reverse=True
        )
        session = store.load_session(sessions_sorted[0]["session_id"])
        click.echo(click.style(f"📂 使用最新会话: {session.session_id}", fg="cyan"))
    
    if list_issues:
        click.echo("")
        click.echo(click.style("📋 问题列表:", fg="cyan", bold=True))
        
        if not session.issues:
            click.echo("   没有问题记录")
        else:
            for issue_id_val, issue in session.issues.items():
                severity_label = print_severity(issue.severity)
                status_label = print_status(issue.review_status)
                
                click.echo("")
                click.echo(f"   问题ID: {issue_id_val}")
                click.echo(f"   运单号: {issue.waybill_number}")
                click.echo(f"   严重程度: {severity_label}")
                click.echo(f"   问题描述: {issue.message}")
                click.echo(f"   状态: {status_label}")
        return
    
    if not content and not status:
        click.echo(click.style("❌ 请提供备注内容 (--content) 或状态变更 (--status)", fg="red"), err=True)
        sys.exit(1)
    
    status_change = None
    if status:
        status_map = {
            "pending": ReviewStatus.PENDING,
            "reviewed": ReviewStatus.REVIEWED,
            "resolved": ReviewStatus.RESOLVED,
            "dismissed": ReviewStatus.DISMISSED,
        }
        status_change = status_map[status]
    
    if issue_id:
        if issue_id not in session.issues:
            click.echo(click.style(f"❌ 问题不存在: {issue_id}", fg="red"), err=True)
            sys.exit(1)
        
        note = store.add_review_note(
            session=session,
            content=content or "状态变更",
            author=author,
            issue_id=issue_id,
            status_change=status_change
        )
        
        click.echo("")
        click.echo(click.style("✅ 复核记录已添加", fg="green"))
        click.echo(f"   问题ID: {issue_id}")
        click.echo(f"   作者: {author}")
        click.echo(f"   内容: {content or '状态变更'}")
        if status_change:
            click.echo(f"   状态变更: {print_status(status_change)}")
    
    elif waybill:
        note = store.add_review_note(
            session=session,
            content=content or "状态变更",
            author=author,
            waybill_number=waybill,
            status_change=status_change
        )
        
        click.echo("")
        click.echo(click.style("✅ 复核记录已添加", fg="green"))
        click.echo(f"   运单号: {waybill}")
        click.echo(f"   作者: {author}")
        click.echo(f"   内容: {content or '状态变更'}")
    
    else:
        click.echo(click.style("❌ 请提供问题ID (--issue-id) 或运单号 (--waybill)", fg="red"), err=True)
        sys.exit(1)
    
    store.save_session(session)


@cli.command()
@click.option("--session-id", "-s", help="指定会话ID")
@click.option("--output-dir", "-o", type=click.Path(file_okay=False), help="输出目录")
@click.option("--all/--no-all", "-a/-A", default=True, help="是否导出所有报告")
@click.option("--summary", "-m", is_flag=True, help="仅导出会话汇总")
@click.option("--issues", "-i", is_flag=True, help="仅导出问题清单CSV")
@click.option("--packages", "-p", is_flag=True, help="仅导出包裹清单CSV")
@click.option("--audit", "-d", is_flag=True, help="仅导出审计记录JSON")
@click.option("--claims", "-c", is_flag=True, help="仅导出申诉包")
@click.option("--waybill", "-w", help="指定运单号导出申诉包")
def export(
    session_id: Optional[str],
    output_dir: Optional[str],
    all: bool,
    summary: bool,
    issues: bool,
    packages: bool,
    audit: bool,
    claims: bool,
    waybill: Optional[str]
):
    """导出Markdown申诉包、CSV问题清单和JSON审计记录"""
    
    store = create_session_store()
    
    if session_id:
        session = store.load_session(session_id)
        if not session:
            click.echo(click.style(f"❌ 会话不存在: {session_id}", fg="red"), err=True)
            sys.exit(1)
    else:
        sessions = store.list_sessions()
        if not sessions:
            click.echo(click.style("❌ 没有可用的会话", fg="red"), err=True)
            sys.exit(1)
        
        sessions_sorted = sorted(
            sessions,
            key=lambda x: x.get("created_at", ""),
            reverse=True
        )
        session = store.load_session(sessions_sorted[0]["session_id"])
        click.echo(click.style(f"📂 使用最新会话: {session.session_id}", fg="cyan"))
    
    target_dir = output_dir or str(get_exporter_dir())
    Path(target_dir).mkdir(parents=True, exist_ok=True)
    
    exporter = ReportExporter(target_dir)
    
    click.echo("")
    click.echo(click.style("📤 导出报告...", fg="cyan", bold=True))
    click.echo(f"   输出目录: {target_dir}")
    
    results = {}
    
    if waybill:
        if waybill not in session.packages:
            click.echo(click.style(f"❌ 运单号不存在: {waybill}", fg="red"), err=True)
            sys.exit(1)
        
        result = exporter.export_claim_package(session.packages[waybill])
        results["claim_package"] = result
        
        if result.success:
            click.echo(click.style(f"   ✅ 申诉包已导出: {result.output_path}", fg="green"))
        else:
            click.echo(click.style(f"   ❌ 导出失败: {', '.join(result.errors)}", fg="red"))
        return
    
    if all and not (summary or issues or packages or audit or claims):
        results = exporter.export_all(session, target_dir)
        
        for name, result in results.items():
            if result.success:
                click.echo(click.style(f"   ✅ {name}: 导出 {result.file_count} 个文件", fg="green"))
                click.echo(f"      {result.output_path}")
            else:
                click.echo(click.style(f"   ❌ {name}: 导出失败", fg="red"))
                for err in result.errors:
                    click.echo(f"      - {err}")
    else:
        if summary:
            result = exporter.export_session_summary(session)
            results["summary"] = result
            if result.success:
                click.echo(click.style(f"   ✅ 会话汇总: {result.output_path}", fg="green"))
        
        if issues:
            result = exporter.export_issue_list(session)
            results["issues"] = result
            if result.success:
                click.echo(click.style(f"   ✅ 问题清单: {result.output_path}", fg="green"))
        
        if packages:
            result = exporter.export_package_list(session)
            results["packages"] = result
            if result.success:
                click.echo(click.style(f"   ✅ 包裹清单: {result.output_path}", fg="green"))
        
        if audit:
            result = exporter.export_audit_record(session)
            results["audit"] = result
            if result.success:
                click.echo(click.style(f"   ✅ 审计记录: {result.output_path}", fg="green"))
        
        if claims:
            result = exporter.export_all_claim_packages(session, only_with_claims=True)
            results["claims"] = result
            if result.success:
                click.echo(click.style(f"   ✅ 申诉包: 导出 {result.file_count} 个", fg="green"))
    
    click.echo("")
    click.echo(click.style("✅ 导出完成", fg="green"))


@cli.command()
@click.option("--list", "-l", "list_sessions", is_flag=True, help="列出所有会话")
@click.option("--delete", "-d", help="删除指定会话")
@click.option("--info", "-i", help="查看指定会话详情")
def sessions(list_sessions: bool, delete: Optional[str], info: Optional[str]):
    """管理工作会话"""
    
    store = create_session_store()
    
    if list_sessions:
        sessions = store.list_sessions()
        
        if not sessions:
            click.echo("没有会话记录")
            return
        
        click.echo(click.style("📋 会话列表:", fg="cyan", bold=True))
        click.echo("")
        
        for s in sessions:
            click.echo(f"   会话ID: {s.get('session_id', 'N/A')}")
            click.echo(f"   名称: {s.get('name', 'N/A')}")
            click.echo(f"   包裹数: {s.get('package_count', 0)}")
            click.echo(f"   文件数: {s.get('file_count', 0)}")
            click.echo(f"   问题数: {s.get('issue_count', 0)}")
            click.echo(f"   严重问题: {s.get('critical_count', 0)}")
            click.echo(f"   创建时间: {s.get('created_at', 'N/A')}")
            click.echo("")
    
    elif delete:
        if store.session_exists(delete):
            store.delete_session(delete)
            click.echo(click.style(f"✅ 会话已删除: {delete}", fg="green"))
        else:
            click.echo(click.style(f"❌ 会话不存在: {delete}", fg="red"), err=True)
            sys.exit(1)
    
    elif info:
        session = store.load_session(info)
        if not session:
            click.echo(click.style(f"❌ 会话不存在: {info}", fg="red"), err=True)
            sys.exit(1)
        
        click.echo(click.style("📋 会话详情:", fg="cyan", bold=True))
        click.echo(f"   会话ID: {session.session_id}")
        click.echo(f"   名称: {session.name}")
        click.echo(f"   描述: {session.description}")
        click.echo(f"   扫描目录: {session.scanned_directory}")
        click.echo(f"   创建时间: {session.created_at}")
        click.echo(f"   最后更新: {session.updated_at}")
        click.echo("")
        click.echo(f"   包裹数: {len(session.packages)}")
        click.echo(f"   文件数: {len(session.files)}")
        click.echo(f"   问题数: {len(session.issues)}")
        click.echo(f"   复核记录数: {len(session.review_notes)}")
        
        if session.packages:
            click.echo("")
            click.echo(click.style("   包裹列表:", fg="cyan"))
            for waybill, package in session.packages.items():
                click.echo(f"      - {waybill}: {len(package.all_photos)}张照片, {len(package.claim_applications)}条赔付申请")


if __name__ == "__main__":
    cli()
