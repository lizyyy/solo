import json
from datetime import datetime
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, Header
from fastapi.responses import Response, StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

from app.database import get_db, engine, Base
from app.models import AllocationStatus
from app import schemas, crud, exporter

Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="API 调用成本分摊服务",
    description="API 调用成本分摊服务 - 提供调用量聚合、成本计算、分摊规则管理、数据导出等功能",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/static", StaticFiles(directory="static"), name="static")


@app.exception_handler(Exception)
async def general_exception_handler(request, exc):
    return Response(
        content=json.dumps({
            "error": "Internal Server Error",
            "error_code": "INTERNAL_ERROR",
            "details": str(exc),
            "timestamp": datetime.utcnow().isoformat()
        }),
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        media_type="application/json"
    )


@app.get("/", tags=["系统"])
async def root():
    return {"message": "API 调用成本分摊服务", "version": "1.0.0", "status": "running"}


@app.get("/health", tags=["系统"])
async def health_check():
    return {"status": "healthy", "timestamp": datetime.utcnow().isoformat()}


@app.get("/admin", tags=["系统"])
async def admin_panel():
    return FileResponse("static/index.html")


@app.post("/callers/", response_model=schemas.Caller, tags=["调用方管理"])
def create_caller(caller: schemas.CallerCreate, db: Session = Depends(get_db)):
    db_caller = crud.get_caller_by_code(db, code=caller.code)
    if db_caller:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Caller with code {caller.code} already exists"
        )
    return crud.create_caller(db=db, caller=caller)


@app.get("/callers/", response_model=List[schemas.Caller], tags=["调用方管理"])
def read_callers(skip: int = 0, limit: int = 100, is_active: Optional[bool] = None, db: Session = Depends(get_db)):
    callers = crud.get_callers(db, skip=skip, limit=limit, is_active=is_active)
    return callers


@app.get("/callers/{caller_id}", response_model=schemas.Caller, tags=["调用方管理"])
def read_caller(caller_id: int, db: Session = Depends(get_db)):
    db_caller = crud.get_caller(db, caller_id=caller_id)
    if db_caller is None:
        raise HTTPException(status_code=404, detail="Caller not found")
    return db_caller


@app.patch("/callers/{caller_id}", response_model=schemas.Caller, tags=["调用方管理"])
def update_caller(caller_id: int, caller_update: schemas.CallerUpdate, db: Session = Depends(get_db)):
    db_caller = crud.update_caller(db, caller_id=caller_id, caller_update=caller_update)
    if db_caller is None:
        raise HTTPException(status_code=404, detail="Caller not found")
    return db_caller


@app.post("/api-groups/", response_model=schemas.ApiGroup, tags=["接口组管理"])
def create_api_group(api_group: schemas.ApiGroupCreate, db: Session = Depends(get_db)):
    db_group = crud.get_api_group_by_code(db, code=api_group.code)
    if db_group:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"API Group with code {api_group.code} already exists"
        )
    return crud.create_api_group(db=db, api_group=api_group)


@app.get("/api-groups/", response_model=List[schemas.ApiGroup], tags=["接口组管理"])
def read_api_groups(skip: int = 0, limit: int = 100, is_active: Optional[bool] = None, db: Session = Depends(get_db)):
    api_groups = crud.get_api_groups(db, skip=skip, limit=limit, is_active=is_active)
    return api_groups


@app.get("/api-groups/{api_group_id}", response_model=schemas.ApiGroup, tags=["接口组管理"])
def read_api_group(api_group_id: int, db: Session = Depends(get_db)):
    db_group = crud.get_api_group(db, api_group_id=api_group_id)
    if db_group is None:
        raise HTTPException(status_code=404, detail="API Group not found")
    return db_group


@app.post("/resource-prices/", response_model=schemas.ResourcePrice, tags=["资源单价管理"])
def create_resource_price(resource_price: schemas.ResourcePriceCreate, db: Session = Depends(get_db)):
    db_group = crud.get_api_group(db, api_group_id=resource_price.api_group_id)
    if db_group is None:
        raise HTTPException(status_code=404, detail="API Group not found")
    return crud.create_resource_price(db=db, resource_price=resource_price)


