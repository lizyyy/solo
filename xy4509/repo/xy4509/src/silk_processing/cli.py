import click
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich import print as rprint
from datetime import datetime
from typing import Optional, List
from pathlib import Path

from .models import (
    CocoonBatch,
    MoistureInspection,
    CookingCurve,
    BreakageRecord,
    DeliveryRecord,
    ProcessCalculation,
    BatchProcessData,
    CocoonGrade,
    DeliveryGrade,
    BreakageSeverity,
)
from .calculator import calculate_process_params, merge_batches
from .io import DataImporter, DataExporter, MarkdownExporter
from .database import DatabaseManager, get_default_db

console = Console()


@click.group()
@click.version_option(version="1.0.0")
def cli():
    """
    缫丝工艺计算工具 - 为小厂工艺员设计的本地科学计算工具
    
    功能包括：
    - 蚕茧批次管理
    - 含水率抽检记录
    - 煮茧温度曲线管理
    - 缫丝断头记录
    - 交货等级记录
    - 工艺参数计算
    - 数据导入导出
    """
    pass


@cli.group()
def batch():
    """蚕茧批次管理"""
    pass


@batch.command("list")
@click.option("--source", "-s", help="按来源筛选")
@click.option("--grade", "-g", type=click.Choice([g.value for g in CocoonGrade]), help="按等级筛选")
def list_batches(source: str, grade: str):
    """列出所有蚕茧批次"""
    db = get_default_db()
    
    if source or grade:
        grade_enum = CocoonGrade(grade) if grade else None
        batches = db.search_batches(source=source, grade=grade_enum)
    else:
        batches = db.get_all_batches()
    
    if not batches:
        console.print("[yellow]没有找到批次数据[/yellow]")
        return
    
    table = Table(title="蚕茧批次列表")
    table.add_column("批次编号", style="cyan")
    table.add_column("来源产地", style="green")
    table.add_column("收购日期", style="magenta")
    table.add_column("总重量(kg)", style="yellow", justify="right")
    table.add_column("等级", style="blue")
    table.add_column("供应商", style="white")
    
    for batch in batches:
        table.add_row(
            batch.batch_id,
            batch.source,
            batch.purchase_date.strftime("%Y-%m-%d"),
            f"{batch.total_weight_kg:.2f}",
            batch.grade.value,
            batch.supplier or "-",
        )
    
    console.print(table)


@batch.command("add")
@click.option("--batch-id", "-i", required=True, help="批次编号")
@click.option("--source", "-s", required=True, help="来源产地")
@click.option("--purchase-date", "-d", required=True, help="收购日期 (YYYY-MM-DD)")
@click.option("--weight", "-w", required=True, type=float, help="总重量(kg)")
@click.option("--grade", "-g", required=True, type=click.Choice([g.value for g in CocoonGrade]), help="蚕茧等级")
@click.option("--supplier", help="供应商")
@click.option("--notes", help="备注")
def add_batch(
    batch_id: str, source: str, purchase_date: str, weight: float, 
    grade: str, supplier: str, notes: str
):
    """添加新的蚕茧批次"""
    db = get_default_db()
    
    try:
        purchase_dt = datetime.strptime(purchase_date, "%Y-%m-%d")
    except ValueError:
        console.print(f"[red]日期格式错误: {purchase_date}，请使用 YYYY-MM-DD 格式[/red]")
        return
    
    try:
        batch = CocoonBatch(
            batch_id=batch_id,
            source=source,
            purchase_date=purchase_dt,
            total_weight_kg=weight,
            grade=CocoonGrade(grade),
            supplier=supplier,
            notes=notes,
        )
        db.add_batch(batch)
        console.print(f"[green]成功添加批次: {batch_id}[/green]")
    except ValueError as e:
        console.print(f"[red]添加失败: {e}[/red]")


@batch.command("delete")
@click.option("--batch-id", "-i", required=True, help="要删除的批次编号")
@click.confirmation_option(prompt="确定要删除这个批次吗？这将删除所有关联数据")
def delete_batch(batch_id: str):
    """删除蚕茧批次及其关联数据"""
    db = get_default_db()
    
    if db.delete_batch(batch_id):
        console.print(f"[green]成功删除批次: {batch_id}[/green]")
    else:
        console.print(f"[red]未找到批次: {batch_id}[/red]")


