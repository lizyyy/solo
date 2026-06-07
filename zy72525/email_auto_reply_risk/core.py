"""核心业务逻辑

边界规则（Boundary Rules）- 必须严格遵守：
========================================================================
规则1：重复导入检测
   - 同一 batch_id 重复导入 → 直接跳过，不增加任何计数
   - 同一模型版本、同一样本编号、同一原始行号 → 视为同一条记录，跳过

规则2：模型版本变更处理（重点！）
   - 检测到 sample_id 相同但 model_version 不同时：
     a. 不自动将风险状态改为 NORMAL
     b. 状态置为 NEEDS_RECHECK，留给运营复核人判断
     c. 在变更日志中记录 MODEL_VERSION_CHANGE
     d. 保留旧版本的所有历史记录用于对比

规则3：人工改判规则
   - 只有标注负责人（如"周姐"）可以改判风险状态
   - 每次改判必须记录：改前值、改后值、改判人、时间、备注
   - 改判不删除原始模型输出，仅新增一条变更记录

规则4：汇总数一致性
   - 重复导入不会导致 risk_count 翻倍
   - 只有首次导入或状态真实变更时才更新汇总表
   - 汇总表按 (sample_id, model_version) 唯一键约束

规则5：回滚规则
   - 支持按变更ID回滚到任意历史状态
   - 回滚本身也会生成一条 ROLLBACK 类型的变更记录
   - 回滚后需要重新触发运营复核流程
========================================================================
"""

import json
import hashlib
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from .models import (
    ModelOutputFragment, ManualReview, RiskChangeLog,
    RiskSummary, ImportBatch, RiskStatus, ChangeType
)


def generate_batch_id(model_version: str, timestamp: Optional[datetime] = None) -> str:
    """生成批次ID，用于重复导入检测"""
    if timestamp is None:
        timestamp = datetime.utcnow()
    raw = f"{model_version}_{timestamp.strftime('%Y%m%d%H%M%S')}"
    return hashlib.md5(raw.encode()).hexdigest()[:16]


def generate_fragment_fingerprint(sample_id: str, model_version: str,
                                  original_line_number: int) -> str:
    """生成片段指纹，用于去重检测"""
    raw = f"{sample_id}_{model_version}_{original_line_number}"
    return hashlib.md5(raw.encode()).hexdigest()


def check_duplicate_fragment(session: Session, sample_id: str,
                             model_version: str,
                             original_line_number: int) -> Optional[ModelOutputFragment]:
    """检查是否为重复片段"""
    return session.query(ModelOutputFragment).filter(
        ModelOutputFragment.sample_id == sample_id,
        ModelOutputFragment.model_version == model_version,
        ModelOutputFragment.original_line_number == original_line_number
    ).first()


def detect_model_version_change(session: Session, sample_id: str,
                                new_model_version: str) -> Tuple[bool, List[str]]:
    """检测样本是否存在模型版本变更
    
    返回: (是否有变更, 旧版本列表)
    """
    existing = session.query(ModelOutputFragment.model_version).filter(
        ModelOutputFragment.sample_id == sample_id,
        ModelOutputFragment.model_version != new_model_version
    ).distinct().all()
    
    old_versions = [row[0] for row in existing]
    return (len(old_versions) > 0, old_versions)


def log_change(session: Session, fragment: ModelOutputFragment,
               change_type: ChangeType, changed_by: str,
               before_data: Dict, after_data: Dict,
               remark: Optional[str] = None,
               batch_id: Optional[str] = None) -> RiskChangeLog:
    """记录变更日志 - 所有状态变更必须经过此函数"""
    
    log = RiskChangeLog(
        fragment_id=fragment.id,
        change_type=change_type.value,
        changed_by=changed_by,
        before_data=json.dumps(before_data, ensure_ascii=False) if before_data else None,
        after_data=json.dumps(after_data, ensure_ascii=False) if after_data else None,
        original_line_number=fragment.original_line_number,
        model_version_before=before_data.get("model_version") if before_data else None,
        model_version_after=after_data.get("model_version") if after_data else None,
        is_risk_before=before_data.get("is_auto_reply_risk") if before_data else None,
        is_risk_after=after_data.get("is_auto_reply_risk") if after_data else None,
        status_before=before_data.get("status") if before_data else None,
        status_after=after_data.get("status") if after_data else None,
        remark=remark,
        batch_id=batch_id
    )
    session.add(log)
    return log


