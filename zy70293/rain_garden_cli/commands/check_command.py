"""check 子命令：执行检查"""

import click
from ..models import CheckResult
from ..utils import (
    load_data_store, save_data_store, get_now_str,
    generate_id, print_header, print_status, print_table
)


def check_garden_status(store):
    """检查花园点位状态"""
    results = []
    for garden_id, garden in store.gardens.items():
        if garden.is_active:
            status = "PASS"
            message = f"花园 '{garden.name}' 正常运行"
        else:
            status = "MANUAL"
            message = f"花园 '{garden.name}' 已停用，需要确认是否重新启用"
        
        results.append(CheckResult(
            id=generate_id("chk-"),
            check_type="garden_status",
            status=status,
            message=message,
            details={"garden_id": garden_id, "is_active": garden.is_active},
            timestamp=get_now_str()
        ))
    return results


def check_rainfall_verification(store):
    """检查降雨记录验证状态"""
    results = []
    for rain_id, record in store.rainfall_records.items():
        if record.is_verified:
            status = "PASS"
            message = f"降雨记录已验证: {record.date} {record.rainfall}mm"
        else:
            status = "MANUAL"
            message = f"降雨记录待验证: {record.date} {record.rainfall}mm (来源: {record.source})"
        
        results.append(CheckResult(
            id=generate_id("chk-"),
            check_type="rainfall_verification",
            status=status,
            message=message,
            details={"record_id": rain_id, "garden_id": record.garden_id, 
                    "date": record.date, "rainfall": record.rainfall},
            timestamp=get_now_str()
        ))
    return results


def check_ponding_matching(store):
    """检查积水记录匹配状态"""
    results = []
    for pond_id, record in store.ponding_records.items():
        if record.is_matched:
            status = "PASS"
            message = f"积水记录已匹配原始数据: {record.date} 深度{record.depth}cm"
        else:
            status = "MANUAL"
            message = f"积水记录待匹配原始数据: {record.date} 深度{record.depth}cm (记录者: {record.recorder})"
        
        results.append(CheckResult(
            id=generate_id("chk-"),
            check_type="ponding_matching",
            status=status,
            message=message,
            details={"record_id": pond_id, "garden_id": record.garden_id,
                    "date": record.date, "depth": record.depth},
            timestamp=get_now_str()
        ))
    return results


def check_plant_health(store):
    """检查植物健康状态"""
    results = []
    health_mapping = {"良好": "PASS", "一般": "MANUAL", "差": "FAIL"}
    
    for plant_id, record in store.plant_status.items():
        status = health_mapping.get(record.health_status, "MANUAL")
        message = f"{record.plant_type}: 健康状态{record.health_status} (生长率: {record.growth_rate})"
        
        if status == "FAIL":
            message += " - 需要紧急处理"
        
        results.append(CheckResult(
            id=generate_id("chk-"),
            check_type="plant_health",
            status=status,
            message=message,
            details={"record_id": plant_id, "garden_id": record.garden_id,
                    "plant_type": record.plant_type, "health_status": record.health_status},
            timestamp=get_now_str()
        ))
    return results


def check_inspection_schedule(store):
    """检查巡查安排状态"""
    results = []
    status_mapping = {
        "已完成": "PASS",
        "待执行": "MANUAL",
        "已取消": "MANUAL",
        "逾期": "FAIL"
    }
    
    for sch_id, schedule in store.inspection_schedules.items():
        status = status_mapping.get(schedule.status, "MANUAL")
        message = f"巡查安排: {schedule.scheduled_date} 志愿者: {schedule.volunteer} 状态: {schedule.status}"
        
        results.append(CheckResult(
            id=generate_id("chk-"),
            check_type="inspection_schedule",
            status=status,
            message=message,
            details={"schedule_id": sch_id, "garden_id": schedule.garden_id,
                    "scheduled_date": schedule.scheduled_date, "status": schedule.status},
            timestamp=get_now_str()
        ))
    return results


@click.command("check")
@click.option("--type", "-t", 
              type=click.Choice(["all", "garden", "rainfall", "ponding", "plant", "inspection"]),
              default="all", help="检查类型")
@click.option("--save/--no-save", default=True, help="是否保存检查结果到历史")
def check_cmd(type, save):
    """执行数据完整性检查

    可检查花园状态、降雨验证、积水匹配、植物健康和巡查安排。
    状态说明:
      PASS - 通过检查
      FAIL - 检查失败，需要处理
      MANUAL - 需要人工确认或处理
    """
    print_header("执行数据检查")
    
    store = load_data_store()
    
    if not store.gardens:
        print_status("未找到数据，请先运行 'rain-garden init' 或导入数据", "ERROR")
        return
    
    all_checks = {
        "garden": check_garden_status,
        "rainfall": check_rainfall_verification,
        "ponding": check_ponding_matching,
        "plant": check_plant_health,
        "inspection": check_inspection_schedule,
    }
    
    results = []
    
    if type == "all":
        for check_func in all_checks.values():
            results.extend(check_func(store))
    else:
        if type in all_checks:
            results = all_checks[type](store)
    
    pass_count = sum(1 for r in results if r.status == "PASS")
    fail_count = sum(1 for r in results if r.status == "FAIL")
    manual_count = sum(1 for r in results if r.status == "MANUAL")
    
    check_type_names = {
        "garden_status": "花园状态",
        "rainfall_verification": "降雨验证",
        "ponding_matching": "积水匹配",
        "plant_health": "植物健康",
        "inspection_schedule": "巡查安排",
    }
    
    table_headers = ["检查类型", "状态", "说明"]
    table_rows = []
    for r in results:
        check_type = check_type_names.get(r.check_type, r.check_type)
        table_rows.append([check_type, r.status, r.message])
    
    print_table(table_headers, table_rows)
    
    print()
    print_status(f"通过检查: {pass_count}", "SUCCESS")
    print_status(f"需要人工处理: {manual_count}", "WARNING")
    print_status(f"检查失败: {fail_count}", "ERROR" if fail_count > 0 else "INFO")
    
    if save:
        store.check_results.extend(results)
        save_data_store(store)
        print_status(f"已保存 {len(results)} 条检查结果到历史记录", "INFO")
    
    if fail_count > 0:
        click.echo()
        print_status("存在失败项，请处理后重新运行检查", "WARNING")
    
    if manual_count > 0:
        click.echo()
        print_status("存在需要人工确认的项，请逐一核对", "INFO")
