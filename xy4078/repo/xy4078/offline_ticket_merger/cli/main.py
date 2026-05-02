"""CLI入口"""

import os
import sys
from pathlib import Path
from typing import List, Optional

import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.tree import Tree

from .. import __version__
from ..inventory import check_overconsumption, validate_spare_parts
from ..merger import merge_tickets
from ..models import ConflictType, MergeStrategy, SparePart, WorkOrderStatus
from ..parser import ParserRegistry, parse_file
from ..reporter import export_report, generate_audit_report
from ..storage import get_repository, init_repository

console = Console()


def get_strategy_from_name(name: str) -> MergeStrategy:
    strategy_map = {
        "first": MergeStrategy.FIRST_WINS,
        "first_wins": MergeStrategy.FIRST_WINS,
        "last": MergeStrategy.LAST_WINS,
        "last_wins": MergeStrategy.LAST_WINS,
        "majority": MergeStrategy.MAJORITY_VOTE,
        "majority_vote": MergeStrategy.MAJORITY_VOTE,
        "timeline": MergeStrategy.TIMELINE_ORDER,
        "timeline_order": MergeStrategy.TIMELINE_ORDER,
        "manual": MergeStrategy.MANUAL,
    }
    return strategy_map.get(name.lower(), MergeStrategy.TIMELINE_ORDER)


@click.group()
@click.version_option(__version__, "-v", "--version", prog_name="otm")
def main():
    """离线工单合并器 - 合并外勤维修工程师的离线工单记录"""
    pass


@main.command()
@click.option("-n", "--name", help="仓库名称")
@click.option("-d", "--description", help="仓库描述")
@click.option("-p", "--path", help="仓库路径（默认为当前目录）", type=click.Path(exists=False, file_okay=False))
def init(name, description, path):
    """初始化本地仓库
    
    示例:
      otm init
      otm init -n "机房维修工单2024" -d "地下机房维修项目"
      otm init -p /path/to/repo
    """
    target_path = Path(path) if path else Path.cwd()
    
    try:
        repo = init_repository(target_path, name, description)
        console.print(f"✅ 仓库初始化成功: {repo.otm_path}")
        console.print(f"   仓库名称: {repo.config.repository_name}")
        if repo.config.description:
            console.print(f"   描述: {repo.config.description}")
        console.print("\n   可用命令:")
        console.print("     otm import  - 导入工单文件")
        console.print("     otm check   - 检查冲突和验证")
        console.print("     otm merge   - 合并工单")
        console.print("     otm audit   - 导出审计报告")
    except RuntimeError as e:
        console.print(f"❌ 错误: {e}")
        sys.exit(1)


