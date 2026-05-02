"""配镜加工单守门员 - CLI入口"""

from pathlib import Path
from typing import Optional

import click
from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.tree import Tree

from .__version__ import __version__
from .models.config import ValidationRules
from .parsers.csv_parser import (
    parse_frames_csv,
    parse_lenses_csv,
    parse_prescriptions_csv,
)
from .reports.exporter import ExportFormat, ReportExporter
from .services.data_store import DataStore, StoreManager
from .services.planning_service import PlanningService
from .services.validation_service import BatchValidationResult, ValidationService

console = Console()


def get_work_dir(ctx: click.Context) -> Path:
    """获取工作目录"""
    work_dir = ctx.obj.get("work_dir")
    if work_dir:
        return Path(work_dir)
    return Path.cwd()


def get_store(ctx: click.Context) -> DataStore:
    """获取数据存储"""
    work_dir = get_work_dir(ctx)
    manager = StoreManager(work_dir)
    return manager.get_store(work_dir)


def ensure_initialized(ctx: click.Context) -> DataStore:
    """确保已初始化"""
    store = get_store(ctx)
    if not store.store_config:
        console.print("[red]错误: 门店未初始化，请先运行 init 命令[/red]")
        ctx.exit(1)
    return store


@click.group()
@click.version_option(__version__, "-v", "--version", prog_name="opto-guardian")
@click.option(
    "-w",
    "--work-dir",
    type=click.Path(file_okay=False, dir_okay=True),
    help="工作目录（默认为当前目录）",
)
@click.pass_context
def main(ctx: click.Context, work_dir: Optional[str]):
    """配镜加工单守门员 - 眼镜店处方复核工具
    
    用于校验验光处方、检测录入错误、匹配库存、生成加工计划。
    """
    ctx.ensure_object(dict)
    ctx.obj["work_dir"] = work_dir


@main.command()
@click.option("--store-id", required=True, help="门店唯一标识")
@click.option("--store-name", required=True, help="门店名称")
@click.option("--min-sphere", type=float, default=-20.0, help="最小球镜度数(D)")
@click.option("--max-sphere", type=float, default=6.0, help="最大球镜度数(D)")
@click.option("--min-cylinder", type=float, default=-6.0, help="最小柱镜度数(D)")
@click.option("--max-cylinder", type=float, default=4.0, help="最大柱镜度数(D)")
@click.option("--min-pd", type=float, default=50.0, help="最小瞳距(mm)")
@click.option("--max-pd", type=float, default=75.0, help="最大瞳距(mm)")
@click.pass_context
def init(ctx: click.Context, **kwargs):
    """初始化门店配置
    
    创建门店规则配置文件，包括度数范围、瞳距范围等校验规则。
    """
    work_dir = get_work_dir(ctx)
    manager = StoreManager(work_dir)
    
    if manager.is_initialized(work_dir):
        click.confirm("门店已初始化，是否覆盖？", abort=True)
    
    rules = ValidationRules(
        min_sphere=kwargs["min_sphere"],
        max_sphere=kwargs["max_sphere"],
        min_cylinder=kwargs["min_cylinder"],
        max_cylinder=kwargs["max_cylinder"],
        min_pd=kwargs["min_pd"],
        max_pd=kwargs["max_pd"],
    )
    
    config = manager.initialize(
        store_id=kwargs["store_id"],
        store_name=kwargs["store_name"],
        work_dir=work_dir,
        rules=rules,
    )
    
    console.print(
        Panel.fit(
            f"[green]门店初始化成功![/green]\n\n"
            f"门店ID: {config.store_id}\n"
            f"门店名称: {config.store_name}\n"
            f"工作目录: {work_dir}\n"
            f"球镜范围: {rules.min_sphere}D ~ {rules.max_sphere}D\n"
            f"柱镜范围: {rules.min_cylinder}D ~ {rules.max_cylinder}D\n"
            f"瞳距范围: {rules.min_pd}mm ~ {rules.max_pd}mm",
            title="配镜加工单守门员",
        )
    )


@main.group()
@click.pass_context
def import_data(ctx: click.Context):
    """导入数据（处方、镜架、库存）"""
    pass


@import_data.command("prescriptions")
@click.argument("csv_file", type=click.Path(exists=True, dir_okay=False))
@click.pass_context
def import_prescriptions(ctx: click.Context, csv_file: str):
    """导入处方CSV文件
    
    CSV格式要求:
    - order_no: 订单号（必填）
    - re_sphere/le_sphere: 右/左眼球镜（必填）
    - re_cylinder/le_cylinder: 右/左眼柱镜（可选）
    - re_axis/le_axis: 右/左眼轴位（有散光时必填）
    - pd_total/pd_right/pd_left: 瞳距（可选）
    """
    store = ensure_initialized(ctx)
    
    try:
        csv_path = Path(csv_file)
        prescriptions = parse_prescriptions_csv(csv_path)
        
        imported = store.import_prescriptions(prescriptions)
        
        console.print(
            f"[green]成功导入 {imported} 条处方[/green]"
            + (f"（跳过 {len(prescriptions) - imported} 条已存在）" if imported < len(prescriptions) else "")
        )
    except Exception as e:
        console.print(f"[red]导入失败: {e}[/red]")
        ctx.exit(1)


@import_data.command("frames")
@click.argument("csv_file", type=click.Path(exists=True, dir_okay=False))
@click.pass_context
def import_frames(ctx: click.Context, csv_file: str):
    """导入镜架CSV文件
    
    CSV格式要求:
    - frame_id: 镜架ID（必填）
    - model: 型号（必填）
    - eye_size: 镜框宽度(mm)（必填）
    - bridge_size: 鼻梁宽度(mm)（必填）
    """
    store = ensure_initialized(ctx)
    
    try:
        csv_path = Path(csv_file)
        frames = parse_frames_csv(csv_path)
        
        imported = store.import_frames(frames)
        
        console.print(
            f"[green]成功导入 {imported} 个镜架[/green]"
            + (f"（跳过 {len(frames) - imported} 个已存在）" if imported < len(frames) else "")
        )
    except Exception as e:
        console.print(f"[red]导入失败: {e}[/red]")
        ctx.exit(1)


@import_data.command("inventory")
@click.argument("csv_file", type=click.Path(exists=True, dir_okay=False))
@click.pass_context
def import_inventory(ctx: click.Context, csv_file: str):
    """导入镜片库存CSV文件
    
    CSV格式要求:
    - stock_id: 库存ID（必填）
    - lens_type: 类型（单光/双光/渐进/防蓝光/变色/偏光）
    - material: 材质（CR39/PC/1.56/1.61/1.67/1.74/玻璃）
    - min_sphere/max_sphere: 球镜范围
    - min_cylinder/max_cylinder: 柱镜范围
    - quantity: 库存数量
    """
    store = ensure_initialized(ctx)
    
    try:
        csv_path = Path(csv_file)
        inventory = parse_lenses_csv(csv_path)
        
        imported = store.import_inventory(inventory)
        
        summary = inventory.get_summary()
        console.print(
            f"[green]成功导入 {imported} 种镜片[/green]\n"
            f"总库存数量: {summary['total_quantity']} 片\n"
            f"按类型: {summary['by_type']}"
        )
    except Exception as e:
        console.print(f"[red]导入失败: {e}[/red]")
        ctx.exit(1)


@main.command()
@click.option("--order-id", help="指定订单号校验（不指定则校验所有）")
@click.option("--frame-id", help="指定镜架ID")
@click.pass_context
def check(ctx: click.Context, order_id: Optional[str], frame_id: Optional[str]):
    """校验处方
    
    校验内容:
    - 度数范围
    - 散光轴位
    - 瞳距/瞳高
    - 瞳距与镜框匹配
    - 库存可用性
    - 重复订单检测
    """
    store = ensure_initialized(ctx)
    
    if not store.prescriptions:
        console.print("[yellow]没有处方数据，请先导入处方[/yellow]")
        ctx.exit(0)
    
    config = store.store_config
    assert config is not None
    
    validation_service = ValidationService(config)
    validation_service.set_existing_orders(store.orders)
    
    inventory = store.inventory if store.inventory.items else None
    frame = store.get_frame(frame_id) if frame_id else None
    
    if order_id:
        prescription = store.get_prescription(order_id)
        if not prescription:
            console.print(f"[red]未找到订单: {order_id}[/red]")
            ctx.exit(1)
        
        result = validation_service.validate_prescription(
            prescription=prescription,
            frame=frame,
            inventory=inventory,
        )
        
        _display_validation_result(result)
    else:
        frames_dict = {f.frame_id: f for f in store.frames} if store.frames else None
        
        batch_result = validation_service.validate_batch(
            prescriptions=store.prescriptions,
            frames=frames_dict,
            inventory=inventory,
        )
        
        _display_batch_result(batch_result)


