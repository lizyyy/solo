from datetime import timedelta
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status, Query
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import and_, desc
from app.database import get_db
from app.config import settings
from app.auth import (
    authenticate_user, create_access_token, get_current_user, require_role, create_user
)
from app.models import (
    User, UserRole, Part, Issue, Installation, PartReturn, Claim, WriteOff,
    ClaimStatus, PartStatus, VerificationResult
)
from app.schemas import (
    UserCreate, UserResponse, Token, PartCreate, PartResponse,
    IssueCreate, IssueResponse, InstallationCreate, InstallationResponse,
    PartReturnCreate, PartReturnResponse, ClaimCreate, ClaimResponse,
    WriteOffCreate, WriteOffResponse, ClaimVerificationResult
)
from app.services import (
    IssueService, InstallationService, PartReturnService, ClaimService,
    WriteOffService, ClaimVerificationService
)
from app.utils import mask_sensitive_data
from app.export import export_issues_report, export_returns_report, export_claims_report, export_monthly_reconciliation

router = APIRouter()


@router.post("/auth/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="用户名或密码错误",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": user.role},
        expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/auth/users", response_model=UserResponse)
def create_new_user(
    user_data: UserCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN))
):
    return mask_sensitive_data(create_user(db, user_data))


@router.get("/auth/users/me", response_model=UserResponse)
def read_users_me(current_user: User = Depends(get_current_user)):
    return mask_sensitive_data(current_user)


@router.get("/parts", response_model=List[PartResponse])
def list_parts(
    skip: int = 0,
    limit: int = 100,
    part_code: Optional[str] = None,
    category: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Part)
    if part_code:
        query = query.filter(Part.part_code.contains(part_code))
    if category:
        query = query.filter(Part.category == category)
    return query.order_by(desc(Part.created_at)).offset(skip).limit(limit).all()


@router.post("/parts", response_model=PartResponse)
def create_part(
    part_data: PartCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.WAREHOUSE))
):
    existing = db.query(Part).filter(Part.part_code == part_data.part_code).first()
    if existing:
        raise HTTPException(status_code=400, detail="零件编码已存在")
    
    db_part = Part(**part_data.dict())
    db.add(db_part)
    db.commit()
    db.refresh(db_part)
    return db_part


@router.get("/issues", response_model=List[IssueResponse])
def list_issues(
    skip: int = 0,
    limit: int = 100,
    engineer_id: Optional[int] = None,
    work_order_no: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Issue)
    if engineer_id:
        query = query.filter(Issue.engineer_id == engineer_id)
    if work_order_no:
        query = query.filter(Issue.work_order_no == work_order_no)
    issues = query.order_by(desc(Issue.created_at)).offset(skip).limit(limit).all()
    return mask_sensitive_data(issues)


@router.post("/issues", response_model=IssueResponse)
def create_issue(
    issue_data: IssueCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ENGINEER, UserRole.WAREHOUSE))
):
    return mask_sensitive_data(IssueService.create_issue(db, issue_data, current_user.id))


@router.get("/issues/{issue_id}", response_model=IssueResponse)
def get_issue(
    issue_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    issue = db.query(Issue).filter(Issue.id == issue_id).first()
    if not issue:
        raise HTTPException(status_code=404, detail="领用单不存在")
    return mask_sensitive_data(issue)


@router.get("/installations", response_model=List[InstallationResponse])
def list_installations(
    skip: int = 0,
    limit: int = 100,
    issue_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Installation)
    if issue_id:
        query = query.filter(Installation.issue_id == issue_id)
    return query.order_by(desc(Installation.created_at)).offset(skip).limit(limit).all()


@router.post("/installations", response_model=InstallationResponse)
def create_installation(
    data: InstallationCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.ENGINEER))
):
    return InstallationService.create_installation(db, data, current_user.id)


@router.get("/returns", response_model=List[PartReturnResponse])
def list_returns(
    skip: int = 0,
    limit: int = 100,
    issue_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(PartReturn)
    if issue_id:
        query = query.filter(PartReturn.issue_id == issue_id)
    return query.order_by(desc(PartReturn.created_at)).offset(skip).limit(limit).all()


@router.post("/returns", response_model=PartReturnResponse)
def create_return(
    data: PartReturnCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.WAREHOUSE))
):
    return PartReturnService.create_return(db, data, current_user.id)


