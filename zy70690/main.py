from fastapi import FastAPI, Depends, HTTPException, status, Request
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.orm import Session
from typing import List, Optional
from database import init_db, get_db, SessionLocal
from models import MaterialStatus, ParticipantType, IDCardType, ReportStatus
from schemas import (
    ParticipantCreate, ParticipantResponse, ParticipantUpdate,
    PersonMaterialCreate, PersonMaterialResponse, PersonMaterialUpdate,
    ReturnReasonCreate, ReturnReasonResponse,
    MaterialSubmitRequest, MaterialReturnRequest, MaterialApproveRequest,
    BatchCreate, BatchResponse, BatchAddMaterialsRequest, BatchReturnMaterialsRequest,
    ReportGenerateRequest, ReportResponse,
    IDCardRuleResponse,
    ErrorResponse, ErrorCodes
)
from services import (
    ParticipantService, MaterialService, ReturnReasonService,
    BatchService, ReportService, BusinessException, init_default_data,
    IDCardRuleService
)
import pandas as pd
from io import BytesIO
from fastapi.responses import StreamingResponse

app = FastAPI(title="展会制证材料退回批次报告后端API", version="1.0.0")

@app.exception_handler(BusinessException)
async def business_exception_handler(request: Request, exc: BusinessException):
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error_code": exc.error_code,
            "message": exc.message,
            "details": exc.details
        }
    )

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    missing_fields = []
    for error in exc.errors():
        if error["type"] in ["value_error.missing", "missing"]:
            field = ".".join(str(loc) for loc in error["loc"])
            missing_fields.append(field)
    
    if missing_fields:
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            content={
                "error_code": ErrorCodes.MISSING_FIELDS,
                "message": "缺少必填字段",
                "details": {"missing_fields": missing_fields}
            }
        )
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content={
            "error_code": ErrorCodes.VALIDATION_ERROR,
            "message": "请求参数验证失败",
            "details": {"errors": exc.errors()}
        }
    )

@app.on_event("startup")
def startup_event():
    init_db()
    db = SessionLocal()
    init_default_data(db)
    db.close()

@app.get("/")
def root():
    return {"message": "展会制证材料退回批次报告系统", "version": "1.0.0"}

@app.post("/participants", response_model=ParticipantResponse, tags=["参展主体"])
def create_participant(participant: ParticipantCreate, db: Session = Depends(get_db)):
    return ParticipantService.create_participant(db, participant)

