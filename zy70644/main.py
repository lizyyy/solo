from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from typing import List, Optional
import json
import pandas as pd
import io
from datetime import datetime

from database import get_db, init_db, Task, RawRecord, CleanedRecord, AuditLog
from schemas import (
    TaskCreate, TaskUpdate, Task as TaskSchema, TaskDetail,
    CleanedRecord as CleanedRecordSchema, CleanedRecordUpdate, CleanedRecordDetail,
    CleaningResult, MergeRequest, AuditLog as AuditLogSchema
)
from cleaning_service import clean_task_data, get_header_mapping, map_headers, init_header_mappings

app = FastAPI(title="报名表清洗监护人字段异常行后端API")


@app.on_event("startup")
def startup_event():
    init_db()
    db = next(get_db())
    init_header_mappings(db)
    db.close()


@app.post("/api/tasks", response_model=TaskSchema)
def create_task(task: TaskCreate, db: Session = Depends(get_db)):
    db_task = Task(
        task_name=task.task_name,
        source_teacher=task.source_teacher,
        remark=task.remark,
        status="created"
    )
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    
    audit_log = AuditLog(
        task_id=db_task.id,
        action="create",
        handler="api",
        conclusion=f"创建任务: {task.task_name}"
    )
    db.add(audit_log)
    db.commit()
    
    return db_task


