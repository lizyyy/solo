from datetime import datetime, timedelta
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Query
from fastapi.responses import Response
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db, engine, Base
from app.core.security import verify_password, create_access_token, mask_sensitive_data
from app.schemas import (
    UserCreate, UserResponse, Token, TokenData,
    MedicineCreate, MedicineResponse,
    BatchCreate, BatchResponse, BatchUpdate, BatchAction, BatchDetailResponse,
    InventoryResponse,
    RuleResultResponse,
    OperationLogResponse,
    ImportSummary
)
from app.models.enums import BatchStatus, UserRole
from app.repositories.user_repository import UserRepository
from app.repositories.medicine_repository import MedicineRepository
from app.repositories.batch_repository import BatchRepository
from app.repositories.inventory_repository import InventoryRepository
from app.repositories.rule_result_repository import RuleResultRepository
from app.repositories.operation_log_repository import OperationLogRepository
from app.services.batch_service import BatchService
from app.services.import_export_service import ImportExportService
from app.services.rule_engine import RuleEngine

Base.metadata.create_all(bind=engine)

app = FastAPI(title="社区药房库存管理系统", version="1.0.0")

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

user_repo = UserRepository()
medicine_repo = MedicineRepository()
batch_repo = BatchRepository()
inventory_repo = InventoryRepository()
rule_result_repo = RuleResultRepository()
operation_log_repo = OperationLogRepository()

batch_service = BatchService()
import_export_service = ImportExportService()
rule_engine = RuleEngine()


async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
        token_data = TokenData(username=username)
    except JWTError:
        raise credentials_exception
    user = user_repo.get_by_username(db, username=token_data.username)
    if user is None:
        raise credentials_exception
    return user


async def get_current_active_user(current_user = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="用户已禁用")
    return current_user


def require_role(allowed_roles: List[UserRole]):
    def role_checker(current_user = Depends(get_current_active_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="权限不足")
        return current_user
    return role_checker


@app.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = user_repo.authenticate(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "user_id": user.id}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@app.post("/users", response_model=UserResponse)
def create_user(user: UserCreate, db: Session = Depends(get_db)):
    db_user = user_repo.get_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="用户名已存在")
    return user_repo.create(db, user.username, user.password, user.full_name, user.role, user.phone, user.email)


@app.get("/users/me", response_model=UserResponse)
def read_users_me(current_user = Depends(get_current_active_user)):
    return current_user


@app.post("/medicines", response_model=MedicineResponse)
def create_medicine(medicine: MedicineCreate, db: Session = Depends(get_db), _ = Depends(require_role([UserRole.ADMIN, UserRole.WAREHOUSE_KEEPER]))):
    existing = medicine_repo.get_by_code(db, medicine.code)
    if existing:
        raise HTTPException(status_code=400, detail="药品编码已存在")
    return medicine_repo.create(
        db, medicine.code, medicine.name, medicine.type, medicine.manufacturer,
        medicine.specification, medicine.unit, medicine.temperature_min,
        medicine.temperature_max, medicine.description
    )


@app.get("/medicines", response_model=List[MedicineResponse])
def list_medicines(skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _ = Depends(get_current_active_user)):
    return medicine_repo.list_all(db, skip=skip, limit=limit)


@app.post("/batches", response_model=BatchResponse)
def create_batch(batch: BatchCreate, db: Session = Depends(get_db), current_user = Depends(get_current_active_user)):
    new_batch, _, _ = batch_service.create_batch(
        db, batch.batch_no, batch.medicine_id, batch.quantity,
        batch.arrival_temperature, batch.temperature_photo_path,
        batch.damage_photo_path, batch.damage_quantity, batch.damage_description,
        batch.production_date, batch.expiry_date, batch.unit, batch.remarks,
        current_user.id
    )
    return new_batch