@main.command()
@click.argument("files", nargs=-1, type=click.Path(exists=True, dir_okay=False))
@click.option("-r", "--recursive", is_flag=True, help="递归导入目录中的文件")
@click.option("-p", "--path", help="指定仓库路径", type=click.Path(exists=True, file_okay=False))
def import_(files, recursive, path):
    """导入工单文件 (JSON/CSV)
    
    示例:
      otm import engineer_1.json engineer_2.csv
      otm import tickets/
      otm import -r ./engineers/
    """
    repo_path = Path(path) if path else None
    repo = get_repository(repo_path)
    
    if not repo:
        console.print("❌ 错误: 未找到仓库，请先运行 'otm init'")
        sys.exit(1)
    
    files_to_import: List[Path] = []
    
    for file_path in files:
        path_obj = Path(file_path)
        if path_obj.is_file():
            files_to_import.append(path_obj)
        elif path_obj.is_dir() and recursive:
            for ext in ParserRegistry.get_supported_extensions():
                files_to_import.extend(path_obj.glob(f"**/*.{ext}"))
        elif path_obj.is_dir():
            for ext in ParserRegistry.get_supported_extensions():
                files_to_import.extend(path_obj.glob(f"*.{ext}"))
    
    if not files_to_import:
        console.print("⚠️ 未找到可导入的文件")
        console.print(f"   支持的格式: {', '.join(ParserRegistry.get_supported_extensions())}")
        sys.exit(0)
    
    console.print(f"📁 找到 {len(files_to_import)} 个文件待导入\n")
    
    imported_count = 0
    failed_count = 0
    
    for file_path in files_to_import:
        try:
            console.print(f"  导入: {file_path.name}...", end=" ")
            
            imported = parse_file(file_path)
            saved_path = repo.save_imported_ticket(imported)
            
            if imported.is_valid:
                console.print(f"[green]✓[/green] ({len(imported.work_orders)} 个工单)")
                imported_count += 1
            else:
                console.print(f"[yellow]⚠[/yellow] (有 {len(imported.validation_errors)} 个警告)")
                for err in imported.validation_errors[:3]:
                    console.print(f"      - {err}")
                if len(imported.validation_errors) > 3:
                    console.print(f"      - ... 还有 {len(imported.validation_errors) - 3} 个警告")
                imported_count += 1
                
        except Exception as e:
            console.print(f"[red]✗[/red]")
            console.print(f"      错误: {e}")
            failed_count += 1
    
    console.print(f"\n📊 导入完成: {imported_count} 成功, {failed_count} 失败")
    console.print(f"   已保存到: {repo.otm_path}/imports/")


@main.command()
@click.option("-p", "--path", help="指定仓库路径", type=click.Path(exists=True, file_okay=False))
@click.option("--inventory", is_flag=True, help="同时检查库存")
@click.option("-i", "--inventory-file", help="库存文件路径", type=click.Path(exists=True, dir_okay=False))
def check(path, inventory, inventory_file):
    """检查工单冲突和验证
    
    示例:
      otm check
      otm check --inventory
      otm check --inventory -i inventory.json
    """
    repo_path = Path(path) if path else None
    repo = get_repository(repo_path)
    
    if not repo:
        console.print("❌ 错误: 未找到仓库，请先运行 'otm init'")
        sys.exit(1)
    
    imported_tickets = repo.load_all_imported_tickets()
    
    if not imported_tickets:
        console.print("⚠️ 没有已导入的工单，请先运行 'otm import'")
        sys.exit(0)
    
    all_work_orders = []
    for ticket in imported_tickets:
        all_work_orders.extend(ticket.work_orders)
    
    console.print(f"🔍 检查 {len(imported_tickets)} 个工单包, 共 {len(all_work_orders)} 个工单\n")
    
    from ..merger import detect_conflicts
    conflicts = detect_conflicts(all_work_orders)
    
    if conflicts:
        table = Table(title="检测到的冲突")
        table.add_column("类型", style="cyan")
        table.add_column("工单", style="magenta")
        table.add_column("字段", style="yellow")
        table.add_column("严重程度", style="red")
        table.add_column("描述", style="white")
        
        for conflict in conflicts:
            severity_style = "red" if conflict.severity == "error" else "yellow"
            table.add_row(
                conflict.conflict_type.value,
                conflict.ticket_number,
                conflict.field_name or "-",
                f"[{severity_style}]{conflict.severity}[/{severity_style}]",
                conflict.description[:60] + "..." if len(conflict.description or "") > 60 else conflict.description or "-",
            )
        
        console.print(table)
        
        conflict_counts = {
            ConflictType.DUPLICATE_TICKET: 0,
            ConflictType.FIELD_CONFLICT: 0,
            ConflictType.TIMELINE_CONFLICT: 0,
            ConflictType.PHOTO_MISMATCH: 0,
            ConflictType.DEVICE_NOT_FOUND: 0,
        }
        
        for c in conflicts:
            if c.conflict_type in conflict_counts:
                conflict_counts[c.conflict_type] += 1
        
        console.print(f"\n📊 冲突统计:")
        console.print(f"   重复工单: {conflict_counts[ConflictType.DUPLICATE_TICKET]}")
        console.print(f"   字段冲突: {conflict_counts[ConflictType.FIELD_CONFLICT]}")
        console.print(f"   时间线冲突: {conflict_counts[ConflictType.TIMELINE_CONFLICT]}")
        console.print(f"   照片不匹配: {conflict_counts[ConflictType.PHOTO_MISMATCH]}")
        console.print(f"   设备不存在: {conflict_counts[ConflictType.DEVICE_NOT_FOUND]}")
    else:
        console.print("✅ 未检测到冲突")
    
    if inventory or inventory_file:
        console.print("\n📦 检查库存...")
        
        inventory_parts: List[SparePart] = []
        
        if inventory_file:
            inv_content = Path(inventory_file).read_text(encoding="utf-8")
            import json
            inv_data = json.loads(inv_content)
            
            if isinstance(inv_data, list):
                for item in inv_data:
                    inventory_parts.append(SparePart(**item))
            elif "inventory" in inv_data:
                for item in inv_data["inventory"]:
                    inventory_parts.append(SparePart(**item))
        else:
            inventory_parts = repo.load_inventory()
        
        if inventory_parts:
            check_results, inv_conflicts = check_overconsumption(all_work_orders, inventory_parts)
            
            if inv_conflicts:
                console.print(f"\n⚠️ 发现 {len(inv_conflicts)} 个库存问题:")
                for ic in check_results:
                    if ic.is_overconsumed:
                        console.print(f"   - 备件 {ic.part_number} ({ic.part_name}):")
                        console.print(f"     可用: {ic.available_quantity}, 已申请: {ic.total_consumed + ic.requested_quantity}")
                        console.print(f"     超领: {ic.overconsumption_amount}")
            else:
                console.print("✅ 库存检查通过")
        else:
            console.print("⚠️ 没有库存数据，跳过库存检查")


