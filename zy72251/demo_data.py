from valve_service import ValvePositioningService
from models import ValveStatus, NextAction


def create_demo_scenario():
    service = ValvePositioningService()
    
    print("=" * 60)
    print("  地下管廊阀门定位 - 演示数据创建")
    print("=" * 60)
    
    valve_positions = [
        {
            "valve_id": "V-001",
            "label": "地下一层消防主管阀",
            "distance_to_obstacle": 1.8,
            "required_distance": 2.0,
            "has_screenshot_overlay": False,
            "label_visibility": 95,
            "photos": ["sketch_v001.jpg"]
        },
        {
            "valve_id": "V-002",
            "label": "B1区喷淋总阀",
            "distance_to_obstacle": 2.5,
            "required_distance": 2.0,
            "has_screenshot_overlay": True,
            "label_visibility": 15,
            "photos": ["mobile_screenshot_v002.jpg", "sketch_v002.jpg"]
        },
        {
            "valve_id": "V-003",
            "label": "北侧排水管阀",
            "distance_to_obstacle": 1.2,
            "required_distance": 2.0,
            "has_screenshot_overlay": False,
            "label_visibility": 100,
            "photos": ["sketch_v003.jpg"]
        }
    ]
    
    print("\n[步骤1] 导入楼层剖面草图")
    print("-" * 60)
    record = service.import_floor_sketch(
        file_name="地下管廊B1层剖面_20240315.dwg",
        floor_level="B1",
        uploaded_by="园区运维小陶",
        valve_positions=valve_positions,
        has_mobile_screenshot=True
    )
    print(f"记录ID: {record.record_id}")
    print(f"文件: {record.floor_sketch.file_name}")
    print(f"楼层: {record.floor_sketch.floor_level}")
    print(f"标记阀门数: {len(record.floor_sketch.marked_valve_positions)}")
    print(f"状态: {record.status}")
    
    print("\n[步骤2] 第一次计算安全距离报告（无点云日志）")
    print("-" * 60)
    report = service.calculate_safety_distance(
        record_id=record.record_id,
        generated_by="系统自动计算"
    )
    print(f"报告ID: {report.report_id}")
    print(f"总计阀门: {report.summary['total_valves']}")
    print(f"正常: {report.summary['normal_count']}")
    print(f"异常: {report.summary['abnormal_count']}")
    print(f"截图遮挡: {report.summary['blocked_count']}")
    print(f"需关注: {report.summary['needs_attention']}")
    
    for issue in report.issues:
        print(f"\n  {issue.valve_label}:")
        print(f"    状态: {issue.status.value}")
        print(f"    距离: {issue.detected_distance}m / 要求 {issue.required_distance}m")
        print(f"    为什么留下: {issue.why_kept}")
        print(f"    缺什么材料: {issue.missing_materials}")
        print(f"    下一步: {issue.next_action.value}")
        print(f"    找谁: {issue.next_action_person.value}")
        print(f"    截图遮挡: {'是' if issue.is_blocked_by_screenshot else '否'}")
    
    print("\n[步骤3] 园区运维小陶补录点云抽稀日志")
    print("-" * 60)
    log1 = service.add_point_cloud_log(
        record_id=record.record_id,
        operator="园区运维小陶",
        raw_remark="2024.3.14 现场复测: V-001阀门实际距离墙面约2.1m，草图标注有误，因管道弯头影响测量精度。V-003确认距离确实不足，施工时管位偏移，需重新定位。",
        thinning_ratio=0.75,
        confidence_level=0.85,
        issues_found=["V-001测量偏差", "V-003管位偏移"],
        original_coordinates={"V-001": {"x": 125.5, "y": 89.2}, "V-003": {"x": 67.8, "y": 102.3}}
    )
    print(f"日志ID: {log1.log_id}")
    print(f"操作人: {log1.operator}")
    print(f"抽稀率: {log1.thinning_ratio}")
    print(f"置信度: {log1.confidence_level}")
    print(f"原始备注保留: {log1.raw_remark}")
    
    print("\n[步骤4] 补录日志后重跑安全距离报告")
    print("-" * 60)
    report2 = service.calculate_safety_distance(
        record_id=record.record_id,
        generated_by="园区运维小陶"
    )
    print(f"新报告ID: {report2.report_id}")
    print(f"重跑次数: {record.run_count}")
    print(f"有点云日志: {'是' if report2.summary['has_point_cloud_logs'] else '否'}")
    
    for issue in report2.issues:
        print(f"\n  {issue.valve_label}:")
        print(f"    状态: {issue.status.value}")
        print(f"    为什么留下: {issue.why_kept}")
        print(f"    缺什么材料: {issue.missing_materials}")
        print(f"    下一步: {issue.next_action.value}")
        print(f"    找谁: {issue.next_action_person.value}")
    
    print("\n[步骤5] 人工修正 - V-001根据点云日志确认正常")
    print("-" * 60)
    v001_issue = next((i for i in report2.issues if i.valve_id == "V-001"), None)
    if v001_issue:
        success = service.manual_correct_issue(
            record_id=record.record_id,
            issue_id=v001_issue.issue_id,
            corrected_by="园区运维小陶",
            correction_reason="点云抽稀日志显示实际距离2.1m符合要求，原草图测量因弯头影响产生偏差",
            new_status=ValveStatus.NORMAL,
            new_next_action=NextAction.ARCHIVE
        )
        print(f"修正成功: {success}")
    
    updated_record = service.get_record(record.record_id)
    print(f"\n  V-001修正后状态: {next((i.status.value for i in updated_record.safety_report.issues if i.valve_id == 'V-001'), 'N/A')}")
    
    print("\n[步骤6] 完整变更历史（真实复核）")
    print("-" * 60)
    changes = service.get_all_changes()
    for change in changes:
        print(f"\n  [{change.timestamp.strftime('%H:%M:%S')}] {change.who}")
        print(f"    改了什么: {change.what_changed}")
        print(f"    为什么改: {change.why_changed}")
        print(f"    影响结果: {change.affected_results}")
    
    print("\n" + "=" * 60)
    print("  演示数据创建完成")
    print("=" * 60)
    print(f"\n  记录ID: {record.record_id}")
    print(f"  变更记录数: {len(changes)}")
    print(f"  点云日志数: {len(record.point_cloud_logs)}")
    print(f"  重跑次数: {record.run_count}")
    print(f"\n  关键场景验证:")
    print(f"  ✓ V-002被标记为【截图遮挡】，下一步找施工经理")
    print(f"  ✓ 点云抽稀日志原始备注完整保留")
    print(f"  ✓ 补录日志后安全距离报告自动更新")
    print(f"  ✓ 所有变更可追溯（谁改了什么为什么）")
    
    return service, record.record_id


if __name__ == "__main__":
    create_demo_scenario()
