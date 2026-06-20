import sys
import os
import json
import pandas as pd
import tempfile
from io import BytesIO
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from fastapi.testclient import TestClient
from backend.main import app
from backend.database import BASE_DIR, init_db, SessionLocal
from backend import models
from backend.services import appeal_service

client = TestClient(app)
LOG_LINES = []


def log(msg):
    line = f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] {msg}"
    print(line)
    LOG_LINES.append(line)


def write_log_report():
    log_path = os.path.join(os.path.dirname(__file__), "verification_log.txt")
    with open(log_path, "w", encoding="utf-8") as f:
        f.write("\n".join(LOG_LINES))
    log(f"\n📝 完整运行记录已保存到: {log_path}")


def assert_true(cond, test_name, fail_msg=""):
    if cond:
        log(f"✅ PASS - {test_name}")
    else:
        log(f"❌ FAIL - {test_name} - {fail_msg}")
    return cond


def step_header(title):
    log("\n" + "=" * 80)
    log(f"   {title}")
    log("=" * 80)


def reset_and_init():
    db_path = os.path.join(BASE_DIR, "appeal.db")
    if os.path.exists(db_path):
        os.remove(db_path)
        log(f"🗑️  删除旧数据库: {db_path}")

    from backend import database as _db
    engine = _db.engine
    SessionLocal = _db.SessionLocal

    _db.Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    v_old = models.ModelVersion(version_name="v2024.01.01", description="基线版本")
    db.add(v_old)
    db.flush()
    v_new = models.ModelVersion(version_name="v2024.02.01", description="优化低置信度样本后版本")
    db.add(v_new)
    db.flush()
    log(f"✅ 创建模型版本: #{v_old.id}={v_old.version_name} (基线), #{v_new.id}={v_new.version_name} (最新)")

    sample_path = os.path.join(os.path.dirname(__file__), "samples", "sample_ticket.csv")
    df = pd.read_csv(sample_path)
    ticket, warnings = appeal_service.import_ticket_from_df(
        db, df, "FEEDBACK-2024-001", 1, "demo_script"
    )
    log(f"✅ [步骤1] 导入工单: {ticket.ticket_no}, 样本数: {len(ticket.samples)}")
    for w in warnings:
        log(f"   ⚠️  {w}")

    ranks_v1 = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
    ranks_v2 = [1, 3, 2, 4, 6, 5, 7, 8, 9, 10]
    scores = [0.95, 0.88, 0.45, 0.80, 0.38, 0.90, 0.52, 0.93, 0.83, 0.42]

    for i, sample in enumerate(ticket.samples):
        db.add(models.SampleVersion(sample_id=sample.id, model_version_id=v_old.id, rank=ranks_v1[i], score=scores[i], is_manual_modified=False))
    db.flush()
    for i, sample in enumerate(ticket.samples):
        db.add(models.SampleVersion(sample_id=sample.id, model_version_id=v_new.id, rank=ranks_v2[i], score=scores[i] + (0.02 if i in [2,4,6,9] else 0), is_manual_modified=False))
    db.flush()
    log(f"✅ 版本对比数据创建完成: {len(ticket.samples)*2} 条 SampleVersion")

    db.add(models.AuditLog(ticket_id=ticket.id, action="补看脱敏规则备注", operator="周姐",
        after_value={"desensitization_note": "已核对脱敏规则，S003、S005、S007、S010 涉及员工敏感数据，需特殊处理"},
        note="标注负责人周姐完成第一次审阅"))
    ticket.desensitization_note = "已核对脱敏规则，S003、S005、S007、S010 涉及员工敏感数据，需特殊处理"
    ticket.handler = "周姐"
    ticket.status = "处理中"
    db.commit()
    log(f"✅ [步骤2] 周姐补看脱敏规则备注完成")

    result = appeal_service.recalculate_ranks(db, ticket.id, "周姐")
    log(f"✅ [步骤3] 补录重算完成: {json.dumps(result, ensure_ascii=False)}")

    check = appeal_service.check_recalculate_consistency(db, ticket.id)
    log(f"   自检一致性初步: passed={check['passed']}, 不一致={len(check['inconsistencies'])} 条")
    for item in check['inconsistencies']:
        log(f"   ❌ {json.dumps(item, ensure_ascii=False)}")

    appeal_service.run_self_check(db, ticket.id)
    db.refresh(ticket)
    log(f"✅ 自检完成")

    vid1, vid2 = v_old.id, v_new.id
    db.close()
    return vid1, vid2


