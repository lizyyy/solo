"""CLI主入口"""

from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table

from .. import __version__
from ..models import (
    ThresholdSettings,
    ReviewStatus,
    ReviewConclusion,
    IssueSeverity,
)
from ..parsers import (
    parse_sensor_csv,
    parse_route_csv,
    parse_box_csv,
    parse_photo_csv,
    ValidationError,
)
from ..rules import RuleEngine
from ..storage import SessionManager
from ..reports import (
    generate_markdown_report,
    export_issues_csv,
    export_json_audit,
)

console = Console()
DATA_DIR = Path.home() / ".exhibit_inspector" / "data"


def get_session_manager() -> SessionManager:
    """获取会话管理器"""
    return SessionManager(DATA_DIR)


def print_header(title: str):
    """打印标题"""
    console.print(f"\n[bold cyan]{title}[/bold cyan]")
    console.print("[dim]" + "=" * 50 + "[/dim]")


def print_success(message: str):
    """打印成功消息"""
    console.print(f"[green]✓[/green] {message}")


def print_warning(message: str):
    """打印警告消息"""
    console.print(f"[yellow]⚠[/yellow] {message}")


def print_error(message: str):
    """打印错误消息"""
    console.print(f"[red]✗[/red] {message}")


def print_info(message: str):
    """打印信息消息"""
    console.print(f"[blue]ℹ[/blue] {message}")


@click.group()
@click.version_option(__version__, "--version", "-v")
def cli():
    """
    展箱震动温湿度复核员 - 博物馆展品运输复核工具
    
    用于自动复核展品运输过程中的传感器数据、路书、展箱清单和照片。
    """
    pass


@cli.command()
@click.argument("shipment_id")
@click.option("--name", "-n", required=True, help="运输批次名称")
@click.option("--origin", "-o", required=True, help="始发地")
@click.option("--destination", "-d", required=True, help="目的地")
@click.option("--carrier", "-c", required=True, help="承运方")
@click.option("--transport-mode", "-m", default="road", help="运输方式 (road/air/rail)")
@click.option("--shock-threshold", type=float, default=2.0, help="震动阈值 (g)")
@click.option("--temp-max", type=float, default=25.0, help="最高温度阈值 (°C)")
@click.option("--temp-min", type=float, default=15.0, help="最低温度阈值 (°C)")
@click.option("--humid-max", type=float, default=70.0, help="最高湿度阈值 (%)")
@click.option("--humid-min", type=float, default=40.0, help="最低湿度阈值 (%)")
@click.option("--sample-interval", type=float, default=60.0, help="采样间隔 (秒)")
@click.option("--operator", help="操作人员")
def init(
    shipment_id: str,
    name: str,
    origin: str,
    destination: str,
    carrier: str,
    transport_mode: str,
    shock_threshold: float,
    temp_max: float,
    temp_min: float,
    humid_max: float,
    humid_min: float,
    sample_interval: float,
    operator: Optional[str],
):
    """
    初始化新运输配置
    
    创建新的运输会话并设置阈值参数。
    
    SHIPMENT_ID: 运输批次编号
    """
    print_header("初始化运输配置")
    
    thresholds = ThresholdSettings(
        shock_threshold_g=shock_threshold,
        temp_max_celsius=temp_max,
        temp_min_celsius=temp_min,
        humidity_max_pct=humid_max,
        humidity_min_pct=humid_min,
        sample_interval_seconds=sample_interval,
    )
    
    manager = get_session_manager()
    
    try:
        session = manager.init_transport(
            shipment_id=shipment_id,
            shipment_name=name,
            origin=origin,
            destination=destination,
            carrier=carrier,
            transport_mode=transport_mode,
            thresholds=thresholds,
            operator=operator,
        )
        
        print_success(f"运输配置已创建")
        print_info(f"会话ID: {session.session_id}")
        print_info(f"会话目录: {session.session_dir}")
        
        table = Table(title="阈值设置")
        table.add_column("参数", style="cyan")
        table.add_column("值", style="green")
        table.add_row("震动阈值", f"{shock_threshold}g")
        table.add_row("温度范围", f"{temp_min}°C - {temp_max}°C")
        table.add_row("湿度范围", f"{humid_min}% - {humid_max}%")
        table.add_row("采样间隔", f"{sample_interval}秒")
        console.print(table)
        
    except Exception as e:
        print_error(f"创建失败: {e}")
        raise click.Abort()


