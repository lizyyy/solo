from datetime import date
from main import create_services
from models import UserRole, RecordStatus, ReviewStatus


def test_field_samples():
    print("=" * 80)
    print("现场样例测试 - 覆盖更多真实业务场景")
    print("=" * 80)

    svcs = create_services()
    import_svc = svcs["import_service"]
    conflict_svc = svcs["conflict_service"]
    point_svc = svcs["point_service"]
    self_check_svc = svcs["self_check_service"]
    audit_svc = svcs["audit"]
    repo = svcs["repository"]

    planner = "小姜"
    resident_rep = "居民代表老李"

    print("\n【现场样例 1】批量导入：含历史重复 + 本次重复 + 新记录")
    print("-" * 80)

    notices_batch_1 = [
        {
            "notice_no": "SG-2026-003",
            "project_name": "和平小区路面翻新",
            "construction_location": "和平小区南门",
            "start_date": date(2026, 6, 10),
            "end_date": date(2026, 6, 20),
            "construction_type": "路面翻新",
            "temporary_detour": True,
            "detour_description": "绕西门",
            "map_updated": True,
            "impact_scope": "小型",
            "import_batch_no": "BATCH-2026-06-05",
        },
        {
            "notice_no": "SG-2026-004",
            "project_name": "友谊社区电缆铺设",
            "construction_location": "友谊社区中心",
            "start_date": date(2026, 6, 8),
            "end_date": date(2026, 6, 12),
            "construction_type": "电缆施工",
            "temporary_detour": False,
            "map_updated": True,
            "impact_scope": "中型",
            "import_batch_no": "BATCH-2026-06-05",
        },
    ]

    result1 = import_svc.batch_import_construction_notices(
        notices_batch_1, planner, "BATCH-2026-06-05"
    )
    print(f"  第一批导入结果: {result1['summary']}")
    print(f"  新增: {result1['new_count']}, 历史重复: {result1['history_duplicate_count']}, 本次重复: {result1['current_batch_duplicate_count']}")

    notices_batch_2 = [
        {
            "notice_no": "SG-2026-003",
            "project_name": "和平小区路面翻新",
            "construction_location": "和平小区南门",
            "start_date": date(2026, 6, 10),
            "end_date": date(2026, 6, 20),
            "construction_type": "路面翻新",
            "temporary_detour": True,
            "map_updated": True,
            "impact_scope": "小型",
        },
        {
            "notice_no": "SG-2026-005",
            "project_name": "团结花园水管维修",
            "construction_location": "团结花园北门",
            "start_date": date(2026, 6, 15),
            "end_date": date(2026, 6, 18),
            "construction_type": "水管维修",
            "temporary_detour": True,
            "detour_description": "地图未更新",
            "map_updated": False,
            "impact_scope": "小型",
        },
        {
            "notice_no": "SG-2026-005",
            "project_name": "团结花园水管维修-重复",
            "construction_location": "团结花园北门",
            "start_date": date(2026, 6, 15),
            "end_date": date(2026, 6, 18),
            "construction_type": "水管维修",
            "temporary_detour": True,
            "map_updated": False,
            "impact_scope": "小型",
        },
    ]

    result2 = import_svc.batch_import_construction_notices(
        notices_batch_2, planner, "BATCH-2026-06-06"
    )
    print(f"\n  第二批导入结果: {result2['summary']}")
    print(f"  新增: {result2['new_count']}, 历史重复: {result2['history_duplicate_count']}, 本次重复: {result2['current_batch_duplicate_count']}")

    print("\n  历史重复明细:")
    for d in result2["history_duplicates"]:
        print(f"    - {d['notice_no']}: 原批次 {d['existing_batch_no']}，{d['description']}")

    print("\n  本次重复明细:")
    for d in result2["current_batch_duplicates"]:
        print(f"    - {d['notice_no']}: {d['description']}")

    print("\n  新记录明细:")
    for n in result2["new_records"]:
        print(f"    - {n['notice_no']}: {n['project_name']}")
        if n.get("temporary_detour") and not n.get("map_updated"):
            print(f"      【注意】临时改道未同步地图，待居民复核")

    print("\n【现场样例 2】施工临时改道未同步地图 - 多种状态")
    print("-" * 80)

    detour_notices = import_svc.get_detour_unsynced_notices()
    print(f"  当前待居民复核的改道未同步记录: {len(detour_notices)} 条")
    for n in detour_notices:
        print(f"    - {n.notice_no}: {n.project_name}")
        print(f"      状态: {n.status}, 复核状态: {n.review_status}")

    print("\n  居民代表复核其中一条...")
    notice_to_review = detour_notices[0]
    reviewed = import_svc.resident_review_detour(
        notice_id=notice_to_review.id,
        approved=False,
        review_note="地图确实未更新，需先更新地图再施工",
        operator=resident_rep,
        operator_role=UserRole.RESIDENT_REP,
    )
    print(f"  复核结果: 驳回")
    print(f"  新状态: {reviewed.status}, 复核状态: {reviewed.review_status}")
    print(f"  居民意见: {reviewed.resident_review_note}")

    print("\n【现场样例 3】补看坡道记录 - 反查改前改后")
    print("-" * 80)

    notice3 = repo.get_construction_notice_by_no("SG-2026-003")
    ramp_data = {
        "ramp_location": "和平小区南门坡道入口",
        "ramp_type": "轮椅坡道",
        "has_ramp": True,
        "ramp_condition": "一般",
        "accessible": True,
        "survey_date": date(2026, 6, 7),
        "surveyor": planner,
        "construction_notice_id": notice3.id,
        "remark": "现场查勘坡道完好，但告示标注了改道",
    }
    ramp = import_svc.supplement_ramp_record(ramp_data, planner)
    print(f"  补录坡道: {ramp.ramp_location}")
    print(f"  可通行: {ramp.accessible}, 有无障碍: {ramp.has_ramp}")

    print("\n  从施工告示反查坡道记录和状态变化:")
    notice_detail = audit_svc.get_notice_change_details(notice3.id)
    for h in notice_detail:
        print(f"\n    时间: {h['timestamp']}")
        print(f"    操作: {h['operation']}, 操作人: {h['operator']}")
        print(f"    原因: {h['reason']}")
        for c in h["changes"]:
            print(f"    变更: {c['field']}: {c['before']} → {c['after']}")

    print("\n  从坡道记录反查:")
    ramp_detail = audit_svc.get_ramp_change_details(ramp.id)
    for h in ramp_detail:
        print(f"\n    时间: {h['timestamp']}")
        print(f"    操作: {h['operation']}, 操作人: {h['operator']}")
        for c in h["changes"]:
            print(f"    变更: {c['field']}: {c['before']} → {c['after']}")

    print("\n【现场样例 4】冲突检测 - 多种冲突类型")
    print("-" * 80)

    conflicts = conflict_svc.detect_conflicts(notice3.id, planner)
    print(f"  检测到 {len(conflicts)} 个冲突")
    for c in conflicts:
        print(f"\n    冲突 {c.id}:")
        for e in c.evidences:
            print(f"      - {e.description}")
            print(f"        告示值: {e.notice_value}")
            print(f"        坡道值: {e.ramp_value}")

    print("\n  小姜处理冲突（确认）:")
    resolved = conflict_svc.planner_resolve_conflict(
        conflicts[0].id,
        confirmed=True,
        planner_note="现场确认坡度超标，确实无法通行，与改道叠加影响",
        operator=planner
    )
    print(f"  决策: {resolved.planner_decision}, 备注: {resolved.planner_note}")

    print("\n【现场样例 5】点位清单 - 导出与页面一致性")
    print("-" * 80)

    point_list = point_svc.generate_point_list(planner)
    print(f"  生成点位清单 v{point_list.version}, {len(point_list.items)} 个点位")

    print("\n  验证页面展示与导出一致性:")
    consistency = point_svc.verify_display_export_consistency()
    print(f"  同一数据源: {consistency['same_source']}")
    print(f"  记录标识一致: {consistency['same_record_keys']}")
    print(f"  点位数量一致: {consistency['same_item_count']}")
    print(f"  版本号一致: {consistency['same_version']}")
    print(f"  改道记录可见性一致: {consistency['detour_visible_in_both']}")
    print(f"  总体一致: {consistency['consistent']}")

    print("\n  页面展示记录标识:")
    for k in consistency["display_record_keys"]:
        print(f"    {k}")

    print("\n  导出记录标识:")
    for k in consistency["export_record_keys"]:
        print(f"    {k}")

    print("\n  取一条记录，验证两边能追到同一条:")
    display_data = point_svc.get_point_list_for_display()
    export_data = point_svc.export_point_list()
    sample_record_key = display_data["items"][0]["record_key"]
    display_item = next(i for i in display_data["items"] if i["record_key"] == sample_record_key)
    export_item = next(i for i in export_data["items"] if i["record_key"] == sample_record_key)
    print(f"  记录标识: {sample_record_key}")
    print(f"  页面点位名称: {display_item['point_name']}")
    print(f"  导出点位名称: {export_item['point_name']}")
    print(f"  名称一致: {display_item['point_name'] == export_item['point_name']}")
    print(f"  容量状态一致: {display_item['capacity_status'] == export_item['capacity_status']}")

    print("\n【现场样例 6】系统自检 - 覆盖四大检查点")
    print("-" * 80)

    check_result = self_check_svc.run_all_checks()
    print(f"  自检通过: {check_result['passed']}")
    print(f"  问题总数: {check_result['total_issues']}")
    print(f"  摘要: {check_result['summary']}")

    for check_name, check_data in check_result["checks"].items():
        status = "✓ 通过" if check_data["passed"] else "✗ 有问题"
        print(f"\n  {check_data['name']}: {status}")
        if check_data.get("issues"):
            for issue in check_data["issues"]:
                print(f"    - [{issue['severity']}] {issue['description']}")
        else:
            print(f"    无问题")

    print("\n【现场样例 7】审计追踪 - 完整链路")
    print("-" * 80)

    transitions = audit_svc.get_status_transitions("ConstructionNotice", notice3.id)
    print(f"  施工告示 {notice3.notice_no} 状态变化轨迹:")
    for t in transitions:
        print(f"    {t['timestamp']}: {t['from_status']} → {t['to_status']}")
        print(f"      操作: {t['operation']} by {t['operator']}")
        print(f"      原因: {t['reason']}")

    history = audit_svc.get_change_summary("ConstructionNotice", notice3.id)
    print(f"\n  完整变更历史（{len(history)} 次操作）:")
    for h in history:
        print(f"    {h['timestamp']}: {h['operation']} by {h['operator']}")
        print(f"      改了: {h['what_changed']}")
        print(f"      为什么: {h['why']}")
        print(f"      影响: {h['impacted_results']}")

    print("\n" + "=" * 80)
    print("现场样例测试完成，所有场景覆盖！")
    print("=" * 80)

    return True


if __name__ == "__main__":
    test_field_samples()
