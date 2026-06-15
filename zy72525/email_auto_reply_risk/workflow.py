"""三步流程管理

完整工作流：
========================================================================
步骤1：模型输出片段第一次导入
   - 输入：模型输出CSV/JSON文件
   - 输出：导入批次ID、初始风险记录、变更日志
   - 关键点：检测重复、检测模型版本变更、状态初始化为 NEEDS_RECHECK（如有版本变更）
   - 产出：每条片段的当前处理状态、原始行号、模型版本

步骤2：标注负责人周姐补看人工改判表
   - 输入：人工改判表（fragment_id, 改判结果, 备注）
   - 输出：改判记录、更新后的风险状态、变更日志
   - 关键点：保留改前改后、更新汇总表
   - 支持：只改备注不改风险标记

步骤3：产品复盘页更新
   - 输入：sample_id 或 批次ID
   - 输出：完整时间线、风险统计、可追溯的变更历史、结果说明
   - 关键点：按时间线展示所有变更、支持导出复盘报告
   - 产出：当前处理状态一览、可重跑命令、结果说明文字
========================================================================
"""

import json
import csv
from pathlib import Path
from typing import List, Dict, Optional
from sqlalchemy.orm import Session
from datetime import datetime

from .core import (
    import_model_outputs, apply_manual_review,
    get_sample_risk_timeline, get_fragment_history,
    get_fragment_current_state
)
from .models import RiskStatus, ModelOutputFragment, RiskSummary, ImportBatch