def step1_import_and_homepage():
    step_header("【验证步骤1】首页工单列表接口（修复 raw_content 类型）")

    r = client.get("/tickets/")
    assert_true(r.status_code == 200, "GET /tickets/ 返回 200", f"实际 {r.status_code}")

    data = r.json()
    assert_true(len(data) >= 1, "工单列表至少有 1 条数据", f"实际 {len(data)}")

    t0 = data[0]
    expected = ["id", "ticket_no", "source", "original_row_no", "status", "handler", "raw_content", "samples"]
    missing = [f for f in expected if f not in t0]
    assert_true(len(missing) == 0, f"工单对象含完整字段", f"缺 {missing}")

    raw = t0["raw_content"]
    assert_true(isinstance(raw, list), "raw_content 为 list 类型", f"实际 {type(raw).__name__}")
    assert_true(len(raw) == 10, "raw_content 长度 = 10", f"实际 {len(raw)}")
    assert_true(t0["ticket_no"] == "FEEDBACK-2024-001", "工单编号 = FEEDBACK-2024-001", f"实际 {t0['ticket_no']}")
    assert_true(t0["source"] == "线上反馈工单", "来源 = 线上反馈工单", f"实际 {t0['source']}")
    assert_true(t0["original_row_no"] == 1, "原始行号 = 1", f"实际 {t0['original_row_no']}")


def step2_ticket_detail_and_samples():
    step_header("【验证步骤2】工单详情 - 排名、状态、样本核对（重点 S002/S003/S007）")

    r = client.get("/tickets/1")
    assert_true(r.status_code == 200, "GET /tickets/1 返回 200")

    ticket = r.json()
    samples = {s["sample_no"]: s for s in ticket["samples"]}

    assert_true(ticket.get("desensitization_note"), "工单 desensitization_note 非空",
                f"实际: {ticket.get('desensitization_note')}")
    assert_true("已核对脱敏规则" in (ticket.get("desensitization_note") or ""),
                "工单 desensitization_note 包含关键字「已核对脱敏规则」")
    assert_true(ticket.get("handler") == "周姐", "工单 handler = 周姐", f"实际: {ticket.get('handler')}")
    assert_true(ticket.get("status") == "处理中", "工单 status = 处理中", f"实际: {ticket.get('status')}")

    for no in ["S001", "S002", "S003", "S004", "S005", "S006", "S007", "S008", "S009", "S010"]:
        assert_true(no in samples, f"样本 {no} 存在")

    expected_values = {
        "S001": {"current_rank": 1, "status": "正常", "is_low_confidence": False, "is_hidden_by_avg": False},
        "S002": {"current_rank": 3, "status": "正常", "is_low_confidence": False, "is_hidden_by_avg": False},
        "S003": {"current_rank": 2, "status": "待复核", "is_low_confidence": True, "is_hidden_by_avg": True},
        "S004": {"current_rank": 4, "status": "正常", "is_low_confidence": False, "is_hidden_by_avg": False},
        "S005": {"current_rank": 6, "status": "待复核", "is_low_confidence": True, "is_hidden_by_avg": True},
        "S006": {"current_rank": 5, "status": "正常", "is_low_confidence": False, "is_hidden_by_avg": False},
        "S007": {"current_rank": 5, "status": "待复核", "is_low_confidence": True, "is_hidden_by_avg": False},
        "S008": {"current_rank": 8, "status": "正常", "is_low_confidence": False, "is_hidden_by_avg": False},
        "S009": {"current_rank": 9, "status": "正常", "is_low_confidence": False, "is_hidden_by_avg": False},
        "S010": {"current_rank": 10, "status": "待复核", "is_low_confidence": True, "is_hidden_by_avg": True},
    }
    for no, exp in expected_values.items():
        s = samples[no]
        for k, v in exp.items():
            assert_true(s[k] == v, f"{no}.{k} = {v}", f"实际 {s[k]}")

    low_conf_list = [s["sample_no"] for s in ticket["samples"] if s["is_low_confidence"]]
    assert_true(len(low_conf_list) == 4, "低置信度样本数 = 4", f"实际 {low_conf_list}")

    hidden_list = [s["sample_no"] for s in ticket["samples"] if s["is_hidden_by_avg"]]
    assert_true(len(hidden_list) == 3, "被平均盖住样本数 = 3", f"实际 {hidden_list}")


