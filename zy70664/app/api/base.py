from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import date

from app.core.database import get_db
from app.schemas.schemas import (
    Department, DepartmentCreate,
    Employee, EmployeeCreate,
    MealType, MealTypeCreate,
    ProcessBatch
)
from app.services import base_service

router = APIRouter(prefix="/base", tags=["基础数据"])


@router.post("/departments", response_model=Department, summary="创建部门")
def create_department(dept: DepartmentCreate, db: Session = Depends(get_db)):
    existing = base_service.get_department_by_code(db, dept.code)
    if existing:
        raise HTTPException(status_code=400, detail="部门代码已存在")
    return base_service.create_department(db, dept)


@router.get("/departments", response_model=List[Department], summary="获取部门列表")
def get_departments(
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    return base_service.get_departments(db, skip, limit, is_active)


@router.post("/employees", response_model=Employee, summary="创建员工")
def create_employee(emp: EmployeeCreate, db: Session = Depends(get_db)):
    existing = base_service.get_employee_by_no(db, emp.employee_no)
    if existing:
        raise HTTPException(status_code=400, detail="员工号已存在")
    return base_service.create_employee(db, emp)


@router.get("/employees", response_model=List[Employee], summary="获取员工列表")
def get_employees(
    department_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    return base_service.get_employees(db, department_id, skip, limit, is_active)


@router.post("/meal-types", response_model=MealType, summary="创建餐别")
def create_meal_type(mt: MealTypeCreate, db: Session = Depends(get_db)):
    existing = base_service.get_meal_type_by_code(db, mt.code)
    if existing:
        raise HTTPException(status_code=400, detail="餐别代码已存在")
    return base_service.create_meal_type(db, mt)


@router.get("/meal-types", response_model=List[MealType], summary="获取餐别列表")
def get_meal_types(
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    return base_service.get_meal_types(db, skip, limit, is_active)


@router.get("/batches", response_model=List[ProcessBatch], summary="获取批次列表")
def get_batches(
    batch_type: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return base_service.get_batches(db, batch_type, status, skip, limit)


@router.get("/batches/{batch_id}", response_model=ProcessBatch, summary="获取批次详情")
def get_batch(batch_id: str, db: Session = Depends(get_db)):
    batch = base_service.get_batch_by_id(db, batch_id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch
