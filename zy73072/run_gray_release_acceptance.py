#!/usr/bin/env python3
"""灰度发布验收流程：导入旧材料 → 补边界样本 → 查看页面摘要变化

按灰度发布前的真实节奏分步执行，输出每一步的状态，供项目助理小林
直接交给值班脚本调用（脚本检查返回码和 stdout JSON）。
"""
import json
import os
import sys
import tempfile
from datetime import datetime
from typing import Dict, Any, Tuple

from pdg_wsp_scheduler.scheduler import TemperatureRiseScheduler
from pdg_wsp_scheduler.normalizer import normalize_device_id, DEVICE_ID_VARIANTS
from pdg_wsp_scheduler.cli import (
    EXIT_OK,
    EXIT_BAD_DATA_PRESENT,
    EXIT_PHOTO_MISMATCH,
)


SIMULATED_TODAY = datetime(2026, 6, 10, 8, 0, 0)
SIMULATED_TONIGHT = datetime(2026, 6, 10, 23, 59, 59)


def _load_json(path: str) -> Dict[str, Any]:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def step1_device_id_normalization_demo() -> Dict[str, Any]:
    """小林不希望临时解释为什么同一设备编号写法不统一——这里
    输出「各种写法 → 统一规范」对照表，证明一版里已处理好。"""
    demo: Dict[str, Any] = {
        "canonical_standard": "PDG-<区域2位>[子柜号]-<序号3位>",
        "variants_demo": [],
    }
    samples = [
        "1A-001",
        "配电柜1号A柜001",
        "pdg_01a_001",
        "PDG 01A 001",
        "配电柜5C柜099",
        "3-012",
        "老配电室东北角那个",
    ]
    for raw in samples:
        norm = normalize_device_id(raw)
        demo["variants_demo"].append(
            {
                "raw_input": raw,
                "normalized": norm.canonical if norm else "（无法归一，将归入坏数据线索）",
                "in_predefined_dict": raw in sum(DEVICE_ID_VARIANTS.values(), [])
                if norm
                else False,
            }
        )
    return demo


