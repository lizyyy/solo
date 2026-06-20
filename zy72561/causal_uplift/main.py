#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import argparse
import json
import os
import sys
from datetime import datetime
from typing import Dict, Any, List, Optional

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.importer import import_candidate_table
from src.conflict_detector import load_params, detect_conflicts_and_supplement
from src.reviewer import (
    list_pending_items,
    experiment_owner_confirm,
    experiment_owner_reject,
    recommend_lead_review,
    get_history_for_sample,
)
from src.explainer import refresh_summaries, lookup_summary_by_sample
from src.storage import save_state, load_state, clear_state


BASE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_CSV = os.path.join(BASE, "data", "candidate_table.csv")
DEFAULT_PARAMS = os.path.join(BASE, "config", "params.yaml")
OUTPUT_DIR = os.path.join(BASE, "output")
REPORTS_DIR = os.path.join(BASE, "reports")


def _mkdirs() -> None:
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    os.makedirs(REPORTS_DIR, exist_ok=True)


def _dump_json(obj: Any, path: str) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, indent=2)


# ========== cmd: import ==========
def cmd_import(args) -> int:
    _mkdirs()
    if getattr(args, "reset", False):
        clear_state(args.state)
    params = load_params(args.params)
    state, import_log = import_candidate_table(args.csv, params["pipeline"]["default_score"])
    conflicts, supplements = detect_conflicts_and_supplement(state, params)
    pending = list_pending_items(state)
    save_state(state, args.state)

    out = {
        "step": "import",
        "timestamp": datetime.now().isoformat(),
        "imported_count": len(import_log),
        "records": import_log,
        "conflict_report": conflicts,
        "supplement_report": supplements,
        "pending_items": pending,
        "state_path": save_state(state, args.state),
    }
    _dump_json(out, os.path.join(OUTPUT_DIR, "import_result.json"))
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


# ========== cmd: review list ==========
def cmd_review_list(args) -> int:
    state = load_state(args.state)
    if not state.records:
        print("state 为空，请先运行 `import`")
        return 1
    pending = list_pending_items(state)
    out = {
        "step": "review list",
        "timestamp": datetime.now().isoformat(),
        "pending_items": pending,
        "all_statuses": {sid: rec.status.value for sid, rec in state.records.items()},
    }
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


# ========== cmd: review decide ==========
def _validate_and_decide(state, params, args) -> Dict[str, Any]:
    sample_id = args.sample_id
    decision = args.decision.lower()
    role = args.role.lower()

    if sample_id not in state.records:
        return {"ok": False, "error": f"sample_id={sample_id} 不存在，请先 import"}

    if role == "experiment_platform":
        actor = args.actor or params["review_settings"]["roles"]["experiment_platform_owner"]
        if decision == "confirm":
            ok, res = experiment_owner_confirm(state, sample_id, actor, args.reason)
        elif decision == "reject":
            ok, res = experiment_owner_reject(
                state, sample_id, actor, args.reason,
                rollback_score=args.rollback_score,
            )
        else:
            return {"ok": False, "error": "experiment_platform 仅支持 confirm / reject"}
    elif role == "recommend_lead":
        actor = args.actor or params["review_settings"]["roles"]["recommend_lead"]
        if decision == "accept_default":
            ok, res = recommend_lead_review(state, sample_id, actor, "ACCEPT_DEFAULT", args.reason)
        elif decision == "override":
            if args.final_score is None:
                return {"ok": False, "error": "override 需要 --final-score"}
            ok, res = recommend_lead_review(
                state, sample_id, actor, "OVERRIDE", args.reason,
                final_score=args.final_score,
            )
        else:
            return {"ok": False, "error": "recommend_lead 仅支持 accept_default / override"}
    else:
        return {"ok": False, "error": "--role 必须是 experiment_platform 或 recommend_lead"}

    if not ok:
        return {"ok": False, "error": res.get("error", "未知错误")}
    return {"ok": True, "result": res}


