from __future__ import annotations

from fastapi.testclient import TestClient
from main import app


client = TestClient(app)


def run_acceptance():
    print("=" * 78)
    print("【补录链路验收测试】 缺实验结果 → 补录同编号瓶 → 合并重算 → 结论变化可见")
    print("=" * 78)

    print("\n" + "─" * 78)
    print("【验收步骤 1】POST /records 创建记录：提交采样瓶但缺实验结果")
    print("─" * 78)
    resp1 = client.post(
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
                    "experiment_result": None,
                    "experiment_unit": None,
                    "experiment_time": None,
                    "remarks": "采样瓶已登记，实验结果待实验室返回",
                }
            ],
        },
    )
    data1 = resp1.json()
    record_id = data1["record_id"]
    print(f"  记录ID: {record_id}")
    print(f"  状态标签: 【{data1['status']}】  颜色: {data1['status_color']}")
    print(f"  能否进入最终报告: {'是' if data1['detail_sections'][0]['items'][3]['value'] == '是' else '否'}")
    print(f"  一句话摘要（可直接沟通）:")
    print(f"    → {data1['summary']}")
    print(f"  待办动作:")
    for a in data1["pending_actions"]:
        print(f"    · {a}")

    assert data1["status"] == "待补证据", "❌ 缺实验结果时状态应为 '待补证据'，不应是计算失败"
    assert "等证据" in data1["summary"] or "待补" in data1["summary"], "❌ 摘要应体现正在等证据"
    print("  ✅ 验收通过：缺实验结果时状态落在 待补证据，而非计算失败")

    print("\n" + "─" * 78)
    print("【验收步骤 2】POST /records/{id}/bottles 补录：同一采样瓶编号，补充实验结果")
    print("─" * 78)
    resp2 = client.post(
        f"/records/{record_id}/bottles",
        json={
            "operator": "小王",
            "batch_note": "交接晚到附件，实验室刚送来HW-20250315-A03-072的报告",
            "change_reason": "补录晚到实验结果",
            "bottles": [
                {
                    "bottle_id": "HW-20250315-A03-072",
                    "experiment_result": 18.5,
                    "experiment_unit": "kg/m³",
                    "experiment_time": "2025-03-16T14:30:00",
                    "remarks": "实验室编号：LAB-2025-0316-042，复核人：张工",
                    "raw_data": {
                        "attachment_id": "ATT-2025-0317-001",
                        "source": "晚到附件",
                        "lab_report_no": "LAB-2025-0316-042",
                    },
                }
            ],
        },
    )
    data2 = resp2.json()
    print(f"  状态标签: 【{data2['status']}】  颜色: {data2['status_color']}")
    print(f"  淤积量: {data2['detail_sections'][0]['items'][1]['value']}")
    print(f"  结论: {data2['detail_sections'][0]['items'][2]['value']}")
    print(f"  能否进入最终报告: {'是' if data2['detail_sections'][0]['items'][3]['value'] == '是' else '否'}")
    print(f"  一句话摘要（可直接沟通）:")
    print(f"    → {data2['summary']}")

    assert data2["status"] != "计算失败", "❌ 补录后不应仍是计算失败"
    assert data2["status"] == "已放行", "❌ 补录全部字段后状态应为 '已放行'"
    conclusion_item = data2["detail_sections"][0]["items"][2]["value"]
    sediment_item = data2["detail_sections"][0]["items"][1]["value"]
    assert sediment_item != "未计算", "❌ 淤积量应已算出"
    assert "淤积" in conclusion_item and "未计算" not in conclusion_item, "❌ 结论应已生成"
    print("  ✅ 验收通过：补录后合并了材料并重新判断，不再是计算失败")

    print("\n" + "─" * 78)
    print("【验收步骤 3】查看变更历史：旧材料、新增/覆盖内容、备注、改判原因")
    print("─" * 78)
    resp_hist = client.get(f"/records/{record_id}/history")
    history = resp_hist.json()
    print(f"  共 {len(history)} 条变更记录：")
    for i, h in enumerate(history):
        print(f"\n  第 {i+1} 条  版本 {h['version']}  {h['change_time']}  操作人：{h['operator'] or '未填'}")
        print(f"    改判原因: {h['change_reason']}")
        print(f"    结论变化: 「{h['old_conclusion'] or '无'}」 → 「{h['new_conclusion'] or '无'}」")
        if h.get("new_remark"):
            print(f"    备注: {h['new_remark']}")
        merged = h["new_material"].get("merged_bottles", [])
        for m in merged:
            print(f"    补录采样瓶 {m['bottle_id']}：")
            added = list(m.get("added_fields", {}).keys())
            overwritten = list(m.get("overwritten_fields", {}).keys())
            if added:
                print(f"      新增字段: {', '.join(added)}")
                for f in added:
                    val = m["added_fields"][f]
                    if isinstance(val, dict) and "from" in val:
                        before = val["from"]
                        after = val["to"]
                        print(f"        · {f}: {before} → {after}")
                    else:
                        print(f"        · {f}: {val}")
            if overwritten:
                print(f"      覆盖字段: {', '.join(overwritten)}")
                for f in overwritten:
                    val = m["overwritten_fields"][f]
                    if isinstance(val, dict) and "from" in val:
                        before = val["from"]
                        after = val["to"]
                        print(f"        · {f}: {before} → {after}")
                    else:
                        print(f"        · {f}: {val}")

    latest = history[0]
    assert "补录字段" in latest["change_reason"], "❌ 变更历史中改判原因应体现补录字段"
    assert latest["old_conclusion"] is None or latest["old_conclusion"] == "", "❌ 旧结论应为空"
    assert latest["new_conclusion"] is not None and latest["new_conclusion"] != "", "❌ 新结论应已生成"
    assert len(latest["new_material"]["merged_bottles"]) >= 1, "❌ 变更历史中应有合并详情"
    merged_info = latest["new_material"]["merged_bottles"][0]
    assert "experiment_result" in merged_info["added_fields"], "❌ 应记录新增了 experiment_result"
    assert "experiment_unit" in merged_info["added_fields"], "❌ 应记录新增了 experiment_unit"
    print("  ✅ 验收通过：历史中能看到旧材料、新增/覆盖内容、备注、新旧结论、改判原因")

    print("\n" + "─" * 78)
    print("【验收步骤 4】GET /records 列表：一眼区分已放行/待补/人工改过")
    print("─" * 78)

    print("\n  再创建2条对比记录，看列表状态标识：")
    client.post(
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

    resp_manual = client.post(
        "/records",
        json={
            "station_code": "C02",
            "target_harbor": "青岛港",
            "operator": "小宋",
            "bottles": [
                {
                    "bottle_id": "HW-20250319-C02-001",
                    "sampling_time": "2025-03-19T10:00:00",
                    "station_code": "C02",
                    "experiment_result": 25.0,
                    "experiment_unit": "kg/m³",
                    "experiment_time": "2025-03-20T08:00:00",
                }
            ],
        },
    )
    manual_id = resp_manual.json()["record_id"]
    client.post(
        f"/records/{manual_id}/manual",
        json={
            "new_conclusion": "人工复核：中度淤积",
            "change_reason": "现场老师登船核查后调整",
            "operator": "李老师",
            "remark": "现场核查水深异常",
        },
    )

    resp_list = client.get("/records")
    lst = resp_list.json()
    print(f"\n  共 {len(lst)} 条记录，现场老师视角：")
    for item in lst:
        status = item["status"]
        color = item["status_color"]
        marker = ""
        if item["is_manually_modified"]:
            marker = " ★ 人工改过"
        elif item["has_suspicions"]:
            marker = " ⚠ 疑点暂缓"
        elif item["has_errors"]:
            marker = " ✗ 有错误"
        elif item["final_report_ready"]:
            marker = " ✓ 已放行，可进最终报告"
        else:
            marker = " ⏳ 待补证据"
        print(f"    [{status}] {color}  {item['station_code']}站 {item['target_harbor']}{marker}")
        print(f"       {item['summary']}")

    statuses = {item["target_harbor"]: item["status"] for item in lst}
    flags = {item["target_harbor"]: item for item in lst}
    assert statuses["大连港"] == "已放行", "❌ 大连港（补录完成）状态应为已放行"
    assert flags["大连港"]["final_report_ready"] is True, "❌ 大连港应可进入最终报告"
    assert statuses["天津港"] == "计算失败", "❌ 天津港（单位错误）状态应为计算失败"
    assert flags["天津港"]["has_errors"] is True, "❌ 天津港应有错误标记"
    assert statuses["青岛港"] == "人工改过", "❌ 青岛港（人工改判）状态应为人工改过"
    assert flags["青岛港"]["is_manually_modified"] is True, "❌ 青岛港应有人工改过标记"
    print("\n  ✅ 验收通过：列表中一眼可区分 已放行 / 待补证据 / 计算失败 / 人工改过")

    print("\n" + "─" * 78)
    print("【验收步骤 5】GET /records/{id} 详情：看补录让结论怎么变、依据是什么")
    print("─" * 78)
    resp_detail = client.get(f"/records/{record_id}")
    detail = resp_detail.json()
    print(f"\n  记录 {record_id} 详情：")
    print(f"  状态: 【{detail['status']}】  {detail['status_color']}")
    print(f"  摘要: {detail['summary']}")
    print(f"\n  详细分区：")
    for sec in detail["detail_sections"]:
        print(f"\n  ■ {sec['title']}")
        for item in sec["items"]:
            print(f"    · {item['label']}: {item['value']}")
    print(f"\n  待办: {detail['pending_actions']}")

    section_titles = [s["title"] for s in detail["detail_sections"]]
    assert "一、淤积结论" in section_titles
    assert "二、涉及采样瓶" in section_titles
    has_history = any("变更历史" in t for t in section_titles)
    assert has_history, "❌ 详情页应包含变更历史分区"
    print("\n  ✅ 验收通过：详情页分区展示，直接看到结论怎么变、依据是什么")

    print("\n" + "=" * 78)
    print("🎉 全部验收通过！补录链路已完整修复：")
    print("=" * 78)
    print("  ✓ 缺实验结果时状态落在 '待补证据'，而非 '计算失败'")
    print("  ✓ 同编号采样瓶补录时按字段合并，不再简单丢弃")
    print("  ✓ 补录后重新计算，结论自动更新")
    print("  ✓ 历史中可看到：补录前材料快照、新增/覆盖字段、操作备注、新旧结论、改判原因")
    print("  ✓ 列表中一眼可区分：已放行 / 待补证据 / 计算失败 / 人工改过")
    print("  ✓ 接口返回不是功能清单，而是可直接拿去沟通的结构化结果")
    print("=" * 78)


if __name__ == "__main__":
    run_acceptance()