def step2_import_old_materials(
    scheduler: TemperatureRiseScheduler,
    old_records_path: str,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """第一步：导入历史班组交接记录（旧材料）"""
    data = _load_json(old_records_path)
    records = data["records"]
    report = scheduler.import_handover_records(
        records,
        run_label="phase1-old",
        today=SIMULATED_TODAY,
    )
    summary = scheduler.build_page_summary(tonight=SIMULATED_TONIGHT)
    return report.to_dict(), summary.to_dict()


def step3_write_manual_remark(scheduler: TemperatureRiseScheduler) -> Dict[str, Any]:
    """人工备注写入测试（后续重复导入时要验证不被覆盖）"""
    results = scheduler.all_results()
    if not results:
        return {"skipped": True, "reason": "无排程结果可写备注"}
    target = results[0]
    ok, msg = scheduler.update_manual_remark(
        target.dedup_key,
        "已与物资科确认，主母线连接排2根预计明天上午到库，签收后直接送现场。",
        operator="项目助理-小林",
    )
    return {
        "dedup_key": target.dedup_key,
        "target_result_id": target.result_id,
        "success": ok,
        "message": msg,
        "remark_protected": target.is_manual_remark_protected,
        "remark_content": target.manual_remark,
    }


def step4_import_boundary_and_followup(
    scheduler: TemperatureRiseScheduler,
    phase2_path: str,
) -> Tuple[Dict[str, Any], Dict[str, Any]]:
    """第二步：补边界样本 + 后补说明 + 重复记录（验证去重 & 人工备注保护）"""
    data = _load_json(phase2_path)
    records = data["records"]
    report = scheduler.import_handover_records(
        records,
        run_label="phase2-boundary",
        today=SIMULATED_TODAY,
    )
    summary = scheduler.build_page_summary(tonight=SIMULATED_TONIGHT)
    return report.to_dict(), summary.to_dict()


def step5_verify_remark_not_overwritten(scheduler: TemperatureRiseScheduler) -> Dict[str, Any]:
    """验证人工备注未被第二次导入覆盖"""
    results = scheduler.all_results()
    verification: Dict[str, Any] = {
        "total_results": len(results),
        "with_protected_remark": 0,
        "with_overwrite_rejected_counter": 0,
        "details": [],
    }
    for r in results:
        if r.manual_remark:
            verification["with_protected_remark"] += 1
            verification["details"].append(
                {
                    "result_id": r.result_id,
                    "device_id": r.device_id.canonical,
                    "remark_present": bool(r.manual_remark),
                    "is_protected": r.is_manual_remark_protected,
                    "remark_excerpt": r.manual_remark[:60] + "...",
                }
            )
    last_report = scheduler._last_import_report
    if last_report:
        verification["with_overwrite_rejected_counter"] = (
            last_report.overwritten_remark_rejected
        )
        verification["preserved_manual_remarks"] = (
            last_report.preserved_manual_remarks
        )
    return verification


def step6_bad_data_trace_navigability(scheduler: TemperatureRiseScheduler) -> Dict[str, Any]:
    """验证坏数据线索可指回班组交接记录的原始条目"""
    bads = scheduler.all_bad_data()
    out = {
        "count": len(bads),
        "traces": [],
    }
    for b in bads:
        out["traces"].append(
            {
                "trace_id": b.trace_id,
                "error_type": b.error_type,
                "handover_record_id": b.handover_record_id,
                "raw_device_id": b.source_device_id_raw,
                "on_site_trace_hint": b.on_site_trace_hint,
                "navigate_hint": (
                    f"班组交接记录中查询 record_id={b.handover_record_id}"
                    f" 或 on_site_trace 包含「{b.on_site_trace_hint[:20]}」"
                ),
            }
        )
    return out


def step7_photo_mismatch_warning(scheduler: TemperatureRiseScheduler) -> Dict[str, Any]:
    """输出照片时间错位的影响范围与收尾建议"""
    last_report = scheduler._last_import_report
    if not last_report or not last_report.photo_mismatch_impact:
        return {"detected": False}
    impact = last_report.photo_mismatch_impact
    return {
        "detected": True,
        "affected_result_ids": impact.affected_result_ids,
        "affected_device_ids": impact.affected_device_ids,
        "impact_scope": impact.impact_scope,
        "wrap_up_action": impact.wrap_up_action,
    }


def main() -> int:
    base = os.path.dirname(os.path.abspath(__file__))
    old_records = os.path.join(base, "testdata", "phase1_old_records.json")
    phase2 = os.path.join(base, "testdata", "phase2_boundary_and_followup.json")

    scheduler = TemperatureRiseScheduler()

    norm_demo = step1_device_id_normalization_demo()
    phase1_report, phase1_summary = step2_import_old_materials(scheduler, old_records)
    remark_result = step3_write_manual_remark(scheduler)
    phase2_report, phase2_summary = step4_import_boundary_and_followup(scheduler, phase2)
    remark_verification = step5_verify_remark_not_overwritten(scheduler)
    bad_nav = step6_bad_data_trace_navigability(scheduler)
    photo_warn = step7_photo_mismatch_warning(scheduler)

    final_summary = scheduler.build_page_summary(tonight=SIMULATED_TONIGHT)

    report_doc = {
        "gray_release_acceptance_report": {
            "generated_at": datetime.now().isoformat(),
            "simulated_today": SIMULATED_TODAY.isoformat(),
            "simulated_tonight": SIMULATED_TONIGHT.isoformat(),
        },
        "step1_device_id_normalization": norm_demo,
        "step2_phase1_import": {
            "import_report": phase1_report,
            "page_summary_after": phase1_summary,
        },
        "step3_manual_remark_written": remark_result,
        "step4_phase2_import": {
            "import_report": phase2_report,
            "page_summary_after": phase2_summary,
        },
        "step5_remark_protection_verified": remark_verification,
        "step6_bad_data_trace_navigability": bad_nav,
        "step7_photo_mismatch_warning": photo_warn,
        "final_page_summary": final_summary.to_dict(),
        "acceptance_checklist": {
            "设备编号写法统一（小林不用临时解释）": len(
                [v for v in norm_demo["variants_demo"] if v["normalized"] != "（无法归一，将归入坏数据线索）"]
            )
            >= 5,
            "重复导入未翻倍（phase2含一条重复旧记录）": phase2_report["records_duplicate_skipped"] >= 1,
            "人工备注未被覆盖": remark_verification["with_protected_remark"] >= 1,
            "坏数据线索可指回原始交接记录": bad_nav["count"] >= 1 and all(
                t["handover_record_id"] for t in bad_nav["traces"]
            ),
            "照片时间错位有提醒+收尾建议": photo_warn["detected"] is True,
            "页面摘要包含变化描述和边界样本标记": bool(
                final_summary.change_description
            ) and len(final_summary.boundary_samples_added) >= 1,
        },
    }

    print(json.dumps(report_doc, ensure_ascii=False, indent=2))

    all_pass = all(report_doc["acceptance_checklist"].values())
    return EXIT_OK if all_pass else 1


if __name__ == "__main__":
    sys.exit(main())
