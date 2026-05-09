import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"

def test(name, r, expected_status=None):
    status_ok = expected_status is None or r.status_code == expected_status
    status_str = "✓" if status_ok else "✗"
    print(f"\n{status_str} {name}")
    print(f"  状态码: {r.status_code}")
    if r.headers.get('content-type', '').startswith('application/json'):
        data = r.json()
        print(f"  响应: {json.dumps(data, ensure_ascii=False, indent=2)}")
        return data
    else:
        print(f"  响应: (非JSON，长度 {len(r.content)})")
        return None


def main():
    print("=" * 60)
    print("  门店巡检整改 API - 核心测试")
    print("=" * 60)

    r = requests.get(f"{BASE_URL}/health")
    test("健康检查", r, 200)
    if r.status_code != 200:
        print("\n服务未启动，请运行: python3 -m uvicorn app.main:app --reload")
        return

    store_id = 1
    item_id = 1

    r = requests.post(f"{BASE_URL}/api/inspections", json={
        "store_id": store_id,
        "inspector": "张巡检",
        "remark": "5月巡检"
    })
    inspection = test("创建巡检", r, 201)
    inspection_id = inspection["id"]

    r = requests.post(f"{BASE_URL}/api/inspections/{inspection_id}/records", json={
        "item_id": item_id,
        "is_pass": False,
        "deduction_reason": "地面脏"
    })
    record = test("添加不合格记录", r, 201)
    record_id = record["id"]

    r = requests.post(f"{BASE_URL}/api/inspections/{inspection_id}/complete")
    test("完成巡检", r, 200)

    deadline = (datetime.utcnow() + timedelta(hours=48)).isoformat()
    r = requests.post(f"{BASE_URL}/api/inspections/rectifications", json={
        "record_id": record_id,
        "assignee": "李店长",
        "deadline": deadline
    })
    rect = test("分派整改任务", r, 201)
    rect_id = rect["id"]

    r = requests.post(f"{BASE_URL}/api/inspections/rectifications/{rect_id}/start", json={
        "actor": "李店长"
    })
    test("开始整改", r, 200)

    r = requests.post(f"{BASE_URL}/api/inspections/rectifications/{rect_id}/submit", json={
        "rectification_description": "已清洁"
    })
    test("提交整改", r, 200)

    r = requests.post(f"{BASE_URL}/api/inspections/rectifications/{rect_id}/submit", json={
        "rectification_description": "重复提交"
    })
    test("重复提交（预期 409 冲突）", r, 409)

    r = requests.post(f"{BASE_URL}/api/inspections/rectifications/{rect_id}/start-recheck", json={
        "rechecker": "王复查"
    })
    test("开始复查", r, 200)

    r = requests.post(f"{BASE_URL}/api/inspections/rectifications/{rect_id}/complete-recheck?level=1", json={
        "rechecker": "王复查",
        "recheck_result": "不通过",
        "recheck_remark": "还需改进"
    })
    test("复查不通过", r, 200)

    new_deadline = (datetime.utcnow() + timedelta(hours=24)).isoformat()
    r = requests.post(f"{BASE_URL}/api/inspections/rectifications/{rect_id}/retry", json={
        "new_deadline": new_deadline,
        "new_assignee": "王副店"
    })
    new_rect = test("创建重试任务", r, 201)
    new_rect_id = new_rect["id"]
    print(f"  新任务ID: {new_rect_id}, 重试次数: {new_rect['retry_count']}, 父任务: {new_rect['parent_id']}")

    r = requests.post(f"{BASE_URL}/api/inspections/rectifications/{new_rect_id}/start", json={
        "actor": "王副店"
    })
    test("重试任务 - 开始整改", r, 200)

    r = requests.post(f"{BASE_URL}/api/inspections/rectifications/{new_rect_id}/submit", json={
        "rectification_description": "二次清洁完成"
    })
    test("重试任务 - 提交整改", r, 200)

    r = requests.post(f"{BASE_URL}/api/inspections/rectifications/{new_rect_id}/start-recheck", json={
        "rechecker": "王复查"
    })
    test("重试任务 - 开始复查", r, 200)

    r = requests.post(f"{BASE_URL}/api/inspections/rectifications/{new_rect_id}/complete-recheck?level=1", json={
        "rechecker": "王复查",
        "recheck_result": "通过",
        "recheck_remark": "符合标准"
    })
    result = test("重试任务 - 复查通过", r, 200)
    if result:
        print(f"  最终得分: {result.get('final_score')}, 扣分: {result.get('final_deduction')}")

    r = requests.get(f"{BASE_URL}/api/inspections/rectifications/{new_rect_id}/trace")
    trace = test("查看完整追踪", r, 200)
    if trace:
        print(f"  重试链: {len(trace.get('retry_chain', []))} 个任务")
        print(f"  事件数: {len(trace.get('events', []))} 条")
        for e in trace.get('events', []):
            from_s = e.get('from') or '-'
            print(f"    {e['time'][:19]} | {e['type']:12s} | {from_s:10s} → {e['to']:10s} | {e.get('actor') or '系统'}")

    r = requests.get(f"{BASE_URL}/api/reports/regions")
    test("区域报表", r, 200)

    r = requests.get(f"{BASE_URL}/api/reports/export/rectifications")
    if r.status_code == 200:
        with open("test_export_all.xlsx", "wb") as f:
            f.write(r.content)
        print(f"\n✓ 批量导出 Excel: test_export_all.xlsx ({len(r.content)} bytes)")

    r = requests.get(f"{BASE_URL}/api/reports/export/trace/{new_rect_id}")
    if r.status_code == 200:
        with open(f"test_export_trace_{new_rect_id}.xlsx", "wb") as f:
            f.write(r.content)
        print(f"✓ 追踪导出 Excel: test_export_trace_{new_rect_id}.xlsx ({len(r.content)} bytes)")

    print("\n" + "=" * 60)
    print("  核心测试完成！")
    print("=" * 60)
    print("""
下一步：
1. 浏览器访问 http://localhost:8000/docs 查看交互文档
2. 查看 README.md 了解完整业务规则
3. 检查导出的 Excel 文件
""")


if __name__ == "__main__":
    main()
