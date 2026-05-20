#!/usr/bin/env python3
"""验证复核改动后数据一致性的测试脚本"""

import requests
import openpyxl
from io import BytesIO

BASE_URL = "http://localhost:8000/api/v1"


def test_data_sync():
    """测试复核后数据同步"""
    print("=" * 70)
    print("验证：复核改动后，详情、汇总和导出报告里的数字同步变化")
    print("=" * 70)

    # 1. 导入数据
    print("\n1. 导入测试数据...")
    with open("app/data/sample_appointments.csv", "rb") as f:
        files = {"file": ("sample_appointments.csv", f, "text/csv")}
        response = requests.post(f"{BASE_URL}/import/appointments/csv", files=files)
        appointment_batch = response.json()["data"]["batch_id"]

    with open("app/data/sample_inventory.json", "rb") as f:
        files = {"file": ("sample_inventory.json", f, "application/json")}
        requests.post(f"{BASE_URL}/import/inventory/json", files=files)

    with open("app/data/sample_rules.json", "rb") as f:
        files = {"file": ("sample_rules.json", f, "application/json")}
        requests.post(f"{BASE_URL}/import/rules/json", files=files)

    # 2. 执行对账
    print("2. 执行对账...")
    response = requests.post(f"{BASE_URL}/reconciliation/run", params={"batch_id": appointment_batch})
    reconciliation_batch = response.json()["data"]["batch_id"]
    print(f"   对账批次: {reconciliation_batch}")

    # 3. 获取对账后初始状态
    print("\n3. 获取初始状态...")
    response = requests.get(f"{BASE_URL}/report/summary")
    initial_summary = response.json()["data"]
    print(f"   初始通过率: {initial_summary['approval_rate']}%")
    print(f"   初始复核进度: {initial_summary['review_progress']}%")
    print(f"   状态分布: {initial_summary['status_breakdown']}")

    # 4. 获取待复核记录
    response = requests.get(f"{BASE_URL}/report/details", params={"status": "needs_review"})
    need_review_records = response.json()["data"]
    print(f"\n4. 找到 {len(need_review_records)} 条待复核记录")

    # 5. 人工复核一条记录
    if need_review_records:
        record_id = need_review_records[0]["record_id"]
        print(f"\n5. 人工复核记录 {record_id} (通过)...")
        review_data = {
            "action": "approve",
            "reviewer": "测试医生",
            "review_notes": "经核实，数据无误",
            "decision_reason": "测试验证：人工通过"
        }
        response = requests.post(f"{BASE_URL}/review/{record_id}", json=review_data)
        assert response.status_code == 200, f"复核失败: {response.text}"
        print(f"   ✅ 复核成功，审计日志ID: {response.json()['data']['audit_log_id']}")

    # 6. 验证汇总数据变化
    print("\n6. 验证汇总数据变化...")
    response = requests.get(f"{BASE_URL}/report/summary")
    updated_summary = response.json()["data"]
    print(f"   更新后通过率: {updated_summary['approval_rate']}%")
    print(f"   更新后复核进度: {updated_summary['review_progress']}%")
    print(f"   更新后状态分布: {updated_summary['status_breakdown']}")

    # 验证状态变化：manually_approved 应该增加
    assert updated_summary["status_breakdown"].get("manually_approved", 0) > 0, "人工通过数量未增加!"
    assert updated_summary["review_progress"] > initial_summary["review_progress"], "复核进度未增加!"
    assert updated_summary["approval_rate"] > initial_summary["approval_rate"], "通过率未增加!"
    print("   ✅ 汇总数据已同步更新")

    # 7. 验证明细数据变化
    print("\n7. 验证明细数据变化...")
    response = requests.get(f"{BASE_URL}/report/details")
    details = response.json()["data"]
    manually_approved = [d for d in details if d["status"] == "manually_approved"]
    print(f"   人工通过记录数: {len(manually_approved)}")
    
    if manually_approved:
        record = manually_approved[0]
        assert record["reviewed_by"] == "测试医生", "复核人信息未同步!"
        assert record["final_decision"] == "approve", "最终决定未同步!"
        print("   ✅ 明细数据已同步更新")

    # 8. 验证Excel导出数据
    print("\n8. 验证Excel导出数据...")
    response = requests.get(f"{BASE_URL}/report/export/excel")
    assert response.status_code == 200, "Excel导出失败"
    
    excel_data = BytesIO(response.content)
    wb = openpyxl.load_workbook(excel_data)
    
    # 读取汇总工作表
    summary_sheet = wb["汇总"]
    excel_values = {}
    for row in summary_sheet.iter_rows(min_row=1, max_row=10, values_only=True):
        if row[0] and "复核完成率" in str(row[0]):
            excel_review_progress = float(str(row[1]).replace("%", ""))
            print(f"   Excel复核完成率: {excel_review_progress}%")
            
            # 验证Excel中的复核完成率与接口一致
            assert abs(excel_review_progress - updated_summary["review_progress"]) < 0.01, \
                f"Excel复核完成率 ({excel_review_progress}%) 与接口数据 ({updated_summary['review_progress']}%) 不一致!"
            
            # 验证不是固定的0
            assert excel_review_progress > 0, "Excel复核完成率为固定值0，未同步更新!"
            print("   ✅ Excel导出数据正确，复核完成率不是固定值0")
            break

    # 9. 再复核一条记录，验证再次同步
    if len(need_review_records) > 1:
        record_id2 = need_review_records[1]["record_id"]
        print(f"\n9. 再次复核记录 {record_id2} (需补充材料)...")
        review_data2 = {
            "action": "request_info",
            "reviewer": "测试医生2",
            "review_notes": "需补充材料",
            "decision_reason": "测试验证：需补充材料"
        }
        response = requests.post(f"{BASE_URL}/review/{record_id2}", json=review_data2)
        assert response.status_code == 200, "复核失败"

        # 再次验证汇总
        response = requests.get(f"{BASE_URL}/report/summary")
        final_summary = response.json()["data"]
        print(f"   最终复核进度: {final_summary['review_progress']}%")
        assert final_summary["review_progress"] > updated_summary["review_progress"], "第二次复核后进度未增加!"
        print("   ✅ 第二次复核后数据再次同步更新")

    print("\n" + "=" * 70)
    print("✅ 所有验证通过！复核改动后，详情、汇总和导出报告的数据同步变化")
    print("=" * 70)


if __name__ == "__main__":
    try:
        test_data_sync()
    except requests.exceptions.ConnectionError:
        print("\n❌ 错误: 无法连接到服务器！")
        print("请先启动服务: python -m uvicorn app.main:app --reload")
    except AssertionError as e:
        print(f"\n❌ 验证失败: {e}")
        import traceback
        traceback.print_exc()
    except Exception as e:
        print(f"\n❌ 发生错误: {e}")
        import traceback
        traceback.print_exc()
