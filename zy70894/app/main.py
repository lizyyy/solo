from fastapi import FastAPI, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import Response
from sqlalchemy.orm import Session
from typing import List, Optional

from app.database import get_db, engine
from app.models import models
from app.schemas.schemas import (
    ReviewRecordCreate, ComparisonResultResponse,
    ComparisonSummaryResponse, MaterialTraceResponse
)
from app.services.import_service import ImportService
from app.services.comparison_service import ComparisonService
from app.services.review_service import ReviewService
from app.services.report_service import ReportService

models.Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="质量对账服务 API",
    description="工厂返修记录与工单自动对账服务，支持导入、比对、复核、报告生成",
    version="1.0.0"
)


@app.post("/api/import/repair-csv", tags=["数据导入"])
async def import_repair_csv(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    导入返修记录CSV文件
    - 支持中英文列名
    - 自动识别日期格式
    - 去重处理
    """
    try:
        content = await file.read()
        service = ImportService(db)
        result = service.import_repair_csv(content, file.filename)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/import/work-order-json", tags=["数据导入"])
async def import_work_order_json(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    导入工单JSON文件
    - 支持单条或数组格式
    - 自动解析日期字段
    """
    try:
        content = await file.read()
        service = ImportService(db)
        result = service.import_work_order_json(content, file.filename)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/api/comparison/run", tags=["自动比对"])
async def run_comparison(db: Session = Depends(get_db)):
    """
    运行自动比对
    - 比对所有已导入的返修记录与工单
    - 检测物料批次不匹配、返修闭环、同批多缺陷、工位异常等问题
    - 生成比对批次和汇总统计
    """
    try:
        service = ComparisonService(db)
        result = service.run_comparison()
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/comparison/results", response_model=List[ComparisonResultResponse], tags=["自动比对"])
async def get_comparison_results(
    batch_id: Optional[str] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    获取比对结果列表
    - 可按批次ID筛选
    - 可按状态筛选 (MATCHED/DISCREPANCY)
    """
    service = ComparisonService(db)
    return service.get_comparison_results(batch_id, status)


@app.get("/api/comparison/summary/{batch_id}", response_model=ComparisonSummaryResponse, tags=["自动比对"])
async def get_comparison_summary(batch_id: str, db: Session = Depends(get_db)):
    """
    获取指定批次的比对汇总统计
    """
    service = ComparisonService(db)
    summary = service.get_summary(batch_id)
    if not summary:
        raise HTTPException(status_code=404, detail="批次未找到")
    return summary


@app.post("/api/review/submit", tags=["人工复核"])
async def submit_review(
    review_data: ReviewRecordCreate,
    db: Session = Depends(get_db)
):
    """
    提交人工复核意见
    - 支持修改状态和差异说明
    - 自动更新汇总统计
    - 保留复核历史记录
    """
    try:
        service = ReviewService(db)
        result = service.submit_review(review_data)
        if not result['success']:
            raise HTTPException(status_code=400, detail=result['error'])
        return result
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/review/pending", response_model=List[ComparisonResultResponse], tags=["人工复核"])
async def get_pending_reviews(
    batch_id: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    获取待复核的差异记录
    """
    service = ReviewService(db)
    return service.get_pending_reviews(batch_id)


@app.get("/api/review/history/{result_id}", tags=["人工复核"])
async def get_review_history(result_id: int, db: Session = Depends(get_db)):
    """
    获取指定记录的复核历史
    """
    service = ReviewService(db)
    return service.get_review_history(result_id)


@app.post("/api/review/batch-resolve", tags=["人工复核"])
async def batch_resolve(
    result_ids: List[int],
    reviewer: str,
    decision: str,
    notes: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    批量处理复核记录
    """
    service = ReviewService(db)
    return service.batch_resolve(result_ids, reviewer, decision, notes)


@app.get("/api/review/explain/{result_id}", tags=["人工复核"])
async def explain_discrepancy(result_id: int, db: Session = Depends(get_db)):
    """
    获取差异原因分析和处理建议
    - 自动解释差异类型
    - 提供可能原因分析
    - 给出处理建议
    """
    service = ReviewService(db)
    return service.explain_discrepancy(result_id)


@app.get("/api/report/download/{batch_id}", tags=["报告生成"])
async def download_report(
    batch_id: str,
    format: str = Query("excel", enum=["excel", "csv"]),
    db: Session = Depends(get_db)
):
    """
    下载比对报告
    - 支持Excel（含多sheet）和CSV格式
    - Excel包含：汇总、明细、差异分析说明
    """
    try:
        service = ReportService(db)
        report_data = service.generate_comparison_report(batch_id, format)
        
        media_type = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if format == "excel" else "text/csv"
        filename = f"comparison_report_{batch_id}.xlsx" if format == "excel" else f"comparison_report_{batch_id}.csv"
        
        return Response(
            content=report_data,
            media_type=media_type,
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/api/material/trace/{batch_no}", tags=["物料追踪"])
async def trace_material_batch(batch_no: str, db: Session = Depends(get_db)):
    """
    物料批号历史追踪
    - 查询物料批次基本信息
    - 显示完整追溯链（各工位处理记录）
    - 关联返修记录和工单
    - 质量评估和建议
    """
    service = ReportService(db)
    result = service.trace_material_batch(batch_no)
    if not result['found']:
        raise HTTPException(status_code=404, detail=result['error'])
    return result


@app.get("/api/decision/report/{result_id}", tags=["决策支持"])
async def get_decision_report(result_id: int, db: Session = Depends(get_db)):
    """
    生成决策报告，帮助质量工程师向他人说明处理理由
    - 详细说明为什么放行、退回或要求补材料
    - 列出支持证据和风险等级
    - 提供复核历史记录
    """
    service = ReportService(db)
    result = service.generate_decision_report(result_id)
    if 'error' in result:
        raise HTTPException(status_code=404, detail=result['error'])
    return result


@app.get("/api/health", tags=["系统"])
async def health_check():
    """
    健康检查
    """
    return {"status": "healthy", "service": "质量对账服务"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