@batch.command("merge")
@click.option("--batch-ids", "-i", required=True, multiple=True, help="要合并的批次编号（可多次指定）")
@click.option("--target-moisture", "-m", type=float, help="目标含水率(%)")
def merge_batches_cmd(batch_ids: List[str], target_moisture: float):
    """合并多个蚕茧批次并计算工艺参数"""
    db = get_default_db()
    
    batches = []
    all_moisture = []
    
    for batch_id in batch_ids:
        batch_data = db.get_batch_process_data(batch_id)
        if not batch_data:
            console.print(f"[red]未找到批次: {batch_id}[/red]")
            return
        batches.append(batch_data.batch)
        all_moisture.extend(batch_data.moisture_inspections)
    
    merged_batch, avg_moisture = merge_batches(batches, all_moisture)
    
    console.print(Panel.fit(
        f"[bold cyan]合并批次信息[/bold cyan]\n\n"
        f"合并批次编号: {merged_batch.batch_id}\n"
        f"来源产地: {merged_batch.source}\n"
        f"总重量: {merged_batch.total_weight_kg:.2f} kg\n"
        f"等级: {merged_batch.grade.value}\n"
        f"平均含水率: {avg_moisture:.2f}%\n"
        f"备注: {merged_batch.notes or '无'}",
        title="合并结果"
    ))
    
    merged_data = BatchProcessData(batch=merged_batch)
    for batch_data in [db.get_batch_process_data(bid) for bid in batch_ids]:
        if batch_data:
            merged_data.moisture_inspections.extend(batch_data.moisture_inspections)
            merged_data.cooking_curves.extend(batch_data.cooking_curves)
            merged_data.breakage_records.extend(batch_data.breakage_records)
            merged_data.delivery_records.extend(batch_data.delivery_records)
    
    calculation = calculate_process_params(merged_data, target_moisture)
    display_calculation_result(calculation)


@cli.group()
def data():
    """数据导入导出"""
    pass


@data.command("import")
@click.option("--file", "-f", "file_path", required=True, help="导入文件路径 (.csv 或 .json)")
@click.option("--type", "-t", "data_type", 
              type=click.Choice(['batch', 'moisture', 'cooking', 'breakage', 'delivery', 'auto']),
              default='auto', help="数据类型")
def import_data(file_path: str, data_type: str):
    """从CSV或JSON导入数据"""
    db = get_default_db()
    path = Path(file_path)
    
    if not path.exists():
        console.print(f"[red]文件不存在: {file_path}[/red]")
        return
    
    try:
        if path.suffix.lower() == '.json':
            imported = DataImporter.import_from_json(file_path)
            
            if 'batches' in imported:
                for batch in imported['batches']:
                    try:
                        db.add_batch(batch)
                    except ValueError:
                        console.print(f"[yellow]批次已存在，跳过: {batch.batch_id}[/yellow]")
            
            if 'moisture_inspections' in imported:
                for insp in imported['moisture_inspections']:
                    try:
                        db.add_moisture_inspection(insp)
                    except ValueError:
                        console.print(f"[yellow]抽检记录已存在，跳过: {insp.inspection_id}[/yellow]")
            
            console.print(f"[green]成功从JSON导入数据[/green]")
        
        else:
            if data_type == 'auto' or data_type == 'batch':
                try:
                    batches = DataImporter.import_cocoon_batches_from_csv(file_path)
                    for batch in batches:
                        try:
                            db.add_batch(batch)
                        except ValueError:
                            pass
                    console.print(f"[green]导入了 {len(batches)} 个批次[/green]")
                except Exception:
                    pass
            
            if data_type == 'moisture':
                try:
                    inspections = DataImporter.import_moisture_inspections_from_csv(file_path)
                    for insp in inspections:
                        try:
                            db.add_moisture_inspection(insp)
                        except ValueError:
                            pass
                    console.print(f"[green]导入了 {len(inspections)} 条含水率记录[/green]")
                except Exception:
                    pass
    
    except Exception as e:
        console.print(f"[red]导入失败: {e}[/red]")