@app.get("/api/tasks", response_model=List[TaskSchema])
def list_tasks(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(Task)
    if status:
        query = query.filter(Task.status == status)
    return query.order_by(Task.created_at.desc()).all()


@app.get("/api/tasks/{task_id}", response_model=TaskDetail)
def get_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


@app.patch("/api/tasks/{task_id}", response_model=TaskSchema)
def update_task(task_id: int, task_update: TaskUpdate, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    update_data = task_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)
    
    db.commit()
    db.refresh(task)
    
    if task_update.handler:
        audit_log = AuditLog(
            task_id=task_id,
            action="update",
            handler=task_update.handler,
            conclusion=task_update.remark or "更新任务信息"
        )
        db.add(audit_log)
        db.commit()
    
    return task


@app.post("/api/tasks/{task_id}/upload")
def upload_file(task_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    try:
        content = file.file.read()
        
        if file.filename.endswith('.xlsx'):
            df = pd.read_excel(io.BytesIO(content))
        elif file.filename.endswith('.csv'):
            df = pd.read_csv(io.BytesIO(content))
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format")
        
        header_mapping = get_header_mapping(db, task.source_teacher)
        df = map_headers(df, header_mapping)
        
        for idx, row in df.iterrows():
            row_data = row.to_dict()
            for key in row_data:
                if pd.isna(row_data[key]):
                    row_data[key] = ""
                elif isinstance(row_data[key], datetime):
                    row_data[key] = row_data[key].strftime('%Y-%m-%d')
            
            raw_record = RawRecord(
                task_id=task_id,
                row_number=idx + 1,
                original_data=json.dumps(row_data, ensure_ascii=False),
                source_file=file.filename
            )
            db.add(raw_record)
        
        task.status = "uploaded"
        db.commit()
        
        audit_log = AuditLog(
            task_id=task_id,
            action="upload",
            handler="api",
            conclusion=f"上传文件: {file.filename}, 共{len(df)}条记录"
        )
        db.add(audit_log)
        db.commit()
        
        return {
            "task_id": task_id,
            "filename": file.filename,
            "records_count": len(df),
            "columns": list(df.columns)
        }
    
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"File processing error: {str(e)}")


@app.post("/api/tasks/{task_id}/clean", response_model=CleaningResult)
def clean_task(task_id: int, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    try:
        result = clean_task_data(db, task_id)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Cleaning error: {str(e)}")


@app.get("/api/tasks/{task_id}/results", response_model=List[CleanedRecordSchema])
def get_task_results(
    task_id: int,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(CleanedRecord).filter(CleanedRecord.task_id == task_id)
    if status:
        query = query.filter(CleanedRecord.status == status)
    return query.order_by(CleanedRecord.id).all()


@app.get("/api/tasks/{task_id}/exceptions", response_model=List[CleanedRecordSchema])
def get_task_exceptions(task_id: int, db: Session = Depends(get_db)):
    return db.query(CleanedRecord).filter(
        CleanedRecord.task_id == task_id,
        CleanedRecord.status == "exception"
    ).all()


@app.get("/api/tasks/{task_id}/duplicates", response_model=List[CleanedRecordSchema])
def get_task_duplicates(task_id: int, db: Session = Depends(get_db)):
    return db.query(CleanedRecord).filter(
        CleanedRecord.task_id == task_id,
        CleanedRecord.is_duplicate == True
    ).all()


@app.get("/api/records/{record_id}", response_model=CleanedRecordDetail)
def get_record(record_id: int, db: Session = Depends(get_db)):
    record = db.query(CleanedRecord).filter(CleanedRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    return record


@app.patch("/api/records/{record_id}", response_model=CleanedRecordSchema)
def correct_record(
    record_id: int,
    record_update: CleanedRecordUpdate,
    db: Session = Depends(get_db)
):
    record = db.query(CleanedRecord).filter(CleanedRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    
    original_values = {
        "student_name": record.student_name,
        "passport_number": record.passport_number,
        "guardian_phone": record.guardian_phone,
        "diet_restriction": record.diet_restriction
    }
    
    update_data = record_update.dict(exclude_unset=True, exclude={"handler", "conclusion"})
    for field, value in update_data.items():
        setattr(record, field, value)
    
    record.is_manual_corrected = True
    record.last_handler = record_update.handler
    record.last_conclusion = record_update.conclusion
    record.status = "valid"
    record.exception_reason = None
    
    db.commit()
    db.refresh(record)
    
    audit_log = AuditLog(
        cleaned_record_id=record_id,
        task_id=record.task_id,
        action="correct",
        handler=record_update.handler,
        conclusion=record_update.conclusion,
        original_value=json.dumps(original_values, ensure_ascii=False),
        new_value=json.dumps(update_data, ensure_ascii=False)
    )
    db.add(audit_log)
    db.commit()
    
    return record


@app.post("/api/records/merge")
def merge_records(merge_request: MergeRequest, db: Session = Depends(get_db)):
    keep_record = db.query(CleanedRecord).filter(
        CleanedRecord.id == merge_request.keep_record_id
    ).first()
    if not keep_record:
        raise HTTPException(status_code=404, detail="Keep record not found")
    
    merged_count = 0
    for merge_id in merge_request.merge_record_ids:
        merge_record = db.query(CleanedRecord).filter(
            CleanedRecord.id == merge_id
        ).first()
        if merge_record:
            merge_record.status = "merged"
            merge_record.duplicate_with = merge_request.keep_record_id
            merged_count += 1
    
    db.commit()
    
    audit_log = AuditLog(
        task_id=keep_record.task_id,
        action="merge",
        handler=merge_request.handler,
        conclusion=merge_request.conclusion or f"合并{merged_count}条重复记录"
    )
    db.add(audit_log)
    db.commit()
    
    return {
        "keep_record_id": merge_request.keep_record_id,
        "merged_count": merged_count,
        "merged_record_ids": merge_request.merge_record_ids
    }


@app.get("/api/tasks/{task_id}/export")
def export_results(
    task_id: int,
    format: str = "xlsx",
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    query = db.query(CleanedRecord).filter(CleanedRecord.task_id == task_id)
    if status:
        query = query.filter(CleanedRecord.status == status)
    
    records = query.all()
    
    data = []
    for r in records:
        data.append({
            "ID": r.id,
            "学生姓名": r.student_name,
            "护照号": r.passport_number,
            "身份证号": r.id_card_number,
            "性别": r.gender,
            "出生日期": r.birth_date,
            "学校": r.school,
            "年级": r.grade,
            "监护人姓名": r.guardian_name,
            "监护人电话": r.guardian_phone,
            "监护人关系": r.guardian_relation,
            "监护人邮箱": r.guardian_email,
            "饮食禁忌": r.diet_restriction,
            "特殊需求": r.special_needs,
            "状态": r.status,
            "是否重复": "是" if r.is_duplicate else "否",
            "异常原因": r.exception_reason or "",
            "是否人工修正": "是" if r.is_manual_corrected else "否",
            "最后处理人": r.last_handler or "",
            "最后处理结论": r.last_conclusion or ""
        })
    
    df = pd.DataFrame(data)
    
    if format == "xlsx":
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name='清洗结果')
        output.seek(0)
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={"Content-Disposition": f"attachment; filename=task_{task_id}_results.xlsx"}
        )
    else:
        output = io.StringIO()
        df.to_csv(output, index=False, encoding='utf-8-sig')
        output.seek(0)
        return StreamingResponse(
            io.BytesIO(output.getvalue().encode('utf-8-sig')),
            media_type="text/csv",
            headers={"Content-Disposition": f"attachment; filename=task_{task_id}_results.csv"}
        )


@app.post("/api/tasks/{task_id}/review")
def review_task(task_id: int, handler: str, remark: Optional[str] = None, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task.status = "reviewed"
    task.handler = handler
    task.remark = remark
    db.commit()
    
    audit_log = AuditLog(
        task_id=task_id,
        action="review",
        handler=handler,
        conclusion=remark or "审核完成"
    )
    db.add(audit_log)
    db.commit()
    
    return {"task_id": task_id, "status": "reviewed"}


@app.post("/api/tasks/{task_id}/close")
def close_task(task_id: int, handler: str, remark: Optional[str] = None, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task.status = "closed"
    task.handler = handler
    task.remark = remark
    db.commit()
    
    audit_log = AuditLog(
        task_id=task_id,
        action="close",
        handler=handler,
        conclusion=remark or "关闭任务"
    )
    db.add(audit_log)
    db.commit()
    
    return {"task_id": task_id, "status": "closed"}


@app.post("/api/tasks/{task_id}/reopen")
def reopen_task(task_id: int, handler: str, remark: Optional[str] = None, db: Session = Depends(get_db)):
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(status_code=404, detail="Task not found")
    
    task.status = "reviewed"
    task.handler = handler
    db.commit()
    
    audit_log = AuditLog(
        task_id=task_id,
        action="reopen",
        handler=handler,
        conclusion=remark or "重新打开任务"
    )
    db.add(audit_log)
    db.commit()
    
    return {"task_id": task_id, "status": "reviewed"}


@app.get("/api/tasks/{task_id}/audit-logs", response_model=List[AuditLogSchema])
def get_audit_logs(task_id: int, db: Session = Depends(get_db)):
    return db.query(AuditLog).filter(
        AuditLog.task_id == task_id
    ).order_by(AuditLog.created_at.desc()).all()


@app.get("/api/health")
def health_check():
    return {"status": "healthy"}
