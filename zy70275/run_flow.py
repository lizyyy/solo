#!/usr/bin/env python3
"""
从空数据走到最终报表的完整演示脚本
"""
import sys
import time
from datetime import datetime, timedelta

try:
    import httpx
except ImportError:
    print("请先安装依赖: pip install -r requirements.txt")
    sys.exit(1)

BASE_URL = "http://127.0.0.1:8000"

now = datetime.now()
hour = now + timedelta(hours=1)
two_hour = now + timedelta(hours=2)
three_hour = now + timedelta(hours=3)
four_hour = now + timedelta(hours=4)

client = httpx.Client(timeout=10.0)

print("=" * 70)
print("  从零数据到最终报表 - 完整路径演示")
print("=" * 70)
print()

try:
    print("[阶段 0] 初始状态")
    print("-" * 70)
    resp = client.get(f"{BASE_URL}/api/reports/dashboard")
    dash = resp.json()
    print(f"  车位总数: {dash['overview']['total_spots']}")
    print(f"  已用车位: {dash['overview']['utilized_spots']}")
    print(f"  今日预约: {dash['today_stats']['total']}")
    print()

    print("[阶段 1] 访客登记")
    print("-" * 70)
    plate1 = "京K-演示A-001"
    plate2 = "京K-演示B-002"

    v1 = client.post(f"{BASE_URL}/api/visitors", json={
        "name": "陈总", "company": "星辰科技", "phone": "13988881111",
        "license_plate": plate1, "id_card": "110101199001011234"
    }).json()
    print(f"  访客A登记完成: {v1['name']} ({v1['company']}), 车牌: {plate1}")

    v2 = client.post(f"{BASE_URL}/api/visitors", json={
        "name": "刘经理", "company": "云帆集团", "phone": "13988882222",
        "license_plate": plate2, "id_card": "110101199002022345"
    }).json()
    print(f"  访客B登记完成: {v2['name']} ({v2['company']}), 车牌: {plate2}")
    print()

    print("[阶段 2] 会议申请")
    print("-" * 70)
    m1 = client.post(f"{BASE_URL}/api/meetings", json={
        "visitor_id": v1["id"], "host_name": "王主管", "host_department": "技术部",
        "meeting_room": "会议室B201", "purpose": "技术方案评审",
        "scheduled_start": hour.isoformat(), "scheduled_end": two_hour.isoformat()
    }).json()
    print(f"  会议A申请: {m1['purpose']}, 时段: {m1['scheduled_start'][:19]} ~ {m1['scheduled_end'][:19]}, 状态: {m1['status']}")

    m2 = client.post(f"{BASE_URL}/api/meetings", json={
        "visitor_id": v2["id"], "host_name": "张总监", "host_department": "业务部",
        "meeting_room": "会议室A302", "purpose": "年度合同续签",
        "scheduled_start": two_hour.isoformat(), "scheduled_end": three_hour.isoformat()
    }).json()
    print(f"  会议B申请: {m2['purpose']}, 时段: {m2['scheduled_start'][:19]} ~ {m2['scheduled_end'][:19]}, 状态: {m2['status']}")
    print()

    print("[阶段 3] 审批")
    print("-" * 70)
    m1 = client.post(f"{BASE_URL}/api/meetings/{m1['id']}/approve", json={
        "approve": True, "note": "资料齐全，同意"
    }).json()
    print(f"  会议A审批完成: 状态={m1['status']}")

    m2 = client.post(f"{BASE_URL}/api/meetings/{m2['id']}/approve", json={
        "approve": True, "note": "重要客户，优先安排"
    }).json()
    print(f"  会议B审批完成: 状态={m2['status']}")
    print()

    print("[阶段 4] 车位锁定（系统自动分配并锁定30分钟）")
    print("-" * 70)
    r1 = client.post(f"{BASE_URL}/api/parking-reservations", json={
        "meeting_id": m1["id"], "source_record": "WEB-ORDER-001"
    }).json()
    print(f"  预约A锁定: 车位={r1['spot_id']}, 状态={r1['status']}, 锁定至={r1['lock_expires_at'][:19]}")

    r2 = client.post(f"{BASE_URL}/api/parking-reservations", json={
        "meeting_id": m2["id"], "source_record": "WEB-ORDER-002"
    }).json()
    print(f"  预约B锁定: 车位={r2['spot_id']}, 状态={r2['status']}, 锁定至={r2['lock_expires_at'][:19]}")
    print()

    print("[阶段 5] 确认预约")
    print("-" * 70)
    r1 = client.post(f"{BASE_URL}/api/parking-reservations/{r1['id']}/confirm").json()
    print(f"  预约A确认: 状态={r1['status']}")

    r2 = client.post(f"{BASE_URL}/api/parking-reservations/{r2['id']}/confirm").json()
    print(f"  预约B确认: 状态={r2['status']}")
    print()

    print("[阶段 6] A尝试延时 - 会占用B的车位，被拒绝")
    print("-" * 70)
    try:
        client.post(f"{BASE_URL}/api/parking-reservations/{r1['id']}/extend", json={
            "reservation_id": r1["id"], "minutes": 60, "reason": "评审超时"
        })
        print("  居然成功了？这是BUG！")
    except Exception:
        pass
    resp = client.post(f"{BASE_URL}/api/parking-reservations/{r1['id']}/extend", json={
        "reservation_id": r1["id"], "minutes": 60, "reason": "评审超时"
    })
    if resp.status_code == 400:
        data = resp.json()
        if data.get("code") == "EXTENSION_CONFLICT":
            print(f"  A延时请求被拒绝: {data['error']}")
            print(f"  原因: 后续预约已占用该车位")
        else:
            print(f"  其他错误: {data}")
    else:
        print(f"  延时结果: {resp.status_code}")
    print()

    print("[阶段 7] 入场 / 离场")
    print("-" * 70)
    r1 = client.post(f"{BASE_URL}/api/parking-reservations/{r1['id']}/check-in").json()
    print(f"  A入场: 状态={r1['status']}, 实际入场={r1['actual_start'][:19]}")

    r1 = client.post(f"{BASE_URL}/api/parking-reservations/{r1['id']}/check-out").json()
    print(f"  A离场: 状态={r1['status']}, 实际离场={r1['actual_end'][:19]}")

    r2 = client.post(f"{BASE_URL}/api/parking-reservations/{r2['id']}/check-in").json()
    print(f"  B入场: 状态={r2['status']}")

    print()
    print("[阶段 8] 现在查看看板")
    print("-" * 70)
    resp = client.get(f"{BASE_URL}/api/reports/dashboard")
    dash = resp.json()
    print(f"  日期: {dash['date']}")
    print(f"  车位总数: {dash['overview']['total_spots']}")
    print(f"  已用车位: {dash['overview']['utilized_spots']} (B正在使用)")
    print(f"  使用率: {dash['overview']['utilization_rate'] * 100:.1f}%")
    print(f"  今日预约: {dash['today_stats']['total']}")
    print(f"  按状态: {dash['today_stats']['by_status']}")
    print(f"  活跃预约: {len(dash['active_reservations'])} 笔")
    print()

    print("[阶段 9] 按会议维度复核 (可导出报表)")
    print("-" * 70)
    report_a = client.get(f"{BASE_URL}/api/reports/by-meeting/{m1['id']}").json()
    print("  === 会议A复核报告 ===")
    print(f"  会议: {report_a['meeting']['host_name']} - {report_a['meeting']['purpose']}")
    print(f"  访客: {report_a['visitor']['name']} ({report_a['visitor']['company']})")
    print(f"  车牌: {report_a['visitor']['license_plate']}")
    print(f"  预约数: {len(report_a['reservations'])}")
    for r in report_a['reservations']:
        print(f"    - 预约{r['id']}: 状态={r['status']}, 车位={r['spot_id']}")
        print(f"      计划: {r['scheduled_start'][:19]} ~ {r['scheduled_end'][:19]}")
        print(f"      实际: {r['actual_start'][:19] if r['actual_start'] else '-'} ~ {r['actual_end'][:19] if r['actual_end'] else '-'}")
        print(f"      来源: {r['source_record']}")
    print()

    report_b = client.get(f"{BASE_URL}/api/reports/by-meeting/{m2['id']}").json()
    print("  === 会议B复核报告 ===")
    print(f"  会议: {report_b['meeting']['host_name']} - {report_b['meeting']['purpose']}")
    print(f"  访客: {report_b['visitor']['name']} ({report_b['visitor']['company']})")
    print(f"  车牌一致性: {'通过' if report_b['review_summary']['license_plate_match'] else '失败'}")
    print(f"  状态: {report_b['reservations'][0]['status']} (正在使用)")
    print()

    print("[阶段 10] B离场，最终看板状态")
    print("-" * 70)
    r2 = client.post(f"{BASE_URL}/api/parking-reservations/{r2['id']}/check-out").json()
    print(f"  B离场: 状态={r2['status']}")

    resp = client.get(f"{BASE_URL}/api/reports/dashboard")
    dash = resp.json()
    print(f"  最终看板:")
    print(f"  今日预约: {dash['today_stats']['total']}")
    print(f"  已完成: {dash['today_stats']['by_status']['completed']}")
    print(f"  活跃预约: {len(dash['active_reservations'])} (应为0)")
    print(f"  使用率: {dash['overview']['utilization_rate'] * 100:.1f}%")
    print()

    print("=" * 70)
    print("  完整路径完成")
    print("=" * 70)
    print()
    print("  走完的流程:")
    print("  空数据 → 访客登记 → 会议申请 → 审批 → 车位锁定 → 确认 → 入场")
    print("           → 尝试延时(因冲突被拒) → 离场 → 看板 → 会议报表")
    print()
    print("  可导出的数据结构:")
    print("  1. GET /api/reports/dashboard - 总览看板(大屏)")
    print("  2. GET /api/reports/by-meeting/{id} - 单会议完整记录(可做复核报表)")
    print("  3. 各状态计数可直接用于统计图表")
    print()

finally:
    client.close()
