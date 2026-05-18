from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel
import pandas as pd
import os
import uuid

from database import get_db, init_db, ClassInfo, Student, SizeRecord, ImportBatch, ExceptionNote, OrderReport
from size_processor import process_import_data, ReportExporter

app = FastAPI(title="校服尺码标准化班级汇总API", version="1.0.0")

UPLOAD_DIR = "uploads"
REPORT_DIR = "reports"
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(REPORT_DIR, exist_ok=True)


@app.on_event("startup")
async def startup_event():
    init_db()


@app.get("/")
async def root():
    return {"message": "校服尺码标准化班级汇总API", "version": "1.0.0"}


@app.post("/api/import", summary="导入校服尺码数据")
async def import_size_data(
    file: UploadFile = File(...),
    created_by: str = "system",
    db: Session = Depends(get_db)
):
    if not file.filename.endswith(('.xlsx', '.xls', '.csv')):
        raise HTTPException(
            status_code=400,
            detail={
                "error_type": "invalid_file_format",
                "message": "只支持 Excel (.xlsx, .xls) 或 CSV 文件"
            }
        )
    
    file_path = os.path.join(UPLOAD_DIR, f"{uuid.uuid4()}_{file.filename}")
    with open(file_path, "wb") as f:
        f.write(await file.read())
    
    try:
        if file.filename.endswith('.csv'):
            df = pd.read_csv(file_path)
        else:
            df = pd.read_excel(file_path)
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(
            status_code=400,
            detail={
                "error_type": "file_read_error",
                "message": f"文件读取失败: {str(e)}"
            }
        )
    
    result = process_import_data(df)
    
    if not result.success:
        os.remove(file_path)
        if result.error_type == "missing_fields":
            raise HTTPException(
                status_code=400,
                detail={
                    "error_type": "missing_fields",
                    "message": result.error_message
                }
            )
        raise HTTPException(
            status_code=500,
            detail={
                "error_type": "processing_error",
                "message": result.error_message
            }
        )
    
    batch = ImportBatch(
        file_name=file.filename,
        status="processed",
        total_records=len(result.data['records']),
        processed_records=len(result.data['records']),
        has_exceptions=len(result.data['exceptions']) > 0,
        created_by=created_by,
        processed_at=datetime.utcnow()
    )
    db.add(batch)
    db.flush()
    
    size_record_ids = {}
    
    for i, record in enumerate(result.data['records']):
        class_obj = db.query(ClassInfo).filter(
            ClassInfo.class_name == record['class_name']
        ).first()
        
        if not class_obj:
            class_obj = ClassInfo(
                grade=record['class_name'][:2] if len(record['class_name']) >= 2 else "未知",
                class_name=record['class_name']
            )
            db.add(class_obj)
            db.flush()
        
        student = db.query(Student).filter(
            Student.name == record['name'],
            Student.class_id == class_obj.id
        ).first()
        
        if not student:
            student = Student(
                class_id=class_obj.id,
                name=record['name'],
                student_no=record.get('student_no', ''),
                gender=record.get('gender', '')
            )
            db.add(student)
            db.flush()
        
        size_record = SizeRecord(
            student_id=student.id,
            import_batch_id=batch.id,
            original_size=record['original_size'],
            standardized_size=record['size'],
            is_duplicate=record.get('is_duplicate', False),
            is_supplement=record.get('is_supplement', False),
            quantity=record.get('quantity', 1)
        )
        db.add(size_record)
        db.flush()
        
        record['id'] = size_record.id
        original_idx = record.get('record_idx', i)
        size_record_ids[original_idx] = size_record.id
    
    for ex in result.data['exceptions']:
        record_idx = ex.get('record_idx', -1)
        size_record_id = size_record_ids.get(record_idx)
        
        exception_note = ExceptionNote(
            size_record_id=size_record_id,
            import_batch_id=batch.id,
            exception_type=ex['type'],
            message=ex['message'],
            student_name=ex.get('name', ''),
            class_name=ex.get('class_name', ''),
            student_no=ex.get('student_no', ''),
            original_size=ex.get('original_size', ''),
            row_number=ex.get('row', 0),
            is_resolved=False
        )
        db.add(exception_note)
    
    db.commit()
    
    return {
        "success": True,
        "batch_id": batch.id,
        "file_name": file.filename,
        "total_records": batch.total_records,
        "exceptions_count": len(result.data['exceptions']),
        "exceptions": result.data['exceptions'],
        "summary": result.data['total_summary']
    }


@app.get("/api/batches", summary="获取导入批次列表")
async def get_batches(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    has_exceptions: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ImportBatch)
    
    if has_exceptions is not None:
        query = query.filter(ImportBatch.has_exceptions == has_exceptions)
    
    total = query.count()
    batches = query.order_by(ImportBatch.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": [
            {
                "id": b.id,
                "file_name": b.file_name,
                "status": b.status,
                "total_records": b.total_records,
                "has_exceptions": b.has_exceptions,
                "created_by": b.created_by,
                "created_at": b.created_at.isoformat() if b.created_at else None
            }
            for b in batches
        ]
    }


