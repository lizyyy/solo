from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from typing import List, Optional
import json
import os
import shutil
from pathlib import Path

from database import engine, get_db, Base
import models
import schemas
import crud
from utils import get_missing_fields

Base.metadata.create_all(bind=engine)

UPLOAD_DIR = Path("./uploaded_invoices")
UPLOAD_DIR.mkdir(exist_ok=True)

SUPPORTED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.pdf', '.tiff', '.bmp'}

app = FastAPI(title="票据影像报销单匹配重复检测API", version="1.1.0")

def get_sample_files():
    return [
        "发票扫描件_123456789012_12345678_BX2024001_1500.00.jpg",
        "invoice_123456789013_87654321_BX2024002_2300.50.png",
        "乱名文件_无法解析.pdf",
        "发票扫描件_123456789012_12345678_BX2024003_1500.00_重复.jpg",
        "金额不对_123456789999_11112222_BX2024004_999.99.jpg",
    ]

def scan_directory_for_invoices(directory_path: str) -> List[str]:
    """扫描目录，返回支持的影像文件列表"""
    found_files = []
    if not os.path.exists(directory_path):
        return found_files
    
    for filename in os.listdir(directory_path):
        ext = os.path.splitext(filename)[1].lower()
        if ext in SUPPORTED_EXTENSIONS:
            found_files.append(filename)
    
    return found_files