def step3_self_check_detailed():
    step_header("【验证步骤3】自检结果详细分析（重点补录重算一致性）")

    r = client.get("/tickets/1/self-check")
    assert_true(r.status_code == 200, "GET /tickets/1/self-check 返回 200")

    checks = {c["check_type"]: c for c in r.json()}
    all_passed = True

    for ct in ["重复导入检查", "低置信度样本盖住检查", "补录重算一致性检查", "导出一致性检查"]:
        assert_true(ct in checks, f"自检包含「{ct}」")
        c = checks[ct]
        if not c["passed"]:
            all_passed = False
        log(f"   {('✅ 通过' if c['passed'] else '❌ 失败')} - {ct}: {json.dumps(c['details'], ensure_ascii=False)}")

    assert_true(all_passed, "全部 4 项自检通过", "请查看上方各项具体细节")

    ct_check = checks["补录重算一致性检查"]["details"]
    assert_true(ct_check["passed"] is True, "补录重算一致性检查 passed=True", f"实际 {ct_check['passed']}")
    assert_true(len(ct_check["inconsistencies"]) == 0, "补录重算一致性 不一致列表为空", f"实际 {ct_check['inconsistencies']}")
    assert_true(ct_check["consistent_count"] == 10, "补录重算一致性 consistent_count=10", f"实际 {ct_check.get('consistent_count')}")


def step4_version_compare(v1_id, v2_id):
    step_header("【验证步骤4】模型版本对比（确认 S002/S003/S007 排名与状态正确）")

    r = client.get(f"/versions/compare/{v1_id}/{v2_id}")
    assert_true(r.status_code == 200, f"GET /versions/compare/{v1_id}/{v2_id} 返回 200")

    data = r.json()
    items = {it["sample_no"]: it for it in data["items"]}

    assert_true(data["total_count"] == 10, "版本对比总样本数 = 10", f"实际 {data['total_count']}")
    assert_true(data["pending_review_count"] == 4, "版本对比待复核数 = 4", f"实际 {data['pending_review_count']}")
    assert_true(data["from_ticket_count"] == 10, "版本对比来自线上反馈工单数 = 10", f"实际 {data['from_ticket_count']}")

    expected_v2 = {
        "S002": (3, "正常", "线上反馈工单", False, False),
        "S003": (2, "待复核", "线上反馈工单", True, True),
        "S007": (5, "待复核", "线上反馈工单", True, False),
    }
    for no, (v2_rank, status, source, low, hidden) in expected_v2.items():
        it = items[no]
        assert_true(it["v2_rank"] == v2_rank, f"版本对比 {no}.v2_rank = {v2_rank}", f"实际 {it['v2_rank']}")
        assert_true(it["status"] == status, f"版本对比 {no}.status = {status}", f"实际 {it['status']}")
        assert_true(it["from_source"] == source, f"版本对比 {no}.from_source = {source}", f"实际 {it['from_source']}")
        assert_true(it["is_low_confidence"] == low, f"版本对比 {no}.is_low_confidence = {low}")
        assert_true(it["is_hidden_by_avg"] == hidden, f"版本对比 {no}.is_hidden_by_avg = {hidden}")

    rank_change_expected = {"S002": 1, "S003": -1, "S007": -2}
    for no, expected_change in rank_change_expected.items():
        it = items[no]
        actual_change = it["rank_change"]
        assert_true(actual_change == expected_change, f"版本对比 {no}.rank_change(V2-V1) = {expected_change}", f"实际 {actual_change}")


