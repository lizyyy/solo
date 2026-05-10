import click
import os
import sys
from datetime import date, time

from .store import DataStore
from .io import SampleDataInitializer, DataImporter, DataExporter
from .validator import ScheduleValidator
from .models import Schedule


DATA_DIR_OPTION = click.option(
    "--data-dir", "-d",
    default="./farm_data",
    show_default=True,
    help="数据存储目录"
)


@click.group()
def main():
    """农机跨村调度 CLI 工具
    
    功能：地块导入、农机档案管理、调度排程与约束检查
    """
    pass


@main.command()
@DATA_DIR_OPTION
@click.option("--force", "-f", is_flag=True, help="强制覆盖现有数据")
def init(data_dir, force):
    """初始化样例数据
    
    创建包含示例地块、农机和调度记录的演示环境
    """
    if os.path.exists(data_dir) and not force:
        click.echo(f"错误：数据目录 {data_dir} 已存在。使用 --force 选项覆盖。")
        sys.exit(1)
    
    store = DataStore(data_dir)
    store.initialize()
    SampleDataInitializer.initialize_store(store)
    
    click.echo(f"✅ 数据已初始化到 {data_dir}")
    click.echo(f"   - 地块数量：{len(store.plots)}")
    click.echo(f"   - 农机数量：{len(store.harvesters)}")
    click.echo(f"   - 调度数量：{len(store.schedules)}")
    click.echo("")
    click.echo("下一步：运行 'farm-scheduler check' 检查约束")


@main.group()
def import_cmd():
    """导入数据"""
    pass


@import_cmd.command("plots")
@DATA_DIR_OPTION
@click.argument("filepath", type=click.Path(exists=True))
def import_plots(data_dir, filepath):
    """导入地块数据（支持 JSON/CSV）"""
    store = DataStore(data_dir)
    store.initialize()
    
    try:
        DataImporter.import_plots(store, filepath)
        click.echo(f"✅ 成功导入地块数据，当前共 {len(store.plots)} 个地块")
    except Exception as e:
        click.echo(f"❌ 导入失败：{e}", err=True)
        sys.exit(1)


@import_cmd.command("harvesters")
@DATA_DIR_OPTION
@click.argument("filepath", type=click.Path(exists=True))
def import_harvesters(data_dir, filepath):
    """导入农机数据（支持 JSON/CSV）"""
    store = DataStore(data_dir)
    store.initialize()
    
    try:
        DataImporter.import_harvesters(store, filepath)
        click.echo(f"✅ 成功导入农机数据，当前共 {len(store.harvesters)} 台农机")
    except Exception as e:
        click.echo(f"❌ 导入失败：{e}", err=True)
        sys.exit(1)


@main.command()
@DATA_DIR_OPTION
@click.option("--schedule-id", "-s", help="检查特定调度 ID")
def check(data_dir, schedule_id):
    """检查调度约束
    
    验证：地块成熟期、农机维修窗口、司机休息时间、时段冲突
    """
    store = DataStore(data_dir)
    store.initialize()
    validator = ScheduleValidator(store)
    
    if schedule_id:
        schedule = store.schedules.get(schedule_id)
        if not schedule:
            click.echo(f"❌ 调度 {schedule_id} 不存在")
            sys.exit(1)
        
        violations = validator.validate_schedule(schedule)
        if violations:
            click.echo(f"⚠️ 调度 {schedule_id} 发现 {len(violations)} 个问题：")
            for v in violations:
                click.echo(f"   {v}")
            sys.exit(1)
        else:
            click.echo(f"✅ 调度 {schedule_id} 检查通过")
    else:
        all_violations = validator.validate_all_schedules()
        if all_violations:
            total = sum(len(v) for v in all_violations.values())
            click.echo(f"⚠️ 共发现 {total} 个约束违反（涉及 {len(all_violations)} 个调度）：")
            click.echo("")
            for sched_id, violations in all_violations.items():
                click.echo(f"  调度 {sched_id}：")
                for v in violations:
                    click.echo(f"    {v}")
            sys.exit(1)
        else:
            active = len([s for s in store.schedules.values() if s.status != "cancelled"])
            click.echo(f"✅ 全部 {active} 个活跃调度检查通过")


