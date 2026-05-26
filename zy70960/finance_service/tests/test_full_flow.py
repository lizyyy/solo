import requests
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

BASE_URL = "http://localhost:8000"


def test_full_flow():
    print("=" * 60)
    print("区域财务对账系统 - 完整流程测试")
    print("=" * 60)

    print("\n1. 创建销售数据批次...")
    sales_batch = requests.post(f"{BASE_URL}/api/batches", json={
        "batch_no": "SALES_202401_001",
        "store_code": "SH001",
        "batch_type": "sales",
        "created_by": "财务员A",
        "remarks": "2024年1月销售数据"
    })
    sales_batch_id = sales_batch.json()["id"]
    print(f"   销售批次创建成功，ID:", sales_batch_id)

    print("\n2. 上传销售JSON文件...")
    with open("data/sample_sales.json", "rb") as f:
        sales_upload = requests.post(
            f"{BASE_URL}/api/batches/{sales_batch_id}/upload",
            files={"file": ("sample_sales.json", f, "application/json")}
        )
    print("   销售数据上传结果:", sales_upload.json())

    print("\n3. 创建缴存CSV批次...")
    deposit_batch = requests.post(f"{BASE_URL}/api/batches", json={
        "batch_no": "DEPOSIT_202401_001",
        "store_code": "SH001",
        "batch_type": "deposit",
        "created_by": "财务员A",
        "remarks": "2024年1月缴存数据"
    })
    deposit_batch_id = deposit_batch.json()["id"]
    print(f"   缴存批次创建成功，ID:", deposit_batch_id)

    print("\n4. 上传缴存CSV文件...")
    with open("data/sample_deposit.csv", "rb") as f:
        deposit_upload = requests.post(
            f"{BASE_URL}/api/batches/{deposit_batch_id}/upload",
            files={"file": ("sample_deposit.csv", f, "text/csv")}
        )
    print("   缴存数据上传结果:", deposit_upload.json())

    print("\n5. 异常检测...")
    anomalies = requests.post(f"{BASE_URL}/api/batches/{deposit_batch_id}/detect-anomalies")
    print("   检测到异常:", anomalies.json())

    print("\n6. 对账处理...")
    reconcile = requests.post(f"{BASE_URL}/api/batches/{deposit_batch_id}/reconcile")
    print("   对账结果:", json.dumps(reconcile.json(), indent=2, ensure_ascii=False))

    print("\n7. 创建备用金批次...")
    petty_batch = requests.post(f"{BASE_URL}/api/batches", json={
        "batch_no": "PETTY_202401_001",
        "store_code": "SH001",
        "batch_type": "petty_cash",
        "created_by": "财务员A",
        "remarks": "2024年1月备用金流水"
    })
    petty_batch_id = petty_batch.json()["id"]
    print(f"   备用金批次创建成功，ID:", petty_batch_id)

    print("\n8. 上传备用金CSV文件...")
    with open("data/sample_petty_cash.csv", "rb") as f:
        petty_upload = requests.post(
            f"{BASE_URL}/api/batches/{petty_batch_id}/upload",
            files={"file": ("sample_petty_cash.csv", f, "text/csv")}
        )
    print("   备用金数据上传结果:", petty_upload.json())

    print("\n9. 查询缴存记录（按门店SH001)...")
    deposit_records = requests.get(f"{BASE_URL}/api/deposit-records", params={"store_code": "SH001"})
    data = deposit_records.json()
    print(f"   共找到", data["total"], "条记录")
    for record in data["data"]:
        print(f"   - ID:", record["id"], "日期:", record["deposit_date"], "金额:", record["deposit_amount"], "状态:", record["status"])
        if record.get("mismatch_reason"):
            print(f"     异常原因:", record["mismatch_reason"])

    print("\n10. 处理异常记录...")
    records_to_process = [r["id"] for r in data["data"] if r["status"] in ["over", "short", "returned"]]
    if records_to_process:
        process_result = requests.post(f"{BASE_URL}/api/records/process", json={
            "record_ids": records_to_process,
            "action": "approve",
            "reason": "经核对销售记录确认无误，予以放行",
            "handled_by": "财务主管",
            "action_type": "manual_correction",
            "remarks": "人工核对后确认"
        })
        print("   处理结果:", process_result.json())

    print("\n11. 退回整个批次...")
    return_result = requests.post(f"{BASE_URL}/api/batches/{deposit_batch_id}/return", params={
        "reason": "数据不完整，需要门店补充材料",
        "handled_by": "财务主管",
        "remarks": "请补充1月18日的缴存凭证"
    })
    print("   退回结果:", return_result.json())

    print("\n12. 查看处理日志...")
    logs = requests.get(f"{BASE_URL}/api/process-logs", params={"batch_id": deposit_batch_id})
    print(f"   共", logs.json()["count"], "条日志:")
    for log in logs.json()["data"]:
        print(f"   - [{log['handled_at']}] {log['action']}: {log['reason']}")

    print("\n13. 导出缴存记录...")
    export_result = requests.get(f"{BASE_URL}/api/export/deposit-records", params={"store_code": "SH001", "format": "csv"})
    with open("tests/exported_deposit.csv", "wb") as f:
        f.write(export_result.content)
    print("   导出成功，保存到 tests/exported_deposit.csv")

    print("\n" + "=" * 60)
    print("测试完成！")
    print("=" * 60)


if __name__ == "__main__":
    try:
        test_full_flow()
    except requests.exceptions.ConnectionError:
        print("\n错误: 无法连接到服务器，请先启动服务:")
        print("  cd finance_service && uvicorn app.main:app --reload")
        sys.exit(1)
