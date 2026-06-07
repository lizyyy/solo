"""三步流程管理

完整工作流：
========================================================================
步骤1：模型输出片段第一次导入
   - 输入：模型输出CSV/JSON文件
   - 输出：导入批次ID、初始风险记录、变更日志
   - 关键点：检测重复、检测模型版本变更、状态初始化为 NEEDS_RECHECK（如有版本变更）

步骤2：标注负责人周姐补看人工改判表
   - 输入：人工改判表（fragment_id, 改判结果, 备注）
   - 输出：改判记录、更新后的风险状态、变更日志
   - 关键点：保留改前改后、更新汇总表

步骤3：产品复盘页更新
   - 输入：sample_id 或 批次ID
   - 输出：完整时间线、风险统计、可追溯的变更历史
   - 关键点：按时间线展示所有变更、支持导出复盘报告
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
    get_sample_risk_timeline, get_fragment_history
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
    
    返回可复盘的导入结果
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
    
    return {
        "step": "step1_import_model_outputs",
        "timestamp": datetime.utcnow().isoformat(),
        "file_path": file_path,
        "model_version": model_version,
        "imported_by": imported_by,
        "result": result,
        "replay_command": (
            f"python -m email_auto_reply_risk.cli import "
            f"--file {file_path} --model-version {model_version} "
            f"--by {imported_by}" + (f" --batch-id {batch_id}" if batch_id else "")
        )
    }


def step2_manual_review(session: Session, review_records: List[Dict],
                        reviewer: str, review_batch_id: Optional[str] = None) -> Dict:
    """步骤2：标注负责人周姐补看人工改判表
    
    review_records 格式：
    [
        {
            "fragment_id": 1,
            "reviewed_is_risk": false,
            "remark": "人工确认不是自动回复，是客户真实回复"
        },
        ...
    ]
    """
    results = []
    for record in review_records:
        result = apply_manual_review(
            session,
            fragment_id=record["fragment_id"],
            reviewer=reviewer,
            reviewed_is_risk=record["reviewed_is_risk"],
            remark=record.get("remark"),
            review_batch_id=review_batch_id
        )
        results.append(result)
    
    return {
        "step": "step2_manual_review",
        "timestamp": datetime.utcnow().isoformat(),
        "reviewer": reviewer,
        "review_batch_id": review_batch_id,
        "total_reviewed": len(results),
        "results": results,
        "replay_command": (
            f"python -m email_auto_reply_risk.cli review "
            f"--reviewer {reviewer}" +
            (f" --batch-id {review_batch_id}" if review_batch_id else "")
        )
    }


def step3_product_review(session: Session, sample_id: Optional[str] = None,
                         batch_id: Optional[str] = None,
                         export_path: Optional[str] = None) -> Dict:
    """步骤3：产品复盘页更新
    
    生成完整的风险时间线，支持导出为JSON用于产品复盘页
    """
    result = {
        "step": "step3_product_review",
        "timestamp": datetime.utcnow().isoformat(),
        "generated_by": "system"
    }
    
    if sample_id:
        timeline = get_sample_risk_timeline(session, sample_id)
        result["sample_id"] = sample_id
        result["timeline"] = timeline
    
    if batch_id:
        fragments = session.query(ModelOutputFragment).filter(
            ModelOutputFragment.import_batch_id == batch_id
        ).all()
        
        sample_ids = list(set(f.sample_id for f in fragments))
        all_timelines = {}
        for sid in sample_ids:
            all_timelines[sid] = get_sample_risk_timeline(session, sid)
        
        summary = session.query(RiskSummary).filter(
            RiskSummary.model_version == fragments[0].model_version
        ).all() if fragments else []
        
        result["batch_id"] = batch_id
        result["model_version"] = fragments[0].model_version if fragments else None
        result["sample_count"] = len(sample_ids)
        result["fragment_count"] = len(fragments)
        result["sample_timelines"] = all_timelines
        result["summaries"] = [
            {
                "sample_id": s.sample_id,
                "model_version": s.model_version,
                "total": s.total_fragments,
                "risk_count": s.risk_count,
                "normal_count": s.normal_count,
                "last_updated": s.last_updated.isoformat()
            }
            for s in summary
        ]
    
    if export_path:
        with open(export_path, 'w', encoding='utf-8') as f:
            json.dump(result, f, ensure_ascii=False, indent=2)
        result["export_path"] = export_path
    
    return result


def generate_replay_commands(session: Session, batch_id: str) -> List[str]:
    """生成可重新跑的命令列表 - 用于复盘时复现"""
    batch = session.query(ImportBatch).filter(
        ImportBatch.batch_id == batch_id
    ).first()
    
    if not batch:
        return []
    
    commands = []
    
    commands.append(
        f"# 初始化数据库\n"
        f"python -m email_auto_reply_risk.cli init-db"
    )
    
    commands.append(
        f"# 步骤1：导入模型输出（批次 {batch_id}）\n"
        f"python -m email_auto_reply_risk.cli import "
        f"--file {batch.source_file} "
        f"--model-version {batch.model_version} "
        f"--by {batch.imported_by} "
        f"--batch-id {batch_id}"
    )
    
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
        commands.append(
            f"# 步骤2：人工改判\n"
            f"python -m email_auto_reply_risk.cli review "
            f"--reviewer {reviewer} "
            f"--batch-id {review_batch}"
        )
    
    commands.append(
        f"# 步骤3：产品复盘\n"
        f"python -m email_auto_reply_risk.cli product-review "
        f"--batch-id {batch_id} --export data/review_{batch_id}.json"
    )
    
    return commands