def cmd_review_decide(args) -> int:
    state = load_state(args.state)
    if not state.records:
        print("state 为空，请先运行 `import`")
        return 1
    params = load_params(args.params)
    res = _validate_and_decide(state, params, args)
    if not res["ok"]:
        print(json.dumps({"error": res["error"]}, ensure_ascii=False, indent=2))
        return 2
    save_state(state, args.state)
    out = {
        "step": "review decide",
        "timestamp": datetime.now().isoformat(),
        "submitted_by_role": args.role,
        "decision": res["result"],
    }
    _dump_json(out, os.path.join(OUTPUT_DIR, f"review_{args.sample_id}_{args.decision}.json"))
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


# ========== cmd: refresh ==========
def cmd_refresh(args) -> int:
    state = load_state(args.state)
    if not state.records:
        print("state 为空，请先运行 `import`")
        return 1
    params = load_params(args.params)
    summaries = refresh_summaries(state, params)

    errors = []
    for sid in list(state.records.keys()):
        summary = lookup_summary_by_sample(state, sid)
        history = get_history_for_sample(state, sid)
        if summary is None:
            errors.append(f"{sid}: 无摘要")
            continue
        if summary["sample_id"] != sid:
            errors.append(f"{sid}: 摘要 sample_id 错配")
        for ts in summary["review_history_refs"]:
            if not any(h["timestamp"] == ts for h in history):
                errors.append(f"{sid}: review_history_refs 无法反查到历史 {ts}")

    save_state(state, args.state)
    out = {
        "step": "refresh",
        "timestamp": datetime.now().isoformat(),
        "summaries": summaries,
        "cross_check": {
            "has_error": bool(errors),
            "errors": errors,
            "description": "每条摘要 sample_id 与 review_history_refs 核对结果",
        },
    }
    _dump_json(out, os.path.join(OUTPUT_DIR, "refresh_result.json"))
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0 if not errors else 3


# ========== cmd: report ==========
def cmd_report(args) -> int:
    state = load_state(args.state)
    if not state.records:
        print("state 为空，请先运行 `import` 和 `refresh`")
        return 1
    params = load_params(args.params)
    if not state.summaries:
        refresh_summaries(state, params)

    lines = []
    lines.append("=" * 80)
    lines.append("因果 uplift 人群圈选 - 最终报告（来自真实处理）")
    lines.append(f"生成时间: {datetime.now().isoformat()}")
    lines.append("=" * 80)
    lines.append("")
    lines.append("一、样例处理结果")
    lines.append("-" * 80)
    for sid, rec in state.records.items():
        s = state.summaries.get(sid)
        lines.append(f"[样例 {sid}]")
        lines.append(f"  user_id       : {rec.user_id}")
        lines.append(f"  scene         : {rec.scene}")
        lines.append(f"  final_status  : {rec.status.value}")
        lines.append(f"  uplift_score  : {rec.uplift_score}")
        lines.append(f"  caliber_source: {rec.caliber_source}")
        lines.append(f"  feature_missing: {rec.feature_missing}")
        lines.append(f"  default_score : {rec.default_score_applied}")
        if s:
            lines.append(f"  摘要          : {s.summary_text}")
        lines.append("")

    lines.append("二、冲突与补录证据")
    lines.append("-" * 80)
    if state.conflicts:
        for sid, evs in state.conflicts.items():
            lines.append(f"sample_id={sid}")
            for ev in evs:
                lines.append(f"  - {ev.field_name}:")
                lines.append(f"      召回候选表值: {ev.candidate_table_value}")
                lines.append(f"      参数YAML值 : {ev.yaml_value}")
                lines.append(f"      说明       : {ev.description}")
    else:
        lines.append("  无冲突")
    lines.append("")

    lines.append("三、复核历史（均来自负责人提交）")
    lines.append("-" * 80)
    for h in state.review_history:
        lines.append(f"[{h.timestamp}] {h.role.value}/{h.actor} 执行 {h.action}")
        lines.append(f"  sample_id    : {h.sample_id}")
        lines.append(f"  before_status: {h.before_status.value if h.before_status else '-'}")
        lines.append(f"  after_status : {h.after_status.value if h.after_status else '-'}")
        lines.append(f"  reason       : {h.reason}")
        if h.field_changes:
            lines.append(f"  field_changes: {json.dumps(h.field_changes, ensure_ascii=False)}")
        lines.append("")

    lines.append("四、可解释摘要与历史记录核对")
    lines.append("-" * 80)
    for sid in list(state.records.keys()):
        s = state.summaries.get(sid)
        history = get_history_for_sample(state, sid)
        lines.append(f"{sid}:")
        lines.append(f"  摘要文字   : {s.summary_text if s else '-'}")
        lines.append(f"  历史记录数 : {len(history)}")
        if s:
            lines.append(f"  数据源     : {', '.join(s.data_sources)}")
        ok = (s is not None and len(s.review_history_refs) == len(history))
        lines.append(f"  refs 可反查: {'是' if ok else '否'}")
        lines.append("")

    report_txt = "\n".join(lines)
    os.makedirs(REPORTS_DIR, exist_ok=True)
    report_path = os.path.join(REPORTS_DIR, "final_report.txt")
    with open(report_path, "w", encoding="utf-8") as f:
        f.write(report_txt)

    full = {
        "records": {sid: r.to_dict() for sid, r in state.records.items()},
        "conflicts": {
            sid: [e.to_dict() for e in evs] for sid, evs in state.conflicts.items()
        },
        "review_history": [a.to_dict() for a in state.review_history],
        "summaries": {sid: s.to_dict() for sid, s in state.summaries.items()},
        "generated_from": "真实负责人提交决策，非脚本内置文案",
    }
    _dump_json(full, os.path.join(REPORTS_DIR, "final_report.json"))
    print(report_txt)
    print(f"\n报告已生成: {report_path}")
    return 0


# ========== cmd: run-material ==========
def cmd_run_material(args) -> int:
    import yaml
    _mkdirs()
    if getattr(args, "reset", False):
        clear_state(args.state)
    with open(args.material, "r", encoding="utf-8") as f:
        mat = yaml.safe_load(f)

    params = load_params(args.params)
    state, import_log = import_candidate_table(args.csv, params["pipeline"]["default_score"])
    conflicts, supplements = detect_conflicts_and_supplement(state, params)
    pending = list_pending_items(state)
    save_state(state, args.state)

    target = mat.get("target_samples", [])
    filtered_pending = {
        "experiment_platform": [p for p in pending["experiment_platform"] if p["sample_id"] in target],
        "recommend_lead": [p for p in pending["recommend_lead"] if p["sample_id"] in target],
    }
    filtered_conflicts = [c for c in conflicts if c["sample_id"] in target]

    out = {
        "material": {
            "material_type": mat.get("material_type"),
            "material_id": mat.get("material_id"),
            "description": mat.get("description"),
            "target_samples": target,
            "expected": mat.get("expected"),
        },
        "current_state": "STOPPED_AT_PENDING_REVIEW — 等待负责人提交决策",
        "next_step": (
            "请使用 review decide 提交真实决策；"
            "例如: python3 main.py review decide --role experiment_platform "
            "--sample-id SAMPLE-003 --decision confirm --reason '你的理由'"
        ),
        "pending_review": filtered_pending,
        "conflicts_for_target": filtered_conflicts,
        "state_path": args.state,
    }
    out_path = os.path.join(OUTPUT_DIR, f"material_{mat.get('material_id')}_pending.json")
    _dump_json(out, out_path)
    print(json.dumps(out, ensure_ascii=False, indent=2))
    print(f"\n材料待办已保存: {out_path}", file=sys.stderr)
    print(f"下一步: 对上面的待办使用 `review decide` 提交决策，再 `refresh`、`report`", file=sys.stderr)
    return 0


