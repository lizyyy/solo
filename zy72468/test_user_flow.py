import sys
import json
from datetime import date
import httpx


def run_user_flow():
    print("\n" + "=" * 80)
    print("普通使用者路线复现")
    print("=" * 80)
    print("\n使用者路线:")
    print("  1. 启动项目")
    print("  2. 进入施工告示第一次导入")
    print("  3. 处理导出的明细")
    print("  4. 核对施工告示和无障碍坡道记录")
    print("  5. 尤其是施工临时改道没有同步到地图这种记录")
    print("  6. 先服务真实复核")
    print("=" * 80)

    base_url = "http://127.0.0.1:8000"
    planner = "小姜"

    print(f"\n【步骤 1】调用模块清单接口 - GET /api/v1/")
    print("-" * 80)
    try:
        with httpx.Client(base_url=base_url, timeout=10.0) as client:
            resp = client.get("/api/v1/")
            data = resp.json()
            print(f"  系统: {data['system']}")
            print(f"  版本: {data['version']}")
            print(f"  可用模块: {len(data['modules'])} 个")
            for m in data['modules'][:5]:
                print(f"    - {m['name']}: {m['method']} {m['endpoint']}")
    except Exception as e:
        print(f"  ⚠️  服务未启动，直接运行测试模式: {e}")
        print("  使用本地服务模式运行完整流程...\n")
        return run_user_flow_local()

    print(f"\n【步骤 2】施工告示第一次导入 - POST /api/v1/notices/import")
    print("-" * 80)

    import_data = {
        "notices": [
            {
                "notice_no": "SG-2026-010",
                "project_name": "阳光小区充电桩扩容",
                "construction_location": "阳光小区北区",
                "start_date": "2026-06-15",
                "end_date": "2026-06-25",
                "construction_type": "电力施工",
                "temporary_detour": True,
                "detour_description": "需绕行南区",
                "map_updated": False,
                "impact_scope": "大型",
                "remark": "居民反馈地图上还是旧路线"
            },
            {
                "notice_no": "SG-2026-011",
                "project_name": "幸福社区新增充电桩",
                "construction_location": "幸福社区东侧",
                "start_date": "2026-06-20",
                "end_date": "2026-06-30",
                "construction_type": "基础施工",
                "temporary_detour": False,
                "map_updated": True,
                "impact_scope": "中型"
            },
            {
                "notice_no": "SG-2026-010",
                "project_name": "阳光小区充电桩扩容-重复",
                "construction_location": "阳光小区北区",
                "start_date": "2026-06-15",
                "end_date": "2026-06-25",
                "construction_type": "电力施工",
                "temporary_detour": True,
                "map_updated": False,
                "impact_scope": "大型"
            }
        ],
        "import_batch_no": "BATCH-USER-2026-06-12",
        "operator": planner
    }

    with httpx.Client(base_url=base_url, timeout=10.0) as client:
        resp = client.post("/api/v1/notices/import", json=import_data)
        result = resp.json()

    print(f"  导入批次: {result['import_batch_no']}")
    print(f"  总数: {result['total_input']} 条")
    print(f"  新增: {result['new_count']} 条")
    print(f"  历史重复: {result['history_duplicate_count']} 条")
    print(f"  本次重复: {result['current_batch_duplicate_count']} 条")
    print(f"  摘要: {result['summary']}")

    if result['new_records']:
        notice_id = result['new_records'][0]['id']
        notice_no = result['new_records'][0]['notice_no']
        print(f"\n  新记录 ID: {notice_id}")
        print(f"  新记录编号: {notice_no}")

    print(f"\n【步骤 3】处理导出的明细 - GET /api/v1/notices")
    print("-" * 80)

    with httpx.Client(base_url=base_url, timeout=10.0) as client:
        resp = client.get("/api/v1/notices")
        notices = resp.json()

    print(f"  总施工告示数: {notices['total']}")
    for n in notices['items']:
        detour_marker = "⚠️ 改道未同步" if n['temporary_detour'] and not n['map_updated'] else "✓ 正常"
        print(f"    {n['notice_no']}: {n['project_name']}")
        print(f"      记录标识: {n['record_key']}")
        print(f"      状态: {n['status']}, 复核: {n['review_status']}")
        print(f"      改道状态: {detour_marker}")

    print(f"\n【步骤 4】导出明细 - GET /api/v1/point-list/display")
    print("-" * 80)

    with httpx.Client(base_url=base_url, timeout=10.0) as client:
        resp = client.get("/api/v1/point-list/display")
        display_data = resp.json()

    print(f"  点位清单版本: v{display_data['version']}")
    print(f"  数据源: {display_data['source']}")
    print(f"  点位数量: {len(display_data['items'])}")
    for item in display_data['items']:
        print(f"    {item['point_code']}: {item['point_name']}")
        print(f"      记录标识: {item['record_key']}")
        print(f"      容量: {item['capacity_status']}, 排队: {item['queue_status']}")
        if item.get('construction_notices'):
            for cn in item['construction_notices']:
                if cn['temporary_detour'] and not cn['map_updated']:
                    print(f"      ⚠️  关联施工告示改道未同步: {cn['notice_no']}")
                    print(f"         复核状态: {cn['review_status']}")

    print(f"\n【步骤 5】核对施工告示详情 - GET /api/v1/notices/{notice_id}")
    print("-" * 80)

    with httpx.Client(base_url=base_url, timeout=10.0) as client:
        resp = client.get(f"/api/v1/notices/{notice_id}")
        detail = resp.json()

    print(f"  记录标识: {detail['record_key']}")
    print(f"  当前状态: {detail['current']['status']}")
    print(f"  复核状态: {detail['current']['review_status']}")
    print(f"  临时改道: {detail['current']['temporary_detour']}")
    print(f"  地图已更新: {detail['current']['map_updated']}")

    print(f"\n  变更历史（{len(detail['change_history'])} 次）:")
    for h in detail['change_history']:
        print(f"    {h['timestamp']}: {h['operation']} by {h['operator']}")
        for c in h['changes']:
            print(f"      {c['field']}: {c['before']} → {c['after']}")
        print(f"      原因: {h['reason']}")

    print(f"\n  状态变化轨迹:")
    for t in detail['status_transitions']:
        print(f"    {t['timestamp']}: {t['from_status']} → {t['to_status']}")

    print(f"\n【步骤 6】先服务真实复核 - GET /api/v1/notices/detour-unsynced")
    print("-" * 80)

    with httpx.Client(base_url=base_url, timeout=10.0) as client:
        resp = client.get("/api/v1/notices/detour-unsynced")
        detour_data = resp.json()

    print(f"  待复核改道未同步: {detour_data['total']} 条")
    print(f"  操作要求: {detour_data['action_required']}")
    for n in detour_data['items']:
        print(f"    {n['notice_no']}: {n['project_name']}")
        print(f"      记录标识: {n['record_key']}")
        print(f"      改道说明: {n['detour_description']}")
        print(f"      复核状态: {n['review_status']}")

    print(f"\n【步骤 7】验证导出和页面一致性 - GET /api/v1/self-check")
    print("-" * 80)

    with httpx.Client(base_url=base_url, timeout=10.0) as client:
        resp = client.get("/api/v1/self-check")
        check_result = resp.json()

    print(f"  自检通过: {check_result['passed']}")
    for name, check in check_result['checks'].items():
        status = "✓" if check['passed'] else "✗"
        print(f"  {status} {check['name']}: {len(check.get('issues', []))} 个问题")

    print(f"\n【步骤 8】核对无障碍坡道记录 - GET /api/v1/ramps/supplement")
    print("-" * 80)

    ramp_data = {
        "ramp_location": "阳光小区北区",
        "ramp_type": "轮椅坡道",
        "has_ramp": True,
        "ramp_condition": "良好",
        "accessible": True,
        "survey_date": "2026-06-12",
        "surveyor": planner,
        "construction_notice_id": notice_id,
        "remark": "现场查勘，坡道完好",
        "operator": planner
    }

    with httpx.Client(base_url=base_url, timeout=10.0) as client:
        resp = client.post("/api/v1/ramps/supplement", json=ramp_data)
        ramp = resp.json()

    print(f"  坡道记录 ID: {ramp['id']}")
    print(f"  记录标识: {ramp['record_key']}")
    print(f"  匹配告示: {ramp['matched_notice']}")
    print(f"  可通行: {ramp['accessible']}")

    print(f"\n  反查坡道记录变更历史 - GET /api/v1/ramps/{ramp['id']}")
    with httpx.Client(base_url=base_url, timeout=10.0) as client:
        resp = client.get(f"/api/v1/ramps/{ramp['id']}")
        ramp_detail = resp.json()

    print(f"  当前状态: {ramp_detail['current']['status']}")
    print(f"  变更历史:")
    for h in ramp_detail['change_history']:
        print(f"    {h['timestamp']}: {h['operation']} by {h['operator']}")
        for c in h['changes']:
            print(f"      {c['field']}: {c['before']} → {c['after']}")

    print(f"\n【步骤 9】点位清单更新 - POST /api/v1/point-list/generate")
    print("-" * 80)

    with httpx.Client(base_url=base_url, timeout=10.0) as client:
        resp = client.post("/api/v1/point-list/generate", json={"operator": planner})
        pl = resp.json()

    print(f"  点位清单版本: v{pl['version']}")
    print(f"  记录标识: {pl['record_key']}")
    print(f"  点位数量: {pl['item_count']}")
    print(f"  来自告示: {pl['generated_from_notices']} 条")
    print(f"  来自坡道: {pl['generated_from_ramps']} 条")

    print(f"\n【步骤 10】最终核对导出与页面一致性 - GET /api/v1/point-list/verify-consistency")
    print("-" * 80)

    with httpx.Client(base_url=base_url, timeout=10.0) as client:
        resp = client.get("/api/v1/point-list/verify-consistency")
        verify = resp.json()

    print(f"  同一数据源: {verify['same_source']}")
    print(f"  记录标识一致: {verify['same_record_keys']}")
    print(f"  点位数量一致: {verify['same_item_count']}")
    print(f"  改道记录可见性一致: {verify['detour_visible_in_both']}")
    print(f"  总体一致: {verify['consistent']}")

    print(f"\n  页面记录标识:")
    for k in verify['display_record_keys']:
        print(f"    {k}")
    print(f"\n  导出记录标识:")
    for k in verify['export_record_keys']:
        print(f"    {k}")

    print("\n" + "=" * 80)
    print("使用者路线复现完成！")
    print("=" * 80)

    return True