@app.get("/batches", response_model=List[BatchResponse])
def list_batches(status: Optional[BatchStatus] = None, medicine_id: Optional[int] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _ = Depends(get_current_active_user)):
    query = db.query(Batch)
    if status:
        query = query.filter(Batch.status == status)
    if medicine_id:
        query = query.filter(Batch.medicine_id == medicine_id)
    return query.order_by(Batch.created_at.desc()).offset(skip).limit(limit).all()


@app.get("/batches/{batch_id}", response_model=BatchDetailResponse)
def get_batch_detail(batch_id: int, db: Session = Depends(get_db), _ = Depends(get_current_active_user)):
    batch = db.query(Batch).filter(Batch.id == batch_id).first()
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    inventory = inventory_repo.get_by_batch(db, batch_id)
    rule_results = rule_result_repo.get_by_batch(db, batch_id)
    operation_logs = operation_log_repo.get_by_batch(db, batch_id)
    return {
        "batch": batch,
        "inventory": inventory,
        "rule_results": rule_results,
        "operation_logs": operation_logs
    }


@app.post("/batches/{batch_id}/receive", response_model=BatchResponse)
def receive_batch(batch_id: int, db: Session = Depends(get_db), current_user = Depends(get_current_active_user)):
    batch, success, reasons = batch_service.receive_batch(db, batch_id, current_user.id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    if not success:
        raise HTTPException(status_code=400, detail="; ".join(reasons))
    return batch


@app.post("/batches/{batch_id}/isolate", response_model=BatchResponse)
def isolate_batch(batch_id: int, action: BatchAction, db: Session = Depends(get_db), current_user = Depends(get_current_active_user)):
    batch, success, reasons = batch_service.isolate_batch(db, batch_id, current_user.id, action.reason or "手动隔离")
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    if not success:
        raise HTTPException(status_code=400, detail="; ".join(reasons))
    return batch


@app.post("/batches/{batch_id}/review", response_model=BatchResponse)
def review_batch(batch_id: int, db: Session = Depends(get_db), current_user = Depends(require_role([UserRole.ADMIN, UserRole.REVIEWER, UserRole.WAREHOUSE_KEEPER]))):
    batch, success, reasons = batch_service.review_batch(db, batch_id, current_user.id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    if not success:
        raise HTTPException(status_code=400, detail="; ".join(reasons))
    return batch


@app.post("/batches/{batch_id}/approve", response_model=BatchResponse)
def approve_batch(batch_id: int, db: Session = Depends(get_db), current_user = Depends(require_role([UserRole.ADMIN, UserRole.REVIEWER]))):
    batch, success, reasons = batch_service.approve_batch(db, batch_id, current_user.id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    if not success:
        raise HTTPException(status_code=400, detail="; ".join(reasons))
    return batch


@app.post("/batches/{batch_id}/release", response_model=BatchResponse)
def release_batch(batch_id: int, db: Session = Depends(get_db), current_user = Depends(require_role([UserRole.ADMIN, UserRole.WAREHOUSE_KEEPER]))):
    batch, success, reasons = batch_service.release_batch(db, batch_id, current_user.id)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    if not success:
        raise HTTPException(status_code=400, detail="; ".join(reasons))
    return batch


@app.post("/batches/{batch_id}/return", response_model=BatchResponse)
def return_batch(batch_id: int, action: BatchAction, db: Session = Depends(get_db), current_user = Depends(get_current_active_user)):
    batch, success, reasons = batch_service.return_batch(db, batch_id, current_user.id, action.reason or "退回供应商")
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    if not success:
        raise HTTPException(status_code=400, detail="; ".join(reasons))
    return batch


@app.post("/import/batches", response_model=ImportSummary)
def import_batches(file: UploadFile = File(...), db: Session = Depends(get_db), current_user = Depends(get_current_active_user)):
    if not file.filename.endswith(('.xlsx', '.xls')):
        raise HTTPException(status_code=400, detail="只支持Excel文件")
    content = file.file.read()
    results, success_count, skip_count = import_export_service.import_from_excel(db, content, current_user.id)
    return {"results": results, "success_count": success_count, "skip_count": skip_count}


@app.get("/export/batches")
def export_batches(status: Optional[BatchStatus] = None, start_date: Optional[datetime] = None, end_date: Optional[datetime] = None, include_sensitive: bool = False, db: Session = Depends(get_db), current_user = Depends(get_current_active_user)):
    if include_sensitive and current_user.role not in [UserRole.ADMIN]:
        include_sensitive = False
    excel_data = import_export_service.export_to_excel(db, start_date=start_date, end_date=end_date, status_filter=status, include_sensitive=include_sensitive)
    filename = f"batches_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return Response(content=excel_data, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename={filename}"})


@app.get("/export/logs")
def export_logs(start_date: Optional[datetime] = None, end_date: Optional[datetime] = None, batch_id: Optional[int] = None, db: Session = Depends(get_db), _ = Depends(get_current_active_user)):
    excel_data = import_export_service.export_operation_logs(db, start_date=start_date, end_date=end_date, batch_id=batch_id)
    filename = f"logs_export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.xlsx"
    return Response(content=excel_data, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename={filename}"})


@app.get("/export/monthly-reconciliation")
def export_monthly_reconciliation(year: int, month: int, db: Session = Depends(get_db), _ = Depends(get_current_active_user)):
    excel_data = import_export_service.export_monthly_reconciliation(db, year, month)
    filename = f"reconciliation_{year}_{month}.xlsx"
    return Response(content=excel_data, media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers={"Content-Disposition": f"attachment; filename={filename}"})


@app.get("/inventory", response_model=List[InventoryResponse])
def list_inventory(medicine_id: Optional[int] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _ = Depends(get_current_active_user)):
    query = db.query(Inventory)
    if medicine_id:
        query = query.filter(Inventory.medicine_id == medicine_id)
    return query.order_by(Inventory.created_at.desc()).offset(skip).limit(limit).all()


@app.get("/logs/operations", response_model=List[OperationLogResponse])
def list_operation_logs(batch_id: Optional[int] = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db), _ = Depends(get_current_active_user)):
    if batch_id:
        return operation_log_repo.get_by_batch(db, batch_id)
    return operation_log_repo.list_all(db, skip=skip, limit=limit)


@app.get("/rules/{batch_id}", response_model=List[RuleResultResponse])
def get_rule_results(batch_id: int, db: Session = Depends(get_db), _ = Depends(get_current_active_user)):
    return rule_result_repo.get_by_batch(db, batch_id)


from app.models.models import User, Medicine, Batch, Inventory


@app.on_event("startup")
def create_initial_data():
    db = next(get_db())
    admin = user_repo.get_by_username(db, "admin")
    if not admin:
        user_repo.create(db, "admin", "admin123", "系统管理员", UserRole.ADMIN, "138****0000", "a****@***********")
    warehouse_keeper = user_repo.get_by_username(db, "keeper")
    if not warehouse_keeper:
        user_repo.create(db, "keeper", "keeper123", "库管员", UserRole.WAREHOUSE_KEEPER, "139****1111", "k*****@***********")
    reviewer = user_repo.get_by_username(db, "reviewer")
    if not reviewer:
        user_repo.create(db, "reviewer", "reviewer123", "复核员", UserRole.REVIEWER, "137****2222", "r*******@***********")

    vaccine = medicine_repo.get_by_code(db, "VAC001")
    if not vaccine:
        medicine_repo.create(db, "VAC001", "新冠疫苗", MedicineType.VACCINE, "某制药厂", "0.5ml/支", "支", 2.0, 8.0, "需2-8℃冷藏保存")
    insulin = medicine_repo.get_by_code(db, "INS001")
    if not insulin:
        medicine_repo.create(db, "INS001", "甘精胰岛素注射液", MedicineType.INSULIN, "某制药厂", "3ml:300单位", "支", 2.0, 8.0, "需2-8℃冷藏保存，避免冷冻")
    db.close()
