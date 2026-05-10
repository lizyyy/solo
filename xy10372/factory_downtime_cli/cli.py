"""
命令行接口
"""

import click
from pathlib import Path
from datetime import datetime, date
from typing import Optional

from .models import DataStore, RecordStatus
from .storage import StorageManager
from .importer import DataImporter
from .validator import DataValidator
from .calculator import EfficiencyCalculator
from .exporter import ReportExporter
from .corrector import RecordCorrector
from .utils import parse_datetime, format_minutes, format_efficiency

DATA_DIR = Path(__file__).parent.parent / ".fdt_data" / "data"


def get_storage() -> StorageManager:
    """获取存储管理器"""
    return StorageManager(DATA_DIR)


def load_or_create_store() -> DataStore:
    """加载或创建数据存储"""
    storage = get_storage()
    store = storage.load()
    if store is None:
        store = DataStore()
    return store


@click.group()
def cli():
    """工厂换模停机统计 CLI 工具"""
    pass


@cli.command()
@click.option("--plans", "plans_file", type=click.Path(exists=True), 
              help="生产计划CSV文件")
@click.option("--changeovers", "changeovers_file", type=click.Path(exists=True),
              help="换模记录CSV文件")
@click.option("--downtimes", "downtimes_file", type=click.Path(exists=True),
              help="异常停机CSV文件")
@click.option("--productions", "productions_file", type=click.Path(exists=True),
              help="产量记录CSV文件")
def import_data(plans_file, changeovers_file, downtimes_file, productions_file):
    """导入数据"""
    store = load_or_create_store()
    importer = DataImporter(store)
    
    if plans_file:
        click.echo(f"导入生产计划: {plans_file}")
        result = importer.import_production_plans(Path(plans_file))
        click.echo(f"  总计: {result['total']}, 导入: {result['imported']}, 重复: {result['duplicates']}")
        if result['errors']:
            click.echo(f"  错误: {len(result['errors'])}条")
            for err in result['errors'][:3]:
                click.echo(f"    - {err}")
    
    if changeovers_file:
        click.echo(f"导入换模记录: {changeovers_file}")
        result = importer.import_changeover_records(Path(changeovers_file))
        click.echo(f"  总计: {result['total']}, 导入: {result['imported']}")
        click.echo(f"  重复: {result['duplicates']}, 时间无效: {result['invalid_time']}, 重叠: {result['overlaps']}")
        if result['errors']:
            click.echo(f"  错误: {len(result['errors'])}条")
            for err in result['errors'][:3]:
                click.echo(f"    - {err}")
    
    if downtimes_file:
        click.echo(f"导入异常停机: {downtimes_file}")
        result = importer.import_abnormal_downtimes(Path(downtimes_file))
        click.echo(f"  总计: {result['total']}, 导入: {result['imported']}")
        click.echo(f"  重复: {result['duplicates']}, 时间无效: {result['invalid_time']}, 重叠: {result['overlaps']}")
        if result['errors']:
            click.echo(f"  错误: {len(result['errors'])}条")
            for err in result['errors'][:3]:
                click.echo(f"    - {err}")
    
    if productions_file:
        click.echo(f"导入产量记录: {productions_file}")
        result = importer.import_production_records(Path(productions_file))
        click.echo(f"  总计: {result['total']}, 导入: {result['imported']}")
        click.echo(f"  重复: {result['duplicates']}, 无对应计划: {result['no_plan']}")
        if result['errors']:
            click.echo(f"  错误: {len(result['errors'])}条")
            for err in result['errors'][:3]:
                click.echo(f"    - {err}")
    
    storage = get_storage()
    storage.save(store)
    click.echo("\n数据已保存。")


