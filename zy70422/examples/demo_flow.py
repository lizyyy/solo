import requests
import json
from datetime import datetime, timedelta

BASE_URL = "http://localhost:8000"


def print_section(title):
    print("\n" + "=" * 60)
    print(f"  {title}")
    print("=" * 60)


def print_response(label, response):
    print(f"\n[{label}]")
    print(f"  状态码: {response.status_code}")
    if response.headers.get('content-type', '').startswith('application/json'):
        data = response.json()
        print(f"  响应: {json.dumps(data, ensure_ascii=False, indent=2)}")
        return data
    else:
        print(f"  响应: (非JSON内容，长度 {len(response.content)} bytes)")
        return None


def main():
    print("=" * 60)
    print("  门店巡检整改 API - 完整演示")
    print("=" * 60)

    print_section("1. 健康检查")
    r = requests.get(f"{BASE_URL}/health")
    print_response("健康检查", r)
    if r.status_code != 200:
        print("服务未启动，请先运行: python3 -m uvicorn app.main:app --reload")
        return

    print_section("2. 查看基础数据")

    r = requests.get(f"{BASE_URL}/api/master/stores")
    stores = print_response("门店列表", r)

    r = requests.get(f"{BASE_URL}/api/master/items")
    items = print_response("巡检项列表", r)

    r = requests.get(f"{BASE_URL}/api/master/deduction-rules")
    print_response("扣分规则", r)

    store_id = 1
    item_id = 1

    print_section("3. 创建巡检")

    inspection_data = {
        "store_id": store_id,
        "inspector": "张巡检员",
        "remark": "5月份例行巡检"
    }
    r = requests.post(f"{BASE_URL}/api/inspections", json=inspection_data)
    inspection = print_response("创建巡检", r)
    inspection_id = inspection["id"]

    print_section("4. 添加巡检记录（不合格项）")

    record_data = {
        "item_id": item_id,
        "is_pass": False,
        "deduction_reason": "地面有明显污渍，墙角积灰",
        "remark": "需要立即整改"
    }
    r = requests.post(f"{BASE_URL}/api/inspections/{inspection_id}/records", json=record_data)
    record = print_response("添加不合格记录", r)
    record_id = record["id"]

    print_section("5. 完成巡检")

    r = requests.post(f"{BASE_URL}/api/inspections/{inspection_id}/complete")
    print_response("完成巡检", r)

    print_section("6. 分派整改任务")

    deadline = (datetime.utcnow() + timedelta(hours=48)).isoformat()
    rect_data = {
        "record_id": record_id,
        "assignee": "李店长",
        "deadline": deadline
    }
    r = requests.post(f"{BASE_URL}/api/inspections/rectifications", json=rect_data)
    rect = print_response("分派整改", r)
    rect_id = rect["id"]

    print_section("7. 开始整改")

    r = requests.post(f"{BASE_URL}/api/inspections/rectifications/{rect_id}/start", json={"actor": "李店长"})
    print_response("开始整改", r)

    print_section("8. 提交整改")

    submit_data = {
        "rectification_description": "已安排保洁人员全面清扫地面，重点清洁了墙角区域。已建立每日巡检制度。"
    }
    r = requests.post(f"{BASE_URL}/api/inspections/rectifications/{rect_id}/submit", json=submit_data)
    print_response("提交整改", r)

    print_section("9. 演示冲突场景（提交后再次提交）")

    r = requests.post(f"{BASE_URL}/api/inspections/rectifications/{rect_id}/submit", json=submit_data)
    print_response("重复提交（预期报错 409）", r)

    print_section("10. 开始复查")

    r = requests.post(f"{BASE_URL}/api/inspections/rectifications/{rect_id}/start-recheck", json={"rechecker": "王复查员"})
    print_response("开始复查", r)

    print_section("11. 复查不通过（演示重试场景）")

    recheck_data = {
        "recheck_result": "不通过",
        "recheck_remark": "仍有个别死角未清洁干净，需要重新整改"
    }
    r = requests.post(f"{BASE_URL}/api/inspections/rectifications/{rect_id}/complete-recheck", json=recheck_data)
    print_response("复查不通过", r)

    print_section("12. 创建重试整改任务")

    new_deadline = (datetime.utcnow() + timedelta(hours=24)).isoformat()
    r = requests.post(
        f"{BASE_URL}/api/inspections/rectifications/{rect_id}/retry",
        json={"new_deadline": new_deadline, "new_assignee": "王副店长"}
    )
    new_rect = print_response("创建重试任务", r)

    if new_rect and "id" in new_rect:
        new_rect_id = new_rect["id"]

        print(f"\n  新整改任务 ID: {new_rect_id}")
        print(f"  重试次数: {new_rect['retry_count']}")
        print(f"  父任务 ID: {new_rect['parent_id']}")

        print_section("13. 重试任务 - 开始整改")

        r = requests.post(f"{BASE_URL}/api/inspections/rectifications/{new_rect_id}/start", json={"actor": "王副店长"})
        print_response("重试任务 - 开始整改", r)

        print_section("14. 重试任务 - 提交整改")

        submit_data2 = {
            "rectification_description": "已进行二次全面清扫，对所有死角进行了重点处理。已对保洁人员进行培训。"
        }
        r = requests.post(f"{BASE_URL}/api/inspections/rectifications/{new_rect_id}/submit", json=submit_data2)
        print_response("重试任务 - 提交整改", r)

        print_section("15. 重试任务 - 开始复查")

        r = requests.post(f"{BASE_URL}/api/inspections/rectifications/{new_rect_id}/start-recheck", json={"rechecker": "王复查员"})
        print_response("重试任务 - 开始复查", r)

        print_section("16. 重试任务 - 复查通过（含扣分计算）")

        recheck_data2 = {
            "recheck_result": "通过",
            "recheck_remark": "本次检查符合标准，确认通过"
        }
        r = requests.post(
            f"{BASE_URL}/api/inspections/rectifications/{new_rect_id}/complete-recheck?level=1",
            json=recheck_data2
        )
        result = print_response("重试任务 - 复查通过", r)

        if result:
            print(f"\n  最终得分: {result.get('final_score')}")
            print(f"  最终扣分: {result.get('final_deduction')}")
            print(f"  说明: 因为重试了1次，在基础扣分上加了重试惩罚")

        print_section("17. 查看完整追踪（重试链路 + 事件 + 照片）")

        r = requests.get(f"{BASE_URL}/api/inspections/rectifications/{new_rect_id}/trace")
        trace = print_response("完整追踪", r)

        if trace:
            print(f"\n  重试链长度: {len(trace.get('retry_chain', []))}")
            print(f"  事件数量: {len(trace.get('events', []))}")
            print("\n  事件时间线:")
            for event in trace.get("events", []):
                from_s = event.get("from") or "无"
                print(f"    {event['time'][:19]} | {event['type']:15s} | {from_s:12s} → {event['to']:12s} | {event.get('actor') or '系统'}")

        print_section("18. 查看原任务事件（被拒绝）")

        r = requests.get(f"{BASE_URL}/api/inspections/rectifications/{rect_id}/events")
        print_response("原任务事件日志", r)
    else:
        print("\n  [跳过] 重试任务创建失败，可能是因为测试数据已存在")

    print_section("19. 查看区域报表")

    r = requests.get(f"{BASE_URL}/api/reports/regions")
    reports = print_response("区域报表", r)

    print_section("20. 演示撤销场景")

    print("  先创建一个新的整改任务用于演示撤销...")
    rect_data2 = {
        "record_id": record_id,
        "assignee": "测试用户",
        "deadline": (datetime.utcnow() + timedelta(hours=24)).isoformat()
    }
    r = requests.post(f"{BASE_URL}/api/inspections/rectifications", json=rect_data2)

    if r.status_code == 201:
        cancel_rect = r.json()
        cancel_id = cancel_rect["id"]
        print(f"  创建的任务 ID: {cancel_id}")

        r = requests.post(
            f"{BASE_URL}/api/inspections/rectifications/{cancel_id}/cancel",
            json={"reason": "测试撤销功能", "actor": "管理员"}
        )
        print_response("撤销整改任务", r)

        r = requests.get(f"{BASE_URL}/api/inspections/rectifications/{cancel_id}/events")
        print_response("撤销后的事件日志", r)
    else:
        print(f"  创建任务失败，状态码: {r.status_code}")
        print(f"  响应: {r.text}")

    print_section("21. 导出功能演示")

    print("  下载区域整改汇总 Excel...")
    r = requests.get(f"{BASE_URL}/api/reports/export/rectifications")
    if r.status_code == 200:
        filename = "demo_rectifications.xlsx"
        with open(filename, "wb") as f:
            f.write(r.content)
        print(f"  已保存到: {filename}")
        print(f"  文件大小: {len(r.content)} bytes")

    if 'new_rect_id' in locals():
        print(f"\n  下载任务 #{new_rect_id} 的追踪 Excel...")
        r = requests.get(f"{BASE_URL}/api/reports/export/trace/{new_rect_id}")
        if r.status_code == 200:
            filename = f"demo_trace_{new_rect_id}.xlsx"
            with open(filename, "wb") as f:
                f.write(r.content)
            print(f"  已保存到: {filename}")

    print_section("22. 演示状态机检查（已通过的任务不能操作）")

    if 'new_rect_id' in locals():
        r = requests.post(f"{BASE_URL}/api/inspections/rectifications/{new_rect_id}/submit", json=submit_data2)
        print_response("对已通过任务提交（预期报错 409）", r)

    print_section("23. 最终状态汇总")

    r = requests.get(f"{BASE_URL}/api/inspections/rectifications")
    rects = print_response("所有整改任务", r)

    if rects:
        print("\n  任务状态统计:")
        status_counts = {}
        for r_item in rects:
            status = r_item["status"]
            status_counts[status] = status_counts.get(status, 0) + 1
        for status, count in status_counts.items():
            print(f"    {status}: {count} 个")

    print("\n" + "=" * 60)
    print("  演示完成！")
    print("=" * 60)
    print("""
下一步可以做什么：
1. 打开浏览器访问 http://localhost:8000/docs 查看交互文档
2. 查看 README.md 了解完整业务规则
3. 查看导出的 Excel 文件（demo_*.xlsx）
4. 尝试各种异常场景测试
""")


if __name__ == "__main__":
    main()
