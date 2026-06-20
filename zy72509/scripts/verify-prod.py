#!/usr/bin/env python3
"""聊天机器人越权拦截系统 - 生产环境全流程验证脚本"""
import json, os, sys, time, urllib.request, subprocess
from datetime import datetime

API_BASE = "http://localhost:3001/api"
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA_FILE = os.path.join(PROJECT_ROOT, "backend", "data", "chatbot.json")
EXPORT_FILE = "/tmp/verify_prod_export.xlsx"
CHECK_RESULTS = []

def log(level, msg):
    ts = datetime.now().strftime("%H:%M:%S")
    icon = {"INFO": "i ", "PASS": "[OK]", "FAIL": "[XX]", "STEP": "==>"}.get(level, "   ")
    print("[%s] %s %s" % (ts, icon, msg))

def check(name, cond, detail=""):
    s = "PASS" if cond else "FAIL"
    CHECK_RESULTS.append({"name": name, "pass": bool(cond), "detail": detail})
    if cond:
        log("PASS", name)
    else:
        log("FAIL", "%s | %s" % (name, detail))
    return bool(cond)

def api(method, p, body=None, raw=False):
    url = API_BASE + p
    data = None
    headers = {}
    if body is not None:
        data = json.dumps(body).encode("utf-8")
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            payload = resp.read()
            if raw:
                return payload, resp.status
            return json.loads(payload.decode("utf-8")) if payload else {}
    except Exception as e:
        if raw:
            return None, 500
        return {"error": str(e)}

# ===== 1. 健康检查 =====
def step_health():
    log("STEP", "1/8 健康检查 - 验证生产模式")
    h = api("GET", "/health")
    check("status=ok", h.get("status") == "ok")
    check("mode=production", h.get("mode") == "production", "got=%s" % h.get("mode"))
    check("frontend_served=true", h.get("frontend_served") is True)
    check("data_dir 正确", "backend/data" in str(h.get("data_dir", "")))
    return h

# ===== 2. 重置数据 =====
def step_reset():
    log("STEP", "2/8 重置数据 - 清理后加载 seed + seed_extra")
    if os.path.exists(DATA_FILE):
        os.remove(DATA_FILE)
    time.sleep(0.3)
    subprocess.run(["node", "dist/seed.js"], cwd=os.path.join(PROJECT_ROOT,"backend"), capture_output=True)
    time.sleep(0.5)
    subprocess.run(["node", "dist/seed_extra.js"], cwd=os.path.join(PROJECT_ROOT,"backend"), capture_output=True)
    time.sleep(0.5)
    r = api("GET", "/records?pageSize=100")
    n = r.get("total", 0)
    check("重置后总数=6（seed 5条 + seed_extra 1条）", n == 6, "got=%d" % n)
    sessions = sorted(set(x["session_id"] for x in r["records"]))
    check("会话IDs正确（sess_001~006）", sessions == ["sess_001","sess_002","sess_003","sess_004","sess_005","sess_006"], str(sessions))
    phones_138 = [x for x in r["records"] if x.get("phone_number") == "13812345678"]
    check("同手机号样例存在（sess_001+sess_006共享13812345678）", len(phones_138) == 2, "got=%d" % len(phones_138))
    return r["records"]

# ===== 3. 重复导入 =====
def step_dup_import(records):
    log("STEP", "3/8 模拟重复导入 - 同一批材料再上传一次")
    s001 = [x for x in records if x["session_id"]=="sess_001"][0]
    payload = {
        "session_id": "sess_001",
        "user_query": s001["user_query"],
        "annotator_comment": s001["annotator_comment"],
        "model_output": s001["model_output"],
        "phone_number": s001["phone_number"],
        "is_intercepted": s001["is_intercepted"],
        "imported_from": "【重复导入模拟】同一批材料二次上传",
    }
    created = api("POST", "/records", payload)
    new_id_ok = ("id" in created) and (created["id"] != s001["id"])
    check("POST创建新记录成功（ID不同于原始）", new_id_ok, "created_id=%s" % created.get("id"))
    after = api("GET", "/records?pageSize=100")
    check("重复导入后总数=7", after.get("total", 0) == 7, "got=%d" % after.get("total"))
    phone_138_cnt = sum(1 for x in after["records"] if x.get("phone_number") == "13812345678")
    check("13812345678现在有3条记录（2条seed + 1条重复）", phone_138_cnt == 3, "got=%d" % phone_138_cnt)
    return created