@data.command("export")
@click.option("--output", "-o", "output_path", required=True, help="输出文件路径")
@click.option("--format", "-f", "fmt", type=click.Choice(['json', 'csv', 'md']), default='json', help="输出格式")
@click.option("--batch-id", "-i", help="指定批次编号导出")
def export_data(output_path: str, fmt: str, batch_id: str):
    """导出数据到文件"""
    db = get_default_db()
    
    try:
        if fmt == 'md':
            if not batch_id:
                console.print("[red]导出Markdown工艺单需要指定批次编号[/red]")
                return
            
            batch_data = db.get_batch_process_data(batch_id)
            if not batch_data:
                console.print(f"[red]未找到批次: {batch_id}[/red]")
                return
            
            if not batch_data.calculations:
                calculation = calculate_process_params(batch_data)
            else:
                calculation = batch_data.calculations[-1]
            
            MarkdownExporter.generate_process_sheet(batch_data, calculation, output_path)
            console.print(f"[green]工艺单已导出到: {output_path}[/green]")
        
        elif fmt == 'json':
            export_data_dict = {}
            
            if batch_id:
                batch_data = db.get_batch_process_data(batch_id)
                if batch_data:
                    export_data_dict['batches'] = [batch_data.batch]
                    export_data_dict['moisture_inspections'] = batch_data.moisture_inspections
                    export_data_dict['cooking_curves'] = batch_data.cooking_curves
                    export_data_dict['breakage_records'] = batch_data.breakage_records
                    export_data_dict['delivery_records'] = batch_data.delivery_records
                    export_data_dict['calculations'] = batch_data.calculations
            else:
                export_data_dict['batches'] = db.get_all_batches()
            
            DataExporter.export_to_json(export_data_dict, output_path)
            console.print(f"[green]数据已导出到: {output_path}[/green]")
    
    except Exception as e:
        console.print(f"[red]导出失败: {e}[/red]")


@cli.command("calculate")
@click.option("--batch-id", "-i", required=True, help="批次编号")
@click.option("--target-moisture", "-m", type=float, help="目标含水率(%)，不指定则使用等级最优值")
@click.option("--save", "-s", is_flag=True, help="保存计算结果到数据库")
@click.option("--export-md", "-e", help="导出Markdown工艺单的文件路径")
def calculate(batch_id: str, target_moisture: float, save: bool, export_md: str):
    """计算工艺参数"""
    db = get_default_db()
    
    batch_data = db.get_batch_process_data(batch_id)
    if not batch_data:
        console.print(f"[red]未找到批次: {batch_id}[/red]")
        return
    
    calculation = calculate_process_params(batch_data, target_moisture)
    
    display_calculation_result(calculation)
    
    if save:
        try:
            db.add_calculation(calculation)
            console.print(f"[green]计算结果已保存: {calculation.calculation_id}[/green]")
        except ValueError as e:
            console.print(f"[yellow]保存提示: {e}[/yellow]")
    
    if export_md:
        MarkdownExporter.generate_process_sheet(batch_data, calculation, export_md)
        console.print(f"[green]工艺单已导出到: {export_md}[/green]")


@cli.command("review")
@click.option("--calculation-id", "-i", required=True, help="计算结果编号")
@click.option("--notes", "-n", required=True, help="复核备注")
@click.option("--reviewer", "-r", required=True, help="复核人")
def review_calculation(calculation_id: str, notes: str, reviewer: str):
    """保存人工复核备注"""
    db = get_default_db()
    
    if db.update_calculation_review(calculation_id, notes, reviewer):
        console.print(f"[green]复核信息已保存[/green]")
    else:
        console.print(f"[red]未找到计算结果: {calculation_id}[/red]")


@cli.command("stats")
def show_stats():
    """显示数据库统计信息"""
    db = get_default_db()
    stats = db.get_statistics()
    
    table = Table(title="数据统计")
    table.add_column("项目", style="cyan")
    table.add_column("数值", style="yellow", justify="right")
    
    table.add_row("蚕茧批次数量", str(stats['batch_count']))
    table.add_row("总重量(kg)", f"{stats['total_weight_kg']:.2f}")
    table.add_row("含水率抽检记录", str(stats['moisture_inspection_count']))
    table.add_row("煮茧温度曲线", str(stats['cooking_curve_count']))
    table.add_row("断头记录", str(stats['breakage_record_count']))
    table.add_row("交货记录", str(stats['delivery_record_count']))
    table.add_row("工艺计算结果", str(stats['calculation_count']))
    
    console.print(table)