@cli.command()
@click.argument("shipment_id")
@click.option("--sensor", "-s", multiple=True, help="传感器CSV文件路径 (可多次指定)")
@click.option("--route", "-r", help="路书CSV文件路径")
@click.option("--boxes", "-b", help="展箱清单CSV文件路径")
@click.option("--photos", "-p", help="照片清单CSV文件路径")
@click.option("--session-id", help="指定会话ID (默认使用最新会话)")
def import_(
    shipment_id: str,
    sensor: tuple[str, ...],
    route: Optional[str],
    boxes: Optional[str],
    photos: Optional[str],
    session_id: Optional[str],
):
    """
    导入数据文件
    
    导入传感器CSV、路书、展箱清单和照片清单。
    
    SHIPMENT_ID: 运输批次编号
    """
    print_header("导入数据文件")
    
    manager = get_session_manager()
    
    try:
        session = manager.load_session(shipment_id, session_id)
        print_info(f"使用会话: {session.session_id}")
    except ValueError as e:
        print_error(str(e))
        raise click.Abort()
    
    import_summary = {
        "sensor_files": [],
        "route_file": None,
        "boxes_file": None,
        "photos_file": None,
        "errors": [],
        "warnings": [],
    }
    
    sensor_records = []
    sensor_stats = {
        "total_records": 0,
        "by_box": {},
        "by_sensor": {},
    }
    
    for sensor_file in sensor:
        print_info(f"导入传感器数据: {sensor_file}")
        try:
            result = parse_sensor_csv(sensor_file)
            
            if result.has_errors:
                for err in result.errors[:5]:
                    import_summary["errors"].append(str(err))
                print_warning(f"发现 {len(result.errors)} 个解析错误")
            
            if result.has_warnings:
                for warn in result.warnings:
                    import_summary["warnings"].append(warn)
            
            sensor_records.extend(result.data)
            sensor_stats["total_records"] += result.valid_rows
            
            for record in result.data:
                if record.box_id not in sensor_stats["by_box"]:
                    sensor_stats["by_box"][record.box_id] = 0
                sensor_stats["by_box"][record.box_id] += 1
                
                sensor_key = f"{record.box_id}:{record.sensor_id}"
                if sensor_key not in sensor_stats["by_sensor"]:
                    sensor_stats["by_sensor"][sensor_key] = 0
                sensor_stats["by_sensor"][sensor_key] += 1
            
            import_summary["sensor_files"].append({
                "file": sensor_file,
                "total_rows": result.total_rows,
                "valid_rows": result.valid_rows,
                "errors": len(result.errors),
            })
            
            print_success(f"成功导入 {result.valid_rows} 条传感器记录")
            
        except Exception as e:
            print_error(f"导入失败: {e}")
            import_summary["errors"].append(f"{sensor_file}: {e}")
    
    route_book = None
    if route:
        print_info(f"导入路书: {route}")
        try:
            result = parse_route_csv(route, shipment_id)
            if result.data:
                route_book = result.data[0]
                import_summary["route_file"] = {
                    "file": route,
                    "nodes_count": len(route_book.nodes),
                }
                print_success(f"成功导入路书，包含 {len(route_book.nodes)} 个节点")
        except Exception as e:
            print_error(f"导入路书失败: {e}")
            import_summary["errors"].append(f"route: {e}")
    
    boxes_data = []
    if boxes:
        print_info(f"导入展箱清单: {boxes}")
        try:
            result = parse_box_csv(boxes, shipment_id)
            boxes_data = result.data
            import_summary["boxes_file"] = {
                "file": boxes,
                "boxes_count": len(boxes_data),
            }
            print_success(f"成功导入 {len(boxes_data)} 个展箱")
        except Exception as e:
            print_error(f"导入展箱清单失败: {e}")
            import_summary["errors"].append(f"boxes: {e}")
    
    photos_data = []
    if photos:
        print_info(f"导入照片清单: {photos}")
        try:
            result = parse_photo_csv(photos)
            photos_data = result.data
            import_summary["photos_file"] = {
                "file": photos,
                "photos_count": len(photos_data),
            }
            print_success(f"成功导入 {len(photos_data)} 条照片记录")
        except Exception as e:
            print_error(f"导入照片清单失败: {e}")
            import_summary["errors"].append(f"photos: {e}")
    
    manager.save_imported_data(
        route_book=route_book if route_book else None,
        boxes=boxes_data if boxes_data else None,
        photos=photos_data if photos_data else None,
        sensor_records=sensor_records if sensor_records else None,
        import_summary=import_summary,
        sensor_stats=sensor_stats if sensor_stats else None,
    )
    
    print_success("数据导入完成")
    
    if import_summary["errors"]:
        print_warning(f"共发现 {len(import_summary['errors'])} 个错误")
        for err in import_summary["errors"][:10]:
            console.print(f"  [dim]- {err}[/dim]")