@cli.command()
@click.option("--date", "target_date", help="统计日期 (YYYY-MM-DD)", default=None)
def calculate(target_date):
    """核算数据"""
    if target_date:
        target_date = parse_datetime(target_date).date()
    else:
        target_date = date.today()
    
    store = load_or_create_store()
    validator = DataValidator(store)
    calculator = EfficiencyCalculator(store)
    
    click.echo("=" * 60)
    click.echo(f"核算日期: {target_date.strftime('%Y-%m-%d')}")
    click.echo("=" * 60)
    
    click.echo("\n[数据验证]")
    validation = validator.validate_all()
    
    click.echo(f"  生产计划: {validation['plans']['valid']}/{validation['plans']['total']} 有效")
    co_stats = validation['changeovers'].get('status_stats', {})
    click.echo(f"  换模记录: {validation['changeovers']['valid']}/{validation['changeovers']['total']} 有效 "
               f"(重复:{co_stats.get('重复',0)}, 时间无效:{co_stats.get('时间无效',0)}, 重叠:{co_stats.get('时间重叠',0)})")
    dt_stats = validation['abnormal_downtimes'].get('status_stats', {})
    click.echo(f"  异常停机: {validation['abnormal_downtimes']['valid']}/{validation['abnormal_downtimes']['total']} 有效 "
               f"(重复:{dt_stats.get('重复',0)}, 时间无效:{dt_stats.get('时间无效',0)}, 重叠:{dt_stats.get('时间重叠',0)})")
    pr_stats = validation['productions'].get('status_stats', {})
    click.echo(f"  产量记录: {validation['productions']['valid']}/{validation['productions']['total']} 有效 "
               f"(重复:{pr_stats.get('重复',0)}, 无对应计划:{pr_stats.get('无对应计划',0)})")
    
    cross_overlaps = validator.check_cross_overlaps()
    if cross_overlaps:
        click.echo("\n  警告: 检测到换模与异常停机交叉重叠:")
        for overlap in cross_overlaps[:5]:
            click.echo(f"    - {overlap}")
    
    click.echo("\n[核算结果]")
    reports = calculator.calculate_daily_reports(target_date)
    
    if not reports:
        click.echo("  无数据可核算。")
        return
    
    click.echo(f"  {'机台':<10} {'总时间':<12} {'计划停机':<12} {'异常停机':<12} {'有效生产':<12} {'产量':<8} {'效率':<8}")
    click.echo("  " + "-" * 74)
    
    total_planned = 0.0
    total_abnormal = 0.0
    total_effective = 0.0
    total_output = 0
    
    for report in reports:
        total_planned += report.planned_downtime_minutes
        total_abnormal += report.abnormal_downtime_minutes
        total_effective += report.effective_production_minutes
        total_output += report.actual_output
        
        click.echo(f"  {report.machine_id:<10} "
                   f"{format_minutes(report.total_minutes):<12} "
                   f"{format_minutes(report.planned_downtime_minutes):<12} "
                   f"{format_minutes(report.abnormal_downtime_minutes):<12} "
                   f"{format_minutes(report.effective_production_minutes):<12} "
                   f"{report.actual_output:<8} "
                   f"{format_efficiency(report.efficiency):<8}")
    
    click.echo("  " + "-" * 74)
    avg_efficiency = total_effective / (len(reports) * 24 * 60) * 100 if reports else 0
    click.echo(f"  {'合计/平均':<10} "
               f"{format_minutes(len(reports) * 24 * 60):<12} "
               f"{format_minutes(total_planned):<12} "
               f"{format_minutes(total_abnormal):<12} "
               f"{format_minutes(total_effective):<12} "
               f"{total_output:<8} "
               f"{format_efficiency(avg_efficiency):<8}")
    
    click.echo("\n[统计口径说明]")
    click.echo("  1. 计划停机: 换模时间（仅有效记录）")
    click.echo("  2. 异常停机: 设备故障等（仅有效记录）")
    click.echo("  3. 有效生产: 24小时 - 计划停机 - 异常停机")
    click.echo("  4. 效率: 有效生产时间 / 24小时 × 100%")
    click.echo("  5. 待复核记录不计入统计，请使用 'correct' 命令处理")


