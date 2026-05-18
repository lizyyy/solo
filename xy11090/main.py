from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from datetime import date

import models
import schemas
import services
from database import get_db, engine, Base
from services import ReductionValidationError


Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="农贸市场摊位费减免管理系统",
    description="管理临时休市、个人请假等摊位费减免申请，支持导入、处理、复核全流程",
    version="1.0.0"
)


@app.exception_handler(ReductionValidationError)
async def reduction_validation_error_handler(request: Request, exc: ReductionValidationError):
    return JSONResponse(
        status_code=400,
        content={
            "error_code": exc.error_code,
            "error_message": exc.error_message,
            "suggestion": exc.suggestion
        }
    )


@app.get("/")
def root():
    return {
        "message": "农贸市场摊位费减免管理系统 API",
        "version": "1.0.0",
        "docs": "/docs",
        "seed_data": "运行 python seed_data.py 初始化种子数据"
    }


@app.get("/stalls/", response_model=List[schemas.Stall], summary="获取所有摊位列表")
def get_stalls(db: Session = Depends(get_db)):
    return db.query(models.Stall).all()


@app.get("/stalls/{stall_number}", response_model=schemas.Stall, summary="根据摊位编号获取摊位信息")
def get_stall(stall_number: str, db: Session = Depends(get_db)):
    stall = services.get_stall_by_number(db, stall_number)
    if not stall:
        raise ReductionValidationError(
            error_code="STALL_NOT_FOUND",
            error_message=f"摊位编号{stall_number}不存在",
            suggestion="请核对摊位编号是否正确"
        )
    return stall


@app.get("/vendors/", response_model=List[schemas.Vendor], summary="获取所有摊主列表")
def get_vendors(db: Session = Depends(get_db)):
    return db.query(models.Vendor).all()


@app.get("/closures/", response_model=List[schemas.MarketClosure], summary="获取所有休市通知")
def get_closures(db: Session = Depends(get_db)):
    return db.query(models.MarketClosure).all()


@app.get("/leaves/", response_model=List[schemas.PersonalLeave], summary="获取所有请假申请")
def get_leaves(db: Session = Depends(get_db)):
    return db.query(models.PersonalLeave).all()


@app.get("/fee-records/", response_model=List[schemas.FeeRecord], summary="获取所有收费记录")
def get_fee_records(db: Session = Depends(get_db)):
    return db.query(models.FeeRecord).all()


@app.post("/reductions/import/", response_model=schemas.ReductionResult, summary="导入减免申请")
def import_reduction(import_data: schemas.FeeReductionImport, db: Session = Depends(get_db)):
    return services.import_reduction(db, import_data)


@app.get("/reductions/", response_model=List[schemas.FeeReduction], summary="获取所有减免申请")
def get_reductions(status: str = None, db: Session = Depends(get_db)):
    query = db.query(models.FeeReduction)
    if status:
        query = query.filter(models.FeeReduction.status == status)
    return query.all()


@app.get("/reductions/{reduction_id}", response_model=schemas.FeeReduction, summary="根据ID获取减免申请详情")
def get_reduction(reduction_id: int, db: Session = Depends(get_db)):
    reduction = db.query(models.FeeReduction).filter(models.FeeReduction.id == reduction_id).first()
    if not reduction:
        raise ReductionValidationError(
            error_code="REDUCTION_NOT_FOUND",
            error_message="减免申请不存在",
            suggestion="请核对申请ID是否正确"
        )
    return reduction


@app.post("/reductions/{reduction_id}/process/", response_model=schemas.ReductionResult, summary="处理减免申请")
def process_reduction(reduction_id: int, process_data: schemas.FeeReductionProcess, db: Session = Depends(get_db)):
    return services.process_reduction(db, reduction_id, process_data)


@app.post("/reductions/{reduction_id}/review/", response_model=schemas.ReductionResult, summary="复核减免申请")
def review_reduction(reduction_id: int, review_data: schemas.FeeReductionReview, db: Session = Depends(get_db)):
    return services.review_reduction(db, reduction_id, review_data)


@app.get("/sample-reductions/", summary="获取样例减免申请数据")
def get_sample_reductions(db: Session = Depends(get_db)):
    from seed_data import get_sample_reduction_data
    return {
        "description": "以下为样例数据，可用于测试导入接口",
        "samples": get_sample_reduction_data(db)
    }


@app.post("/demo/run-full-flow/", summary="运行完整演示流程")
def run_demo_flow(db: Session = Depends(get_db)):
    from seed_data import get_sample_reduction_data
    
    results = []
    samples = get_sample_reduction_data(db)
    
    results.append({"step": "1. 导入减免申请", "data": []})
    
    for sample in samples:
        try:
            import_data = schemas.FeeReductionImport(**sample["data"])
            result = services.import_reduction(db, import_data)
            results[0]["data"].append({
                "name": sample["name"],
                "success": result.success,
                "status": result.reduction.status if result.reduction else None,
                "message": result.message,
                "need_manual": result.need_manual,
                "manual_reason": result.manual_reason
            })
        except Exception as e:
            results[0]["data"].append({
                "name": sample["name"],
                "success": False,
                "error": str(e)
            })
    
    results.append({"step": "2. 处理减免申请", "data": []})
    
    reductions = db.query(models.FeeReduction).filter(
        models.FeeReduction.status.in_(["已导入", "待人工处理"])
    ).all()
    
    for reduction in reductions:
        try:
            process_data = schemas.FeeReductionProcess(processor="李处理员")
            result = services.process_reduction(db, reduction.id, process_data)
            results[1]["data"].append({
                "reduction_no": result.reduction.reduction_no,
                "previous_status": reduction.status,
                "new_status": result.reduction.status,
                "message": result.message
            })
        except Exception as e:
            results[1]["data"].append({
                "reduction_no": reduction.reduction_no,
                "success": False,
                "error": str(e)
            })
    
    results.append({"step": "3. 复核减免申请", "data": []})
    
    pending_reductions = db.query(models.FeeReduction).filter(
        models.FeeReduction.status == "待复核"
    ).all()
    
    for i, reduction in enumerate(pending_reductions):
        try:
            if i % 2 == 0:
                review_data = schemas.FeeReductionReview(
                    reviewer="张复核员",
                    approved=True
                )
            else:
                review_data = schemas.FeeReductionReview(
                    reviewer="张复核员",
                    approved=False,
                    reject_reason="申请材料不全，请补充相关证明文件"
                )
            
            result = services.review_reduction(db, reduction.id, review_data)
            results[2]["data"].append({
                "reduction_no": result.reduction.reduction_no,
                "approved": review_data.approved,
                "new_status": result.reduction.status,
                "message": result.message
            })
        except Exception as e:
            results[2]["data"].append({
                "reduction_no": reduction.reduction_no,
                "success": False,
                "error": str(e)
            })
    
    results.append({"step": "4. 最终状态统计", "data": {}})
    all_reductions = db.query(models.FeeReduction).all()
    status_counts = {}
    for r in all_reductions:
        status_counts[r.status] = status_counts.get(r.status, 0) + 1
    results[3]["data"] = {
        "total_count": len(all_reductions),
        "status_distribution": status_counts
    }
    
    return {
        "message": "演示流程执行完成",
        "flow_steps": results
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
