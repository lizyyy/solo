#!/usr/bin/env python3
"""
导出文件断言脚本 — 用于验证概率抽样审计计划导出的 JSON 文件中，
SA002、SA003、SA006、SA015 四个关键样本是否完整包含：
  - finalJudgement（最终判定，必须为 pending）
  - pendingType（待复核类型：boundary_range / negative_value）
  - pendingReason（处理原因 / 待复核原因）
  - reviewHandler（下一步找谁 / 复核人）
  - operationLog（操作历史）
  - judgements.final（最终判定镜像，必须与 finalJudgement 一致）
  - isPending（布尔镜像，必须为 true）
同时证明：effectiveBoundary.currentBoundary 与 conflictAuditTrail.finalBoundary
在 S001/S003/S005 上完全一致。

用法：
    python3 verify_export.py [导出文件路径]
如果不传路径，默认读取同目录下的 exported_from_browser.json
"""
import json
import sys
from pathlib import Path


def fail(msg):
    print(f"  ❌ {msg}")
    return False


def ok(msg):
    print(f"  ✅ {msg}")
    return True


def verify(path: Path) -> int:
    if not path.exists():
        print(f"ERROR: 导出文件不存在：{path}")
        return 2
    data = json.loads(path.read_text(encoding="utf-8"))
    print(f"读取文件: {path}")
    print(f"schemaVersion: {data.get('schemaVersion')}")
    print(f"exportTime: {data.get('exportTime')}")
    print(f"summary: {json.dumps(data.get('summary'), ensure_ascii=False)}")
    print()

    sample_by_id = {s["sampleId"]: s for s in data.get("sampleData", [])}
    pending_by_id = {p["sampleId"]: p for p in data.get("pendingSamples", [])}
    negative_by_id = {n["sampleId"]: n for n in data.get("negativeSamples", [])}
    eff_by_id = {b["boundaryId"]: b for b in data.get("effectiveBoundaries", [])}
    audit_by_id = {a["id"]: a for a in data.get("conflictAuditTrail", [])}

    errors = 0

    # ========== 1. 样本级字段断言 ==========
    expectations = [
        # SA002: 语文 62 分，边界 60，边界±2 范围内，沿用边界值说明
        {
            "sampleId": "SA002",
            "boundaryId": "S001",
            "value": 62,
            "effectiveBoundary": 60,
            "finalJudgement": "pending",
            "pendingType": "boundary_range",
            "reviewHandler_contains": "学生助教",
            "pendingReason_contains_all": ["沿用边界值说明", "±2", "学生助教"],
        },
        # SA003: 语文 58 分，边界 60，边界±2 范围内，沿用边界值说明
        {
            "sampleId": "SA003",
            "boundaryId": "S001",
            "value": 58,
            "effectiveBoundary": 60,
            "finalJudgement": "pending",
            "pendingType": "boundary_range",
            "reviewHandler_contains": "学生助教",
            "pendingReason_contains_all": ["沿用边界值说明", "±2", "学生助教"],
        },
        # SA006: 数学 -3，负数样本
        {
            "sampleId": "SA006",
            "boundaryId": "S002",
            "value": -3,
            "effectiveBoundary": 75,
            "finalJudgement": "pending",
            "pendingType": "negative_value",
            "reviewHandler_contains": "学生助教",
            "pendingReason_contains_all": ["负数", "缺失", "学生助教"],
        },
        # SA015: 化学 -1，负数样本
        {
            "sampleId": "SA015",
            "boundaryId": "S005",
            "value": -1,
            "effectiveBoundary": 68,
            "finalJudgement": "pending",
            "pendingType": "negative_value",
            "reviewHandler_contains": "学生助教",
            "pendingReason_contains_all": ["负数", "缺失", "学生助教"],
        },
    ]

    print(f"== 1. 关键样本字段级断言 ==")
    for exp in expectations:
        sid = exp["sampleId"]
        print(f"[{sid}]")
        s = sample_by_id.get(sid)
        if not s:
            errors += 1
            fail(f"在 exportData.sampleData 中找不到 {sid}")
            continue

        checks = []
        checks.append((s["finalJudgement"] == exp["finalJudgement"],
                       f"finalJudgement == {exp['finalJudgement']}（实际：{s['finalJudgement']}）"))
        checks.append((s.get("isPending") is True,
                       f"isPending == true（实际：{s.get('isPending')}）"))
        checks.append((s["pendingType"] == exp["pendingType"],
                       f"pendingType == {exp['pendingType']}（实际：{s['pendingType']}）"))
        checks.append((exp["reviewHandler_contains"] in (s.get("reviewHandler") or ""),
                       f"reviewHandler 包含 '{exp['reviewHandler_contains']}'（实际：{s.get('reviewHandler')}）"))
        pr = s.get("pendingReason") or ""
        for kw in exp["pendingReason_contains_all"]:
            checks.append((kw in pr, f"pendingReason 包含 '{kw}'"))
        checks.append((isinstance(s.get("operationLog"), str) and len(s["operationLog"]) > 0,
                       f"operationLog 非空字符串（长度：{len(s.get('operationLog') or '')}）"))
        checks.append((s.get("judgements", {}).get("final") == exp["finalJudgement"],
                       f"judgements.final == {exp['finalJudgement']}（实际：{s.get('judgements', {}).get('final')}）"))
        checks.append((s.get("judgements", {}).get("final") == s.get("finalJudgement"),
                       "judgements.final 与 finalJudgement 一致"))
        checks.append((s.get("effectiveBoundary") == exp["effectiveBoundary"],
                       f"effectiveBoundary == {exp['effectiveBoundary']}（实际：{s.get('effectiveBoundary')}）"))
        checks.append((s.get("boundaryId") == exp["boundaryId"],
                       f"boundaryId == {exp['boundaryId']}"))
        checks.append((s.get("reportIncluded") is True,
                       f"reportIncluded == true（证明来自 generateReport 已写回的 sampleData，不是重建的空壳）"))

        for cond, msg in checks:
            if cond:
                ok(msg)
            else:
                errors += 1
                fail(msg)

        # 同时检查 SA002/SA003 应该在 conflictAudit 里带 reason/nextStep（因为 S001 走了沿用）
        # SA006 没有 conflictAudit（S002 无冲突）；SA015 有 conflictAudit（S005 被修正，但 needReview=false）
        if sid in ("SA002", "SA003"):
            ca = s.get("conflictAudit") or {}
            for f in ("choice", "reason", "nextStep", "finalBoundary", "originalBoundary", "weightBoundary", "needReview"):
                if f not in ca:
                    errors += 1
                    fail(f"conflictAudit 缺少字段 {f}")
                else:
                    ok(f"conflictAudit.{f} = {ca[f]!r}")
            if ca.get("needReview") is not True:
                errors += 1
                fail(f"S001 的样本 conflictAudit.needReview 应为 true（沿用边界值说明需复核），实际 {ca.get('needReview')}")
            else:
                ok("conflictAudit.needReview = true（沿用边界值说明的样本标为需复核）")

    # ========== 2. 顶级 pendingSamples / negativeSamples 与 sampleData 一致性 ==========
    print(f"\n== 2. 顶级 pendingSamples / negativeSamples 清单与 sampleData 一致性 ==")
    for sid in ("SA002", "SA003", "SA006", "SA015"):
        ps = pending_by_id.get(sid)
        if not ps:
            errors += 1
            fail(f"{sid} 应出现在顶级 pendingSamples 清单中，但未找到")
        else:
            ok(f"{sid} 在顶级 pendingSamples 中，pendingType={ps.get('pendingType')}, reviewHandler={ps.get('reviewHandler')}")
            if ps.get("pendingReason") != sample_by_id[sid].get("pendingReason"):
                errors += 1
                fail(f"{sid} pendingSamples.pendingReason 与 sampleData.pendingReason 不一致")
            else:
                ok(f"{sid} pendingSamples.pendingReason 与 sampleData 完全一致")

    for sid in ("SA006", "SA015"):
        ns = negative_by_id.get(sid)
        if not ns:
            errors += 1
            fail(f"{sid} 应出现在顶级 negativeSamples 清单中，但未找到")
        else:
            ok(f"{sid} 在顶级 negativeSamples 中")
            for f in ("finalJudgement", "pendingReason", "reviewHandler", "effectiveBoundary", "operationLog"):
                ns_v = ns.get(f)
                sd_v = sample_by_id[sid].get(f)
                if f == "operationLog":
                    cond = isinstance(ns_v, str) and len(ns_v) > 0
                else:
                    cond = ns_v == sd_v
                if cond:
                    ok(f"  negativeSamples.{f} 有效/一致：{ns_v if f != 'operationLog' else f'(length {len(ns_v)})'}")
                else:
                    errors += 1
                    fail(f"  negativeSamples.{f} 与 sampleData 不一致：{ns_v!r} vs {sd_v!r}")

    # ========== 3. effectiveBoundary ↔ conflictAuditTrail 一致性 ==========
    print(f"\n== 3. effectiveBoundary ↔ conflictAuditTrail 数据一致性（S001/S003/S005） ==")
    for bid, exp_current in (("S001", 60), ("S003", 72), ("S005", 68)):
        eff = eff_by_id.get(bid)
        aud = audit_by_id.get(bid)
        if not eff or not aud:
            errors += 1
            fail(f"{bid}: effectiveBoundary 或 conflictAuditTrail 缺失")
            continue
        if eff["currentBoundary"] != aud["finalBoundary"]:
            errors += 1
            fail(f"{bid}: effectiveBoundary.currentBoundary={eff['currentBoundary']} 与 conflictAuditTrail.finalBoundary={aud['finalBoundary']} 不一致")
        else:
            ok(f"{bid}: currentBoundary({eff['currentBoundary']}) == finalBoundary({aud['finalBoundary']}) — 同步")
        if eff["currentBoundary"] != exp_current:
            errors += 1
            fail(f"{bid}: currentBoundary 应为 {exp_current}，实际 {eff['currentBoundary']}")
        else:
            ok(f"{bid}: currentBoundary == {exp_current}（期望值）")
        if aud.get("reason") and aud.get("nextStep"):
            ok(f"{bid}: conflictAuditTrail.reason='{aud['reason']}', nextStep='{aud['nextStep']}'")
        else:
            errors += 1
            fail(f"{bid}: conflictAuditTrail 缺少 reason 或 nextStep")
        if bid == "S001":
            if aud.get("needReview") is not True:
                errors += 1
                fail(f"S001 (沿用边界值说明) needReview 应为 true，实际 {aud.get('needReview')}")
            else:
                ok(f"S001 needReview=true（沿用边界值说明 → 留交助教）")

    # ========== 4. summary 统计与实际样本计数一致 ==========
    print(f"\n== 4. summary 统计与实际样本计数一致 ==")
    actual_pending = sum(1 for s in data["sampleData"] if s.get("finalJudgement") == "pending")
    actual_normal = sum(1 for s in data["sampleData"] if s.get("finalJudgement") == "normal")
    actual_borderline = sum(1 for s in data["sampleData"] if s.get("finalJudgement") == "borderline")
    summary = data["summary"]
    for field, actual in (("pending", actual_pending), ("normal", actual_normal), ("borderline", actual_borderline)):
        if summary["finalCounts"][field] == actual:
            ok(f"summary.finalCounts.{field} = {actual} 与实际一致")
        else:
            errors += 1
            fail(f"summary.finalCounts.{field} = {summary['finalCounts'][field]}，实际 {actual}")

    actual_negative_type = sum(1 for s in data["sampleData"] if s.get("pendingType") == "negative_value")
    actual_boundary_type = sum(1 for s in data["sampleData"] if s.get("pendingType") == "boundary_range")
    for field, actual in (("negative_value", actual_negative_type), ("boundary_range", actual_boundary_type)):
        if summary["pendingBreakdown"][field] == actual:
            ok(f"summary.pendingBreakdown.{field} = {actual} 与实际一致")
        else:
            errors += 1
            fail(f"summary.pendingBreakdown.{field} = {summary['pendingBreakdown'][field]}，实际 {actual}")

    # ========== 5. 证明 SA002/SA003 没有被提前归为正常 ==========
    print(f"\n== 5. 证明沿用边界值说明 + 边界±2 范围样本没有被提前归为正常 ==")
    # SA002: 62 分，生效边界 60，按生效边界本应为 normal，但被 pendingReason 拦截为 pending
    sa002 = sample_by_id["SA002"]
    if sa002["judgements"].get("byEffectiveBoundary") == "normal" and sa002["finalJudgement"] == "pending":
        ok(f"SA002: 按生效边界本应判定 normal，但 finalJudgement=pending（被 pendingReason 拦截，未提前归为正常）")
    else:
        errors += 1
        fail(f"SA002: byEffectiveBoundary={sa002['judgements'].get('byEffectiveBoundary')}, finalJudgement={sa002['finalJudgement']}（预期前者 normal 后者 pending）")
    # SA003: 58 分，生效边界 60，按生效边界应为 borderline；因为 S001 沿用并标了边界±2范围需复核，
    # 所以最终应被 pendingReason 强制覆盖为 pending，不能保留 borderline
    sa003 = sample_by_id["SA003"]
    if sa003["judgements"].get("byEffectiveBoundary") == "borderline" and sa003["finalJudgement"] == "pending":
        ok(f"SA003: 按生效边界本应判定 borderline(58<60)，最终被 pendingReason 强制覆盖为 pending（未保留 borderline，留交助教）")
    else:
        errors += 1
        fail(f"SA003: byEffectiveBoundary={sa003['judgements'].get('byEffectiveBoundary')}, finalJudgement={sa003['finalJudgement']}（预期前者 borderline 后者 pending）")

    # 额外断言：SA002/SA003 的 finalJudgement 都不是 normal/borderline/abnormal/missing，
    # 证明"沿用边界值说明"后没有提前归为正常或任何终态
    for sid in ("SA002", "SA003"):
        s = sample_by_id[sid]
        if s["finalJudgement"] not in ("normal", "borderline", "abnormal", "missing"):
            ok(f"{sid}: finalJudgement={s['finalJudgement']} 不是任何终态判定，保留待复核状态正确")
        else:
            errors += 1
            fail(f"{sid}: finalJudgement={s['finalJudgement']} 被错误提前归为终态")

    # ========== 结果汇总 ==========
    print()
    if errors == 0:
        print("🎉 全部断言通过：导出文件中的 SA002 / SA003 / SA006 / SA015 完整携带最终判定、待复核原因、复核人、操作历史，且 effectiveBoundary 与 conflictAuditTrail 完全同步。")
        return 0
    print(f"❌ 失败：共 {errors} 项断言未通过。")
    return 1


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(__file__).parent / "exported_from_browser.json"
    sys.exit(verify(target))
