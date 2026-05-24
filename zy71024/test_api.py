#!/usr/bin/env python3
import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"


def test_full_flow():
    print("=" * 60)
    print("楼宇访客证撤销 API 测试")
    print("=" * 60)

    visitor_data = {
        "name": "张三",
        "id_card": "110101199001011234",
        "phone": "13800138000",
        "company": "测试公司"
    }
    print("\n1. 创建访客...")
    r = requests.post(f"{BASE_URL}/visitors/", json=visitor_data)
    print(f"   状态: {r.status_code}, 响应: {r.json()}")
    visitor_id = r.json()["id"]

    now = datetime.now()
    meeting_data = {
        "meeting_code": "MEET" + now.strftime("%Y%m%d%H%M%S"),
        "title": "重要商务会议",
        "organizer": "李经理",
        "location": "15楼会议室A",
        "start_time": (now + timedelta(hours=1)).isoformat(),
        "end_time": (now + timedelta(hours=3)).isoformat()
    }
    print("\n2. 创建会议...")
    r = requests.post(f"{BASE_URL}/meetings/", json=meeting_data)
    print(f"   状态: {r.status_code}, 响应: {r.json()}")
    meeting_id = r.json()["id"]
    meeting_code = meeting_data["meeting_code"]

    cert_data = {
        "visitor_id": visitor_id,
        "meeting_id": meeting_id,
        "valid_from": now.isoformat(),
        "valid_to": (now + timedelta(hours=4)).isoformat(),
        "issued_by": "前台小王",
        "access_zone": "15楼"
    }
    print("\n3. 创建临时证...")
    r = requests.post(f"{BASE_URL}/certificates/", json=cert_data)
    print(f"   状态: {r.status_code}, 响应: {r.json()}")
    cert_number = r.json()["certificate_number"]

    print("\n4. 校验证件...")
    r = requests.post(f"{BASE_URL}/certificates/verify", json={"certificate_number": cert_number})
    print(f"   状态: {r.status_code}, 响应: {r.json()}")

    event_id = "EVT" + now.strftime("%Y%m%d%H%M%S")
    event_data = {
        "event_id": event_id,
        "certificate_number": cert_number,
        "event_type": "entry",
        "access_point": "主楼大门",
        "event_time": now.isoformat()
    }
    print("\n5. 记录门禁事件(入场)...")
    r = requests.post(f"{BASE_URL}/access/events/", json=event_data)
    print(f"   状态: {r.status_code}, 响应: {r.json()}")

    print("\n6. 测试重复事件合并(5分钟内同类型)...")
    duplicate_event_data = event_data.copy()
    duplicate_event_data["event_id"] = event_id + "_dup"
    r = requests.post(f"{BASE_URL}/access/events/", json=duplicate_event_data)
    print(f"   状态: {r.status_code}, 响应: {r.json()}")

    print("\n7. 取消会议(触发自动撤销)...")
    r = requests.put(f"{BASE_URL}/meetings/{meeting_code}/cancel?processed_by=系统管理员")
    print(f"   状态: {r.status_code}, 响应: {r.json()}")

    print("\n8. 会议取消后再次校验证件...")
    r = requests.post(f"{BASE_URL}/certificates/verify", json={"certificate_number": cert_number})
    print(f"   状态: {r.status_code}, 响应: {r.json()}")

    print("\n9. 证件复盘...")
    r = requests.get(f"{BASE_URL}/certificates/{cert_number}/review")
    result = r.json()
    print(f"   状态: {r.status_code}")
    print(f"   证件状态: {result['certificate']['status']}")
    print(f"   撤销报告数: {len(result['revoke_reports'])}")
    if result['revoke_reports']:
        print(f"   撤销原因: {result['revoke_reports'][0]['revoke_reason']}")
        print(f"   来源: {result['revoke_reports'][0]['source']}")
        print(f"   处理详情: {result['revoke_reports'][0]['process_details']}")

    reissue_data = {
        "old_certificate_number": cert_number,
        "valid_from": (now + timedelta(hours=1)).isoformat(),
        "valid_to": (now + timedelta(hours=5)).isoformat(),
        "issued_by": "前台小王"
    }
    print("\n10. 补证...")
    r = requests.post(f"{BASE_URL}/certificates/reissue", json=reissue_data)
    print(f"   状态: {r.status_code}, 响应: {r.json()}")
    new_cert_number = r.json()["new_certificate_number"]

    blacklist_data = {
        "id_card": "110101199001019999",
        "reason": "违规记录",
        "added_by": "安保部门"
    }
    print("\n11. 测试黑名单机制...")
    r = requests.post(f"{BASE_URL}/blacklist/", json=blacklist_data)
    print(f"   状态: {r.status_code}, 响应: {r.json()}")

    blacklist_visitor = {
        "name": "李四",
        "id_card": "110101199001019999",
        "phone": "13900139000",
        "company": "风险公司"
    }
    r = requests.post(f"{BASE_URL}/visitors/", json=blacklist_visitor)
    bl_visitor_id = r.json()["id"]
    print(f"   创建黑名单访客, ID: {bl_visitor_id}")

    bl_cert_data = {
        "visitor_id": bl_visitor_id,
        "valid_from": now.isoformat(),
        "valid_to": (now + timedelta(hours=4)).isoformat(),
        "issued_by": "前台小王"
    }
    r = requests.post(f"{BASE_URL}/certificates/", json=bl_cert_data)
    print(f"   黑名单访客尝试发证: {r.status_code}, {r.json().get('detail', '无详情')}")

    print("\n12. 超时检查...")
    r = requests.post(f"{BASE_URL}/system/timeout-check?processed_by=定时任务")
    print(f"   状态: {r.status_code}, 响应: {r.json()}")

    print("\n13. 导出撤销报告(CSV)...")
    r = requests.get(f"{BASE_URL}/reports/export?format=csv")
    print(f"   状态: {r.status_code}, 内容长度: {len(r.content)} 字节")

    print("\n" + "=" * 60)
    print("测试完成!")
    print("=" * 60)


if __name__ == "__main__":
    try:
        test_full_flow()
    except requests.exceptions.ConnectionError:
        print("错误: 无法连接到服务器，请先运行 python main.py 启动服务!")
    except Exception as e:
        print(f"测试出错: {e}")
        import traceback
        traceback.print_exc()