def step5_audit_trails():
    step_header("【验证步骤5】审计追踪 - 历史留痕完整核对")

    r = client.get("/tickets/1/audit-logs")
    assert_true(r.status_code == 200, "GET /tickets/1/audit-logs 返回 200")

    logs = sorted(r.json(), key=lambda x: x["created_at"])
    log(f"   共 {len(logs)} 条审计记录")

    actions = [l["action"] for l in logs]
    expected_actions_subset = ["导入工单", "补看脱敏规则备注"]
    for a in expected_actions_subset:
        assert_true(a in actions, f"存在「{a}」记录")

    rank_relogs = [l for l in logs if l["action"] == "重算排名"]
    log(f"   其中「重算排名」记录 {len(rank_relogs)} 条")

    expected_rank_changes = [
        ("S002", 2, 3, "latest_version"),
        ("S003", 3, 2, "expected_rank"),
        ("S007", 7, 5, "expected_rank"),
        ("S005", 5, 6, "latest_version"),
    ]

    db = SessionLocal()
    try:
        for sample_no, old_r, new_r, source in expected_rank_changes:
            sample = db.query(models.Sample).filter(models.Sample.sample_no == sample_no, models.Sample.ticket_id == 1).first()
            assert_true(sample is not None, f"DB 存在样本 {sample_no}")

            sample_logs = [l for l in rank_relogs if l["sample_id"] == sample.id]
            assert_true(len(sample_logs) >= 1, f"样本 {sample_no} 至少 1 条重算排名记录", f"实际 {len(sample_logs)}")

            for sl in sample_logs:
                if sl["after_value"].get("rank") == new_r:
                    assert sl["before_value"]["rank"] == old_r, f"{sample_no} 变更前 rank={old_r}"
                    assert sl["after_value"]["rank"] == new_r, f"{sample_no} 变更后 rank={new_r}"
                    if "rank_source" in sl["after_value"]:
                        assert sl["after_value"]["rank_source"] == source, f"{sample_no} rank_source={source}"
                    log(f"   ✅ {sample_no}: {old_r} → {new_r} (来源: {source}) by {sl['operator']}")
                    break
    finally:
        db.close()


