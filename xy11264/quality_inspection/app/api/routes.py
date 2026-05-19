import tempfile
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, HTTPException, UploadFile, File, Form, BackgroundTasks
from fastapi.responses import Response, FileResponse

from app.models import (
    InspectionRecord,
    InspectionSummary,
    ImportResult,
    MarkIssueRequest,
    ExportRequest,
    ExportFormat,
    SensitiveWord,
    BadRecord,
    ReviewStatus,
)
from app.utils import get_storage, mask_object, mask_dict
from app.services import get_scanner, get_importer, get_exporter

router = APIRouter(prefix="/api/v1", tags=["quality_inspection"])


@router.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@router.post("/import/transcription", response_model=ImportResult)
async def import_transcription(file: UploadFile = File(...)):
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.txt') as tmp:
            content = await file.read()
            tmp.write(content)
            tmp.flush()
            importer = get_importer()
            result = importer.import_transcription_file(tmp.name)
            return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.post("/import/metadata", response_model=ImportResult)
async def import_metadata(file: UploadFile = File(...), transcription_dir: Optional[str] = Form(None)):
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.csv') as tmp:
            content = await file.read()
            tmp.write(content)
            tmp.flush()
            importer = get_importer()
            result = importer.import_metadata_file(tmp.name, transcription_dir)
            return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.post("/import/sensitive-words", response_model=ImportResult)
async def import_sensitive_words(file: UploadFile = File(...)):
    try:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.txt') as tmp:
            content = await file.read()
            tmp.write(content)
            tmp.flush()
            importer = get_importer()
            result = importer.import_sensitive_words_file(tmp.name)
            return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")


@router.post("/scan")
async def scan_record(call_id: Optional[str] = None, re_scan: bool = False):
    storage = get_storage()
    scanner = get_scanner()
    
    if call_id:
        record = storage.get_record_by_call_id(call_id)
        if not record:
            raise HTTPException(status_code=404, detail=f"未找到通话ID: {call_id}")
        record = scanner.scan_record(record, re_scan)
        storage.update_record(record)
        return mask_object(record)
    else:
        records = storage.get_all_records()
        updated_count = 0
        for record in records:
            if not record.is_complete or re_scan:
                record = scanner.scan_record(record, re_scan)
                storage.update_record(record)
                updated_count += 1
        return {"scanned": updated_count, "total": len(records)}


@router.get("/records")
async def get_records(skip: int = 0, limit: int = 100):
    storage = get_storage()
    records = storage.get_all_records()
    return [mask_object(r) for r in records[skip:skip + limit]]


@router.get("/records/{record_id}")
async def get_record(record_id: str):
    storage = get_storage()
    record = storage.get_record(record_id)
    if not record:
        raise HTTPException(status_code=404, detail=f"未找到记录: {record_id}")
    return mask_object(record)


@router.post("/issues/mark")
async def mark_issue(request: MarkIssueRequest):
    storage = get_storage()
    
    found = False
    for record in storage.get_all_records():
        for issue in record.issues:
            if issue.id == request.issue_id:
                issue.review_status = request.review_status
                issue.reviewed_by = request.reviewer
                issue.reviewed_at = datetime.now()
                storage.update_record(record)
                found = True
                break
        if found:
            break
    
    if not found:
        raise HTTPException(status_code=404, detail=f"未找到问题: {request.issue_id}")
    
    return {"success": True, "message": "标记成功"}


@router.get("/issues/pending")
async def get_pending_issues():
    storage = get_storage()
    pending_issues = []
    for record in storage.get_all_records():
        for issue in record.issues:
            if issue.review_status == ReviewStatus.PENDING:
                pending_issues.append({
                    "issue_id": issue.id,
                    "record_id": record.id,
                    "call_id": record.call_id,
                    "issue_type": issue.issue_type.value,
                    "description": issue.description,
                    "severity": issue.severity,
                })
    return pending_issues


@router.get("/summary", response_model=InspectionSummary)
async def get_summary():
    exporter = get_exporter()
    summary = exporter.get_summary()
    return summary


@router.post("/export")
async def export_records(request: ExportRequest):
    exporter = get_exporter()
    content = exporter.export_records(
        record_ids=None,
        format=request.format,
        include_masked=request.include_masked,
    )
    
    if request.format == ExportFormat.CSV:
        return Response(
            content=content,
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=quality_inspection.csv"}
        )
    elif request.format == ExportFormat.JSON:
        return Response(
            content=content,
            media_type="application/json",
            headers={"Content-Disposition": "attachment; filename=quality_inspection.json"}
        )
    elif request.format == ExportFormat.EXCEL:
        with tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx') as tmp:
            tmp.write(content)
            tmp_path = tmp.name
        return FileResponse(
            path=tmp_path,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            filename="quality_inspection.xlsx"
        )


@router.get("/sensitive-words")
async def get_sensitive_words():
    storage = get_storage()
    words = storage.get_all_sensitive_words()
    return words


@router.post("/sensitive-words")
async def add_sensitive_word(word: str, category: str = "general", severity: int = 3):
    import uuid
    storage = get_storage()
    new_word = SensitiveWord(
        id=str(uuid.uuid4()),
        word=word,
        category=category,
        severity=severity,
        enabled=True,
    )
    if not storage.add_sensitive_word(new_word):
        raise HTTPException(status_code=400, detail="敏感词已存在")
    return new_word


@router.delete("/sensitive-words/{word_id}")
async def delete_sensitive_word(word_id: str):
    storage = get_storage()
    if not storage.delete_sensitive_word(word_id):
        raise HTTPException(status_code=404, detail=f"未找到敏感词: {word_id}")
    return {"success": True}


@router.get("/bad-records")
async def get_bad_records():
    storage = get_storage()
    records = storage.get_all_bad_records()
    return [mask_dict(r.dict()) for r in records]


@router.delete("/records/{record_id}")
async def delete_record(record_id: str):
    storage = get_storage()
    if not storage.delete_record(record_id):
        raise HTTPException(status_code=404, detail=f"未找到记录: {record_id}")
    return {"success": True}


@router.post("/clear-all")
async def clear_all_data():
    storage = get_storage()
    storage.clear_all()
    return {"success": True, "message": "所有数据已清除"}
