#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
耳返频段冲突记录系统 - 周报撤回数据范围恢复验证脚本

场景：先生成只含 1 条记录的周报 → 误导入"青花瓷(即兴版)/青花瓷"双名歌曲 → 
     生成新周报（含2条）→ 撤回周报 → 验证所有出口都排除误导入记录

运行方式：
1. 先启动后端服务：npm run dev  (端口 3000)
2. 再运行本脚本：python3 tests/verify_rollback_scope.py
"""

import json
import urllib.request
import urllib.error

BASE = "http://localhost:3000"


def hr(title, ch="="):
    print("\n" + ch * 60)
    print(f"  {title}")
    print(ch * 60)


def api(path, method="GET", data=None):
    url = BASE + path
    body = None
    headers = {"Content-Type": "application/json"} if data else {}
    if data:
        body = json.dumps(data).encode("utf-8")
    req = urllib.request.Request(url, data=body, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        err_body = e.read().decode("utf-8")
        raise RuntimeError(f"API {method} {path} 失败: {e.code} {err_body}")


def export_csv(include_rolled_back=False):
    url = BASE + f"/api/export?includeRolledBack={str(include_rolled_back).lower()}"
    with urllib.request.urlopen(url) as r:
        csv = r.read().decode("utf-8")
        if csv.startswith("\ufeff"):
            csv = csv[1:]
        return csv


def parse_csv(csv_text):
    lines = [l for l in csv_text.split("\n") if l.strip()]
    if not lines:
        return []
    headers = lines[0].split(",")
    rows = []
    for l in lines[1:]:
        cols = l.split(",")
        row = dict(zip(headers, cols))
        rows.append(row)
    return rows


def main():
    print("=" * 60)
    print("  耳返频段冲突记录系统 - 周报撤回数据范围恢复验证")
    print("=" * 60)
    print(f"  后端服务: {BASE}")
    print(f"  测试场景: 1条 → 误导入双名 → 2条 → 撤回 → 恢复到1条")
    print("=" * 60)

    # ===== 步骤 1：第一次导入 1 条"晴天" =====
    hr("步骤 1：授权期限页第一次导入（1 条：晴天）")
    imp1 = api("/api/import", "POST", {
        "rows": [{
            "originalRowNumber": 1,
            "liveName": "晴天",
            "copyrightName": "晴天",
            "band": "CH01",
            "conflictDescription": "无线话筒CH01轻微干扰"
        }],
        "importedBy": "琴行店长老周",
        "source": "授权期限页"
    })
    batch1_id = imp1["data"]["batch"]["id"]
    rec1_id = imp1["data"]["records"][0]["id"]
    print(f"✓ 导入批次: {batch1_id}")
    print(f"✓ 记录ID: {rec1_id}")
    print(f"✓ 歌曲: {imp1['data']['records'][0]['song']['liveName']}")
    print(f"✓ 当前活动记录数: {len(api('/api/records')['data'])}")

    # 标记为正常
    api(f"/api/records/{rec1_id}/status", "POST", {
        "newStatus": "normal",
        "updatedBy": "琴行店长老周",
        "reason": "检查过没问题，频段已协调"
    })
    print("✓ 已标记为正常")

    # ===== 步骤 2：生成第一版周报（只有 1 条） =====
    hr("步骤 2：生成第一版周报（只有 1 条：晴天）")
    report1 = api("/api/weekly-report", "POST", {"createdBy": "琴行店长老周"})
    r1 = report1["data"]
    print(f"✓ 周报版本ID: {r1['id']}")
    print(f"✓ 总记录数: {r1['totalCount']} (预期 1)")
    print(f"✓ 正常: {r1['normalCount']}, 待复核: {r1['pendingCount']}, 待老师复核: {r1['teacherReviewCount']}")
    print(f"✓ 快照记录数: {len(r1['snapshotRecordIds'])} (预期 1)")
    assert r1["totalCount"] == 1, f"期望 1 条，实际 {r1['totalCount']}"
    assert len(r1["snapshotRecordIds"]) == 1
    assert rec1_id in r1["snapshotRecordIds"]

    # 验证 API 和导出
    api_recs = api("/api/records")["data"]
    csv_rows = parse_csv(export_csv())
    print(f"✓ API 返回记录数: {len(api_recs)} (预期 1)")
    print(f"✓ CSV 导出记录数: {len(csv_rows)} (预期 1)")
    assert len(api_recs) == 1
    assert len(csv_rows) == 1
    assert api_recs[0]["song"]["liveName"] == "晴天"
    assert csv_rows[0]["现场名"] == "晴天"

    # ===== 步骤 3：误导入"青花瓷(即兴版)/青花瓷"双名歌曲 =====
    hr("步骤 3：误导入双名歌曲「青花瓷(即兴版)/青花瓷」")
    imp2 = api("/api/import", "POST", {
        "rows": [{
            "originalRowNumber": 2,
            "liveName": "青花瓷(即兴版)",
            "copyrightName": "青花瓷",
            "band": "CH02",
            "conflictDescription": "同曲异名频段与贝斯冲突"
        }],
        "importedBy": "琴行店长老周",
        "source": "授权期限页（误导入）"
    })
    rec_dual_id = imp2["data"]["records"][0]["id"]
    print(f"✓ 导入批次: {imp2['data']['batch']['id']}")
    print(f"✓ 记录ID: {rec_dual_id}")
    print(f"✓ 是否双名: {imp2['data']['records'][0]['song']['hasDualNames']} (预期 True)")
    print(f"✓ 处理状态: {imp2['data']['records'][0]['processingStatus']} (预期 needs_teacher_review)")
    assert imp2["data"]["records"][0]["song"]["hasDualNames"] is True
    assert imp2["data"]["records"][0]["processingStatus"] == "needs_teacher_review"

    # 验证现在有 2 条活动记录
    api_recs2 = api("/api/records")["data"]
    csv_rows2 = parse_csv(export_csv())
    print(f"✓ API 返回记录数: {len(api_recs2)} (预期 2)")
    print(f"✓ CSV 导出记录数: {len(csv_rows2)} (预期 2)")
    assert len(api_recs2) == 2
    assert len(csv_rows2) == 2
    assert any(r["song"]["liveName"] == "青花瓷(即兴版)" for r in api_recs2)
    assert any(r["现场名"] == "青花瓷(即兴版)" for r in csv_rows2)

    # ===== 步骤 4：生成第二版周报（现在有 2 条） =====
    hr("步骤 4：生成第二版周报（含误导入记录，共 2 条）")
    report2 = api("/api/weekly-report", "POST", {"createdBy": "琴行店长老周"})
    r2 = report2["data"]
    print(f"✓ 周报版本ID: {r2['id']}")
    print(f"✓ 总记录数: {r2['totalCount']} (预期 2)")
    print(f"✓ 正常: {r2['normalCount']}, 待复核: {r2['pendingCount']}, 待老师复核: {r2['teacherReviewCount']}")
    print(f"✓ 快照记录数: {len(r2['snapshotRecordIds'])} (预期 2)")
    assert r2["totalCount"] == 2
    assert r2["teacherReviewCount"] == 1
    assert len(r2["snapshotRecordIds"]) == 2
    assert rec_dual_id in r2["snapshotRecordIds"]

    # 验证周报内容包含双名歌曲
    print(f"✓ 周报内容包含'青花瓷(即兴版)': {'青花瓷(即兴版)' in r2['content']}")
    assert "青花瓷(即兴版)" in r2["content"]
    assert "待音乐老师复核" in r2["content"]

    # ===== 步骤 5：撤回周报 → 恢复到第一版 =====
    hr("步骤 5：撤回上一版周报（店长发现误导入，撤回到第一版）")
    rollback = api("/api/weekly-report/rollback", "POST")
    rb = rollback["data"]
    print(f"✓ 已恢复到周报版本: {rb['id']}")
    print(f"✓ (预期为第一版ID: {r1['id']})")
    assert rb["id"] == r1["id"]

    # ===== 步骤 6：验证所有出口都排除了误导入的双名歌曲 =====
    hr("步骤 6：验证所有出口（页面/API/导出/周报）都排除误导入记录")

    # API 验证
    api_after = api("/api/records")["data"]
    api_ids = {r["id"] for r in api_after}
    print(f"✓ API 返回活动记录数: {len(api_after)} (预期 1)")
    print(f"✓ API 返回记录ID: {api_ids}")
    print(f"✓ 误导入记录 {rec_dual_id} 是否已被排除: {rec_dual_id not in api_ids} (预期 True)")
    assert len(api_after) == 1
    assert rec_dual_id not in api_ids
    assert api_after[0]["song"]["liveName"] == "晴天"
    assert api_after[0]["song"]["copyrightName"] == "晴天"

    # 导出 CSV 验证
    csv_after = parse_csv(export_csv())
    csv_ids = {r["记录ID"] for r in csv_after}
    print(f"✓ CSV 导出活动记录数: {len(csv_after)} (预期 1)")
    print(f"✓ CSV 导出记录ID: {csv_ids}")
    print(f"✓ CSV 中是否包含'青花瓷(即兴版)': {'青花瓷(即兴版)' in export_csv()} (预期 False)")
    print(f"✓ CSV 中是否包含'晴天': {'晴天' in export_csv()} (预期 True)")
    assert len(csv_after) == 1
    assert rec_dual_id not in csv_ids
    assert csv_after[0]["现场名"] == "晴天"
    assert "青花瓷(即兴版)" not in export_csv()

    # 周报验证
    current_report = api("/api/weekly-report")["data"]
    print(f"✓ 当前周报总记录数: {current_report['totalCount']} (预期 1)")
    print(f"✓ 周报内容是否包含'青花瓷(即兴版)': {'青花瓷(即兴版)' in current_report['content']} (预期 False)")
    print(f"✓ 周报内容是否包含'晴天': {'晴天' in current_report['content']} (预期 True)")
    assert current_report["totalCount"] == 1
    assert current_report["id"] == r1["id"]
    assert "青花瓷(即兴版)" not in current_report["content"]
    assert "晴天" in current_report["content"]

    # 活动记录 workflowStep 验证
    print(f"✓ 晴天记录 workflowStep: {api_after[0]['workflowStep']} (预期 engineer_message_added 或 initial_import)")
    assert api_after[0]["workflowStep"] in ["engineer_message_added", "initial_import"]

    # ===== 步骤 7：验证误导入记录仍在数据库中但标记为撤回，历史可查 =====
    hr("步骤 7：验证误导入记录仍在数据库中（标记为撤回，历史可查）")

    api_all = api("/api/records?includeRolledBack=true")["data"]
    csv_all = parse_csv(export_csv(include_rolled_back=True))
    print(f"✓ 含撤回的总记录数: {len(api_all)} (预期 2)")
    assert len(api_all) == 2

    dual_rolled = next(r for r in api_all if r["id"] == rec_dual_id)
    print(f"✓ 误导入记录 isRolledBack: {dual_rolled['isRolledBack']} (预期 True)")
    print(f"✓ 歌曲名: {dual_rolled['song']['liveName']} / {dual_rolled['song']['copyrightName']}")
    print(f"✓ 处理状态: {dual_rolled['processingStatus']}")
    assert dual_rolled["isRolledBack"] is True
    assert dual_rolled["song"]["liveName"] == "青花瓷(即兴版)"
    assert dual_rolled["song"]["copyrightName"] == "青花瓷"

    # 历史记录验证
    hist = api(f"/api/records/{rec_dual_id}/history")["data"]
    print(f"✓ 误导入记录的改动历史数: {len(hist)} (预期至少 1 条撤回记录)")
    rollback_hist = [h for h in hist if h["field"] == "isRolledBack" and "周报撤回" in h["reason"]]
    if rollback_hist:
        h = rollback_hist[0]
        print(f"✓ 撤回历史记录:")
        print(f"    时间: {h['changedAt']}")
        print(f"    操作人: {h['changedBy']}")
        print(f"    字段: {h['field']}")
        print(f"    变化: {h['oldValue']} → {h['newValue']}")
        print(f"    原因: {h['reason']}")
        assert h["changedBy"] == "琴行店长老周"
        assert h["oldValue"] == "false"
        assert h["newValue"] == "true"
        assert "周报撤回" in h["reason"]
        assert r1["id"] in h["reason"]
    else:
        raise AssertionError("未找到撤回历史记录！")

    # CSV 含撤回的导出验证
    csv_all_rows = parse_csv(export_csv(include_rolled_back=True))
    dual_csv = next(r for r in csv_all_rows if r["记录ID"] == rec_dual_id)
    print(f"✓ CSV(含撤回) 中误导入记录 是否已撤回: {dual_csv['是否已撤回']} (预期 是)")
    assert dual_csv["是否已撤回"] == "是"

    # ===== 步骤 8：三处同源验证 =====
    hr("步骤 8：三处同源最终验证（页面/API/导出）")
    api_ids_active = {r["id"] for r in api("/api/records")["data"]}
    csv_ids_active = {r["记录ID"] for r in parse_csv(export_csv())}
    print(f"✓ API 活动ID: {api_ids_active}")
    print(f"✓ CSV 活动ID: {csv_ids_active}")
    print(f"✓ ID 集合完全一致: {api_ids_active == csv_ids_active} (预期 True)")
    assert api_ids_active == csv_ids_active
    assert api_ids_active == {rec1_id}

    hr("✅ 全部验证通过！", ch="★")
    print("""
  验证要点总结：
  1. 撤回前：API=2条, CSV=2条, 周报=2条，都包含双名歌曲
  2. 撤回后：API=1条, CSV=1条, 周报=1条，都排除双名歌曲
  3. 误导入记录仍在数据库中，标记为 isRolledBack=true
  4. 历史记录完整：撤回人、原因、时间、前后值均可追溯
  5. 三处同源：页面/API/导出的活动记录 ID 集合完全一致
""")


if __name__ == "__main__":
    main()