@cli.command()
@click.argument("machine_id")
@click.option("--date", "target_date", help="统计日期 (YYYY-MM-DD)", default=None)
def detail(machine_id, target_date):
    """查看机台明细"""
    if target_date:
        target_date = parse_datetime(target_date).date()
    else:
        target_date = date.today()
    
    store = load_or_create_store()
    calculator = EfficiencyCalculator(store)
    
    report = calculator.calculate_machine_details(machine_id, target_date)
    
    if not report:
        click.echo(f"未找到机台 [{machine_id}] 的数据。")
        return
    
    click.echo("=" * 70)
    click.echo(f"机台明细 - {machine_id}")
    click.echo(f"统计日期: {target_date.strftime('%Y-%m-%d')}")
    click.echo("=" * 70)
    
    click.echo("\n[汇总数据]")
    click.echo(f"  总时间: {format_minutes(report.total_minutes)}")
    click.echo(f"  计划停机: {format_minutes(report.planned_downtime_minutes)}")
    click.echo(f"  异常停机: {format_minutes(report.abnormal_downtime_minutes)}")
    click.echo(f"  有效生产时间: {format_minutes(report.effective_production_minutes)}")
    click.echo(f"  实际产量: {report.actual_output}")
    click.echo(f"  效率: {format_efficiency(report.efficiency)}")
    
    if report.planned_downtime_sources:
        click.echo("\n[计划停机来源] (计入统计)")
        for source in report.planned_downtime_sources:
            click.echo(f"  - {source}")
    
    if report.abnormal_downtime_sources:
        click.echo("\n[异常停机来源] (计入统计)")
        for source in report.abnormal_downtime_sources:
            click.echo(f"  - {source}")
    
    if report.exceptions:
        click.echo("\n[异常记录] (不计入统计，待复核)")
        for exc in report.exceptions:
            click.echo(f"  - {exc}")


@cli.command()
@click.argument("record_type", type=click.Choice(["changeover", "downtime", "production"]))
@click.argument("record_id")
@click.option("--status", type=click.Choice(["valid", "pending"]), help="设置状态")
@click.option("--start-time", help="设置开始时间 (YYYY-MM-DD HH:MM)")
@click.option("--end-time", help="设置结束时间 (YYYY-MM-DD HH:MM)")
@click.option("--plan-id", help="设置关联计划ID (仅production)")
@click.option("--delete", is_flag=True, help="删除记录")
def correct(record_type, record_id, status, start_time, end_time, plan_id, delete):
    """人工修正记录"""
    store = load_or_create_store()
    corrector = RecordCorrector(store)
    
    if delete:
        success = False
        if record_type == "changeover":
            success = corrector.delete_changeover(record_id)
        elif record_type == "downtime":
            success = corrector.delete_downtime(record_id)
        elif record_type == "production":
            success = corrector.delete_production(record_id)
        
        if success:
            click.echo(f"记录 [{record_id}] 已删除。")
            get_storage().save(store)
        else:
            click.echo(f"记录 [{record_id}] 不存在。")
        return
    
    success = False
    
    if record_type == "changeover":
        if status:
            new_status = RecordStatus.VALID if status == "valid" else RecordStatus.PENDING_REVIEW
            success = corrector.correct_changeover_status(record_id, new_status)
            if success:
                click.echo(f"换模记录 [{record_id}] 状态已设置为: {new_status.value}")
        if start_time or end_time:
            st = parse_datetime(start_time) if start_time else None
            et = parse_datetime(end_time) if end_time else None
            success = corrector.correct_changeover_time(record_id, st, et)
            if success:
                click.echo(f"换模记录 [{record_id}] 时间已更新。")
    
    elif record_type == "downtime":
        if status:
            new_status = RecordStatus.VALID if status == "valid" else RecordStatus.PENDING_REVIEW
            success = corrector.correct_downtime_status(record_id, new_status)
            if success:
                click.echo(f"异常停机记录 [{record_id}] 状态已设置为: {new_status.value}")
        if start_time or end_time:
            st = parse_datetime(start_time) if start_time else None
            et = parse_datetime(end_time) if end_time else None
            success = corrector.correct_downtime_time(record_id, st, et)
            if success:
                click.echo(f"异常停机记录 [{record_id}] 时间已更新。")
    
    elif record_type == "production":
        if status:
            new_status = RecordStatus.VALID if status == "valid" else RecordStatus.PENDING_REVIEW
            success = corrector.correct_production_status(record_id, new_status)
            if success:
                click.echo(f"产量记录 [{record_id}] 状态已设置为: {new_status.value}")
        if plan_id:
            success = corrector.correct_production_plan(record_id, plan_id)
            if success:
                click.echo(f"产量记录 [{record_id}] 已关联计划 [{plan_id}]。")
    
    if success:
        get_storage().save(store)
    else:
        click.echo(f"记录 [{record_id}] 不存在或参数无效。")


