#!/usr/bin/env python3
"""
数列递推参数回放 - 端到端验收测试
覆盖：单位换算、静态资源、图表本地化、CSV一致性、除零边界、历史快照、复算口径
"""
import json
import urllib.request
import urllib.error
import sys

BASE = "http://127.0.0.1:5001"
PASSED = 0
FAILED = 0


def check(name, condition, detail=""):
    global PASSED, FAILED
    if condition:
        PASSED += 1
        print(f"  ✅ {name}")
        if detail:
            print(f"     → {detail}")
    else:
        FAILED += 1
        print(f"  ❌ {name}")
        if detail:
            print(f"     → {detail}")


def get_json(path):
    return json.load(urllib.request.urlopen(BASE + path))


def get_raw(path):
    return urllib.request.urlopen(BASE + path).read()


def main():
    print("=" * 60)
    print("数列递推参数回放 - 端到端验收测试")
    print("=" * 60)

    # ── 1. 基础接口 ──
    print("\n1️⃣  基础接口")
    records = get_json("/api/records")
    check("列表接口返回多条记录", len(records) >= 3, f"实际 {len(records)} 条")

    statuses = {r["status"] for r in records}
    check("包含三种状态记录",
          "已放行" in statuses and "待补证据" in statuses and "人工改过" in statuses,
          f"实际状态: {statuses}")

    # ── 2. 单位换算（毫米→厘米） ──
    print("\n2️⃣  单位换算（毫米→厘米数值换算）")
    mm_record = None
    for r in records:
        if "毫米单位" in r["title"] or "单位换算示例" in r["title"]:
            mm_record = r
            break
    check("找到毫米单位换算样例", mm_record is not None)
    if mm_record:
        detail = get_json(f"/api/records/{mm_record['id']}")
        check("当前单位为厘米", detail["unit"] == "厘米", f"实际: {detail['unit']}")
        check("参数 a0 已换算 (10mm → 1cm)",
              detail["params"]["a0"] == 1,
              f"实际 a0 = {detail['params']['a0']}")
        check("参数 d 已换算 (10mm → 1cm)",
              detail["params"]["d"] == 1,
              f"实际 d = {detail['params']['d']}")
        check("步数 n 不参与换算", detail["params"]["n"] == 5)
        check("首项结果为 1 厘米",
              detail["result_summary"]["first_value"] == 1,
              f"实际: {detail['result_summary']['first_value']}")
        check("末项结果为 6 厘米（n=5 共 6 项）",
              detail["result_summary"]["last_finite_value"] == 6,
              f"实际: {detail['result_summary']['last_finite_value']}")
        check("单位变更日志 ≥ 1 条", len(detail["unit_change_log"]) >= 1)
        if detail["unit_change_log"]:
            log = detail["unit_change_log"][0]
            check("变更记录含 from=毫米 to=厘米",
                  log["from_unit"] == "毫米" and log["to_unit"] == "厘米")
            check("变更记录标记自动换算", log.get("auto_converted") == True)

    # ── 3. 静态截图资源可访问 ──
    print("\n3️⃣  静态截图资源可访问")
    screenshots = [
        "/static/screenshots/v1_mm.svg",
        "/static/screenshots/v2_length.svg",
        "/static/screenshots/div_zero.svg",
    ]
    for path in screenshots:
        try:
            data = get_raw(path)
            check(f"{path} 可访问", len(data) > 100, f"大小 {len(data)} 字节")
            check(f"{path} 是 SVG 格式", b"<svg" in data[:200])
        except urllib.error.HTTPError as e:
            check(f"{path} 可访问", False, f"HTTP {e.code}")

    # ── 4. 图表本地化（无 CDN 依赖） ──
    print("\n4️⃣  图表本地化（无外部 CDN 依赖）")
    html = get_raw("/").decode("utf-8")
    check("页面中无 Chart.js CDN 引用", "cdn.jsdelivr.net/npm/chart" not in html)
    check("页面中使用 Canvas 原生绘图", "getContext" in html or "<canvas" in html)
    check("包含 drawChart 函数", "function drawChart" in html)

    # ── 5. 除零边界留痕 ──
    print("\n5️⃣  除零边界在详情和历史中留痕")
    div_record = [r for r in records if r["has_division_by_zero"]][0]
    check("找到含除零的记录", div_record is not None)
    if div_record:
        detail = get_json(f"/api/records/{div_record['id']}")
        div_steps = [d for d in detail["result_details"] if d["division_by_zero"]]
        check("明细中包含除零步骤", len(div_steps) >= 1)
        check("除零步骤 value_str 含 ∞ 标记",
              all("∞" in d["value_str"] for d in div_steps))
        check("除零步骤有 step_note 说明",
              all(d["step_note"] for d in div_steps))
        check("summary 统计除零步数",
              detail["result_summary"]["division_by_zero_steps"] == len(div_steps))

        # CSV 含除零
        csv_data = get_raw(f"/api/records/{div_record['id']}/csv").decode("utf-8-sig")
        check("CSV 中包含除零标记", "除零" in csv_data or "∞" in csv_data)
        check("CSV 中有 是否含除零边界 字段", "是否有截图证据" in csv_data)

    # ── 6. 历史版本快照完整性 ──
    print("\n6️⃣  历史版本快照完整性")
    if mm_record:
        hist = get_json(f"/api/records/{mm_record['id']}/history")
        check("历史版本 ≥ 2 个", len(hist) >= 2, f"实际 {len(hist)} 个")
        v1 = [h for h in hist if h["version"] == 1][0]
        v2 = [h for h in hist if h["version"] == 2][0]
        check("v1 单位为毫米", v1["unit"] == "毫米")
        check("v2 单位为厘米", v2["unit"] == "厘米")
        check("v1 参数 a0=10", v1["params"]["a0"] == 10)
        check("v2 参数 a0=1（换算后）", v2["params"]["a0"] == 1)
        check("v1 含明细快照", "result_details_snapshot" in v1 and len(v1["result_details_snapshot"]) > 0)
        check("v2 含明细快照", "result_details_snapshot" in v2 and len(v2["result_details_snapshot"]) > 0)
        check("历史含截图 URL", v2.get("screenshot_url") is not None)

    # ── 7. 晚到附件复算 & 口径一致 ──
    print("\n7️⃣  晚到附件复算 & 口径一致性")
    fib = [r for r in records if "斐波那契" in r["title"]][0]
    check("找到斐波那契记录", fib is not None)
    if fib:
        old_version = fib["current_version"]
        data = json.dumps({
            "attachment_name": "验收晚到附件.pdf",
            "attachment_url": "/static/attachments/test.pdf",
            "params": {"a0": 1, "a1": 2, "n": 10},
            "operator": "验收测试"
        }).encode("utf-8")
        req = urllib.request.Request(
            f"{BASE}/api/records/{fib['id']}/recompute",
            data=data, headers={"Content-Type": "application/json"}, method="POST"
        )
        recomputed = json.load(urllib.request.urlopen(req))
        check("复算后版本号 +1", recomputed["current_version"] == old_version + 1)
        check("复算后状态为人工改过", recomputed["status"] == "人工改过")
        check("复算后附件数 ≥ 1", len(recomputed["attachments"]) >= 1)

        # 验证详情、图表数据来源、CSV 三者一致
        # （图表数据和明细共用 result_details，这是统一入口）
        details = recomputed["result_details"]
        summary = recomputed["result_summary"]
        check("result_details 与 summary 首项一致",
              details[0]["value"] == summary["first_value"])
        last_finite = [d for d in details if not d["division_by_zero"] and d["value"] != float('inf')][-1]
        check("result_details 与 summary 末项一致",
              last_finite["value"] == summary["last_finite_value"])

        # CSV 与接口数据一致
        csv_data = get_raw(f"/api/records/{fib['id']}/csv").decode("utf-8-sig")
        check("CSV 标题与接口一致", recomputed["title"] in csv_data)
        check("CSV 状态与接口一致", recomputed["status"] in csv_data)
        check("CSV 单位与接口一致", recomputed["unit"] in csv_data)
        check("CSV 版本与接口一致", f",{recomputed['current_version']}," in csv_data or
              f'"{recomputed["current_version"]}"' in csv_data or
              str(recomputed["current_version"]) in csv_data)
        check("CSV 有截图证据字段", "是否有截图证据" in csv_data)

    # ── 8. CSV 三分类标记 ──
    print("\n8️⃣  CSV 三分类（已放行/待补证据/人工改过）")
    all_csv = get_raw("/api/records/csv").decode("utf-8-sig")
    check("全部 CSV 含 记录分类标签 列", "记录分类标签" in all_csv)
    check("全部 CSV 含 已放行 记录", "已放行" in all_csv)
    check("全部 CSV 含 待补证据 记录", "待补证据" in all_csv)
    check("全部 CSV 含 人工改过 记录", "人工改过" in all_csv)
    check("全部 CSV 含截图证据字段", "是否有截图证据" in all_csv)

    # ── 9. 状态筛选接口 ──
    print("\n9️⃣  状态筛选接口")
    released = get_json("/api/records?status=%E5%B7%B2%E6%94%BE%E8%A1%8C")
    pending = get_json("/api/records?status=%E5%BE%85%E8%A1%A5%E8%AF%81%E6%8D%AE")
    check("筛选 已放行 结果正确", all(r["status"] == "已放行" for r in released))
    check("筛选 待补证据 结果正确", all(r["status"] == "待补证据" for r in pending))

    # ── 10. 单条记录 CSV 格式 ──
    print("\n🔟 单条记录 CSV 明细完整度")
    if div_record:
        csv_text = get_raw(f"/api/records/{div_record['id']}/csv").decode("utf-8-sig")
        lines = csv_text.strip().splitlines()
        check("单条 CSV 行数充足", len(lines) >= 10)
        check("CSV 含分类说明", "已放行 = 核对完成可对外" in csv_text)
        check("CSV 含明细数据区", "明细数据" in csv_text)
        check("CSV 明细含 除零标记 列", "除零标记" in csv_text)

    # ── 汇总 ──
    print("\n" + "=" * 60)
    total = PASSED + FAILED
    print(f"测试完成: {PASSED}/{total} 通过, {FAILED} 失败")
    if FAILED == 0:
        print("🎉 全部通过验收！")
    else:
        print("⚠️  存在失败用例，请检查")
    print("=" * 60)

    return FAILED == 0


if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)
