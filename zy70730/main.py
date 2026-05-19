from datetime import datetime
from typing import Optional, List
from fastapi import FastAPI, Depends, HTTPException, Request
from fastapi.responses import JSONResponse, PlainTextResponse
from fastapi.exceptions import RequestValidationError
from sqlalchemy.orm import Session
from models import (
    InterceptRecordCreate,
    InterceptRecordResponse,
    ReviewRequest,
    WhitelistTagCreate,
    CardinalityEstimateRequest,
    InterceptStatus,
    ErrorCode,
    ErrorResponse,
    get_db,
)
from services import (
    estimate_cardinality,
    should_intercept,
    create_intercept_record,
    get_intercept_records,
    get_intercept_record_by_id,
    review_intercept_record,
    add_whitelist_tag,
    get_whitelist_tags,
    generate_daily_report,
    get_reports,
    export_report_to_csv,
)

app = FastAPI(
    title="指标标签基数护栏人工放行后端API",
    description="用于监控指标标签基数控制和人工放行审核的后端服务",
    version="1.0.0",
)


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=422,
        content={
            "error_code": ErrorCode.MISSING_FIELD,
            "message": "请求参数验证失败",
            "details": exc.errors(),
        },
    )


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    if isinstance(exc.detail, dict) and "error_code" in exc.detail:
        return JSONResponse(status_code=exc.status_code, content=exc.detail)
    return JSONResponse(
        status_code=exc.status_code,
        content={
            "error_code": ErrorCode.INVALID_OPERATION,
            "message": exc.detail,
        },
    )


@app.get("/health")
async def health_check():
    return {"status": "ok", "timestamp": datetime.utcnow().isoformat()}


@app.post(
    "/api/v1/cardinality/estimate",
    response_model=dict,
    summary="估算标签基数",
)
async def api_estimate_cardinality(
    req: CardinalityEstimateRequest,
    db: Session = Depends(get_db),
):
    estimated = estimate_cardinality(req.tag_set)
    intercept, intercept_reason, intercept_code = should_intercept(
        db, req.metric_name, req.tag_set, estimated
    )

    if intercept:
        raise HTTPException(
            status_code=403,
            detail={
                "error_code": ErrorCode.NEEDS_MANUAL_REVIEW,
                "message": intercept_reason,
                "details": {
                    "metric_name": req.metric_name,
                    "estimated_cardinality": estimated,
                    "intercept_code": intercept_code,
                },
            },
        )

    return {
        "metric_name": req.metric_name,
        "estimated_cardinality": estimated,
        "allowed": True,
    }


@app.post(
    "/api/v1/intercepts",
    response_model=InterceptRecordResponse,
    summary="创建拦截记录申请",
    status_code=201,
)
async def api_create_intercept(
    record: InterceptRecordCreate,
    db: Session = Depends(get_db),
):
    db_record = create_intercept_record(db, record)
    return db_record


@app.get(
    "/api/v1/intercepts",
    response_model=List[InterceptRecordResponse],
    summary="查询拦截记录列表",
)
async def api_list_intercepts(
    metric_name: Optional[str] = None,
    status: Optional[InterceptStatus] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    return get_intercept_records(db, metric_name, status, skip, limit)


@app.get(
    "/api/v1/intercepts/{record_id}",
    response_model=InterceptRecordResponse,
    summary="查询单个拦截记录",
)
async def api_get_intercept(
    record_id: int,
    db: Session = Depends(get_db),
):
    record = get_intercept_record_by_id(db, record_id)
    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")
    return record


@app.post(
    "/api/v1/intercepts/{record_id}/review",
    response_model=InterceptRecordResponse,
    summary="审核拦截记录",
)
async def api_review_intercept(
    record_id: int,
    review: ReviewRequest,
    db: Session = Depends(get_db),
):
    try:
        record = review_intercept_record(
            db, record_id, review.reviewer, review.status, review.review_comment
        )
    except ValueError as e:
        if str(e) == "ALREADY_PROCESSED":
            raise HTTPException(
                status_code=400,
                detail={
                    "error_code": ErrorCode.ALREADY_PROCESSED,
                    "message": "该记录已被处理，无法重复审核",
                },
            )
        raise

    if not record:
        raise HTTPException(status_code=404, detail="记录不存在")

    if review.status not in [InterceptStatus.APPROVED, InterceptStatus.REJECTED]:
        raise HTTPException(
            status_code=400,
            detail={
                "error_code": ErrorCode.INVALID_STATUS,
                "message": "无效的审核状态，只能是 approved 或 rejected",
            },
        )

    return record


@app.post(
    "/api/v1/whitelist",
    response_model=dict,
    summary="添加标签白名单",
    status_code=201,
)
async def api_add_whitelist(
    tag: WhitelistTagCreate,
    db: Session = Depends(get_db),
):
    db_tag = add_whitelist_tag(db, tag)
    return {
        "id": db_tag.id,
        "metric_name": db_tag.metric_name,
        "tag_key": db_tag.tag_key,
        "allowed_values": db_tag.allowed_values,
        "created_at": db_tag.created_at,
    }


@app.get(
    "/api/v1/whitelist",
    response_model=List[dict],
    summary="查询白名单列表",
)
async def api_list_whitelist(
    metric_name: Optional[str] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db),
):
    tags = get_whitelist_tags(db, metric_name, skip, limit)
    return [
        {
            "id": t.id,
            "metric_name": t.metric_name,
            "tag_key": t.tag_key,
            "allowed_values": t.allowed_values,
            "created_at": t.created_at,
        }
        for t in tags
    ]


@app.post(
    "/api/v1/reports/generate",
    response_model=dict,
    summary="生成每日护栏报告",
)
async def api_generate_report(
    report_date: Optional[str] = None,
    db: Session = Depends(get_db),
):
    if not report_date:
        report_date = datetime.utcnow().strftime("%Y-%m-%d")

    report = generate_daily_report(db, report_date)
    return {
        "id": report.id,
        "report_date": report.report_date,
        "total_intercepted": report.total_intercepted,
        "total_approved": report.total_approved,
        "total_rejected": report.total_rejected,
        "top_metrics": report.top_metrics,
        "created_at": report.created_at,
    }


@app.get(
    "/api/v1/reports",
    response_model=List[dict],
    summary="查询护栏报告列表",
)
async def api_list_reports(
    skip: int = 0,
    limit: int = 30,
    db: Session = Depends(get_db),
):
    reports = get_reports(db, skip, limit)
    return [
        {
            "id": r.id,
            "report_date": r.report_date,
            "total_intercepted": r.total_intercepted,
            "total_approved": r.total_approved,
            "total_rejected": r.total_rejected,
            "top_metrics": r.top_metrics,
            "created_at": r.created_at,
        }
        for r in reports
    ]


@app.get(
    "/api/v1/reports/{report_date}/export",
    response_class=PlainTextResponse,
    summary="导出报告为CSV",
)
async def api_export_report(
    report_date: str,
    db: Session = Depends(get_db),
):
    report = generate_daily_report(db, report_date)
    csv_content = export_report_to_csv(report)
    return PlainTextResponse(
        csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename=guardrail_report_{report_date}.csv"},
    )


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
