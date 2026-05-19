#!/usr/bin/env python3
"""仓库夜班排班系统 - 演示脚本"""

from datetime import date
from pathlib import Path

from warehouse_nightshift.models import TaskStatus, ExceptionType
from warehouse_nightshift.storage import Database, UnitOfWork
from warehouse_nightshift.business import ImportService, ScheduleService, ExportService, QueryFilter


def main():
    print("=" * 60)
    print("仓库夜班排班系统 - 演示")
    print("=" * 60)

    db = Database()
    uow = UnitOfWork(db)

    import_service = ImportService(uow)
    schedule_service = ScheduleService(uow)
    export_service = ExportService(uow)

    operator = "张班长"

    print("\n【步骤1】导入叉车数据")
    print("-" * 60)
    forklift_csv = Path("data/sample_forklifts.csv")
    result = import_service.import_forklifts_from_csv(forklift_csv, operator)
    print(f"导入状态: {result.status.value}")
    print(f"成功: {result.success_count}, 失败: {result.failed_count}, 总计: {result.total_records}")

    print("\n【步骤2】导入充电桩数据")
    print("-" * 60)
    station_json = Path("data/sample_stations.json")
    result = import_service.import_charging_stations_from_json(station_json, operator)
    print(f"导入状态: {result.status.value}")
    print(f"成功: {result.success_count}, 失败: {result.failed_count}, 总计: {result.total_records}")

    print("\n【步骤3】导入任务数据")
    print("-" * 60)
    task_csv = Path("data/sample_tasks.csv")
    result = import_service.import_tasks_from_csv(task_csv, operator)
    print(f"导入状态: {result.status.value}")
    print(f"成功: {result.success_count}, 失败: {result.failed_count}, 总计: {result.total_records}")

    print("\n【步骤4】查看导入失败记录")
    print("-" * 60)
    failed_records = uow.failed_records.get_unresolved()
    print(f"未处理的失败记录: {len(failed_records)} 条")
    for record in failed_records[:3]:
        print(f"  - [{record.row_number}行] {record.error_message}")
        print(f"    建议: {record.suggestion}")

    print("\n【步骤5】自动生成排班")
    print("-" * 60)
    schedule_date = date(2024, 1, 15)
    shift = "night"
    schedule, conflicts = schedule_service.generate_schedule(schedule_date, shift, operator)
    print(f"排班ID: {schedule.id}")
    print(f"排班日期: {schedule_date}, 班次: {shift}")
    print(f"任务数量: {len(schedule.task_order)}")
    print(f"自动分配叉车: {len(schedule.forklift_assignments)} 辆")
    if conflicts:
        print(f"\n检测到 {len(conflicts)} 个冲突:")
        for conflict in conflicts:
            print(f"  - [{conflict.conflict_type.value}] {conflict.message}")

    print("\n【步骤6】复核排班")
    print("-" * 60)
    review_result = schedule_service.review_schedule(
        schedule.id, operator, "已检查，夜班按此执行"
    )
    print(f"复核结果: {'成功' if review_result else '失败'}")

    print("\n【步骤7】更新任务状态")
    print("-" * 60)
    tasks = uow.tasks.get_by_date_and_shift(schedule_date, shift)
    for i, task in enumerate(tasks[:3]):
        if i == 0:
            schedule_service.update_task_status(task.id, TaskStatus.IN_PROGRESS, operator)
            print(f"任务 {task.id} 开始执行")
        elif i == 1:
            schedule_service.update_task_status(
                task.id, TaskStatus.EXCEPTION, operator,
                ExceptionType.LOW_BATTERY, "叉车电量不足，需要充电"
            )
            print(f"任务 {task.id} 出现异常")
        else:
            schedule_service.update_task_status(task.id, TaskStatus.COMPLETED, operator)
            print(f"任务 {task.id} 完成")

    print("\n【步骤8】查询筛选")
    print("-" * 60)
    query_filter = QueryFilter(
        start_date=date(2024, 1, 15),
        end_date=date(2024, 1, 15),
        operator="张三"
    )
    filtered_tasks = export_service.query_tasks(query_filter)
    print(f"查询到 {len(filtered_tasks)} 条任务")

    print("\n【步骤9】导出报告")
    print("-" * 60)
    all_filter = QueryFilter(start_date=date(2024, 1, 15), end_date=date(2024, 1, 15))
    summary = export_service.get_summary(all_filter)
    print(f"任务总数: {summary['total_tasks']}")
    print(f"按状态统计: {summary['by_status']}")
    print(f"按异常类型统计: {summary['by_exception_type']}")

    excel_path = export_service.export_to_excel(all_filter, "demo_report.xlsx")
    failed_path = export_service.export_failed_records()
    print(f"Excel报告已导出: {excel_path}")
    print(f"失败记录已导出: {failed_path}")

    print("\n" + "=" * 60)
    print("演示完成！")
    print("=" * 60)


if __name__ == "__main__":
    main()
