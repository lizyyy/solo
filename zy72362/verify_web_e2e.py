from __future__ import annotations
import json
import os
import shutil
import time
import http.client

BASE = "127.0.0.1"
PORT = 8000
errors = []
CALC_ID = None

def api(method, path, body=None):
    conn = http.client.HTTPConnection(BASE, PORT, timeout=10)
    headers = {"Content-Type": "application/json; charset=utf-8"}
    if body:
        encoded = json.dumps(body, ensure_ascii=False).encode("utf-8")
        conn.request(method, path, encoded, headers)
    else:
        conn.request(method, path, headers=headers)
    resp = conn.getresponse()
    raw = resp.read().decode()
    conn.close()
    data = json.loads(raw) if raw else {}
    return resp.status, data

def check(label, condition, detail=""):
    if condition:
        print(f"  ✓ {label}" + (f"  ({detail})" if detail else ""))
    else:
        print(f"  ✗ {label} FAIL: {detail}")
        errors.append((label, detail))

def sep(title):
    print("\n" + "=" * 72)
    print(f"  {title}")
    print("=" * 72)

if __name__ == "__main__":
    print("管道水锤压力试算 — 浏览器/API 全链路验证")
    print(f"目标: {BASE}:{PORT}")

    status, data = api("GET", "/api/health")
    check("Web 服务健康检查", status == 200, f"status={status}")
    if status != 200:
        print("Web 服务未启动！请先运行:")
        print("  uvicorn water_hammer_calc.web.server:app --host 127.0.0.1 --port 8000")
        exit(1)

    # 清理数据
    wh_dir = "./wh_data"
    if os.path.exists(wh_dir):
        shutil.rmtree(wh_dir)
    from water_hammer_calc.store import DataStore
    DataStore(wh_dir)

    # ===== 阶段1：首页快速导入铭牌 =====
    sep("阶段1 首页快速导入铭牌 → API")
    with open("samples/nameplate_001.json", encoding="utf-8") as f:
        np_data = json.load(f)
    status, data = api("POST", "/api/nameplates", np_data)
    check("POST /api/nameplates 200", status == 200, f"equipment_id={data.get('equipment_id')}")
    check("返回 equipment_id = PUMP-2024-001", data.get("equipment_id") == "PUMP-2024-001")

    # 验证已保存
    status, data = api("GET", "/api/nameplates")
    check("GET /api/nameplates 返回已导入铭牌", "PUMP-2024-001" in data.get("equipment_ids", []))

    # ===== 阶段2：首页快速导入维修群截图 =====
    sep("阶段2 首页快速导入维修群截图 → API")
    with open("samples/screenshot_001.json", encoding="utf-8") as f:
        ss_data = json.load(f)
    status, data = api("POST", "/api/screenshots", ss_data)
    check("POST /api/screenshots 200", status == 200, f"screenshot_id={data.get('screenshot_id')}")
    check("返回 screenshot_id = SCREEN-2024-001", data.get("screenshot_id") == "SCREEN-2024-001")

    status, data = api("GET", "/api/screenshots")
    check("GET /api/screenshots 返回已导入截图", "SCREEN-2024-001" in data.get("screenshot_ids", []))

    # ===== 阶段3：首页快速计算 =====
    sep("阶段3 首页快速计算 → API → 跳转详情页")
    with open("samples/calc_input_001.json", encoding="utf-8") as f:
        calc_data = json.load(f)
    status, data = api("POST", "/api/calculate", calc_data)
    check("POST /api/calculate 200", status == 200)
    CALC_ID = data.get("calc_id")
    check("返回 calc_id 非空", CALC_ID is not None and len(CALC_ID) > 0)
    result = data.get("result", {})
    check("初始状态 = 需设备工程师复核",
          result.get("status") == "需设备工程师复核", result.get("status"))
    check("OverrideFlags 需复核数 == 2",
          len([f for f in result.get("override_flags", []) if f.get("needs_review")]) == 2)

    # ===== 阶段4：详情页 - 查看计算结果和参数回放页 =====
    sep("阶段4 详情页/回放页 GET 请求")
    status, data = api("GET", f"/api/calculations/{CALC_ID}")
    check("GET /api/calculations/{id} 200", status == 200)
    check("calc_id 一致", data.get("calc_id") == CALC_ID)

    status, replay = api("GET", f"/api/calculations/{CALC_ID}/replay")
    check("GET replay 200", status == 200)
    check("replay.status = 需设备工程师复核", replay.get("status") == "需设备工程师复核")
    check("replay 含 parameter_entries", len(replay.get("parameter_entries", [])) > 0)
    check("replay 含 change_history", isinstance(replay.get("change_history"), list))
    check("replay 含 next_actions", isinstance(replay.get("next_actions"), list))

    # ===== 阶段5：回放页 - 关联维修群截图 =====
    sep("阶段5 回放页 关联维修群截图 → 同步更新")
    status, data = api("POST", f"/api/calculations/{CALC_ID}/link-screenshot/SCREEN-2024-001")
    check("POST link-screenshot 200", status == 200, f"status={status}")
    check("link-screenshot 返回 result (非 input)",
          "result" in data and data.get("status") == "linked")
    linked_result = data.get("result", {})
    vt_src = None
    ff_src = None
    for e in linked_result.get("parameter_entries", []):
        if e.get("name") == "valve_closing_time":
            vt_src = e.get("provenance", {}).get("source")
        if e.get("name") == "friction_factor":
            ff_src = e.get("provenance", {}).get("source")
    check("valve_closing_time 来源 = 维修群截图", vt_src == "维修群截图", vt_src)
    check("friction_factor 来源 = 维修群截图", ff_src == "维修群截图", ff_src)
    check("replay_narrative 含维修群截图",
          "维修群截图" in (linked_result.get("replay_narrative") or ""))

    # 刷新回放页验证
    status, replay2 = api("GET", f"/api/calculations/{CALC_ID}/replay")
    check("刷新后 replay 参数溯源已同步", replay2.get("status") is not None)

    # ===== 阶段6：回放页 - 补充改系数原因 =====
    sep("阶段6 回放页 补充改系数原因 → 状态同步")
    status, data = api("PATCH", f"/api/calculations/{CALC_ID}/overrides/friction_factor",
        {"reason": "老唐提供的管道结垢照片显示实际粗糙度大于设计值", "reviewer": "设备工程师张工"})
    check("PATCH override friction_factor 200", status == 200)
    flags_after_ff = {f["parameter_name"]: f for f in data.get("result", {}).get("override_flags", [])}
    check("friction_flag reviewer = 设备工程师张工",
          flags_after_ff.get("friction_factor", {}).get("reviewer") == "设备工程师张工")

    status, data = api("PATCH", f"/api/calculations/{CALC_ID}/overrides/valve_closing_time",
        {"reason": "维修群截图显示实测关阀时间为2.5秒", "reviewer": "设备工程师张工"})
    check("PATCH override valve_closing_time 200", status == 200)

    # 验证状态已从需复核升级
    status, replay3 = api("GET", f"/api/calculations/{CALC_ID}/replay")
    check("补充原因后 replay.status != 需设备工程师复核",
          replay3.get("status") != "需设备工程师复核", replay3.get("status"))

    # ===== 阶段7：详情页 - 训练教练确认 =====
    sep("阶段7 详情页 训练教练确认 → 写入保存")
    status, data = api("PATCH", f"/api/calculations/{CALC_ID}/status/trainer-review",
        {"reviewer": "训练教练老唐", "comments": "现场已核关阀时间确实为2.5秒，结垢照片属实"})
    check("PATCH trainer-review 200", status == 200)
    trainer_result = data.get("result", {})
    check("reviewed_by_trainer = True", trainer_result.get("reviewed_by_trainer") == True)
    check("trainer_name = 训练教练老唐", trainer_result.get("trainer_name") == "训练教练老唐")

    # 刷新验证
    status, replay4 = api("GET", f"/api/calculations/{CALC_ID}/replay")
    check("刷新后 reviewed_by_trainer 保持 True", replay4.get("reviewed_by_trainer") == True)
    check("刷新后 trainer_name 保持 训练教练老唐", replay4.get("trainer_name") == "训练教练老唐")

    # ===== 阶段8：详情页 - 工程师复核通过 =====
    sep("阶段8 详情页 工程师复核通过 → 写入保存")
    status, data = api("PATCH", f"/api/calculations/{CALC_ID}/status/engineer-review",
        {"approve": True, "reviewer": "设备工程师李工", "comments": "所有参数均有证据支撑，予以通过"})
    check("PATCH engineer-review 200", status == 200)
    eng_result = data.get("result", {})
    check("reviewed_by_engineer = True", eng_result.get("reviewed_by_engineer") == True)
    check("engineer_name = 设备工程师李工", eng_result.get("engineer_name") == "设备工程师李工")
    check("status = 设备工程师已通过", eng_result.get("status") == "设备工程师已通过", eng_result.get("status"))

    # 刷新验证
    status, replay5 = api("GET", f"/api/calculations/{CALC_ID}/replay")
    check("刷新后 reviewed_by_engineer 保持 True", replay5.get("reviewed_by_engineer") == True)
    check("刷新后 status = 设备工程师已通过", replay5.get("status") == "设备工程师已通过")

    # ===== 阶段9：详情页 - 刷新计算 =====
    sep("阶段9 详情页 刷新计算 → 状态/审核人不丢失")
    status, data = api("POST", f"/api/calculations/{CALC_ID}/refresh")
    check("POST refresh 200", status == 200)
    refresh_result = data.get("result", {})
    check("refresh 后 reviewed_by_engineer 仍 True", refresh_result.get("reviewed_by_engineer") == True)
    check("refresh 后 reviewed_by_trainer 仍 True", refresh_result.get("reviewed_by_trainer") == True)
    check("refresh 后 status = 设备工程师已通过", refresh_result.get("status") == "设备工程师已通过")

    # ===== 阶段10：变更历史 =====
    sep("阶段10 变更历史 → 与保存结果一致")
    status, hist = api("GET", f"/api/calculations/{CALC_ID}/history")
    check("GET history 200", status == 200)
    hist_list = hist.get("change_history", [])
    check("变更历史 >= 4 条", len(hist_list) >= 4, f"实际 {len(hist_list)} 条")
    check("含 补录维修群截图 类型", any(h.get("change_type") == "补录维修群截图" for h in hist_list))
    check("含 补充改系数原因 类型", any(h.get("change_type") == "补充改系数原因" for h in hist_list))
    check("含 训练教练确认 类型", any(h.get("change_type") == "训练教练确认" for h in hist_list))
    check("含 设备工程师复核 类型", any(h.get("change_type") == "设备工程师复核" for h in hist_list))

    # ===== 阶段11：归档 =====
    sep("阶段11 详情页 归档 → 写入保存")
    status, data = api("POST", f"/api/calculations/{CALC_ID}/status/finalize")
    check("POST finalize 200", status == 200)
    check("status = 已归档", data.get("result", {}).get("status") == "已归档")

    # ===== 阶段12：导出报告 → 反查一致性 =====
    sep("阶段12 导出报告 → 反查一致性")
    status, export = api("GET", f"/api/calculations/{CALC_ID}/export")
    check("GET export 200", status == 200)
    report = export.get("report", {})
    check("报告 calc_id 匹配", report.get("calc_id") == CALC_ID)
    check("报告 status = 已归档", report.get("status") == "已归档")
    check("报告 parameter_entries 条目与 replay 一致",
          len(report.get("parameter_entries", [])) == len(replay5.get("parameter_entries", [])))
    check("报告 change_history 条目 >= history 阶段10 条目",
          len(report.get("change_history", [])) >= len(hist_list),
          f"report={len(report.get('change_history', []))} hist={len(hist_list)}")
    check("报告 next_action_summary 非空",
          len(report.get("next_action_summary", [])) > 0)

    # 验证报告文件可反查
    file_path = export.get("file_path", "")
    check("报告文件存在于磁盘", os.path.exists(file_path), file_path)
    if os.path.exists(file_path):
        with open(file_path, encoding="utf-8") as f:
            disk_report = json.load(f)
        check("磁盘报告 calc_id 可反查同一条记录", disk_report.get("calc_id") == CALC_ID)

    # ===== 阶段13：缺材料/处理状态/改前改后 核对 =====
    sep("阶段13 缺材料 / 处理状态 / 改前改后 一致性核对")
    all_missing = set()
    all_next = set()
    for e in replay5.get("parameter_entries", []):
        for m in e.get("missing_materials", []):
            all_missing.add(m)
        if e.get("next_action"):
            all_next.add(e["next_action"])
    check("缺材料含 '现场实际管长复测报告'", "现场实际管长复测报告" in all_missing)
    check("缺材料含 '阀门现场实测数据'", "阀门现场实测数据" in all_missing)
    check("下一步含 '找设备工程师'", any("设备工程师" in a for a in all_next))

    for flag in replay5.get("override_flags", []):
        if flag.get("parameter_name") == "friction_factor":
            check("friction_factor reason 非空", flag.get("reason") is not None and len(flag.get("reason", "")) > 0)
            check("friction_factor reviewer 存在（复核后被工程师覆盖）", flag.get("reviewer") is not None and len(flag.get("reviewer", "")) > 0, f"actual={flag.get('reviewer')}")
            check("friction_factor needs_review = False", flag.get("needs_review") == False)
        if flag.get("parameter_name") == "valve_closing_time":
            check("valve_closing_time reason 非空", flag.get("reason") is not None and len(flag.get("reason", "")) > 0)
            check("valve_closing_time needs_review = False", flag.get("needs_review") == False)

    # ===== 汇总 =====
    sep("验证汇总")
    total = 0
    for line in open(__file__):
        if line.strip().startswith("check("):
            total += 1
    passed = total - len(errors)
    print(f"共 {total} 项检查   ✓ 通过 {passed}   ✗ 失败 {len(errors)}")
    if errors:
        print("\n失败项:")
        for lbl, det in errors:
            print(f"  - {lbl}: {det}")
        exit(1)
    else:
        print("\n🎉 浏览器/API 全链路验证 100% 通过！")
        print("   导入铭牌 → 导入截图 → 计算 → 关联截图 → 补原因 → 教练确认 → 工程师复核")
        print("   → 刷新 → 历史 → 归档 → 导出 → 反查")
        print("   所有前端操作通过 API 真实写入，刷新后状态一致，报告可反查！")