@cli.command()
@click.argument("shipment_id")
@click.option("--session-id", help="指定会话ID (默认使用最新会话)")
def analyze(
    shipment_id: str,
    session_id: Optional[str],
):
    """
    执行分析
    
    检测冲击峰值、温湿度超限、照片缺失和证据缺失。
    
    SHIPMENT_ID: 运输批次编号
    """
    print_header("执行分析")
    
    manager = get_session_manager()
    
    try:
        session = manager.load_session(shipment_id, session_id)
        print_info(f"使用会话: {session.session_id}")
    except ValueError as e:
        print_error(str(e))
        raise click.Abort()
    
    if not session.config:
        print_error("未找到运输配置，请先执行 init 命令")
        raise click.Abort()
    
    if not session.route_book:
        print_warning("未导入路书，部分分析可能无法执行")
    
    if not session.sensor_records:
        print_warning("未导入传感器数据，温湿度和震动分析将跳过")
    
    rule_engine = RuleEngine(session.config.thresholds)
    
    print_info("运行规则引擎...")
    
    analysis_result = rule_engine.analyze(
        shipment_id=shipment_id,
        sensor_records=session.sensor_records,
        photo_records=session.photos,
        route_book=session.route_book,
        available_evidence=[],
    )
    
    manager.save_issues(analysis_result.issues)
    
    print_success(f"分析完成，共检测到 {analysis_result.total_issues} 个问题")
    
    table = Table(title="问题统计")
    table.add_column("严重程度", style="cyan")
    table.add_column("数量", style="green")
    table.add_row("严重 (Critical)", str(analysis_result.critical_issues), style="red")
    table.add_row("高 (High)", str(analysis_result.high_issues), style="yellow")
    table.add_row("中 (Medium)", str(analysis_result.medium_issues), style="blue")
    table.add_row("低 (Low)", str(analysis_result.low_issues), style="green")
    table.add_row("总计", str(analysis_result.total_issues), style="bold")
    console.print(table)
    
    if analysis_result.issues:
        console.print("\n[bold]问题详情:[/bold]")
        for issue in analysis_result.issues[:10]:
            severity_icon = {
                IssueSeverity.CRITICAL: "[red]🔴[/red]",
                IssueSeverity.HIGH: "[yellow]🟠[/yellow]",
                IssueSeverity.MEDIUM: "[blue]🟡[/blue]",
                IssueSeverity.LOW: "[green]🟢[/green]",
            }.get(issue.severity, "")
            
            console.print(f"  {severity_icon} {issue.description}")
        
        if len(analysis_result.issues) > 10:
            console.print(f"  [dim]... 还有 {len(analysis_result.issues) - 10} 个问题[/dim]")
    
    if analysis_result.critical_issues > 0:
        print_warning("检测到严重级别问题，请立即复核！")


