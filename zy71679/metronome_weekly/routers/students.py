from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db
from models import Student, AuditLog
from schemas import StudentCreate, StudentOut
from datetime import datetime

router = APIRouter(prefix="/api/students", tags=["students"])


@router.post("", response_model=StudentOut)
def create_student(data: StudentCreate, db: Session = Depends(get_db)):
    student = Student(name=data.name, instrument=data.instrument)
    db.add(student)
    db.commit()
    db.refresh(student)
    _log_audit(db, "student", student.id, "create", None, {"name": data.name, "instrument": data.instrument})
    return student


@router.get("", response_model=list[StudentOut])
def list_students(
    is_active: bool = True,
    db: Session = Depends(get_db),
):
    query = db.query(Student)
    if is_active is not None:
        query = query.filter(Student.is_active == is_active)
    return query.all()


@router.get("/{student_id}", response_model=StudentOut)
def get_student(student_id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="学生不存在")
    return student


@router.patch("/{student_id}/deactivate", response_model=StudentOut)
def deactivate_student(student_id: int, db: Session = Depends(get_db)):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(status_code=404, detail="学生不存在")
    before = {"is_active": student.is_active}
    student.is_active = False
    db.commit()
    db.refresh(student)
    _log_audit(db, "student", student.id, "deactivate", before, {"is_active": False})
    return student


def _log_audit(db: Session, entity_type: str, entity_id: int, action: str, before, after):
    log = AuditLog(
        entity_type=entity_type,
        entity_id=entity_id,
        action=action,
        before_state=before,
        after_state=after,
        operator="system",
    )
    db.add(log)
    db.commit()