@cli.command()
@click.option("--date", "target_date", help="统计日期 (YYYY-MM-DD)", default=None)
@click.option("--output", "-o", "output_file", type=click.Path(), required=True,
              help="输出文件路径")
def export(target_date, output_file):
    """导出日报"""
    if target_date:
        target_date = parse_datetime(target_date).date()
    else:
        target_date = date.today()
    
    store = load_or_create_store()
    calculator = EfficiencyCalculator(store)
    exporter = ReportExporter()
    
    reports = calculator.calculate_daily_reports(target_date)
    
    output_path = Path(output_file)
    
    if exporter.export_daily_report_csv(reports, output_path, target_date):
        click.echo(f"日报已导出到: {output_path}")
        click.echo(f"统计日期: {target_date.strftime('%Y-%m-%d')}")
        click.echo(f"机台数量: {len(reports)}")
    else:
        click.echo("导出失败。")


@cli.command()
@click.argument("record_type", type=click.Choice(["changeover", "downtime", "production", "all"]))
def list_pending(record_type):
    """列出待复核记录"""
    store = load_or_create_store()
    validator = DataValidator(store)
    
    pending = validator.get_pending_review_records()
    
    if record_type in ["changeover", "all"]:
        if pending["changeovers"]:
            click.echo("\n[换模记录 - 待复核]")
            click.echo(f"  {'ID':<10} {'机台':<10} {'状态':<12} {'时间段':<40}")
            click.echo("  " + "-" * 72)
            for r in pending["changeovers"]:
                click.echo(f"  {r.record_id:<10} {r.machine_id:<10} {r.status.value:<12} "
                          f"{r.start_time.strftime('%Y-%m-%d %H:%M')}~{r.end_time.strftime('%H:%M')}")
        else:
            click.echo("\n[换模记录 - 待复核]")
            click.echo("  无")
    
    if record_type in ["downtime", "all"]:
        if pending["abnormal_downtimes"]:
            click.echo("\n[异常停机 - 待复核]")
            click.echo(f"  {'ID':<10} {'机台':<10} {'类型':<12} {'状态':<12} {'时间段':<40}")
            click.echo("  " + "-" * 84)
            for r in pending["abnormal_downtimes"]:
                click.echo(f"  {r.record_id:<10} {r.machine_id:<10} {r.downtime_type:<12} "
                          f"{r.status.value:<12} "
                          f"{r.start_time.strftime('%Y-%m-%d %H:%M')}~{r.end_time.strftime('%H:%M')}")
        else:
            click.echo("\n[异常停机 - 待复核]")
            click.echo("  无")
    
    if record_type in ["production", "all"]:
        if pending["productions"]:
            click.echo("\n[产量记录 - 待复核]")
            click.echo(f"  {'ID':<10} {'机台':<10} {'产品':<12} {'数量':<8} {'状态':<12}")
            click.echo("  " + "-" * 52)
            for r in pending["productions"]:
                click.echo(f"  {r.record_id:<10} {r.machine_id:<10} {r.product_code:<12} "
                          f"{r.quantity:<8} {r.status.value:<12}")
        else:
            click.echo("\n[产量记录 - 待复核]")
            click.echo("  无")


@cli.command()
def stats():
    """显示数据统计"""
    store = load_or_create_store()
    validator = DataValidator(store)
    
    click.echo("=" * 50)
    click.echo("数据统计")
    click.echo("=" * 50)
    
    click.echo(f"\n生产计划: {len(store.plans)} 条")
    click.echo(f"换模记录: {len(store.changeovers)} 条")
    click.echo(f"异常停机: {len(store.abnormal_downtimes)} 条")
    click.echo(f"产量记录: {len(store.productions)} 条")
    
    pending = validator.get_pending_review_records()
    click.echo(f"\n待复核记录:")
    click.echo(f"  换模: {len(pending['changeovers'])} 条")
    click.echo(f"  异常停机: {len(pending['abnormal_downtimes'])} 条")
    click.echo(f"  产量: {len(pending['productions'])} 条")


@cli.command()
@click.confirmation_option(help="确认重置所有数据")
def reset():
    """重置所有数据"""
    storage = get_storage()
    storage.reset()
    click.echo("所有数据已重置。")


def main():
    cli()


if __name__ == "__main__":
    main()