@cli.command()
@click.argument("shipment_id")
@click.option("--issue-id", "-i", help="问题ID (如不指定则列出所有问题)")
@click.option("--reviewer", "-r", help="复核人")
@click.option("--status", "-s", type=click.Choice([
    "pending", "under_review", "approved", "rejected", "needs_clarification"
]), help="复核状态")
@click.option("--conclusion", "-c", type=click.Choice([
    "acceptable", "acceptable_with_comments", "unacceptable", "requires_further_investigation"
]), help="复核结论")
@click.option("--comments", "-m", help="复核意见")
@click.option("--session-id", help="指定会话ID (默认使用最新会话)")
def review(
    shipment_id: str,
    issue_id: Optional[str],
    reviewer: Optional[str],
    status: Optional[str],
    conclusion: Optional[str],
    comments: Optional[str],
    session_id: Optional[str],
):
    """
    记录复核结论
    
    查看问题列表或添加复核结论。
    
    SHIPMENT_ID: 运输批次编号
    """
    print_header("复核管理")
    
    manager = get_session_manager()
    
    try:
        session = manager.load_session(shipment_id, session_id)
    except ValueError as e:
        print_error(str(e))
        raise click.Abort()
    
    if not session.issues:
        print_warning("没有检测到的问题，请先执行 analyze 命令")
        return
    
    if not issue_id and not reviewer:
        console.print("\n[bold]问题列表:[/bold]")
        table = Table()
        table.add_column("问题ID", style="cyan")
        table.add_column("严重程度", style="yellow")
        table.add_column("类型", style="green")
        table.add_column("描述", style="white", no_wrap=True)
        table.add_column("已复核", style="blue")
        
        for issue in session.issues:
            has_review = any(r.issue_id == issue.issue_id for r in session.reviews)
            table.add_row(
                issue.issue_id,
                issue.severity.value,
                issue.issue_type.value,
                issue.description[:50] + ("..." if len(issue.description) > 50 else ""),
                "✓" if has_review else "-",
            )
        console.print(table)
        
        console.print("\n使用 --issue-id 指定问题ID以添加复核结论")
        return
    
    if issue_id:
        issue = next((i for i in session.issues if i.issue_id == issue_id), None)
        if not issue:
            print_error(f"未找到问题ID: {issue_id}")
            raise click.Abort()
        
        if not reviewer:
            console.print(f"\n[bold]问题详情:[/bold]")
            console.print(f"问题ID: {issue.issue_id}")
            console.print(f"严重程度: {issue.severity.value}")
            console.print(f"问题类型: {issue.issue_type.value}")
            console.print(f"描述: {issue.description}")
            if issue.box_id:
                console.print(f"展箱编号: {issue.box_id}")
            if issue.start_time:
                console.print(f"开始时间: {issue.start_time}")
            if issue.end_time:
                console.print(f"结束时间: {issue.end_time}")
            
            existing_reviews = [r for r in session.reviews if r.issue_id == issue_id]
            if existing_reviews:
                console.print(f"\n[bold]已有复核记录:[/bold]")
                for rev in existing_reviews:
                    console.print(f"  复核人: {rev.reviewer}")
                    console.print(f"  状态: {rev.status.value}")
                    if rev.conclusion:
                        console.print(f"  结论: {rev.conclusion.value}")
                    if rev.comments:
                        console.print(f"  意见: {rev.comments}")
                    console.print(f"  时间: {rev.review_time}")
            return
        
        status_enum = ReviewStatus(status) if status else ReviewStatus.PENDING
        conclusion_enum = ReviewConclusion(conclusion) if conclusion else None
        
        review_record = manager.add_review(
            issue_id=issue_id,
            reviewer=reviewer,
            status=status_enum,
            conclusion=conclusion_enum,
            comments=comments,
        )
        
        print_success(f"复核记录已添加: {review_record.review_id}")
        print_info(f"复核人: {reviewer}")
        print_info(f"状态: {status_enum.value}")
        if conclusion_enum:
            print_info(f"结论: {conclusion_enum.value}")
        if comments:
            print_info(f"意见: {comments}")


