import os
import sys
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.table import Table
from rich.tree import Tree
from rich.panel import Panel

from .models import IssueSeverity, ConflictType
from .storage import StorageManager
from .importer import CallSheetImporter
from .comparator import VersionComparator
from .conflict_detector import ConflictDetector
from .report import ReportGenerator

console = Console()


def get_storage() -> StorageManager:
    return StorageManager()


def ensure_project_exists():
    storage = get_storage()
    if not storage.project_exists():
        console.print("[red]错误: 项目未初始化，请先运行 'call-sheet init'[/red]")
        sys.exit(1)
    return storage


@click.group()
@click.version_option(package_name="call-sheet-cli")
def main():
    """剧组通告单变更管理工具

    用于管理影视剧组每天频繁变更的通告单，包括导入、版本对比、
    冲突检测和报告生成。
    """
    pass


@main.command()
@click.argument("project_name")
def init(project_name):
    """初始化一个新项目"""
    storage = get_storage()
    if storage.project_exists():
        console.print(f"[yellow]警告: 项目已存在: {storage.load_state().project_name}[/yellow]")
        if not click.confirm("是否覆盖现有项目?"):
            return
    
    state = storage.init_project(project_name)
    console.print(f"[green]项目 '{project_name}' 初始化成功[/green]")
    console.print(f"数据目录: {storage.project_dir.absolute()}")


@main.command()
@click.argument("file_path", type=click.Path(exists=True))
@click.option("--version", "-v", "version_str", help="版本号 (如: v1, v2-revised)")
@click.option("--date", "-d", help="拍摄日期 (如: 2024-01-15)")
def import_sheet(file_path, version_str, date):
    """导入通告单文件
    
    支持 JSON 和 CSV 格式。
    重复导入相同版本会覆盖之前的数据。
    """
    storage = ensure_project_exists()
    state = storage.load_state()
    
    file_path = Path(file_path)
    
    if not version_str:
        base_name = file_path.stem
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        version_str = f"{base_name}-{timestamp}"
    
    importer = CallSheetImporter(str(file_path))
    call_sheet, issues = importer.import_file(version_str)
    
    shoot_date_str = call_sheet.shoot_date.isoformat()
    
    console.print(f"\n[bold]导入结果[/bold]")
    console.print(f"版本: {version_str}")
    console.print(f"拍摄日期: {shoot_date_str}")
    console.print(f"场景数: {len(call_sheet.scenes)}")
    console.print(f"演员数: {len(call_sheet.actors)}")
    console.print(f"车辆数: {len(call_sheet.vehicles)}")
    
    if issues:
        errors = [i for i in issues if i.severity == IssueSeverity.ERROR]
        warnings = [i for i in issues if i.severity == IssueSeverity.WARNING]
        
        console.print(f"\n[yellow]问题: {len(issues)} 个[/yellow]")
        if errors:
            console.print(f"  [red]错误: {len(errors)} 个[/red]")
        if warnings:
            console.print(f"  [orange]警告: {len(warnings)} 个[/orange]")
        
        issue_table = Table(title="问题详情")
        issue_table.add_column("类型", style="cyan")
        issue_table.add_column("严重度", style="magenta")
        issue_table.add_column("消息", style="white")
        issue_table.add_column("来源", style="green")
        issue_table.add_column("行号", style="yellow")
        
        for issue in issues:
            severity_style = "red" if issue.severity == IssueSeverity.ERROR else "yellow"
            issue_table.add_row(
                issue.issue_type.value,
                f"[{severity_style}]{issue.severity.value}[/{severity_style}]",
                issue.message,
                issue.source,
                str(issue.line_number or "-")
            )
        console.print(issue_table)
    
    detector = ConflictDetector()
    prev_version = None
    if shoot_date_str in state.shoot_dates and state.shoot_dates[shoot_date_str]:
        prev_version_name = sorted(state.shoot_dates[shoot_date_str])[-1]
        if prev_version_name in state.versions:
            prev_version = state.versions[prev_version_name]
    
    conflicts = detector.detect(call_sheet, prev_version)
    call_sheet.conflicts = conflicts
    
    if conflicts:
        console.print(f"\n[red]冲突: {len(conflicts)} 个[/red]")
        conflict_table = Table(title="冲突详情")
        conflict_table.add_column("类型", style="cyan")
        conflict_table.add_column("描述", style="white")
        conflict_table.add_column("影响项", style="green")
        
        for conflict in conflicts:
            conflict_table.add_row(
                conflict.conflict_type.value,
                conflict.description,
                ", ".join(conflict.affected_items)
            )
        console.print(conflict_table)
    
    version_key = f"{shoot_date_str}__{version_str}"
    state.versions[version_key] = call_sheet
    
    if shoot_date_str not in state.shoot_dates:
        state.shoot_dates[shoot_date_str] = []
    if version_str not in state.shoot_dates[shoot_date_str]:
        state.shoot_dates[shoot_date_str].append(version_str)
        state.shoot_dates[shoot_date_str].sort()
    
    state.all_issues.extend(issues)
    state.all_conflicts.extend(conflicts)
    
    storage.save_state(state)
    
    console.print(f"\n[green]版本 '{version_str}' 已保存[/green]")
    console.print(f"版本ID: {version_key}")


