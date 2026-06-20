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
   - 支持只改备注不改风险标记（REMARK_EDIT 类型）

规则4：汇总数一致性
   - 重复导入不会导致 risk_count 翻倍
   - 只有首次导入或状态真实变更时才更新汇总表
   - 汇总表按 (sample_id, model_version) 唯一键约束
   - 汇总数从 fragment 的 processing_status 真实统计，不硬编码

规则5：回滚规则
   - 支持按变更ID回滚到任意历史状态
   - 回滚本身也会生成一条 ROLLBACK 类型的变更记录
   - 回滚后需要重新触发运营复核流程

状态流转图：
  pending_import  ──导入──→  needs_recheck  ──运营复核──→  confirmed_risk / normal
       │                          ↑
       │                          │ 模型版本变更
       └──────────────────────────┘
  (首次导入同一样本新版本时，状态置为 needs_recheck)

  needs_recheck / pending_import  ──人工改判──→  confirmed_risk / normal
========================================================================
"""

import json
import hashlib
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from sqlalchemy.orm import Session
from .models import (
    ModelOutputFragment, ManualReview, RiskChangeLog,
    RiskSummary, ImportBatch, ReviewBatch, RiskStatus, ChangeType
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


def _snapshot_fragment(fragment: ModelOutputFragment) -> Dict:
    """拍摄片段当前状态快照，用于变更日志的 before/after"""
    return {
        "sample_id": fragment.sample_id,
        "model_version": fragment.model_version,
        "original_line_number": fragment.original_line_number,
        "is_auto_reply_risk": fragment.is_auto_reply_risk,
        "original_is_auto_reply_risk": fragment.original_is_auto_reply_risk,
        "processing_status": fragment.processing_status,
        "current_remark": fragment.current_remark,
    }


def log_change(session: Session, fragment: ModelOutputFragment,
               change_type: ChangeType, changed_by: str,
               before_data: Optional[Dict],
               after_data: Optional[Dict],
               remark: Optional[str] = None,
               batch_id: Optional[str] = None) -> RiskChangeLog:
    """记录变更日志 - 所有状态变更必须经过此函数
    
    before_data / after_data 格式同 _snapshot_fragment 返回值
    """
    
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
        status_before=before_data.get("processing_status") if before_data else None,
        status_after=after_data.get("processing_status") if after_data else None,
        remark=remark,
        batch_id=batch_id
    )
    session.add(log)
    return log


def update_summary(session: Session, sample_id: str, model_version: str,
                   updated_by: str):
    """更新风险汇总表 - 从 fragment 真实统计，确保汇总数与明细一致
    
    各状态数量从 ModelOutputFragment.processing_status 字段统计，
    不再硬编码，产品复盘页直接读这个表。
    """
    fragments = session.query(ModelOutputFragment).filter(
        ModelOutputFragment.sample_id == sample_id,
        ModelOutputFragment.model_version == model_version
    ).all()
    
    total = len(fragments)
    risk_count = sum(1 for f in fragments if f.is_auto_reply_risk)
    normal_count = sum(1 for f in fragments if not f.is_auto_reply_risk)
    pending_count = sum(1 for f in fragments
                        if f.processing_status == RiskStatus.PENDING_IMPORT.value)
    needs_recheck_count = sum(1 for f in fragments
                              if f.processing_status == RiskStatus.NEEDS_RECHECK.value)
    confirmed_risk_count = sum(1 for f in fragments
                               if f.processing_status == RiskStatus.CONFIRMED_RISK.value)
    confirmed_normal_count = sum(1 for f in fragments
                                 if f.processing_status == RiskStatus.NORMAL.value)
    
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
            pending_count=pending_count,
            needs_recheck_count=needs_recheck_count,
            last_updated_by=updated_by
        )
        session.add(summary)
    else:
        summary.total_fragments = total
        summary.risk_count = risk_count
        summary.normal_count = normal_count
        summary.pending_count = pending_count
        summary.needs_recheck_count = needs_recheck_count
        summary.last_updated_by = updated_by
    
    return summary


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
       - 确定初始状态（写进 processing_status 字段）
       - 记录变更日志
    4. 更新汇总表
    
    关键字段落地：
    - original_is_auto_reply_risk: 模型原始判断，永不改变
    - is_auto_reply_risk: 当前生效判断，可能被人工改判覆盖
    - processing_status: 当前处理状态，产品复盘直接读
    
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
            "duplicate_skipped": len(records),
            "replay_command": (
                f"python -m email_auto_reply_risk.cli import "
                f"--file {source_file} --model-version {model_version} "
                f"--by {imported_by} --batch-id {batch_id}"
                if source_file else ""
            )
        }
    
    new_count = 0
    update_count = 0
    duplicate_count = 0
    
    for record in records:
        sample_id = record["sample_id"]
        original_line_number = record["original_line_number"]
        is_risk = record["is_auto_reply_risk"]
        
        existing = check_duplicate_fragment(
            session, sample_id, model_version, original_line_number
        )
        
        if existing:
            duplicate_count += 1
            continue
        
        has_version_change, old_versions = detect_model_version_change(
            session, sample_id, model_version
        )
        
        if has_version_change:
            initial_status = RiskStatus.NEEDS_RECHECK.value
            status_remark = (f"检测到模型版本变更：旧版本={old_versions}, "
                             f"新版本={model_version}，状态置为 NEEDS_RECHECK，"
                             f"待运营复核人确认，不急着归正常")
        else:
            initial_status = RiskStatus.PENDING_IMPORT.value
            status_remark = None
        
        fragment = ModelOutputFragment(
            sample_id=sample_id,
            model_version=model_version,
            original_line_number=original_line_number,
            raw_content=record["raw_content"],
            original_is_auto_reply_risk=is_risk,
            is_auto_reply_risk=is_risk,
            risk_score=record.get("risk_score"),
            processing_status=initial_status,
            current_remark=status_remark if has_version_change else None,
            import_batch_id=batch_id,
            last_updated_by=imported_by
        )
        session.add(fragment)
        session.flush()
        
        after_data = _snapshot_fragment(fragment)
        
        if has_version_change:
            log_change(session, fragment, ChangeType.MODEL_VERSION_CHANGE,
                       imported_by, None, after_data,
                       remark=status_remark, batch_id=batch_id)
        
        log_change(session, fragment, ChangeType.IMPORT,
                   imported_by, None, after_data,
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
        "duplicate_skipped": duplicate_count,
        "model_version_change_detected": None,
        "replay_command": (
            f"python -m email_auto_reply_risk.cli import "
            f"--file {source_file} --model-version {model_version} "
            f"--by {imported_by} --batch-id {batch_id}"
            if source_file else ""
        )
    }


def find_fragment_by_key(session: Session, sample_id: str,
                         model_version: str,
                         original_line_number: int) -> Optional[ModelOutputFragment]:
    """通过三元组定位片段（不依赖自增ID，保证可复现）"""
    return session.query(ModelOutputFragment).filter(
        ModelOutputFragment.sample_id == sample_id,
        ModelOutputFragment.model_version == model_version,
        ModelOutputFragment.original_line_number == original_line_number
    ).first()


def apply_manual_review(session: Session, fragment_id: int,
                        reviewer: str, reviewed_is_risk: Optional[bool] = None,
                        reviewed_status: Optional[str] = None,
                        remark: Optional[str] = None,
                        only_edit_remark: bool = False,
                        review_batch_id: Optional[str] = None) -> Dict:
    """人工改判 - 标注负责人周姐补看人工改判表
    
    支持两种模式：
    1. 完整改判（改风险标记 + 改状态 + 改备注）
    2. 只改备注（only_edit_remark=True）— 周姐只改了一条备注的场景
    
    规则：
    - 改判不删除原始记录
    - original_is_auto_reply_risk 永不改变
    - 完整记录改前改后的值
    - 触发变更日志
    - 更新 fragment.processing_status 和 current_remark
    - 更新汇总表
    """
    fragment = session.query(ModelOutputFragment).get(fragment_id)
    if fragment is None:
        raise ValueError(f"片段 {fragment_id} 不存在")
    
    before_data = _snapshot_fragment(fragment)
    
    original_is_risk = fragment.is_auto_reply_risk
    original_status = fragment.processing_status
    original_remark = fragment.current_remark
    
    if only_edit_remark:
        change_type = ChangeType.REMARK_EDIT
        fragment.current_remark = remark
        change_remark = f"仅修改备注：{original_remark} → {remark}"
        reviewed_is_risk_val = original_is_risk
        reviewed_status_val = original_status
    else:
        if reviewed_is_risk is None:
            raise ValueError("非仅改备注模式下，reviewed_is_risk 不能为空")
        
        change_type = ChangeType.MANUAL_EDIT
        fragment.is_auto_reply_risk = reviewed_is_risk
        
        if reviewed_status is None:
            reviewed_status = (RiskStatus.CONFIRMED_RISK.value
                              if reviewed_is_risk
                              else RiskStatus.NORMAL.value)
        
        fragment.processing_status = reviewed_status
        fragment.current_remark = remark
        change_remark = remark
        reviewed_is_risk_val = reviewed_is_risk
        reviewed_status_val = reviewed_status
    
    fragment.last_updated_by = reviewer
    
    review = ManualReview(
        fragment_id=fragment_id,
        reviewer=reviewer,
        original_is_risk=original_is_risk,
        reviewed_is_risk=reviewed_is_risk_val,
        original_status=original_status,
        reviewed_status=reviewed_status_val,
        remark=remark if not only_edit_remark else f"[仅改备注] {remark}",
        review_batch_id=review_batch_id
    )
    session.add(review)
    
    after_data = _snapshot_fragment(fragment)
    
    log_change(session, fragment, change_type,
               reviewer, before_data, after_data,
               remark=change_remark, batch_id=review_batch_id)
    
    update_summary(session, fragment.sample_id, fragment.model_version, reviewer)
    session.commit()
    
    return {
        "fragment_id": fragment_id,
        "change_type": change_type.value,
        "original_is_risk": original_is_risk,
        "reviewed_is_risk": reviewed_is_risk_val,
        "original_status": original_status,
        "reviewed_status": reviewed_status_val,
        "original_remark": original_remark,
        "reviewed_remark": fragment.current_remark,
        "reviewer": reviewer,
        "review_time": datetime.utcnow().isoformat()
    }


def apply_manual_review_batch(session: Session, review_items: List[Dict],
                              reviewer: str,
                              source_file: Optional[str] = None,
                              review_batch_id: Optional[str] = None) -> Dict:
    """批量人工改判 - 支持三元组定位，完整改判+只改备注混合
    
    review_items 每条格式（二选一，推荐三元组方式可复现）：
    方式A：三元组定位（推荐）
    {
        "sample_id": "S001",
        "model_version": "v1.0",
        "original_line_number": 15,
        "reviewed_is_risk": false,
        "remark": "...",
        "only_edit_remark": true/false
    }
    
    方式B：fragment_id定位
    {
        "fragment_id": 1,
        "reviewed_is_risk": false,
        "remark": "...",
        "only_edit_remark": true/false
    }
    """
    if review_batch_id is None:
        review_batch_id = "review_" + generate_batch_id(reviewer)[:12]
    
    results = []
    success_count = 0
    skip_count = 0
    
    for item in review_items:
        if "fragment_id" in item:
            fragment_id = item["fragment_id"]
        else:
            fragment = find_fragment_by_key(
                session,
                item["sample_id"],
                item["model_version"],
                item["original_line_number"]
            )
            if fragment is None:
                skip_count += 1
                results.append({
                    "status": "skipped",
                    "reason": "fragment_not_found",
                    "sample_id": item.get("sample_id"),
                    "model_version": item.get("model_version"),
                    "original_line_number": item.get("original_line_number")
                })
                continue
            fragment_id = fragment.id
        
        result = apply_manual_review(
            session,
            fragment_id=fragment_id,
            reviewer=reviewer,
            reviewed_is_risk=item.get("reviewed_is_risk"),
            reviewed_status=item.get("reviewed_status"),
            remark=item.get("remark"),
            only_edit_remark=item.get("only_edit_remark", False),
            review_batch_id=review_batch_id
        )
        result["status"] = "success"
        results.append(result)
        success_count += 1
    
    batch_record = ReviewBatch(
        review_batch_id=review_batch_id,
        reviewer=reviewer,
        source_file=source_file,
        total_items=len(review_items),
        success_count=success_count,
        skip_count=skip_count,
    )
    session.add(batch_record)
    session.commit()
    
    return {
        "review_batch_id": review_batch_id,
        "reviewer": reviewer,
        "total_items": len(review_items),
        "success_count": success_count,
        "skip_count": skip_count,
        "results": results,
        "replay_command": (
            f"python -m email_auto_reply_risk.cli review "
            f"--file {source_file} --by {reviewer} "
            f"--batch-id {review_batch_id}"
            if source_file else ""
        )
    }


def update_status(session: Session, fragment_id: int, new_status: str,
                  changed_by: str, remark: Optional[str] = None) -> Dict:
    """更新风险状态
    
    运营复核人确认时调用，或者运营流程中状态变更时调用。
    只改状态，不改风险标记。
    """
    fragment = session.query(ModelOutputFragment).get(fragment_id)
    if fragment is None:
        raise ValueError(f"片段 {fragment_id} 不存在")
    
    before_data = _snapshot_fragment(fragment)
    original_status = fragment.processing_status
    
    fragment.processing_status = new_status
    fragment.last_updated_by = changed_by
    
    after_data = _snapshot_fragment(fragment)
    
    log_change(session, fragment, ChangeType.STATUS_CHANGE,
               changed_by, before_data, after_data,
               remark=remark)
    
    update_summary(session, fragment.sample_id, fragment.model_version, changed_by)
    session.commit()
    
    return {
        "fragment_id": fragment_id,
        "original_status": original_status,
        "new_status": new_status,
        "changed_by": changed_by
    }


def get_fragment_current_state(session: Session, fragment_id: int) -> Dict:
    """获取单条片段的当前状态 - 产品复盘页直接用
    
    返回包含：当前处理状态、当前风险标记、当前备注、原始行号等
    """
    fragment = session.query(ModelOutputFragment).get(fragment_id)
    if fragment is None:
        raise ValueError(f"片段 {fragment_id} 不存在")
    
    return {
        "fragment_id": fragment.id,
        "sample_id": fragment.sample_id,
        "model_version": fragment.model_version,
        "original_line_number": fragment.original_line_number,
        "raw_content": fragment.raw_content,
        "original_is_auto_reply_risk": fragment.original_is_auto_reply_risk,
        "current_is_auto_reply_risk": fragment.is_auto_reply_risk,
        "risk_score": fragment.risk_score,
        "processing_status": fragment.processing_status,
        "current_remark": fragment.current_remark,
        "import_batch_id": fragment.import_batch_id,
        "imported_at": fragment.imported_at.isoformat(),
        "last_updated_at": fragment.last_updated_at.isoformat(),
        "last_updated_by": fragment.last_updated_by,
    }


def get_fragment_history(session: Session, fragment_id: int) -> List[Dict]:
    """获取单条片段的完整变更历史 - 用于运营复核人追问时回溯
    
    按时间正序排列，第一条是最早的导入记录，最后一条是最新状态。
    """
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
            "batch_id": log.batch_id,
            "before_snapshot": json.loads(log.before_data) if log.before_data else None,
            "after_snapshot": json.loads(log.after_data) if log.after_data else None,
        })
    return result


def get_sample_risk_timeline(session: Session, sample_id: str) -> Dict:
    """获取单样本的完整风险时间线 - 用于产品复盘
    
    返回：
    - 各片段的当前状态
    - 所有变更的时间线
    - 各模型版本的汇总
    - 可重跑命令
    """
    fragments = session.query(ModelOutputFragment).filter(
        ModelOutputFragment.sample_id == sample_id
    ).order_by(ModelOutputFragment.imported_at.asc()).all()
    
    fragment_states = []
    all_logs = []
    for fragment in fragments:
        fragment_states.append(get_fragment_current_state(session, fragment.id))
        logs = get_fragment_history(session, fragment.id)
        all_logs.extend(logs)
    
    all_logs.sort(key=lambda x: x["changed_at"])
    
    summaries = session.query(RiskSummary).filter(
        RiskSummary.sample_id == sample_id
    ).order_by(RiskSummary.last_updated.asc()).all()
    
    model_versions = list(set(f.model_version for f in fragments))
    
    status_breakdown = {}
    for f in fragment_states:
        s = f["processing_status"]
        status_breakdown[s] = status_breakdown.get(s, 0) + 1
    
    risk_breakdown = {}
    for f in fragment_states:
        v = f["model_version"]
        if v not in risk_breakdown:
            risk_breakdown[v] = {"risk": 0, "normal": 0, "total": 0}
        risk_breakdown[v]["total"] += 1
        if f["current_is_auto_reply_risk"]:
            risk_breakdown[v]["risk"] += 1
        else:
            risk_breakdown[v]["normal"] += 1
    
    import_batch_ids = list(set(f.import_batch_id for f in fragments))
    
    import_batches = session.query(ImportBatch).filter(
        ImportBatch.batch_id.in_(import_batch_ids)
    ).order_by(ImportBatch.imported_at.asc()).all()
    
    fragment_ids = [f.id for f in fragments]
    review_batch_ids = list(set(
        log.batch_id for log in session.query(RiskChangeLog).filter(
            RiskChangeLog.fragment_id.in_(fragment_ids),
            RiskChangeLog.change_type.in_(["manual_edit", "remark_edit"])
        ).all()
        if log.batch_id
    ))
    
    review_batches = session.query(ReviewBatch).filter(
        ReviewBatch.review_batch_id.in_(review_batch_ids)
    ).order_by(ReviewBatch.reviewed_at.asc()).all()
    
    replay_commands = []
    
    for idx, batch in enumerate(import_batches):
        if batch.source_file:
            replay_commands.append({
                "step": f"step1_import_v{idx+1}",
                "description": f"步骤1-{idx+1}：导入模型输出（{batch.model_version}）",
                "command": (
                    f"python -m email_auto_reply_risk.cli import "
                    f"--file {batch.source_file} "
                    f"--model-version {batch.model_version} "
                    f"--by {batch.imported_by} "
                    f"--batch-id {batch.batch_id}"
                )
            })
    
    for idx, rbatch in enumerate(review_batches):
        if rbatch.source_file:
            replay_commands.append({
                "step": f"step2_review_{idx+1}",
                "description": f"步骤2-{idx+1}：人工改判（{rbatch.reviewer}）",
                "command": (
                    f"python -m email_auto_reply_risk.cli review "
                    f"--file {rbatch.source_file} "
                    f"--by {rbatch.reviewer} "
                    f"--batch-id {rbatch.review_batch_id}"
                )
            })
    
    replay_commands.append({
        "step": "step_check_status",
        "description": "查看当前处理状态和历史留痕",
        "command": (
            f"python -m email_auto_reply_risk.cli sample-timeline "
            f"--sample-id {sample_id}"
        )
    })
    
    replay_commands.append({
        "step": "step3_product_review",
        "description": "步骤3：生成产品复盘报告并导出",
        "command": (
            f"python -m email_auto_reply_risk.cli product-review "
            f"--sample-id {sample_id} "
            f"--export data/review_{sample_id}.json"
        )
    })
    
    return {
        "sample_id": sample_id,
        "fragments_count": len(fragments),
        "model_versions": sorted(model_versions),
        "current_status_breakdown": status_breakdown,
        "risk_breakdown_by_version": risk_breakdown,
        "fragments_current_state": fragment_states,
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
        ],
        "replay_commands": replay_commands,
        "result_explanation": _generate_result_explanation(sample_id, fragment_states, all_logs)
    }


def _generate_result_explanation(sample_id: str,
                                 fragment_states: List[Dict],
                                 change_history: List[Dict]) -> str:
    """生成结果说明文字 - 产品复盘页直接展示
    
    运营复核人追问时，这段文字解释"为什么前后不一致"
    """
    lines = []
    lines.append(f"样本 {sample_id} 邮件自动回复风险结果说明：")
    lines.append("")
    
    lines.append(f"一、基本情况")
    lines.append(f"  共 {len(fragment_states)} 个模型输出片段")
    versions = sorted(set(f["model_version"] for f in fragment_states))
    lines.append(f"  涉及模型版本：{', '.join(versions)}")
    lines.append("")
    
    if len(versions) > 1:
        lines.append(f"二、模型版本变更提示（重点关注）")
        lines.append(f"  检测到同一样本存在 {len(versions)} 个不同模型版本的输出。")
        lines.append(f"  根据边界规则：模型版本换了但样本编号没变时，")
        lines.append(f"  状态置为 NEEDS_RECHECK，不急着归正常，留给运营复核人复核。")
        lines.append("")
    
    lines.append(f"三、当前处理状态分布")
    status_counts = {}
    for f in fragment_states:
        s = f["processing_status"]
        status_counts[s] = status_counts.get(s, 0) + 1
    for status, count in status_counts.items():
        lines.append(f"  {status}: {count} 条")
    lines.append("")
    
    lines.append(f"四、变更历史概览")
    type_counts = {}
    for log in change_history:
        t = log["change_type"]
        type_counts[t] = type_counts.get(t, 0) + 1
    for ctype, count in type_counts.items():
        lines.append(f"  {ctype}: {count} 次")
    lines.append("")
    
    manual_changes = [l for l in change_history if l["change_type"] in ("manual_edit", "remark_edit")]
    if manual_changes:
        lines.append(f"五、人工改判记录")
        for m in manual_changes:
            lines.append(f"  - {m['changed_at']} {m['changed_by']} "
                        f"[{m['change_type']}] "
                        f"风险: {m['is_risk_before']} → {m['is_risk_after']}")
            if m["remark"]:
                lines.append(f"    备注: {m['remark']}")
        lines.append("")
    
    lines.append(f"六、可追溯证据")
    lines.append(f"  所有变更均保留原始行号、改前改后快照。")
    lines.append(f"  查看单条片段详情：python -m email_auto_reply_risk.cli fragment-history --fragment-id <id>")
    lines.append("")
    
    return "\n".join(lines)