@cli.command()
@click.argument("shipment_id")
@click.option("--output-dir", "-o", required=True, help="输出目录路径")
@click.option("--format", "-f", type=click.Choice(["all", "markdown", "csv", "json"]), 
              default="all", help="导出格式")
@click.option("--session-id", help="指定会话ID (默认使用最新会话)")
def export(
    shipment_id: str,
    output_dir: str,
    format: str,
    session_id: Optional[str],
):
    """
    导出报告
    
    导出 Markdown 复核报告、CSV 问题清单和 JSON 审计包。
    
    SHIPMENT_ID: 运输批次编号
    """
    print_header("导出报告")
    
    output_path = Path(output_dir)
    output_path.mkdir(parents=True, exist_ok=True)
    
    manager = get_session_manager()
    
    try:
        session = manager.load_session(shipment_id, session_id)
        print_info(f"使用会话: {session.session_id}")
    except ValueError as e:
        print_error(str(e))
        raise click.Abort()
    
    audit = manager.build_audit_package()
    
    exported_files = []
    
    if format in ["all", "markdown"]:
        md_file = output_path / f"{shipment_id}_report.md"
        generate_markdown_report(audit, md_file)
        exported_files.append(md_file)
        print_success(f"Markdown报告: {md_file}")
    
    if format in ["all", "csv"]:
        csv_file = output_path / f"{shipment_id}_issues.csv"
        export_issues_csv(audit, csv_file)
        exported_files.append(csv_file)
        print_success(f"CSV问题清单: {csv_file}")
    
    if format in ["all", "json"]:
        json_file = output_path / f"{shipment_id}_audit.json"
        export_json_audit(audit, json_file)
        exported_files.append(json_file)
        print_success(f"JSON审计包: {json_file}")
    
    print_success(f"导出完成，共 {len(exported_files)} 个文件")
    
    table = Table(title="导出文件列表")
    table.add_column("文件名", style="cyan")
    table.add_column("格式", style="green")
    for f in exported_files:
        fmt = f.suffix[1:].upper()
        table.add_row(f.name, fmt)
    console.print(table)


@cli.command()
@click.argument("shipment_id", required=False)
@click.option("--all", "-a", is_flag=True, help="列出所有运输批次的会话")
def sessions(
    shipment_id: Optional[str],
    all: bool,
):
    """
    列出会话
    
    查看现有的运输会话列表。
    """
    print_header("会话列表")
    
    manager = get_session_manager()
    
    sessions = manager.list_sessions(shipment_id if not all else None)
    
    if not sessions:
        print_info("暂无会话")
        return
    
    table = Table()
    table.add_column("会话ID", style="cyan")
    table.add_column("运输批次", style="green")
    table.add_column("创建时间", style="blue")
    table.add_column("状态", style="yellow")
    
    for s in sessions:
        status_parts = []
        if s["processed"]:
            status_parts.append("已分析")
        if s["reviewed"]:
            status_parts.append("已复核")
        if s["exported"]:
            status_parts.append("已导出")
        status = ", ".join(status_parts) if status_parts else "新创建"
        
        table.add_row(
            s["session_id"],
            s["shipment_id"],
            s["created_at"],
            status,
        )
    
    console.print(table)


if __name__ == "__main__":
    cli()