@app.post("/call-records/", response_model=schemas.CallRecord, tags=["调用记录管理"])
def create_call_record(call_record: schemas.CallRecordCreate, db: Session = Depends(get_db)):
    db_caller = crud.get_caller(db, caller_id=call_record.caller_id)
    if db_caller is None:
        raise HTTPException(status_code=404, detail="Caller not found")
    
    db_group = crud.get_api_group(db, api_group_id=call_record.api_group_id)
    if db_group is None:
        raise HTTPException(status_code=404, detail="API Group not found")
    
    return crud.create_call_record(db=db, call_record=call_record)


@app.post("/call-records/batch", response_model=schemas.SuccessResponse, tags=["调用记录管理"])
def batch_create_call_records(
    batch_data: schemas.CallRecordBatchCreate,
    x_idempotency_key: str = Header(None),
    db: Session = Depends(get_db)
):
    idempotency_key = x_idempotency_key or batch_data.idempotency_key
    
    idempotent_record = crud.get_idempotent_record(db, key=idempotency_key)
    if idempotent_record:
        return schemas.SuccessResponse(
            success=True,
            message="Duplicate request, records already created",
            data={"processed_count": 0, "idempotency_key": idempotency_key}
        )
    
    processed_count = 0
    for record in batch_data.records:
        crud.create_call_record(db=db, call_record=record)
        processed_count += 1
    
    crud.create_idempotent_record(
        db,
        key=idempotency_key,
        request_type="batch_call_records",
        response_data=json.dumps({"processed_count": processed_count})
    )
    
    return schemas.SuccessResponse(
        success=True,
        message=f"Successfully created {processed_count} call records",
        data={"processed_count": processed_count, "idempotency_key": idempotency_key}
    )


@app.post("/allocation-rules/", response_model=schemas.AllocationRule, tags=["分摊规则管理"])
def create_allocation_rule(rule: schemas.AllocationRuleCreate, db: Session = Depends(get_db)):
    return crud.create_allocation_rule(db=db, rule=rule)


@app.get("/allocation-rules/{rule_id}", response_model=schemas.AllocationRule, tags=["分摊规则管理"])
def read_allocation_rule(rule_id: int, db: Session = Depends(get_db)):
    db_rule = crud.get_allocation_rule(db, rule_id=rule_id)
    if db_rule is None:
        raise HTTPException(status_code=404, detail="Allocation rule not found")
    return db_rule


@app.post("/monthly-results/calculate", response_model=schemas.SuccessResponse, tags=["月度分摊结果"])
def calculate_monthly_results(
    calculate_req: schemas.MonthlyResultCalculate,
    db: Session = Depends(get_db)
):
    existing_idempotent = crud.get_idempotent_record(db, key=calculate_req.idempotency_key)
    if existing_idempotent:
        return schemas.SuccessResponse(
            success=True,
            message="Duplicate request, calculation already completed",
            data={"idempotency_key": calculate_req.idempotency_key, "cached": True}
        )
    
    rule = crud.get_allocation_rule(db, rule_id=calculate_req.rule_id)
    if not rule:
        raise HTTPException(status_code=404, detail="Allocation rule not found")
    
    try:
        aggregated_records = crud.aggregate_call_records(db, month=calculate_req.month)
        
        if not aggregated_records:
            crud.create_idempotent_record(
                db,
                key=calculate_req.idempotency_key,
                request_type="monthly_calculation",
                response_data=json.dumps({"created_count": 0, "month": calculate_req.month})
            )
            return schemas.SuccessResponse(
                success=True,
                message="No call records found for the specified month",
                data={"processed_count": 0}
            )
        
        created_count = 0
        for caller_id, api_group_id, total_calls in aggregated_records:
            result_idempotency_key = f"{calculate_req.idempotency_key}_{caller_id}_{api_group_id}"
            
            existing = crud.get_monthly_result_by_idempotency(db, idempotency_key=result_idempotency_key)
            if existing:
                continue
            
            try:
                crud.create_monthly_result(
                    db,
                    month=calculate_req.month,
                    caller_id=caller_id,
                    api_group_id=api_group_id,
                    rule=rule,
                    total_calls=total_calls,
                    idempotency_key=result_idempotency_key
                )
                created_count += 1
            except ValueError as e:
                continue
        
        crud.create_idempotent_record(
            db,
            key=calculate_req.idempotency_key,
            request_type="monthly_calculation",
            response_data=json.dumps({"created_count": created_count, "month": calculate_req.month})
        )
        
        return schemas.SuccessResponse(
            success=True,
            message=f"Successfully calculated {created_count} monthly results",
            data={"created_count": created_count, "month": calculate_req.month}
        )
    
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Calculation failed: {str(e)}"
        )