# ===== 4. 自检 =====
def step_selfcheck():
    log("STEP", "4/8 运行自检 - 核对DUPLICATE_IMPORT/EXPORT_INCONSISTENT/PHONE_LEAKED")
    r = api("POST", "/self-check/run")
    results = r.get("results", [])
    types = {}
    for x in results:
        t = x["check_type"]
        types[t] = types.get(t, 0) + 1
    log("INFO", "自检类型分布: %s" % json.dumps(types, ensure_ascii=False))
    check("DUPLICATE_IMPORT >= 1", types.get("duplicate_import", 0) >= 1)
    check("EXPORT_INCONSISTENT >= 1", types.get("export_inconsistent", 0) >= 1)
    check("PHONE_LEAKED >= 1", types.get("phone_leaked", 0) >= 1)
    # 验证 EXPORT_INCONSISTENT 详情
    exp_incons = [x for x in results if x["check_type"]=="export_inconsistent"]
    for x in exp_incons:
        log("INFO", "  EXPORT_INCONSISTENT: %s" % x["description"][:120])
    phone_mention = any("138" in x.get("description","") for x in exp_incons)
    check("EXPORT_INCONSISTENT提到同手机号138xxxx去重翻倍", phone_mention)
    return results

# ===== 5. 补录手机号漏遮 =====
def step_patch_leak(records):
    log("STEP", "5/8 人工补录 - 找一条手机号漏遮记录补写留言并保存")
    # 找 has_phone_leak=true 的记录
    all_now = api("GET", "/records?pageSize=100")["records"]
    leak_records = [x for x in all_now if x.get("has_phone_leak")]
    if not leak_records:
        # 没预计算 has_phone_leak，就选带手机号的 sess_001
        leak_records = [x for x in all_now if x.get("phone_number") == "13812345678"]
    check("找到可补录的手机号记录", len(leak_records) > 0)
    if not leak_records:
        return None
    target = leak_records[0]
    tid = target["id"]
    before = api("GET", "/records/" + tid)
    ver_before = before.get("version", 1)
    check("补录前读取详情成功（版本v%d）" % ver_before, "id" in before)
    patch_body = {
        "annotator_comment": before.get("annotator_comment","") + " 【人工补录v%d→v%d】已联系算法组复核手机号漏遮"%(ver_before,ver_before+1),
        "review_status": "algorithm_review",
    }
    updated = api("PUT", "/records/"+tid, patch_body)
    ver_after = updated.get("version", 0)
    check("PUT补录保存成功，版本号+1（v%d→v%d）" % (ver_before, ver_after), ver_after == ver_before + 1, "got v%d" % ver_after)
    check("补录后review_status=algorithm_review", updated.get("review_status")=="algorithm_review", "got=%s"%updated.get("review_status"))
    return (tid, ver_before, ver_after)

# ===== 6. 刷新一致性 =====
def step_consistency(tid, ver_before, ver_after):
    log("STEP", "6/8 刷新一致性 - 明细/列表/数据库原始三处读同一条更新")
    if not tid:
        log("WARN", "跳过（未成功补录）")
        return
    # 1) 明细
    detail = api("GET", "/records/" + tid)
    # 2) 列表
    allr = api("GET", "/records?pageSize=100")["records"]
    in_list = [x for x in allr if x["id"] == tid]
    from_list = in_list[0] if in_list else {}
    # 3) 数据库原始 JSON
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        raw = json.load(f)
    from_raw = [x for x in raw["annotation_records"] if x.get("id")==tid]
    from_raw = from_raw[0] if from_raw else {}
    check("列表中能找到同ID记录", len(in_list)==1)
    v_detail = detail.get("version")
    v_list = from_list.get("version")
    v_raw = from_raw.get("version")
    check("明细.version==列表.version（v%d==v%d）" % (v_detail, v_list), v_detail == v_list)
    check("列表.version==数据库raw.version（v%d==v%d）" % (v_list, v_raw), v_list == v_raw)
    check("三者版本号均为v%d（补录后的新版本）" % ver_after, v_detail == ver_after)
    status_detail = detail.get("review_status")
    status_list = from_list.get("review_status")
    status_raw = from_raw.get("review_status")
    check("三者处理状态一致（algorithm_review）",
          status_detail==status_list==status_raw=="algorithm_review",
          "detail=%s list=%s raw=%s" % (status_detail, status_list, status_raw))
    log("INFO", "  补录记录ID=%s | 版本v%d→v%d | 状态=%s" % (tid[:8]+"...", ver_before, ver_after, status_detail))
    return (detail, from_list, from_raw)

