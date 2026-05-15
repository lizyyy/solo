from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List
from .database import engine, get_db, Base
from . import models, schemas, crud, data_generator

Base.metadata.create_all(bind=engine)

app = FastAPI(title="重放结果比对器 API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def startup_event():
    db = next(get_db())
    data_generator.init_default_rule(db, "system")


@app.get("/")
def read_root():
    return {"message": "重放结果比对器后端服务已启动", "version": "1.0.0"}


@app.post("/api/data/generate", response_model=dict)
def generate_test_data(request: schemas.GenerateDataRequest, db: Session = Depends(get_db)):
    existing_batch = crud.get_batch(db, request.batch_no)
    if existing_batch:
        raise HTTPException(status_code=400, detail="批次号已存在")
    
    batch = crud.create_batch(db, schemas.BatchCreate(
        batch_no=request.batch_no,
        name=f"班车预约复核-{request.batch_no}",
        rule_version="v1.0",
        operator=request.operator,
        source_type="bus_reservation"
    ))
    
    reservations = data_generator.generate_bus_reservations(
        db, request.batch_no, request.operator, request.record_count
    )
    
    results = data_generator.generate_comparison_results(
        db, request.batch_no, request.operator, reservations, "v1.0"
    )
    
    abnormal_count = sum(1 for r in results if r.is_abnormal)
    summary = f"本次复核共处理{len(results)}条记录，发现异常{abnormal_count}条，其中重复提交{sum(1 for r in results if r.risk_type == '重复提交')}条"
    
    crud.update_batch_summary(db, request.batch_no, summary, len(results), abnormal_count)
    
    return {
        "success": True,
        "batch_no": request.batch_no,
        "record_count": len(results),
        "abnormal_count": abnormal_count,
        "message": f"测试数据生成完成，批次号: {request.batch_no}"
    }


@app.get("/api/rules", response_model=List[schemas.RuleVersionResponse])
def get_rules(db: Session = Depends(get_db)):
    return crud.get_all_rule_versions(db)


@app.post("/api/rules", response_model=schemas.RuleVersionResponse)
def create_rule(rule: schemas.RuleVersionCreate, db: Session = Depends(get_db)):
    existing = crud.get_rule_version(db, rule.version)
    if existing:
        raise HTTPException(status_code=400, detail="规则版本已存在")
    return crud.create_rule_version(db, rule.model_dump())


@app.get("/api/batches", response_model=List[schemas.BatchResponse])
def get_batches(db: Session = Depends(get_db)):
    return crud.get_all_batches(db)


@app.get("/api/batches/{batch_no}", response_model=schemas.BatchResponse)
def get_batch(batch_no: str, db: Session = Depends(get_db)):
    batch = crud.get_batch(db, batch_no)
    if not batch:
        raise HTTPException(status_code=404, detail="批次不存在")
    return batch


@app.post("/api/comparison/query")
def query_comparison_results(filter: schemas.QueryFilter, db: Session = Depends(get_db)):
    result = crud.query_comparison_results(
        db,
        batch_no=filter.batch_no,
        operator=filter.operator,
        risk_type=filter.risk_type,
        is_abnormal=filter.is_abnormal,
        page=filter.page,
        page_size=filter.page_size
    )
    return {
        "total": result["total"],
        "page": result["page"],
        "page_size": result["page_size"],
        "results": [schemas.ComparisonResultResponse.model_validate(r) for r in result["results"]]
    }


@app.get("/api/comparison/{result_id}", response_model=schemas.ComparisonResultResponse)
def get_comparison_result(result_id: int, db: Session = Depends(get_db)):
    result = crud.get_comparison_result(db, result_id)
    if not result:
        raise HTTPException(status_code=404, detail="比对结果不存在")
    return result


@app.get("/api/comparison/{result_id}/diff-report")
def get_diff_report(result_id: int, db: Session = Depends(get_db)):
    report = crud.generate_diff_report(db, result_id)
    if not report:
        raise HTTPException(status_code=404, detail="差异报告不存在")
    return report


@app.post("/api/candidates", response_model=schemas.CandidateListResponse)
def create_candidate_list(candidate: schemas.CandidateListCreate, db: Session = Depends(get_db)):
    return crud.create_candidate_list(db, candidate)


@app.get("/api/candidates", response_model=List[schemas.CandidateListResponse])
def get_candidate_lists(batch_no: str = None, db: Session = Depends(get_db)):
    return crud.get_candidate_lists(db, batch_no)


@app.post("/api/candidates/{candidate_id}/approve", response_model=schemas.CandidateListResponse)
def approve_candidate(candidate_id: int, operator: str, db: Session = Depends(get_db)):
    candidate = crud.approve_candidate_list(db, candidate_id, operator)
    if not candidate:
        raise HTTPException(status_code=404, detail="候选清单不存在")
    return candidate


@app.post("/api/candidates/{candidate_id}/cleanup")
def execute_cleanup(candidate_id: int, operator: str, db: Session = Depends(get_db)):
    result = crud.execute_cleanup(db, candidate_id, operator)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.post("/api/candidates/{candidate_id}/rollback")
def execute_rollback(candidate_id: int, operator: str, db: Session = Depends(get_db)):
    result = crud.execute_rollback(db, candidate_id, operator)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result["message"])
    return result


@app.get("/api/operation-logs")
def get_operation_logs(batch_no: str = None, db: Session = Depends(get_db)):
    return crud.get_operation_logs(db, batch_no)


@app.get("/api/filters/operators")
def get_operators(db: Session = Depends(get_db)):
    return {"operators": crud.get_unique_operators(db)}


@app.get("/api/filters/risk-types")
def get_risk_types(db: Session = Depends(get_db)):
    return {"risk_types": crud.get_unique_risk_types(db)}


@app.get("/api/reservations/{batch_no}")
def get_reservations(batch_no: str, db: Session = Depends(get_db)):
    reservations = crud.get_bus_reservations(db, batch_no)
    return [schemas.BusReservationResponse.model_validate(r) for r in reservations]