@cli.command("search")
@click.option("--batch-id", "-i", help="批次编号（支持模糊匹配）")
@click.option("--source", "-s", help="来源产地（支持模糊匹配）")
@click.option("--grade", "-g", type=click.Choice([g.value for g in CocoonGrade]), help="等级")
@click.option("--start-date", help="开始日期 (YYYY-MM-DD)")
@click.option("--end-date", help="结束日期 (YYYY-MM-DD)")
def search_batches(batch_id: str, source: str, grade: str, start_date: str, end_date: str):
    """搜索蚕茧批次"""
    db = get_default_db()
    
    grade_enum = CocoonGrade(grade) if grade else None
    
    start_dt = None
    if start_date:
        try:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        except ValueError:
            console.print(f"[red]日期格式错误: {start_date}[/red]")
            return
    
    end_dt = None
    if end_date:
        try:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        except ValueError:
            console.print(f"[red]日期格式错误: {end_date}[/red]")
            return
    
    batches = db.search_batches(
        batch_id=batch_id,
        source=source,
        grade=grade_enum,
        start_date=start_dt,
        end_date=end_dt,
    )
    
    if not batches:
        console.print("[yellow]没有找到匹配的批次[/yellow]")
        return
    
    table = Table(title="搜索结果")
    table.add_column("批次编号", style="cyan")
    table.add_column("来源产地", style="green")
    table.add_column("收购日期", style="magenta")
    table.add_column("总重量(kg)", style="yellow", justify="right")
    table.add_column("等级", style="blue")
    
    for batch in batches:
        table.add_row(
            batch.batch_id,
            batch.source,
            batch.purchase_date.strftime("%Y-%m-%d"),
            f"{batch.total_weight_kg:.2f}",
            batch.grade.value,
        )
    
    console.print(table)


def display_calculation_result(calculation: ProcessCalculation):
    """显示计算结果"""
    console.print("\n" + "=" * 60)
    console.print(f"[bold cyan]工艺计算结果[/bold cyan] - {calculation.calculation_id}")
    console.print("=" * 60)
    
    console.print("\n[bold green]一、补水计算[/bold green]")
    table1 = Table(show_header=False)
    table1.add_row("当前含水率", f"[yellow]{calculation.current_moisture:.2f}%[/yellow]")
    table1.add_row("目标含水率", f"[yellow]{calculation.target_moisture:.2f}%[/yellow]")
    table1.add_row("需补水量", f"[bold red]{calculation.water_supplement_kg:.2f} kg[/bold red]")
    console.print(table1)
    
    console.print("\n[bold green]二、煮茧参数建议[/bold green]")
    table2 = Table(show_header=False)
    table2.add_row("建议煮茧温度", f"[bold red]{calculation.recommended_cooking_temp:.1f} ℃[/bold red]")
    table2.add_row("建议煮茧时间", f"[bold red]{calculation.recommended_cooking_time_min:.1f} 分钟[/bold red]")
    if calculation.soaking_time_min:
        table2.add_row("建议浸泡时间", f"[yellow]{calculation.soaking_time_min:.1f} 分钟[/yellow]")
    if calculation.steam_pressure:
        table2.add_row("建议蒸汽压力", f"[yellow]{calculation.steam_pressure:.3f} MPa[/yellow]")
    console.print(table2)
    
    console.print("\n[bold green]三、出丝率预估[/bold green]")
    table3 = Table(show_header=False)
    table3.add_row("预估出丝率", f"[bold red]{calculation.estimated_filature_rate:.2f}%[/bold red]")
    table3.add_row("预估产丝量", f"[bold red]{calculation.estimated_silk_output_kg:.2f} kg[/bold red]")
    console.print(table3)
    
    console.print("\n[bold green]四、断头风险评估[/bold green]")
    risk_color = "green" if calculation.breakage_risk_level == "低" else "yellow" if calculation.breakage_risk_level == "中" else "red"
    table4 = Table(show_header=False)
    table4.add_row("风险等级", f"[bold {risk_color}]{calculation.breakage_risk_level}[/bold {risk_color}]")
    table4.add_row("预估每小时断头数", f"[yellow]{calculation.estimated_breakage_per_hour:.2f} 次[/yellow]")
    console.print(table4)
    
    if calculation.risk_factors:
        console.print("\n[yellow]风险因素:[/yellow]")
        for factor in calculation.risk_factors:
            console.print(f"  ⚠️ {factor}")
    
    if calculation.anomalies:
        console.print("\n[red]异常数据提示:[/red]")
        for anomaly in calculation.anomalies:
            severity = "🔴" if anomaly.get('severity') == 'high' else "🟡"
            console.print(f"  {severity} [{anomaly.get('type')}] {anomaly.get('message')}")
    
    if calculation.warnings:
        console.print("\n[yellow]警告信息:[/yellow]")
        for warning in calculation.warnings:
            console.print(f"  ⚠️ {warning}")
    
    if calculation.reviewer_notes:
        console.print("\n[blue]复核信息:[/blue]")
        console.print(f"  复核人: {calculation.reviewed_by or '-'}")
        console.print(f"  复核时间: {calculation.reviewed_at.strftime('%Y-%m-%d %H:%M:%S') if calculation.reviewed_at else '-'}")
        console.print(f"  复核备注: {calculation.reviewer_notes}")


def main():
    """CLI入口"""
    cli()


if __name__ == "__main__":
    main()
