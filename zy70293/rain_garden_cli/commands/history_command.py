"""history 子命令：查看历史记录"""

import click
from ..utils import (
    load_data_store, print_header, print_status, print_table
)


@click.command("history")
@click.option("--type", "-t", 
              type=click.Choice(["all", "rainfall", "ponding", "plant", "inspection", "check"]),
              default="all", help="历史记录类型")
@click.option("--limit", "-n", type=int, default=20, help="显示记录数量限制")
@click.option("--garden-id", "-g", default=None, help="按花园ID筛选")
def history_cmd(type, limit, garden_id):
    """查看历史记录

    可查看降雨记录、积水记录、植物状态、巡查安排和检查结果历史。
    """
    print_header("查看历史记录")
    
    store = load_data_store()
    
    if not store.gardens:
        print_status("未找到数据，请先运行 'rain-garden init'", "ERROR")
        return
    
    check_type_names = {
        "garden_status": "花园状态",
        "rainfall_verification": "降雨验证",
        "ponding_matching": "积水匹配",
        "plant_health": "植物健康",
        "inspection_schedule": "巡查安排",
    }
    
    status_colors = {
        "PASS": "SUCCESS",
        "MANUAL": "WARNING",
        "FAIL": "ERROR",
    }
    
    if type in ["all", "rainfall"]:
        print()
        print_status(f"降雨记录 (最多 {limit} 条)", "INFO")
        records = list(store.rainfall_records.values())
        if garden_id:
            records = [r for r in records if r.garden_id == garden_id]
        records = sorted(records, key=lambda r: r.import_time, reverse=True)[:limit]
        
        headers = ["日期", "花园ID", "降雨量(mm)", "来源", "验证状态"]
        rows = []
        for r in records:
            rows.append([r.date, r.garden_id, r.rainfall, r.source, 
                        "已验证" if r.is_verified else "待验证"])
        print_table(headers, rows)
    
    if type in ["all", "ponding"]:
        print()
        print_status(f"积水记录 (最多 {limit} 条)", "INFO")
        records = list(store.ponding_records.values())
        if garden_id:
            records = [r for r in records if r.garden_id == garden_id]
        records = sorted(records, key=lambda r: r.date, reverse=True)[:limit]
        
        headers = ["日期", "花园ID", "深度(cm)", "时长(分)", "位置", "匹配状态"]
        rows = []
        for r in records:
            rows.append([r.date, r.garden_id, r.depth, r.duration, r.location,
                        "已匹配" if r.is_matched else "待匹配"])
        print_table(headers, rows)
    
    if type in ["all", "plant"]:
        print()
        print_status(f"植物状态 (最多 {limit} 条)", "INFO")
        records = list(store.plant_status.values())
        if garden_id:
            records = [r for r in records if r.garden_id == garden_id]
        records = sorted(records, key=lambda r: r.date, reverse=True)[:limit]
        
        headers = ["日期", "花园ID", "植物类型", "健康状态", "生长率"]
        rows = []
        for r in records:
            rows.append([r.date, r.garden_id, r.plant_type, r.health_status, r.growth_rate])
        print_table(headers, rows)
    
    if type in ["all", "inspection"]:
        print()
        print_status(f"巡查安排 (最多 {limit} 条)", "INFO")
        records = list(store.inspection_schedules.values())
        if garden_id:
            records = [r for r in records if r.garden_id == garden_id]
        records = sorted(records, key=lambda r: r.scheduled_date, reverse=True)[:limit]
        
        headers = ["计划日期", "花园ID", "志愿者", "状态", "完成日期"]
        rows = []
        for r in records:
            rows.append([r.scheduled_date, r.garden_id, r.volunteer, r.status,
                        r.completed_date or "-"])
        print_table(headers, rows)
    
    if type in ["all", "check"]:
        print()
        print_status(f"检查结果历史 (最多 {limit} 条)", "INFO")
        records = list(store.check_results)
        if garden_id:
            records = [r for r in records if r.details.get("garden_id") == garden_id]
        records = sorted(records, key=lambda r: r.timestamp, reverse=True)[:limit]
        
        headers = ["时间", "检查类型", "状态", "说明"]
        rows = []
        for r in records:
            check_type = check_type_names.get(r.check_type, r.check_type)
            rows.append([r.timestamp, check_type, r.status, r.message])
        print_table(headers, rows)
    
    print()
    print_status("提示: 使用 -g 选项按花园ID筛选，使用 -n 调整显示数量", "INFO")
