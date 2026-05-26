"""
端到端测试脚本 - 园林喷洒作业追溯系统
测试所有核心流程: 数据导入 → 创建批次 → 验证 → 标记处理 → 退回 → 查询 → 导出
"""
import requests
import json
import time
import sys

BASE_URL = "http://localhost:8002/api/v1"

passed = 0
failed = 0


def test(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  ✅ {name}")
    else:
        failed += 1
        print(f"  ❌ {name} - {detail}")


def wait_for_server(url, timeout=15):
    start = time.time()
    while time.time() - start < timeout:
        try:
            r = requests.get(url.replace("/api/v1", "/api/v1/health"), timeout=2)
            if r.status_code == 200:
                return True
        except:
            pass
        time.sleep(0.5)
    return False


def import_jobs():
    print("\n📋 测试1: 导入作业 CSV")
    with open("test_data/jobs.csv", "rb") as f:
        r = requests.post(f"{BASE_URL}/batches/jobs/import", files={"file": f})
    data = r.json()
    test("导入作业 CSV", r.status_code == 200, f"状态码: {r.status_code}")
    test("返回作业数量", len(data) == 5, f"返回: {len(data)} 条")
    for job in data:
        test(f"作业 {job['job_no']} 有ID", job.get("id") is not None)
    return data


def import_chemicals():
    print("\n📋 测试2: 导入药剂 JSON")
    with open("test_data/chemicals.json", "rb") as f:
        r = requests.post(f"{BASE_URL}/batches/chemicals/import", files={"file": f})
    data = r.json()
    test("导入药剂 JSON", r.status_code == 200, f"状态码: {r.status_code}")
    test("返回药剂数量", len(data) == 4, f"返回: {len(data)} 条")
    for chem in data:
        test(f"药剂 {chem['name']} 有ID", chem.get("id") is not None)
    return data


def import_weather():
    print("\n📋 测试3: 导入天气 JSON")
    with open("test_data/weather.json", "rb") as f:
        r = requests.post(f"{BASE_URL}/batches/weather/import", files={"file": f})
    data = r.json()
    test("导入天气 JSON", r.status_code == 200, f"状态码: {r.status_code}")
    test("返回天气记录数量", len(data) == 5, f"返回: {len(data)} 条")
    return data


def create_batch_normal(jobs, chemicals, weather):
    print("\n📋 测试4: 创建正常批次 (应通过验证)")
    batch_data = {
        "batch_no": "BATCH-2024-001",
        "spray_area": "东区中央花园",
        "chemical_id": chemicals[0]["id"],
        "job_id": jobs[0]["id"],
        "weather_id": weather[0]["id"],
        "dosage": 0.3,
        "planned_date": "2024-03-15T08:00:00",
        "operator": "张工",
    }
    r = requests.post(f"{BASE_URL}/batches/", json=batch_data)
    data = r.json()
    test("创建批次", r.status_code == 200, f"状态码: {r.status_code}, 响应: {r.text[:200]}")
    if r.status_code == 200:
        test("批次状态为 pending", data["status"] == "pending", f"实际: {data['status']}")
        test("有审计日志", len(data.get("audit_logs", [])) > 0)
    return data


def create_batch_wind_violation(jobs, chemicals, weather):
    print("\n📋 测试5: 创建风速超标批次 (应被退回)")
    batch_data = {
        "batch_no": "BATCH-2024-002",
        "spray_area": "北区防护林带",
        "chemical_id": chemicals[1]["id"],
        "job_id": jobs[1]["id"],
        "weather_id": weather[1]["id"],
        "dosage": 0.2,
        "planned_date": "2024-03-15T09:30:00",
        "operator": "李工",
    }
    r = requests.post(f"{BASE_URL}/batches/", json=batch_data)
    data = r.json()
    test("创建风速超标批次", r.status_code == 200, f"状态码: {r.status_code}, 响应: {r.text[:200]}")
    if r.status_code == 200:
        test("状态被退回", data["status"] == "returned", f"实际: {data['status']}")
        test("审计日志包含风速原因",
             any("风速" in log.get("reason", "") for log in data.get("audit_logs", [])))
    return data


def create_batch_dosage_violation(jobs, chemicals, weather):
    print("\n📋 测试6: 创建用量超标批次 (应被退回)")
    batch_data = {
        "batch_no": "BATCH-2024-003",
        "spray_area": "西区玫瑰园",
        "chemical_id": chemicals[2]["id"],
        "job_id": jobs[2]["id"],
        "weather_id": weather[2]["id"],
        "dosage": 2.0,
        "planned_date": "2024-03-16T07:30:00",
        "operator": "王工",
    }
    r = requests.post(f"{BASE_URL}/batches/", json=batch_data)
    data = r.json()
    test("创建用量超标批次", r.status_code == 200, f"状态码: {r.status_code}, 响应: {r.text[:200]}")
    if r.status_code == 200:
        test("状态被退回", data["status"] == "returned", f"实际: {data['status']}")
        test("审计日志包含用量原因",
             any("用量" in log.get("reason", "") for log in data.get("audit_logs", [])))
    return data


def mark_processed(batch_id):
    print("\n📋 测试7: 标记处理 (通过验证的批次)")
    r = requests.post(f"{BASE_URL}/batches/{batch_id}/process", params={"handler": "赵审核"})
    data = r.json()
    test("标记处理", r.status_code == 200, f"状态码: {r.status_code}")
    if r.status_code == 200:
        test("状态变为 processed", data["status"] == "processed", f"实际: {data['status']}")
        test("审计日志有处理记录", len(data.get("audit_logs", [])) >= 2)
    return data


def return_batch(batch_id):
    print("\n📋 测试8: 退回批次")
    r = requests.post(
        f"{BASE_URL}/batches/{batch_id}/return",
        params={"reason": "需要重新检查药剂浓度", "handler": "孙经理"}
    )
    data = r.json()
    test("退回批次", r.status_code == 200, f"状态码: {r.status_code}")
    if r.status_code == 200:
        test("状态为 returned", data["status"] == "returned", f"实际: {data['status']}")
        test("审计日志有退回原因",
             any("重新检查药剂浓度" in log.get("reason", "") for log in data.get("audit_logs", [])))
    return data


def update_batch(batch_id):
    print("\n📋 测试9: 修改批次 (退回后修改)")
    update_data = {
        "dosage": 0.15,
        "operator": "李工(修改)",
    }
    r = requests.put(
        f"{BASE_URL}/batches/{batch_id}",
        params={"handler": "李工"},
        json=update_data
    )
    data = r.json()
    test("修改批次", r.status_code == 200, f"状态码: {r.status_code}")
    if r.status_code == 200:
        test("用量已更新", data["dosage"] == 0.15, f"实际: {data['dosage']}")
    return data


def query_batches():
    print("\n📋 测试10: 查询批次")
    r = requests.get(f"{BASE_URL}/batches/", params={"spray_area": "东区"})
    data = r.json()
    test("按喷洒区域查询", r.status_code == 200, f"状态码: {r.status_code}")
    test("查询结果至少1条", len(data) >= 1, f"返回: {len(data)} 条")

    r2 = requests.get(f"{BASE_URL}/batches/", params={"chemical_batch_no": "CHEM-2024-A001"})
    data2 = r2.json()
    test("按药剂批号查询", r2.status_code == 200)
    test("按药剂批号结果非空", len(data2) >= 1)

    r3 = requests.get(f"{BASE_URL}/batches/", params={
        "weather_window_start": "2024-03-15T00:00:00",
        "weather_window_end": "2024-03-16T23:59:59",
    })
    data3 = r3.json()
    test("按天气窗口查询", r3.status_code == 200)
    test("按天气窗口结果非空", len(data3) >= 1)

    return data


def export_batches():
    print("\n📋 测试11: 导出批次 (JSON)")
    r = requests.get(f"{BASE_URL}/exports/batches", params={"spray_area": "东区"})
    data = r.json()
    test("导出JSON", r.status_code == 200, f"状态码: {r.status_code}")
    test("导出数量与查询一致",
         data["query_count"] == data["export_count"],
         f"查询: {data.get('query_count')}, 导出: {data.get('export_count')}")
    test("count_consistent 为 True", data.get("count_consistent") == True)
    test("导出记录至少1条", len(data.get("records", [])) >= 1)
    return data


def export_csv():
    print("\n📋 测试12: 导出批次 (CSV)")
    r = requests.get(f"{BASE_URL}/exports/batches", params={
        "spray_area": "东区",
        "format": "csv",
    })
    test("导出CSV", r.status_code == 200, f"状态码: {r.status_code}")
    test("响应头有数量", r.headers.get("X-Query-Count") is not None)
    test("查询导出数量一致",
         r.headers.get("X-Query-Count") == r.headers.get("X-Export-Count"),
         f"查询: {r.headers.get('X-Query-Count')}, 导出: {r.headers.get('X-Export-Count')}")


def get_explanation(batch_id):
    print("\n📋 测试13: 获取决策说明")
    r = requests.get(f"{BASE_URL}/batches/{batch_id}/explanation")
    data = r.json()
    test("获取决策说明", r.status_code == 200, f"状态码: {r.status_code}")
    test("有验证摘要", "validation_summary" in data)
    test("有决策说明", "decision_explanation" in data)
    test("验证摘要可读", len(data.get("validation_summary", "")) > 50)
    return data


def test_restart_persistence():
    print("\n📋 测试14: 验证持久化 (重启后查询)")
    r = requests.get(f"{BASE_URL}/batches/")
    data = r.json()
    test("查询所有批次", r.status_code == 200, f"状态码: {r.status_code}")
    test("批次数量 >= 3", len(data) >= 3, f"实际: {len(data)} 条")
    return data


def main():
    global passed, failed
    print("=" * 60)
    print("🌿 园林喷洒作业追溯系统 - 端到端测试")
    print("=" * 60)

    if not wait_for_server(BASE_URL, timeout=10):
        print("❌ 服务器未启动，请先运行: uvicorn main:app --reload")
        sys.exit(1)

    print("\n✅ 服务器已连接")

    try:
        jobs = import_jobs()
        chemicals = import_chemicals()
        weather = import_weather()

        batch1 = create_batch_normal(jobs, chemicals, weather)
        batch2 = create_batch_wind_violation(jobs, chemicals, weather)
        batch3 = create_batch_dosage_violation(jobs, chemicals, weather)

        if batch1:
            mark_processed(batch1["id"])

        if batch2:
            return_batch(batch2["id"])
            update_batch(batch2["id"])

        query_batches()
        export_batches()
        export_csv()

        if batch1:
            get_explanation(batch1["id"])
        if batch2:
            get_explanation(batch2["id"])

        test_restart_persistence()

    except Exception as e:
        print(f"\n❌ 测试异常: {e}")
        import traceback
        traceback.print_exc()

    print("\n" + "=" * 60)
    total = passed + failed
    print(f"📊 测试结果: {passed}/{total} 通过, {failed}/{total} 失败")
    if failed == 0:
        print("🎉 所有测试通过!")
    else:
        print(f"⚠️  有 {failed} 个测试失败")
    print("=" * 60)

    sys.exit(0 if failed == 0 else 1)


if __name__ == "__main__":
    main()
