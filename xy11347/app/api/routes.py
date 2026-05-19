from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from typing import List
from app.core.database import get_db
from app.core.config import get_settings
from app.core.security import create_access_token, verify_password, get_password_hash
from app.models.models import User, UserRole, QCStatus
from app.schemas.schemas import (
    UserResponse, Token, OrderResponse, ColorMeasurementResponse,
    ReworkRecordResponse, QCReportResponse, ImportResult,
    ReviewRecordCreate, ErrorCorrection
)
from app.repositories.repositories import (
    UserRepository, OrderRepository, ColorMeasurementRepository,
    ReworkRecordRepository, QCReportRepository, ImportErrorRecordRepository
)
from app.services.services import (
    ImportService, QCReportService, ReviewService, TrendAnalysisService,
    ExportService, QCJudgmentService
)

settings = get_settings()
router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")


async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    from jose import JWTError, jwt
    credentials_exception = HTTPException(
        status_code=401,
        detail="无法验证凭据",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = UserRepository(db).get_by_username(username)
    if user is None:
        raise credentials_exception
    return user


@router.post("/token", response_model=Token)
async def login_for_access_token(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = UserRepository(db).get_by_username(form_data.username)
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=401,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/users/", response_model=UserResponse)
def create_user(
    username: str,
    password: str,
    full_name: str = None,
    role: UserRole = UserRole.QC_OPERATOR,
    db: Session = Depends(get_db)
):
    from app.schemas.schemas import UserCreate
    user_repo = UserRepository(db)
    if user_repo.get_by_username(username):
        raise HTTPException(status_code=400, detail="用户名已存在")
    user = UserCreate(username=username, password=password, full_name=full_name, role=role)
    return user_repo.create(user)


@router.get("/users/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user


@router.post("/import/color-csv", response_model=ImportResult)
async def import_color_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    content = await file.read()
    service = ImportService(db)
    return service.import_color_csv(content, file.filename, current_user.username)


@router.post("/import/order-json", response_model=ImportResult)
async def import_order_json(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    content = await file.read()
    service = ImportService(db)
    return service.import_order_json(content, file.filename, current_user.username)


@router.post("/import/rework-notes", response_model=ImportResult)
async def import_rework_notes(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    content = await file.read()
    service = ImportService(db)
    return service.import_rework_notes(content, file.filename, current_user.username)


@router.get("/import/errors")
def get_import_errors(
    resolved: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = ImportErrorRecordRepository(db)
    if not resolved:
        return repo.get_unresolved()
    return repo.get_all()


@router.post("/import/errors/{error_id}/resolve")
def resolve_import_error(
    error_id: int,
    correction: ErrorCorrection,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = ImportErrorRecordRepository(db)
    return repo.mark_resolved(error_id, current_user.username, correction.correction_note)


@router.get("/orders/", response_model=List[OrderResponse])
def get_orders(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return OrderRepository(db).get_all(skip, limit)


@router.get("/orders/{order_no}", response_model=OrderResponse)
def get_order(
    order_no: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    order = OrderRepository(db).get_by_order_no(order_no)
    if not order:
        raise HTTPException(status_code=404, detail="订单不存在")
    return order


@router.post("/orders/{order_id}/evaluate")
def evaluate_order(
    order_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = QCJudgmentService(db)
    return service.evaluate_order(order_id)


@router.get("/measurements/", response_model=List[ColorMeasurementResponse])
def get_measurements(
    order_no: str = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = ColorMeasurementRepository(db)
    if order_no:
        return repo.get_by_order_no(order_no)
    return repo.get_all(skip, limit)


@router.get("/reworks/", response_model=List[ReworkRecordResponse])
def get_rework_records(
    order_no: str = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    repo = ReworkRecordRepository(db)
    if order_no:
        return repo.get_by_order_no(order_no)
    return repo.get_all(skip, limit)


@router.post("/qc-reports/generate/{order_no}", response_model=QCReportResponse)
def generate_qc_report(
    order_no: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = QCReportService(db)
    try:
        return service.generate_report(order_no, current_user.username)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/qc-reports/", response_model=List[QCReportResponse])
def get_qc_reports(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    return QCReportRepository(db).get_all(skip, limit)


@router.get("/qc-reports/{report_id}", response_model=QCReportResponse)
def get_qc_report(
    report_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    report = QCReportRepository(db).get_by_id(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="质检报告不存在")
    return report


@router.post("/qc-reports/{report_id}/review")
def review_report(
    report_id: int,
    review: ReviewRecordCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ReviewService(db)
    try:
        return service.perform_review(
            report_id,
            review.review_action,
            review.review_notes,
            review.after_status,
            current_user.username
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/qc-reports/{report_id}/export")
def export_qc_report(
    report_id: int,
    include_sensitive: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = ExportService(db)
    try:
        return service.export_qc_report(report_id, include_sensitive)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/trend/daily")
def get_daily_trend(
    paper_batch: str = None,
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = TrendAnalysisService(db)
    return service.get_daily_trend(paper_batch, days)


@router.get("/trend/compare-paper-batches")
def compare_paper_batches(
    days: int = 30,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    service = TrendAnalysisService(db)
    return service.compare_paper_batches(days)


@router.get("/qc-statuses")
def get_qc_statuses():
    return [status.value for status in QCStatus]


@router.get("/user-roles")
def get_user_roles():
    return [role.value for role in UserRole]