@main.command("list")
def list_versions():
    """列出所有版本"""
    storage = ensure_project_exists()
    state = storage.load_state()
    
    if not state.shoot_dates:
        console.print("[yellow]没有导入任何版本[/yellow]")
        return
    
    console.print(f"\n[bold]项目: {state.project_name}[/bold]")
    console.print(f"总拍摄天数: {len(state.shoot_dates)}")
    console.print(f"总版本数: {len(state.versions)}\n")
    
    for shoot_date_str, version_names in sorted(state.shoot_dates.items()):
        console.print(f"[bold]{shoot_date_str}[/bold] ({len(version_names)} 个版本)")
        
        table = Table(show_header=True, header_style="bold cyan")
        table.add_column("版本")
        table.add_column("导入时间")
        table.add_column("场景")
        table.add_column("演员")
        table.add_column("车辆")
        table.add_column("问题")
        table.add_column("冲突")
        
        for version_name in sorted(version_names):
            version_key = f"{shoot_date_str}__{version_name}"
            if version_key in state.versions:
                v = state.versions[version_key]
                errors = len([i for i in v.issues if i.severity == IssueSeverity.ERROR])
                table.add_row(
                    version_name,
                    v.imported_at.strftime("%H:%M:%S"),
                    str(len(v.scenes)),
                    str(len(v.actors)),
                    str(len(v.vehicles)),
                    f"[red]{errors}[/red]" if errors else f"[green]0[/green]",
                    f"[red]{len(v.conflicts)}[/red]" if v.conflicts else f"[green]0[/green]"
                )
        
        console.print(table)


@main.command()
@click.argument("version_key")
@click.option("--output", "-o", help="输出文件路径")
def show(version_key, output):
    """显示指定版本详情"""
    storage = ensure_project_exists()
    state = storage.load_state()
    
    if version_key not in state.versions:
        console.print(f"[red]版本 '{version_key}' 不存在[/red]")
        console.print("使用 'call-sheet list' 查看可用版本")
        sys.exit(1)
    
    v = state.versions[version_key]
    
    console.print(Panel.fit(
        f"[bold]{version_key}[/bold]\n"
        f"拍摄日期: {v.shoot_date}\n"
        f"导入时间: {v.imported_at}\n"
        f"来源文件: {v.source_file}",
        title="版本信息"
    ))
    
    if v.scenes:
        scene_table = Table(title="场景", show_header=True, header_style="bold cyan")
        scene_table.add_column("场景号")
        scene_table.add_column("地点")
        scene_table.add_column("时间")
        scene_table.add_column("演员")
        scene_table.add_column("车辆")
        
        for scene in v.scenes:
            time_str = ""
            if scene.call_time:
                time_str = scene.call_time.strftime("%H:%M")
            if scene.wrap_time:
                time_str += f"-{scene.wrap_time.strftime('%H:%M')}"
            
            scene_table.add_row(
                scene.number,
                scene.location,
                time_str,
                ", ".join(scene.actors) if scene.actors else "-",
                ", ".join(scene.vehicles) if scene.vehicles else "-"
            )
        console.print(scene_table)
    
    if v.actors:
        actor_table = Table(title="演员", show_header=True, header_style="bold cyan")
        actor_table.add_column("姓名")
        actor_table.add_column("角色")
        actor_table.add_column("到场时间")
        actor_table.add_column("收工时间")
        actor_table.add_column("场景")
        
        for actor in v.actors:
            actor_table.add_row(
                actor.name,
                actor.role,
                actor.call_time.strftime("%H:%M") if actor.call_time else "-",
                actor.wrap_time.strftime("%H:%M") if actor.wrap_time else "-",
                ", ".join(actor.scenes) if actor.scenes else "-"
            )
        console.print(actor_table)
    
    if v.vehicles:
        vehicle_table = Table(title="车辆", show_header=True, header_style="bold cyan")
        vehicle_table.add_column("ID")
        vehicle_table.add_column("类型")
        vehicle_table.add_column("司机")
        vehicle_table.add_column("用途")
        
        for vehicle in v.vehicles:
            vehicle_table.add_row(
                vehicle.id,
                vehicle.type,
                vehicle.driver or "-",
                vehicle.usage or "-"
            )
        console.print(vehicle_table)
    
    if v.issues:
        issue_table = Table(title=f"问题 ({len(v.issues)})", show_header=True, header_style="bold magenta")
        issue_table.add_column("类型")
        issue_table.add_column("严重度")
        issue_table.add_column("消息")
        issue_table.add_column("行号")
        
        for issue in v.issues:
            severity_style = "red" if issue.severity == IssueSeverity.ERROR else "yellow"
            issue_table.add_row(
                issue.issue_type.value,
                f"[{severity_style}]{issue.severity.value}[/{severity_style}]",
                issue.message,
                str(issue.line_number or "-")
            )
        console.print(issue_table)
    
    if v.conflicts:
        conflict_table = Table(title=f"冲突 ({len(v.conflicts)})", show_header=True, header_style="bold red")
        conflict_table.add_column("类型")
        conflict_table.add_column("描述")
        conflict_table.add_column("详情")
        
        for conflict in v.conflicts:
            conflict_table.add_row(
                conflict.conflict_type.value,
                conflict.description,
                json.dumps(conflict.details, ensure_ascii=False)[:80]
            )
        console.print(conflict_table)