@main.command()
@click.option("-p", "--path", help="指定仓库路径", type=click.Path(exists=True, file_okay=False))
@click.option("-s", "--strategy", default="timeline", 
              help="合并策略: first, last, majority, timeline, manual (默认: timeline)")
@click.option("--inventory", is_flag=True, help="同时进行库存校验")
@click.option("-i", "--inventory-file", help="库存文件路径", type=click.Path(exists=True, dir_okay=False))
@click.option("--dry-run", is_flag=True, help="试运行，不保存结果")
def merge(path, strategy, inventory, inventory_file, dry_run):
    """按规则合并工单
    
    示例:
      otm merge
      otm merge -s last
      otm merge --inventory -i inventory.json
      otm merge --dry-run
    """
    repo_path = Path(path) if path else None
    repo = get_repository(repo_path)
    
    if not repo:
        console.print("❌ 错误: 未找到仓库，请先运行 'otm init'")
        sys.exit(1)
    
    imported_tickets = repo.load_all_imported_tickets()
    
    if not imported_tickets:
        console.print("⚠️ 没有已导入的工单，请先运行 'otm import'")
        sys.exit(0)
    
    merge_strategy = get_strategy_from_name(strategy)
    
    console.print(f"🔄 合并策略: {merge_strategy.value}")
    console.print(f"   处理 {len(imported_tickets)} 个工单包\n")
    
    inventory_parts: Optional[List[SparePart]] = None
    if inventory or inventory_file:
        if inventory_file:
            inv_content = Path(inventory_file).read_text(encoding="utf-8")
            import json
            inv_data = json.loads(inv_content)
            
            if isinstance(inv_data, list):
                inventory_parts = [SparePart(**item) for item in inv_data]
            elif "inventory" in inv_data:
                inventory_parts = [SparePart(**item) for item in inv_data["inventory"]]
        else:
            inventory_parts = repo.load_inventory()
        
        if not inventory_parts:
            console.print("⚠️ 没有库存数据，跳过库存校验")
    
    result = merge_tickets(imported_tickets, merge_strategy)
    
    if inventory_parts:
        from ..inventory import reconcile_inventory
        from ..models import InventoryCheckResult
        
        merged_wos = [s.work_order for s in result.merged_work_orders]
        reconciliation = reconcile_inventory(merged_wos, inventory_parts)
        
        inventory_checks: List[InventoryCheckResult] = []
        for part_number, rec in reconciliation.items():
            inventory_checks.append(InventoryCheckResult(
                part_number=part_number,
                part_name=rec.get("part_name", "Unknown"),
                available_quantity=rec.get("initial_quantity", 0),
                requested_quantity=rec.get("consumed_quantity", 0),
                total_consumed=rec.get("consumed_quantity", 0),
                is_overconsumed=rec.get("is_shortage", False),
                overconsumption_amount=rec.get("shortage_amount", 0),
                consuming_tickets=[c.get("ticket", "") for c in rec.get("consumed_by", [])],
                consuming_engineers=[c.get("engineer", "") for c in rec.get("consumed_by", [])],
            ))
        
        result.inventory_checks = inventory_checks
        result.inventory_issues_found = sum(1 for ic in inventory_checks if ic.is_overconsumed)
    
    table = Table(title="合并结果")
    table.add_column("指标", style="cyan")
    table.add_column("值", style="magenta")
    
    table.add_row("输入工单包数", str(result.total_input_tickets))
    table.add_row("总工单数", str(result.total_work_orders))
    table.add_row("唯一工单", str(result.unique_tickets))
    table.add_row("合并后工单", str(len(result.merged_work_orders)))
    table.add_row("发现重复工单", str(result.duplicate_tickets_found))
    table.add_row("字段冲突", str(result.field_conflicts_found))
    table.add_row("库存问题", str(result.inventory_issues_found))
    
    console.print(table)
    
    if result.merged_work_orders:
        console.print("\n📋 合并后的工单:")
        for snapshot in result.merged_work_orders:
            wo = snapshot.work_order
            status_str = wo.status.value if hasattr(wo.status, "value") else str(wo.status)
            console.print(f"   - {wo.ticket_number}: {wo.device_name or wo.device_id} ({status_str})")
            console.print(f"     工程师: {wo.engineer_name or '未指定'}")
            console.print(f"     照片: {len(wo.photos)}, 备件: {len(wo.spare_parts)}")
            if snapshot.resolved_conflicts:
                console.print(f"     已解决冲突: {len(snapshot.resolved_conflicts)}")
            if snapshot.unresolved_conflicts:
                console.print(f"     [yellow]未解决冲突: {len(snapshot.unresolved_conflicts)}[/yellow]")
    
    if dry_run:
        console.print("\n⚠️ 试运行模式，结果未保存")
    else:
        saved_path = repo.save_merge_result(result)
        console.print(f"\n💾 结果已保存: {saved_path}")


