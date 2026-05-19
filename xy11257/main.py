from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import uuid
import json
import csv
import io
from database import (
    get_db, init_db, HiddenDanger, Photo, Person, Assignment,
    Rectification, RectificationPhoto, Review, Archive, ImportError, OperationLog
)

app = FastAPI(title="安全巡检闭环管理系统")

@app.on_event("startup")
async def startup_event():
    init_db()

def generate_id():
    return str(uuid.uuid4())

def log_operation(db: Session, op_type: str, danger_id: str, operator: str,
                  details: str, old_status: str, new_status: str):
    log = OperationLog(
        id=generate_id(),
        operation_type=op_type,
        danger_id=danger_id,
        operator=operator,
        details=details,
        old_status=old_status,
        new_status=new_status
    )
    db.add(log)
    db.commit()

def save_import_error(db: Session, import_type: str, source_file: str,
                      row_num: int, original_data: str, error_msg: str, suggestion: str):
    err = ImportError(
        id=generate_id(),
        import_type=import_type,
        source_file=source_file,
        row_number=row_num,
        original_data=original_data,
        error_message=error_msg,
        suggestion=suggestion
    )
    db.add(err)
    db.commit()

class DangerCreate(BaseModel):
    danger_no: str
    title: str
    description: Optional[str] = None
    location: Optional[str] = None
    level: Optional[str] = None
    inspector: Optional[str] = None
    inspection_date: Optional[datetime] = None

class PersonCreate(BaseModel):
    name: str
    department: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = None

class AssignmentCreate(BaseModel):
    danger_no: str
    assignee_name: str
    deadline: datetime
    requirements: Optional[str] = None
    assigned_by: Optional[str] = None

class RectificationCreate(BaseModel):
    danger_no: str
    rectification_date: datetime
    measures: str
    result: str
    completed_by: str

class ReviewCreate(BaseModel):
    danger_no: str
    reviewer_name: str
    review_date: datetime
    result: str
    comments: Optional[str] = None

class ArchiveCreate(BaseModel):
    danger_no: str
    archived_by: str
    archive_reason: Optional[str] = None

@app.post("/api/dangers/register", summary="登记隐患")
def register_danger(data: DangerCreate, db: Session = Depends(get_db)):
    existing = db.query(HiddenDanger).filter(HiddenDanger.danger_no == data.danger_no).first()
    if existing:
        return {
            "success": True,
            "message": "隐患已存在，跳过创建",
            "data": {"id": existing.id, "danger_no": existing.danger_no, "status": existing.status}
        }
    
    danger = HiddenDanger(
        id=generate_id(),
        danger_no=data.danger_no,
        title=data.title,
        description=data.description,
        location=data.location,
        level=data.level,
        inspector=data.inspector,
        inspection_date=data.inspection_date,
        status="registered"
    )
    db.add(danger)
    db.commit()
    db.refresh(danger)
    
    log_operation(db, "register", danger.id, data.inspector or "system",
                  f"登记隐患: {data.title}", None, "registered")
    
    return {
        "success": True,
        "message": "隐患登记成功",
        "data": {"id": danger.id, "danger_no": danger.danger_no, "status": danger.status}
    }

@app.post("/api/persons", summary="创建责任人")
def create_person(data: PersonCreate, db: Session = Depends(get_db)):
    existing = db.query(Person).filter(Person.name == data.name).first()
    if existing:
        return {
            "success": True,
            "message": "责任人已存在",
            "data": {"id": existing.id, "name": existing.name}
        }
    
    person = Person(
        id=generate_id(),
        name=data.name,
        department=data.department,
        phone=data.phone,
        role=data.role
    )
    db.add(person)
    db.commit()
    db.refresh(person)
    
    return {
        "success": True,
        "message": "责任人创建成功",
        "data": {"id": person.id, "name": person.name}
    }

@app.post("/api/dangers/assign", summary="派发整改任务")
def assign_danger(data: AssignmentCreate, db: Session = Depends(get_db)):
    danger = db.query(HiddenDanger).filter(HiddenDanger.danger_no == data.danger_no).first()
    if not danger:
        raise HTTPException(status_code=404, detail="隐患不存在")
    
    if danger.status in ["rectifying", "reviewing", "archived", "closed"]:
        return {
            "success": True,
            "message": f"隐患当前状态为{danger.status}，无需重复派发",
            "data": {"danger_no": danger.danger_no, "status": danger.status}
        }
    
    assignee = db.query(Person).filter(Person.name == data.assignee_name).first()
    if not assignee:
        assignee = Person(id=generate_id(), name=data.assignee_name)
        db.add(assignee)
        db.commit()
        db.refresh(assignee)
    
    existing_assign = db.query(Assignment).filter(
        Assignment.danger_id == danger.id,
        Assignment.assignee_id == assignee.id
    ).first()
    if existing_assign:
        return {
            "success": True,
            "message": "该整改任务已派发过",
            "data": {"danger_no": danger.danger_no, "assignee": data.assignee_name}
        }
    
    assignment = Assignment(
        id=generate_id(),
        danger_id=danger.id,
        assignee_id=assignee.id,
        deadline=data.deadline,
        requirements=data.requirements,
        assigned_by=data.assigned_by
    )
    db.add(assignment)
    
    old_status = danger.status
    danger.status = "rectifying"
    db.commit()
    
    log_operation(db, "assign", danger.id, data.assigned_by or "system",
                  f"派发给 {data.assignee_name}，截止日期 {data.deadline}", old_status, "rectifying")
    
    return {
        "success": True,
        "message": "整改任务派发成功",
        "data": {"danger_no": danger.danger_no, "assignee": data.assignee_name, "status": danger.status}
    }

@app.post("/api/dangers/rectify", summary="提交整改结果")
def rectify_danger(data: RectificationCreate, db: Session = Depends(get_db)):
    danger = db.query(HiddenDanger).filter(HiddenDanger.danger_no == data.danger_no).first()
    if not danger:
        raise HTTPException(status_code=404, detail="隐患不存在")
    
    if danger.status in ["reviewing", "archived", "closed"]:
        return {
            "success": True,
            "message": f"隐患当前状态为{danger.status}，无需重复整改",
            "data": {"danger_no": danger.danger_no, "status": danger.status}
        }
    
    existing_rect = db.query(Rectification).filter(
        Rectification.danger_id == danger.id,
        Rectification.completed_by == data.completed_by
    ).first()
    if existing_rect:
        return {
            "success": True,
            "message": "整改结果已提交过",
            "data": {"danger_no": danger.danger_no}
        }
    
    rectification = Rectification(
        id=generate_id(),
        danger_id=danger.id,
        rectification_date=data.rectification_date,
        measures=data.measures,
        result=data.result,
        completed_by=data.completed_by
    )
    db.add(rectification)
    
    old_status = danger.status
    danger.status = "reviewing"
    db.commit()
    
    log_operation(db, "rectify", danger.id, data.completed_by,
                  f"整改措施: {data.measures[:50]}...", old_status, "reviewing")
    
    return {
        "success": True,
        "message": "整改结果提交成功",
        "data": {"danger_no": danger.danger_no, "status": danger.status}
    }

@app.post("/api/dangers/review", summary="复查整改结果")
def review_danger(data: ReviewCreate, db: Session = Depends(get_db)):
    danger = db.query(HiddenDanger).filter(HiddenDanger.danger_no == data.danger_no).first()
    if not danger:
        raise HTTPException(status_code=404, detail="隐患不存在")
    
    if danger.status in ["archived", "closed"]:
        return {
            "success": True,
            "message": f"隐患当前状态为{danger.status}，无需重复复查",
            "data": {"danger_no": danger.danger_no, "status": danger.status}
        }
    
    reviewer = db.query(Person).filter(Person.name == data.reviewer_name).first()
    if not reviewer:
        reviewer = Person(id=generate_id(), name=data.reviewer_name)
        db.add(reviewer)
        db.commit()
        db.refresh(reviewer)
    
    existing_review = db.query(Review).filter(
        Review.danger_id == danger.id,
        Review.reviewer_id == reviewer.id
    ).first()
    if existing_review:
        return {
            "success": True,
            "message": "复查结果已提交过",
            "data": {"danger_no": danger.danger_no, "result": existing_review.result}
        }
    
    review = Review(
        id=generate_id(),
        danger_id=danger.id,
        reviewer_id=reviewer.id,
        review_date=data.review_date,
        result=data.result,
        comments=data.comments
    )
    db.add(review)
    
    old_status = danger.status
    if data.result == "合格":
        danger.status = "closed"
    else:
        danger.status = "rectifying"
    db.commit()
    
    log_operation(db, "review", danger.id, data.reviewer_name,
                  f"复查结果: {data.result}", old_status, danger.status)
    
    return {
        "success": True,
        "message": "复查完成",
        "data": {"danger_no": danger.danger_no, "result": data.result, "status": danger.status}
    }