def _display_validation_result(result):
    """显示单个校验结果"""
    status = "[green]✅ 通过[/green]" if result.passed else "[red]❌ 未通过[/red]"
    
    console.print(
        Panel(
            f"订单: {result.order_id}\n"
            f"状态: {status}\n"
            f"错误: {result.error_count} | 警告: {result.warning_count} | 信息: {result.info_count}",
            title="校验结果",
        )
    )
    
    if result.issues:
        table = Table(title="问题详情")
        table.add_column("级别", style="cyan")
        table.add_column("类别", style="magenta")
        table.add_column("描述", style="white")
        table.add_column("建议", style="green")
        
        for issue in result.issues:
            severity_style = {
                "严重错误": "bold red",
                "错误": "red",
                "警告": "yellow",
                "信息": "cyan",
            }.get(issue.severity.value, "white")
            
            table.add_row(
                f"[{severity_style}]{issue.severity.value}[/{severity_style}]",
                issue.category.value,
                issue.message,
                issue.suggested_fix or "-",
            )
        
        console.print(table)


def _display_batch_result(batch_result: BatchValidationResult):
    """显示批量校验结果"""
    summary = batch_result.get_summary()
    
    console.print(
        Panel(
            f"批次ID: {summary['batch_id']}\n"
            f"总订单数: {summary['total_orders']}\n"
            f"通过: [green]{summary['passed_count']}[/green] | "
            f"未通过: [red]{summary['failed_count']}[/red]\n"
            f"总错误: {summary['total_errors']} | 总警告: {summary['total_warnings']}",
            title="批量校验结果",
        )
    )
    
    if batch_result.failed_count > 0:
        console.print("\n[bold red]❌ 未通过订单:[/bold red]")
        for result in batch_result.get_failed_orders():
            status = "❌"
            console.print(
                f"  {status} 订单 {result.order_id}: "
                f"{result.error_count} 错误, {result.warning_count} 警告"
            )
    else:
        console.print("\n[bold green]✅ 所有订单校验通过![/bold green]")


@main.command()
@click.option("--order-id", required=True, help="订单号")
@click.option("--frame-id", help="镜架ID")
@click.option("--lens-type", help="首选镜片类型")
@click.pass_context
def plan(ctx: click.Context, order_id: str, frame_id: Optional[str], lens_type: Optional[str]):
    """生成加工计划
    
    根据处方、镜架和库存生成详细的加工建议。
    """
    store = ensure_initialized(ctx)
    
    prescription = store.get_prescription(order_id)
    if not prescription:
        console.print(f"[red]未找到订单: {order_id}[/red]")
        ctx.exit(1)
    
    config = store.store_config
    assert config is not None
    
    frame = store.get_frame(frame_id) if frame_id else None
    
    inventory = store.inventory if store.inventory.items else None
    
    planning_service = PlanningService(config)
    
    plan_result = planning_service.generate_plan(
        prescription=prescription,
        frame=frame,
        inventory=inventory,
    )
    
    _display_processing_plan(plan_result)


def _display_processing_plan(plan):
    """显示加工计划"""
    console.print(
        Panel(
            f"计划ID: {plan.plan_id}\n"
            f"处方ID: {plan.prescription_id}\n"
            f"生成时间: {plan.created_at.strftime('%Y-%m-%d %H:%M:%S')}",
            title="加工计划",
        )
    )
    
    for eye_key, eye_name in [("right_eye", "右眼"), ("left_eye", "左眼")]:
        eye_data = getattr(plan, eye_key, {})
        if not eye_data:
            continue
        
        sphere = eye_data.get("sphere", 0)
        cylinder = eye_data.get("cylinder", 0)
        axis = eye_data.get("axis")
        add = eye_data.get("add")
        
        power_str = f"球镜 {sphere:+}D"
        if abs(cylinder) > 0.001:
            power_str += f" 柱镜 {cylinder:+}D"
            if axis is not None:
                power_str += f" 轴位 {axis}°"
        if add:
            power_str += f" 下加光 +{add}D"
        
        console.print(f"\n[bold]👁️ {eye_name}[/bold]")
        console.print(f"  度数: {power_str}")
        
        recommended = eye_data.get("recommended_lens")
        if recommended:
            console.print(f"  [green]推荐镜片:[/green]")
            console.print(f"    类型: {recommended.get('lens_type')}")
            console.print(f"    材质: {recommended.get('material')}")
            if recommended.get('brand'):
                console.print(f"    品牌: {recommended.get('brand')}")
            console.print(f"    库存: {recommended.get('quantity_available')} 片")
            if recommended.get('unit_price'):
                console.print(f"    单价: ¥{recommended.get('unit_price')}")
    
    if plan.pd_adjustment:
        pd_adj = plan.pd_adjustment
        console.print(f"\n[bold]📏 瞳距调整[/bold]")
        console.print(f"  镜框几何中心距(BC): {pd_adj.get('box_center_distance')}mm")
        console.print(f"  右眼移心量: {pd_adj.get('right_deviation'):.1f}mm")
        console.print(f"  左眼移心量: {pd_adj.get('left_deviation'):.1f}mm")
        
        notes = pd_adj.get('notes', [])
        for note in notes:
            console.print(f"  - {note}")
    
    if plan.estimated_lens_diameter:
        diam = plan.estimated_lens_diameter
        console.print(f"\n[bold]🔍 镜片直径估算[/bold]")
        console.print(f"  右眼所需: {diam.get('right_eye'):.1f}mm")
        console.print(f"  左眼所需: {diam.get('left_eye'):.1f}mm")
    
    if plan.warnings:
        console.print(f"\n[bold yellow]⚠️ 警告[/bold yellow]")
        for warning in plan.warnings:
            console.print(f"  - {warning}")
    
    if plan.suggestions:
        console.print(f"\n[bold green]💡 建议[/bold green]")
        for suggestion in plan.suggestions:
            console.print(f"  - {suggestion}")
    
    if plan.total_estimated_cost:
        console.print(f"\n[bold]💰 费用估算[/bold]")
        console.print(f"  预估总成本: ¥{plan.total_estimated_cost:.0f}")