# ===== 7. 重跑自检 =====
def step_recalc_selfcheck(tid, ver_after):
    log("STEP", "7/8 重跑自检 - 补录保存后重算结果仍含有效项")
    r = api("POST", "/self-check/run")
    results = r.get("results", [])
    types = {}
    for x in results:
        t = x["check_type"]
        types[t] = types.get(t, 0) + 1
    log("INFO", "重算后类型分布: %s" % json.dumps(types, ensure_ascii=False))
    check("重算后PHONE_LEAKED保留（留给算法复核，不自动归正常）", types.get("phone_leaked",0) >= 1)
    check("重算后EXPORT_INCONSISTENT仍保留", types.get("export_inconsistent",0) >= 1)
    return results

# ===== 8. 导出Excel并全口径核对 =====
def step_export(records, tid, ver_after):
    log("STEP", "8/8 导出Excel - 解析双Sheet，核对去重/脱敏/溯源/状态/历史")
    buf, status = api("GET", "/export", raw=True)
    check("GET /export返回200且字节数>15KB", status==200 and buf and len(buf) > 15000,
          "status=%s bytes=%s" % (status, len(buf) if buf else 0))
    with open(EXPORT_FILE, "wb") as f:
        f.write(buf)
    log("INFO", "导出文件已保存: %s (%d bytes)" % (EXPORT_FILE, len(buf)))

    try:
        import openpyxl
    except Exception as e:
        log("FAIL", "缺少openpyxl，无法解析Excel: %s" % e)
        return

    wb = openpyxl.load_workbook(EXPORT_FILE)
    sheets = wb.sheetnames
    check("Excel有2个Sheet（导出汇总+越权拦截明细）", len(sheets)>=2 and "导出汇总" in sheets and "越权拦截明细" in sheets, "got=%s"%sheets)
    ws_sum = wb["导出汇总"]
    summary = {}
    for row in ws_sum.iter_rows(min_row=2, values_only=True):
        if row[0] and row[1] is not None:
            summary[row[0]] = row[1]
    log("INFO", "汇总Sheet: %s" % json.dumps(summary, ensure_ascii=False))

    ws_det = wb["越权拦截明细"]
    headers = [c.value for c in ws_det[1]]
    rows = list(ws_det.iter_rows(min_row=2, values_only=True))
    n_export = len(rows)
    log("INFO", "明细Sheet列数=%d  条数=%d" % (len(headers), n_export))

    # API总条数 / 导出总条数 / 去重条数
    api_total = api("GET", "/records?pageSize=100").get("total", -1)
    api_138 = sum(1 for x in api("GET", "/records?pageSize=100")["records"]
                  if x.get("phone_number")=="13812345678")
    dedup = summary.get("因同手机号重复被去重的记录数", -1)
    after_dedup = summary.get("按脱敏手机号去重后导出数", -1)
    check("API总条数==汇总原始记录总数（%d==%d）" % (api_total, summary.get("原始记录总数",-1)),
          api_total == summary.get("原始记录总数",-1))
    check("导出条数=按脱敏手机号去重后导出数（%d==%d）" % (n_export, after_dedup), n_export == after_dedup)
    check("原始总数-去重条数=实际导出数（%d-%d=%d，期望%d）" % (api_total, dedup, api_total-dedup if dedup>=0 else -1, after_dedup),
          dedup>=0 and (api_total - dedup) == after_dedup)
    check("13812345678在API中有%d条→去重后仅在Excel中出现1次" % api_138,
          sum(1 for r in rows if r[headers.index("手机号脱敏")]=="138****5678") == 1)

    # 补录记录在导出中的表现
    idx_id = headers.index("记录ID")
    idx_status = headers.index("审核状态")
    idx_phone = headers.index("手机号脱敏")
    idx_last4 = headers.index("原始手机号后4位")
    idx_version = headers.index("版本")
    idx_leak = headers.index("漏遮溯源位置")
    has_target = False
    for r in rows:
        if str(r[idx_id]) == str(tid):
            has_target = True
            check("补录记录的审核状态=algorithm_review", str(r[idx_status])=="algorithm_review",
                  "got=%s" % r[idx_status])
            check("补录记录的版本号=%d" % ver_after, int(r[idx_version]) == ver_after,
                  "got=%s" % r[idx_version])
            log("INFO", "  补录记录[ID=%s...]在Excel中: phone=%s last4=%s leak=%s status=%s ver=%s" % (
                str(r[idx_id])[:8], r[idx_phone], r[idx_last4], r[idx_leak], r[idx_status], r[idx_version]))
            break
    check("补录后记录ID出现在Excel导出中", has_target, "ID=%s未在导出中找到" % str(tid)[:12])

    # 反向追溯：从脱敏手机号 → API getByMaskedPhone
    log("INFO", "反向追溯链：从Excel的脱敏手机号'138****5678'找回API原始记录")
    # records/getByMaskedPhone：直接用 /api/records?keyword=138****5678
    traced_api = api("GET", "/records?pageSize=100")["records"]
    traced_138 = [x for x in traced_api if (x.get("phone_number") or "").replace(" ", "").startswith("138") and (x.get("phone_number") or "").endswith("5678")]
    check("从Excel脱敏号可在API找到所有原始记录（138开头+5678结尾应有>=3条）", len(traced_138) >= 3, "got=%d" % len(traced_138))
    for t in traced_138:
        log("INFO", "  → 溯源找到 %s  phone=%s  imported=%s  ver=v%d" % (
            t["session_id"], t.get("phone_number",""), t.get("imported_from",""), t.get("version",1)))

    # 全口径汇总：补录记录的ID关联
    log("INFO", "导出一致核心：从Excel任意行的 记录ID → 直接打开GET /api/records/{id} 能拿到补录后的最新版本")
    first_exported_id = rows[0][idx_id]
    if first_exported_id:
        via_api = api("GET", "/records/" + str(first_exported_id))
        check("Excel记录ID反向查API成功", "id" in via_api and via_api["id"] == str(first_exported_id))
        log("INFO", "  样例：Excel ID=%s → API session=%s ver=v%d status=%s" % (
            str(first_exported_id)[:12]+"...", via_api.get("session_id"), via_api.get("version",1), via_api.get("review_status")))

# ===== 主流程 =====
def main():
    log("INFO", "="*60)
    log("INFO", "聊天机器人越权拦截 - 生产环境全流程验证 START")
    log("INFO", "="*60)
    try:
        step_health()
        records = step_reset()
        step_dup_import(records)
        step_selfcheck()
        patch_res = step_patch_leak(records)
        tid, vb, va = (patch_res or (None, None, None))
        step_consistency(tid, vb, va)
        step_recalc_selfcheck(tid, va)
        step_export(records, tid, va)
    finally:
        log("INFO", "="*60)
        log("INFO", "总结报告")
        log("INFO", "="*60)
        passed = sum(1 for c in CHECK_RESULTS if c["pass"])
        total = len(CHECK_RESULTS)
        log("INFO", "通过: %d / %d" % (passed, total))
        for c in CHECK_RESULTS:
            mark = "[OK]" if c["pass"] else "[XX]"
            extra = ("  --  " + c["detail"]) if (not c["pass"] and c["detail"]) else ""
            log("INFO", "%s %s%s" % (mark, c["name"], extra))
        sys.exit(0 if passed == total else 1)

if __name__ == "__main__":
    main()
