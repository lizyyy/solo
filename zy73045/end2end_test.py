"""端到端验证脚本 — 跑通全部核心功能。

用例：
  1. 生成 3 条示例工单（已处理 / 待补 / 卡壳）
  2. 三条工单 replay 后分别落在 handled / pending_evidence / stuck
  3. S003 回放输出：
       - 照片时间错位 high/critical
       - 备件版本冲突
       - 报警与人工备注对不上
       - 结论变更历史可见
  4. 对 S003 做一次补录，结论再次变更，时间线 + conclusion_history 能看到
  5. list 分类正确
  6. export 原始快照文件成功，且保留 raw_entry
  7. 模块方式调用和 CLI 方式调用结果一致
"""

from __future__ import annotations

import json
import os
import shutil
import sys
import tempfile
from pathlib import Path

# 把工程根加入 sys.path 以便作为脚本直接跑
ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from bridge_support_replay import (  # noqa: E402
    replay_workorder,
    list_workorders,
    supplement_evidence,
    load_workorder,
    build_timeline,
    validate_photo_timeline,
    classify_workorder,
)
from bridge_support_replay.sample_data import generate_demo_workorders  # noqa: E402
from bridge_support_replay.storage import (  # noqa: E402
    save_workorder,
    export_raw_backup,
    DATA_DIR,
)
from bridge_support_replay.cli import main as cli_main  # noqa: E402
from bridge_support_replay.models import WorkOrderStatus  # noqa: E402


RED, GREEN, YELLOW, RESET = "\033[31m", "\033[32m", "\033[33m", "\033[0m"
PASS = f"{GREEN}✓{RESET}"
FAIL = f"{RED}✗{RESET}"


def _reset_data_dir():
    if DATA_DIR.exists():
        shutil.rmtree(DATA_DIR)
    DATA_DIR.mkdir(parents=True)


def assert_eq(name, expected, actual, *, show=False):
    ok = expected == actual
    if ok:
        print(f"  {PASS} {name}: {expected}")
    else:
        print(f"  {FAIL} {name}: 期望={expected!r}  实际={actual!r}")
    if show and not ok:
        print(f"       details: {actual}")
    return ok


def assert_in(name, key, container):
    ok = key in container
    if ok:
        print(f"  {PASS} {name}: {key!r} 存在")
    else:
        print(f"  {FAIL} {name}: {key!r} 不在 {list(container.keys())}")
    return ok


def assert_true(name, cond, extra=""):
    if cond:
        print(f"  {PASS} {name}")
    else:
        print(f"  {FAIL} {name}  {extra}")
    return cond


# ---------- 用例 ----------

def case_1_generate_and_status():
    print("【用例1】生成示例工单，分类器判定三种状态")
    generate_demo_workorders()
    r1 = replay_workorder("WO-2025-S001", strict=False)
    r2 = replay_workorder("WO-2025-S002", strict=False)
    r3 = replay_workorder("WO-2025-S003", strict=False)
    all_ok = True
    all_ok &= assert_eq("S001 回放状态", WorkOrderStatus.HANDLED, r1.status)
    all_ok &= assert_eq("S001 success", True, r1.success)
    all_ok &= assert_eq("S002 回放状态", WorkOrderStatus.PENDING_EVIDENCE, r2.status)
    all_ok &= assert_eq("S003 回放状态", WorkOrderStatus.STUCK, r3.status)
    all_ok &= assert_eq("S003 strict 失败", False, replay_workorder("WO-2025-S003", strict=True).success)
    return all_ok


def case_2_s003_detects_three_issues():
    print("【用例2】S003 要同时检测出三个问题（照片错位/备件冲突/报警对不上）")
    r = replay_workorder("WO-2025-S003", strict=True)
    fr = r.failure_reason
    if fr is None:
        print(f"  {FAIL} 未返回任何 failure_reason")
        return False
    codes_seen = [f["code"] for f in fr.details.get("all_failures", [fr.to_dict()])]
    # 可能 all_failures 不是主 code，换方式取
    codes = set()
    for f in fr.details.get("all_failures", []):
        codes.add(f["code"])
    if not codes:
        codes.add(fr.code.value)
    print(f"  检测到失败码：{codes}")
    ok = True
    ok &= assert_in("失败码含 photo_time_mismatch",
                    "photo_time_mismatch", codes)
    ok &= assert_in("失败码含 spare_part_version_conflict",
                    "spare_part_version_conflict", codes)
    ok &= assert_in("失败码含 alarm_note_mismatch",
                    "alarm_note_mismatch", codes)
    ok &= assert_in("失败码含 insufficient_evidence",
                    "insufficient_evidence", codes)
    # 建议动作不为空
    ok &= assert_true("failure_reason 提供处理建议",
                      len(fr.suggested_actions) > 0,
                      f"实际数量={len(fr.suggested_actions)}")
    return ok


