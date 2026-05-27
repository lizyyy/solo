from fastapi import FastAPI, File, UploadFile, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from .database import Base, engine, get_db
from .models import Employee, Coupon, ClaimRecord, Batch
from .schemas import (
    ClaimItem, EmployeeItem, CouponItem,
    ProcessResult, BatchInfo
)
from .processor import ClaimProcessor, generate_file_hash
from .parser import auto_detect_and_parse, parse_csv, parse_json, parse_claim_records

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="工会福利券核销系统",
    description="用于处理节日福利券、线下领取和快递寄送的统一核销平台",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def read_root():
    return {
        "service": "工会福利券核销系统",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "上传文件核销": "POST /upload/process",
            "导入员工数据": "POST /import/employees",
            "导入券码数据": "POST /import/coupons",
            "查看批次列表": "GET /batches",
            "查看批次详情": "GET /batches/{batch_id}",
            "查看已生效记录": "GET /records"
        }
    }


@app.post("/upload/process", response_model=ProcessResult)
async def upload_and_process(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    content = await file.read()
    file_hash = generate_file_hash(content)

    existing_batch = db.query(Batch).filter(Batch.file_hash == file_hash).first()
    if existing_batch:
        raise HTTPException(
            status_code=400,
            detail={
                "message": "该文件已处理过，禁止重复提交",
                "batch_id": existing_batch.batch_id,
                "processed_at": existing_batch.created_at.strftime('%Y-%m-%d %H:%M:%S'),
                "result": {
                    "total": existing_batch.total_count,
                    "success": existing_batch.success_count,
                    "pending": existing_batch.pending_count,
                    "failed": existing_batch.failed_count
                }
            }
        )

    try:
        file_type, original_data, parsed_items = auto_detect_and_parse(content, file.filename)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"文件解析失败: {str(e)}")

    if file_type != "claim":
        raise HTTPException(
            status_code=400,
            detail=f"请上传领用名单文件，当前检测为 {file_type} 数据，请使用 /import/{file_type}s 接口"
        )

    processor = ClaimProcessor(db)
    result = processor.process_batch(
        claim_items=parsed_items,
        original_data=original_data,
        file_hash=file_hash,
        file_name=file.filename
    )

    return result


@app.post("/import/employees")
async def import_employees(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    content = await file.read()

    try:
        if file.filename.lower().endswith(".csv"):
            records = parse_csv(content)
        elif file.filename.lower().endswith(".json"):
            records = parse_json(content)
        else:
            raise ValueError("仅支持 CSV 或 JSON 格式")

        from .parser import parse_employees
        employees = parse_employees(records)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"文件解析失败: {str(e)}")

    added = 0
    updated = 0
    for emp in employees:
        existing = db.query(Employee).filter(Employee.employee_id == emp.employee_id).first()
        if existing:
            existing.name = emp.name
            existing.department = emp.department
            existing.is_active = emp.is_active
            updated += 1
        else:
            db_emp = Employee(
                employee_id=emp.employee_id,
                name=emp.name,
                department=emp.department,
                is_active=emp.is_active
            )
            db.add(db_emp)
            added += 1

    db.commit()

    return {
        "message": "员工数据导入完成",
        "total": len(employees),
        "added": added,
        "updated": updated
    }


@app.post("/import/coupons")
async def import_coupons(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    content = await file.read()

    try:
        if file.filename.lower().endswith(".csv"):
            records = parse_csv(content)
        elif file.filename.lower().endswith(".json"):
            records = parse_json(content)
        else:
            raise ValueError("仅支持 CSV 或 JSON 格式")

        from .parser import parse_coupons
        coupons = parse_coupons(records)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"文件解析失败: {str(e)}")

    added = 0
    skipped = 0
    for coupon in coupons:
        existing = db.query(Coupon).filter(Coupon.coupon_code == coupon.coupon_code).first()
        if existing:
            skipped += 1
        else:
            db_coupon = Coupon(
                coupon_code=coupon.coupon_code,
                coupon_type=coupon.coupon_type,
                value=coupon.value
            )
            db.add(db_coupon)
            added += 1

    db.commit()

    return {
        "message": "券码数据导入完成",
        "total": len(coupons),
        "added": added,
        "skipped": skipped
    }


@app.get("/batches", response_model=List[BatchInfo])
def list_batches(db: Session = Depends(get_db)):
    batches = db.query(Batch).order_by(Batch.created_at.desc()).all()
    return batches


@app.get("/batches/{batch_id}")
def get_batch_detail(batch_id: str, db: Session = Depends(get_db)):
    batch = db.query(Batch).filter(Batch.batch_id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")

    records = db.query(ClaimRecord).filter(ClaimRecord.batch_id == batch_id).all()

    return {
        "batch_info": {
            "batch_id": batch.batch_id,
            "file_name": batch.file_name,
            "total_count": batch.total_count,
            "success_count": batch.success_count,
            "pending_count": batch.pending_count,
            "failed_count": batch.failed_count,
            "created_at": batch.created_at
        },
        "successful_records": [
            {
                "employee_id": r.employee_id,
                "employee_name": r.employee_name,
                "claim_type": r.claim_type,
                "coupon_code": r.coupon_code,
                "delivery_method": r.delivery_method,
                "is_proxy": r.is_proxy,
                "proxy_name": r.proxy_employee_name,
                "created_at": r.created_at
            }
            for r in records
        ]
    }


@app.get("/records")
def list_records(
    employee_id: Optional[str] = None,
    claim_type: Optional[str] = None,
    db: Session = Depends(get_db)
):
    query = db.query(ClaimRecord)

    if employee_id:
        query = query.filter(ClaimRecord.employee_id == employee_id)
    if claim_type:
        query = query.filter(ClaimRecord.claim_type == claim_type)

    records = query.order_by(ClaimRecord.created_at.desc()).all()

    return [
        {
            "id": r.id,
            "batch_id": r.batch_id,
            "employee_id": r.employee_id,
            "employee_name": r.employee_name,
            "claim_type": r.claim_type,
            "coupon_code": r.coupon_code,
            "delivery_method": r.delivery_method,
            "is_proxy": r.is_proxy,
            "proxy_employee_name": r.proxy_employee_name,
            "address": r.address,
            "contact_phone": r.contact_phone,
            "created_at": r.created_at
        }
        for r in records
    ]


@app.get("/employees")
def list_employees(
    employee_id: Optional[str] = None,
    is_active: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Employee)

    if employee_id:
        query = query.filter(Employee.employee_id == employee_id)
    if is_active is not None:
        query = query.filter(Employee.is_active == is_active)

    employees = query.all()

    return [
        {
            "employee_id": e.employee_id,
            "name": e.name,
            "department": e.department,
            "is_active": e.is_active,
            "status_text": "在职" if e.is_active else "已离职"
        }
        for e in employees
    ]


@app.get("/coupons")
def list_coupons(
    coupon_code: Optional[str] = None,
    is_used: Optional[bool] = None,
    db: Session = Depends(get_db)
):
    query = db.query(Coupon)

    if coupon_code:
        query = query.filter(Coupon.coupon_code == coupon_code)
    if is_used is not None:
        query = query.filter(Coupon.is_used == is_used)

    coupons = query.all()

    return [
        {
            "coupon_code": c.coupon_code,
            "coupon_type": c.coupon_type,
            "value": c.value,
            "is_used": c.is_used,
            "used_by": c.used_by,
            "used_at": c.used_at
        }
        for c in coupons
    ]