@app.post("/directories/scan", response_model=schemas.ScanResult)
def scan_and_create_directory(
    request: schemas.DirectoryScanRequest,
    processed_by: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """扫描指定目录并创建影像目录，自动导入目录下的票据文件"""
    existing = db.query(models.ImageDirectory).filter(
        models.ImageDirectory.directory_path == request.directory_path
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Directory already exists")
    
    db_directory = crud.create_image_directory(db, schemas.ImageDirectoryCreate(
        directory_path=request.directory_path,
        reimbursement_data=request.reimbursement_data
    ), processed_by)
    
    if request.use_sample_data:
        filenames = get_sample_files()
        for filename in filenames:
            crud.create_invoice(
                db,
                directory_id=db_directory.id,
                filename=filename,
                file_path=f"{request.directory_path}/{filename}"
            )
    else:
        filenames = scan_directory_for_invoices(request.directory_path)
        for filename in filenames:
            crud.create_invoice(
                db,
                directory_id=db_directory.id,
                filename=filename,
                file_path=f"{request.directory_path}/{filename}"
            )
    
    if request.reimbursement_data:
        for item in request.reimbursement_data:
            crud.create_reimbursement_sheet(db, schemas.ReimbursementSheetCreate(
                directory_id=db_directory.id,
                reimbursement_id=item.get("reimbursement_id", ""),
                invoice_code=item.get("invoice_code", ""),
                invoice_number=item.get("invoice_number", ""),
                amount=item.get("amount", 0),
                applicant=item.get("applicant"),
                department=item.get("department")
            ))
    
    return {
        "directory_id": db_directory.id,
        "files_scanned": len(filenames),
        "message": f"Successfully scanned {len(filenames)} invoice files"
    }

@app.post("/directories/", response_model=schemas.ImageDirectory)
def create_directory(
    directory: schemas.ImageDirectoryCreate,
    use_sample_data: bool = False,
    processed_by: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """创建影像目录，可选使用示例数据（向后兼容）"""
    existing = db.query(models.ImageDirectory).filter(
        models.ImageDirectory.directory_path == directory.directory_path
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Directory already exists")
    
    db_directory = crud.create_image_directory(db, directory, processed_by)
    
    if use_sample_data:
        filenames = get_sample_files()
        for filename in filenames:
            crud.create_invoice(
                db,
                directory_id=db_directory.id,
                filename=filename,
                file_path=f"{directory.directory_path}/{filename}"
            )
    
    if directory.reimbursement_data:
        for item in directory.reimbursement_data:
            crud.create_reimbursement_sheet(db, schemas.ReimbursementSheetCreate(
                directory_id=db_directory.id,
                reimbursement_id=item.get("reimbursement_id", ""),
                invoice_code=item.get("invoice_code", ""),
                invoice_number=item.get("invoice_number", ""),
                amount=item.get("amount", 0),
                applicant=item.get("applicant"),
                department=item.get("department")
            ))
    
    return db_directory

@app.post("/directories/{directory_id}/import-files", response_model=schemas.ScanResult)
def import_invoice_files(
    directory_id: int,
    request: schemas.InvoiceFileListRequest,
    db: Session = Depends(get_db)
):
    """向已有目录批量导入票据文件名"""
    directory = db.query(models.ImageDirectory).filter(
        models.ImageDirectory.id == directory_id
    ).first()
    if not directory:
        raise HTTPException(status_code=404, detail="Directory not found")
    
    imported_count = 0
    for filename in request.filenames:
        existing = db.query(models.Invoice).filter(
            models.Invoice.directory_id == directory_id,
            models.Invoice.original_filename == filename
        ).first()
        if not existing:
            crud.create_invoice(
                db,
                directory_id=directory_id,
                filename=filename,
                file_path=f"{directory.directory_path}/{filename}"
            )
            imported_count += 1
    
    return {
        "directory_id": directory_id,
        "files_scanned": imported_count,
        "message": f"Successfully imported {imported_count} invoice files"
    }

@app.post("/directories/{directory_id}/upload")
async def upload_invoice_file(
    directory_id: int,
    file: UploadFile = File(...),
    processed_by: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """上传单个票据影像文件"""
    directory = db.query(models.ImageDirectory).filter(
        models.ImageDirectory.id == directory_id
    ).first()
    if not directory:
        raise HTTPException(status_code=404, detail="Directory not found")
    
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type. Supported types: {', '.join(SUPPORTED_EXTENSIONS)}"
        )
    
    save_dir = UPLOAD_DIR / str(directory_id)
    save_dir.mkdir(exist_ok=True)
    file_path = save_dir / file.filename
    
    with file_path.open("wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    existing = db.query(models.Invoice).filter(
        models.Invoice.directory_id == directory_id,
        models.Invoice.original_filename == file.filename
    ).first()
    
    if existing:
        return {
            "invoice_id": existing.id,
            "filename": file.filename,
            "file_path": str(file_path),
            "message": "File already exists, reused existing record"
        }
    
    db_invoice = crud.create_invoice(
        db,
        directory_id=directory_id,
        filename=file.filename,
        file_path=str(file_path)
    )
    
    return {
        "invoice_id": db_invoice.id,
        "filename": file.filename,
        "file_path": str(file_path),
        "message": "File uploaded successfully"
    }

@app.post("/directories/{directory_id}/upload-batch")
async def upload_multiple_files(
    directory_id: int,
    files: List[UploadFile] = File(...),
    processed_by: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """批量上传多个票据影像文件"""
    directory = db.query(models.ImageDirectory).filter(
        models.ImageDirectory.id == directory_id
    ).first()
    if not directory:
        raise HTTPException(status_code=404, detail="Directory not found")
    
    save_dir = UPLOAD_DIR / str(directory_id)
    save_dir.mkdir(exist_ok=True)
    
    results = []
    for file in files:
        ext = os.path.splitext(file.filename)[1].lower()
        if ext not in SUPPORTED_EXTENSIONS:
            results.append({
                "filename": file.filename,
                "status": "skipped",
                "reason": "Unsupported file type"
            })
            continue
        
        file_path = save_dir / file.filename
        
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        existing = db.query(models.Invoice).filter(
            models.Invoice.directory_id == directory_id,
            models.Invoice.original_filename == file.filename
        ).first()
        
        if existing:
            results.append({
                "filename": file.filename,
                "status": "exists",
                "invoice_id": existing.id
            })
        else:
            db_invoice = crud.create_invoice(
                db,
                directory_id=directory_id,
                filename=file.filename,
                file_path=str(file_path)
            )
            results.append({
                "filename": file.filename,
                "status": "uploaded",
                "invoice_id": db_invoice.id
            })
    
    return {
        "directory_id": directory_id,
        "total_files": len(files),
        "uploaded_count": sum(1 for r in results if r["status"] == "uploaded"),
        "results": results
    }

@app.get("/supported-formats")
def get_supported_formats():
    """获取支持的文件格式列表"""
    return {
        "supported_extensions": list(SUPPORTED_EXTENSIONS),
        "description": "Supported invoice image formats"
    }

@app.post("/directories/{directory_id}/process")
def process_directory(directory_id: int, db: Session = Depends(get_db)):
    directory = db.query(models.ImageDirectory).filter(models.ImageDirectory.id == directory_id).first()
    if not directory:
        raise HTTPException(status_code=404, detail="Directory not found")
    
    crud.process_directory_matching(db, directory_id)
    return {"message": "Processing completed", "directory_id": directory_id}

@app.get("/directories/", response_model=List[schemas.ImageDirectory])
def list_directories(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return db.query(models.ImageDirectory).offset(skip).limit(limit).all()

@app.get("/directories/{directory_id}", response_model=schemas.ImageDirectory)
def get_directory(directory_id: int, db: Session = Depends(get_db)):
    directory = db.query(models.ImageDirectory).filter(models.ImageDirectory.id == directory_id).first()
    if not directory:
        raise HTTPException(status_code=404, detail="Directory not found")
    return directory

@app.get("/directories/{directory_id}/overview", response_model=schemas.DirectoryOverview)
def get_directory_overview(directory_id: int, db: Session = Depends(get_db)):
    overview = crud.get_directory_overview(db, directory_id)
    if not overview:
        raise HTTPException(status_code=404, detail="Directory not found")
    return overview

@app.get("/directories/{directory_id}/invoices", response_model=List[schemas.Invoice])
def list_invoices(directory_id: int, match_status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(models.Invoice).filter(models.Invoice.directory_id == directory_id)
    if match_status:
        query = query.filter(models.Invoice.match_status == match_status)
    return query.all()

@app.get("/directories/{directory_id}/matching-results", response_model=List[schemas.MatchingResult])
def get_matching_results(directory_id: int, db: Session = Depends(get_db)):
    invoices = db.query(models.Invoice).filter(models.Invoice.directory_id == directory_id).all()
    results = []
    for inv in invoices:
        results.append({
            "invoice_id": inv.id,
            "original_filename": inv.original_filename,
            "invoice_code": inv.invoice_code,
            "invoice_number": inv.invoice_number,
            "reimbursement_id": inv.reimbursement_id,
            "amount": inv.amount,
            "match_status": inv.match_status,
            "is_duplicate": inv.is_duplicate,
            "duplicate_with": inv.duplicate_with,
            "missing_fields": get_missing_fields(inv)
        })
    return results

@app.put("/directories/{directory_id}/status", response_model=schemas.ImageDirectory)
def update_directory_status(
    directory_id: int,
    request: schemas.StatusUpdateRequest,
    db: Session = Depends(get_db)
):
    directory = crud.update_directory_status(
        db, directory_id, request.status, request.processed_by, request.note
    )
    if not directory:
        raise HTTPException(status_code=404, detail="Directory not found")
    return directory

@app.post("/invoices/manual-correction", response_model=schemas.Invoice)
def manual_correction(request: schemas.ManualCorrectionRequest, db: Session = Depends(get_db)):
    invoice = crud.manual_correction(db, request)
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return invoice

@app.post("/directories/{directory_id}/withdraw")
def withdraw_directory(
    directory_id: int,
    processed_by: str,
    reason: str,
    db: Session = Depends(get_db)
):
    directory = crud.update_directory_status(
        db, directory_id, "withdrawn", processed_by, reason
    )
    if not directory:
        raise HTTPException(status_code=404, detail="Directory not found")
    
    invoices = db.query(models.Invoice).filter(models.Invoice.directory_id == directory_id).all()
    for inv in invoices:
        inv.status = "withdrawn"
    
    db.commit()
    return {"message": "Directory withdrawn", "directory_id": directory_id}

@app.post("/directories/{directory_id}/close")
def close_directory(
    directory_id: int,
    processed_by: str,
    note: Optional[str] = None,
    db: Session = Depends(get_db)
):
    directory = crud.update_directory_status(
        db, directory_id, "closed", processed_by, note
    )
    if not directory:
        raise HTTPException(status_code=404, detail="Directory not found")
    return {"message": "Directory closed", "directory_id": directory_id}

@app.post("/reports/", response_model=schemas.ArchiveReport)
def generate_archive_report(
    directory_id: int,
    generated_by: Optional[str] = None,
    db: Session = Depends(get_db)
):
    directory = db.query(models.ImageDirectory).filter(models.ImageDirectory.id == directory_id).first()
    if not directory:
        raise HTTPException(status_code=404, detail="Directory not found")
    
    report = crud.create_archive_report(db, directory_id, generated_by)
    return report

@app.get("/reports/{report_id}", response_model=schemas.ArchiveReport)
def get_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(models.ArchiveReport).filter(models.ArchiveReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return report

@app.get("/reports/{report_id}/export")
def export_report(report_id: int, db: Session = Depends(get_db)):
    report = db.query(models.ArchiveReport).filter(models.ArchiveReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    
    content = json.loads(report.report_content)
    return {
        "report_id": report_id,
        "directory_id": report.directory_id,
        "exported_at": report.created_at,
        "content": content
    }

@app.get("/directories/{directory_id}/audit-logs", response_model=List[schemas.AuditLog])
def get_audit_logs(directory_id: int, db: Session = Depends(get_db)):
    return db.query(models.AuditLog).filter(models.AuditLog.directory_id == directory_id).order_by(
        models.AuditLog.created_at.desc()
    ).all()

@app.post("/reimbursements/", response_model=schemas.ReimbursementSheet)
def add_reimbursement_sheet(
    sheet: schemas.ReimbursementSheetCreate,
    db: Session = Depends(get_db)
):
    directory = db.query(models.ImageDirectory).filter(models.ImageDirectory.id == sheet.directory_id).first()
    if not directory:
        raise HTTPException(status_code=404, detail="Directory not found")
    
    return crud.create_reimbursement_sheet(db, sheet)