@app.get("/monthly-results/", response_model=List[schemas.MonthlyResult], tags=["月度分摊结果"])
def read_monthly_results(
    month: Optional[str] = None,
    caller_id: Optional[int] = None,
    api_group_id: Optional[int] = None,
    status: Optional[AllocationStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    results = crud.get_monthly_results(
        db,
        month=month,
        caller_id=caller_id,
        api_group_id=api_group_id,
        status=status,
        skip=skip,
        limit=limit
    )
    return results


@app.post("/monthly-results/{result_id}/validate", response_model=schemas.MonthlyResult, tags=["月度分摊结果"])
def validate_result(result_id: int, db: Session = Depends(get_db)):
    db_result = crud.validate_monthly_result(db, result_id=result_id)
    if db_result is None:
        raise HTTPException(status_code=404, detail="Monthly result not found")
    return db_result


@app.post("/monthly-results/{result_id}/complete", response_model=schemas.MonthlyResult, tags=["月度分摊结果"])
def complete_result(result_id: int, db: Session = Depends(get_db)):
    db_result = crud.update_result_status(db, result_id=result_id, status=AllocationStatus.COMPLETED)
    if db_result is None:
        raise HTTPException(status_code=404, detail="Monthly result not found")
    return db_result


@app.post("/monthly-results/{result_id}/adjust", response_model=schemas.MonthlyResult, tags=["月度分摊结果"])
def adjust_result(
    result_id: int,
    adjustment: schemas.AdjustmentRecordCreate,
    db: Session = Depends(get_db)
):
    try:
        db_result, _ = crud.create_adjustment_record(db, monthly_result_id=result_id, adjustment=adjustment)
        return db_result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.post("/cost-trial", response_model=schemas.CostTrialResult, tags=["成本试算"])
def trial_calculate(trial_req: schemas.CostTrialCalculateRequest, db: Session = Depends(get_db)):
    try:
        items, total_cost = crud.trial_calculate_cost(
            db,
            month=trial_req.month,
            rule_id=trial_req.rule_id,
            caller_id=trial_req.caller_id,
            api_group_id=trial_req.api_group_id
        )
        
        rule = crud.get_allocation_rule(db, rule_id=trial_req.rule_id)
        
        return schemas.CostTrialResult(
            month=trial_req.month,
            rule_id=trial_req.rule_id,
            rule_version=rule.version if rule else 0,
            total_cost=total_cost,
            items=items
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@app.post("/export/xlsx", tags=["数据导出"])
def export_xlsx(
    export_req: schemas.ExportRequest,
    db: Session = Depends(get_db)
):
    idempotent_record = crud.get_idempotent_record(db, key=export_req.idempotency_key)
    if idempotent_record:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Export with this idempotency key already processed"
        )
    
    try:
        xlsx_data = exporter.export_summary_to_xlsx(db, month=export_req.month)
        
        crud.create_idempotent_record(
            db,
            key=export_req.idempotency_key,
            request_type="export_xlsx",
            response_data=json.dumps({"month": export_req.month, "format": "xlsx"})
        )
        
        return Response(
            content=xlsx_data,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers={
                "Content-Disposition": f"attachment; filename=cost_allocation_{export_req.month}.xlsx"
            }
        )
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Export failed: {str(e)}"
        )


@app.get("/history/monthly-results", response_model=List[schemas.MonthlyResult], tags=["历史查询"])
def query_monthly_results_history(
    month: Optional[str] = None,
    caller_id: Optional[int] = None,
    api_group_id: Optional[int] = None,
    status: Optional[AllocationStatus] = None,
    page: int = 1,
    page_size: int = 50,
    db: Session = Depends(get_db)
):
    skip = (page - 1) * page_size
    results = crud.get_monthly_results(
        db,
        month=month,
        caller_id=caller_id,
        api_group_id=api_group_id,
        status=status,
        skip=skip,
        limit=page_size
    )
    return results


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
