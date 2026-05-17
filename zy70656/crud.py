from sqlalchemy.orm import Session
from models import ImageDirectory, Invoice, ReimbursementSheet, ArchiveReport, AuditLog
from schemas import ImageDirectoryCreate, ReimbursementSheetCreate, ManualCorrectionRequest, AuditLogCreate
from utils import parse_filename, detect_duplicates, match_with_reimbursement, generate_archive_report
import json

def create_image_directory(db: Session, directory: ImageDirectoryCreate, processed_by: str = None):
    db_directory = ImageDirectory(
        directory_path=directory.directory_path,
        status="parsing",
        processed_by=processed_by
    )
    db.add(db_directory)
    db.commit()
    db.refresh(db_directory)
    return db_directory

def create_invoice(db: Session, directory_id: int, filename: str, file_path: str):
    parsed = parse_filename(filename)
    db_invoice = Invoice(
        directory_id=directory_id,
        original_filename=filename,
        file_path=file_path,
        invoice_code=parsed.get("invoice_code"),
        invoice_number=parsed.get("invoice_number"),
        reimbursement_id=parsed.get("reimbursement_id"),
        amount=parsed.get("amount")
    )
    db.add(db_invoice)
    db.commit()
    db.refresh(db_invoice)
    return db_invoice

def create_reimbursement_sheet(db: Session, sheet: ReimbursementSheetCreate):
    db_sheet = ReimbursementSheet(
        directory_id=sheet.directory_id,
        reimbursement_id=sheet.reimbursement_id,
        invoice_code=sheet.invoice_code,
        invoice_number=sheet.invoice_number,
        amount=sheet.amount,
        applicant=sheet.applicant,
        department=sheet.department
    )
    db.add(db_sheet)
    db.commit()
    db.refresh(db_sheet)
    return db_sheet

def process_directory_matching(db: Session, directory_id: int):
    invoices = db.query(Invoice).filter(Invoice.directory_id == directory_id).all()
    reimbursements = db.query(ReimbursementSheet).filter(ReimbursementSheet.directory_id == directory_id).all()
    
    duplicates = detect_duplicates(invoices)
    for inv_id, dup_list in duplicates.items():
        invoice = db.query(Invoice).filter(Invoice.id == inv_id).first()
        if invoice:
            invoice.is_duplicate = True
            invoice.duplicate_with = dup_list[0]
            invoice.match_status = "duplicate"
    
    for invoice in invoices:
        if not invoice.is_duplicate:
            match_status, _ = match_with_reimbursement(invoice, reimbursements)
            invoice.match_status = match_status
    
    directory = db.query(ImageDirectory).filter(ImageDirectory.id == directory_id).first()
    if directory:
        directory.status = "processed"
    
    db.commit()

def manual_correction(db: Session, request: ManualCorrectionRequest):
    invoice = db.query(Invoice).filter(Invoice.id == request.invoice_id).first()
    if not invoice:
        return None
    
    original_data = json.dumps({
        "invoice_code": invoice.invoice_code,
        "invoice_number": invoice.invoice_number,
        "reimbursement_id": invoice.reimbursement_id,
        "amount": invoice.amount
    }, ensure_ascii=False)
    
    if request.invoice_code is not None:
        invoice.invoice_code = request.invoice_code
    if request.invoice_number is not None:
        invoice.invoice_number = request.invoice_number
    if request.reimbursement_id is not None:
        invoice.reimbursement_id = request.reimbursement_id
    if request.amount is not None:
        invoice.amount = request.amount
    
    invoice.status = "manual_corrected"
    invoice.match_status = "pending"
    
    create_audit_log(db, AuditLogCreate(
        directory_id=invoice.directory_id,
        invoice_id=invoice.id,
        action="manual_correction",
        original_input=original_data,
        processed_by=request.processed_by,
        conclusion=f"Corrected: {request.reason}"
    ))
    
    db.commit()
    db.refresh(invoice)
    
    reimbursements = db.query(ReimbursementSheet).filter(
        ReimbursementSheet.directory_id == invoice.directory_id
    ).all()
    match_status, _ = match_with_reimbursement(invoice, reimbursements)
    invoice.match_status = match_status
    db.commit()
    
    return invoice

def update_directory_status(db: Session, directory_id: int, status: str, processed_by: str, note: str = None):
    directory = db.query(ImageDirectory).filter(ImageDirectory.id == directory_id).first()
    if not directory:
        return None
    
    original_status = directory.status
    directory.status = status
    directory.processed_by = processed_by
    db.commit()
    db.refresh(directory)
    
    create_audit_log(db, AuditLogCreate(
        directory_id=directory_id,
        action=f"status_update_{status}",
        original_input=f"Original status: {original_status}",
        processed_by=processed_by,
        conclusion=note or f"Status updated to {status}"
    ))
    
    return directory

def create_audit_log(db: Session, log: AuditLogCreate):
    db_log = AuditLog(
        directory_id=log.directory_id,
        invoice_id=log.invoice_id,
        action=log.action,
        original_input=log.original_input,
        processed_by=log.processed_by,
        conclusion=log.conclusion
    )
    db.add(db_log)
    db.commit()
    db.refresh(db_log)
    return db_log

def create_archive_report(db: Session, directory_id: int, generated_by: str = None):
    invoices = db.query(Invoice).filter(Invoice.directory_id == directory_id).all()
    reimbursements = db.query(ReimbursementSheet).filter(ReimbursementSheet.directory_id == directory_id).all()
    
    report_data = generate_archive_report(directory_id, invoices, reimbursements)
    
    db_report = ArchiveReport(
        directory_id=directory_id,
        report_content=report_data["report_content"],
        total_files=report_data["total_files"],
        matched_count=report_data["matched_count"],
        duplicate_count=report_data["duplicate_count"],
        missing_count=report_data["missing_count"],
        status="generated",
        generated_by=generated_by
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)
    
    create_audit_log(db, AuditLogCreate(
        directory_id=directory_id,
        action="generate_report",
        original_input=report_data["report_content"],
        processed_by=generated_by or "system",
        conclusion=f"Archive report generated: {report_data['total_files']} files"
    ))
    
    return db_report

def get_directory_overview(db: Session, directory_id: int):
    directory = db.query(ImageDirectory).filter(ImageDirectory.id == directory_id).first()
    if not directory:
        return None
    
    invoices = db.query(Invoice).filter(Invoice.directory_id == directory_id).all()
    
    return {
        "directory_id": directory.id,
        "directory_path": directory.directory_path,
        "status": directory.status,
        "total_invoices": len(invoices),
        "matched_count": sum(1 for inv in invoices if inv.match_status == "matched"),
        "duplicate_count": sum(1 for inv in invoices if inv.is_duplicate),
        "pending_count": sum(1 for inv in invoices if inv.match_status == "pending"),
        "missing_count": sum(1 for inv in invoices if inv.match_status == "missing_fields")
    }