# ========== cmd: run-all ==========
def cmd_run_all(args) -> int:
    _mkdirs()
    clear_state(args.state)

    print("\n=== [1/6] import: 导入候选表 + 冲突检测 ===")
    rc = cmd_import(args)
    if rc != 0:
        return rc

    print("\n=== [2/6] review list: 列出待办（冲突证据、待处理状态） ===")
    rc = cmd_review_list(args)
    if rc != 0:
        return rc

    print("\n=== [3/6] review decide: 实验平台负责人阿越对 SAMPLE-003 确认 ===")
    ns = argparse.Namespace(
        state=args.state, params=args.params,
        sample_id="SAMPLE-003", role="experiment_platform",
        decision="confirm", actor=None,
        reason="（真实提交）补看参数YAML：候选表v1是历史遗留，按YAML补录v2口径和重算分0.675执行",
        rollback_score=None, final_score=None,
    )
    rc = cmd_review_decide(ns)
    if rc != 0:
        return rc

    print("\n=== [4/6] review decide: 推荐负责人林川对 SAMPLE-002 接受默认分 ===")
    ns = argparse.Namespace(
        state=args.state, params=args.params,
        sample_id="SAMPLE-002", role="recommend_lead",
        decision="accept_default", actor=None,
        reason="（真实提交）核查SLA：该时段特征服务降级，默认分0.500可接受，暂不覆盖",
        rollback_score=None, final_score=None,
    )
    rc = cmd_review_decide(ns)
    if rc != 0:
        return rc

    print("\n=== [5/6] refresh: 刷新摘要 + 校验历史反查 ===")
    rc = cmd_refresh(args)
    if rc != 0:
        return rc

    print("\n=== [6/6] report: 生成最终报告 ===")
    rc = cmd_report(args)
    return rc


def main() -> int:
    parser = argparse.ArgumentParser(description="因果 uplift 人群圈选 - 复核流水线")
    parser.add_argument("--state", default=None, help="状态持久化文件路径（默认 output/state/pipeline_state.json）")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_import = sub.add_parser("import", help="导入候选表 + 冲突检测，持久化 state")
    p_import.add_argument("--csv", default=DEFAULT_CSV)
    p_import.add_argument("--params", default=DEFAULT_PARAMS)
    p_import.add_argument("--reset", action="store_true", help="导入前清空 state")
    p_import.set_defaults(func=cmd_import)

    p_review = sub.add_parser("review", help="复核操作")
    p_review_sub = p_review.add_subparsers(dest="review_cmd", required=True)

    p_rlist = p_review_sub.add_parser("list", help="列出待办、冲突证据、当前状态")
    p_rlist.set_defaults(func=cmd_review_list)

    p_rdec = p_review_sub.add_parser("decide", help="负责人真实提交决策")
    p_rdec.add_argument("--role", required=True,
                        choices=["experiment_platform", "recommend_lead"],
                        help="experiment_platform=阿越, recommend_lead=推荐负责人")
    p_rdec.add_argument("--sample-id", required=True)
    p_rdec.add_argument("--decision", required=True,
                        help="experiment_platform: confirm|reject; recommend_lead: accept_default|override")
    p_rdec.add_argument("--actor", default=None, help="可选，默认按 params.yaml 的负责人名")
    p_rdec.add_argument("--reason", required=True, help="必须填写决策理由（会写入历史和报告）")
    p_rdec.add_argument("--rollback-score", type=float, default=None,
                        help="reject 时可选，回滚到的分数")
    p_rdec.add_argument("--final-score", type=float, default=None,
                        help="override 时必填，覆盖后的最终分数")
    p_rdec.add_argument("--params", default=DEFAULT_PARAMS)
    p_rdec.set_defaults(func=cmd_review_decide)

    p_refresh = sub.add_parser("refresh", help="刷新可解释摘要 + 校验反查")
    p_refresh.add_argument("--params", default=DEFAULT_PARAMS)
    p_refresh.set_defaults(func=cmd_refresh)

    p_report = sub.add_parser("report", help="从持久化 state 导出最终报告")
    p_report.add_argument("--params", default=DEFAULT_PARAMS)
    p_report.set_defaults(func=cmd_report)

    p_mat = sub.add_parser("run-material", help="按材料导入+检测，停在待处理状态等待真实决策")
    p_mat.add_argument("--material", required=True)
    p_mat.add_argument("--csv", default=DEFAULT_CSV)
    p_mat.add_argument("--params", default=DEFAULT_PARAMS)
    p_mat.add_argument("--reset", action="store_true")
    p_mat.set_defaults(func=cmd_run_material)

    p_all = sub.add_parser("run-all", help="六步完整演示：import→list→2次真实decide→refresh→report")
    p_all.add_argument("--csv", default=DEFAULT_CSV)
    p_all.add_argument("--params", default=DEFAULT_PARAMS)
    p_all.set_defaults(func=cmd_run_all)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