@app.post("/api/dangers/archive", summary="归档隐患记录")
def archive_danger(data: ArchiveCreate, db: Session = Depends(get_db)):
    danger = db.query(HiddenDanger).filter(HiddenDanger.danger_no == data.danger_no).first()
    if not danger:
        raise HTTPException(status_code=404, detail="隐患不存在")
    
    if danger.status == "archived":
        return {
            "success": True,
            "message": "隐患已归档",
            "data": {"danger_no": danger.danger_no, "status": danger.status}
        }
    
    existing_archive = db.query(Archive).filter(Archive.danger_id == danger.id).first()
    if existing_archive:
        return {
            "success": True,
            "message": "归档记录已存在",
            "data": {"danger_no": danger.danger_no}
        }
    
    archive = Archive(
        id=generate_id(),
        danger_id=danger.id,
        archived_by=data.archived_by,
        archive_reason=data.archive_reason
    )
    db.add(archive)
    
    old_status = danger.status
    danger.status = "archived"
    db.commit()
    
    log_operation(db, "archive", danger.id, data.archived_by,
                  f"归档原因: {data.archive_reason}", old_status, "archived")
    
    return {
        "success": True,
        "message": "归档成功",
        "data": {"danger_no": danger.danger_no, "status": danger.status}
    }

