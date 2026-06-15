#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import argparse
import json
import os
import sys
from datetime import datetime
from typing import Dict, Any

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


def step1_import(state_holder: Dict[str, Any], args) -> Dict[str, Any]:
    params = load_params(args.params)
    state, import_log = import_candidate_table(args.csv, params["pipeline"]["default_score"])
    state_holder["state"] = state
    state_holder["params"] = params
    out = {
        "step": "STEP 1 - 召回候选表第一次导入",
        "timestamp": datetime.now().isoformat(),
        "imported_count": len(import_log),
        "records": import_log,
    }
    _dump_json(out, os.path.join(OUTPUT_DIR, "step1_import.json"))
    return out


def step2_detect(state_holder: Dict[str, Any]) -> Dict[str, Any]:
    state = state_holder["state"]
    params = state_holder["params"]
    conflicts, supplements = detect_conflicts_and_supplement(state, params)
    pending = list_pending_items(state)
    out = {
        "step": "STEP 2 - 参数YAML冲突检测 + YAML补录",
        "timestamp": datetime.now().isoformat(),
        "conflict_report": conflicts,
        "supplement_report": supplements,
        "pending_items": pending,
    }
    _dump_json(out, os.path.join(OUTPUT_DIR, "step2_detect.json"))
    return out


def step3_review_experiment(state_holder: Dict[str, Any]) -> Dict[str, Any]:
    state = state_holder["state"]
    params = state_holder["params"]
    actor = params["review_settings"]["roles"]["experiment_platform_owner"]
    actions = []

    ok, res = experiment_owner_confirm(
        state,
        sample_id="SAMPLE-003",
        actor=actor,
        reason=(
            "补看参数YAML后确认：候选表SAMPLE-003的v1为历史遗留值，"
            "以YAML补录的v2口径和重算分0.675为准"
        ),
    )
    if ok:
        actions.append(res)

    out = {
        "step": "STEP 3 - 实验平台负责人阿越补看参数YAML并确认/驳回",
        "timestamp": datetime.now().isoformat(),
        "review_actions": actions,
    }
    _dump_json(out, os.path.join(OUTPUT_DIR, "step3_experiment_review.json"))
    return out


def step4_review_recommend(state_holder: Dict[str, Any]) -> Dict[str, Any]:
    state = state_holder["state"]
    params = state_holder["params"]
    actor = params["review_settings"]["roles"]["recommend_lead"]
    actions = []

    ok, res = recommend_lead_review(
        state,
        sample_id="SAMPLE-002",
        actor=actor,
        decision="ACCEPT_DEFAULT",
        reason=(
            "核查线上特征SLA，该时段确实出现特征服务降级，默认分0.500可接受，"
            "无需覆盖"
        ),
    )
    if ok:
        actions.append(res)

    out = {
        "step": "STEP 4 - 推荐负责人对特征缺失默认分进行复核",
        "timestamp": datetime.now().isoformat(),
        "review_actions": actions,
    }
    _dump_json(out, os.path.join(OUTPUT_DIR, "step4_recommend_review.json"))
    return out


def step5_refresh_summary(state_holder: Dict[str, Any]) -> Dict[str, Any]:
    state = state_holder["state"]
    params = state_holder["params"]
    summaries = refresh_summaries(state, params)

    for sid in ["SAMPLE-001", "SAMPLE-002", "SAMPLE-003"]:
        summary = lookup_summary_by_sample(state, sid)
        history = get_history_for_sample(state, sid)
        assert summary is not None, f"summary for {sid} should not be None"
        assert summary["sample_id"] == sid, "summary sample_id mismatch"
        if history:
            for ts in summary["review_history_refs"]:
                assert any(h["timestamp"] == ts for h in history), (
                    f"{sid} 的 review_history_refs 无法对应到历史记录"
                )

    out = {
        "step": "STEP 5 - 可解释摘要刷新",
        "timestamp": datetime.now().isoformat(),
        "summaries": summaries,
        "cross_check": {
            "description": "每条摘要的 sample_id 与 review_history_refs 均已核对，可反查到同一条样例",
            "verified_samples": ["SAMPLE-001", "SAMPLE-002", "SAMPLE-003"],
        },
    }
    _dump_json(out, os.path.join(OUTPUT_DIR, "step5_summary.json"))
    return out


def step6_final_report(state_holder: Dict[str, Any]) -> str:
    state = state_holder["state"]
    params = state_holder["params"]

    lines = []
    lines.append("=" * 80)
    lines.append("因果 uplift 人群圈选 - 最终报告")
    lines.append(f"生成时间: {datetime.now().isoformat()}")
    lines.append("=" * 80)
    lines.append("")
    lines.append("一、三条样例处理结果对比")
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

    lines.append("二、冲突与补录证据（供阿越确认/驳回）")
    lines.append("-" * 80)
    for sid, evs in state.conflicts.items():
        lines.append(f"sample_id={sid}")
        for ev in evs:
            lines.append(f"  - {ev.field_name}:")
            lines.append(f"      召回候选表值: {ev.candidate_table_value}")
            lines.append(f"      参数YAML值 : {ev.yaml_value}")
            lines.append(f"      说明       : {ev.description}")
    if not state.conflicts:
        lines.append("  无冲突")
    lines.append("")

    lines.append("三、复核历史（谁改了什么、为什么、影响哪些结果）")
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
    for sid in ["SAMPLE-001", "SAMPLE-002", "SAMPLE-003"]:
        s = state.summaries.get(sid)
        history = get_history_for_sample(state, sid)
        lines.append(f"{sid}:")
        lines.append(f"  摘要文字   : {s.summary_text if s else '-'}")
        lines.append(f"  历史记录数 : {len(history)}")
        if s:
            lines.append(f"  数据源     : {', '.join(s.data_sources)}")
        lines.append(f"  refs 可反查: {'是' if s and len(s.review_history_refs) == len(history) else '否(无历史即为正常)'}")
        lines.append("")

    report_txt = "\n".join(lines)
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
        "params_snapshot": params,
    }
    _dump_json(full, os.path.join(REPORTS_DIR, "final_report.json"))
    return report_path