def step6_export_excel_and_json():
    step_header("【验证步骤6】导出明细真实核对（Excel 17列 + 数量 + 低置信度状态）")

    r_json = client.get("/tickets/1/export/json")
    assert_true(r_json.status_code == 200, "GET /tickets/1/export/json 返回 200")
    export = r_json.json()
    rows = export["export_rows"]

    log(f"   JSON 导出: {len(rows)} 行数据")
    assert_true(len(rows) == 10, "JSON 导出行数 = 10", f"实际 {len(rows)}")

    expected_cols = ["工单编号", "原始行号", "样本编号", "查询词", "文档标题", "文档URL",
                     "原始排名", "预期排名", "当前排名", "置信度", "低置信度", "被平均指标盖住",
                     "处理状态", "来源", "处理人", "脱敏规则备注", "人工备注"]
    actual_cols = list(rows[0].keys()) if rows else []
    log(f"   JSON 导出现有列 ({len(actual_cols)}): {actual_cols}")
    assert_true(len(actual_cols) == 17, f"JSON 导出 = 17 列", f"实际 {len(actual_cols)} 列")
    for col in expected_cols:
        assert_true(col in actual_cols, f"JSON 导出包含列「{col}」")

    rows_by_no = {r["样本编号"]: r for r in rows}
    expected_low = {"S003", "S005", "S007", "S010"}
    expected_hidden = {"S003", "S005", "S010"}
    first_note = rows_by_no["S001"]["脱敏规则备注"]
    assert_true(isinstance(first_note, str) and len(first_note) > 0,
                f"导出的脱敏规则备注非空", f"实际: {repr(first_note)}")
    assert_true("已核对脱敏规则" in first_note,
                f"导出的脱敏规则备注包含关键字", f"实际: {repr(first_note[:20])}")

    for no, row in rows_by_no.items():
        assert_true(row["工单编号"] == "FEEDBACK-2024-001", f"{no} 工单编号正确")
        assert_true(row["原始行号"] == 1, f"{no} 原始行号=1")
        assert_true(row["来源"] == "线上反馈工单", f"{no} 来源=线上反馈工单")
        assert_true(row["处理人"] == "周姐", f"{no} 处理人=周姐")
        assert_true(row["脱敏规则备注"] == first_note, f"{no} 脱敏规则备注与其他行一致")
        if no in expected_low:
            assert_true(row["低置信度"] == "是", f"{no} 低置信度 = 是", f"实际 {row['低置信度']}")
        else:
            assert_true(row["低置信度"] == "否", f"{no} 低置信度 = 否", f"实际 {row['低置信度']}")
        if no in expected_hidden:
            assert_true(row["被平均指标盖住"] == "是", f"{no} 被平均盖住 = 是", f"实际 {row['被平均指标盖住']}")
        else:
            assert_true(row["被平均指标盖住"] == "否", f"{no} 被平均盖住 = 否", f"实际 {row['被平均指标盖住']}")

    expected_status = {
        "S001": "正常", "S002": "正常", "S003": "待复核", "S004": "正常",
        "S005": "待复核", "S006": "正常", "S007": "待复核", "S008": "正常",
        "S009": "正常", "S010": "待复核",
    }
    for no, s in expected_status.items():
        assert_true(rows_by_no[no]["处理状态"] == s, f"导出 {no}.处理状态 = {s}", f"实际 {rows_by_no[no]['处理状态']}")

    expected_rank_in_export = {"S002": 3, "S003": 2, "S007": 5}
    for no, r in expected_rank_in_export.items():
        assert_true(rows_by_no[no]["当前排名"] == r, f"导出 {no}.当前排名 = {r}", f"实际 {rows_by_no[no]['当前排名']}")

    log("   ✅ JSON 导出 17 列字段、数量、低置信度状态全部核对通过")

    r_excel = client.get("/tickets/1/export")
    assert_true(r_excel.status_code == 200, "GET /tickets/1/export 返回 200")
    content_type = r_excel.headers.get("content-type", "")
    assert_true("excel" in content_type or "spreadsheet" in content_type or "octet-stream" in content_type,
                f"Excel 响应 content-type 正确", f"实际 {content_type}")

    content_disposition = r_excel.headers.get("content-disposition", "")
    assert_true(".xlsx" in content_disposition, "响应头含 .xlsx 文件名", f"实际 {content_disposition}")

    tmpdir = tempfile.mkdtemp()
    excel_path = os.path.join(tmpdir, "export_check.xlsx")
    with open(excel_path, "wb") as f:
        f.write(r_excel.content)
    df = pd.read_excel(excel_path, engine="openpyxl")
    log(f"   读取 Excel: {df.shape[0]} 行 x {df.shape[1]} 列")

    assert_true(df.shape[0] == 10, "Excel 行数 = 10", f"实际 {df.shape[0]}")
    assert_true(df.shape[1] == 17, f"Excel 列数 = 17", f"实际 {df.shape[1]}")

    actual_excel_cols = list(df.columns)
    for col in expected_cols:
        assert_true(col in actual_excel_cols, f"Excel 包含列「{col}」", f"实际列: {actual_excel_cols}")

    for _, row in df.iterrows():
        no = row["样本编号"]
        if no in expected_low:
            assert_true(str(row["低置信度"]) == "是", f"Excel {no} 低置信度 = 是", f"实际 {row['低置信度']}")
        if no in expected_hidden:
            assert_true(str(row["被平均指标盖住"]) == "是", f"Excel {no} 被平均盖住 = 是", f"实际 {row['被平均指标盖住']}")

    for no, r in expected_rank_in_export.items():
        exr = df.loc[df["样本编号"] == no, "当前排名"].values[0]
        assert_true(int(exr) == r, f"Excel {no}.当前排名 = {r}", f"实际 {exr}")

    for no, s in expected_status.items():
        exs = str(df.loc[df["样本编号"] == no, "处理状态"].values[0])
        assert_true(exs == s, f"Excel {no}.处理状态 = {s}", f"实际 {exs}")

    handler_vals = df["处理人"].dropna().unique().tolist()
    assert_true(handler_vals == ["周姐"], f"Excel 处理人 = 周姐", f"实际 {handler_vals}")
    src_vals = df["来源"].dropna().unique().tolist()
    assert_true(src_vals == ["线上反馈工单"], f"Excel 来源 = 线上反馈工单", f"实际 {src_vals}")

    for row in rows:
        ex_row = df.loc[df["样本编号"] == row["样本编号"]].iloc[0].to_dict()
        for col in expected_cols:
            a, b = row[col], ex_row[col]
            try:
                if isinstance(a, float) and pd.isna(a):
                    a = None
            except:
                pass
            if isinstance(b, float) and pd.isna(b):
                b = None
            if a is None and (b is None or b == ""):
                match = True
            elif b is None and (a is None or a == ""):
                match = True
            elif isinstance(a, (int, float)) and isinstance(b, (int, float)):
                match = abs(float(a) - float(b)) < 1e-9
            else:
                match = (str(a).strip() == str(b).strip())
            assert_true(match, f"三端对齐 {row['样本编号']}.{col} 一致", f"JSON={a}, Excel={b}")

    log("   ✅ Excel 17 列、数量、状态 三端完全对齐！")
    os.remove(excel_path)
    os.rmdir(tmpdir)


