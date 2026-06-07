import csv
import json
from datetime import datetime
from typing import List, Dict, Any, Optional
from .models import (
    ScreeningSession, SampleRecord, ModelOutput, ManualCorrection,
    ReviewNote, SampleStatus, NextAction
)


def create_session(session_id: Optional[str] = None) -> ScreeningSession:
    if not session_id:
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    return ScreeningSession(
        session_id=session_id,
        created_at=datetime.now()
    )


def import_model_outputs_from_json(
    session: ScreeningSession,
    json_data: List[Dict[str, Any]]
) -> List[str]:
    imported = []
    for item in json_data:
        sample_id = item["sample_id"]
        if sample_id not in session.samples:
            session.samples[sample_id] = SampleRecord(
                sample_id=sample_id,
                first_import_time=datetime.now()
            )
        sample = session.samples[sample_id]
        output = ModelOutput(
            sample_id=sample_id,
            model_version=item["model_version"],
            conclusion=item["conclusion"],
            confidence=float(item.get("confidence", 0.0)),
            output_time=datetime.fromisoformat(item["output_time"]) if isinstance(item.get("output_time"), str) else datetime.now(),
            raw_fragment=item.get("raw_fragment", "")
        )
        sample.add_model_output(output)
        if sample.version_conflict:
            sample.status = SampleStatus.PENDING_REVIEW
            sample.next_action = NextAction.CONTACT_OPERATIONS
            sample.keep_reason = "模型版本已更新，但样本编号未变，需运营复核人确认是否为同一条样本"
            sample.missing_materials = ["样本变更说明文档", "新旧版本标注对照"]
        imported.append(sample_id)
    return imported


def import_manual_corrections_from_csv(
    session: ScreeningSession,
    csv_rows: List[Dict[str, str]]
) -> List[str]:
    imported = []
    for row in csv_rows:
        sample_id = row["样本编号"]
        if sample_id not in session.samples:
            session.samples[sample_id] = SampleRecord(
                sample_id=sample_id,
                first_import_time=datetime.now()
            )
        sample = session.samples[sample_id]
        correction = ManualCorrection(
            sample_id=sample_id,
            corrected_by=row.get("改判人", "未知"),
            corrected_conclusion=row["改判结论"],
            correction_time=datetime.fromisoformat(row["改判时间"]) if row.get("改判时间") else datetime.now(),
            reason=row.get("改判原因", ""),
            source=row.get("来源", "人工改判表")
        )
        sample.add_manual_correction(correction)
        sample.status = SampleStatus.NEED_MORE_INFO
        sample.next_action = NextAction.CONTACT_ALGO_OPS
        sample.keep_reason = f"人工改判表已补录，原模型结论「{sample.get_latest_model_output().conclusion if sample.get_latest_model_output() else '无'}」不能直接照抄"
        if "原始上下文截图" not in sample.missing_materials:
            sample.missing_materials.append("原始上下文截图")
        if "标注员操作记录" not in sample.missing_materials:
            sample.missing_materials.append("标注员操作记录")
        imported.append(sample_id)
    return imported


def add_review_note(
    session: ScreeningSession,
    sample_id: str,
    reviewer: str,
    note: str,
    tag: Optional[str] = None
) -> bool:
    if sample_id not in session.samples:
        return False
    sample = session.samples[sample_id]
    review_note = ReviewNote(
        sample_id=sample_id,
        reviewer=reviewer,
        note=note,
        note_time=datetime.now(),
        tag=tag
    )
    sample.add_review_note(review_note)
    return True


def update_sample_status(
    session: ScreeningSession,
    sample_id: str,
    status: SampleStatus,
    next_action: Optional[NextAction] = None,
    keep_reason: Optional[str] = None
) -> bool:
    if sample_id not in session.samples:
        return False
    sample = session.samples[sample_id]
    sample.status = status
    if next_action:
        sample.next_action = next_action
    if keep_reason:
        sample.keep_reason = keep_reason
    return True


def rerun_sample(
    session: ScreeningSession,
    sample_id: str,
    new_model_version: str,
    new_conclusion: str,
    confidence: float = 0.0,
    raw_fragment: str = ""
) -> bool:
    if sample_id not in session.samples:
        return False
    sample = session.samples[sample_id]
    output = ModelOutput(
        sample_id=sample_id,
        model_version=new_model_version,
        conclusion=new_conclusion,
        confidence=confidence,
        output_time=datetime.now(),
        raw_fragment=raw_fragment
    )
    sample.add_model_output(output)
    sample.rerun_count += 1
    if sample.version_conflict:
        sample.status = SampleStatus.PENDING_REVIEW
        sample.next_action = NextAction.CONTACT_OPERATIONS
    else:
        sample.status = SampleStatus.PENDING_REVIEW
        sample.next_action = NextAction.CONTACT_ALGO_OPS
    return True


def get_samples_with_version_conflict(session: ScreeningSession) -> List[SampleRecord]:
    return [s for s in session.samples.values() if s.version_conflict]


def get_samples_pending_review(session: ScreeningSession) -> List[SampleRecord]:
    return [s for s in session.samples.values() if s.status == SampleStatus.PENDING_REVIEW]
