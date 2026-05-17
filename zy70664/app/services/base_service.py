from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.models.models import Department, Employee, MealType, ProcessBatch
from app.schemas.schemas import DepartmentCreate, EmployeeCreate, MealTypeCreate


def create_department(db: Session, dept: DepartmentCreate) -> Department:
    db_dept = Department(**dept.model_dump())
    db.add(db_dept)
    db.commit()
    db.refresh(db_dept)
    return db_dept


def get_departments(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None
) -> List[Department]:
    query = db.query(Department)
    if is_active is not None:
        query = query.filter(Department.is_active == is_active)
    return query.offset(skip).limit(limit).all()


def get_department_by_code(db: Session, code: str) -> Optional[Department]:
    return db.query(Department).filter(Department.code == code).first()


def create_employee(db: Session, emp: EmployeeCreate) -> Employee:
    db_emp = Employee(**emp.model_dump())
    db.add(db_emp)
    db.commit()
    db.refresh(db_emp)
    return db_emp


def get_employees(
    db: Session,
    department_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None
) -> List[Employee]:
    query = db.query(Employee)
    if department_id:
        query = query.filter(Employee.department_id == department_id)
    if is_active is not None:
        query = query.filter(Employee.is_active == is_active)
    return query.offset(skip).limit(limit).all()


def get_employee_by_no(db: Session, employee_no: str) -> Optional[Employee]:
    return db.query(Employee).filter(Employee.employee_no == employee_no).first()


def create_meal_type(db: Session, mt: MealTypeCreate) -> MealType:
    db_mt = MealType(**mt.model_dump())
    db.add(db_mt)
    db.commit()
    db.refresh(db_mt)
    return db_mt


def get_meal_types(
    db: Session,
    skip: int = 0,
    limit: int = 100,
    is_active: Optional[bool] = None
) -> List[MealType]:
    query = db.query(MealType)
    if is_active is not None:
        query = query.filter(MealType.is_active == is_active)
    return query.order_by(MealType.sort_order).offset(skip).limit(limit).all()


def get_meal_type_by_code(db: Session, code: str) -> Optional[MealType]:
    return db.query(MealType).filter(MealType.code == code).first()


def get_batches(
    db: Session,
    batch_type: Optional[str] = None,
    status: Optional[str] = None,
    skip: int = 0,
    limit: int = 100
) -> List[ProcessBatch]:
    query = db.query(ProcessBatch)
    if batch_type:
        query = query.filter(ProcessBatch.batch_type == batch_type)
    if status:
        query = query.filter(ProcessBatch.status == status)
    return query.order_by(ProcessBatch.created_at.desc()).offset(skip).limit(limit).all()


def get_batch_by_id(db: Session, batch_id: str) -> Optional[ProcessBatch]:
    return db.query(ProcessBatch).filter(ProcessBatch.batch_id == batch_id).first()
