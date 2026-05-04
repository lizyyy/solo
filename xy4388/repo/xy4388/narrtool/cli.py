"""口述影像检查工具命令行入口"""

import os
import sys
from pathlib import Path
from datetime import datetime

import click

from narrtool.config import config
from narrtool.database import (
    init_db,
    session_scope,
    Screening,
    CheckResult,
    CheckStatus,
    CheckType,
    Severity,
)
from narrtool.services import ScreeningService, CheckService
from narrtool.exporters import MarkdownExporter, CSVExporter, JSONExporter


def _print_banner():
    """打印欢迎横幅"""
    banner = """
╔══════════════════════════════════════════════════════════╗
║           口述影像检查工具 (NarrTool) v0.1.0              ║
║         无障碍电影放映前的质量检查与复核平台                ║
╚══════════════════════════════════════════════════════════╝
"""
    click.echo(banner)


def _ensure_db():
    """确保数据库已初始化"""
    init_db()


@click.group()
@click.option("--db-path", type=click.Path(), help="数据库文件路径")
@click.option("--data-dir", type=click.Path(), help="数据目录")
@click.pass_context
def cli(ctx, db_path, data_dir):
    """口述影像检查工具 - 无障碍电影放映前的质量检查与复核平台"""
    if db_path:
        config.db_path = db_path
    if data_dir:
        config.data_dir = data_dir
    
    _ensure_db()
    ctx.ensure_object(dict)


@cli.command()
@click.option("--host", default="127.0.0.1", help="绑定地址")
@click.option("--port", default=8000, help="端口号")
@click.option("--reload", is_flag=True, help="开发模式自动重载")
def serve(host, port, reload):
    """启动 Web API 和复核页面服务"""
    import uvicorn
    
    _print_banner()
    click.echo(f"启动服务于 http://{host}:{port}")
    click.echo(f"API 文档: http://{host}:{port}/docs")
    click.echo(f"复核页面: http://{host}:{port}/")
    click.echo("")
    click.echo("按 Ctrl+C 停止服务")
    click.echo("-" * 50)
    
    uvicorn.run(
        "narrtool.api:app",
        host=host,
        port=port,
        reload=reload,
    )


@cli.command()
@click.argument("movie_name")
@click.argument("screening_time")
@click.argument("duration", type=float)
@click.option("--location", help="放映地点")
@click.option("--srt", type=click.Path(exists=True), help="SRT 字幕文件路径")
@click.option("--script", type=click.Path(exists=True), help="口述稿 JSON 文件路径")
@click.option("--volunteers", type=click.Path(exists=True), help="志愿者排班 CSV 文件路径")
@click.option("--run-check", is_flag=True, help="导入后立即运行检查")
def import_data(movie_name, screening_time, duration, location, srt, script, volunteers, run_check):
    """导入场次数据和相关文件
    
    MOVIE_NAME: 电影名称
    SCREENING_TIME: 放映时间 (格式: 2024-01-01 14:00)
    DURATION: 时长 (分钟)
    """
    _print_banner()
    
    try:
        screening_dt = datetime.fromisoformat(screening_time)
    except ValueError:
        click.echo(f"错误: 无效的时间格式: {screening_time}")
        click.echo("请使用 ISO 格式: 2024-01-01T14:00:00 或 2024-01-01 14:00")
        sys.exit(1)
    
    with session_scope() as session:
        service = ScreeningService(session)
        
        click.echo(f"创建场次: {movie_name}")
        click.echo(f"  放映时间: {screening_dt.strftime('%Y-%m-%d %H:%M')}")
        click.echo(f"  时长: {duration} 分钟")
        if location:
            click.echo(f"  地点: {location}")
        
        screening, stats = service.import_all(
            movie_name=movie_name,
            screening_time=screening_dt,
            duration=duration,
            location=location,
            srt_path=srt,
            script_path=script,
            volunteer_path=volunteers,
        )
        
        click.echo("")
        click.echo("导入统计:")
        click.echo(f"  场次 ID: {screening.id}")
        click.echo(f"  字幕: {stats['subtitles']} 条")
        click.echo(f"  口述段落: {stats['narrations']} 条")
        click.echo(f"  志愿者: {stats['volunteers']} 条")
        
        if run_check:
            click.echo("")
            click.echo("运行检查...")
            
            check_service = CheckService(session)
            results = check_service.run_checks(screening.id)
            
            click.echo(f"检查完成，发现 {len(results)} 个问题")
            _print_results_summary(results)


@cli.command("list")
def list_screenings():
    """列出所有场次"""
    _print_banner()
    
    with session_scope() as session:
        screenings = session.query(Screening).order_by(Screening.screening_time).all()
        
        if not screenings:
            click.echo("暂无场次")
            return
        
        click.echo(f"共 {len(screenings)} 个场次:")
        click.echo("-" * 80)
        
        for s in screenings:
            click.echo(f"ID: {s.id}")
            click.echo(f"  电影: {s.movie_name}")
            click.echo(f"  时间: {s.screening_time.strftime('%Y-%m-%d %H:%M')}")
            click.echo(f"  时长: {s.duration} 分钟")
            if s.location:
                click.echo(f"  地点: {s.location}")
            click.echo("")


