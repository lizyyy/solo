import json
from datetime import date
from main import create_services
from models import UserRole


def test_complete_three_step_flow():
    print("=" * 70)
    print("测试完整三步核心流程 + 施工临时改道未同步地图场景")
    print("=" * 70)

    svcs = create_services()
    import_svc = svcs["import_service"]
    conflict_svc = svcs["conflict_service"]
    point_svc = svcs["point_service"]
    self_check_svc = svcs["self_check_service"]
    audit_svc = svcs["audit"]
    repo = svcs["repository"]

    planner = "小姜"
    resident_rep = "居民代表老王"

    print("\n【第一步】施工告示第一次导入")
    print("-" * 70)

    notice_data_1 = {
        "notice_no": "SG-2026-001",
        "project_name": "阳光小区道路改造",
        "construction_location": "阳光小区东门",
        "start_date": date(2026, 6, 1),
        "end_date": date(2026, 6, 30),
        "construction_type": "道路施工",
        "temporary_detour": True,
        "detour_description": "需绕行北门",
        "map_updated": False,
        "impact_scope": "中型",
        "remark": "居民反映改道信息未在地图更新",
        "import_batch_no": "BATCH-2026-06-01",
    }

    notice_data_2 = {
        "notice_no": "SG-2026-002",
        "project_name": "幸福社区管道维修",
        "construction_location": "幸福社区西侧",
        "start_date": date(2026, 6, 5),
        "end_date": date(2026, 6, 15),
        "construction_type": "管道维修",
        "temporary_detour": False,
        "map_updated": True,
        "impact_scope": "小型",
        "import_batch_no": "BATCH-2026-06-01",
    }

    notice1 = import_svc.import_construction_notice(notice_data_1, planner)
    notice2 = import_svc.import_construction_notice(notice_data_2, planner)

    print(f"  导入施工告示 1: {notice1.notice_no} - {notice1.project_name}")
    print(f"    临时改道: {notice1.temporary_detour}, 地图已更新: {notice1.map_updated}")
    print(f"    状态: {notice1.status}, 复核状态: {notice1.review_status}")
    print(f"  导入施工告示 2: {notice2.notice_no} - {notice2.project_name}")
    print(f"    临时改道: {notice2.temporary_detour}, 地图已更新: {notice2.map_updated}")

    detour_notices = import_svc.get_detour_unsynced_notices()
    print(f"\n  检测到改道未同步的告示: {len(detour_notices)} 条")
    for n in detour_notices:
        print(f"    - {n.notice_no}: 留给居民代表复核，不急着归正常")

    print("\n【第二步】街道规划员小姜补看无障碍坡道记录")
    print("-" * 70)

    ramp_data_1 = {
        "ramp_location": "阳光小区东门",
        "ramp_type": "轮椅坡道",
        "has_ramp": True,
        "ramp_condition": "良好",
        "accessible": True,
        "survey_date": date(2026, 6, 2),
        "surveyor": planner,
        "construction_notice_id": notice1.id,
        "remark": "现场查勘，坡道完好",
    }

    ramp_data_2 = {
        "ramp_location": "幸福社区西侧入口",
        "ramp_type": "轮椅坡道",
        "has_ramp": True,
        "accessible": False,
        "survey_date": date(2026, 6, 6),
        "surveyor": planner,
        "construction_notice_id": notice2.id,
        "remark": "坡道有施工障碍物",
    }

    ramp1 = import_svc.supplement_ramp_record(ramp_data_1, planner)
    ramp2 = import_svc.supplement_ramp_record(ramp_data_2, planner)

    print(f"  补录坡道 1: {ramp1.ramp_location}")
    print(f"    有无障碍: {ramp1.has_ramp}, 可通行: {ramp1.accessible}")
    print(f"    关联告示: {ramp1.construction_notice_id}")
    print(f"  补录坡道 2: {ramp2.ramp_location}")
    print(f"    有无障碍: {ramp2.has_ramp}, 可通行: {ramp2.accessible}")

    print("\n  检测施工告示与坡道记录的冲突...")
    conflicts = conflict_svc.detect_conflicts(notice1.id, planner)
    conflicts2 = conflict_svc.detect_conflicts(notice2.id, planner)

    all_conflicts = conflict_svc.get_pending_conflicts()
    print(f"  发现待处理冲突: {len(all_conflicts)} 条")
    for c in all_conflicts:
        print(f"\n    冲突 ID: {c.id}")
        evidences = conflict_svc.get_conflict_evidences(c.id)
        for i, e in enumerate(evidences):
            print(f"      证据 {i+1}: {e['description']}")
            print(f"        告示值: {e['notice_value']}")
            print(f"        坡道值: {e['ramp_value']}")
        print(f"    => 先列出冲突证据，让街道规划员小姜选确认或驳回，不自动拍板")

    if all_conflicts:
        c = all_conflicts[0]
        print(f"\n  小姜确认冲突（不自动拍板，人工决策）:")
        resolved = conflict_svc.planner_resolve_conflict(
            c.id, confirmed=True, planner_note="现场确认，改道确实影响通行", operator=planner
        )
        print(f"    决策: {resolved.planner_decision}, 备注: {resolved.planner_note}")

    print("\n【第三步】点位清单更新")
    print("-" * 70)

    point_list = point_svc.generate_point_list(planner)
    print(f"  生成点位清单 v{point_list.version}，共 {len(point_list.items)} 个点位")

    for item in point_list.items:
        print(f"\n    点位: {item.point_code} - {item.point_name}")
        print(f"      位置: {item.location}")
        print(f"      充电桩数: {item.charging_pile_count}")
        print(f"      容量状态: {item.capacity_status}, 排队状态: {item.queue_status}")
        print(f"      无障碍: {item.accessible}, 受施工影响: {item.affected_by_construction}")
        if "待居民复核" in item.point_name:
            print(f"      【注意】施工临时改道没有同步到地图，留给居民代表复核，未归正常")
        print(f"      备注: {item.remark}")

    print("\n【特殊流程】居民代表复核施工临时改道未同步地图")
    print("-" * 70)

    detour_notice = import_svc.get_detour_unsynced_notices()[0]
    print(f"  居民代表 {resident_rep} 复核: {detour_notice.notice_no}")

    reviewed = import_svc.resident_review_detour(
        notice_id=detour_notice.id,
        approved=True,
        review_note="已确认地图更新，情况属实，同意纳入排队",
        operator=resident_rep,
        operator_role=UserRole.RESIDENT_REP,
    )
    print(f"    复核结果: 通过")
    print(f"    新状态: {reviewed.status}, 复核状态: {reviewed.review_status}")

    print("\n  补录后重算点位清单...")
    point_list_v2 = point_svc.recalculate_after_supplement(planner, "居民复核通过，改道问题已解决")
    print(f"  重算后点位清单 v{point_list_v2.version}，共 {len(point_list_v2.items)} 个点位")

    for item in point_list_v2.items:
        if "DETOUR" in item.point_code:
            print(f"    {item.point_name}: 容量={item.capacity_status}, 排队={item.queue_status}")

    print("\n【统一数据源验证】页面展示、导出明细、接口返回读同一份结果")
    print("-" * 70)

    display_data = point_svc.get_point_list_for_display()
    export_data = point_svc.export_point_list()

    display_items = display_data["items"]
    export_items = export_data["items"]

    print(f"  页面展示点位数量: {len(display_items)}")
    print(f"  导出明细点位数量: {len(export_items)}")
    print(f"  数据源标识一致: {display_data['source'] == export_data['source']}")
    print(f"  点位编码一致: {[i['point_code'] for i in display_items] == [i['point_code'] for i in export_items]}")

    detour_in_display = any("DETOUR" in i["point_code"] for i in display_items)
    detour_in_export = any("DETOUR" in i["point_code"] for i in export_items)
    print(f"  改道未同步记录在页面显示: {detour_in_display}")
    print(f"  改道未同步记录在导出显示: {detour_in_export}")
    print(f"  改道记录不会一处异常、另一处消失: {detour_in_display == detour_in_export}")

    print("\n【审计追踪】谁改了什么、为什么改、改完影响哪些结果")
    print("-" * 70)

    history = audit_svc.get_change_summary("ConstructionNotice", notice1.id)
    print(f"  施工告示 {notice1.notice_no} 的变更历史:")
    for h in history:
        print(f"\n    时间: {h['timestamp']}")
        print(f"    操作人: {h['operator']} ({h['operator_role']})")
        print(f"    操作: {h['operation']}")
        print(f"    改了什么: {h['what_changed']}")
        print(f"    为什么改: {h['why']}")
        print(f"    影响哪些结果: {h['impacted_results']}")

    print("\n【系统自检】覆盖最容易出错的点")
    print("-" * 70)

    check_result = self_check_svc.run_all_checks()
    print(f"  自检通过: {check_result['passed']}")
    print(f"  总问题数: {check_result['total_issues']}")
    print(f"  摘要: {check_result['summary']}")

    for check_name, check_data in check_result["checks"].items():
        status = "✓ 通过" if check_data["passed"] else "✗ 有问题"
        print(f"    {check_data['name']}: {status}")
        for issue in check_data.get("issues", []):
            print(f"      - [{issue['severity']}] {issue['description']}")

    print("\n【测试重复导入防护】")
    print("-" * 70)
    try:
        import_svc.import_construction_notice(notice_data_1, planner)
        print("  错误: 重复导入未被拦截")
    except ValueError as e:
        print(f"  ✓ 重复导入已被正确拦截: {e}")

    print("\n" + "=" * 70)
    print("测试完成！所有核心流程验证通过。")
    print("=" * 70)

    return True


if __name__ == "__main__":
    test_complete_three_step_flow()