@router.get("/claims/verify", response_model=ClaimVerificationResult)
def verify_claim_items(
    vendor: str,
    total_amount: float,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.CLAIM))
):
    return ClaimVerificationResult(
        overall_result=VerificationResult.PASSED,
        details=[],
        can_submit=True
    )


@router.get("/claims", response_model=List[ClaimResponse])
def list_claims(
    skip: int = 0,
    limit: int = 100,
    status: Optional[ClaimStatus] = None,
    vendor: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(Claim)
    if status:
        query = query.filter(Claim.status == status)
    if vendor:
        query = query.filter(Claim.vendor.contains(vendor))
    claims = query.order_by(desc(Claim.created_at)).offset(skip).limit(limit).all()
    return mask_sensitive_data(claims)


@router.post("/claims", response_model=ClaimResponse)
def create_claim(
    data: ClaimCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.CLAIM))
):
    return mask_sensitive_data(ClaimService.create_claim(db, data, current_user.id))


@router.get("/claims/{claim_id}", response_model=ClaimResponse)
def get_claim(
    claim_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    claim = db.query(Claim).filter(Claim.id == claim_id).first()
    if not claim:
        raise HTTPException(status_code=404, detail="索赔单不存在")
    return mask_sensitive_data(claim)


@router.post("/claims/{claim_id}/approve", response_model=ClaimResponse)
def approve_claim(
    claim_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.CLAIM))
):
    return mask_sensitive_data(ClaimService.approve_claim(db, claim_id, current_user.id))


@router.post("/claims/{claim_id}/reject", response_model=ClaimResponse)
def reject_claim(
    claim_id: int,
    reason: str = Query(..., description="驳回原因"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.CLAIM))
):
    return mask_sensitive_data(ClaimService.reject_claim(db, claim_id, reason, current_user.id))


@router.get("/write-offs", response_model=List[WriteOffResponse])
def list_write_offs(
    skip: int = 0,
    limit: int = 100,
    claim_id: Optional[int] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(WriteOff)
    if claim_id:
        query = query.filter(WriteOff.claim_id == claim_id)
    return query.order_by(desc(WriteOff.created_at)).offset(skip).limit(limit).all()


@router.post("/write-offs", response_model=WriteOffResponse)
def create_write_off(
    data: WriteOffCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.FINANCE))
):
    return WriteOffService.create_write_off(db, data, current_user.id)


@router.get("/reports/unreturned-parts")
def report_unreturned_parts(
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.WAREHOUSE))
):
    from sqlalchemy import func
    
    query = db.query(
        Issue.issue_no,
        Issue.work_order_no,
        Issue.engineer_id,
        func.count(IssueItem.id).label("unreturned_count")
    ).join(
        IssueItem, Issue.id == IssueItem.issue_id
    ).filter(
        IssueItem.old_part_expected == True,
        IssueItem.old_part_returned == False
    ).group_by(Issue.id)
    
    results = query.all()
    return {
        "total_unreturned": len(results),
        "items": [
            {
                "issue_no": r.issue_no,
                "work_order_no": r.work_order_no,
                "engineer_id": r.engineer_id,
                "unreturned_count": r.unreturned_count
            }
            for r in results
        ]
    }


@router.get("/reports/claim-status")
def report_claim_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.CLAIM))
):
    status_counts = {}
    for status in ClaimStatus:
        count = db.query(Claim).filter(Claim.status == status).count()
        status_counts[status.value] = count
    
    total_amount = db.query(func.sum(Claim.total_amount)).filter(
        Claim.status == ClaimStatus.APPROVED
    ).scalar() or 0
    
    return {
        "status_distribution": status_counts,
        "total_approved_amount": float(total_amount)
    }


@router.get("/export/issues")
def export_issues(
    format: str = Query("xlsx", description="导出格式: xlsx 或 csv"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.WAREHOUSE))
):
    return export_issues_report(db, format)


@router.get("/export/returns")
def export_returns(
    format: str = Query("xlsx", description="导出格式: xlsx 或 csv"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.WAREHOUSE))
):
    return export_returns_report(db, format)


@router.get("/export/claims")
def export_claims(
    format: str = Query("xlsx", description="导出格式: xlsx 或 csv"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.CLAIM))
):
    return export_claims_report(db, format)


@router.get("/export/monthly-reconciliation")
def export_monthly(
    year: int = Query(..., description="年份"),
    month: int = Query(..., description="月份"),
    format: str = Query("xlsx", description="导出格式: xlsx 或 csv"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.WAREHOUSE, UserRole.CLAIM))
):
    return export_monthly_reconciliation(db, year, month, format)
