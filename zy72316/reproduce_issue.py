#!/usr/bin/env python3
"""
插值曲线仪表修补 - 完整复现脚本

复现场景：
1. 跳步拦截测试（导入后直接调用反例更新应该报错）
2. 正常流程：导入 → 补看截图 → 更新反例
3. 边界值等于阈值场景
4. 改值重算（触发插值和边界判定重算）
5. 任课老师复核
6. 导出 JSON/CSV 并解析验证
7. 多视图一致性核对
"""
import json
import os
import sqlite3
import sys
import urllib.request
import urllib.error

BASE = "http://localhost:8000/api/interpolation-gauge"
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "reproduction_output")
os.makedirs(OUTPUT_DIR, exist_ok=True)


def post(path, data, expect_status=200):
    req = urllib.request.Request(
        f"{BASE}{path}",
        data=json.dumps(data).encode(),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as resp:
            return resp.status, json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode()
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"detail": body}


def get(path, raw=False):
    if path == "/__root__":
        url = "http://localhost:8000/"
    else:
        url = f"{BASE}{path}"
    with urllib.request.urlopen(url) as resp:
        if raw:
            return resp.status, resp.read().decode()
        return resp.status, json.loads(resp.read())


def save_json(name, data):
    fp = os.path.join(OUTPUT_DIR, name)
    with open(fp, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    return fp


def save_text(name, text):
    fp = os.path.join(OUTPUT_DIR, name)
    with open(fp, "w", encoding="utf-8") as f:
        f.write(text)
    return fp


def query_db(db_path, sql):
    """读取持久化数据（SQLite）"""
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    cur = conn.cursor()
    cur.execute(sql)
    rows = [dict(r) for r in cur.fetchall()]
    conn.close()
    return rows


def section(title):
    bar = "=" * 70
    print(f"\n{bar}\n{title}\n{bar}")


def main():
    print("=" * 70)
    print("插值曲线仪表修补 - 完整复现脚本")
    print("=" * 70)

    # ========== 环境检查 ==========
    section("环境检查")
    status, data = get("/__root__")  # root
    print(f"  [✓] 服务运行状态: HTTP {status}, {data}")
    db_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "interpolation_gauge.db")
    print(f"  [✓] 数据库路径: {db_path}  存在: {os.path.exists(db_path)}")

    # ========== 场景 1：跳步拦截测试 ==========
    section("场景 1：跳步拦截测试（导入后直接调用反例更新，应该失败）")

    # 1a 先导入
    status, imp = post("/import", {
        "rows": [
            {"original_row_number": 1, "indicator_name": "课堂参与度", "threshold": 80.0, "weight": 0.3, "original_value": 60.0},
            {"original_row_number": 2, "indicator_name": "期末笔试",     "threshold": 80.0, "weight": 0.4, "original_value": 80.0},
            {"original_row_number": 3, "indicator_name": "实践报告",     "threshold": 80.0, "weight": 0.3, "original_value": 95.0},
        ]
    })
    batch_id = imp["import_batch_id"]
    print(f"  [✓] 导入成功 batch_id={batch_id}, 当前阶段={imp['current_phase']}")
    print(f"     boundary_equal_threshold_count={imp['boundary_equal_threshold_count']}")
    save_json("01_import_result.json", imp)

    # 获取 row2_id（边界值等于阈值的那行）
    status, details = get(f"/batch/{batch_id}")
    row1_id = [d for d in details if d["row"]["original_row_number"] == 1][0]["row"]["id"]
    row2_id = [d for d in details if d["row"]["original_row_number"] == 2][0]["row"]["id"]
    row3_id = [d for d in details if d["row"]["original_row_number"] == 3][0]["row"]["id"]
    print(f"  row IDs: row1={row1_id}, row2(边界)={row2_id}, row3={row3_id}")
    save_json("01_batch_details_after_import.json", details)

    # 1b 直接调用反例更新（跳步，应该失败）
    print("\n  [测试] 导入后直接调用 update-counterexample（跳步到第3步）...")
    status, err = post("/update-counterexample", {
        "import_batch_id": batch_id, "row_id": row2_id,
        "counterexample_note": "测试跳步"
    }, expect_status=400)
    print(f"  [✓] 跳步拦截成功: HTTP {status}")
    print(f"     错误信息: {err.get('detail', str(err))}")
    assert status == 400, f"跳步应返回 400，实际返回 {status}"
    assert "禁止跳步" in str(err), "错误信息应包含'禁止跳步'"
    save_json("02_skip_step_blocked.json", {"status": status, "error": err})

    # 1c 直接调用 manual_override（应该也被拦截，需要先完成第2步）
    print("\n  [测试] 导入后直接调用 manual-override（应被拦截，需要先完成第2步）...")
    status, err = post("/manual-override", {
        "row_id": row2_id, "field_name": "original_value", "new_value": "79.5",
        "change_reason": "测试跳步改值", "changed_by": "analyst_qi"
    }, expect_status=400)
    print(f"  [✓] 跳步改值拦截成功: HTTP {status}")
    print(f"     错误信息: {err.get('detail', str(err))}")
    assert status == 400
    assert "禁止跳步修改" in str(err)
    save_json("02b_skip_override_blocked.json", {"status": status, "error": err})

    # ========== 场景 2：按顺序推进 ==========
    section("场景 2：按顺序推进（导入 → 补看截图 → 更新反例）")

    # 2a 第二步：补看旧公式截图（全部行）
    print("\n  [第二步] 补看旧公式截图（逐行处理）...")
    screenshot_refs = {
        row1_id: "old_formula_课堂参与度_v20260619.png",
        row2_id: "old_formula_期末笔试_v20260619.png",
        row3_id: "old_formula_实践报告_v20260619.png",
    }
    notes = {
        row1_id: "阈值80.0确认无误，原始值60.0<80，正常",
        row2_id: "旧公式截图中阈值=80，原始值=80，边界值等于阈值，未见特殊处理说明，需任课老师明确",
        row3_id: "阈值80.0确认无误，原始值95.0>80，正常",
    }
    for rid in [row1_id, row2_id, row3_id]:
        status, resp = post("/review-old-formula", {
            "import_batch_id": batch_id, "row_id": rid,
            "screenshot_ref": screenshot_refs[rid], "note": notes[rid]
        })
        print(f"    row_id={rid}: phase={resp['phase']}, next_owner={resp['next_action_owner']}")
        assert status == 200
        assert resp["phase"] == "old_formula_reviewed"

    status, wf = get(f"/workflow/{batch_id}")
    print(f"  [✓] 第二步完成后阶段: {wf['current_phase']}")
    assert wf["current_phase"] == "old_formula_reviewed"
    save_json("03_after_step2_workflow.json", wf)

    # 2b 第三步：反例列表更新（全部行）
    print("\n  [第三步] 反例列表更新（逐行处理）...")
    counter_notes = {
        row1_id: "课堂参与度60.0<80.0，插值结果0.75，无异常",
        row2_id: "期末笔试80.0=80.0，边界值等于阈值，插值结果1.0，需任课老师复核后再确认",
        row3_id: "实践报告95.0>80.0，插值结果1.1875，无异常",
    }
    for rid in [row1_id, row2_id, row3_id]:
        status, resp = post("/update-counterexample", {
            "import_batch_id": batch_id, "row_id": rid,
            "counterexample_note": counter_notes[rid]
        })
        print(f"    row_id={rid}: phase={resp['phase']}, next_owner={resp['next_action_owner']}, instructor_reviewed={resp['instructor_reviewed']}")
        assert status == 200
        if rid == row2_id:
            assert resp["next_action_owner"] == "instructor"
            assert resp["instructor_reviewed"] is False
    status, wf = get(f"/workflow/{batch_id}")
    print(f"  [✓] 第三步完成后阶段: {wf['current_phase']}")
    assert wf["current_phase"] == "counterexample_updated"
    save_json("04_after_step3_workflow.json", wf)

    # ========== 场景 3：边界值等于阈值的 row2 详情 ==========
    section("场景 3：边界值等于阈值的 row2 详情核对")
    status, detail = get(f"/detail/{row2_id}")
    row = detail["row"]
    print(f"  row2 状态: status={row['processing_status']}, boundary={row['boundary_judgment']}")
    print(f"  原始值={row['original_value']}, 阈值={row['threshold']}, 插值={row['interpolated_value']}")
    print(f"  error_type={row['error_type']}, updated_at={row['updated_at']}")
    assert row["processing_status"] == "boundary_pending_review"
    assert row["boundary_judgment"] == "equal_threshold"
    assert abs(row["interpolated_value"] - 1.0) < 1e-9

    print(f"\n  修补记录（共{len(detail['repair_records'])}条，按时间升序）:")
    for i, rr in enumerate(detail["repair_records"]):
        print(f"    [{i}] phase={rr['phase']}, action={rr['action_type']}")
        print(f"        value: {rr['original_value_before']} → {rr['original_value_after']}")
        print(f"        interp: {rr['interpolated_value_before']} → {rr['interpolated_value_after']}")
        print(f"        change_reason: {rr['change_reason']}")
        print(f"        changed_by={rr['changed_by']}, next_owner={rr['next_action_owner']}, instructor_reviewed={rr['instructor_reviewed']}")

    print(f"\n  审计轨迹（共{len(detail['audit_trails'])}条）:")
    for i, t in enumerate(detail["audit_trails"]):
        print(f"    [{i}] {t['changed_at']}: {t['changed_by']} 改 {t['field_name']}: {t['old_value']} → {t['new_value']}")
        print(f"        原因: {t['change_reason']}")

    save_json("05_row2_detail_after_step3.json", detail)

    # ========== 场景 4：改值重算 ==========
    section("场景 4：改值重算（触发插值和边界判定重算）")

    # 4a 小祁补录返工，把 row2 从 80.0 改成 79.5
    print("\n  [改值] 补录返工：row2 original_value 80.0 → 79.5...")
    status, override = post("/manual-override", {
        "row_id": row2_id, "field_name": "original_value", "new_value": "79.5",
        "change_reason": "对照评分表底册复查，期末笔试原始值确为79.5，原录入误写为80.0",
        "changed_by": "analyst_qi"
    })
    print(f"  [✓] 改值成功: field={override['field_name']}, {override['old_value']} → {override['new_value']}")
    save_json("06_manual_override_79.5.json", override)

    # 4b 验证重算结果
    status, detail = get(f"/detail/{row2_id}")
    row = detail["row"]
    latest_rr = detail["repair_records"][-1]
    print(f"\n  改值后 row2:")
    print(f"    original_value={row['original_value']}, boundary={row['boundary_judgment']}")
    print(f"    interpolated_value={row['interpolated_value']}, status={row['processing_status']}")
    print(f"    error_type={row['error_type']}")
    print(f"  最新修补记录快照:")
    print(f"    value: {latest_rr['original_value_before']} → {latest_rr['original_value_after']}")
    print(f"    interp: {latest_rr['interpolated_value_before']} → {latest_rr['interpolated_value_after']}")
    print(f"    threshold: {latest_rr['threshold_before']} → {latest_rr['threshold_after']}")
    print(f"    action={latest_rr['action_type']}, next_owner={latest_rr['next_action_owner']}")
    assert row["original_value"] == 79.5
    assert row["boundary_judgment"] == "below_threshold"
    assert abs(row["interpolated_value"] - 0.99375) < 1e-9  # 0.5 + 0.5*(79.5-40)/(80-40) = 0.99375
    assert row["processing_status"] == "confirmed"

    # ========== 场景 5：再改回 80.0，再次触发边界待复核 ==========
    section("场景 5：再改回 80.0，再次触发边界待复核（最怕临时补材料）")
    print("\n  [改值] 再次复核底册，发现79.5是错的，原始值确为80.0，改回...")
    status, override = post("/quick-fix", {
        "row_id": row2_id, "error_type": "supplementary_rework",
        "fix_value": 80.0,
        "fix_reason": "二次核对原始评分表，期末笔试确为80.0分，之前79.5是相邻行串位了",
        "changed_by": "analyst_qi"
    })
    print(f"  [✓] 快捷修补成功: status={override['processing_status']}, boundary={override['boundary_judgment']}")
    print(f"     interpolated={override['interpolated_value']}, error_type={override['error_type']}")
    save_json("07_quick_fix_back_to_80.json", override)

    status, detail = get(f"/detail/{row2_id}")
    row = detail["row"]
    latest_rr = detail["repair_records"][-1]
    print(f"\n  改回后:")
    print(f"    original_value={row['original_value']}, boundary={row['boundary_judgment']}")
    print(f"    interpolated={row['interpolated_value']}, status={row['processing_status']}")
    print(f"    error_type={row['error_type']}")
    print(f"  最新修补: value {latest_rr['original_value_before']}→{latest_rr['original_value_after']}")
    print(f"           interp {latest_rr['interpolated_value_before']}→{latest_rr['interpolated_value_after']}")
    print(f"           next_owner={latest_rr['next_action_owner']}, instructor_reviewed={latest_rr['instructor_reviewed']}")
    assert row["original_value"] == 80.0
    assert row["boundary_judgment"] == "equal_threshold"
    assert abs(row["interpolated_value"] - 1.0) < 1e-9
    assert row["processing_status"] == "boundary_pending_review"
    assert row["error_type"] == "supplementary_rework"
    assert latest_rr["next_action_owner"] == "instructor"
    assert latest_rr["instructor_reviewed"] is False

    save_json("08_row2_detail_after_rework.json", detail)

    # ========== 场景 6：多视图一致性核对 ==========
    section("场景 6：多视图一致性核对（改值后同一份最新结果）")

    status, sm = get(f"/batch-summary/{batch_id}")
    status, wf = get(f"/workflow/{batch_id}")
    status, bd = get(f"/batch/{batch_id}")
    status, pending = get(f"/boundary-pending/{batch_id}")
    status, d2 = get(f"/detail/{row2_id}")

    print(f"  batch-summary:")
    print(f"    boundary_equal_threshold_count={sm['boundary_equal_threshold_count']}")
    print(f"    boundary_pending_review_count={sm['boundary_pending_review_count']}")
    print(f"    supplementary_rework_count={sm['supplementary_rework_count']}")
    print(f"    confirmed_count={sm['confirmed_count']}, total={sm['total_rows']}")

    print(f"\n  workflow: boundary_equal_threshold_count={wf['boundary_equal_threshold_count']}")
    batch_boundary = sum(1 for x in bd if x["row"]["boundary_judgment"] == "equal_threshold" and x["row"]["processing_status"] != "rolled_back")
    print(f"  batch 接口中边界行数量: {batch_boundary}")
    print(f"  boundary-pending 列表长度: {len(pending)}")
    print(f"  detail 接口中 row2 boundary: {d2['row']['boundary_judgment']}")
    print(f"  detail 接口中 row2 status: {d2['row']['processing_status']}")

    # 五处一致性核对
    assert sm["boundary_equal_threshold_count"] == wf["boundary_equal_threshold_count"] == batch_boundary == 1
    assert sm["boundary_pending_review_count"] == len(pending) == 1
    assert sm["supplementary_rework_count"] == wf["supplementary_rework_count"] == 1
    assert pending[0]["id"] == row2_id
    assert d2["row"]["boundary_judgment"] == "equal_threshold"
    assert d2["row"]["processing_status"] == "boundary_pending_review"
    assert d2["row"]["interpolated_value"] == bd[1]["row"]["interpolated_value"]
    print("  [✓] 五处视图数据完全一致 ✓")

    save_json("09_multi_view_consistency.json", {
        "batch_summary": sm, "workflow": wf,
        "boundary_pending_list": pending, "batch_detail_row2_boundary": batch_boundary,
    })

    # ========== 场景 7：任课老师复核 ==========
    section("场景 7：任课老师复核边界值等于阈值")
    print("\n  [复核] 任课老师确认 row2 原始值80.0=阈值80.0 按正常计入...")
    status, rv = post("/boundary-review", {
        "row_id": row2_id, "confirmed_normal": True,
        "reviewer": "teacher_zhang",
        "reason": "评分细则第3.2条明示：等于阈值按下一档上限计入，确认正常"
    })
    print(f"  [✓] 复核完成: status={rv['processing_status']}")
    save_json("10_boundary_review_confirmed.json", rv)

    status, detail = get(f"/detail/{row2_id}")
    latest_rr = detail["repair_records"][-1]
    print(f"  最新修补: action={latest_rr['action_type']}")
    print(f"           changed_by={latest_rr['changed_by']}")
    print(f"           change_reason={latest_rr['change_reason']}")
    print(f"           instructor_reviewed={latest_rr['instructor_reviewed']}")
    print(f"           next_action_owner={latest_rr['next_action_owner']}")
    assert detail["row"]["processing_status"] == "confirmed"
    assert latest_rr["instructor_reviewed"] is True
    assert latest_rr["next_action_owner"] is None

    # 复核后一致性再次核对
    status, sm = get(f"/batch-summary/{batch_id}")
    print(f"\n  复核后 batch_summary: boundary_pending={sm['boundary_pending_review_count']}, confirmed={sm['confirmed_count']}")
    assert sm["boundary_pending_review_count"] == 0
    assert sm["confirmed_count"] == 3

    save_json("11_row2_detail_after_review.json", detail)

    # ========== 场景 8：导出 JSON ==========
    section("场景 8：导出 JSON 并解析验证")
    status, export_json_data = get(f"/export/{batch_id}/json")
    fp = save_json("12_export.json", export_json_data)
    print(f"  [✓] JSON 导出已保存: {fp}")
    print(f"  export_metadata: {export_json_data['export_metadata']}")
    print(f"  summary in export: boundary={export_json_data['summary']['boundary_equal_threshold_count']}, pending={export_json_data['summary']['boundary_pending_review_count']}")

    # 核对导出数据与实时接口一致
    for exp_detail in export_json_data["details"]:
        rid = exp_detail["row"]["id"]
        status, live_detail = get(f"/detail/{rid}")
        assert exp_detail["row"]["interpolated_value"] == live_detail["row"]["interpolated_value"]
        assert exp_detail["row"]["processing_status"] == live_detail["row"]["processing_status"]
        assert exp_detail["row"]["boundary_judgment"] == live_detail["row"]["boundary_judgment"]
    print("  [✓] JSON 导出数据与实时接口完全一致 ✓")

    # ========== 场景 9：导出 CSV ==========
    section("场景 9：导出 CSV 并解析验证")
    status, csv_text = get(f"/export/{batch_id}/csv", raw=True)
    fp = save_text("13_export.csv", csv_text)
    print(f"  [✓] CSV 导出已保存: {fp}")

    # 解析 CSV 并验证核心字段
    lines = csv_text.strip().split("\n")
    header = lines[0].split(",")
    data_lines = [l for l in lines[1:] if l and not l.startswith("===") and not l.startswith("current_phase")]
    print(f"  CSV 总行数（含表头）: {len(lines)}")
    print(f"  数据行数: {len(data_lines)}")
    print(f"  表头字段（共{len(header)}个）:")
    for i, h in enumerate(header):
        print(f"    [{i}] {h}")

    # 找到 row2 的那行并验证
    row2_csv = None
    for l in data_lines:
        cols = l.split(",")
        if cols[header.index("original_row_number")] == "2":
            row2_csv = dict(zip(header, cols))
            break
    assert row2_csv is not None
    print(f"\n  row2 在 CSV 中的核心字段:")
    print(f"    original_value={row2_csv['original_value']}")
    print(f"    interpolated_value={row2_csv['interpolated_value']}")
    print(f"    boundary_judgment={row2_csv['boundary_judgment']}")
    print(f"    processing_status={row2_csv['processing_status']}")
    print(f"    next_action_owner={row2_csv['next_action_owner']}")
    print(f"    instructor_reviewed={row2_csv['instructor_reviewed']}")
    print(f"    original_value_before={row2_csv['original_value_before']}")
    print(f"    original_value_after={row2_csv['original_value_after']}")
    print(f"    latest_repair_action={row2_csv['latest_repair_action']}")
    print(f"    latest_change_reason={row2_csv['latest_change_reason']}")

    assert float(row2_csv["original_value"]) == 80.0
    assert row2_csv["boundary_judgment"] == "equal_threshold"
    assert abs(float(row2_csv["interpolated_value"]) - 1.0) < 1e-9
    assert row2_csv["processing_status"] == "confirmed"
    assert row2_csv["instructor_reviewed"] == "1"

    # 验证 CSV 末尾摘要
    summary_lines = [l for l in lines if l.startswith("current_phase") or l.startswith("boundary_equal_threshold_count") or l.startswith("export_at")]
    print(f"\n  CSV 末尾摘要:")
    for l in summary_lines:
        print(f"    {l}")

    # ========== 场景 10：持久化数据（SQLite 直接查询） ==========
    section("场景 10：持久化数据（SQLite 直接查询）")
    db_rows = query_db(db_path, f"SELECT * FROM scoring_weight_rows WHERE id = {row2_id}")
    print(f"  scoring_weight_rows 表 row2:")
    for k, v in db_rows[0].items():
        print(f"    {k} = {v}")

    db_trails = query_db(db_path, f"SELECT * FROM audit_trails WHERE row_id = {row2_id} ORDER BY changed_at")
    print(f"\n  audit_trails 表 row2 共 {len(db_trails)} 条:")
    for t in db_trails:
        print(f"    [{t['id']}] {t['changed_at']}: {t['field_name']} {t['old_value']} → {t['new_value']} by {t['changed_by']}")
        print(f"        reason: {t['change_reason']}")

    db_repairs = query_db(db_path, f"SELECT * FROM repair_records WHERE row_id = {row2_id} ORDER BY created_at")
    print(f"\n  repair_records 表 row2 共 {len(db_repairs)} 条:")
    for r in db_repairs:
        print(f"    [{r['id']}] phase={r['phase']}, action={r['action_type']}")
        print(f"        value {r['original_value_before']} → {r['original_value_after']}")
        print(f"        interp {r['interpolated_value_before']} → {r['interpolated_value_after']}")
        print(f"        is_boundary={bool(r['is_boundary_equal_threshold'])}, instructor_reviewed={bool(r['instructor_reviewed'])}")
        print(f"        changed_by={r['changed_by']}, next_owner={r['next_action_owner']}")

    save_json("14_db_persisted_data.json", {
        "scoring_weight_rows": db_rows,
        "audit_trails": db_trails,
        "repair_records": db_repairs,
    })

    # ========== 最终：证明数据可继续使用 ==========
    section("最终验证：最新处理结果可被继续使用")
    status, final_summary = get(f"/batch-summary/{batch_id}")
    print(f"  批次最终状态: phase={final_summary['current_phase']}")
    print(f"  total={final_summary['total_rows']}, confirmed={final_summary['confirmed_count']}")
    print(f"  boundary_pending={final_summary['boundary_pending_review_count']}")
    print(f"  wrong_caliber={final_summary['wrong_caliber_count']}, supplementary={final_summary['supplementary_rework_count']}")
    print(f"\n  row2 完整证据链（可用于后续审计/报告）:")
    status, d = get(f"/detail/{row2_id}")
    for i, rr in enumerate(d["repair_records"]):
        print(f"  [{i}] {rr['created_at'][:19]}: {rr['action_type']}")
        print(f"       {rr['original_value_before']}→{rr['original_value_after']} | {rr['interpolated_value_before']}→{rr['interpolated_value_after']}")
        print(f"       by={rr['changed_by']} | next={rr['next_action_owner']} | instructor_reviewed={rr['instructor_reviewed']}")
        print(f"       reason: {rr['change_reason']}")

    print("\n" + "=" * 70)
    print(f"[✓] 全部场景验证通过！")
    print(f"[✓] 跳步拦截功能正常：导入后直接调用第3步被拦截")
    print(f"[✓] 三步流程按顺序推进：导入→补看截图→更新反例")
    print(f"[✓] 边界值等于阈值：不急着归正常，标记待复核")
    print(f"[✓] 改值重算：插值+边界判定+状态同步更新")
    print(f"[✓] 多视图一致性：列表/详情/摘要/待复核/导出五处一致")
    print(f"[✓] 导出文件：JSON+CSV 均为同一份最新数据")
    print(f"[✓] 持久化数据：SQLite 三张表完整保留证据链")
    print(f"[✓] 最新结果可被继续使用：包含完整历史/处理原因/下一步找谁")
    print("=" * 70)

    print(f"\n所有输出文件保存在: {OUTPUT_DIR}")
    return 0


if __name__ == "__main__":
    try:
        sys.exit(main())
    except AssertionError as e:
        print(f"\n[✗] 断言失败: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    except Exception as e:
        print(f"\n[✗] 发生错误: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
