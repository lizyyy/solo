from fastapi import APIRouter, Depends, HTTPException, status, File, UploadFile, Form
from fastapi.responses import FileResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from io import StringIO
import os
import urllib.parse
from . import models, schemas, services
from .database import get_db

router = APIRouter()

@router.post("/documents/", response_model=schemas.Document, status_code=status.HTTP_201_CREATED)
def create_document(document: schemas.DocumentCreate, db: Session = Depends(get_db)):
    return services.create_document(db, document.filename, document.content)

@router.post("/documents/upload", response_model=schemas.Document, status_code=status.HTTP_201_CREATED)
async def upload_document(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    content = await file.read()
    try:
        text_content = content.decode('utf-8')
    except:
        try:
            text_content = content.decode('gbk')
        except:
            text_content = content.decode('utf-8', errors='replace')
    
    return services.create_document(db, file.filename, text_content, len(content))

@router.put("/documents/{document_id}/content", response_model=schemas.Document)
def update_document_content(
    document_id: int,
    content_update: schemas.DocumentContentUpdate,
    db: Session = Depends(get_db)
):
    document = services.update_document_content(db, document_id, content_update.content)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document

@router.get("/documents/", response_model=List[schemas.DocumentDetail])
def list_documents(skip: int = 0, limit: int = 100, status: str = None, db: Session = Depends(get_db)):
    documents = services.get_documents(db, skip=skip, limit=limit, status=status)
    result = []
    for doc in documents:
        doc_dict = {
            "id": doc.id,
            "filename": doc.filename,
            "file_size": doc.file_size,
            "content": doc.content,
            "masked_content": doc.masked_content,
            "status": doc.status,
            "created_at": doc.created_at,
            "updated_at": doc.updated_at,
            "error_message": doc.error_message,
            "hit_count": len(doc.hits),
            "review_count": len(doc.reviews),
            "version_count": len(doc.versions)
        }
        result.append(doc_dict)
    return result

@router.get("/documents/{document_id}", response_model=schemas.DocumentWithDetails)
def get_document(document_id: int, db: Session = Depends(get_db)):
    document = services.get_document_with_details(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document

@router.patch("/documents/{document_id}/status", response_model=schemas.Document)
def update_status(document_id: int, status_update: schemas.StatusUpdate, db: Session = Depends(get_db)):
    document = services.update_document_status(db, document_id, status_update.status, status_update.message)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document

@router.post("/documents/{document_id}/scan", response_model=schemas.Document)
def scan_document(document_id: int, db: Session = Depends(get_db)):
    document = services.scan_document(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document

@router.post("/documents/{document_id}/reviews", response_model=schemas.Review)
def create_review(document_id: int, review: schemas.ReviewCreate, db: Session = Depends(get_db)):
    document = services.get_document(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return services.create_review(db, document_id, review)

@router.get("/documents/{document_id}/hits", response_model=List[schemas.SensitiveHit])
def get_document_hits(document_id: int, db: Session = Depends(get_db)):
    document = services.get_document(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document.hits

@router.get("/documents/{document_id}/history", response_model=List[schemas.StatusHistory])
def get_document_history(document_id: int, db: Session = Depends(get_db)):
    document = services.get_document(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document.status_history

@router.post("/documents/{document_id}/versions", response_model=schemas.ExportVersion)
def create_version(document_id: int, db: Session = Depends(get_db)):
    document = services.get_document(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return services.generate_version(db, document_id)

@router.get("/documents/{document_id}/versions", response_model=List[schemas.ExportVersion])
def get_document_versions(document_id: int, db: Session = Depends(get_db)):
    document = services.get_document(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return document.versions

@router.post("/versions/{version_id}/authorize", response_model=schemas.ExportVersion)
def authorize_version(version_id: int, authorized_by: str, db: Session = Depends(get_db)):
    version = services.authorize_version(db, version_id, authorized_by)
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    return version

@router.get("/versions/{version_id}/download")
def download_version(
    version_id: int,
    downloaded_by: str,
    ip_address: Optional[str] = None,
    db: Session = Depends(get_db)
):
    version = db.query(models.ExportVersion).filter(models.ExportVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    if not version.is_authorized:
        raise HTTPException(status_code=403, detail="Version not authorized")
    
    content = services.get_version_file_content(version)
    if content is None:
        raise HTTPException(status_code=500, detail="File not found or cannot be read")
    
    services.record_download(db, version_id, downloaded_by, ip_address)
    
    filename = f"{os.path.splitext(version.document.filename)[0]}_{version.version_number}_masked.txt"
    import urllib.parse
    encoded_filename = urllib.parse.quote(filename)
    
    return StreamingResponse(
        StringIO(content),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
    )

@router.get("/versions/{version_id}/report")
def download_report(
    version_id: int,
    downloaded_by: str,
    db: Session = Depends(get_db)
):
    version = db.query(models.ExportVersion).filter(models.ExportVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    if not version.is_authorized:
        raise HTTPException(status_code=403, detail="Version not authorized")
    
    content = services.get_version_report_content(version)
    if content is None:
        raise HTTPException(status_code=500, detail="Report not found or cannot be read")
    
    filename = f"{os.path.splitext(version.document.filename)[0]}_{version.version_number}_report.txt"
    encoded_filename = urllib.parse.quote(filename)
    
    return StreamingResponse(
        StringIO(content),
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename*=UTF-8''{encoded_filename}"}
    )

@router.post("/versions/{version_id}/download-record", response_model=schemas.DownloadRecord)
def record_download_only(
    version_id: int,
    downloaded_by: str,
    ip_address: Optional[str] = None,
    db: Session = Depends(get_db)
):
    version = db.query(models.ExportVersion).filter(models.ExportVersion.id == version_id).first()
    if not version:
        raise HTTPException(status_code=404, detail="Version not found")
    if not version.is_authorized:
        raise HTTPException(status_code=403, detail="Version not authorized")
    return services.record_download(db, version_id, downloaded_by, ip_address)

@router.get("/rules/", response_model=List[schemas.MaskingRule])
def list_rules(db: Session = Depends(get_db)):
    return db.query(models.MaskingRule).all()

@router.post("/rules/", response_model=schemas.MaskingRule, status_code=status.HTTP_201_CREATED)
def create_rule(rule: schemas.MaskingRuleCreate, db: Session = Depends(get_db)):
    db_rule = models.MaskingRule(**rule.dict())
    db.add(db_rule)
    db.commit()
    db.refresh(db_rule)
    return db_rule

@router.get("/queue/exception", response_model=List[schemas.DocumentDetail])
def get_exception_queue(db: Session = Depends(get_db)):
    documents = services.get_documents(db, status=models.DocumentStatus.ERROR)
    result = []
    for doc in documents:
        doc_dict = {
            "id": doc.id,
            "filename": doc.filename,
            "file_size": doc.file_size,
            "content": doc.content,
            "masked_content": doc.masked_content,
            "status": doc.status,
            "created_at": doc.created_at,
            "updated_at": doc.updated_at,
            "error_message": doc.error_message,
            "hit_count": len(doc.hits),
            "review_count": len(doc.reviews),
            "version_count": len(doc.versions)
        }
        result.append(doc_dict)
    return result

@router.get("/queue/pending-review", response_model=List[schemas.DocumentDetail])
def get_pending_review_queue(db: Session = Depends(get_db)):
    documents = services.get_documents(db, status=models.DocumentStatus.PENDING_REVIEW)
    result = []
    for doc in documents:
        doc_dict = {
            "id": doc.id,
            "filename": doc.filename,
            "file_size": doc.file_size,
            "content": doc.content,
            "masked_content": doc.masked_content,
            "status": doc.status,
            "created_at": doc.created_at,
            "updated_at": doc.updated_at,
            "error_message": doc.error_message,
            "hit_count": len(doc.hits),
            "review_count": len(doc.reviews),
            "version_count": len(doc.versions)
        }
        result.append(doc_dict)
    return result

@router.post("/documents/{document_id}/retry", response_model=schemas.Document)
def retry_document(document_id: int, db: Session = Depends(get_db)):
    document = services.get_document(db, document_id)
    if not document:
        raise HTTPException(status_code=404, detail="Document not found")
    return services.scan_document(db, document_id)
