#!/usr/bin/env python3

import sys
import json

sys.path.insert(0, ".")

from airbridge import PreflightManager, ReviewManager, Visualizer, WorkflowEngine


def run_test():
    print("=" * 60)
    print("机场廊桥停靠预演 - 三步流程测试")
    print("=" * 60)
    print()

    pm = PreflightManager()
    rm = ReviewManager(pm)
    vz = Visualizer(pm)
    we = WorkflowEngine(pm, rm, vz)

    test_data = {
        "coordinate_origins": [
            {
                "id": "origin_001",
                "name": "T2航站楼D10廊桥",
                "x": 125.6,
                "y": 89.3,
                "z": 5.2,
                "description": "主廊桥停靠点，安全距离要求3.5米",
            },
            {
                "id": "origin_002",
                "name": "T2航站楼D12廊桥",
                "x": 156.8,
                "y": 92.1,
                "z": 5.2,
                "description": "备用廊桥停靠点",
            },
            {
                "id": "origin_001",
                "name": "T2航站楼D10廊桥",
                "x": 125.6,
                "y": 89.3,
                "z": 5.2,
                "description": "重复导入测试",
            },
        ],
        "inspection_photos": [
            {
                "id": "photo_001",
                "photo_number": "INSP-2024-001",
                "coordinate_origin_id": "origin_001",
                "remark": "D10廊桥初始巡检",
                "has_mobile_screenshot": False,
                "alert_label_visible": True,
            },
            {
                "id": "photo_002",
                "photo_number": "INSP-2024-002",
                "coordinate_origin_id": "origin_001",
                "remark": "移动端复核截图",
                "has_mobile_screenshot": True,
                "alert_label_visible": False,
            },
            {
                "id": "photo_003",
                "photo_number": "INSP-2024-003",
                "coordinate_origin_id": "origin_002",
                "remark": "D12廊桥正常",
                "has_mobile_screenshot": False,
                "alert_label_visible": True,
            },
        ],
        "safety_distance_report": {
            "origin_001": {"min_distance": 3.8, "status": "compliant"},
            "origin_002": {"min_distance": 4.2, "status": "compliant"},
        },
        "remark_updates": [
            {
                "photo_id": "photo_001",
                "new_remark": "D10廊桥初始巡检 - 展陈设计师阿景复核确认",
            },
            {
                "photo_id": "photo_002",
                "new_remark": "移动端复核截图 - 告警标签被遮挡，需施工经理确认",
            },
        ],
    }

    print("[步骤 1] 导入坐标原点说明...")
    print("-" * 60)
    result = we.run_three_step_workflow(test_data)

    print(f"  导入完成: {result['step1_import']['imported_count']} 条")
    print(f"  跳过重复: {result['step1_import']['skipped_count']} 条")
    print(f"  创建预演记录: {result['step1_import']['created_records']}")
    print()

    print("[步骤 2] 展陈设计师阿景补看巡检照片编号...")
    print("-" * 60)
    print(f"  添加照片: {result['step2_review_photos']['photos_added']} 张")
    print(f"  检测到遮挡告警: {result['step2_review_photos']['blocked_alerts_detected']} 处")
    print(f"  问题照片: {result['step2_review_photos']['photos_with_issue']}")
    print()

    print("[步骤 3] 安全距离报告更新...")
    print("-" * 60)
    print(f"  备注更新: {result['step3_update_report']['remarks_updated']}")
    print(f"  提交施工经理复核: {result['step3_update_report']['records_submitted_for_manager_review']} 条")
    print()

    print("[验证] 移动端截图挡住告警标签处理...")
    print("-" * 60)
    need_review = rm.get_records_needing_review()
    print(f"  待复核记录数: {len(need_review)}")

    for record in need_review:
        photos = pm.get_photos_by_origin_id(record.coordinate_origin_id)
        print(f"  记录 {record.id}:")
        for p in photos:
            if p.is_alert_label_blocked():
                print(f"    - 照片 {p.photo_number}: 告警标签被遮挡，等待施工经理复核")
    print()

    print("[验证] 历史记录差异查看...")
    print("-" * 60)
    record = pm.get_preflight_by_origin_id("origin_001")
    if record:
        diff = we.verify_history_diff(record.id)
        print(f"  记录 {record.id} 历史条目: {diff['total_history_entries']}")
        for change in diff["remark_changes"]:
            print(f"    - 照片 {change['photo_id']}:")
            print(f"      修改前: {change['old_value']}")
            print(f"      修改后: {change['new_value']}")
    print()

    print("[验证] 3D/图表展示回溯功能...")
    print("-" * 60)
    vz.set_view_mode("3d")
    print(f"  当前视图模式: {vz.get_view_mode()}")

    if record:
        click_result = vz.click_record(record.id)
        print(f"  点击记录 -> 回源坐标原点: {click_result['back_links']['to_origin']}")
        print(f"  可回溯照片: {click_result['back_links']['to_photos']}")
    print()

    print("[验证] 回滚机制测试...")
    print("-" * 60)
    if need_review:
        test_record = need_review[0]
        test_photo = pm.get_photos_by_origin_id(test_record.coordinate_origin_id)[1]
        print(f"  当前状态: {test_record.status}")

        resolved = rm.resolve_block(
            test_record.id, test_photo.id, "rephoto", "designer_ajing"
        )
        print(f"  解决后状态: {resolved.status}")

        rolled_back = rm.rollback(test_record.id, "system")
        if rolled_back:
            print(f"  回滚后状态: {rolled_back.status}")
    print()

    print("[输出] 可复盘记录和重放命令...")
    print("-" * 60)

    with open("workflow_log.json", "w") as f:
        f.write(we.export_workflow_log())
    print("  工作流日志 -> workflow_log.json")

    with open("replay_script.py", "w") as f:
        f.write(we.generate_replay_script())
    print("  重放脚本 -> replay_script.py")

    with open("visualization_report.json", "w") as f:
        f.write(vz.export_visualization_report())
    print("  可视化报告 -> visualization_report.json")

    print()
    print("=" * 60)
    print("测试完成！")
    print("=" * 60)

    print()
    print("生成的文件:")
    print("  1. workflow_log.json      - 完整工作流日志（复盘用）")
    print("  2. replay_script.py       - 可重放执行脚本")
    print("  3. visualization_report.json - 可视化数据报告")
    print()
    print("下一步操作:")
    print("  python replay_script.py   # 重新执行整个流程")
    print("  cat workflow_log.json     # 查看完整复盘记录")


if __name__ == "__main__":
    run_test()
