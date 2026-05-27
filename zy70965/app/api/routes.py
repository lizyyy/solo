from fastapi import APIRouter, Depends, UploadFile, File, HTTPException
from sqlalchemy.orm import Session
from typing import List
import json

from app.models.database import get_db
from app.models.models import BatchSubmission, QualityRecord
from app.schemas.schemas import (
    BatchUploadResponse, BatchResultResponse, BatchListResponse,
    ReviewActionRequest, ReviewActionResponse, SystemInfo, QualityRecordItem
)
from app.services.idempotency import calculate_file_hash, generate_batch_id, RULES
from app.services.parser import parse_quality_csv, parse_audio_json, parse_appeal_csv
from app.services.classifier import classify_records

router = APIRouter(prefix="/api", tags=["质检申诉"])


@router.post("/upload", response_model=BatchUploadResponse, summary="批量上传质检材料")
async def upload_batch(
    quality_csv: UploadFile = File(..., description="质检结果CSV文件"),
    audio_json: UploadFile = File(None, description="录音摘要JSON文件"),
    appeal_csv: UploadFile = File(None, description="申诉单CSV文件"),
    db: Session = Depends(get_db)
):
    quality_content = await quality_csv.read()
    audio_content = await audio_json.read() if audio_json else b"{}"
    appeal_content = await appeal_csv.read() if appeal_csv else b""

    q_hash = calculate_file_hash(quality_content)
    a_hash = calculate_file_hash(audio_content)
    ap_hash = calculate_file_hash(appeal_content)

    batch_id = generate_batch_id(q_hash, a_hash, ap_hash)

    existing = db.query(BatchSubmission).filter(BatchSubmission.batch_id == batch_id).first()
    if existing:
        return BatchUploadResponse(
            batch_id=batch_id,
            message=f"该批次材料已存在（批次ID: {batch_id}），已跳过重复提交。若需重新处理请联系管理员。",
            summary={
                "total": existing.total_records,
                "normal": existing.normal_count,
                "pending": existing.pending_count,
                "failed": existing.failed_count
            },
            duplicates_skipped=existing.total_records
        )

    try:
        quality_records = parse_quality_csv(quality_content)
        audio_summaries = parse_audio_json(audio_content)
        appeal_records = parse_appeal_csv(appeal_content) if appeal_content else []
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    normal, pending, failed = classify_records(quality_records, audio_summaries, appeal_records)

    batch = BatchSubmission(
        batch_id=batch_id,
        quality_csv_hash=q_hash,
        audio_json_hash=a_hash,
        appeal_csv_hash=ap_hash,
        is_processed=True,
        total_records=len(normal) + len(pending) + len(failed),
        normal_count=len(normal),
        pending_count=len(pending),
        failed_count=len(failed)
    )
    db.add(batch)
    db.flush()

    all_records = []
    for r in normal:
        all_records.append(_build_quality_record(batch_id, "normal", r))
    for r in pending:
        all_records.append(_build_quality_record(batch_id, "pending", r))
    for r in failed:
        all_records.append(_build_quality_record(batch_id, "failed", r))

    db.bulk_save_objects(all_records)
    db.commit()

    return BatchUploadResponse(
        batch_id=batch_id,
        message="批次处理完成",
        summary={
            "total": len(all_records),
            "normal": len(normal),
            "pending": len(pending),
            "failed": len(failed)
        },
        duplicates_skipped=0
    )


def _build_quality_record(batch_id: str, record_type: str, data: dict) -> QualityRecord:
    return QualityRecord(
        batch_id=batch_id,
        record_type=record_type,
        error_type=data.get("error_type"),
        agent_id=str(data.get("agent_id", "")),
        agent_name=str(data.get("agent_name", "")),
        call_id=str(data.get("call_id", "")),
        score_original=data.get("score_original"),
        score_after_appeal=data.get("score_after_appeal"),
        score_final=data.get("score_final"),
        deduction_reason=str(data.get("deduction_reason", "")),
        appeal_reason=str(data.get("appeal_reason", "")),
        review_status=str(data.get("review_status", "")),
        is_deduction_revoked=data.get("is_deduction_revoked", False),
        needs_second_review=data.get("needs_second_review", False),
        raw_data=data.get("raw_data", ""),
        suggestion=str(data.get("suggestion", "")),
        error_message=str(data.get("error_message", "")),
        data_source=data.get("source", "quality")
    )


@router.get("/batch/{batch_id}", response_model=BatchResultResponse, summary="获取批次处理结果")
def get_batch_result(batch_id: str, db: Session = Depends(get_db)):
    batch = db.query(BatchSubmission).filter(BatchSubmission.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail=f"批次 {batch_id} 不存在")

    records = db.query(QualityRecord).filter(QualityRecord.batch_id == batch_id).all()

    normal = [r for r in records if r.record_type == "normal"]
    pending = [r for r in records if r.record_type == "pending"]
    failed = [r for r in records if r.record_type == "failed"]

    return BatchResultResponse(
        batch_id=batch_id,
        submitted_at=batch.submitted_at,
        is_processed=batch.is_processed,
        normal=[QualityRecordItem.from_orm(r) for r in normal],
        pending=[QualityRecordItem.from_orm(r) for r in pending],
        failed=[QualityRecordItem.from_orm(r) for r in failed],
        summary={
            "total": len(records),
            "normal": len(normal),
            "pending": len(pending),
            "failed": len(failed)
        }
    )


@router.get("/batches", response_model=List[BatchListResponse], summary="获取所有批次列表")
def list_batches(db: Session = Depends(get_db)):
    batches = db.query(BatchSubmission).order_by(BatchSubmission.submitted_at.desc()).all()
    return [BatchListResponse(
        batch_id=b.batch_id,
        submitted_at=b.submitted_at,
        is_processed=b.is_processed,
        total_records=b.total_records,
        normal_count=b.normal_count,
        pending_count=b.pending_count,
        failed_count=b.failed_count
    ) for b in batches]


@router.post("/review", response_model=ReviewActionResponse, summary="执行复核操作")
def perform_review(action: ReviewActionRequest, db: Session = Depends(get_db)):
    record = db.query(QualityRecord).filter(QualityRecord.id == action.record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail=f"记录 {action.record_id} 不存在")

    action_map = {
        "accept_revoke": ("revoked", "扣分项撤销已确认"),
        "reject_revoke": ("rejected", "扣分项撤销申请已驳回"),
        "second_review_done": ("second_reviewed", "二次复核完成"),
        "finalize": ("finalized", "记录已最终确认")
    }

    if action.action not in action_map:
        raise HTTPException(status_code=400, detail=f"不支持的操作: {action.action}")

    new_status, msg = action_map[action.action]
    record.review_status = new_status

    if action.action == "accept_revoke":
        record.is_deduction_revoked = True
    if action.action == "second_review_done":
        record.needs_second_review = False

    db.commit()
    return ReviewActionResponse(
        success=True,
        record_id=action.record_id,
        new_status=new_status,
        message=msg
    )


@router.get("/system/info", response_model=SystemInfo, summary="获取系统信息与规则说明")
def get_system_info():
    return SystemInfo(
        version="1.0.0",
        supported_file_types=["质检CSV", "录音摘要JSON", "申诉单CSV"],
        active_rules=RULES
    )
