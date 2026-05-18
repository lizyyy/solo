import json
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse
from fastapi.exception_handlers import RequestValidationError
from sqlalchemy.orm import Session
from sqlalchemy import and_

from models import (
    Base, Medicine, Inventory, DoctorOrder,
    InventoryCheck, InventoryCheckDetail, OperationLog
)
from database import engine, get_db
from schemas import (
    MedicineCreate, MedicineUpdate, MedicineResponse,
    InventoryCreate, InventoryUpdate, InventoryResponse,
    DoctorOrderCreate, DoctorOrderUpdate, DoctorOrderResponse,
    InventoryCheckCreate, InventoryCheckUpdate, InventoryCheckResponse,
    InventoryCheckDetailUpdate,
    ErrorResponse, SuccessResponse
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="养老院药事组养老药品盘点 API",
    description="养老院药事组药品盘点管理系统，包含药品管理、库存管理、医嘱管理、盘点管理",
    version="1.0.0"
)


class PharmacyException(HTTPException):
    def __init__(self, status_code: int, error_code: str, error_message: str, error_details: dict = None):
        self.error_code = error_code
        self.error_message = error_message
        self.error_details = error_details
        super().__init__(status_code=status_code, detail=error_message)


@app.exception_handler(PharmacyException)
async def pharmacy_exception_handler(request: Request, exc: PharmacyException):
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "success": False,
            "error_code": exc.error_code,
            "error_message": exc.error_message,
            "error_details": exc.error_details,
            "timestamp": datetime.utcnow().isoformat()
        }
    )


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "success": False,
            "error_code": "VALIDATION_ERROR",
            "error_message": "请求参数验证失败",
            "error_details": {"errors": exc.errors()},
            "timestamp": datetime.utcnow().isoformat()
        }
    )


@app.exception_handler(Exception)
async def general_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={
            "success": False,
            "error_code": "INTERNAL_SERVER_ERROR",
            "error_message": f"服务器内部错误: {str(exc)}",
            "error_details": None,
            "timestamp": datetime.utcnow().isoformat()
        }
    )


def log_operation(
    db: Session,
    operation_type: str,
    business_type: str,
    business_id: int,
    business_no: str,
    operator: str,
    original_data: dict = None,
    new_data: dict = None,
    changed_fields: list = None
):
    log = OperationLog(
        operation_type=operation_type,
        business_type=business_type,
        business_id=business_id,
        business_no=business_no,
        operator=operator,
        original_data=json.dumps(original_data, ensure_ascii=False, default=str) if original_data else None,
        new_data=json.dumps(new_data, ensure_ascii=False, default=str) if new_data else None,
        changed_fields=json.dumps(changed_fields, ensure_ascii=False) if changed_fields else None
    )
    db.add(log)
    db.commit()


@app.get("/")
def read_root():
    return {"message": "养老院药事组养老药品盘点 API", "version": "1.0.0"}


@app.post("/medicines/", response_model=MedicineResponse)
def create_medicine(medicine: MedicineCreate, db: Session = Depends(get_db)):
    db_medicine = db.query(Medicine).filter(Medicine.medicine_code == medicine.medicine_code).first()
    if db_medicine:
        raise PharmacyException(
            status_code=status.HTTP_409_CONFLICT,
            error_code="MEDICINE_CODE_EXISTS",
            error_message=f"药品编码 [{medicine.medicine_code}] 已存在，不能重复创建",
            error_details={"medicine_code": medicine.medicine_code}
        )

    db_medicine = Medicine(**medicine.dict())
    db.add(db_medicine)
    db.commit()
    db.refresh(db_medicine)

    log_operation(
        db, "CREATE", "MEDICINE", db_medicine.id,
        db_medicine.medicine_code, "system",
        new_data=medicine.dict()
    )

    return db_medicine


