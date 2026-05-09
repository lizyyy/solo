from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from datetime import datetime

from app.database import get_db
from app.models import (
    Student, AcademicRecord, Discipline, Thesis,
    HistoryRecord, StudentStatus, DisciplineLevel, ThesisStatus
)
from app.schemas import (
    StudentCreate, StudentUpdate, StudentResponse,
    AcademicRecordCreate, AcademicRecordResponse,
    DisciplineCreate, DisciplineUpdate, DisciplineResponse,
    ThesisCreate, ThesisUpdate, ThesisResponse,
    StudentFullProfileResponse, HistoryRecordResponse
)

router = APIRouter(prefix="/students", tags=["students"])


@router.post("", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
def create_student(student: StudentCreate, db: Session = Depends(get_db)):
    existing = db.query(Student).filter(Student.student_id == student.student_id).first()
    if existing:
        raise HTTPException(status_code=400, detail="学号已存在")
    
    db_student = Student(**student.model_dump())
    db.add(db_student)
    db.commit()
    db.refresh(db_student)
    
    history = HistoryRecord(
        student_id=db_student.id,
        record_type="STUDENT_CREATED",
        after_data=student.model_dump(),
        change_reason="创建学生档案",
        operator="api"
    )
    db.add(history)
    db.commit()
    
    return db_student


@router.get("", response_model=List[StudentResponse])
def list_students(
    department: Optional[str] = None,
    grade: Optional[int] = None,
    status: Optional[StudentStatus] = None,
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    query = db.query(Student)
    if department:
        query = query.filter(Student.department == department)
    if grade:
        query = query.filter(Student.grade == grade)
    if status:
        query = query.filter(Student.status == status.value)
    
    return query.offset(skip).limit(limit).all()


@router.get("/{student_id}", response_model=StudentResponse)
def get_student(student_id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="学生不存在")
    return student


@router.get("/{student_id}/full", response_model=StudentFullProfileResponse)
def get_student_full_profile(student_id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="学生不存在")
    
    academic_record = db.query(AcademicRecord).filter(
        AcademicRecord.student_id == student_id
    ).order_by(AcademicRecord.updated_at.desc()).first()
    
    disciplines = db.query(Discipline).filter(
        Discipline.student_id == student_id
    ).order_by(Discipline.occurred_at.desc()).all()
    
    theses = db.query(Thesis).filter(
        Thesis.student_id == student_id
    ).order_by(Thesis.updated_at.desc()).all()
    
    from app.models import PreReview
    latest_pre_review = db.query(PreReview).filter(
        PreReview.student_id == student_id
    ).order_by(PreReview.created_at.desc()).first()
    
    history = db.query(HistoryRecord).filter(
        HistoryRecord.student_id == student_id
    ).order_by(HistoryRecord.created_at.desc()).limit(50).all()
    
    return {
        "student": student,
        "academic_record": academic_record,
        "disciplines": disciplines,
        "theses": theses,
        "latest_pre_review": latest_pre_review,
        "history": history
    }


@router.put("/{student_id}", response_model=StudentResponse)
def update_student(
    student_id: int,
    update: StudentUpdate,
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="学生不存在")
    
    before_data = {
        "name": student.name,
        "department": student.department,
        "major": student.major,
        "grade": student.grade,
        "status": student.status
    }
    
    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(student, field, value)
    
    history = HistoryRecord(
        student_id=student.id,
        record_type="STUDENT_UPDATED",
        before_data=before_data,
        after_data=update_data,
        change_reason="更新学生信息",
        operator="api"
    )
    db.add(history)
    db.commit()
    db.refresh(student)
    
    return student


@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_student(student_id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="学生不存在")
    
    db.delete(student)
    db.commit()
    return None


@router.post("/{student_id}/academic-records", response_model=AcademicRecordResponse, status_code=status.HTTP_201_CREATED)
def create_academic_record(record: AcademicRecordCreate, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == record.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="学生不存在")
    
    existing = db.query(AcademicRecord).filter(
        AcademicRecord.student_id == record.student_id
    ).first()
    
    if existing:
        before_data = {
            "total_credits": existing.total_credits,
            "required_credits_earned": existing.required_credits_earned,
            "elective_credits_earned": existing.elective_credits_earned,
            "gpa": existing.gpa,
            "failed_courses_count": existing.failed_courses_count
        }
        
        update_data = record.model_dump(exclude={"student_id"})
        for field, value in update_data.items():
            setattr(existing, field, value)
        
        history = HistoryRecord(
            student_id=record.student_id,
            record_type="ACADEMIC_RECORD_UPDATED",
            before_data=before_data,
            after_data=update_data,
            change_reason="更新学业记录",
            operator="api"
        )
        db.add(history)
        db.commit()
        db.refresh(existing)
        return existing
    
    db_record = AcademicRecord(**record.model_dump())
    db.add(db_record)
    db.flush()
    
    history = HistoryRecord(
        student_id=record.student_id,
        record_type="ACADEMIC_RECORD_CREATED",
        after_data=record.model_dump(),
        change_reason="创建学业记录",
        operator="api"
    )
    db.add(history)
    db.commit()
    db.refresh(db_record)
    return db_record


@router.get("/{student_id}/academic-records", response_model=AcademicRecordResponse)
def get_academic_record(student_id: int, db: Session = Depends(get_db)):
    record = db.query(AcademicRecord).filter(
        AcademicRecord.student_id == student_id
    ).order_by(AcademicRecord.updated_at.desc()).first()
    if not record:
        raise HTTPException(status_code=404, detail="学业记录不存在")
    return record


@router.post("/{student_id}/disciplines", response_model=DisciplineResponse, status_code=status.HTTP_201_CREATED)
def create_discipline(student_id: int, discipline: DisciplineCreate, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="学生不存在")
    
    db_discipline = Discipline(student_id=student_id, **discipline.model_dump(exclude={"student_id"}))
    db.add(db_discipline)
    db.flush()
    
    history = HistoryRecord(
        student_id=student_id,
        record_type="DISCIPLINE_ADDED",
        after_data=discipline.model_dump(),
        change_reason="添加处分记录",
        operator="api"
    )
    db.add(history)
    db.commit()
    db.refresh(db_discipline)
    return db_discipline


@router.put("/{student_id}/disciplines/{discipline_id}", response_model=DisciplineResponse)
def update_discipline(
    student_id: int,
    discipline_id: int,
    update: DisciplineUpdate,
    db: Session = Depends(get_db)
):
    discipline = db.query(Discipline).filter(
        Discipline.id == discipline_id,
        Discipline.student_id == student_id
    ).first()
    if not discipline:
        raise HTTPException(status_code=404, detail="处分记录不存在")
    
    before_data = {"is_cleared": discipline.is_cleared}
    
    if update.is_cleared is not None:
        discipline.is_cleared = update.is_cleared
        if update.is_cleared:
            discipline.cleared_at = datetime.utcnow()
    
    history = HistoryRecord(
        student_id=student_id,
        record_type="DISCIPLINE_UPDATED",
        before_data=before_data,
        after_data={"is_cleared": discipline.is_cleared},
        change_reason="更新处分记录" if not update.is_cleared else "撤销处分",
        operator="api"
    )
    db.add(history)
    db.commit()
    db.refresh(discipline)
    return discipline


@router.get("/{student_id}/disciplines", response_model=List[DisciplineResponse])
def list_disciplines(student_id: int, db: Session = Depends(get_db)):
    return db.query(Discipline).filter(
        Discipline.student_id == student_id
    ).order_by(Discipline.occurred_at.desc()).all()


@router.post("/{student_id}/theses", response_model=ThesisResponse, status_code=status.HTTP_201_CREATED)
def create_thesis(thesis: ThesisCreate, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == thesis.student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="学生不存在")
    
    db_thesis = Thesis(**thesis.model_dump())
    db.add(db_thesis)
    db.flush()
    
    history = HistoryRecord(
        student_id=thesis.student_id,
        record_type="THESIS_CREATED",
        after_data=thesis.model_dump(),
        change_reason="创建论文记录",
        operator="api"
    )
    db.add(history)
    db.commit()
    db.refresh(db_thesis)
    return db_thesis


@router.put("/{student_id}/theses/{thesis_id}", response_model=ThesisResponse)
def update_thesis(
    student_id: int,
    thesis_id: int,
    update: ThesisUpdate,
    db: Session = Depends(get_db)
):
    thesis = db.query(Thesis).filter(
        Thesis.id == thesis_id,
        Thesis.student_id == student_id
    ).first()
    if not thesis:
        raise HTTPException(status_code=404, detail="论文记录不存在")
    
    before_data = {
        "title": thesis.title,
        "status": thesis.status,
        "score": thesis.score
    }
    
    update_data = update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(thesis, field, value)
    
    if update_data.get("status") == ThesisStatus.SUBMITTED.value:
        thesis.submitted_at = datetime.utcnow()
    
    history = HistoryRecord(
        student_id=student_id,
        record_type="THESIS_UPDATED",
        before_data=before_data,
        after_data=update_data,
        change_reason="更新论文记录",
        operator="api"
    )
    db.add(history)
    db.commit()
    db.refresh(thesis)
    return thesis


@router.get("/{student_id}/theses", response_model=List[ThesisResponse])
def list_theses(student_id: int, db: Session = Depends(get_db)):
    return db.query(Thesis).filter(
        Thesis.student_id == student_id
    ).order_by(Thesis.updated_at.desc()).all()


@router.get("/{student_id}/history", response_model=List[HistoryRecordResponse])
def get_student_history(
    student_id: int,
    record_type: Optional[str] = None,
    limit: int = Query(100, ge=1, le=500),
    db: Session = Depends(get_db)
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="学生不存在")
    
    query = db.query(HistoryRecord).filter(HistoryRecord.student_id == student_id)
    if record_type:
        query = query.filter(HistoryRecord.record_type == record_type)
    
    return query.order_by(HistoryRecord.created_at.desc()).limit(limit).all()