@main.command()
@DATA_DIR_OPTION
@click.option("--entity-type", "-t", type=click.Choice(["plot", "harvester", "schedule", "all"]), 
              default="all", help="按实体类型过滤")
@click.option("--entity-id", "-i", help="按实体 ID 过滤")
@click.option("--limit", "-n", type=int, help="限制显示条数")
def history(data_dir, entity_type, entity_id, limit):
    """查看操作历史
    
    显示所有数据变更记录，包括创建、更新、删除操作及其前后值
    """
    store = DataStore(data_dir)
    store.initialize()
    
    etype = None if entity_type == "all" else entity_type
    records = store.get_history(etype, entity_id)
    
    if limit:
        records = records[-limit:]
    
    if not records:
        click.echo("没有历史记录")
        return
    
    click.echo(f"共 {len(records)} 条历史记录：")
    click.echo("-" * 60)
    
    for i, record in enumerate(records, 1):
        click.echo(f"[{i}] {record['timestamp']}")
        click.echo(f"    操作：{record['action']:6s} | 实体：{record['entity_type']} | ID：{record['entity_id']}")
        click.echo(f"    来源：{record['source']}")
        
        if record['action'] == 'create':
            click.echo(f"    新增值：{record['new_value']}")
        elif record['action'] == 'delete':
            click.echo(f"    删除值：{record['old_value']}")
        elif record['action'] == 'update':
            click.echo(f"    旧值：{record['old_value']}")
            click.echo(f"    新值：{record['new_value']}")
        
        click.echo("")


@main.command()
@DATA_DIR_OPTION
@click.argument("filepath", type=click.Path())
@click.option("--include-cancelled", "-c", is_flag=True, help="包含已取消的调度")
@click.option("--format", "-f", "fmt", type=click.Choice(["json", "csv"]), default="json",
              help="导出格式（根据文件扩展名自动识别）")
def export(data_dir, filepath, include_cancelled, fmt):
    """导出调度结果"""
    store = DataStore(data_dir)
    store.initialize()
    
    try:
        DataExporter.export_schedules(store, filepath, include_cancelled)
        count = len([s for s in store.schedules.values() 
                    if include_cancelled or s.status != "cancelled"])
        click.echo(f"✅ 已导出 {count} 条调度记录到 {filepath}")
    except Exception as e:
        click.echo(f"❌ 导出失败：{e}", err=True)
        sys.exit(1)


@main.group()
def schedule():
    """调度管理"""
    pass


@schedule.command("add")
@DATA_DIR_OPTION
@click.argument("schedule_id")
@click.argument("plot_id")
@click.argument("harvester_id")
@click.argument("scheduled_date")
@click.argument("start_time")
@click.argument("end_time")
def schedule_add(data_dir, schedule_id, plot_id, harvester_id, 
                 scheduled_date, start_time, end_time):
    """添加新调度
    
    参数：调度ID 地块ID 农机ID 日期(YYYY-MM-DD) 开始时间(HH:MM) 结束时间(HH:MM)
    
    示例：farm-scheduler schedule add S002 P002 H001 2024-06-13 14:00 18:00
    """
    store = DataStore(data_dir)
    store.initialize()
    
    if schedule_id in store.schedules:
        click.echo(f"❌ 调度 {schedule_id} 已存在")
        sys.exit(1)
    
    try:
        sched = Schedule(
            schedule_id=schedule_id,
            plot_id=plot_id,
            harvester_id=harvester_id,
            scheduled_date=date.fromisoformat(scheduled_date),
            start_time=time.fromisoformat(start_time),
            end_time=time.fromisoformat(end_time),
            status="pending"
        )
    except Exception as e:
        click.echo(f"❌ 参数错误：{e}", err=True)
        sys.exit(1)
    
    validator = ScheduleValidator(store)
    violations = validator.validate_schedule(sched)
    
    if violations:
        click.echo(f"⚠️ 该调度存在 {len(violations)} 个约束问题：")
        for v in violations:
            click.echo(f"   {v}")
        if not click.confirm("是否仍然添加？"):
            click.echo("已取消")
            return
    
    store.add_schedule(sched, source="cli_add")
    click.echo(f"✅ 调度 {schedule_id} 已添加")