@app.get("/api/dangers", summary="查询隐患列表")
def list_dangers(status: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(HiddenDanger)
    if status:
        query = query.filter(HiddenDanger.status == status)
    dangers = query.all()
    
    result = []
    for d in dangers:
        result.append({
            "id": d.id,
            "danger_no": d.danger_no,
            "title": d.title,
            "location": d.location,
            "level": d.level,
            "status": d.status,
            "inspector": d.inspector
        })
    
    return {"success": True, "data": result}

@app.get("/api/dangers/{danger_no}", summary="查询隐患详情")
def get_danger_detail(danger_no: str, db: Session = Depends(get_db)):
    danger = db.query(HiddenDanger).filter(HiddenDanger.danger_no == danger_no).first()
    if not danger:
        raise HTTPException(status_code=404, detail="隐患不存在")
    
    assignments = db.query(Assignment).filter(Assignment.danger_id == danger.id).all()
    rectifications = db.query(Rectification).filter(Rectification.danger_id == danger.id).all()
    reviews = db.query(Review).filter(Review.danger_id == danger.id).all()
    archives = db.query(Archive).filter(Archive.danger_id == danger.id).all()
    logs = db.query(OperationLog).filter(OperationLog.danger_id == danger.id).order_by(OperationLog.created_at).all()
    
    return {
        "success": True,
        "data": {
            "danger": {
                "danger_no": danger.danger_no,
                "title": danger.title,
                "description": danger.description,
                "location": danger.location,
                "level": danger.level,
                "status": danger.status,
                "inspector": danger.inspector
            },
            "assignments": [{"assignee": a.assignee.name, "deadline": a.deadline, "requirements": a.requirements} for a in assignments],
            "rectifications": [{"date": r.rectification_date, "measures": r.measures, "result": r.result} for r in rectifications],
            "reviews": [{"reviewer": r.reviewer.name, "date": r.review_date, "result": r.result, "comments": r.comments} for r in reviews],
            "archives": [{"archived_by": a.archived_by, "reason": a.archive_reason, "time": a.archived_at} for a in archives],
            "operation_logs": [{"type": l.operation_type, "operator": l.operator, "details": l.details, "time": l.created_at} for l in logs]
        }
    }

@app.get("/api/import-errors", summary="查询导入错误记录")
def list_import_errors(import_type: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(ImportError)
    if import_type:
        query = query.filter(ImportError.import_type == import_type)
    errors = query.order_by(ImportError.created_at.desc()).all()
    
    result = []
    for e in errors:
        result.append({
            "id": e.id,
            "import_type": e.import_type,
            "source_file": e.source_file,
            "row_number": e.row_number,
            "original_data": e.original_data,
            "error_message": e.error_message,
            "suggestion": e.suggestion,
            "created_at": e.created_at
        })
    
    return {"success": True, "data": result}

@app.post("/api/import/dangers-csv", summary="导入隐患CSV")
async def import_dangers_csv(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    csv_content = content.decode('utf-8')
    
    success_count = 0
    error_count = 0
    row_num = 0
    
    try:
        reader = csv.DictReader(io.StringIO(csv_content))
        for row in reader:
            row_num += 1
            try:
                danger_no = row.get('隐患编号', '').strip()
                title = row.get('标题', '').strip()
                
                if not danger_no or not title:
                    save_import_error(db, "dangers_csv", file.filename, row_num,
                                    str(row), "缺少必填字段: 隐患编号或标题",
                                    "请检查CSV列名是否包含'隐患编号'和'标题'")
                    error_count += 1
                    continue
                
                existing = db.query(HiddenDanger).filter(HiddenDanger.danger_no == danger_no).first()
                if existing:
                    success_count += 1
                    continue
                
                danger = HiddenDanger(
                    id=generate_id(),
                    danger_no=danger_no,
                    title=title,
                    description=row.get('描述', ''),
                    location=row.get('位置', ''),
                    level=row.get('等级', ''),
                    inspector=row.get('检查人', ''),
                    inspection_date=datetime.now()
                )
                db.add(danger)
                success_count += 1
                
            except Exception as e:
                save_import_error(db, "dangers_csv", file.filename, row_num,
                                str(row), str(e), "请检查数据格式是否正确")
                error_count += 1
        
        db.commit()
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"CSV解析失败: {str(e)}")
    
    return {
        "success": True,
        "message": "导入完成",
        "data": {
            "success_count": success_count,
            "error_count": error_count,
            "total_rows": row_num
        }
    }

@app.post("/api/import/photos-json", summary="导入照片索引JSON")
async def import_photos_json(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    
    success_count = 0
    error_count = 0
    
    try:
        data = json.loads(content)
        if not isinstance(data, list):
            raise ValueError("JSON格式错误，应为数组")
        
        for idx, item in enumerate(data):
            try:
                danger_no = item.get('danger_no', '').strip()
                photo_path = item.get('photo_path', '').strip()
                
                if not danger_no or not photo_path:
                    save_import_error(db, "photos_json", file.filename, idx + 1,
                                    json.dumps(item, ensure_ascii=False),
                                    "缺少必填字段: danger_no或photo_path",
                                    "请检查每个对象是否包含danger_no和photo_path字段")
                    error_count += 1
                    continue
                
                danger = db.query(HiddenDanger).filter(HiddenDanger.danger_no == danger_no).first()
                if not danger:
                    save_import_error(db, "photos_json", file.filename, idx + 1,
                                    json.dumps(item, ensure_ascii=False),
                                    f"隐患不存在: {danger_no}",
                                    "请先导入对应的隐患记录")
                    error_count += 1
                    continue
                
                existing = db.query(Photo).filter(
                    Photo.danger_id == danger.id,
                    Photo.photo_path == photo_path
                ).first()
                if existing:
                    success_count += 1
                    continue
                
                photo = Photo(
                    id=generate_id(),
                    danger_id=danger.id,
                    photo_path=photo_path,
                    photo_type=item.get('photo_type', ''),
                    description=item.get('description', '')
                )
                db.add(photo)
                success_count += 1
                
            except Exception as e:
                save_import_error(db, "photos_json", file.filename, idx + 1,
                                json.dumps(item, ensure_ascii=False), str(e),
                                "请检查数据格式是否正确")
                error_count += 1
        
        db.commit()
        
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"JSON解析失败: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")
    
    return {
        "success": True,
        "message": "导入完成",
        "data": {
            "success_count": success_count,
            "error_count": error_count
        }
    }

@app.post("/api/import/reviews-json", summary="导入复查记录JSON")
async def import_reviews_json(file: UploadFile = File(...), db: Session = Depends(get_db)):
    content = await file.read()
    
    success_count = 0
    error_count = 0
    
    try:
        data = json.loads(content)
        if not isinstance(data, list):
            raise ValueError("JSON格式错误，应为数组")
        
        for idx, item in enumerate(data):
            try:
                danger_no = item.get('danger_no', '').strip()
                reviewer_name = item.get('reviewer_name', '').strip()
                result = item.get('result', '').strip()
                
                if not danger_no or not reviewer_name or not result:
                    save_import_error(db, "reviews_json", file.filename, idx + 1,
                                    json.dumps(item, ensure_ascii=False),
                                    "缺少必填字段: danger_no、reviewer_name或result",
                                    "请检查每个对象是否包含必填字段")
                    error_count += 1
                    continue
                
                danger = db.query(HiddenDanger).filter(HiddenDanger.danger_no == danger_no).first()
                if not danger:
                    save_import_error(db, "reviews_json", file.filename, idx + 1,
                                    json.dumps(item, ensure_ascii=False),
                                    f"隐患不存在: {danger_no}",
                                    "请先导入对应的隐患记录")
                    error_count += 1
                    continue
                
                reviewer = db.query(Person).filter(Person.name == reviewer_name).first()
                if not reviewer:
                    reviewer = Person(id=generate_id(), name=reviewer_name)
                    db.add(reviewer)
                    db.commit()
                    db.refresh(reviewer)
                
                existing = db.query(Review).filter(
                    Review.danger_id == danger.id,
                    Review.reviewer_id == reviewer.id
                ).first()
                if existing:
                    success_count += 1
                    continue
                
                review = Review(
                    id=generate_id(),
                    danger_id=danger.id,
                    reviewer_id=reviewer.id,
                    review_date=datetime.now(),
                    result=result,
                    comments=item.get('comments', '')
                )
                db.add(review)
                
                if result == "合格":
                    danger.status = "closed"
                else:
                    danger.status = "rectifying"
                
                success_count += 1
                
            except Exception as e:
                save_import_error(db, "reviews_json", file.filename, idx + 1,
                                json.dumps(item, ensure_ascii=False), str(e),
                                "请检查数据格式是否正确")
                error_count += 1
        
        db.commit()
        
    except json.JSONDecodeError as e:
        raise HTTPException(status_code=400, detail=f"JSON解析失败: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导入失败: {str(e)}")
    
    return {
        "success": True,
        "message": "导入完成",
        "data": {
            "success_count": success_count,
            "error_count": error_count
        }
    }

@app.get("/api/operation-logs", summary="查询操作日志")
def list_operation_logs(danger_no: Optional[str] = None, db: Session = Depends(get_db)):
    query = db.query(OperationLog)
    if danger_no:
        danger = db.query(HiddenDanger).filter(HiddenDanger.danger_no == danger_no).first()
        if danger:
            query = query.filter(OperationLog.danger_id == danger.id)
    
    logs = query.order_by(OperationLog.created_at.desc()).all()
    
    result = []
    for l in logs:
        result.append({
            "id": l.id,
            "operation_type": l.operation_type,
            "danger_id": l.danger_id,
            "operator": l.operator,
            "details": l.details,
            "old_status": l.old_status,
            "new_status": l.new_status,
            "created_at": l.created_at
        })
    
    return {"success": True, "data": result}

@app.get("/api/stats", summary="统计概览")
def get_stats(db: Session = Depends(get_db)):
    total = db.query(HiddenDanger).count()
    registered = db.query(HiddenDanger).filter(HiddenDanger.status == "registered").count()
    rectifying = db.query(HiddenDanger).filter(HiddenDanger.status == "rectifying").count()
    reviewing = db.query(HiddenDanger).filter(HiddenDanger.status == "reviewing").count()
    closed = db.query(HiddenDanger).filter(HiddenDanger.status == "closed").count()
    archived = db.query(HiddenDanger).filter(HiddenDanger.status == "archived").count()
    import_errors = db.query(ImportError).count()
    
    return {
        "success": True,
        "data": {
            "total": total,
            "status_distribution": {
                "registered": registered,
                "rectifying": rectifying,
                "reviewing": reviewing,
                "closed": closed,
                "archived": archived
            },
            "import_errors": import_errors
        }
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