@app.get("/api/records", summary="获取尺码记录列表")
async def get_records(
    batch_id: Optional[int] = None,
    class_name: Optional[str] = None,
    size: Optional[str] = None,
    is_duplicate: Optional[bool] = None,
    is_supplement: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    query = db.query(SizeRecord).join(Student).join(ClassInfo)
    
    if batch_id is not None:
        query = query.filter(SizeRecord.import_batch_id == batch_id)
    if class_name:
        query = query.filter(ClassInfo.class_name == class_name)
    if size:
        query = query.filter(SizeRecord.standardized_size == size)
    if is_duplicate is not None:
        query = query.filter(SizeRecord.is_duplicate == is_duplicate)
    if is_supplement is not None:
        query = query.filter(SizeRecord.is_supplement == is_supplement)
    
    total = query.count()
    records = query.order_by(SizeRecord.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": [
            {
                "id": r.id,
                "student_name": r.student.name,
                "class_name": r.student.class_info.class_name,
                "student_no": r.student.student_no,
                "original_size": r.original_size,
                "standardized_size": r.standardized_size,
                "is_duplicate": r.is_duplicate,
                "is_supplement": r.is_supplement,
                "quantity": r.quantity,
                "created_at": r.created_at.isoformat() if r.created_at else None
            }
            for r in records
        ]
    }


@app.get("/api/exceptions", summary="获取异常列表")
async def get_exceptions(
    batch_id: Optional[int] = None,
    exception_type: Optional[str] = None,
    is_resolved: Optional[bool] = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    query = db.query(ExceptionNote)
    
    if batch_id is not None:
        query = query.filter(ExceptionNote.import_batch_id == batch_id)
    if exception_type:
        query = query.filter(ExceptionNote.exception_type == exception_type)
    if is_resolved is not None:
        query = query.filter(ExceptionNote.is_resolved == is_resolved)
    
    total = query.count()
    exceptions = query.order_by(ExceptionNote.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": [
            {
                "id": e.id,
                "size_record_id": e.size_record_id,
                "batch_id": e.import_batch_id,
                "exception_type": e.exception_type,
                "message": e.message,
                "student_name": e.student_name,
                "class_name": e.class_name,
                "student_no": e.student_no,
                "original_size": e.original_size,
                "row_number": e.row_number,
                "is_resolved": e.is_resolved,
                "resolved_by": e.resolved_by,
                "resolved_note": e.resolved_note,
                "resolved_at": e.resolved_at.isoformat() if e.resolved_at else None,
                "created_at": e.created_at.isoformat() if e.created_at else None
            }
            for e in exceptions
        ]
    }


class ResolveExceptionRequest(BaseModel):
    resolved_by: str = "system"
    resolved_note: Optional[str] = None


@app.put("/api/exceptions/{exception_id}/resolve", summary="标记异常为已解决并记录处理备注")
async def resolve_exception(
    exception_id: int,
    request: ResolveExceptionRequest,
    db: Session = Depends(get_db)
):
    exception = db.query(ExceptionNote).filter(ExceptionNote.id == exception_id).first()
    
    if not exception:
        raise HTTPException(
            status_code=404,
            detail={
                "error_type": "not_found",
                "message": "异常记录不存在"
            }
        )
    
    if exception.is_resolved:
        raise HTTPException(
            status_code=409,
            detail={
                "error_type": "already_resolved",
                "message": "该异常已经处理过"
            }
        )
    
    exception.is_resolved = True
    exception.resolved_by = request.resolved_by
    exception.resolved_note = request.resolved_note
    exception.resolved_at = datetime.utcnow()
    db.commit()
    
    return {
        "success": True,
        "message": "异常已标记为已解决",
        "data": {
            "id": exception.id,
            "is_resolved": True,
            "resolved_by": exception.resolved_by,
            "resolved_note": exception.resolved_note,
            "resolved_at": exception.resolved_at.isoformat() if exception.resolved_at else None
        }
    }


@app.get("/api/summary", summary="按班级汇总尺码数据")
async def get_summary(
    batch_id: Optional[int] = None,
    db: Session = Depends(get_db)
):
    query = db.query(SizeRecord).join(Student).join(ClassInfo)
    
    if batch_id is not None:
        query = query.filter(SizeRecord.import_batch_id == batch_id)
    
    records = query.all()
    
    summary_data = {}
    for r in records:
        class_name = r.student.class_info.class_name
        size = r.standardized_size
        qty = r.quantity
        
        if class_name not in summary_data:
            summary_data[class_name] = {}
        if size not in summary_data[class_name]:
            summary_data[class_name][size] = 0
        summary_data[class_name][size] += qty
    
    total_summary = {}
    for class_sizes in summary_data.values():
        for size, count in class_sizes.items():
            if size not in total_summary:
                total_summary[size] = 0
            total_summary[size] += count
    
    return {
        "by_class": summary_data,
        "total": total_summary
    }


@app.post("/api/export", summary="导出订购报告")
async def export_report(
    batch_id: Optional[int] = None,
    generated_by: str = "system",
    db: Session = Depends(get_db)
):
    query = db.query(SizeRecord).join(Student).join(ClassInfo)
    
    if batch_id is not None:
        query = query.filter(SizeRecord.import_batch_id == batch_id)
        batch = db.query(ImportBatch).filter(ImportBatch.id == batch_id).first()
        if not batch:
            raise HTTPException(
                status_code=404,
                detail={
                    "error_type": "not_found",
                    "message": "批次不存在"
                }
            )
        if batch.status != "processed":
            raise HTTPException(
                status_code=409,
                detail={
                    "error_type": "invalid_status",
                    "message": "当前批次状态不允许导出"
                }
            )
    
    records = query.all()
    
    if not records:
        raise HTTPException(
            status_code=400,
            detail={
                "error_type": "no_data",
                "message": "没有可导出的数据"
            }
        )
    
    exceptions_query = db.query(ExceptionNote)
    if batch_id is not None:
        exceptions_query = exceptions_query.filter(ExceptionNote.import_batch_id == batch_id)
    exceptions = exceptions_query.all()
    
    export_data = []
    summary = {}
    exceptions_data = []
    
    for r in records:
        export_data.append({
            "班级": r.student.class_info.class_name,
            "姓名": r.student.name,
            "学号": r.student.student_no,
            "原尺码": r.original_size,
            "标准尺码": r.standardized_size,
            "数量": r.quantity,
            "是否重复": "是" if r.is_duplicate else "否",
            "是否补订": "是" if r.is_supplement else "否",
        })
        
        class_name = r.student.class_info.class_name
        size = r.standardized_size
        if class_name not in summary:
            summary[class_name] = {}
        if size not in summary[class_name]:
            summary[class_name][size] = 0
        summary[class_name][size] += r.quantity
    
    for e in exceptions:
        exceptions_data.append({
            "行号": e.row_number,
            "班级": e.class_name,
            "姓名": e.student_name,
            "学号": e.student_no,
            "原尺码": e.original_size,
            "异常类型": e.exception_type,
            "异常描述": e.message,
            "是否已解决": "是" if e.is_resolved else "否",
            "处理人": e.resolved_by,
            "处理备注": e.resolved_note
        })
    
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    report_filename = f"校服订购报告_{timestamp}.xlsx"
    report_path = os.path.join(REPORT_DIR, report_filename)
    
    success = ReportExporter.export_to_excel(export_data, summary, report_path, exceptions_data if exceptions_data else None)
    
    if not success:
        raise HTTPException(
            status_code=500,
            detail={
                "error_type": "export_failed",
                "message": "报告导出失败"
            }
        )
    
    report = OrderReport(
        report_type="class_summary",
        file_name=report_filename,
        file_path=report_path,
        generated_by=generated_by,
        total_students=len(set(r.student_id for r in records)),
        total_quantity=sum(r.quantity for r in records)
    )
    db.add(report)
    db.commit()
    
    return {
        "success": True,
        "report_id": report.id,
        "file_name": report_filename,
        "total_students": report.total_students,
        "total_quantity": report.total_quantity,
        "has_exceptions": len(exceptions_data) > 0
    }


@app.get("/api/reports/{report_id}/download", summary="下载订购报告")
async def download_report(
    report_id: int,
    db: Session = Depends(get_db)
):
    report = db.query(OrderReport).filter(OrderReport.id == report_id).first()
    
    if not report:
        raise HTTPException(
            status_code=404,
            detail={
                "error_type": "not_found",
                "message": "报告不存在"
            }
        )
    
    if not os.path.exists(report.file_path):
        raise HTTPException(
            status_code=404,
            detail={
                "error_type": "file_not_found",
                "message": "报告文件已被删除"
            }
        )
    
    return FileResponse(
        path=report.file_path,
        filename=report.file_name,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )


@app.get("/api/reports", summary="获取报告列表")
async def get_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db)
):
    total = db.query(OrderReport).count()
    reports = db.query(OrderReport).order_by(OrderReport.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "data": [
            {
                "id": r.id,
                "file_name": r.file_name,
                "total_students": r.total_students,
                "total_quantity": r.total_quantity,
                "generated_by": r.generated_by,
                "created_at": r.created_at.isoformat() if r.created_at else None
            }
            for r in reports
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