def step7_self_check_via_browser_flow():
    step_header("【验证步骤7】模拟前端刷新自检 + 保存补录后再次重算 + 再次自检")

    log("   模拟前端点击「运行自检」按钮 POST /tickets/1/self-check")
    r = client.post("/tickets/1/self-check")
    assert_true(r.status_code == 200, "POST /tickets/1/self-check 返回 200")
    checks = r.json()
    assert_true(len(checks) == 4, "运行自检返回 4 项结果", f"实际 {len(checks)}")

    all_p = all(c["passed"] for c in checks)
    for c in checks:
        log(f"   {('✅ 通过' if c['passed'] else '❌ 失败')} - {c['check_type']}")
    assert_true(all_p, "运行自检全部 4 项通过")

    log("\n   模拟前端：修改 S002 样本的预期排名（2→3），标注负责人补录一次")
    r = client.patch("/tickets/1/samples/2", json={"expected_rank": 3, "manual_note": "知识库编辑复核：S002 排名应与最新模型版本一致", "status": "正常"})
    assert_true(r.status_code == 200, f"PATCH /tickets/1/samples/2 返回 200，实际 {r.status_code}")

    log("   模拟前端：点击「补录重算」按钮 POST /tickets/1/recalculate")
    r = client.post("/tickets/1/recalculate", params={"operator": "知识库编辑"})
    assert_true(r.status_code == 200, f"POST /tickets/1/recalculate 返回 200，实际 {r.status_code}")
    recalc = r.json()
    log(f"   重算结果: {json.dumps(recalc, ensure_ascii=False)}")

    r = client.post("/tickets/1/self-check")
    checks = r.json()
    all_p = all(c["passed"] for c in checks)
    log("\n   补录后再次自检:")
    for c in checks:
        log(f"   {('✅ 通过' if c['passed'] else '❌ 失败')} - {c['check_type']}")
    assert_true(all_p, "补录→重算→自检 全流程再次全部通过")

    r = client.get("/tickets/1/audit-logs")
    logs = sorted(r.json(), key=lambda x: x["created_at"])
    last_log = logs[-1]
    assert_true(last_log["action"] == "重算排名" or last_log["action"] == "更新样本", f"最新审计记录为本次操作", f"实际 {last_log['action']}")
    log(f"   ✅ 最新审计记录: action={last_log['action']}, operator={last_log['operator']}")


def step8_final_report():
    step_header("【最终报告】所有验证项汇总")

    pass_count = sum(1 for l in LOG_LINES if "✅ PASS" in l)
    fail_count = sum(1 for l in LOG_LINES if "❌ FAIL" in l)
    log(f"   ✅ 通过: {pass_count} 项")
    log(f"   ❌ 失败: {fail_count} 项")
    log(f"   📝 总测试项: {pass_count + fail_count} 项")

    if fail_count == 0:
        log("\n🎉 恭喜！所有验证项全部通过")
        log("   修复点回顾:")
        log("   1. raw_content 类型: List 类型修正")
        log("   2. recalculate_ranks: current_rank ↔ SampleVersion 同步，无 expected_rank 时取最新版本排名")
        log("   3. check_recalculate_consistency: created_at + model_version_id + id 三级排序取最新版本")
        log("   4. 版本取数排序稳定，避免时间相同取到旧版本")
        log("   5. S002/S003/S007 排名、状态、三端数据完全一致")
        log("   6. 自检 4 项全部通过（含补录重算一致性）")
        log("   7. Excel 17 列真实核对，与 API、JSON 导出完全对齐")
        log("   8. 审计追踪完整保留：导入→补看→重算→复核→再次重算 全链路留痕")
    else:
        log(f"\n⚠️  有 {fail_count} 项失败，需要继续排查")

    return fail_count == 0


if __name__ == "__main__":
    print("\n" + "=" * 80)
    print("   🧪 AI 搜索排序申诉系统 - 端到端全流程验证")
    print("=" * 80)

    v1_id, v2_id = reset_and_init()

    step1_import_and_homepage()
    step2_ticket_detail_and_samples()
    step3_self_check_detailed()
    step4_version_compare(v1_id, v2_id)
    step5_audit_trails()
    step6_export_excel_and_json()
    step7_self_check_via_browser_flow()
    all_ok = step8_final_report()

    write_log_report()

    sys.exit(0 if all_ok else 1)
