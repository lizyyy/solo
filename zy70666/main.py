from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.responses import FileResponse
from pydantic import BaseModel
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, ForeignKey, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os
import re
import shutil
import pandas as pd
from typing import Optional, List
from enum import Enum

DATABASE_URL = "sqlite:///./homework.db"
UPLOAD_DIR = "./uploads"
REPORT_DIR = "./reports"
SUBMISSION_DIR = "./submissions"

for dir_path in [UPLOAD_DIR, REPORT_DIR, SUBMISSION_DIR]:
    os.makedirs(dir_path, exist_ok=True)

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class ErrorCode(str, Enum):
    MISSING_FIELD = "missing_field"
    INVALID_STATE = "invalid_state"
    NEEDS_MANUAL_REVIEW = "needs_manual_review"
    ALREADY_PROCESSED = "already_processed"

class Student(Base):
    __tablename__ = "students"
    id = Column(Integer, primary_key=True, index=True)
    student_id = Column(String, unique=True, index=True)
    name = Column(String)
    class_name = Column(String)
    email = Column(String, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

class Assignment(Base):
    __tablename__ = "assignments"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String)
    deadline = Column(DateTime)
    allowed_file_types = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    submissions = relationship("Submission", back_populates="assignment")

class SubmissionStatus(str, Enum):
    NOT_SUBMITTED = "not_submitted"
    SUBMITTED = "submitted"
    LATE_SUBMITTED = "late_submitted"
    RESUBMITTED = "resubmitted"

class Submission(Base):
    __tablename__ = "submissions"
    id = Column(Integer, primary_key=True, index=True)
    assignment_id = Column(Integer, ForeignKey("assignments.id"))
    student_id = Column(String, index=True)
    file_name = Column(String)
    file_path = Column(String)
    file_type = Column(String)
    submitted_at = Column(DateTime, default=datetime.utcnow)
    status = Column(String, default=SubmissionStatus.SUBMITTED)
    is_late = Column(Boolean, default=False)
    resubmit_count = Column(Integer, default=0)
    needs_review = Column(Boolean, default=False)
    review_note = Column(Text, nullable=True)
    processed = Column(Boolean, default=False)
    assignment = relationship("Assignment", back_populates="submissions")

Base.metadata.create_all(bind=engine)

app = FastAPI(title="作业收齐补交系统API")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def parse_student_id_from_filename(filename: str) -> Optional[str]:
    patterns = [
        r'(\d{8,12})',
        r'学号[_\-]?(\d{8,12})',
        r'ID[_\-]?(\d{8,12})',
        r'^(\d{8,12})[_\-]',
        r'[_\-](\d{8,12})[_\-.]'
    ]
    for pattern in patterns:
        match = re.search(pattern, filename, re.IGNORECASE)
        if match:
            return match.group(1)
    return None

def validate_file_type(filename: str, allowed_types: str) -> bool:
    if not allowed_types or allowed_types == "*":
        return True
    ext = os.path.splitext(filename)[1].lower()
    allowed = [t.strip().lower() for t in allowed_types.split(",")]
    return ext in allowed or f".{ext}" in allowed

class StudentImportRequest(BaseModel):
    students: List[dict]

class AssignmentCreateRequest(BaseModel):
    name: str
    deadline: datetime
    allowed_file_types: str = "*"

class SubmissionResponse(BaseModel):
    id: int
    student_id: str
    file_name: str
    status: str
    submitted_at: datetime
    is_late: bool
    resubmit_count: int
    needs_review: bool
    review_note: Optional[str]

@app.post("/api/students/import")
def import_students(request: StudentImportRequest):
    db = next(get_db())
    try:
        imported_count = 0
        skipped_count = 0
        errors = []
        for idx, student_data in enumerate(request.students):
            if "student_id" not in student_data or "name" not in student_data:
                errors.append({"row": idx, "code": ErrorCode.MISSING_FIELD, "message": "缺少学号或姓名"})
                continue
            existing = db.query(Student).filter(Student.student_id == student_data["student_id"]).first()
            if existing:
                existing.name = student_data.get("name", existing.name)
                existing.class_name = student_data.get("class_name", existing.class_name)
                existing.email = student_data.get("email", existing.email)
                skipped_count += 1
            else:
                student = Student(
                    student_id=student_data["student_id"],
                    name=student_data.get("name"),
                    class_name=student_data.get("class_name", ""),
                    email=student_data.get("email")
                )
                db.add(student)
                imported_count += 1
        db.commit()
        return {"success": True, "imported": imported_count, "skipped": skipped_count, "errors": errors}
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/students")
def list_students(class_name: Optional[str] = None):
    db = next(get_db())
    query = db.query(Student).filter(Student.is_active == True)
    if class_name:
        query = query.filter(Student.class_name == class_name)
    students = query.all()
    return {"students": [{"id": s.id, "student_id": s.student_id, "name": s.name, "class_name": s.class_name, "email": s.email} for s in students]}

