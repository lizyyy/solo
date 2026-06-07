"""
社区助餐点服务半径系统 - 快速使用指南

核心模块说明:
1. models.py - 数据模型定义
2. storage.py - 单例数据存储（确保数据一致性）
3. self_check.py - 四大自检功能
4. workflow.py - 三步工作流
5. exporter.py - 统一数据出口（页面/接口/导出）

三步流程:
1. 导入夜间采样点
2. 社区书记周姐补看居民投诉编号
3. 点位清单更新

自检覆盖:
- 重复导入检测
- 施工临时改道未同步检测
- 补录后重算
- 导出一致性检查
"""

from workflow import WorkflowService
from self_check import SelfChecker
from exporter import UnifiedDataExporter


def demo_full_flow():
    print("=== 社区助餐点服务半径系统演示 ===\n")

    print("1. 第一步：导入夜间采样点Excel")
    batch = WorkflowService.step1_import_night_sampling_points(
        "sample_points.xlsx", "社区书记周姐"
    )
    print(f"   导入成功: {batch.total_count} 个点位\n")

    print("2. 自动自检发现的问题:")
    report = SelfChecker.run_full_check()
    for issue in report["issues"]:
        print(f"   - {issue}")
    print()

    print("3. 待居民代表复核的施工改道点位:")
    review_points = WorkflowService.get_points_for_resident_review()
    for p in review_points:
        print(f"   - {p.name} (原始行号:{p.original_row_number})")
        print(f"     施工备注: {p.construction_note}")
    print()

    print("4. 第二步：社区书记周姐补充投诉编号")
    points_for_review = WorkflowService.get_points_for_resident_review()
    second_point = points_for_review[1] if len(points_for_review) > 1 else points_for_review[0]
    updated = WorkflowService.step2_add_complaint_id(
        second_point.id, "TS20260607001", "社区书记周姐"
    )
    print(f"   点位 {updated.name} 补充投诉编号: {updated.complaint_id}")
    print(f"   重算后服务半径: {updated.service_radius}\n")

    print("5. 第三步：点位清单更新")
    updated = WorkflowService.step3_update_point_list(
        second_point.id,
        "社区书记周姐",
        address=second_point.address + "（已核实）",
    )
    print(f"   点位 {updated.name} 地址更新为: {updated.address}\n")

    print("6. 居民代表复核施工改道点位")
    review_points = WorkflowService.get_points_for_resident_review()
    if review_points:
        reviewed = WorkflowService.mark_resident_reviewed(
            review_points[0].id,
            "居民代表李阿姨",
            is_approved=True,
            remark="现场核实改道已同步地图",
        )
        print(f"   点位 {reviewed.name} 复核通过，状态变为: {reviewed.status.value}\n")

    print("7. 居民代表追问时调取审计证据:")
    evidence = UnifiedDataExporter.get_audit_evidence(second_point.id)
    print(f"   点位: {evidence['point_name']}")
    print(f"   原始Excel行号: {evidence['original_row_number']}")
    print(f"   是否人工改动: {evidence['is_manual_modified']}")
    print(f"   历史操作:")
    for log in evidence["radius_history"]:
        print(f"     {log['timestamp'][:19]} {log['operator']} - {log['action']}")

    print("\n8. 导出Excel（与页面、接口同一份数据）:")
    path = UnifiedDataExporter.export_to_excel("服务半径导出结果.xlsx")
    print(f"   已导出到: {path}")

    print("\n=== 演示完成 ===")


if __name__ == "__main__":
    from storage import DataStore
    DataStore._instance = None
    demo_full_flow()
