import click
from pathlib import Path

from .parser import CSVParser
from .engine import RulesEngine
from .reporter import ReportGenerator


@click.group()
@click.version_option(version="0.1.0")
def cli():
    """保养配件替代件库存预演排查工具"""
    pass


@cli.command()
@click.option("--models", required=True, type=click.Path(exists=True), help="车型CSV文件路径")
@click.option("--maintenance", required=True, type=click.Path(exists=True), help="保养项目CSV文件路径")
@click.option("--inventory", required=True, type=click.Path(exists=True), help="库存CSV文件路径")
@click.option("--alternatives", required=True, type=click.Path(exists=True), help="替代件CSV文件路径")
@click.option("--output", default="./report", type=click.Path(), help="报告输出目录")
def run(models, maintenance, inventory, alternatives, output):
    """运行库存预演排查并生成报告"""
    click.echo("=" * 60)
    click.echo("  保养配件替代件库存预演排查工具")
    click.echo("=" * 60)
    click.echo()

    parser = CSVParser()

    click.echo("正在解析数据文件...")
    car_models, bad_models = parser.parse_car_models(models)
    maintenance_items, bad_maintenance = parser.parse_maintenance(maintenance)
    inventory_items, bad_inventory = parser.parse_inventory(inventory)
    alternatives_list, bad_alternatives = parser.parse_alternatives(alternatives)

    all_bad_lines = bad_models + bad_maintenance + bad_inventory + bad_alternatives

    click.echo(f"  车型: {len(car_models)} 个 (坏行: {len(bad_models)})")
    click.echo(f"  保养项目: {len(maintenance_items)} 个 (坏行: {len(bad_maintenance)})")
    click.echo(f"  库存配件: {len(inventory_items)} 个 (坏行: {len(bad_inventory)})")
    click.echo(f"  替代件关系: {len(alternatives_list)} 条 (坏行: {len(bad_alternatives)})")
    click.echo()

    click.echo("正在执行库存预演排查...")
    engine = RulesEngine()
    result = engine.process(car_models, maintenance_items, inventory_items, alternatives_list)
    result.bad_lines = all_bad_lines

    total_gaps = sum(r.total_gap_count for r in result.plan_results)
    total_critical = sum(r.critical_gap_count for r in result.plan_results)
    click.echo(f"  保养计划: {len(result.plan_results)} 个")
    click.echo(f"  总缺口数: {total_gaps} 个 (严重: {total_critical} 个)")
    click.echo()

    click.echo(f"正在生成报告到: {output}")
    reporter = ReportGenerator(output)
    reporter.generate_all(result)

    click.echo()
    click.echo("=" * 60)
    click.echo("  处理完成！")
    click.echo("=" * 60)


@cli.command()
@click.option("--output", default="./data", type=click.Path(), help="示例数据输出目录")
def init(output):
    """生成示例CSV数据文件"""
    data_dir = Path(output)
    data_dir.mkdir(parents=True, exist_ok=True)

    models_csv = data_dir / "models.csv"
    with open(models_csv, "w", encoding="utf-8") as f:
        f.write("model_id,brand,series,year,engine\n")
        f.write("BMW-320-2022,BMW,3系,2022,B48\n")
        f.write("BMW-530-2023,BMW,5系,2023,B58\n")
        f.write("BENZ-C200-2022,BENZ,C级,2022,M264\n")
        f.write("AUDI-A4L-2023,AUDI,A4L,2023,DKW\n")

    maintenance_csv = data_dir / "maintenance.csv"
    with open(maintenance_csv, "w", encoding="utf-8") as f:
        f.write("maintenance_id,name,required_parts,applicable_models\n")
        f.write("OIL-001,常规机油保养,OIL-001:1;FIL-OIL-001:1,BMW-320-2022;BMW-530-2023\n")
        f.write("OIL-002,常规机油保养,OIL-002:1;FIL-OIL-002:1,BENZ-C200-2022\n")
        f.write("BRAKE-001,前刹车片更换,BRAKE-F-001:1;BOLT-F-001:4,BMW-320-2022;BMW-530-2023\n")
        f.write("BRAKE-002,前刹车片更换,BRAKE-F-002:1,BENZ-C200-2022;AUDI-A4L-2023\n")

    inventory_csv = data_dir / "inventory.csv"
    with open(inventory_csv, "w", encoding="utf-8") as f:
        f.write("part_number,part_name,quantity,location\n")
        f.write("OIL-001,宝马原厂机油5W-30,3,A仓\n")
        f.write("OIL-002,奔驰原厂机油5W-40,2,A仓\n")
        f.write("OIL-001-ALT,壳牌全合成机油5W-30,10,B仓\n")
        f.write("FIL-OIL-001,宝马机油滤清器,2,A仓\n")
        f.write("FIL-OIL-001-ALT,曼牌机油滤清器W610/1,15,B仓\n")
        f.write("FIL-OIL-002,奔驰机油滤清器,1,A仓\n")
        f.write("BRAKE-F-001,宝马前刹车片,1,C仓\n")
        f.write("BRAKE-F-001-ALT,博世前刹车片,5,C仓\n")
        f.write("BOLT-F-001,刹车片固定螺栓,10,C仓\n")
        f.write("BRAKE-F-002,奔驰前刹车片,0,C仓\n")

    alternatives_csv = data_dir / "alternatives.csv"
    with open(alternatives_csv, "w", encoding="utf-8") as f:
        f.write("original_part,alternative_part,priority,applicable_models\n")
        f.write("OIL-001,OIL-001-ALT,1,\n")
        f.write("FIL-OIL-001,FIL-OIL-001-ALT,1,\n")
        f.write("BRAKE-F-001,BRAKE-F-001-ALT,1,BMW-320-2022;BMW-530-2023\n")

    click.echo(f"示例数据文件已生成到: {data_dir}")
    click.echo()
    click.echo("运行以下命令进行测试:")
    click.echo(f"  mparts run --models {models_csv} --maintenance {maintenance_csv} --inventory {inventory_csv} --alternatives {alternatives_csv}")


if __name__ == "__main__":
    cli()