@main.command()
@click.argument("version_key_1")
@click.argument("version_key_2")
@click.option("--output", "-o", help="输出差异报告文件路径")
def diff(version_key_1, version_key_2, output):
    """对比两个版本的差异"""
    storage = ensure_project_exists()
    state = storage.load_state()
    
    if version_key_1 not in state.versions:
        console.print(f"[red]版本 '{version_key_1}' 不存在[/red]")
        sys.exit(1)
    if version_key_2 not in state.versions:
        console.print(f"[red]版本 '{version_key_2}' 不存在[/red]")
        sys.exit(1)
    
    v1 = state.versions[version_key_1]
    v2 = state.versions[version_key_2]
    
    comparator = VersionComparator()
    version_diff = comparator.compare(v1, v2)
    
    console.print(f"\n[bold]版本对比: {version_key_1} -> {version_key_2}[/bold]")
    
    if not version_diff.has_changes():
        console.print("[green]两个版本没有差异[/green]")
        return
    
    console.print(f"\n[cyan]场景变更:[/cyan]")
    if version_diff.scenes_added:
        console.print(f"  [green]新增: {len(version_diff.scenes_added)}[/green]")
        for s in version_diff.scenes_added:
            console.print(f"    + {s.number}: {s.location}")
    if version_diff.scenes_removed:
        console.print(f"  [red]删除: {len(version_diff.scenes_removed)}[/red]")
        for s in version_diff.scenes_removed:
            console.print(f"    - {s.number}: {s.location}")
    if version_diff.scenes_modified:
        console.print(f"  [yellow]修改: {len(version_diff.scenes_modified)}[/yellow]")
        for m in version_diff.scenes_modified:
            console.print(f"    ~ {m['scene_number']}")
    
    console.print(f"\n[cyan]演员变更:[/cyan]")
    if version_diff.actors_added:
        console.print(f"  [green]新增: {len(version_diff.actors_added)}[/green]")
        for a in version_diff.actors_added:
            console.print(f"    + {a.name}")
    if version_diff.actors_removed:
        console.print(f"  [red]删除: {len(version_diff.actors_removed)}[/red]")
        for a in version_diff.actors_removed:
            console.print(f"    - {a.name}")
    if version_diff.actors_modified:
        console.print(f"  [yellow]修改: {len(version_diff.actors_modified)}[/yellow]")
    
    console.print(f"\n[cyan]车辆变更:[/cyan]")
    if version_diff.vehicles_added:
        console.print(f"  [green]新增: {len(version_diff.vehicles_added)}[/green]")
    if version_diff.vehicles_removed:
        console.print(f"  [red]删除: {len(version_diff.vehicles_removed)}[/red]")
    if version_diff.vehicles_modified:
        console.print(f"  [yellow]修改: {len(version_diff.vehicles_modified)}[/yellow]")
    
    if output:
        report_gen = ReportGenerator()
        report_path = report_gen.generate_diff_report(version_diff, output)
        console.print(f"\n[green]差异报告已保存: {report_path}[/green]")