def cmd_run_all(args) -> int:
    _mkdirs()
    holder: Dict[str, Any] = {}
    print("\n>>> STEP 1 召回候选表第一次导入 ...")
    r1 = step1_import(holder, args)
    print(json.dumps(r1, ensure_ascii=False, indent=2))

    print("\n>>> STEP 2 参数YAML冲突检测 + YAML补录 ...")
    r2 = step2_detect(holder)
    print(json.dumps(r2, ensure_ascii=False, indent=2))

    print("\n>>> STEP 3 实验平台负责人阿越补看参数YAML并确认/驳回 ...")
    r3 = step3_review_experiment(holder)
    print(json.dumps(r3, ensure_ascii=False, indent=2))

    print("\n>>> STEP 4 推荐负责人对特征缺失默认分进行复核 ...")
    r4 = step4_review_recommend(holder)
    print(json.dumps(r4, ensure_ascii=False, indent=2))

    print("\n>>> STEP 5 可解释摘要刷新 + 反查核对 ...")
    r5 = step5_refresh_summary(holder)
    print(json.dumps(r5, ensure_ascii=False, indent=2))

    print("\n>>> STEP 6 生成最终报告 ...")
    path = step6_final_report(holder)
    print(f"\n最终报告已生成: {path}")
    print(f"所有中间产物位于: {OUTPUT_DIR}")
    with open(path, "r", encoding="utf-8") as f:
        print("\n" + f.read())
    return 0


def cmd_run_material(args) -> int:
    import yaml

    _mkdirs()
    with open(args.material, "r", encoding="utf-8") as f:
        mat = yaml.safe_load(f)
    print(f"运行材料: {mat.get('material_type')} - {mat.get('material_id')}")
    print(f"说明: {mat.get('description')}")
    print(f"目标样例: {mat.get('target_samples')}")

    holder: Dict[str, Any] = {}
    step1_import(holder, args)
    step2_detect(holder)

    state = holder["state"]
    params = holder["params"]
    actor_exp = params["review_settings"]["roles"]["experiment_platform_owner"]
    actor_rec = params["review_settings"]["roles"]["recommend_lead"]

    for sid in mat.get("target_samples", []):
        rec = state.records.get(sid)
        if rec is None:
            continue
        if rec.status.value in ("YAML_SUPPLEMENT_OLD_CALIBER", "CONFLICT_DETECTED"):
            experiment_owner_confirm(
                state, sid, actor_exp,
                reason=f"[材料{mat.get('material_id')}] 阿越按材料规则确认",
            )
        elif rec.status.value == "PENDING_REVIEW":
            recommend_lead_review(
                state, sid, actor_rec, "ACCEPT_DEFAULT",
                reason=f"[材料{mat.get('material_id')}] 推荐负责人按材料规则接受默认分",
            )

    refresh_summaries(state, params)
    out_path = os.path.join(OUTPUT_DIR, f"material_{mat.get('material_id')}_result.json")
    _dump_json(
        {
            "material": mat,
            "records": {
                sid: {
                    "status": r.status.value,
                    "uplift_score": r.uplift_score,
                    "summary": state.summaries[sid].summary_text if sid in state.summaries else None,
                    "history": [h.to_dict() for h in state.review_history if h.sample_id == sid],
                }
                for sid, r in state.records.items()
                if sid in mat.get("target_samples", [])
            },
        },
        out_path,
    )
    print(f"\n材料运行结果已写入: {out_path}")
    with open(out_path, "r", encoding="utf-8") as f:
        print(f.read())
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description="因果 uplift 人群圈选 - 复核流水线")
    sub = parser.add_subparsers(dest="cmd", required=True)

    p_all = sub.add_parser("run-all", help="跑完完整六步流程并生成报告")
    p_all.add_argument("--csv", default=DEFAULT_CSV, help="召回候选表CSV路径")
    p_all.add_argument("--params", default=DEFAULT_PARAMS, help="参数YAML路径")
    p_all.set_defaults(func=cmd_run_all)

    p_mat = sub.add_parser("run-material", help="按单份材料（正常/错口径/补录）运行")
    p_mat.add_argument("--material", required=True, help="材料YAML路径")
    p_mat.add_argument("--csv", default=DEFAULT_CSV)
    p_mat.add_argument("--params", default=DEFAULT_PARAMS)
    p_mat.set_defaults(func=cmd_run_material)

    args = parser.parse_args()
    return args.func(args)


if __name__ == "__main__":
    sys.exit(main())