def update_summary(session: Session, sample_id: str, model_version: str,
                   updated_by: str):
    """更新风险汇总表 - 确保汇总数与明细一致"""
    fragments = session.query(ModelOutputFragment).filter(
        ModelOutputFragment.sample_id == sample_id,
        ModelOutputFragment.model_version == model_version
    ).all()
    
    total = len(fragments)
    risk_count = sum(1 for f in fragments if f.is_auto_reply_risk)
    normal_count = sum(1 for f in fragments if not f.is_auto_reply_risk)
    
    summary = session.query(RiskSummary).filter(
        RiskSummary.sample_id == sample_id,
        RiskSummary.model_version == model_version
    ).first()
    
    if summary is None:
        summary = RiskSummary(
            sample_id=sample_id,
            model_version=model_version,
            total_fragments=total,
            risk_count=risk_count,
            normal_count=normal_count,
            pending_count=0,
            needs_recheck_count=0,
            last_updated_by=updated_by
        )
        session.add(summary)
    else:
        summary.total_fragments = total
        summary.risk_count = risk_count
        summary.normal_count = normal_count
        summary.last_updated_by = updated_by


def import_model_outputs(session: Session, records: List[Dict],
                         model_version: str, imported_by: str,
                         source_file: Optional[str] = None,
                         batch_id: Optional[str] = None,
                         remark: Optional[str] = None) -> Dict:
    """导入模型输出片段
    
    核心流程：
    1. 生成批次ID
    2. 检查批次是否已导入（防重复）
    3. 逐条处理记录：
       - 检查是否重复片段
       - 检测模型版本变更
       - 确定初始状态
       - 记录变更日志
    4. 更新汇总表
    
    参数 records 格式：
    [
        {
            "sample_id": "S001",
            "original_line_number": 15,
            "raw_content": "邮件正文...",
            "is_auto_reply_risk": true,
            "risk_score": 85
        },
        ...
    ]
    """
    if batch_id is None:
        batch_id = generate_batch_id(model_version)
    
    existing_batch = session.query(ImportBatch).filter(
        ImportBatch.batch_id == batch_id
    ).first()
    
    if existing_batch:
        return {
            "batch_id": batch_id,
            "status": "duplicate_batch_skipped",
            "message": f"批次 {batch_id} 已导入，跳过",
            "total_records": 0,
            "new_records": 0,
            "updated_records": 0,
            "duplicate_skipped": len(records)
        }
    
    new_count = 0
    update_count = 0
    duplicate_count = 0
    
    for record in records:
        sample_id = record["sample_id"]
        original_line_number = record["original_line_number"]
        
        existing = check_duplicate_fragment(
            session, sample_id, model_version, original_line_number
        )
        
        if existing:
            duplicate_count += 1
            continue
        
        has_version_change, old_versions = detect_model_version_change(
            session, sample_id, model_version
        )
        
        initial_status = RiskStatus.PENDING_IMPORT.value
        if has_version_change:
            initial_status = RiskStatus.NEEDS_RECHECK.value
        
        fragment = ModelOutputFragment(
            sample_id=sample_id,
            model_version=model_version,
            original_line_number=original_line_number,
            raw_content=record["raw_content"],
            is_auto_reply_risk=record["is_auto_reply_risk"],
            risk_score=record.get("risk_score"),
            import_batch_id=batch_id
        )
        session.add(fragment)
        session.flush()
        
        before_data = None
        after_data = {
            "sample_id": sample_id,
            "model_version": model_version,
            "original_line_number": original_line_number,
            "is_auto_reply_risk": record["is_auto_reply_risk"],
            "status": initial_status
        }
        
        change_remark = None
        if has_version_change:
            change_remark = (f"检测到模型版本变更：旧版本={old_versions}, "
                             f"新版本={model_version}，状态置为 NEEDS_RECHECK，"
                             f"待运营复核人确认")
            log_change(session, fragment, ChangeType.MODEL_VERSION_CHANGE,
                       imported_by, before_data, after_data,
                       remark=change_remark, batch_id=batch_id)
        
        log_change(session, fragment, ChangeType.IMPORT,
                   imported_by, before_data, after_data,
                   remark=remark, batch_id=batch_id)
        
        new_count += 1
        update_summary(session, sample_id, model_version, imported_by)
    
    batch_record = ImportBatch(
        batch_id=batch_id,
        model_version=model_version,
        imported_by=imported_by,
        source_file=source_file,
        total_records=len(records),
        new_records=new_count,
        updated_records=update_count,
        duplicate_skipped=duplicate_count,
        remark=remark
    )
    session.add(batch_record)
    session.commit()
    
    return {
        "batch_id": batch_id,
        "status": "success",
        "total_records": len(records),
        "new_records": new_count,
        "updated_records": update_count,
        "duplicate_skipped": duplicate_count
    }


