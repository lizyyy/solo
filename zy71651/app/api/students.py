from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session

from ..models import Student
from ..schemas import (
    StudentCreate,
    StudentUpdate,
    StudentResponse,
    PaginationParams,
    PaginatedResponse,
    SuccessResponse,
)
from ..api.deps import get_db_session

router = APIRouter(prefix="/students", tags=["学生管理"])


@router.get("", response_model=SuccessResponse[PaginatedResponse[StudentResponse]])
def list_students(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db_session),
):
    query = db.query(Student)
    if search:
        query = query.filter(
            (Student.name.contains(search)) |
            (Student.student_id.contains(search))
        )

    total = query.count()
    items = (
        query.order_by(Student.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
        .all()
    )

    return SuccessResponse(
        data=PaginatedResponse(
            items=[StudentResponse.model_validate(s) for s in items],
            page=page,
            page_size=page_size,
            total=total,
            total_pages=(total + page_size - 1) // page_size,
        )
    )


@router.post("", response_model=SuccessResponse[StudentResponse], status_code=201)
def create_student(
    data: StudentCreate,
    db: Session = Depends(get_db_session),
):
    existing = db.query(Student).filter(Student.student_id == data.student_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"学号 {data.student_id} 已存在",
        )

    student = Student(**data.model_dump())
    db.add(student)
    db.commit()
    db.refresh(student)

    return SuccessResponse(data=StudentResponse.model_validate(student))


@router.get("/{student_id}", response_model=SuccessResponse[StudentResponse])
def get_student(
    student_id: int,
    db: Session = Depends(get_db_session),
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"学生 {student_id} 不存在",
        )
    return SuccessResponse(data=StudentResponse.model_validate(student))


@router.put("/{student_id}", response_model=SuccessResponse[StudentResponse])
def update_student(
    student_id: int,
    data: StudentUpdate,
    db: Session = Depends(get_db_session),
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"学生 {student_id} 不存在",
        )

    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(student, field, value)

    db.commit()
    db.refresh(student)
    return SuccessResponse(data=StudentResponse.model_validate(student))


@router.delete("/{student_id}", response_model=SuccessResponse[dict])
def delete_student(
    student_id: int,
    db: Session = Depends(get_db_session),
):
    student = db.query(Student).filter(Student.id == student_id).first()
    if not student:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"学生 {student_id} 不存在",
        )

    db.delete(student)
    db.commit()
    return SuccessResponse(data={"message": "删除成功"})