@main.command()
@click.option("-p", "--path", help="指定仓库路径", type=click.Path(exists=True, file_okay=False))
@click.option("-f", "--format", "fmt", default="markdown", 
              help="输出格式: markdown, csv, json (默认: markdown)")
@click.option("-o", "--output", help="输出文件路径", type=click.Path(exists=False))
@click.option("--inventory", is_flag=True, help="包含库存信息")
@click.option("-i", "--inventory-file", help="库存文件路径", type=click.Path(exists=True, dir_okay=False))
def audit(path, fmt, output, inventory, inventory_file):
    """导出审计报告
    
    示例:
      otm audit
      otm audit -f csv -o report.csv
      otm audit --inventory -i inventory.json
    """
    repo_path = Path(path) if path else None
    repo = get_repository(repo_path)
    
    if not repo:
        console.print("❌ 错误: 未找到仓库，请先运行 'otm init'")
        sys.exit(1)
    
    merge_result = repo.load_latest_merge_result()
    
    if not merge_result:
        console.print("⚠️ 没有合并结果，请先运行 'otm merge'")
        sys.exit(0)
    
    inventory_parts: Optional[List[SparePart]] = None
    if inventory or inventory_file:
        if inventory_file:
            inv_content = Path(inventory_file).read_text(encoding="utf-8")
            import json
            inv_data = json.loads(inv_content)
            
            if isinstance(inv_data, list):
                inventory_parts = [SparePart(**item) for item in inv_data]
            elif "inventory" in inv_data:
                inventory_parts = [SparePart(**item) for item in inv_data["inventory"]]
        else:
            inventory_parts = repo.load_inventory()
    
    report = generate_audit_report(
        merge_result=merge_result,
        repository_path=str(repo.path),
        inventory_parts=inventory_parts,
    )
    
    if output:
        output_path = Path(output)
    else:
        timestamp = report.generated_at.strftime("%Y%m%d_%H%M%S") if report.generated_at else "report"
        ext = fmt.lower()
        if ext == "markdown":
            ext = "md"
        output_path = repo.path / f"audit_{timestamp}.{ext}"
    
    try:
        content = export_report(report, format=fmt, output_path=output_path)
        
        console.print(f"✅ 审计报告已生成: {output_path}")
        console.print(f"   格式: {fmt}")
        
        summary = report.summary
        console.print(f"\n📊 报告摘要:")
        console.print(f"   输入工单包: {summary.get('execution', {}).get('total_input_tickets', 0)}")
        console.print(f"   总工单: {summary.get('execution', {}).get('total_work_orders', 0)}")
        console.print(f"   冲突数: {summary.get('conflicts', {}).get('total', 0)}")
        console.print(f"   已解决: {summary.get('conflicts', {}).get('resolved', 0)}")
        console.print(f"   库存问题: {summary.get('inventory', {}).get('overconsumed_parts', 0)}")
        
    except Exception as e:
        console.print(f"❌ 生成报告失败: {e}")
        sys.exit(1)


@main.command()
@click.option("-p", "--path", help="指定仓库路径", type=click.Path(exists=True, file_okay=False))
def status(path):
    """显示仓库状态
    
    示例:
      otm status
    """
    repo_path = Path(path) if path else None
    repo = get_repository(repo_path)
    
    if not repo:
        console.print("❌ 错误: 未找到仓库，请先运行 'otm init'")
        sys.exit(1)
    
    console.print(Panel.fit(
        f"[bold cyan]{repo.config.repository_name}[/bold cyan]",
        subtitle=f"版本: {repo.config.version} | 创建时间: {repo.config.created_at.strftime('%Y-%m-%d')}",
    ))
    
    if repo.config.description:
        console.print(f"描述: {repo.config.description}")
    
    console.print(f"\n📁 仓库路径: {repo.path}")
    
    imported_count = len(repo.list_imported_tickets())
    merged_count = len(repo.list_merge_results())
    audit_count = len(repo.list_audit_reports())
    
    table = Table(title="数据统计")
    table.add_column("项目", style="cyan")
    table.add_column("数量", style="magenta")
    
    table.add_row("已导入工单包", str(imported_count))
    table.add_row("合并结果", str(merged_count))
    table.add_row("审计报告", str(audit_count))
    
    console.print(table)
    
    inventory = repo.load_inventory()
    if inventory:
        console.print(f"\n📦 库存备件: {len(inventory)} 种")
        if len(inventory) > 0:
            inv_table = Table(show_header=True, header_style="bold magenta")
            inv_table.add_column("备件编号")
            inv_table.add_column("名称")
            inv_table.add_column("数量")
            
            for item in inventory[:10]:
                inv_table.add_row(item.part_number, item.part_name, str(item.quantity))
            
            if len(inventory) > 10:
                inv_table.add_row("...", f"... 还有 {len(inventory) - 10} 种", "")
            
            console.print(inv_table)


if __name__ == "__main__":
    main()