@app.get("/participants", response_model=List[ParticipantResponse], tags=["参展主体"])
def list_participants(
    type: Optional[ParticipantType] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return ParticipantService.list_participants(db, type, skip, limit)

@app.get("/participants/{participant_code}", response_model=ParticipantResponse, tags=["参展主体"])
def get_participant(participant_code: str, db: Session = Depends(get_db)):
    participant = ParticipantService.get_participant_by_code(db, participant_code)
    if not participant:
        raise BusinessException(ErrorCodes.NOT_FOUND, "参展主体不存在")
    return participant

@app.put("/participants/{participant_code}", response_model=ParticipantResponse, tags=["参展主体"])
def update_participant(participant_code: str, update_data: ParticipantUpdate, db: Session = Depends(get_db)):
    participant = ParticipantService.get_participant_by_code(db, participant_code)
    if not participant:
        raise BusinessException(ErrorCodes.NOT_FOUND, "参展主体不存在")
    
    for key, value in update_data.dict(exclude_unset=True).items():
        setattr(participant, key, value)
    
    db.commit()
    db.refresh(participant)
    return participant

@app.post("/materials", response_model=PersonMaterialResponse, tags=["人员材料"])
def create_material(material: PersonMaterialCreate, db: Session = Depends(get_db)):
    return MaterialService.create_material(db, material)

@app.get("/materials", response_model=List[PersonMaterialResponse], tags=["人员材料"])
def list_materials(
    participant_code: Optional[str] = None,
    status: Optional[MaterialStatus] = None,
    id_card_type: Optional[IDCardType] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    return MaterialService.list_materials(db, participant_code, status, id_card_type, skip, limit)

@app.get("/materials/{material_code}", response_model=PersonMaterialResponse, tags=["人员材料"])
def get_material(material_code: str, db: Session = Depends(get_db)):
    material = MaterialService.get_material_by_code(db, material_code)
    if not material:
        raise BusinessException(ErrorCodes.NOT_FOUND, "材料不存在")
    return material

@app.post("/materials/submit", response_model=PersonMaterialResponse, tags=["人员材料"])
def submit_material(request: MaterialSubmitRequest, db: Session = Depends(get_db)):
    return MaterialService.submit_material(db, request.material_code, request.idempotency_key)

@app.post("/materials/return", response_model=PersonMaterialResponse, tags=["人员材料"])
def return_material(request: MaterialReturnRequest, db: Session = Depends(get_db)):
    return MaterialService.return_material(
        db, request.material_code, request.return_reason_code, request.return_note
    )

@app.post("/materials/resubmit", response_model=PersonMaterialResponse, tags=["人员材料"])
def resubmit_material(material_code: str, update_data: Optional[PersonMaterialUpdate] = None, db: Session = Depends(get_db)):
    return MaterialService.resubmit_material(db, material_code, update_data)

@app.post("/materials/approve", response_model=PersonMaterialResponse, tags=["人员材料"])
def approve_material(request: MaterialApproveRequest, db: Session = Depends(get_db)):
    return MaterialService.approve_material(db, request.material_code)

@app.post("/return-reasons", response_model=ReturnReasonResponse, tags=["退回原因"])
def create_return_reason(reason: ReturnReasonCreate, db: Session = Depends(get_db)):
    return ReturnReasonService.create_reason(db, reason)

@app.get("/return-reasons", response_model=List[ReturnReasonResponse], tags=["退回原因"])
def list_return_reasons(db: Session = Depends(get_db)):
    return ReturnReasonService.list_reasons(db)

@app.post("/batches", response_model=BatchResponse, tags=["制证批次"])
def create_batch(batch: BatchCreate, db: Session = Depends(get_db)):
    return BatchService.create_batch(db, batch)

@app.get("/batches", response_model=List[BatchResponse], tags=["制证批次"])
def list_batches(
    id_card_type: Optional[IDCardType] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return BatchService.list_batches(db, id_card_type, status)

@app.get("/batches/{batch_code}", response_model=BatchResponse, tags=["制证批次"])
def get_batch(batch_code: str, db: Session = Depends(get_db)):
    batch = BatchService.get_batch_by_code(db, batch_code)
    if not batch:
        raise BusinessException(ErrorCodes.NOT_FOUND, "批次不存在")
    return batch

@app.post("/batches/{batch_code}/add-materials", response_model=BatchResponse, tags=["制证批次"])
def add_materials_to_batch(
    batch_code: str,
    request: BatchAddMaterialsRequest,
    db: Session = Depends(get_db)
):
    return BatchService.add_materials_to_batch(db, batch_code, request.material_codes)

@app.post("/batches/{batch_code}/return-materials", response_model=BatchResponse, tags=["制证批次"])
def return_batch_materials(
    batch_code: str,
    request: BatchReturnMaterialsRequest,
    db: Session = Depends(get_db)
):
    return BatchService.return_batch_materials(db, batch_code, request.return_items)

@app.post("/reports/generate", tags=["制证报告"])
def generate_report(request: ReportGenerateRequest, db: Session = Depends(get_db)):
    result = ReportService.generate_report(
        db, request.batch_code, request.report_code, request.name, request.file_format
    )
    return {
        "report_code": result["report"].report_code,
        "name": result["report"].name,
        "status": result["report"].status.value,
        "statistics": result["statistics"],
        "file_url": result["report"].file_url,
        "generated_at": result["report"].generated_at
    }

@app.get("/reports/{report_code}/download", tags=["制证报告"])
def download_report(report_code: str, db: Session = Depends(get_db)):
    report = ReportService.get_report_by_code(db, report_code)
    if not report:
        raise BusinessException(ErrorCodes.NOT_FOUND, "报告不存在")
    
    batch = BatchService.get_batch_by_code(db, report.batch.batch_code)
    return_items = []
    for item in batch.items:
        if item.is_returned:
            return_items.append({
                "材料代码": item.material.material_code,
                "材料版本": item.material_version,
                "参展主体名称": item.material.participant.name,
                "参展主体类型": item.material.participant.type.value,
                "人员姓名": item.material.name,
                "身份证号": item.material.id_card_number,
                "证件类型": item.material.id_card_type.value,
                "退回原因": item.return_reason.description if item.return_reason else "",
                "退回原因分类": item.return_reason.category.value if item.return_reason else "",
                "退回备注": item.return_note or "",
                "退回时间": item.returned_at.strftime("%Y-%m-%d %H:%M:%S") if item.returned_at else ""
            })
    
    df = pd.DataFrame(return_items)
    output = BytesIO()
    
    if report.file_format == "xlsx":
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, index=False, sheet_name="退回明细")
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        filename = f"{report_code}.xlsx"
    else:
        df.to_csv(output, index=False, encoding="utf-8-sig")
        media_type = "text/csv"
        filename = f"{report_code}.csv"
    
    output.seek(0)
    return StreamingResponse(
        output,
        media_type=media_type,
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@app.get("/reports", response_model=List[ReportResponse], tags=["制证报告"])
def list_reports(
    batch_code: Optional[str] = None,
    db: Session = Depends(get_db)
):
    return ReportService.list_reports(db, batch_code)

@app.get("/reports/{report_code}", response_model=ReportResponse, tags=["制证报告"])
def get_report(report_code: str, db: Session = Depends(get_db)):
    report = ReportService.get_report_by_code(db, report_code)
    if not report:
        raise BusinessException(ErrorCodes.NOT_FOUND, "报告不存在")
    return report

@app.get("/id-card-rules", response_model=List[IDCardRuleResponse], tags=["证件规则"])
def list_id_card_rules(db: Session = Depends(get_db)):
    from models import IDCardRule
    return db.query(IDCardRule).filter(IDCardRule.is_active == True).all()

@app.get("/id-card-rules/{card_type}", response_model=IDCardRuleResponse, tags=["证件规则"])
def get_id_card_rule(card_type: IDCardType, db: Session = Depends(get_db)):
    rule = IDCardRuleService.get_rule_by_card_type(db, card_type)
    if not rule:
        raise BusinessException(ErrorCodes.NOT_FOUND, "证件规则不存在")
    return rule

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