def run_user_flow_local():
    print("\n" + "=" * 80)
    print("本地测试模式 - 使用者路线复现（服务未启动，使用本地服务直接调用")
    print("=" * 80)

    from main import create_services
    from models import UserRole

    svcs = create_services()
    import_svc = svcs["import_service"]
    point_svc = svcs["point_service"]
    self_check_svc = svcs["self_check_service"]
    audit_svc = svcs["audit"]
    repo = svcs["repository"]

    planner = "小姜"

    print(f"\n【步骤 1】查看系统模块清单")
    print("-" * 80)

    modules = [
        "POST /api/v1/notices/import - 施工告示第一次导入",
        "GET  /api/v1/notices - 施工告示列表",
        "GET  /api/v1/notices/{id} - 施工告示详情+变更历史",
        "POST /api/v1/ramps/supplement - 补看无障碍坡道记录",
        "GET  /api/v1/point-list/display - 点位清单（页面展示）",
        "GET  /api/v1/point-list/export - 点位清单导出",
        "GET  /api/v1/self-check - 系统自检",
        "GET  /api/v1/audit/{entity}/{id} - 变更历史审计",
    ]
    print(f"  系统: 社区充电桩容量排队系统")
    print(f"  版本: 1.0.0")
    print(f"  可用模块: {len(modules)} 个")
    for m in modules:
        print(f"    {m}")

    print(f"\n【步骤 2】施工告示第一次导入（批量导入，含本次重复）")
    print("-" * 80)

    notices_batch = [
        {
            "notice_no": "SG-2026-010",
            "project_name": "阳光小区充电桩扩容",
            "construction_location": "阳光小区北区",
            "start_date": date(2026, 6, 15),
            "end_date": date(2026, 6, 25),
            "construction_type": "电力施工",
            "temporary_detour": True,
            "detour_description": "需绕行南区",
            "map_updated": False,
            "impact_scope": "大型",
            "remark": "居民反馈地图上还是旧路线",
            "import_batch_no": "BATCH-USER-2026-06-12",
        },
        {
            "notice_no": "SG-2026-011",
            "project_name": "幸福社区新增充电桩",
            "construction_location": "幸福社区东侧",
            "start_date": date(2026, 6, 20),
            "end_date": date(2026, 6, 30),
            "construction_type": "基础施工",
            "temporary_detour": False,
            "map_updated": True,
            "impact_scope": "中型",
            "import_batch_no": "BATCH-USER-2026-06-12",
        },
        {
            "notice_no": "SG-2026-010",
            "project_name": "阳光小区充电桩扩容-重复",
            "construction_location": "阳光小区北区",
            "start_date": date(2026, 6, 15),
            "end_date": date(2026, 6, 25),
            "construction_type": "电力施工",
            "temporary_detour": True,
            "map_updated": False,
            "impact_scope": "大型",
            "import_batch_no": "BATCH-USER-2026-06-12",
        },
    ]

    result = import_svc.batch_import_construction_notices(
        notices_batch, planner, "BATCH-USER-2026-06-12"
    )

    print(f"  导入批次: {result['import_batch_no']}")
    print(f"  总数: {result['total_input']} 条")
    print(f"  新增: {result['new_count']} 条")
    print(f"  历史重复: {result['history_duplicate_count']} 条")
    print(f"  本次重复: {result['current_batch_duplicate_count']} 条")
    print(f"  摘要: {result['summary']}")

    print("\n  明细区分:")
    for n in result["new_records"]:
        print(f"    [新记录] {n['notice_no']}: {n['project_name']}")
        if n['temporary_detour'] and not n['map_updated']:
            print(f"      ⚠️  施工临时改道没有同步到地图，待居民复核")
    for d in result["history_duplicates"]:
        print(f"    [历史重复] {d['notice_no']}: {d['description']}")
    for d in result["current_batch_duplicates"]:
        print(f"    [本次重复] {d['notice_no']}: {d['description']}")

    notice_id = result["new_records"][0]["id"]
    notice_no = result["new_records"][0]["notice_no"]
    print(f"\n  新记录 ID: {notice_id}")
    print(f"  新记录编号: {notice_no}")

    print(f"\n【步骤 3】处理导出的明细 - 施工告示列表")
    print("-" * 80)

    notices = repo.list_construction_notices()
    print(f"  总施工告示数: {len(notices)}")
    for n in notices:
        detour_marker = "⚠️ 改道未同步" if n.temporary_detour and not n.map_updated else "✓ 正常"
        print(f"    {n.notice_no}: {n.project_name}")
        print(f"      记录标识: NOTICE-{n.id}")
        print(f"      状态: {n.status}, 复核: {n.review_status}")
        print(f"      改道状态: {detour_marker}")
        print(f"      导入批次: {n.import_batch_no}")

    print(f"\n【步骤 4】点位清单（页面展示用）")
    print("-" * 80)

    point_list = point_svc.generate_point_list(planner)
    display_data = point_svc.get_point_list_for_display()

    print(f"  点位清单版本: v{display_data['version']}")
    print(f"  数据源: {display_data['source']}")
    print(f"  点位数量: {len(display_data['items'])}")
    for item in display_data['items']:
        print(f"    {item['point_code']}: {item['point_name']}")
        print(f"      记录标识: {item['record_key']}")
        print(f"      容量: {item['capacity_status']}, 排队: {item['queue_status']}")
        if item.get('construction_notices'):
            for cn in item['construction_notices']:
                if cn['temporary_detour'] and not cn['map_updated']:
                    print(f"      ⚠️  关联施工告示改道未同步: {cn['notice_no']}")
                    print(f"         复核状态: {cn['review_status']}")

    print(f"\n【步骤 5】核对施工告示详情 - 反查改前改后和状态变化")
    print("-" * 80)

    notice = repo.get_construction_notice(notice_id)
    change_details = audit_svc.get_notice_change_details(notice_id)
    status_transitions = audit_svc.get_status_transitions("ConstructionNotice", notice_id)

    print(f"  记录标识: NOTICE-{notice_id}")
    print(f"  当前状态: {notice.status}")
    print(f"  复核状态: {notice.review_status}")
    print(f"  临时改道: {notice.temporary_detour}")
    print(f"  地图已更新: {notice.map_updated}")

    print(f"\n  变更历史（{len(change_details)} 次）:")
    for h in change_details:
        print(f"    {h['timestamp']}: {h['operation']} by {h['operator']}")
        for c in h['changes']:
            print(f"      {c['field']}: {c['before']} → {c['after']}")
        print(f"      原因: {h['reason']}")
        print(f"      影响: {h['impacted_results']}")

    print(f"\n  状态变化轨迹:")
    for t in status_transitions:
        print(f"    {t['timestamp']}: {t['from_status']} → {t['to_status']}")
        print(f"      操作: {t['operation']} by {t['operator']}")
        print(f"      原因: {t['reason']}")

    print(f"\n【步骤 6】先服务真实复核 - 改道未同步列表")
    print("-" * 80)

    detour_notices = import_svc.get_detour_unsynced_notices()
    print(f"  待复核改道未同步: {len(detour_notices)} 条")
    print(f"  操作要求: 这些记录待居民代表复核，暂不纳入正常排队")
    for n in detour_notices:
        print(f"    {n.notice_no}: {n.project_name}")
        print(f"      记录标识: NOTICE-{n.id}")
        print(f"      改道说明: {n.detour_description}")
        print(f"      复核状态: {n.review_status}")

    print(f"\n【步骤 7】系统自检 - 覆盖四大检查点")
    print("-" * 80)

    check_result = self_check_svc.run_all_checks()
    print(f"  自检通过: {check_result['passed']}")
    for name, check in check_result['checks'].items():
        status = "✓" if check['passed'] else "✗"
        print(f"  {status} {check['name']}: {len(check.get('issues', []))} 个问题")
        for issue in check.get('issues', []):
            print(f"    - [{issue['severity']}] {issue['description']}")

    print(f"\n【步骤 8】补看无障碍坡道记录")
    print("-" * 80)

    ramp_data = {
        "ramp_location": "阳光小区北区",
        "ramp_type": "轮椅坡道",
        "has_ramp": True,
        "ramp_condition": "良好",
        "accessible": True,
        "survey_date": date(2026, 6, 12),
        "surveyor": planner,
        "construction_notice_id": notice_id,
        "remark": "现场查勘，坡道完好",
    }

    ramp = import_svc.supplement_ramp_record(ramp_data, planner)

    print(f"  坡道记录 ID: {ramp.id}")
    print(f"  记录标识: RAMP-{ramp.id}")
    print(f"  匹配告示: {ramp.matched_notice}")
    print(f"  可通行: {ramp.accessible}")

    print(f"\n  反查坡道记录 - 改前改后和状态变化")
    ramp_details = audit_svc.get_ramp_change_details(ramp.id)
    ramp_transitions = audit_svc.get_status_transitions("RampRecord", ramp.id)

    print(f"  当前状态: {ramp.status}")
    print(f"  变更历史:")
    for h in ramp_details:
        print(f"    {h['timestamp']}: {h['operation']} by {h['operator']}")
        for c in h['changes']:
            print(f"      {c['field']}: {c['before']} → {c['after']}")
        print(f"      原因: {h['reason']}")

    print(f"\n【步骤 9】点位清单更新（第三步）")
    print("-" * 80)

    point_list_v2 = point_svc.generate_point_list(planner)

    print(f"  点位清单版本: v{point_list_v2.version}")
    print(f"  记录标识: POINT-LIST-{point_list_v2.id}")
    print(f"  点位数量: {len(point_list_v2.items)}")

    print(f"\n【步骤 10】核对导出与页面一致性")
    print("-" * 80)

    verify = point_svc.verify_display_export_consistency()

    print(f"  同一数据源: {verify['same_source']}")
    print(f"  记录标识一致: {verify['same_record_keys']}")
    print(f"  点位数量一致: {verify['same_item_count']}")
    print(f"  改道记录可见性一致: {verify['detour_visible_in_both']}")
    print(f"  总体一致: {verify['consistent']}")

    print(f"\n  页面和导出记录标识一致，两边都能追到同一条记录:")
    display = point_svc.get_point_list_for_display()
    export = point_svc.export_point_list()
    for i, (d_item, e_item) in enumerate(zip(display['items'], export['items']), 1):
        print(f"    {i}. 记录标识: {d_item['record_key']}")
        print(f"       页面点位名称: {d_item['point_name']}")
        print(f"       导出点位名称: {e_item['point_name']}")
        print(f"       两边一致: {d_item['point_name'] == e_item['point_name']}")

    print("\n" + "=" * 80)
    print("使用者路线复现完成！")
    print("=" * 80)
    print("\n启动服务命令: python3 main.py")
    print("访问 API 文档: http://127.0.0.1:8000/docs")
    print("=" * 80)

    return True


if __name__ == "__main__":
    try:
        run_user_flow()
    except Exception as e:
        print(f"\n⚠️  接口调用失败，切换到本地测试模式: {e}")
        run_user_flow_local()