@app.get("/medicines/", response_model=List[MedicineResponse])
def list_medicines(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    medicines = db.query(Medicine).offset(skip).limit(limit).all()
    return medicines


@app.get("/medicines/{medicine_id}", response_model=MedicineResponse)
def get_medicine(medicine_id: int, db: Session = Depends(get_db)):
    medicine = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if not medicine:
        raise PharmacyException(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="MEDICINE_NOT_FOUND",
            error_message=f"药品ID [{medicine_id}] 不存在",
            error_details={"medicine_id": medicine_id}
        )
    return medicine


@app.put("/medicines/{medicine_id}", response_model=MedicineResponse)
def update_medicine(
    medicine_id: int,
    medicine_update: MedicineUpdate,
    current_version: int,
    operator: str = "system",
    db: Session = Depends(get_db)
):
    db_medicine = db.query(Medicine).filter(Medicine.id == medicine_id).first()
    if not db_medicine:
        raise PharmacyException(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="MEDICINE_NOT_FOUND",
            error_message=f"药品ID [{medicine_id}] 不存在",
            error_details={"medicine_id": medicine_id}
        )

    if db_medicine.version != current_version:
        raise PharmacyException(
            status_code=status.HTTP_409_CONFLICT,
            error_code="VERSION_CONFLICT",
            error_message="记录已被其他用户修改，请刷新后重试",
            error_details={
                "current_version": current_version,
                "latest_version": db_medicine.version
            }
        )

    original_data = {
        column.name: getattr(db_medicine, column.name)
        for column in Medicine.__table__.columns
    }

    update_data = medicine_update.dict(exclude_unset=True)
    changed_fields = list(update_data.keys())

    for key, value in update_data.items():
        setattr(db_medicine, key, value)

    db_medicine.version += 1
    db.commit()
    db.refresh(db_medicine)

    new_data = {
        column.name: getattr(db_medicine, column.name)
        for column in Medicine.__table__.columns
    }

    log_operation(
        db, "UPDATE", "MEDICINE", db_medicine.id,
        db_medicine.medicine_code, operator,
        original_data=original_data,
        new_data=new_data,
        changed_fields=changed_fields
    )

    return db_medicine


@app.post("/inventories/", response_model=InventoryResponse)
def create_inventory(inventory: InventoryCreate, db: Session = Depends(get_db)):
    medicine = db.query(Medicine).filter(Medicine.id == inventory.medicine_id).first()
    if not medicine:
        raise PharmacyException(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="MEDICINE_NOT_FOUND",
            error_message=f"药品ID [{inventory.medicine_id}] 不存在，无法创建库存",
            error_details={"medicine_id": inventory.medicine_id}
        )

    existing_inventory = db.query(Inventory).filter(Inventory.medicine_id == inventory.medicine_id).first()
    if existing_inventory:
        raise PharmacyException(
            status_code=status.HTTP_409_CONFLICT,
            error_code="INVENTORY_EXISTS",
            error_message=f"药品 [{medicine.medicine_name}] 已有库存记录，请直接修改库存数量",
            error_details={"medicine_id": inventory.medicine_id, "medicine_name": medicine.medicine_name}
        )

    db_inventory = Inventory(**inventory.dict())
    db.add(db_inventory)
    db.commit()
    db.refresh(db_inventory)

    log_operation(
        db, "CREATE", "INVENTORY", db_inventory.id,
        medicine.medicine_code, "system",
        new_data=inventory.dict()
    )

    return db_inventory


@app.get("/inventories/", response_model=List[InventoryResponse])
def list_inventories(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    inventories = db.query(Inventory).offset(skip).limit(limit).all()
    return inventories


@app.post("/doctor-orders/", response_model=DoctorOrderResponse)
def create_doctor_order(order: DoctorOrderCreate, db: Session = Depends(get_db)):
    existing_order = db.query(DoctorOrder).filter(DoctorOrder.order_no == order.order_no).first()
    if existing_order:
        raise PharmacyException(
            status_code=status.HTTP_409_CONFLICT,
            error_code="ORDER_NO_EXISTS",
            error_message=f"医嘱单号 [{order.order_no}] 已存在",
            error_details={"order_no": order.order_no}
        )

    medicine = db.query(Medicine).filter(Medicine.id == order.medicine_id).first()
    if not medicine:
        raise PharmacyException(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="MEDICINE_NOT_FOUND",
            error_message=f"药品ID [{order.medicine_id}] 不存在",
            error_details={"medicine_id": order.medicine_id}
        )

    db_order = DoctorOrder(**order.dict())
    db.add(db_order)
    db.commit()
    db.refresh(db_order)

    log_operation(
        db, "CREATE", "DOCTOR_ORDER", db_order.id,
        db_order.order_no, order.created_by or "system",
        new_data=order.dict()
    )

    return db_order


@app.get("/doctor-orders/", response_model=List[DoctorOrderResponse])
def list_doctor_orders(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    orders = db.query(DoctorOrder).offset(skip).limit(limit).all()
    return orders


@app.put("/doctor-orders/{order_id}/stop", response_model=DoctorOrderResponse)
def stop_doctor_order(
    order_id: int,
    stopped_by: str,
    stop_reason: str,
    current_version: int,
    db: Session = Depends(get_db)
):
    db_order = db.query(DoctorOrder).filter(DoctorOrder.id == order_id).first()
    if not db_order:
        raise PharmacyException(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="ORDER_NOT_FOUND",
            error_message=f"医嘱ID [{order_id}] 不存在",
            error_details={"order_id": order_id}
        )

    if db_order.is_stopped:
        raise PharmacyException(
            status_code=status.HTTP_409_CONFLICT,
            error_code="ORDER_ALREADY_STOPPED",
            error_message=f"医嘱单号 [{db_order.order_no}] 已处于停药状态，不可重复停药",
            error_details={"order_no": db_order.order_no}
        )

    if db_order.version != current_version:
        raise PharmacyException(
            status_code=status.HTTP_409_CONFLICT,
            error_code="VERSION_CONFLICT",
            error_message="记录已被其他用户修改，请刷新后重试",
            error_details={
                "current_version": current_version,
                "latest_version": db_order.version
            }
        )

    original_data = {
        column.name: getattr(db_order, column.name)
        for column in DoctorOrder.__table__.columns
    }

    db_order.is_stopped = True
    db_order.stopped_at = datetime.utcnow()
    db_order.stopped_by = stopped_by
    db_order.stop_reason = stop_reason
    db_order.version += 1
    db.commit()
    db.refresh(db_order)

    new_data = {
        column.name: getattr(db_order, column.name)
        for column in DoctorOrder.__table__.columns
    }

    log_operation(
        db, "STOP", "DOCTOR_ORDER", db_order.id,
        db_order.order_no, stopped_by,
        original_data=original_data,
        new_data=new_data,
        changed_fields=["is_stopped", "stopped_at", "stopped_by", "stop_reason"]
    )

    return db_order


@app.put("/doctor-orders/{order_id}/sync-inventory", response_model=SuccessResponse)
def sync_stopped_order_inventory(
    order_id: int,
    synced_by: str,
    current_version: int,
    db: Session = Depends(get_db)
):
    db_order = db.query(DoctorOrder).filter(DoctorOrder.id == order_id).first()
    if not db_order:
        raise PharmacyException(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="ORDER_NOT_FOUND",
            error_message=f"医嘱ID [{order_id}] 不存在",
            error_details={"order_id": order_id}
        )

    if not db_order.is_stopped:
        raise PharmacyException(
            status_code=status.HTTP_409_CONFLICT,
            error_code="ORDER_NOT_STOPPED",
            error_message=f"医嘱单号 [{db_order.order_no}] 未停药，不能同步库存",
            error_details={"order_no": db_order.order_no}
        )

    if db_order.inventory_synced:
        raise PharmacyException(
            status_code=status.HTTP_409_CONFLICT,
            error_code="ORDER_ALREADY_SYNCED",
            error_message=f"医嘱单号 [{db_order.order_no}] 库存已同步，不能重复同步",
            error_details={"order_no": db_order.order_no}
        )

    if db_order.version != current_version:
        raise PharmacyException(
            status_code=status.HTTP_409_CONFLICT,
            error_code="VERSION_CONFLICT",
            error_message="记录已被其他用户修改，请刷新后重试",
            error_details={
                "current_version": current_version,
                "latest_version": db_order.version
            }
        )

    original_data = {
        column.name: getattr(db_order, column.name)
        for column in DoctorOrder.__table__.columns
    }

    db_order.inventory_synced = True
    db_order.version += 1
    db.commit()
    db.refresh(db_order)

    new_data = {
        column.name: getattr(db_order, column.name)
        for column in DoctorOrder.__table__.columns
    }

    log_operation(
        db, "SYNC_INVENTORY", "DOCTOR_ORDER", db_order.id,
        db_order.order_no, synced_by,
        original_data=original_data,
        new_data=new_data,
        changed_fields=["inventory_synced"]
    )

    return SuccessResponse(
        message=f"医嘱单号 [{db_order.order_no}] 库存同步成功",
        data={"order_no": db_order.order_no, "synced_at": datetime.utcnow().isoformat()}
    )


@app.post("/inventory-checks/", response_model=InventoryCheckResponse)
def create_inventory_check(check: InventoryCheckCreate, db: Session = Depends(get_db)):
    existing_check = db.query(InventoryCheck).filter(InventoryCheck.check_no == check.check_no).first()
    if existing_check:
        raise PharmacyException(
            status_code=status.HTTP_409_CONFLICT,
            error_code="CHECK_NO_EXISTS",
            error_message=f"盘点单号 [{check.check_no}] 已存在",
            error_details={"check_no": check.check_no}
        )

    unchecked_stopped_orders = db.query(DoctorOrder).filter(
        and_(
            DoctorOrder.is_stopped == True,
            DoctorOrder.inventory_synced == False
        )
    ).all()

    if unchecked_stopped_orders:
        order_list = [order.order_no for order in unchecked_stopped_orders]
        raise PharmacyException(
            status_code=status.HTTP_409_CONFLICT,
            error_code="UNSYNCED_STOPPED_ORDERS",
            error_message=f"存在 {len(unchecked_stopped_orders)} 条停药医嘱未同步到库存，请先同步后再盘点",
            error_details={
                "unsynced_order_count": len(unchecked_stopped_orders),
                "unsynced_order_nos": order_list
            }
        )

    check_data = check.dict(exclude={"details"})
    db_check = InventoryCheck(**check_data)
    db.add(db_check)
    db.flush()

    total_items = len(check.details)
    matched_items = 0
    mismatched_items = 0

    for detail in check.details:
        db_detail = InventoryCheckDetail(
            check_id=db_check.id,
            **detail.dict()
        )
        if detail.actual_quantity is not None:
            db_detail.difference_quantity = detail.actual_quantity - detail.system_quantity
            db_detail.is_match = (db_detail.difference_quantity == 0)
            if db_detail.is_match:
                matched_items += 1
            else:
                mismatched_items += 1
        db.add(db_detail)

    db_check.total_items = total_items
    db_check.matched_items = matched_items
    db_check.mismatched_items = mismatched_items

    db.commit()
    db.refresh(db_check)

    log_operation(
        db, "CREATE", "INVENTORY_CHECK", db_check.id,
        db_check.check_no, check.created_by or "system",
        new_data=check_data
    )

    return db_check


@app.get("/inventory-checks/", response_model=List[InventoryCheckResponse])
def list_inventory_checks(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    checks = db.query(InventoryCheck).offset(skip).limit(limit).all()
    return checks


@app.get("/inventory-checks/{check_id}", response_model=InventoryCheckResponse)
def get_inventory_check(check_id: int, db: Session = Depends(get_db)):
    check = db.query(InventoryCheck).filter(InventoryCheck.id == check_id).first()
    if not check:
        raise PharmacyException(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="CHECK_NOT_FOUND",
            error_message=f"盘点ID [{check_id}] 不存在",
            error_details={"check_id": check_id}
        )
    return check


@app.put("/inventory-checks/{check_id}/details/{detail_id}", response_model=InventoryCheckResponse)
def update_check_detail(
    check_id: int,
    detail_id: int,
    detail_update: InventoryCheckDetailUpdate,
    current_version: int,
    operator: str,
    db: Session = Depends(get_db)
):
    db_check = db.query(InventoryCheck).filter(InventoryCheck.id == check_id).first()
    if not db_check:
        raise PharmacyException(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="CHECK_NOT_FOUND",
            error_message=f"盘点ID [{check_id}] 不存在",
            error_details={"check_id": check_id}
        )

    if db_check.version != current_version:
        raise PharmacyException(
            status_code=status.HTTP_409_CONFLICT,
            error_code="VERSION_CONFLICT",
            error_message="盘点记录已被其他用户修改，请刷新后重试",
            error_details={
                "current_version": current_version,
                "latest_version": db_check.version
            }
        )

    if db_check.status == "confirmed":
        raise PharmacyException(
            status_code=status.HTTP_409_CONFLICT,
            error_code="CHECK_ALREADY_CONFIRMED",
            error_message=f"盘点单 [{db_check.check_no}] 已确认，不能修改明细",
            error_details={"check_no": db_check.check_no}
        )

    db_detail = db.query(InventoryCheckDetail).filter(
        and_(
            InventoryCheckDetail.id == detail_id,
            InventoryCheckDetail.check_id == check_id
        )
    ).first()

    if not db_detail:
        raise PharmacyException(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="CHECK_DETAIL_NOT_FOUND",
            error_message=f"盘点明细ID [{detail_id}] 不存在",
            error_details={"detail_id": detail_id, "check_id": check_id}
        )

    original_data = {
        column.name: getattr(db_detail, column.name)
        for column in InventoryCheckDetail.__table__.columns
    }

    update_data = detail_update.dict(exclude_unset=True)
    changed_fields = list(update_data.keys())

    for key, value in update_data.items():
        setattr(db_detail, key, value)

    if detail_update.actual_quantity is not None:
        db_detail.difference_quantity = detail_update.actual_quantity - db_detail.system_quantity
        db_detail.is_match = (db_detail.difference_quantity == 0)

    db_detail.checked_by = operator
    db_detail.checked_at = datetime.utcnow()

    all_details = db.query(InventoryCheckDetail).filter(InventoryCheckDetail.check_id == check_id).all()
    matched_count = sum(1 for d in all_details if d.is_match)
    mismatched_count = sum(1 for d in all_details if d.is_match is False)

    db_check.matched_items = matched_count
    db_check.mismatched_items = mismatched_count
    db_check.version += 1

    db.commit()
    db.refresh(db_check)

    new_data = {
        column.name: getattr(db_detail, column.name)
        for column in InventoryCheckDetail.__table__.columns
    }

    log_operation(
        db, "UPDATE_DETAIL", "INVENTORY_CHECK", db_check.id,
        db_check.check_no, operator,
        original_data=original_data,
        new_data=new_data,
        changed_fields=changed_fields
    )

    return db_check


@app.post("/inventory-checks/{check_id}/confirm", response_model=SuccessResponse)
def confirm_inventory_check(
    check_id: int,
    confirmed_by: str,
    current_version: int,
    db: Session = Depends(get_db)
):
    db_check = db.query(InventoryCheck).filter(InventoryCheck.id == check_id).first()
    if not db_check:
        raise PharmacyException(
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="CHECK_NOT_FOUND",
            error_message=f"盘点ID [{check_id}] 不存在",
            error_details={"check_id": check_id}
        )

    if db_check.version != current_version:
        raise PharmacyException(
            status_code=status.HTTP_409_CONFLICT,
            error_code="VERSION_CONFLICT",
            error_message="盘点记录已被其他用户修改，请刷新后重试",
            error_details={
                "current_version": current_version,
                "latest_version": db_check.version
            }
        )

    if db_check.status == "confirmed":
        raise PharmacyException(
            status_code=status.HTTP_409_CONFLICT,
            error_code="CHECK_ALREADY_CONFIRMED",
            error_message=f"盘点单 [{db_check.check_no}] 已确认，不能重复确认",
            error_details={"check_no": db_check.check_no}
        )

    details = db.query(InventoryCheckDetail).filter(InventoryCheckDetail.check_id == check_id).all()
    incomplete_details = [d for d in details if d.actual_quantity is None]

    if incomplete_details:
        incomplete_medicines = [d.medicine_name for d in incomplete_details]
        raise PharmacyException(
            status_code=status.HTTP_409_CONFLICT,
            error_code="INCOMPLETE_DETAILS",
            error_message=f"存在 {len(incomplete_details)} 条明细未填写实际盘点数量，请完成后再确认",
            error_details={
                "incomplete_count": len(incomplete_details),
                "incomplete_medicines": incomplete_medicines
            }
        )

    original_data = {
        column.name: getattr(db_check, column.name)
        for column in InventoryCheck.__table__.columns
    }

    db_check.status = "confirmed"
    db_check.confirmed_by = confirmed_by
    db_check.confirmed_at = datetime.utcnow()
    db_check.version += 1

    for detail in details:
        inventory = db.query(Inventory).filter(Inventory.medicine_id == detail.medicine_id).first()
        if inventory:
            inventory.quantity = detail.actual_quantity
            inventory.last_counted_at = datetime.utcnow()
            inventory.last_counted_by = confirmed_by

    db.commit()
    db.refresh(db_check)

    new_data = {
        column.name: getattr(db_check, column.name)
        for column in InventoryCheck.__table__.columns
    }

    log_operation(
        db, "CONFIRM", "INVENTORY_CHECK", db_check.id,
        db_check.check_no, confirmed_by,
        original_data=original_data,
        new_data=new_data,
        changed_fields=["status", "confirmed_by", "confirmed_at"]
    )

    return SuccessResponse(
        message=f"盘点单 [{db_check.check_no}] 已确认，库存已同步更新",
        data={"check_no": db_check.check_no, "confirmed_at": db_check.confirmed_at.isoformat()}
    )


@app.get("/operation-logs/")
def list_operation_logs(
    business_type: Optional[str] = None,
    business_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(OperationLog)
    if business_type:
        query = query.filter(OperationLog.business_type == business_type)
    if business_id:
        query = query.filter(OperationLog.business_id == business_id)

    logs = query.order_by(OperationLog.operation_time.desc()).offset(skip).limit(limit).all()
    return logs


@app.post("/import/validate")
def validate_import_data(data: List[dict], db: Session = Depends(get_db)):
    errors = []
    warnings = []

    medicine_codes = {m.medicine_code: m for m in db.query(Medicine).all()}

    for idx, row in enumerate(data):
        row_errors = []
        row_warnings = []

        if not row.get("medicine_code"):
            row_errors.append("药品编码不能为空")
        elif row.get("medicine_code") not in medicine_codes:
            row_errors.append(f"药品编码 [{row.get('medicine_code')}] 不存在")

        if not row.get("actual_quantity") and row.get("actual_quantity") != 0:
            row_errors.append("实际盘点数量不能为空")
        elif not isinstance(row.get("actual_quantity"), int) or row.get("actual_quantity") < 0:
            row_errors.append("实际盘点数量必须是非负整数")

        if row_errors:
            errors.append({
                "row": idx + 1,
                "data": row,
                "errors": row_errors
            })

        if row_warnings:
            warnings.append({
                "row": idx + 1,
                "data": row,
                "warnings": row_warnings
            })

    return {
        "success": len(errors) == 0,
        "total_rows": len(data),
        "error_count": len(errors),
        "warning_count": len(warnings),
        "errors": errors,
        "warnings": warnings
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
