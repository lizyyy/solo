from datetime import date
from typing import List
from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session
from io import BytesIO
from openpyxl import Workbook

from database import engine, get_db, Base
from models import (
    Customer, LoanApplication, CustomerDocument, CancellationRecord,
    FollowupRecord, RiskAssessment, CancellationList, ApplicationStatus,
    CancellationReason
)
from schemas import (
    CustomerCreate, CustomerResponse,
    LoanApplicationCreate, LoanApplicationResponse,
    DocumentCreate, DocumentResponse,
    CancellationCreate, CancellationResponse, CancellationResult,
    FollowupCreate, FollowupResponse,
    StatusChangeRequest, StatusChangeResponse,
    RiskAssessmentCreate, RiskAssessmentResponse,
    CancellationListSummary, CancellationListItemResponse,
    ApplicationDetailResponse, ErrorResponse
)
from services import (
    generate_no, ApplicationStateMachine, CancellationService,
    DocumentValidator, SpecialCaseDetector, FollowupService,
    CancellationListService
)

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="消费贷批量撤件系统",
    description="信贷运营撤件留痕管理系统 - 客户反悔、资料过期、风控拒绝分类管理",
    version="1.0.0"
)


class AppException(HTTPException):
    def __init__(self, detail: str, code: str = None, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(status_code=status_code, detail=detail)
        self.code = code


@app.exception_handler(AppException)
async def app_exception_handler(request, exc):
    from fastapi.responses import JSONResponse
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail, "code": exc.code}
    )


@app.get("/")
def root():
    return {
        "message": "消费贷批量撤件系统",
        "version": "1.0.0",
        "docs": "/docs"
    }


@app.post("/customers/", response_model=CustomerResponse, status_code=status.HTTP_201_CREATED)
def create_customer(customer: CustomerCreate, db: Session = Depends(get_db)):
    existing = db.query(Customer).filter(Customer.id_card == customer.id_card).first()
    if existing:
        raise AppException(detail="该身份证号已存在", code="CUSTOMER_EXISTS")

    db_customer = Customer(**customer.model_dump())
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer


@app.get("/customers/{customer_id}", response_model=CustomerResponse)
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    customer = db.query(Customer).get(customer_id)
    if not customer:
        raise AppException(detail="客户不存在", code="CUSTOMER_NOT_FOUND", status_code=404)
    return customer


@app.post("/applications/", response_model=LoanApplicationResponse, status_code=status.HTTP_201_CREATED)
def create_application(app: LoanApplicationCreate, db: Session = Depends(get_db)):
    customer = db.query(Customer).get(app.customer_id)
    if not customer:
        raise AppException(detail="客户不存在", code="CUSTOMER_NOT_FOUND")

    db_app = LoanApplication(
        application_no=generate_no("LO"),
        **app.model_dump()
    )
    db.add(db_app)
    db.commit()
    db.refresh(db_app)
    return db_app


@app.get("/applications/{application_id}", response_model=ApplicationDetailResponse)
def get_application_detail(application_id: int, db: Session = Depends(get_db)):
    application = db.query(LoanApplication).get(application_id)
    if not application:
        raise AppException(detail="申请不存在", code="APP_NOT_FOUND", status_code=404)

    warnings = SpecialCaseDetector.detect(db, application)
    _, doc_warnings = DocumentValidator.check_doc_expiry(db, application_id)
    warnings.extend(doc_warnings)

    return ApplicationDetailResponse(
        application=application,
        documents=application.documents,
        risk_results=application.risk_results,
        cancellations=application.cancellations,
        followups=application.followups,
        warnings=warnings
    )