@app.post("/api/assignments")
def create_assignment(request: AssignmentCreateRequest):
    db = next(get_db())
    assignment = Assignment(
        name=request.name,
        deadline=request.deadline,
        allowed_file_types=request.allowed_file_types
    )
    db.add(assignment)
    db.commit()
    db.refresh(assignment)
    return {"id": assignment.id, "name": assignment.name, "deadline": assignment.deadline, "allowed_file_types": assignment.allowed_file_types}

@app.get("/api/assignments")
def list_assignments():
    db = next(get_db())
    assignments = db.query(Assignment).all()
    return {"assignments": [{"id": a.id, "name": a.name, "deadline": a.deadline} for a in assignments]}

@app.post("/api/assignments/{assignment_id}/scan-directory")
def scan_assignment_directory(assignment_id: int, directory_path: str):
    db = next(get_db())
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="作业不存在")
    if not os.path.exists(directory_path):
        raise HTTPException(status_code=400, detail="目录不存在")
    results = []
    for filename in os.listdir(directory_path):
        file_path = os.path.join(directory_path, filename)
        if os.path.isfile(file_path):
            student_id = parse_student_id_from_filename(filename)
            file_type = os.path.splitext(filename)[1]
            is_valid_type = validate_file_type(filename, assignment.allowed_file_types)
            results.append({
                "filename": filename,
                "parsed_student_id": student_id,
                "file_type": file_type,
                "is_valid_type": is_valid_type,
                "needs_review": not student_id or not is_valid_type
            })
    return {"total_files": len(results), "files": results}

@app.post("/api/assignments/{assignment_id}/process-file")
def process_submission_file(assignment_id: int, file: UploadFile = File(...)):
    db = next(get_db())
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="作业不存在")
    student_id = parse_student_id_from_filename(file.filename)
    if not student_id:
        raise HTTPException(status_code=400, detail={
            "code": ErrorCode.NEEDS_MANUAL_REVIEW,
            "message": "无法从文件名解析学号，需要人工复核",
            "filename": file.filename
        })
    student = db.query(Student).filter(Student.student_id == student_id).first()
    if not student:
        raise HTTPException(status_code=400, detail={
            "code": ErrorCode.NEEDS_MANUAL_REVIEW,
            "message": "学号不在学生名单中，需要人工复核",
            "student_id": student_id,
            "filename": file.filename
        })
    if not validate_file_type(file.filename, assignment.allowed_file_types):
        raise HTTPException(status_code=400, detail={
            "code": ErrorCode.NEEDS_MANUAL_REVIEW,
            "message": "文件类型不允许",
            "filename": file.filename,
            "allowed_types": assignment.allowed_file_types
        })
    is_late = datetime.utcnow() > assignment.deadline
    existing = db.query(Submission).filter(
        Submission.assignment_id == assignment_id,
        Submission.student_id == student_id
    ).first()
    file_ext = os.path.splitext(file.filename)[1]
    saved_filename = f"{student_id}_{assignment_id}_{int(datetime.utcnow().timestamp())}{file_ext}"
    saved_path = os.path.join(SUBMISSION_DIR, saved_filename)
    with open(saved_path, "wb") as f:
        shutil.copyfileobj(file.file, f)
    if existing:
        if existing.processed:
            raise HTTPException(status_code=400, detail={
                "code": ErrorCode.ALREADY_PROCESSED,
                "message": "该作业已处理过，如需重新提交请先取消处理状态",
                "student_id": student_id
            })
        old_path = existing.file_path
        if os.path.exists(old_path):
            os.remove(old_path)
        existing.file_name = file.filename
        existing.file_path = saved_path
        existing.file_type = file_ext
        existing.submitted_at = datetime.utcnow()
        existing.resubmit_count += 1
        existing.status = SubmissionStatus.RESUBMITTED if existing.resubmit_count > 0 else SubmissionStatus.LATE_SUBMITTED if is_late else SubmissionStatus.SUBMITTED
        existing.is_late = existing.is_late or is_late
        submission = existing
    else:
        submission = Submission(
            assignment_id=assignment_id,
            student_id=student_id,
            file_name=file.filename,
            file_path=saved_path,
            file_type=file_ext,
            status=SubmissionStatus.LATE_SUBMITTED if is_late else SubmissionStatus.SUBMITTED,
            is_late=is_late,
            resubmit_count=0
        )
        db.add(submission)
    db.commit()
    db.refresh(submission)
    return {
        "success": True,
        "submission_id": submission.id,
        "student_id": student_id,
        "student_name": student.name,
        "status": submission.status,
        "is_late": submission.is_late,
        "resubmit_count": submission.resubmit_count
    }

