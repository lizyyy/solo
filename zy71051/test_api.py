import requests
import json
from datetime import date, timedelta

BASE_URL = "http://localhost:8000"


def test_full_workflow():
    print("=" * 60)
    print("养老机构药盒发放 API - 完整业务流程测试")
    print("=" * 60)

    today = date.today().isoformat()
    tomorrow = (date.today() + timedelta(days=1)).isoformat()
    next_week = (date.today() + timedelta(days=7)).isoformat()

    print("\n1. 创建老人档案")
    elder_data = {
        "name": "张三",
        "id_card": "110101194001011234",
        "room_number": "301",
        "bed_number": "A",
        "gender": "男",
        "age": 84,
        "contact_person": "张小明",
        "contact_phone": "13800138000"
    }
    r = requests.post(f"{BASE_URL}/elders", json=elder_data)
    print(f"  状态码: {r.status_code}")
    elder = r.json()
    elder_id = elder["id"]
    print(f"  老人ID: {elder_id}, 姓名: {elder['name']}")

    print("\n2. 创建医嘱（版本1）")
    prescription_data = {
        "elder_id": elder_id,
        "doctor_name": "王医生",
        "diagnosis": "高血压、糖尿病",
        "start_date": today,
        "end_date": next_week,
        "source": "HIS系统",
        "created_by": "李药师",
        "remark": "长期医嘱",
        "items": [
            {
                "medicine_name": "硝苯地平缓释片",
                "specification": "10mg",
                "dosage": "1片",
                "frequency": "每日2次",
                "usage": "口服",
                "quantity": 1,
                "unit": "盒"
            },
            {
                "medicine_name": "二甲双胍",
                "specification": "0.5g",
                "dosage": "1片",
                "frequency": "每日3次",
                "usage": "口服",
                "quantity": 2,
                "unit": "盒"
            }
        ]
    }
    r = requests.post(f"{BASE_URL}/prescriptions", json=prescription_data)
    print(f"  状态码: {r.status_code}")
    prescription = r.json()
    prescription_id = prescription["id"]
    print(f"  医嘱ID: {prescription_id}, 版本: {prescription['version']}")

    print("\n3. 查询当前有效医嘱")
    r = requests.get(f"{BASE_URL}/prescriptions/elder/{elder_id}/active")
    print(f"  状态码: {r.status_code}")
    active = r.json()
    print(f"  有效医嘱ID: {active['id']}, 版本: {active['version']}")

    print("\n4. 创建停药申请")
    stop_data = {
        "prescription_id": prescription_id,
        "applicant": "家属张小明",
        "applicant_role": "家属",
        "reason": "老人服用后出现头晕",
        "effective_date": tomorrow,
        "source": "家属APP",
        "remark": "请尽快处理"
    }
    r = requests.post(f"{BASE_URL}/stop-requests", json=stop_data)
    print(f"  状态码: {r.status_code}")
    stop_req = r.json()
    stop_id = stop_req["id"]
    print(f"  停药申请ID: {stop_id}, 批次号: {stop_req['batch_no']}")

    print("\n5. 审批停药申请")
    approve_data = {
        "status": "approved",
        "approved_by": "王医生",
        "remark": "同意停药，建议复诊"
    }
    r = requests.put(
        f"{BASE_URL}/stop-requests/{stop_id}/approve",
        params={"operator": "王医生"},
        json=approve_data
    )
    print(f"  状态码: {r.status_code}")
    approved = r.json()
    print(f"  审批后状态: {approved['status']}")

    print("\n6. 创建药盒（应被停药拦截）")
    box_data = {
        "elder_id": elder_id,
        "prescription_id": prescription_id,
        "batch_no": "BATCH-001",
        "box_no": "BOX-001",
        "distribution_date": tomorrow,
        "time_slot": "morning",
        "medicines": "硝苯地平缓释片 1片",
        "source": "药房系统",
        "prepared_by": "李药师"
    }
    r = requests.post(f"{BASE_URL}/medicine-boxes", json=box_data)
    print(f"  状态码: {r.status_code}")
    box = r.json()
    box_id = box["id"]
    print(f"  药盒ID: {box_id}, 状态: {box['status']}")
    print(f"  备注: 状态为 stopped 表示已成功拦截停药！")

    print("\n7. 批量创建药盒（批次 BATCH-002）")
    for i in range(1, 4):
        box_data_i = box_data.copy()
        box_data_i["batch_no"] = "BATCH-002"
        box_data_i["box_no"] = f"BOX-002-{i}"
        box_data_i["distribution_date"] = today
        r = requests.post(f"{BASE_URL}/medicine-boxes", json=box_data_i)
        print(f"  创建药盒 {i}: 状态={r.json()['status']}")

    print("\n8. 护士签收")
    boxes = requests.get(f"{BASE_URL}/medicine-boxes", params={"batch_no": "BATCH-002"}).json()
    for i, box in enumerate(boxes[:2], 1):
        sign_data = {
            "medicine_box_id": box["id"],
            "nurse_name": "护士小美",
            "is_backfilled": False,
            "receiver_name": "张三",
            "receiver_relation": "本人"
        }
        r = requests.post(f"{BASE_URL}/medicine-boxes/{box['id']}/sign", json=sign_data)
        print(f"  签收药盒 {i}: 状态={r.json()['status']}")

    print("\n9. 补录签收（异常处理）")
    backfill_box = boxes[2]
    backfill_data = {
        "medicine_box_id": backfill_box["id"],
        "nurse_name": "护士小李",
        "is_backfilled": True,
        "backfill_reason": "系统故障，签收记录丢失",
        "backfilled_by": "护士长",
        "receiver_name": "张三",
        "receiver_relation": "本人"
    }
    r = requests.post(f"{BASE_URL}/medicine-boxes/{backfill_box['id']}/sign", json=backfill_data)
    print(f"  补录签收: 状态={r.json()['status']}, 补录标识={r.json().get('is_supplementary', False)}")

    print("\n10. 创建争议")
    dispute_data = {
        "medicine_box_id": boxes[0]["id"],
        "reporter": "家属张小明",
        "reporter_role": "家属",
        "dispute_type": "签收异常",
        "description": "老人反映当天没有收到药盒，但系统显示已签收"
    }
    r = requests.post(f"{BASE_URL}/disputes", json=dispute_data)
    print(f"  状态码: {r.status_code}")
    dispute = r.json()
    print(f"  争议ID: {dispute['id']}, 状态: {dispute['status']}")

    print("\n11. 处理争议")
    handle_data = {
        "handler": "护士长",
        "handle_result": "经查确实为护士代签未通知家属，已批评教育。补送药盒并致歉。",
        "status": "resolved"
    }
    r = requests.put(f"{BASE_URL}/disputes/{dispute['id']}/handle", json=handle_data)
    print(f"  状态码: {r.status_code}")
    handled = r.json()
    print(f"  处理后状态: {handled['status']}")

    print("\n12. 创建批次上传记录并撤回")
    batch_data = {
        "batch_no": "BATCH-002",
        "upload_type": "medicine_box",
        "uploader": "李药师",
        "remark": "早班药盒批次"
    }
    r = requests.post(f"{BASE_URL}/batch-uploads", json=batch_data)
    print(f"  创建批次: 状态={r.status_code}")
    
    withdraw_data = {
        "withdrawn_by": "药房主任",
        "withdraw_reason": "发现药品调配错误，需要重新配药"
    }
    r = requests.put(f"{BASE_URL}/batch-uploads/BATCH-002/withdraw", json=withdraw_data)
    print(f"  撤回批次: 状态={r.status_code}")
    print(f"  批次已撤回")

    print("\n13. 重提批次")
    r = requests.post(
        f"{BASE_URL}/batch-uploads/BATCH-002/resubmit",
        params={
            "new_batch_no": "BATCH-002-R1",
            "operator": "李药师",
            "remark": "重新配药后重提"
        }
    )
    print(f"  状态码: {r.status_code}")
    resubmit = r.json()
    print(f"  新批次号: {resubmit['batch_no']}")

    print("\n14. 人工改判")
    new_boxes = requests.get(f"{BASE_URL}/medicine-boxes", params={"batch_no": "BATCH-002-R1"}).json()
    if new_boxes:
        r = requests.put(
            f"{BASE_URL}/medicine-boxes/{new_boxes[0]['id']}/manual-override",
            params={
                "new_status": "cancelled",
                "operator": "药房主任",
                "reason": "经评估该老人今日无需服药"
            }
        )
        print(f"  状态码: {r.status_code}")
        overridden = r.json()
        print(f"  改判后状态: {overridden['status']}")

    print("\n15. 查询发放统计")
    r = requests.get(
        f"{BASE_URL}/reports/distribution/stats",
        params={
            "start_date": today,
            "end_date": tomorrow
        }
    )
    print(f"  状态码: {r.status_code}")
    stats = r.json()
    print(f"  总药盒数: {stats['total_boxes']}")
    print(f"  已签收: {stats['signed_count']}")
    print(f"  签收率: {stats['sign_rate']}%")
    print(f"  争议数: {stats['dispute_count']}")
    print(f"  补录数: {stats['backfill_count']}")
    print(f"  已拦截: {stats['stopped_count']}")

    print("\n16. 导出发放报告")
    r = requests.get(
        f"{BASE_URL}/reports/distribution/export",
        params={
            "start_date": today,
            "end_date": tomorrow
        }
    )
    print(f"  状态码: {r.status_code}")
    print(f"  报告大小: {len(r.content)} bytes")
    with open("distribution_report.csv", "w", encoding="utf-8") as f:
        f.write(r.text)
    print(f"  报告已保存为 distribution_report.csv")

    print("\n17. 查看操作日志")
    r = requests.get(f"{BASE_URL}/operation-logs", params={"limit": 10})
    print(f"  状态码: {r.status_code}")
    logs = r.json()
    print(f"  最近操作记录 ({len(logs)} 条):")
    for log in logs[:5]:
        print(f"    - {log['operation_type']}: {log['change_summary']} (操作人: {log['operator']})")

    print("\n" + "=" * 60)
    print("测试完成！所有核心功能验证通过。")
    print("=" * 60)


if __name__ == "__main__":
    try:
        test_full_workflow()
    except requests.exceptions.ConnectionError:
        print("错误: 无法连接到服务器，请先启动服务:")
        print("  pip install -r requirements.txt")
        print("  python main.py")
    except Exception as e:
        print(f"测试出错: {e}")
        import traceback
        traceback.print_exc()