@main.command()
@click.option("--type", "-t", "filter_type", help="按问题类型筛选")
@click.option("--severity", "-s", help="按严重度筛选 (error/warning)")
@click.option("--output", "-o", help="输出报告文件路径")
def issues(filter_type, severity, output):
    """查询所有问题"""
    storage = ensure_project_exists()
    state = storage.load_state()
    
    issues_list = state.all_issues
    
    if filter_type:
        issues_list = [i for i in issues_list if filter_type in i.issue_type.value]
    
    if severity:
        severity_lower = severity.lower()
        if severity_lower == "error":
            issues_list = [i for i in issues_list if i.severity == IssueSeverity.ERROR]
        elif severity_lower == "warning":
            issues_list = [i for i in issues_list if i.severity == IssueSeverity.WARNING]
    
    if not issues_list:
        console.print("[green]没有发现问题[/green]")
        return
    
    errors = [i for i in issues_list if i.severity == IssueSeverity.ERROR]
    warnings = [i for i in issues_list if i.severity == IssueSeverity.WARNING]
    
    console.print(f"\n[bold]问题统计[/bold]")
    console.print(f"总问题数: {len(issues_list)}")
    console.print(f"错误: {len(errors)}")
    console.print(f"警告: {len(warnings)}\n")
    
    table = Table(title="问题列表")
    table.add_column("#", style="cyan")
    table.add_column("类型", style="magenta")
    table.add_column("严重度", style="red")
    table.add_column("消息", style="white")
    table.add_column("来源", style="green")
    table.add_column("行号", style="yellow")
    
    for idx, issue in enumerate(issues_list, 1):
        severity_style = "red" if issue.severity == IssueSeverity.ERROR else "yellow"
        table.add_row(
            str(idx),
            issue.issue_type.value,
            f"[{severity_style}]{issue.severity.value}[/{severity_style}]",
            issue.message,
            issue.source,
            str(issue.line_number or "-")
        )
    console.print(table)
    
    if output:
        report_gen = ReportGenerator()
        temp_state = type('obj', (object,), {'project_name': state.project_name, 'all_issues': issues_list})()
        report_path = report_gen.generate_issue_report(temp_state, output)
        console.print(f"\n[green]问题报告已保存: {report_path}[/green]")


@main.command()
@click.option("--type", "-t", "filter_type", help="按冲突类型筛选")
@click.option("--output", "-o", help="输出报告文件路径")
def conflicts(filter_type, output):
    """查询所有冲突"""
    storage = ensure_project_exists()
    state = storage.load_state()
    
    conflicts_list = state.all_conflicts
    
    if filter_type:
        conflicts_list = [c for c in conflicts_list if filter_type in c.conflict_type.value]
    
    if not conflicts_list:
        console.print("[green]没有发现冲突[/green]")
        return
    
    actor_conflicts = [c for c in conflicts_list if c.conflict_type == ConflictType.ACTOR_TIME_CONFLICT]
    vehicle_conflicts = [c for c in conflicts_list if c.conflict_type == ConflictType.VEHICLE_TIME_CONFLICT]
    location_conflicts = [c for c in conflicts_list if c.conflict_type == ConflictType.SCENE_LOCATION_CONFLICT]
    version_changes = [c for c in conflicts_list if c.conflict_type == ConflictType.VERSION_CHANGE]
    
    console.print(f"\n[bold]冲突统计[/bold]")
    console.print(f"总冲突数: {len(conflicts_list)}")
    console.print(f"演员时间冲突: {len(actor_conflicts)}")
    console.print(f"车辆时间冲突: {len(vehicle_conflicts)}")
    console.print(f"地点使用冲突: {len(location_conflicts)}")
    console.print(f"版本间变更: {len(version_changes)}\n")
    
    table = Table(title="冲突列表")
    table.add_column("#", style="cyan")
    table.add_column("类型", style="magenta")
    table.add_column("描述", style="white")
    table.add_column("影响项", style="green")
    
    for idx, conflict in enumerate(conflicts_list, 1):
        table.add_row(
            str(idx),
            conflict.conflict_type.value,
            conflict.description,
            ", ".join(conflict.affected_items)
        )
    console.print(table)
    
    if output:
        report_gen = ReportGenerator()
        temp_state = type('obj', (object,), {'project_name': state.project_name, 'all_conflicts': conflicts_list})()
        report_path = report_gen.generate_conflict_report(temp_state, output)
        console.print(f"\n[green]冲突报告已保存: {report_path}[/green]")