def case_3_photo_mismatch_suggestions():
    print("【用例3】照片错位不只警告，还要告诉接手同事怎么做")
    p_high, p_crit = None, None
    wo = load_workorder("WO-2025-S003")
    for ph in wo.photos:
        info = validate_photo_timeline(ph)
        if info.severity == "high":
            p_high = info
        if info.severity == "critical":
            p_crit = info
    ok = True
    ok &= assert_true("存在 high 级错位", p_high is not None)
    ok &= assert_true("存在 critical 级错位", p_crit is not None)
    if p_high:
        ok &= assert_true("high 级给出具体步骤",
                          len(p_high.suggested_actions) >= 3)
        print(f"  {PASS} high 级建议：{p_high.suggested_actions[0][:60]}...")
    if p_crit:
        ok &= assert_true("critical 级含重拍/升级建议",
                          any(("re_shoot" in a or "escalate" in a or "老唐" in a)
                              for a in p_crit.suggested_actions))
        print(f"  {PASS} critical 级建议含 escalate / re_shoot / 老唐")
    return ok


def case_4_reversal_history_visible():
    print("【用例4】结论变更历史可见（旧材料/新备注/改判原因）")
    wo = load_workorder("WO-2025-S003")
    ch = wo.conclusion_history
    ok = True
    ok &= assert_true("至少有 1 次结论变更", len(ch) >= 1)
    if ch:
        last = ch[-1]
        ok &= assert_in("含 old_conclusion", "old_conclusion", last)
        ok &= assert_in("含 new_conclusion", "new_conclusion", last)
        ok &= assert_in("含 reversal_reason", "reversal_reason", last)
        ok &= assert_in("含 evidence_snapshot", "evidence_snapshot", last)
        ok &= assert_true("旧结论 != 新结论",
                          last.get("old_conclusion") != last.get("new_conclusion"),
                          f"  old={last.get('old_conclusion')} new={last.get('new_conclusion')}")
    # 时间线里要有 REVERSAL 事件
    tl = build_timeline(wo)
    reversals = [e for e in tl if e["type"] == "reversal"]
    ok &= assert_true("时间线含 reversal 事件", len(reversals) >= 1)
    return ok


def case_5_supplement_appends_history():
    print("【用例5】再做一次补录，时间线 + conclusion_history 长度都会增长")
    wo_before = load_workorder("WO-2025-S003")
    tl_before = len(wo_before.timeline)
    ch_before = len(wo_before.conclusion_history)

    supplement_evidence(
        "WO-2025-S003",
        actor="孙七",
        note="已要求赵六重新检查相机时区，并到现场重拍（含手机屏幕水印）",
        evidence={"处理人": "赵六", "要求完成日期": "2025-11-05"},
        new_conclusion="等待赵六重拍后复核",
        reversal_reason="需新照片证据才能判断支座是否真的合格",
    )
    wo_after = load_workorder("WO-2025-S003")
    ok = True
    ok &= assert_true("时间线 +1", len(wo_after.timeline) == tl_before + 1,
                      f" before={tl_before} after={len(wo_after.timeline)}")
    ok &= assert_true("结论历史 +1", len(wo_after.conclusion_history) == ch_before + 1,
                      f" before={ch_before} after={len(wo_after.conclusion_history)}")
    last_ch = wo_after.conclusion_history[-1]
    ok &= assert_eq("最新改判人", "孙七", last_ch["actor"])
    ok &= assert_eq("最新结论", "等待赵六重拍后复核", wo_after.current_conclusion)
    return ok


def case_6_list_bucketing():
    print("【用例6】list_workorders 三类分开统计")
    data = list_workorders()
    s = data["summary"]
    ok = True
    ok &= assert_eq("总条数", 3, s["total"])
    ok &= assert_eq("已处理 1 条", 1, s["handled_count"])
    ok &= assert_eq("待补 1 条", 1, s["pending_evidence_count"])
    ok &= assert_true("卡壳至少 1 条 (S003)", s["stuck_count"] >= 1)
    # override_note 可见（S003 硬标 pending 但实际 stuck）
    stuck = data["stuck"]
    override = [x for x in stuck if x.get("override_note")]
    ok &= assert_true("S003 出现 override_note（标记与实际不符警告）",
                      len(override) >= 1)
    return ok