@app.get("/applications/", response_model=List[LoanApplicationResponse])
def list_applications(
    status: str = None,
    customer_id: int = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(LoanApplication)
    if status:
        query = query.filter(LoanApplication.status == status)
    if customer_id:
        query = query.filter(LoanApplication.customer_id == customer_id)
    return query.offset(skip).limit(limit).all()


@app.put("/applications/{application_id}/status", response_model=StatusChangeResponse)
def change_status(
    application_id: int,
    request: StatusChangeRequest,
    db: Session = Depends(get_db)
):
    application = db.query(LoanApplication).get(application_id)
    if not application:
        raise AppException(detail="申请不存在", code="APP_NOT_FOUND", status_code=404)

    try:
        success, message = ApplicationStateMachine.transition(
            db, application, request.to_status, request.operator, request.remark
        )
        return StatusChangeResponse(
            success=success,
            message=message,
            from_status=application.status if not success else None,
            to_status=request.to_status if success else None
        )
    except ValueError as e:
        raise AppException(detail=f"无效的状态: {str(e)}", code="INVALID_STATUS")


@app.post("/documents/", response_model=DocumentResponse, status_code=status.HTTP_201_CREATED)
def add_document(doc: DocumentCreate, db: Session = Depends(get_db)):
    application = db.query(LoanApplication).get(doc.application_id)
    if not application:
        raise AppException(detail="申请不存在", code="APP_NOT_FOUND")

    db_doc = CustomerDocument(**doc.model_dump())
    db.add(db_doc)
    db.commit()
    db.refresh(db_doc)

    DocumentValidator.check_doc_expiry(db, doc.application_id)

    return db_doc


@app.get("/applications/{application_id}/documents", response_model=List[DocumentResponse])
def list_documents(application_id: int, db: Session = Depends(get_db)):
    return db.query(CustomerDocument).filter(
        CustomerDocument.application_id == application_id
    ).all()


@app.post("/risk-assessments/", response_model=RiskAssessmentResponse, status_code=status.HTTP_201_CREATED)
def add_risk_assessment(risk: RiskAssessmentCreate, db: Session = Depends(get_db)):
    application = db.query(LoanApplication).get(risk.application_id)
    if not application:
        raise AppException(detail="申请不存在", code="APP_NOT_FOUND")

    db_risk = RiskAssessment(**risk.model_dump())
    db.add(db_risk)
    db.commit()
    db.refresh(db_risk)
    return db_risk


@app.post("/cancellations/", response_model=CancellationResult)
def create_cancellation(cancel: CancellationCreate, db: Session = Depends(get_db)):
    application = db.query(LoanApplication).get(cancel.application_id)
    if not application:
        raise AppException(detail="申请不存在", code="APP_NOT_FOUND")

    valid_reasons = [r.value for r in CancellationReason]
    if cancel.reason not in valid_reasons:
        raise AppException(
            detail=f"无效的撤件原因，有效值: {', '.join(valid_reasons)}",
            code="INVALID_REASON"
        )

    success, message, warnings = CancellationService.cancel_application(
        db, application, cancel.reason, cancel.reason_detail, cancel.operator
    )

    if not success:
        return CancellationResult(
            success=False,
            message=message,
            warnings=warnings
        )

    cancellation = CancellationService.check_duplicate_cancellation(
        db, cancel.application_id, cancel.reason
    )

    return CancellationResult(
        success=True,
        message=message,
        warnings=warnings,
        cancellation=cancellation
    )


@app.get("/cancellations/", response_model=List[CancellationResponse])
def list_cancellations(
    reason: str = None,
    application_id: int = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(CancellationRecord)
    if reason:
        query = query.filter(CancellationRecord.reason == reason)
    if application_id:
        query = query.filter(CancellationRecord.application_id == application_id)
    return query.offset(skip).limit(limit).all()


@app.post("/followups/", response_model=FollowupResponse, status_code=status.HTTP_201_CREATED)
def add_followup(followup: FollowupCreate, db: Session = Depends(get_db)):
    application = db.query(LoanApplication).get(followup.application_id)
    if not application:
        raise AppException(detail="申请不存在", code="APP_NOT_FOUND")

    return FollowupService.add_followup(
        db, followup.application_id, followup.followup_type,
        followup.content, followup.operator, followup.parent_id
    )


@app.get("/applications/{application_id}/followups", response_model=List[FollowupResponse])
def list_followups(application_id: int, db: Session = Depends(get_db)):
    return FollowupService.get_followup_history(db, application_id)


@app.post("/cancellation-lists/generate", response_model=CancellationListSummary)
def generate_cancellation_list(
    batch_date: date = None,
    operator: str = "system",
    db: Session = Depends(get_db)
):
    if not batch_date:
        batch_date = date.today()

    cancel_list = CancellationListService.generate_daily_list(db, batch_date, operator)
    return cancel_list


@app.get("/cancellation-lists/", response_model=List[CancellationListSummary])
def list_cancellation_lists(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return db.query(CancellationList).order_by(CancellationList.created_at.desc()).offset(skip).limit(limit).all()


@app.get("/cancellation-lists/{list_id}/items", response_model=List[CancellationListItemResponse])
def get_cancellation_list_items(list_id: int, db: Session = Depends(get_db)):
    cancel_list = db.query(CancellationList).get(list_id)
    if not cancel_list:
        raise AppException(detail="撤件清单不存在", code="LIST_NOT_FOUND", status_code=404)

    return cancel_list.items


@app.get("/cancellation-lists/{list_id}/export")
def export_cancellation_list(list_id: int, db: Session = Depends(get_db)):
    cancel_list = db.query(CancellationList).get(list_id)
    if not cancel_list:
        raise AppException(detail="撤件清单不存在", code="LIST_NOT_FOUND", status_code=404)

    items = CancellationListService.get_list_data(db, list_id)

    wb = Workbook()
    ws = wb.active
    ws.title = f"撤件清单_{cancel_list.batch_date}"

    headers = [
        "客户姓名", "身份证号", "申请编号", "贷款金额",
        "撤件原因", "复核状态", "风险提示"
    ]
    ws.append(headers)

    for item in items:
        ws.append([
            item["customer_name"],
            item["id_card"],
            item["application_no"],
            item["loan_amount"],
            item["cancellation_reason"],
            item["review_status"],
            item["warnings"] or ""
        ])

    for col in ws.columns:
        max_length = 0
        column = col[0].column_letter
        for cell in col:
            try:
                if len(str(cell.value)) > max_length:
                    max_length = len(str(cell.value))
            except:
                pass
        adjusted_width = min(max_length + 2, 50)
        ws.column_dimensions[column].width = adjusted_width

    buffer = BytesIO()
    wb.save(buffer)
    buffer.seek(0)

    return StreamingResponse(
        buffer,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={
            "Content-Disposition": f"attachment; filename=cancellation_list_{cancel_list.list_no}.xlsx"
        }
    )


@app.get("/pending-review/", response_model=List[LoanApplicationResponse])
def list_pending_review(
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return db.query(LoanApplication).filter(
        LoanApplication.review_status == "待复核"
    ).offset(skip).limit(limit).all()


@app.get("/special-cases/detected")
def get_special_cases(db: Session = Depends(get_db)):
    applications = db.query(LoanApplication).filter(
        LoanApplication.status != ApplicationStatus.CANCELLED
    ).all()

    cases = []
    for app in applications:
        warnings = SpecialCaseDetector.detect(db, app)
        if warnings:
            cases.append({
                "application_no": app.application_no,
                "customer_name": app.customer.name if app.customer else None,
                "status": app.status,
                "warnings": warnings
            })

    return {
        "total_count": len(cases),
        "cases": cases
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)