from datetime import datetime, timedelta
from fastapi.testclient import TestClient
from main import app


client = TestClient(app)


def run_demo():
    print("=" * 70)
    print("港湾淤积空间标注接口 - 值班员交接场景演示")
    print("=" * 70)

    print("\n【场景 1】小宋早班创建记录，只有部分采样瓶")
    resp = client.post(
        "/records",
        json={
            "station_code": "A03",
            "target_harbor": "大连港",
            "operator": "小宋",
            "bottles": [
                {
                    "bottle_id": "HW-20250315-A03-072",
                    "sampling_time": "2025-03-15T10:00:00",
                    "station_code": "A03",
                    "experiment_result": 12.5,
                    "experiment_unit": "kg/m³",
                    "experiment_time": "2025-03-16T08:00:00",
                }
            ],
        },
    )
    data = resp.json()
    record_id = data["record_id"]
    print(f"  记录ID: {record_id}")
    print(f"  状态: 【{data['status']}】 颜色: {data['status_color']}")
    print(f"  一句话摘要: {data['summary']}")
    print(f"  待办: {data['pending_actions']}")

    print("\n【场景 2】小宋发现采样瓶编号日期与实际采样对不上，查询校验")
    resp = client.post(
        "/tools/validate-bottle",
        json={
            "bottle": {
                "bottle_id": "HW-20250315-A03-072",
                "sampling_time": "2025-03-20T10:00:00",
                "station_code": "A03",
                "experiment_result": 12.5,
                "experiment_unit": "kg/m³",
                "experiment_time": "2025-03-21T08:00:00",
            }
        },
    )
    v = resp.json()
    print(f"  校验通过: {v['valid']}")
    for e in v["errors"]:
        print(f"    - [{e['category']}] {e['detail']}")
        if e.get("suggestion"):
            print(f"      建议: {e['suggestion']}")

    print("\n【场景 3】下午交接时，晚到附件采样瓶到了，后补不覆盖早先判断")
    resp = client.post(
        f"/records/{record_id}/bottles",
        json={
            "operator": "小王",
            "batch_note": "交接晚到附件，实验室刚送来",
            "change_reason": "补充采样瓶批次数据（交接晚到）",
            "bottles": [
                {
                    "bottle_id": "HW-20250316-A03-073",
                    "sampling_time": "2025-03-16T11:00:00",
                    "station_code": "A03",
                    "experiment_result": 65.2,
                    "experiment_unit": "mg/L",
                    "experiment_time": "2025-03-17T09:00:00",
                    "has_cloud_occlusion": True,
                    "cloud_occlusion_detail": "该站位对应遥感影像东北部被云层覆盖约30%",
                }
            ],
        },
    )
    data = resp.json()
    print(f"  状态: 【{data['status']}】")
    print(f"  一句话摘要: {data['summary']}")
    for s in data["detail_sections"]:
        if "疑点" in s["title"] or "变更" in s["title"]:
            print(f"  {s['title']}:")
            for item in s["items"]:
                print(f"    · {item['label']}: {item['value']}")

    print("\n【场景 4】算不出的记录不能消失，看错误类别（公式/单位/阈值）")
    resp_bad = client.post(
        "/records",
        json={
            "station_code": "B05",
            "target_harbor": "天津港",
            "operator": "小宋",
            "bottles": [
                {
                    "bottle_id": "HW-20250318-B05-001",
                    "sampling_time": "2025-03-18T10:00:00",
                    "station_code": "B05",
                    "experiment_result": 99999.0,
                    "experiment_unit": "unknown",
                    "experiment_time": "2025-03-19T08:00:00",
                }
            ],
        },
    )
    bad_data = resp_bad.json()
    print(f"  记录ID: {bad_data['record_id']}")
    print(f"  状态: 【{bad_data['status']}】")
    print(f"  摘要: {bad_data['summary']}")
    for s in bad_data["detail_sections"]:
        if "计算错误" in s["title"]:
            print(f"  {s['title']}:")
            for item in s["items"]:
                print(f"    {item['label']}: {item['value']}")

    print("\n【场景 5】现场老师人工改判，历史里能看到旧材料+新备注+改判原因")
    resp_manual = client.post(
        f"/records/{record_id}/manual",
        json={
            "new_conclusion": "人工复核：中度淤积（考虑现场实际水深与潮汐，云遮挡区域经验估算）",
            "change_reason": "现场老师登船核查，结合历史数据人工调整",
            "operator": "李老师",
            "remark": "现场签字确认，附纸质记录编号：HX-2025-0317-001",
        },
    )
    m = resp_manual.json()
    print(f"  状态: 【{m['status']}】  颜色: {m['status_color']}")
    print(f"  摘要: {m['summary']}")
    for s in m["detail_sections"]:
        if "变更历史" in s["title"]:
            print(f"  {s['title']}:")
            for item in s["items"]:
                print(f"    · {item['label']}")
                print(f"      {item['value']}")

    print("\n【场景 6】现场老师看列表，一眼分出已放行/待补/人工改过")
    resp_list = client.get("/records")
    lst = resp_list.json()
    print(f"  共 {len(lst)} 条记录:")
    for item in lst:
        marker = ""
        if item["is_manually_modified"]:
            marker = " ★人工改过"
        elif item["has_suspicions"]:
            marker = " ⚠疑点暂缓"
        elif item["has_errors"]:
            marker = " ✗待补证据"
        elif item["final_report_ready"]:
            marker = " ✓已放行"
        print(
            f"    [{item['status']}] {item['station_code']}站 {item['target_harbor']} "
            f"- {item['summary'][:50]}...{marker}"
        )

    print("\n" + "=" * 70)
    print("演示完成。核心业务规则已全部覆盖。")
    print("=" * 70)


if __name__ == "__main__":
    run_demo()