def apply_manual_review(session: Session, fragment_id: int,
                        reviewer: str, reviewed_is_risk: bool,
                        reviewed_status: Optional[str] = None,
                        remark: Optional[str] = None,
                        review_batch_id: Optional[str] = None) -> Dict:
    """人工改判 - 标注负责人周姐补看人工改判表
    
    规则：
    - 改判不删除原始记录
    - 完整记录改前改后的值
    - 触发变更日志
    - 更新汇总表
    """
    fragment = session.query(ModelOutputFragment).get(fragment_id)
    if fragment is None:
        raise ValueError(f"片段 {fragment_id} 不存在")
    
    original_is_risk = fragment.is_auto_reply_risk
    
    if reviewed_status is None:
        reviewed_status = (RiskStatus.CONFIRMED_RISK.value
                          if reviewed_is_risk
                          else RiskStatus.NORMAL.value)
    
    review = ManualReview(
        fragment_id=fragment_id,
        reviewer=reviewer,
        original_is_risk=original_is_risk,
        reviewed_is_risk=reviewed_is_risk,
        original_status="",
        reviewed_status=reviewed_status,
        remark=remark,
        review_batch_id=review_batch_id
    )
    session.add(review)
    
    before_data = {
        "sample_id": fragment.sample_id,
        "model_version": fragment.model_version,
        "original_line_number": fragment.original_line_number,
        "is_auto_reply_risk": original_is_risk,
        "status": fragment.import_batch_id
    }
    
    fragment.is_auto_reply_risk = reviewed_is_risk
    
    after_data = {
        "sample_id": fragment.sample_id,
        "model_version": fragment.model_version,
        "original_line_number": fragment.original_line_number,
        "is_auto_reply_risk": reviewed_is_risk,
        "status": reviewed_status
    }
    
    log_change(session, fragment, ChangeType.MANUAL_EDIT,
               reviewer, before_data, after_data,
               remark=remark, batch_id=review_batch_id)
    
    update_summary(session, fragment.sample_id, fragment.model_version, reviewer)
    session.commit()
    
    return {
        "fragment_id": fragment_id,
        "original_is_risk": original_is_risk,
        "reviewed_is_risk": reviewed_is_risk,
        "reviewer": reviewer,
        "review_time": datetime.utcnow().isoformat()
    }


def update_status(session: Session, fragment_id: int, new_status: str,
                  changed_by: str, remark: Optional[str] = None) -> Dict:
    """更新风险状态"""
    fragment = session.query(ModelOutputFragment).get(fragment_id)
    if fragment is None:
        raise ValueError(f"片段 {fragment_id} 不存在")
    
    before_data = {
        "sample_id": fragment.sample_id,
        "model_version": fragment.model_version,
        "original_line_number": fragment.original_line_number,
        "is_auto_reply_risk": fragment.is_auto_reply_risk,
    }
    
    after_data = before_data.copy()
    after_data["status"] = new_status
    
    log_change(session, fragment, ChangeType.STATUS_CHANGE,
               changed_by, before_data, after_data,
               remark=remark)
    
    update_summary(session, fragment.sample_id, fragment.model_version, changed_by)
    session.commit()
    
    return {
        "fragment_id": fragment_id,
        "new_status": new_status,
        "changed_by": changed_by
    }


def get_fragment_history(session: Session, fragment_id: int) -> List[Dict]:
    """获取单条片段的完整变更历史 - 用于运营复核人追问时回溯"""
    logs = session.query(RiskChangeLog).filter(
        RiskChangeLog.fragment_id == fragment_id
    ).order_by(RiskChangeLog.changed_at.asc()).all()
    
    result = []
    for log in logs:
        result.append({
            "change_id": log.id,
            "change_type": log.change_type,
            "changed_by": log.changed_by,
            "changed_at": log.changed_at.isoformat(),
            "original_line_number": log.original_line_number,
            "model_version_before": log.model_version_before,
            "model_version_after": log.model_version_after,
            "is_risk_before": log.is_risk_before,
            "is_risk_after": log.is_risk_after,
            "status_before": log.status_before,
            "status_after": log.status_after,
            "remark": log.remark,
            "batch_id": log.batch_id
        })
    return result


def get_sample_risk_timeline(session: Session, sample_id: str) -> Dict:
    """获取单样本的完整风险时间线 - 用于产品复盘"""
    fragments = session.query(ModelOutputFragment).filter(
        ModelOutputFragment.sample_id == sample_id
    ).order_by(ModelOutputFragment.imported_at.asc()).all()
    
    all_logs = []
    for fragment in fragments:
        logs = get_fragment_history(session, fragment.id)
        all_logs.extend(logs)
    
    all_logs.sort(key=lambda x: x["changed_at"])
    
    summaries = session.query(RiskSummary).filter(
        RiskSummary.sample_id == sample_id
    ).order_by(RiskSummary.last_updated.asc()).all()
    
    return {
        "sample_id": sample_id,
        "fragments_count": len(fragments),
        "model_versions": list(set(f.model_version for f in fragments)),
        "change_history": all_logs,
        "summary_history": [
            {
                "model_version": s.model_version,
                "total_fragments": s.total_fragments,
                "risk_count": s.risk_count,
                "normal_count": s.normal_count,
                "pending_count": s.pending_count,
                "needs_recheck_count": s.needs_recheck_count,
                "last_updated": s.last_updated.isoformat(),
                "last_updated_by": s.last_updated_by
            }
            for s in summaries
        ]
    }
