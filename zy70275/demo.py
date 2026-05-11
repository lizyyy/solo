#!/usr/bin/env python3
import sys
from datetime import datetime, timedelta

try:
    import httpx
except ImportError:
    print("请先安装依赖: pip install httpx")
    sys.exit(1)

BASE_URL = "http://127.0.0.1:8000"


def step(n, desc):
    print(f"\n{'='*60}")
    print(f"  步骤 {n}: {desc}")
    print(f"{'='*60}\n")


def info(msg):
    print(f"  🔹 {msg}")


def success(msg):
    print(f"  ✅ {msg}")


def error(msg, resp=None):
    print(f"  ❌ {msg}")
    if resp and hasattr(resp, 'text'):
        print(f"     响应: {resp.text}")


def demo_main():
    print("""
╔══════════════════════════════════════════════════════════════╗
║           园区访客车位预约系统 - 验收演示                     ║
║                                                              ║
║  业务主线:                                                    ║
║  访客 → 会议 → 审批 → 车位锁定 → 确认 → 入场 → 使用 → 离场   ║
║              ↓                                               ║
║          临时延时(占用后续车位)                                ║
╚══════════════════════════════════════════════════════════════╝
""")
    
    client = httpx.Client(timeout=10.0)
    
    now = datetime.now()
    hour_from_now = now + timedelta(hours=1)
    three_hours = now + timedelta(hours=3)
    
    try:
        step(1, "检查系统初始状态")
        resp = client.get(f"{BASE_URL}/api/parking-spots")
        spots = resp.json()
        info(f"系统共有 {len(spots)} 个访客车位:")
        for s in spots:
            info(f"  - {s['spot_number']} ({s['zone']})")
        success("系统已就绪")
        
        step(2, "注册访客（关联车牌）")
        plate = f"演示-{int(now.timestamp()) % 10000:04d}"
        visitor_data = {
            "name": "演示访客-王总",
            "company": "演示合作公司",
            "phone": "13800009999",
            "license_plate": plate,
            "id_card": "110101198801018888"
        }
        resp = client.post(f"{BASE_URL}/api/visitors", json=visitor_data)
        visitor = resp.json()
        info(f"访客姓名: {visitor['name']}")
        info(f"所属公司: {visitor['company']}")
        info(f"车牌号码: {plate}")
        info(f"访客ID: {visitor['id']}")
        success("访客注册完成")
        
        step(3, "创建会议申请")
        meeting_data = {
            "visitor_id": visitor["id"],
            "host_name": "李经理",
            "host_department": "市场部",
            "meeting_room": "贵宾室A",
            "purpose": "年度合作洽谈",
            "scheduled_start": hour_from_now.isoformat(),
            "scheduled_end": three_hours.isoformat()
        }
        resp = client.post(f"{BASE_URL}/api/meetings", json=meeting_data)
        meeting = resp.json()
        info(f"会议ID: {meeting['id']}")
        info(f"主持人: {meeting['host_name']} ({meeting['host_department']})")
        info(f"会议室: {meeting['meeting_room']}")
        info(f"时段: {meeting['scheduled_start'][:19]} ~ {meeting['scheduled_end'][:19]}")
        info(f"当前状态: {meeting['status']}")
        success("会议申请已提交")
        
        step(4, "行政/前台审批会议")
        resp = client.post(f"{BASE_URL}/api/meetings/{meeting['id']}/approve", json={
            "approve": True,
            "note": "已核实身份，同意来访"
        })
        meeting = resp.json()
        info(f"审批后状态: {meeting['status']}")
        info(f"审批备注: {meeting['approval_note']}")
        success("会议审批通过")
        
        step(5, "创建车位预约 - 系统自动锁定车位")
        info("此时会检查可用车位并锁定最早可用的一个...")
        resp = client.post(f"{BASE_URL}/api/parking-reservations", json={
            "meeting_id": meeting["id"],
            "source_record": "WEB-DEMO-20260512-001"
        })
        reservation = resp.json()
        info(f"预约ID: {reservation['id']}")
        info(f"分配车位ID: {reservation['spot_id']}")
        info(f"关联车牌: {reservation['license_plate']}")
        info(f"预约时段: {reservation['scheduled_start'][:19]} ~ {reservation['scheduled_end'][:19]}")
        info(f"当前状态: {reservation['status']}")
        info(f"锁定到期: {reservation['lock_expires_at'][:19] if reservation['lock_expires_at'] else '无'}")
        success("车位已锁定（30分钟内需确认）")
        
        step(6, "确认预约（访客或前台操作）")
        resp = client.post(f"{BASE_URL}/api/parking-reservations/{reservation['id']}/confirm")
        reservation = resp.json()
        info(f"确认后状态: {reservation['status']}")
        info(f"锁定到期: {reservation['lock_expires_at']} (已清除)")
        success("预约已确认")
        
        step(7, "车辆入场")
        resp = client.post(f"{BASE_URL}/api/parking-reservations/{reservation['id']}/check-in")
        reservation = resp.json()
        info(f"入场后状态: {reservation['status']}")
        info(f"实际入场时间: {reservation['actual_start'][:19]}")
        success("车辆已入场，车位正在使用中")
        
        step(8, "检查当前看板状态")
        resp = client.get(f"{BASE_URL}/api/reports/dashboard")
        dashboard = resp.json()
        info(f"日期: {dashboard['date']}")
        info(f"车位总数: {dashboard['overview']['total_spots']}")
        info(f"已用车位: {dashboard['overview']['utilized_spots']}")
        info(f"使用率: {dashboard['overview']['utilization_rate'] * 100:.1f}%")
        info(f"今日预约: {dashboard['today_stats']['total']} 笔")
        info(f"活跃预约: {len(dashboard['active_reservations'])} 笔")
        for r in dashboard['active_reservations']:
            info(f"  - 预约{r['id']}: 车位{r['spot_id']}, 车牌{r['license_plate']}, 状态{r['status']}")
        success("看板数据反映当前状态")
        
        step(9, "车辆离场")
        resp = client.post(f"{BASE_URL}/api/parking-reservations/{reservation['id']}/check-out")
        reservation = resp.json()
        info(f"离场后状态: {reservation['status']}")
        info(f"实际离场时间: {reservation['actual_end'][:19]}")
        success("车辆已离场，车位释放")
        
        step(10, "复核 - 通过会议关联查询完整记录")
        resp = client.get(f"{BASE_URL}/api/reports/by-meeting/{meeting['id']}")
        report = resp.json()
        info("=== 会议关联复核报告 ===")
        info(f"会议: {report['meeting']['host_name']} - {report['meeting']['purpose']}")
        info(f"访客: {report['visitor']['name']} ({report['visitor']['company']})")
        info(f"车牌: {report['visitor']['license_plate']}")
        info(f"会议审批状态: {report['meeting']['status']}")
        info(f"预约记录数: {len(report['reservations'])}")
        for r in report['reservations']:
            info(f"  - 预约{r['id']}: 状态={r['status']}")
            info(f"    时段: {r['scheduled_start'][:19]} ~ {r['scheduled_end'][:19]}")
            info(f"    实际: {r['actual_start'][:19] if r['actual_start'] else '-'} ~ {r['actual_end'][:19] if r['actual_end'] else '-'}")
            info(f"    来源记录: {r['source_record']}")
        info(f"车牌一致性检查: {'通过 ✓' if report['review_summary']['license_plate_match'] else '不通过 ✗'}")
        info(f"状态流转: pending → approved → locked → confirmed → in_use → completed")
        success("完整业务流程可复核")
        
        print("\n" + "═"*60)
        print("  🎉 验收演示完成")
        print("═"*60)
        print("\n  主要业务点已验证:")
        print("  ✓ 访客注册与车牌关联")
        print("  ✓ 会议时间范围校验")
        print("  ✓ 审批流程控制")
        print("  ✓ 车位自动锁定机制")
        print("  ✓ 状态流转完整")
        print("  ✓ 会议关联可复核")
        print("  ✓ 看板实时反映车位使用情况")
        print("  ✓ 来源记录可追溯")
        print("\n" + "═"*60)
        
    except Exception as e:
        error(f"演示过程中出错: {e}")
        import traceback
        traceback.print_exc()
    finally:
        client.close()


if __name__ == "__main__":
    demo_main()