@app.get("/api/assignments/{assignment_id}/submissions")
def list_submissions(assignment_id: int, status: Optional[str] = None, needs_review: Optional[bool] = None):
    db = next(get_db())
    query = db.query(Submission).filter(Submission.assignment_id == assignment_id)
    if status:
        query = query.filter(Submission.status == status)
    if needs_review is not None:
        query = query.filter(Submission.needs_review == needs_review)
    submissions = query.all()
    return {"submissions": [
        {
            "id": s.id,
            "student_id": s.student_id,
            "file_name": s.file_name,
            "status": s.status,
            "submitted_at": s.submitted_at,
            "is_late": s.is_late,
            "resubmit_count": s.resubmit_count
        } for s in submissions
    ]}

@app.get("/api/assignments/{assignment_id}/missing")
def get_missing_submissions(assignment_id: int):
    db = next(get_db())
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="作业不存在")
    all_students = db.query(Student).filter(Student.is_active == True).all()
    submitted_ids = db.query(Submission.student_id).filter(
        Submission.assignment_id == assignment_id
    ).distinct().all()
    submitted_set = {s[0] for s in submitted_ids}
    missing = []
    for student in all_students:
        if student.student_id not in submitted_set:
            missing.append({
                "student_id": student.student_id,
                "name": student.name,
                "class_name": student.class_name,
                "email": student.email
            })
    return {
        "assignment_id": assignment_id,
        "assignment_name": assignment.name,
        "total_students": len(all_students),
        "submitted_count": len(submitted_set),
        "missing_count": len(missing),
        "missing_students": missing
    }

@app.post("/api/submissions/{submission_id}/mark-reviewed")
def mark_submission_reviewed(submission_id: int, review_note: str = ""):
    db = next(get_db())
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="提交记录不存在")
    submission.needs_review = False
    submission.review_note = review_note
    db.commit()
    return {"success": True}

@app.post("/api/submissions/{submission_id}/mark-processed")
def mark_submission_processed(submission_id: int):
    db = next(get_db())
    submission = db.query(Submission).filter(Submission.id == submission_id).first()
    if not submission:
        raise HTTPException(status_code=404, detail="提交记录不存在")
    submission.processed = True
    db.commit()
    return {"success": True}

@app.get("/api/assignments/{assignment_id}/report")
def generate_assignment_report(assignment_id: int, format: str = "excel"):
    db = next(get_db())
    assignment = db.query(Assignment).filter(Assignment.id == assignment_id).first()
    if not assignment:
        raise HTTPException(status_code=404, detail="作业不存在")
    all_students = db.query(Student).filter(Student.is_active == True).all()
    submissions = db.query(Submission).filter(Submission.assignment_id == assignment_id).all()
    submission_map = {s.student_id: s for s in submissions}
    report_data = []
    for student in all_students:
        sub = submission_map.get(student.student_id)
        if sub:
            status_text = "已提交"
            if sub.status == SubmissionStatus.LATE_SUBMITTED:
                status_text = "迟交"
            elif sub.status == SubmissionStatus.RESUBMITTED:
                status_text = "补交"
            report_data.append({
                "学号": student.student_id,
                "姓名": student.name,
                "班级": student.class_name,
                "提交状态": status_text,
                "文件名": sub.file_name,
                "提交时间": sub.submitted_at.strftime("%Y-%m-%d %H:%M:%S"),
                "是否迟交": "是" if sub.is_late else "否",
                "补交次数": sub.resubmit_count,
                "是否需复核": "是" if sub.needs_review else "否"
            })
        else:
            report_data.append({
                "学号": student.student_id,
                "姓名": student.name,
                "班级": student.class_name,
                "提交状态": "缺交",
                "文件名": "",
                "提交时间": "",
                "是否迟交": "",
                "补交次数": 0,
                "是否需复核": ""
            })
    df = pd.DataFrame(report_data)
    timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    if format == "excel":
        report_path = os.path.join(REPORT_DIR, f"report_{assignment_id}_{timestamp}.xlsx")
        df.to_excel(report_path, index=False)
    else:
        report_path = os.path.join(REPORT_DIR, f"report_{assignment_id}_{timestamp}.csv")
        df.to_csv(report_path, index=False, encoding="utf-8-sig")
    return FileResponse(
        report_path,
        filename=f"作业收齐报告_{assignment.name}_{timestamp}.{format if format == 'csv' else 'xlsx'}",
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if format == "excel" else "text/csv"
    )

@app.get("/api/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow()}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
