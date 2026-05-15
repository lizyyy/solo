from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
import models, schemas, crud
from database import engine, get_db
from init_sample_data import init_sample_data

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="数据保留策略服务",
    description="高峰发票红冲记录与短信发送记录的数据保留策略管理系统 - 支持审批流、人工修正、口径变更处理、受保护的执行链路、完整导出功能",
    version="2.0.0"
)


@app.on_event("startup")
async def startup_event():
    db = next(get_db())
    init_sample_data(db)


@app.post("/invoice-reversal/", response_model=schemas.InvoiceReversalRecord)
def create_invoice(invoice: schemas.InvoiceReversalRecordCreate, db: Session = Depends(get_db)):
    return crud.create_invoice_reversal_record(db, invoice)


@app.get("/invoice-reversal/", response_model=List[schemas.InvoiceReversalRecord])
def list_invoices(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_invoice_records(db, skip=skip, limit=limit)


@app.post("/sms-send/", response_model=schemas.SMSSendRecord)
def create_sms(sms: schemas.SMSSendRecordCreate, db: Session = Depends(get_db)):
    return crud.create_sms_send_record(db, sms)


@app.get("/sms-send/", response_model=List[schemas.SMSSendRecord])
def list_sms(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_sms_records(db, skip=skip, limit=limit)


@app.post("/candidate-list/generate/", response_model=schemas.CandidateList)
def generate_candidate_list(request: schemas.GenerateCandidateListRequest, db: Session = Depends(get_db)):
    return crud.generate_candidate_list(db, request)


@app.get("/candidate-list/", response_model=List[schemas.CandidateList])
def list_candidate_lists(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_candidate_lists(db, skip=skip, limit=limit)


@app.get("/candidate-list/{list_id}/", response_model=schemas.CandidateList)
def get_candidate_list(list_id: int, db: Session = Depends(get_db)):
    candidate_list = crud.get_candidate_list(db, list_id)
    if not candidate_list:
        raise HTTPException(status_code=404, detail="候选清单不存在")
    return candidate_list


@app.post("/approval/")
def process_approval(approval: schemas.ApprovalRequest, db: Session = Depends(get_db)):
    result = crud.process_approval(db, approval)
    if not result:
        raise HTTPException(status_code=404, detail="候选清单不存在")
    return {"message": "审批处理成功", "data": result}


@app.post("/manual-modify/")
def manual_modification(modify: schemas.ManualModifyRequest, db: Session = Depends(get_db)):
    result = crud.apply_manual_modification(db, modify)
    if not result:
        raise HTTPException(status_code=404, detail="候选清单不存在")
    return {"message": "人工修正成功", "data": result}


@app.post("/caliber-change/{list_id}/")
def caliber_change(list_id: int, new_caliber: str, reason: str, db: Session = Depends(get_db)):
    result = crud.handle_caliber_change(db, list_id, new_caliber, reason)
    if not result:
        raise HTTPException(status_code=404, detail="候选清单不存在")
    return {"message": "口径变更处理成功", "data": result}


@app.post("/execution/validate/")
def validate_execution(list_id: int, db: Session = Depends(get_db)):
    can_execute, message = crud.validate_execution_permission(db, list_id)
    return {"can_execute": can_execute, "message": message}


@app.post("/execution/execute/")
def execute_list(request: schemas.ExecutionRequest, db: Session = Depends(get_db)):
    result = crud.execute_candidate_list(db, request)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.get("/execution/records/")
def list_execution_records(list_id: int = None, skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    records = crud.get_execution_records(db, list_id, skip, limit)
    return {"count": len(records), "data": records}


@app.get("/execution/{execution_id}/")
def get_execution(execution_id: int, db: Session = Depends(get_db)):
    record = crud.get_execution_detail(db, execution_id)
    if not record:
        raise HTTPException(status_code=404, detail="执行记录不存在")
    return record


@app.post("/processing-conclusion/", response_model=schemas.ProcessingConclusion)
def create_conclusion(conclusion: schemas.ProcessingConclusionCreate, db: Session = Depends(get_db)):
    return crud.create_processing_conclusion(db, conclusion)


@app.get("/processing-conclusion/", response_model=List[schemas.ProcessingConclusion])
def list_conclusions(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    return crud.get_processing_conclusions(db, skip=skip, limit=limit)


@app.get("/processing-conclusion/candidate-list/{list_id}/")
def get_conclusion_for_list(list_id: int, db: Session = Depends(get_db)):
    conclusion = crud.get_conclusion_by_candidate_list(db, list_id)
    if not conclusion:
        raise HTTPException(status_code=404, detail="处理结论不存在")
    return conclusion


@app.get("/modifications/candidate-list/{list_id}/")
def list_modifications(list_id: int, db: Session = Depends(get_db)):
    modifications = crud.get_modifications_by_candidate_list(db, list_id)
    return {"count": len(modifications), "data": modifications}


@app.post("/export/")
def export_data(request: schemas.ExportRequest, db: Session = Depends(get_db)):
    data = crud.get_export_data(db, request.candidate_list_id, request.include_sms_details, request.filter_by_node)
    if not data:
        raise HTTPException(status_code=404, detail="候选清单不存在")
    return JSONResponse(content=data)


@app.get("/health/")
def health_check():
    return {"status": "healthy", "service": "数据保留策略服务", "version": "2.0.0"}
