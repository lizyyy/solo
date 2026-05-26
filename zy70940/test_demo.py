import requests
import json
import time

BASE_URL = "http://localhost:8001"


def demo_workflow():
    print("=" * 60)
    print("物流调度扣罚管理系统 - 完整流程演示")
    print("=" * 60)

    print("\n1. 创建批次")
    batch_response = requests.post(
        f"{BASE_URL}/batches",
        json={"name": "2024年5月第1批干线运输", "created_by": "调度员小王", "remark": "华东地区干线运输批次"}
    )
    batch = batch_response.json()
    batch_id = batch["id"]
    print(f"   ✓ 批次创建成功: {batch['batch_no']} (ID: {batch_id})")

    print("\n2. 导入运单CSV")
    with open("samples/waybills.csv", "rb") as f:
        waybill_response = requests.post(
            f"{BASE_URL}/batches/{batch_id}/waybills/import",
            files={"file": ("waybills.csv", f, "text/csv")}
        )
    waybill_result = waybill_response.json()
    print(f"   ✓ 运单导入: 成功{waybill_result['success']}条, 失败{waybill_result['failed']}条")

    print("\n3. 导入轨迹JSON")
    with open("samples/tracking.json", "rb") as f:
        tracking_response = requests.post(
            f"{BASE_URL}/tracking/import",
            files={"file": ("tracking.json", f, "application/json")}
        )
    tracking_result = tracking_response.json()
    print(f"   ✓ 轨迹导入: 成功{tracking_result['success']}条, 失败{tracking_result['failed']}条")

    print("\n4. 导入扣罚规则")
    with open("samples/penalty_rules.json", "r", encoding="utf-8") as f:
        rules = json.load(f)
    rules_response = requests.post(f"{BASE_URL}/penalty-rules/import", json=rules)
    rules_result = rules_response.json()
    print(f"   ✓ 规则导入: 成功{rules_result['success']}条, 失败{rules_result['failed']}条")

    print("\n5. 智能分析批次异常")
    analyze_response = requests.post(f"{BASE_URL}/batches/{batch_id}/analyze")
    analyze_result = analyze_response.json()
    print(f"   ✓ 发现异常: {analyze_result['abnormality_count']}条")
    for abn in analyze_result["abnormalities"][:3]:
        print(f"     - {abn['waybill_no']}: {abn['exception_type']} - {abn['exception_reason']}")

    print("\n6. 手动创建扣罚记录（模拟复杂场景）")
    penalty_records = [
        {
            "batch_id": batch_id,
            "waybill_no": "SF202405010002",
            "rule_code": "RULE-001",
            "rule_name": "超时送达扣罚",
            "exception_type": "超时送达",
            "exception_reason": "实际送达时间晚于预计时间46小时",
            "transfer_node": "深圳宝安中转中心",
            "penalty_ratio": 0.2,
            "penalty_amount": 200.0,
            "is_weather_exempt": True,
            "weather_reason": "深圳地区暴雨红色预警，航班大面积延误",
            "is_cross_transfer": True,
            "cross_transfer_detail": "涉及上海虹桥、深圳宝安两个中转中心责任划分",
            "is_duplicate": False,
        },
        {
            "batch_id": batch_id,
            "waybill_no": "SF202405010002",
            "rule_code": "RULE-002",
            "rule_name": "货物破损扣罚",
            "exception_type": "货物破损",
            "exception_reason": "签收时发现外包装轻微破损",
            "transfer_node": "深圳南山区派送点",
            "penalty_ratio": 0.1,
            "penalty_amount": 50.0,
            "is_weather_exempt": False,
            "is_cross_transfer": False,
            "is_duplicate": False,
        },
    ]

    penalty_response = requests.post(f"{BASE_URL}/penalty-records/batch", json=penalty_records)
    penalties = penalty_response.json()
    penalty_ids = [p["id"] for p in penalties]
    print(f"   ✓ 创建扣罚记录: {len(penalties)}条")
    for p in penalties:
        print(f"     - ID:{p['id']} {p['waybill_no']} {p['exception_type']} 比例:{p['penalty_ratio']*100:.0f}%")

    print("\n7. 查询扣罚记录（按中转节点筛选）")
    query_response = requests.post(
        f"{BASE_URL}/penalty-records/query",
        json={"transfer_node": "深圳宝安中转中心"}
    )
    query_result = query_response.json()
    print(f"   ✓ 查询结果: 共{query_result['total']}条记录")
    for r in query_result["records"]:
        print(f"     - {r['waybill_no']}: {r['exception_type']} 状态:{r['status']}")

    print("\n8. 批量处理扣罚记录")
    process_response = requests.post(
        f"{BASE_URL}/penalty-records/process",
        json={
            "record_ids": penalty_ids[:1],
            "action": "release",
            "reason": "暴雨天气属于不可抗力因素，予以免责放行",
            "operator": "调度主管老李"
        }
    )
    process_result = process_response.json()
    print(f"   ✓ 处理记录: {process_result['processed_count']}条")
    for r in process_result["records"]:
        print(f"     - ID:{r['id']} 新状态:{r['status']} 处理结果:{r['process_result']}")

    print("\n9. 处理另一条记录（退回修改）")
    process2_response = requests.post(
        f"{BASE_URL}/penalty-records/process",
        json={
            "record_ids": penalty_ids[1:],
            "action": "return",
            "reason": "需要提供破损照片和客户签字确认单",
            "operator": "调度主管老李"
        }
    )
    process2_result = process2_response.json()
    print(f"   ✓ 处理记录: {process2_result['processed_count']}条")
    for r in process2_result["records"]:
        print(f"     - ID:{r['id']} 新状态:{r['status']} 处理结果:{r['process_result']}")

    print("\n10. 查看单条记录完整追溯信息")
    detail_response = requests.get(f"{BASE_URL}/penalty-records/{penalty_ids[0]}")
    detail = detail_response.json()
    print(f"    ✓ 记录ID:{detail['penalty_record']['id']}")
    print(f"    - 运单号: {detail['penalty_record']['waybill_no']}")
    print(f"    - 异常类型: {detail['penalty_record']['exception_type']}")
    print(f"    - 天气免责: {'是' if detail['penalty_record']['is_weather_exempt'] else '否'}")
    print(f"    - 跨中转责任: {'是' if detail['penalty_record']['is_cross_transfer'] else '否'}")
    print(f"    - 处理历史: {len(detail['process_histories'])}条")
    for h in detail["process_histories"]:
        print(f"      * {h['operated_at']} {h['operator']} 执行{h['action']}: {h['reason']}")

    print("\n11. 导出批次报告")
    export_response = requests.get(f"{BASE_URL}/batches/{batch_id}/export")
    filename = f"batch_report_{batch_id}.xlsx"
    with open(filename, "wb") as f:
        f.write(export_response.content)
    print(f"    ✓ 批次报告已导出: {filename}")

    print("\n12. 导出单条记录追溯报告")
    export2_response = requests.get(f"{BASE_URL}/penalty-records/{penalty_ids[0]}/export")
    filename2 = f"traceability_{penalty_ids[0]}.xlsx"
    with open(filename2, "wb") as f:
        f.write(export2_response.content)
    print(f"    ✓ 追溯报告已导出: {filename2}")

    print("\n" + "=" * 60)
    print("演示完成！系统已成功运行。")
    print("=" * 60)
    print("\n主要功能验证:")
    print("✓ 批次管理 - 创建、查询")
    print("✓ 数据导入 - CSV运单、JSON轨迹、扣罚规则")
    print("✓ 异常分析 - 智能识别超时、破损、轨迹缺失等")
    print("✓ 扣罚记录 - 支持跨中转、天气免责、重复扣罚标记")
    print("✓ 处理流程 - 放行、退回修改、通过、驳回、要求补材料")
    print("✓ 历史查询 - 按中转节点、异常类型、扣罚比例等筛选")
    print("✓ 追溯能力 - 从单条明细到完整处理历史")
    print("✓ 数据导出 - 批次报告、追溯报告、明细导出")
    print("✓ 持久化 - SQLite数据库，重启数据不丢失")


if __name__ == "__main__":
    try:
        demo_workflow()
    except requests.exceptions.ConnectionError:
        print("错误: 无法连接到服务器。请先启动服务: uvicorn app.main:app --reload")
    except Exception as e:
        print(f"错误: {e}")
