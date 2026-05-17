from typing import List
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from io import StringIO
import csv

from database import get_db
from models import Appeal, AppealHistory, AppealStatus, AppealSource
from schemas import BatchImportItem, BatchImportResult

router = APIRouter()


def _check_image_conflict(db: Session, image_url: str, image_hash: str = None) -> str:
    conflict_msg = None
    
    existing = db.query(Appeal).filter(Appeal.image_url == image_url).first()
    if existing:
        conflict_msg = f"图片URL已存在，当前状态：{existing.status.value}"
    
    if image_hash:
        hash_existing = db.query(Appeal).filter(
            Appeal.image_hash == image_hash,
            Appeal.image_url != image_url
        ).first()
        if hash_existing:
            if hash_existing.status == AppealStatus.RESTORED and (not existing or existing.status != AppealStatus.RESTORED):
                conflict_msg = f"缩略图已恢复（{hash_existing.image_url}），但本图状态不同步"
    
    return conflict_msg


def _import_single_item(db: Session, item: dict, operator: str) -> dict:
    try:
        image_url = item.get("image_url", "").strip()
        if not image_url:
            return {"success": False, "error": "image_url不能为空", "data": item}
        
        review_tags = item.get("review_tags", "").strip()
        if not review_tags:
            return {"success": False, "error": "review_tags不能为空", "data": item}
        
        model_version = item.get("model_version", "").strip()
        if not model_version:
            return {"success": False, "error": "model_version不能为空", "data": item}
        
        image_hash = (item.get("image_hash") or "").strip() or None
        appeal_material = (item.get("appeal_material") or "").strip() or None
        
        conflict_msg = _check_image_conflict(db, image_url, image_hash)
        if conflict_msg:
            return {"success": False, "error": conflict_msg, "data": item}
        
        db_appeal = Appeal(
            image_url=image_url,
            image_hash=image_hash,
            review_tags=review_tags,
            model_version=model_version,
            appeal_material=appeal_material,
            status=AppealStatus.BANNED,
            source=AppealSource.BATCH_IMPORT,
            operator=operator,
        )
        db.add(db_appeal)
        db.flush()
        
        history = AppealHistory(
            appeal_id=db_appeal.id,
            old_status=None,
            new_status=AppealStatus.BANNED,
            source=AppealSource.BATCH_IMPORT,
            operator=operator,
            remark="批量导入创建申诉记录",
        )
        db.add(history)
        
        return {"success": True, "appeal_id": db_appeal.id, "image_url": image_url}
        
    except Exception as e:
        return {"success": False, "error": str(e), "data": item}


@router.post("/import", response_model=BatchImportResult)
def batch_import(
    items: List[BatchImportItem],
    operator: str = "system",
    db: Session = Depends(get_db),
):
    success_count = 0
    failed_count = 0
    results = []
    
    for item in items:
        result = _import_single_item(db, item.model_dump(), operator)
        if result["success"]:
            success_count += 1
        else:
            failed_count += 1
        results.append(result)
    
    db.commit()
    
    return BatchImportResult(
        success=success_count,
        failed=failed_count,
        results=results
    )


@router.post("/import/csv", response_model=BatchImportResult)
async def batch_import_csv(
    file: UploadFile = File(...),
    operator: str = "system",
    db: Session = Depends(get_db),
):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="仅支持CSV文件")
    
    content = await file.read()
    try:
        csv_content = content.decode('utf-8')
    except UnicodeDecodeError:
        csv_content = content.decode('gbk')
    
    f = StringIO(csv_content)
    reader = csv.DictReader(f)
    
    success_count = 0
    failed_count = 0
    results = []
    
    for row in reader:
        result = _import_single_item(db, row, operator)
        if result["success"]:
            success_count += 1
        else:
            failed_count += 1
        results.append(result)
    
    db.commit()
    
    return BatchImportResult(
        success=success_count,
        failed=failed_count,
        results=results
    )


@router.get("/export")
def export_appeals(
    status: AppealStatus = None,
    db: Session = Depends(get_db),
):
    query = db.query(Appeal)
    if status:
        query = query.filter(Appeal.status == status)
    
    appeals = query.order_by(Appeal.created_at.desc()).all()
    
    data = []
    for appeal in appeals:
        data.append({
            "id": appeal.id,
            "image_url": appeal.image_url,
            "image_hash": appeal.image_hash,
            "review_tags": appeal.review_tags,
            "model_version": appeal.model_version,
            "status": appeal.status.value,
            "source": appeal.source.value,
            "operator": appeal.operator,
            "created_at": appeal.created_at.isoformat(),
            "updated_at": appeal.updated_at.isoformat(),
        })
    
    return {"total": len(data), "data": data}