@main.command()
@click.option("--order-id", help="指定订单号（不指定则导出批量结果）")
@click.option(
    "-f",
    "--format",
    type=click.Choice(["markdown", "csv", "json"]),
    default="markdown",
    help="导出格式",
)
@click.option("-o", "--output", type=click.Path(), help="输出文件路径")
@click.option("--plan/--no-plan", default=False, help="导出加工计划而非校验报告")
@click.pass_context
def report(
    ctx: click.Context,
    order_id: Optional[str],
    format: str,
    output: Optional[str],
    plan: bool,
):
    """导出报告
    
    支持 Markdown、CSV、JSON 三种格式。
    """
    store = ensure_initialized(ctx)
    work_dir = get_work_dir(ctx)
    
    export_format = ExportFormat(format)
    exporter = ReportExporter(work_dir)
    
    if output:
        output_path = Path(output)
    else:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        ext = {"markdown": "md", "csv": "csv", "json": "json"}[format]
        output_path = work_dir / "exports" / f"report_{timestamp}.{ext}"
        output_path.parent.mkdir(parents=True, exist_ok=True)
    
    config = store.store_config
    assert config is not None
    
    if plan:
        if not order_id:
            console.print("[red]导出加工计划需要指定 --order-id[/red]")
            ctx.exit(1)
        
        prescription = store.get_prescription(order_id)
        if not prescription:
            console.print(f"[red]未找到订单: {order_id}[/red]")
            ctx.exit(1)
        
        planning_service = PlanningService(config)
        inventory = store.inventory if store.inventory.items else None
        
        plan_result = planning_service.generate_plan(
            prescription=prescription,
            inventory=inventory,
        )
        
        exported_path = exporter.export_processing_plan(
            plan=plan_result,
            output_path=output_path,
            format=export_format,
        )
    else:
        validation_service = ValidationService(config)
        validation_service.set_existing_orders(store.orders)
        
        inventory = store.inventory if store.inventory.items else None
        
        if order_id:
            prescription = store.get_prescription(order_id)
            if not prescription:
                console.print(f"[red]未找到订单: {order_id}[/red]")
                ctx.exit(1)
            
            result = validation_service.validate_prescription(
                prescription=prescription,
                inventory=inventory,
            )
            
            exported_path = exporter.export_validation_result(
                result=result,
                output_path=output_path,
                format=export_format,
            )
        else:
            batch_result = validation_service.validate_batch(
                prescriptions=store.prescriptions,
                inventory=inventory,
            )
            
            exported_path = exporter.export_batch_result(
                batch_result=batch_result,
                output_path=output_path,
                format=export_format,
            )
    
    console.print(f"[green]报告已导出到: {exported_path}[/green]")


@main.command()
@click.pass_context
def status(ctx: click.Context):
    """查看当前状态
    
    显示门店配置、数据统计等信息。
    """
    store = get_store(ctx)
    
    tree = Tree("配镜加工单守门员")
    
    if store.store_config:
        config_node = tree.add(
            f"[green]门店配置[/green] - {store.store_config.store_name}"
        )
        config_node.add(f"ID: {store.store_config.store_id}")
        config_node.add(f"工作目录: {store.work_dir}")
    else:
        tree.add("[red]未初始化[/red]")
    
    data_node = tree.add("[cyan]数据统计[/cyan]")
    data_node.add(f"处方: {len(store.prescriptions)} 条")
    data_node.add(f"镜架: {len(store.frames)} 个")
    data_node.add(f"镜片库存: {len(store.inventory.items)} 种")
    data_node.add(f"历史订单: {len(store.orders)} 条")
    
    console.print(tree)


from datetime import datetime

if __name__ == "__main__":
    main()