def load_records_from_csv(file_path: str) -> List[Dict]:
    """从CSV加载模型输出记录
    
    CSV列要求：
    sample_id, original_line_number, raw_content, is_auto_reply_risk, risk_score
    """
    records = []
    with open(file_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            records.append({
                "sample_id": row["sample_id"],
                "original_line_number": int(row["original_line_number"]),
                "raw_content": row["raw_content"],
                "is_auto_reply_risk": row["is_auto_reply_risk"].lower() in ("true", "1", "yes"),
                "risk_score": int(row["risk_score"]) if row.get("risk_score") else None
            })
    return records


def load_records_from_json(file_path: str) -> List[Dict]:
    """从JSON加载模型输出记录"""
    with open(file_path, 'r', encoding='utf-8') as f:
        return json.load(f)


def step1_import_model_outputs(session: Session, file_path: str,
                               model_version: str, imported_by: str,
                               batch_id: Optional[str] = None,
                               remark: Optional[str] = None) -> Dict:
    """步骤1：模型输出片段第一次导入
    
    返回可复盘的导入结果，包含：
    - 导入统计
    - 每条新片段的当前处理状态
    - 模型版本变更检测结果
    - 可重跑命令
    """
    file_ext = Path(file_path).suffix.lower()
    if file_ext == '.csv':
        records = load_records_from_csv(file_path)
    elif file_ext in ('.json', '.jsonl'):
        records = load_records_from_json(file_path)
    else:
        raise ValueError(f"不支持的文件格式: {file_ext}")
    
    result = import_model_outputs(
        session, records, model_version, imported_by,
        source_file=file_path, batch_id=batch_id, remark=remark
    )
    
    batch_id_actual = result["batch_id"]
    
    fragments = session.query(ModelOutputFragment).filter(
        ModelOutputFragment.import_batch_id == batch_id_actual
    ).order_by(ModelOutputFragment.id.asc()).all()
    
    fragment_states = []
    for f in fragments:
        fragment_states.append(get_fragment_current_state(session, f.id))
    
    has_version_change = any(
        s["processing_status"] == RiskStatus.NEEDS_RECHECK.value
        for s in fragment_states
    )
    
    status_breakdown = {}
    for s in fragment_states:
        st = s["processing_status"]
        status_breakdown[st] = status_breakdown.get(st, 0) + 1
    
    replay_cmd = (
        f"python -m email_auto_reply_risk.cli import "
        f"--file {file_path} --model-version {model_version} "
        f"--by {imported_by}" + (f" --batch-id {batch_id}" if batch_id else "")
    )
    
    result_summary = {
        "step": "step1_import_model_outputs",
        "step_name": "步骤1：模型输出片段第一次导入",
        "timestamp": datetime.utcnow().isoformat(),
        "file_path": file_path,
        "model_version": model_version,
        "imported_by": imported_by,
        "batch_id": batch_id_actual,
        "import_result": result,
        "fragments_count": len(fragment_states),
        "has_model_version_change": has_version_change,
        "current_status_breakdown": status_breakdown,
        "fragments_current_state": fragment_states,
        "replay_command": replay_cmd,
        "result_explanation": _step1_explanation(result, status_breakdown, has_version_change)
    }
    
    return result_summary


def _step1_explanation(import_result: Dict, status_breakdown: Dict,
                       has_version_change: bool) -> str:
    """步骤1结果说明"""
    lines = []
    lines.append("【步骤1结果说明】模型输出片段导入")
    lines.append(f"  导入结果: {import_result['status']}")
    lines.append(f"  总记录: {import_result['total_records']} 条")
    lines.append(f"  新增: {import_result['new_records']} 条")
    lines.append(f"  跳过重复: {import_result['duplicate_skipped']} 条")
    lines.append("")
    
    if import_result['status'] == 'duplicate_batch_skipped':
        lines.append("  ⚠️  本批次之前已导入过，全部跳过，风险数量不会翻倍。")
        lines.append("  （规则：同一 batch_id 重复导入直接跳过）")
        return "\n".join(lines)
    
    lines.append("  当前处理状态分布:")
    for status, count in status_breakdown.items():
        lines.append(f"    {status}: {count} 条")
    lines.append("")
    
    if has_version_change:
        lines.append("  ⚠️  重点提示：检测到模型版本变更！")
        lines.append("  （规则：模型版本换了但样本编号没变时，")
        lines.append("   不急着归正常，状态置为 NEEDS_RECHECK，留给运营复核人复核）")
        lines.append("")
        lines.append("  运营复核人接下来怎么做？")
        lines.append("  1. 查看 needs_recheck 状态的片段")
        lines.append("  2. 确认后调用 update_status 或人工改判更新状态")
        lines.append("  3. 所有操作都留痕，可回溯")
    
    return "\n".join(lines)


def step2_manual_review(session: Session, review_records: List[Dict],
                        reviewer: str, review_batch_id: Optional[str] = None) -> Dict:
    """步骤2：标注负责人周姐补看人工改判表
    
    支持两种改判记录：
    - 完整改判：{"fragment_id": 1, "reviewed_is_risk": false, "remark": "..."}
    - 只改备注：{"fragment_id": 1, "only_edit_remark": true, "remark": "..."}
    
    返回：
    - 每条改判的改前改后
    - 更新后的当前状态
    - 可重跑命令
    """
    results = []
    for record in review_records:
        only_remark = record.get("only_edit_remark", False)
        
        result = apply_manual_review(
            session,
            fragment_id=record["fragment_id"],
            reviewer=reviewer,
            reviewed_is_risk=record.get("reviewed_is_risk"),
            remark=record.get("remark"),
            only_edit_remark=only_remark,
            review_batch_id=review_batch_id
        )
        results.append(result)
    
    fragment_ids = [r["fragment_id"] for r in results]
    current_states = []
    for fid in fragment_ids:
        current_states.append(get_fragment_current_state(session, fid))
    
    replay_cmd = (
        f"python -m email_auto_reply_risk.cli review "
        f"--reviewer {reviewer}" +
        (f" --batch-id {review_batch_id}" if review_batch_id else "")
    )
    
    manual_count = sum(1 for r in results if r["change_type"] == "manual_edit")
    remark_count = sum(1 for r in results if r["change_type"] == "remark_edit")
    
    return {
        "step": "step2_manual_review",
        "step_name": "步骤2：标注负责人人工改判",
        "timestamp": datetime.utcnow().isoformat(),
        "reviewer": reviewer,
        "review_batch_id": review_batch_id,
        "total_reviewed": len(results),
        "manual_edit_count": manual_count,
        "remark_edit_count": remark_count,
        "results": results,
        "fragments_current_state_after": current_states,
        "replay_command": replay_cmd,
        "result_explanation": _step2_explanation(results, manual_count, remark_count)
    }


def _step2_explanation(results: List[Dict], manual_count: int,
                       remark_count: int) -> str:
    """步骤2结果说明"""
    lines = []
    lines.append("【步骤2结果说明】人工改判")
    lines.append(f"  改判人: {results[0]['reviewer'] if results else '未知'}")
    lines.append(f"  总改判数: {len(results)} 条")
    lines.append(f"  其中完整改判: {manual_count} 条")
    lines.append(f"  其中仅改备注: {remark_count} 条")
    lines.append("")
    
    lines.append("  改判明细（改前 → 改后）:")
    for r in results:
        lines.append(f"    片段{r['fragment_id']} [{r['change_type']}]:")
        lines.append(f"      风险: {r['original_is_risk']} → {r['reviewed_is_risk']}")
        lines.append(f"      状态: {r['original_status']} → {r['reviewed_status']}")
        if r['reviewed_remark']:
            lines.append(f"      备注: {r['reviewed_remark']}")
    lines.append("")
    
    lines.append("  说明：")
    lines.append("  - 原始模型判断（original_is_auto_reply_risk）永不改变")
    lines.append("  - 改判记录全部留痕，运营追问时可回溯")
    lines.append("  - 汇总数自动更新，不会因为改判导致数量错误")
    
    return "\n".join(lines)


def step3_product_review(session: Session, sample_id: Optional[str] = None,
                         batch_id: Optional[str] = None,
                         export_path: Optional[str] = None) -> Dict:
    """步骤3：产品复盘页更新
    
    生成完整的风险时间线，支持导出为JSON用于产品复盘页
    
    核心产出（不是功能清单，是可复盘的记录）：
    1. 当前处理状态一览（每个片段的状态）
    2. 完整变更历史（按时间线）
    3. 结果说明文字（解释为什么前后不一致）
    4. 可重跑命令列表（完全复现本次结果）
    """
    result = {
        "step": "step3_product_review",
        "step_name": "步骤3：产品复盘",
        "timestamp": datetime.utcnow().isoformat(),
        "generated_by": "system"
    }
    
    if sample_id:
        timeline = get_sample_risk_timeline(session, sample_id)
        result["sample_id"] = sample_id
        result["timeline"] = timeline
        result["current_status_breakdown"] = timeline["current_status_breakdown"]
        result["fragments_count"] = timeline["fragments_count"]
        result["model_versions"] = timeline["model_versions"]
        result["change_history_count"] = len(timeline["change_history"])
        result["result_explanation"] = timeline["result_explanation"]
        result["replay_commands"] = timeline["replay_commands"]
        result["fragments_current_state"] = timeline["fragments_current_state"]
    
    if batch_id:
        fragments = session.query(ModelOutputFragment).filter(
            ModelOutputFragment.import_batch_id == batch_id
        ).all()
        
        sample_ids = list(set(f.sample_id for f in fragments))
        all_timelines = {}
        for sid in sample_ids:
            all_timelines[sid] = get_sample_risk_timeline(session, sid)
        
        summaries = session.query(RiskSummary).filter(
            RiskSummary.model_version == fragments[0].model_version
        ).all() if fragments else []
        
        fragment_states = []
        for f in fragments:
            fragment_states.append(get_fragment_current_state(session, f.id))
        
        all_replay = generate_replay_commands(session, batch_id)
        
        result["batch_id"] = batch_id
        result["model_version"] = fragments[0].model_version if fragments else None
        result["sample_count"] = len(sample_ids)
        result["fragment_count"] = len(fragments)
        result["sample_timelines"] = all_timelines
        result["fragments_current_state"] = fragment_states
        result["summaries"] = [
            {
                "sample_id": s.sample_id,
                "model_version": s.model_version,
                "total": s.total_fragments,
                "risk_count": s.risk_count,
                "normal_count": s.normal_count,
                "pending_count": s.pending_count,
                "needs_recheck_count": s.needs_recheck_count,
                "last_updated": s.last_updated.isoformat()
            }
            for s in summaries
        ]
        result["replay_commands"] = all_replay
        result["result_explanation"] = _step3_explanation_batch(batch_id, fragments, all_timelines)
    
    if export_path:
        Path(export_path).parent.mkdir(parents=True, exist_ok=True)
        with open(export_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        result["export_path"] = export_path
    
    return result


def _step3_explanation_batch(batch_id: str, fragments: List,
                             timelines: Dict[str, Dict]) -> str:
    """步骤3批次维度的结果说明"""
    lines = []
    lines.append(f"【步骤3结果说明】产品复盘 - 批次 {batch_id}")
    lines.append(f"  批次包含片段: {len(fragments)} 条")
    lines.append(f"  涉及样本: {len(timelines)} 个")
    lines.append("")
    
    lines.append("  各样本当前状态:")
    for sample_id, tl in timelines.items():
        lines.append(f"    样本 {sample_id}:")
        for status, count in tl["current_status_breakdown"].items():
            lines.append(f"      {status}: {count} 条")
    lines.append("")
    
    lines.append("  运营复核人追问时怎么办？")
    lines.append("  1. 找到对应样本和片段")
    lines.append("  2. 执行: python -m email_auto_reply_risk.cli fragment-history --fragment-id <id>")
    lines.append("  3. 查看完整变更历史（含原始行号、改前改后、操作人、时间）")
    lines.append("")
    
    lines.append("  复现本次结果:")
    lines.append("  执行 replay_commands 中的命令可完全复现")
    
    return "\n".join(lines)


def generate_replay_commands(session: Session, batch_id: str) -> List[Dict]:
    """生成可重新跑的命令列表 - 用于复盘时复现
    
    返回结构化的命令列表，每步带说明
    """
    batch = session.query(ImportBatch).filter(
        ImportBatch.batch_id == batch_id
    ).first()
    
    if not batch:
        return []
    
    commands = []
    
    commands.append({
        "step": "step0_init",
        "description": "初始化数据库",
        "command": "python -m email_auto_reply_risk.cli init-db"
    })
    
    if batch.source_file:
        commands.append({
            "step": "step1_import",
            "description": f"步骤1：导入模型输出（批次 {batch_id}）",
            "command": (
                f"python -m email_auto_reply_risk.cli import "
                f"--file {batch.source_file} "
                f"--model-version {batch.model_version} "
                f"--by {batch.imported_by} "
                f"--batch-id {batch_id}"
            )
        })
    
    fragments = session.query(ModelOutputFragment).filter(
        ModelOutputFragment.import_batch_id == batch_id
    ).all()
    
    from .models import ManualReview
    reviews = session.query(ManualReview).filter(
        ManualReview.fragment_id.in_([f.id for f in fragments])
    ).all()
    
    if reviews:
        reviewer = reviews[0].reviewer
        review_batch = reviews[0].review_batch_id or "manual_batch_001"
        commands.append({
            "step": "step2_review",
            "description": "步骤2：人工改判",
            "command": (
                f"python -m email_auto_reply_risk.cli review "
                f"--reviewer {reviewer} "
                f"--batch-id {review_batch}"
            )
        })
    
    commands.append({
        "step": "step3_check",
        "description": "查看当前处理状态",
        "command": (
            f"python -m email_auto_reply_risk.cli product-review "
            f"--batch-id {batch_id}"
        )
    })
    
    commands.append({
        "step": "step3_export",
        "description": "步骤3：导出产品复盘报告",
        "command": (
            f"python -m email_auto_reply_risk.cli product-review "
            f"--batch-id {batch_id} --export data/review_{batch_id}.json"
        )
    })
    
    return commands