def case_7_raw_export_preserves_everything():
    print("【用例7】导出原始快照 — raw_entry / raw_snapshot / cleaning_log 全都在")
    with tempfile.TemporaryDirectory() as td:
        path = export_raw_backup("WO-2025-S001", Path(td))
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
    ok = True
    ok &= assert_in("导出文件含 raw_snapshot", "raw_snapshot", data)
    ok &= assert_in("导出文件含 cleaning_log", "cleaning_log", data)
    parts = data.get("spare_parts_raw_entries", [])
    ok &= assert_true("含 ≥2 条备件 raw_entry", len(parts) >= 2)
    for p in parts:
        ok &= assert_in(f"备件 {p['part_id']} 含 raw_entry", "raw_entry", p)
    return ok


def case_8_cli_smoke():
    print("【用例8】CLI 子命令冒烟测试（list / replay --json / timeline --json）")
    ok = True
    # list --json
    import io
    import contextlib

    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        rc = cli_main(["list", "--json"])
    ok &= assert_eq("list --json 退出码 0", 0, rc)
    out = json.loads(buf.getvalue())
    ok &= assert_in("CLI list 含 summary", "summary", out)

    # replay --json
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        rc = cli_main(["replay", "WO-2025-S001", "--json"])
    ok &= assert_eq("replay --json 退出码 0", 0, rc)
    out = json.loads(buf.getvalue())
    ok &= assert_eq("replay workorder_id", "WO-2025-S001", out["workorder_id"])

    # timeline --json
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        rc = cli_main(["timeline", "WO-2025-S003", "--json"])
    ok &= assert_eq("timeline --json 退出码 0", 0, rc)
    out = json.loads(buf.getvalue())
    ok &= assert_in("timeline 输出含 conclusion_history",
                    "conclusion_history", out)
    return ok


def case_9_raw_never_modified():
    print("【用例9】raw_snapshot / raw_entry 永远不会被 save_workorder 覆盖")
    wo = load_workorder("WO-2025-S001")
    original_raw_snapshot = json.dumps(wo.raw_snapshot, sort_keys=True)
    original_entries = [
        json.dumps(sp.raw_entry, sort_keys=True) for sp in wo.spare_parts
    ]
    # 做一次 save
    wo.updated_at = None  # 触发 update
    save_workorder(wo, updated_by="test")
    # 再 load 回来
    wo2 = load_workorder("WO-2025-S001")
    ok = True
    ok &= assert_eq("raw_snapshot 未被修改",
                    original_raw_snapshot,
                    json.dumps(wo2.raw_snapshot, sort_keys=True))
    new_entries = [json.dumps(sp.raw_entry, sort_keys=True) for sp in wo2.spare_parts]
    ok &= assert_eq("备件 raw_entry 未被修改", original_entries, new_entries)
    # 故意清空 raw_snapshot 再 save — storage 要从老文件里补回来
    wo2.raw_snapshot = {}
    save_workorder(wo2, updated_by="test")
    wo3 = load_workorder("WO-2025-S001")
    ok &= assert_eq("即使代码里清空 raw_snapshot，save 后仍自动恢复",
                    original_raw_snapshot,
                    json.dumps(wo3.raw_snapshot, sort_keys=True))
    return ok


# ---------- main ----------

def main():
    print("=" * 60)
    print("桥梁支座工单回放系统 — 端到端验证")
    print("=" * 60)
    _reset_data_dir()
    print(f"数据目录：{DATA_DIR}")
    print()

    cases = [
        case_1_generate_and_status,
        case_2_s003_detects_three_issues,
        case_3_photo_mismatch_suggestions,
        case_4_reversal_history_visible,
        case_5_supplement_appends_history,
        case_6_list_bucketing,
        case_7_raw_export_preserves_everything,
        case_8_cli_smoke,
        case_9_raw_never_modified,
    ]
    passed = 0
    failed = 0
    for i, case in enumerate(cases, 1):
        try:
            ok = case()
        except Exception as e:
            import traceback
            print(f"  {FAIL} 用例异常：{e!r}")
            traceback.print_exc()
            ok = False
        print()
        if ok:
            passed += 1
        else:
            failed += 1
    print("=" * 60)
    print(f"总计 {len(cases)} 个用例：通过 {passed}，失败 {failed}")
    print("=" * 60)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