@schedule.command("update")
@DATA_DIR_OPTION
@click.argument("schedule_id")
@click.option("--plot-id", help="新地块ID")
@click.option("--harvester-id", help="新农机ID")
@click.option("--date", "scheduled_date", help="新日期")
@click.option("--start-time", help="新开始时间")
@click.option("--end-time", help="新结束时间")
@click.option("--status", type=click.Choice(["pending", "in_progress", "completed", "cancelled"]), 
              help="状态")
def schedule_update(data_dir, schedule_id, plot_id, harvester_id, 
                    scheduled_date, start_time, end_time, status):
    """更新调度"""
    store = DataStore(data_dir)
    store.initialize()
    
    if schedule_id not in store.schedules:
        click.echo(f"❌ 调度 {schedule_id} 不存在")
        sys.exit(1)
    
    old = store.schedules[schedule_id]
    
    try:
        new_sched = Schedule(
            schedule_id=old.schedule_id,
            plot_id=plot_id if plot_id else old.plot_id,
            harvester_id=harvester_id if harvester_id else old.harvester_id,
            scheduled_date=date.fromisoformat(scheduled_date) if scheduled_date else old.scheduled_date,
            start_time=time.fromisoformat(start_time) if start_time else old.start_time,
            end_time=time.fromisoformat(end_time) if end_time else old.end_time,
            status=status if status else old.status
        )
    except Exception as e:
        click.echo(f"❌ 参数错误：{e}", err=True)
        sys.exit(1)
    
    store.add_schedule(new_sched, source="cli_update")
    click.echo(f"✅ 调度 {schedule_id} 已更新")
    click.echo(f"   旧值：{old.to_dict()}")
    click.echo(f"   新值：{new_sched.to_dict()}")


@schedule.command("cancel")
@DATA_DIR_OPTION
@click.argument("schedule_id")
def schedule_cancel(data_dir, schedule_id):
    """取消调度（软删除，仍保留在历史中）"""
    store = DataStore(data_dir)
    store.initialize()
    
    if schedule_id not in store.schedules:
        click.echo(f"❌ 调度 {schedule_id} 不存在")
        sys.exit(1)
    
    old = store.schedules[schedule_id]
    new_sched = Schedule(
        schedule_id=old.schedule_id,
        plot_id=old.plot_id,
        harvester_id=old.harvester_id,
        scheduled_date=old.scheduled_date,
        start_time=old.start_time,
        end_time=old.end_time,
        status="cancelled"
    )
    
    store.add_schedule(new_sched, source="cli_cancel")
    click.echo(f"✅ 调度 {schedule_id} 已取消")
    click.echo("提示：使用 'farm-scheduler history' 可查看变更记录")


@schedule.command("list")
@DATA_DIR_OPTION
@click.option("--include-cancelled", "-c", is_flag=True, help="包含已取消的调度")
def schedule_list(data_dir, include_cancelled):
    """列出所有调度"""
    store = DataStore(data_dir)
    store.initialize()
    
    schedules = list(store.schedules.values())
    if not include_cancelled:
        schedules = [s for s in schedules if s.status != "cancelled"]
    
    if not schedules:
        click.echo("没有调度记录")
        return
    
    schedules.sort(key=lambda s: (s.scheduled_date, s.start_time))
    
    click.echo(f"{'ID':<8} {'地块':<8} {'农机':<8} {'日期':<12} {'时间':<15} {'状态'}")
    click.echo("-" * 70)
    for s in schedules:
        time_range = f"{s.start_time}-{s.end_time}"
        click.echo(f"{s.schedule_id:<8} {s.plot_id:<8} {s.harvester_id:<8} "
                   f"{str(s.scheduled_date):<12} {time_range:<15} {s.status}")


if __name__ == "__main__":
    main()