@main.command()
@click.argument("version_key")
@click.option("--output", "-o", help="输出报告文件路径")
def distribute(version_key, output):
    """生成现场分发报告
    
    按地点、演员、车辆分组，方便现场分发使用。
    """
    storage = ensure_project_exists()
    state = storage.load_state()
    
    if version_key not in state.versions:
        console.print(f"[red]版本 '{version_key}' 不存在[/red]")
        sys.exit(1)
    
    v = state.versions[version_key]
    
    if not output:
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        output = f"distribute_{version_key}_{timestamp}.txt"
    
    report_gen = ReportGenerator()
    report_path = report_gen.generate_field_distribution_report(v, output)
    
    console.print(f"[green]现场分发报告已生成: {report_path}[/green]")
    
    with open(report_path, "r", encoding="utf-8") as f:
        console.print(f.read())


@main.command()
@click.option("--type", "-t", "report_type", 
              type=click.Choice(['summary', 'issues', 'conflicts', 'all'], case_sensitive=False),
              default='summary',
              help="报告类型")
@click.option("--output", "-o", help="输出报告文件路径")
def report(report_type, output):
    """生成业务报告"""
    storage = ensure_project_exists()
    state = storage.load_state()
    
    report_gen = ReportGenerator()
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    
    if report_type.lower() == 'summary':
        output = output or f"summary_report_{timestamp}.txt"
        report_path = report_gen.generate_summary_report(state, output)
    elif report_type.lower() == 'issues':
        output = output or f"issues_report_{timestamp}.txt"
        report_path = report_gen.generate_issue_report(state, output)
    elif report_type.lower() == 'conflicts':
        output = output or f"conflicts_report_{timestamp}.txt"
        report_path = report_gen.generate_conflict_report(state, output)
    else:
        base_output = Path(output or "reports")
        if base_output.suffix:
            base_output = base_output.parent
        base_output.mkdir(parents=True, exist_ok=True)
        
        summary_path = report_gen.generate_summary_report(state, str(base_output / f"summary_{timestamp}.txt"))
        issues_path = report_gen.generate_issue_report(state, str(base_output / f"issues_{timestamp}.txt"))
        conflicts_path = report_gen.generate_conflict_report(state, str(base_output / f"conflicts_{timestamp}.txt"))
        
        console.print(f"[green]报告已生成:[/green]")
        console.print(f"  - 汇总报告: {summary_path}")
        console.print(f"  - 问题报告: {issues_path}")
        console.print(f"  - 冲突报告: {conflicts_path}")
        return
    
    console.print(f"[green]报告已生成: {report_path}[/green]")
    
    with open(report_path, "r", encoding="utf-8") as f:
        console.print(f.read())


@main.command()
def check():
    """重新运行所有检查（问题和冲突检测）"""
    storage = ensure_project_exists()
    state = storage.load_state()
    
    console.print("[bold]重新运行所有检查...[/bold]\n")
    
    detector = ConflictDetector()
    
    all_conflicts = []
    for shoot_date_str, version_names in sorted(state.shoot_dates.items()):
        sorted_versions = sorted(version_names)
        prev_version = None
        
        for version_name in sorted_versions:
            version_key = f"{shoot_date_str}__{version_name}"
            if version_key not in state.versions:
                continue
            
            v = state.versions[version_key]
            
            conflicts = detector.detect(v, prev_version)
            v.conflicts = conflicts
            all_conflicts.extend(conflicts)
            
            console.print(f"版本 {version_key}: {len(conflicts)} 个冲突")
            
            prev_version = v
    
    state.all_conflicts = all_conflicts
    storage.save_state(state)
    
    console.print(f"\n[green]检查完成，共发现 {len(all_conflicts)} 个冲突[/green]")


if __name__ == "__main__":
    main()