@cli.command()
@click.argument("screening_id", type=int)
def check(screening_id):
    """运行场次检查
    
    SCREENING_ID: 场次 ID
    """
    _print_banner()
    
    with session_scope() as session:
        screening = session.query(Screening).filter(
            Screening.id == screening_id
        ).first()
        
        if not screening:
            click.echo(f"错误: 场次不存在: {screening_id}")
            sys.exit(1)
        
        click.echo(f"检查场次: {screening.movie_name} (ID: {screening_id})")
        click.echo("")
        
        service = CheckService(session)
        results = service.run_checks(screening_id)
        
        _print_results_summary(results)
        click.echo("")
        
        if results:
            click.echo("问题详情:")
            click.echo("-" * 80)
            
            for r in results:
                click.echo(f"ID: {r.id}")
                click.echo(f"  类型: {_format_check_type(r.check_type)}")
                click.echo(f"  严重度: {_format_severity(r.severity)}")
                click.echo(f"  状态: {_format_status(r.status)}")
                click.echo(f"  描述:")
                for line in r.description.split("\n"):
                    click.echo(f"    {line}")
                click.echo("")


def _print_results_summary(results):
    """打印检查结果摘要"""
    if not results:
        click.echo("未发现任何问题")
        return
    
    by_type = {}
    by_severity = {}
    by_status = {}
    
    for r in results:
        t = r.check_type.value
        s = r.severity.value
        st = r.status.value
        
        by_type[t] = by_type.get(t, 0) + 1
        by_severity[s] = by_severity.get(s, 0) + 1
        by_status[st] = by_status.get(st, 0) + 1
    
    click.echo("检查摘要:")
    click.echo(f"  总问题数: {len(results)}")
    click.echo(f"  按类型: {by_type}")
    click.echo(f"  按严重度: {by_severity}")
    click.echo(f"  按状态: {by_status}")


def _format_check_type(check_type):
    """格式化检查类型"""
    names = {
        CheckType.DIALOGUE_OVERLAP: "口述压住对白",
        CheckType.MISSING_SCENE: "关键场景问题",
        CheckType.VOLUNTEER_CONFLICT: "志愿者冲突",
    }
    return names.get(check_type, check_type.value)


def _format_severity(severity):
    """格式化严重程度"""
    names = {
        Severity.HIGH: "高",
        Severity.MEDIUM: "中",
        Severity.LOW: "低",
    }
    return names.get(severity, severity.value)


def _format_status(status):
    """格式化状态"""
    names = {
        CheckStatus.PENDING: "待复核",
        CheckStatus.CONFIRMED: "已确认",
        CheckStatus.DISMISSED: "已驳回",
    }
    return names.get(status, status.value)


@cli.command()
@click.argument("result_id", type=int)
@click.argument("status", type=click.Choice(["pending", "confirmed", "dismissed"]))
@click.option("--notes", help="备注")
def update(result_id, status, notes):
    """更新检查结果状态（改判）
    
    RESULT_ID: 检查结果 ID
    STATUS: 新状态 (pending/confirmed/dismissed)
    """
    _print_banner()
    
    status_map = {
        "pending": CheckStatus.PENDING,
        "confirmed": CheckStatus.CONFIRMED,
        "dismissed": CheckStatus.DISMISSED,
    }
    
    with session_scope() as session:
        service = CheckService(session)
        
        if service.update_status(result_id, status_map[status], notes):
            click.echo(f"更新成功: 结果 {result_id} 状态改为 {status}")
            if notes:
                click.echo(f"  备注: {notes}")
        else:
            click.echo(f"错误: 检查结果不存在: {result_id}")
            sys.exit(1)


@cli.command()
@click.argument("screening_id", type=int)
@click.option("--format", "-f", 
              type=click.Choice(["markdown", "csv", "json", "all"]), 
              default="markdown",
              help="导出格式")
@click.option("--output", "-o", type=click.Path(), help="输出文件路径")
def export(screening_id, format, output):
    """导出检查结果
    
    SCREENING_ID: 场次 ID
    """
    _print_banner()
    
    with session_scope() as session:
        screening = session.query(Screening).filter(
            Screening.id == screening_id
        ).first()
        
        if not screening:
            click.echo(f"错误: 场次不存在: {screening_id}")
            sys.exit(1)
        
        click.echo(f"导出场次: {screening.movie_name} (ID: {screening_id})")
        click.echo("")
        
        outputs = []
        
        if format in ["markdown", "all"]:
            path = output or config.export_dir / f"{screening.movie_name}_交付单.md"
            exporter = MarkdownExporter(session)
            exporter.export(screening_id, path)
            outputs.append(str(path))
            click.echo(f"Markdown 交付单: {path}")
        
        if format in ["csv", "all"]:
            path = output or config.export_dir / f"{screening.movie_name}_问题清单.csv"
            exporter = CSVExporter(session)
            exporter.export(screening_id, path)
            outputs.append(str(path))
            click.echo(f"CSV 问题清单: {path}")
        
        if format in ["json", "all"]:
            path = output or config.export_dir / f"{screening.movie_name}_审计包.json"
            exporter = JSONExporter(session)
            exporter.export(screening_id, path)
            outputs.append(str(path))
            click.echo(f"JSON 审计包: {path}")
        
        click.echo("")
        click.echo("导出完成!")


@cli.command()
@click.argument("screening_id", type=int)
def delete(screening_id):
    """删除场次
    
    SCREENING_ID: 场次 ID
    """
    _print_banner()
    
    with session_scope() as session:
        service = ScreeningService(session)
        
        screening = service.get_screening(screening_id)
        if not screening:
            click.echo(f"错误: 场次不存在: {screening_id}")
            sys.exit(1)
        
        if click.confirm(f"确定要删除场次 '{screening.movie_name}' 吗? 此操作不可恢复。"):
            service.delete_screening(screening_id)
            click.echo(f"已删除场次: {screening.movie_name}")
        else:
            click.echo("操作已取消")


if __name__ == "__main__":
    cli()
