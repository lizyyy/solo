from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List
from database import get_db, init_db, LoadTestReport, LoadTestScenario, ComparisonResult
from schemas import (
    ReportImportRequest,
    ReportInfo,
    ScenarioInfo,
    ComparisonRequest,
    ComparisonResponse,
    ErrorResponse,
    ErrorCode,
    ConclusionType,
    ReportFormat,
    ReviewRequest
)
from parser import ReportParser
from logic import ComparisonService, ComparisonThreshold

app = FastAPI(title="压测摘要归一退化判断服务", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    init_db()


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    if isinstance(exc.detail, ErrorResponse):
        return JSONResponse(
            status_code=exc.status_code,
            content=exc.detail.dict()
        )
    return JSONResponse(
        status_code=exc.status_code,
        content={"message": exc.detail}
    )


@app.post("/api/v1/reports/import", response_model=ReportInfo, responses={400: {"model": ErrorResponse}})
async def import_report(request: ReportImportRequest, db: Session = Depends(get_db)):
    existing = db.query(LoadTestReport).filter(LoadTestReport.report_id == request.report_id).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error_code=ErrorCode.ALREADY_PROCESSED,
                message=f"Report {request.report_id} already exists",
                details={"report_id": request.report_id}
            )
        )
    
    if not request.scenarios:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error_code=ErrorCode.MISSING_FIELD,
                message="No scenarios provided",
                details={"field": "scenarios"}
            )
        )
    
    report = LoadTestReport(
        report_id=request.report_id,
        report_name=request.report_name,
        source_format=request.source_format,
        notes=request.notes
    )
    db.add(report)
    
    for scenario in request.scenarios:
        db_scenario = LoadTestScenario(
            report_id=request.report_id,
            scenario_name=scenario.scenario_name,
            throughput=scenario.throughput,
            p95=scenario.p95,
            error_rate=scenario.error_rate,
            concurrency=scenario.concurrency,
            duration=scenario.duration
        )
        db.add(db_scenario)
    
    db.commit()
    return ReportInfo(
        report_id=report.report_id,
        report_name=report.report_name,
        source_format=report.source_format,
        imported_at=report.imported_at,
        scenario_count=len(request.scenarios),
        notes=report.notes
    )


@app.post("/api/v1/reports/import-file/{report_id}", response_model=ReportInfo)
async def import_report_file(
    report_id: str,
    report_name: str,
    source_format: ReportFormat,
    file: UploadFile = File(...),
    notes: str = None,
    db: Session = Depends(get_db)
):
    existing = db.query(LoadTestReport).filter(LoadTestReport.report_id == report_id).first()
    if existing:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error_code=ErrorCode.ALREADY_PROCESSED,
                message=f"Report {report_id} already exists",
                details={"report_id": report_id}
            )
        )
    
    content = await file.read()
    content_str = content.decode("utf-8")
    
    parser = ReportParser()
    try:
        scenarios = parser.parse(content_str, source_format)
    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error_code=ErrorCode.MISSING_FIELD,
                message=f"Parse error: {str(e)}",
                details={"format": source_format}
            )
        )
    
    if not scenarios:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error_code=ErrorCode.MISSING_FIELD,
                message="No scenarios found in file",
                details={}
            )
        )
    
    report = LoadTestReport(
        report_id=report_id,
        report_name=report_name,
        source_format=source_format,
        notes=notes
    )
    db.add(report)
    
    for scenario in scenarios:
        db_scenario = LoadTestScenario(
            report_id=report_id,
            scenario_name=scenario.scenario_name,
            throughput=scenario.throughput,
            p95=scenario.p95,
            error_rate=scenario.error_rate,
            concurrency=scenario.concurrency,
            duration=scenario.duration
        )
        db.add(db_scenario)
    
    db.commit()
    return ReportInfo(
        report_id=report.report_id,
        report_name=report.report_name,
        source_format=report.source_format,
        imported_at=report.imported_at,
        scenario_count=len(scenarios),
        notes=report.notes
    )


@app.get("/api/v1/reports", response_model=List[ReportInfo])
async def list_reports(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    reports = db.query(LoadTestReport).offset(skip).limit(limit).all()
    result = []
    for report in reports:
        scenario_count = db.query(LoadTestScenario).filter(LoadTestScenario.report_id == report.report_id).count()
        result.append(ReportInfo(
            report_id=report.report_id,
            report_name=report.report_name,
            source_format=report.source_format,
            imported_at=report.imported_at,
            scenario_count=scenario_count,
            notes=report.notes
        ))
    return result


@app.get("/api/v1/reports/{report_id}/scenarios", response_model=List[ScenarioInfo])
async def get_report_scenarios(report_id: str, db: Session = Depends(get_db)):
    scenarios = db.query(LoadTestScenario).filter(LoadTestScenario.report_id == report_id).all()
    if not scenarios:
        report = db.query(LoadTestReport).filter(LoadTestReport.report_id == report_id).first()
        if not report:
            raise HTTPException(
                status_code=404,
                detail=ErrorResponse(
                    error_code=ErrorCode.NOT_FOUND,
                    message=f"Report {report_id} not found",
                    details={"report_id": report_id}
                )
            )
    return scenarios


@app.post("/api/v1/comparisons", response_model=ComparisonResponse, responses={400: {"model": ErrorResponse}})
async def create_comparison(request: ComparisonRequest, db: Session = Depends(get_db)):
    base_report = db.query(LoadTestReport).filter(LoadTestReport.report_id == request.base_report_id).first()
    if not base_report:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error_code=ErrorCode.NOT_FOUND,
                message=f"Base report {request.base_report_id} not found",
                details={"report_id": request.base_report_id}
            )
        )
    
    target_report = db.query(LoadTestReport).filter(LoadTestReport.report_id == request.target_report_id).first()
    if not target_report:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error_code=ErrorCode.NOT_FOUND,
                message=f"Target report {request.target_report_id} not found",
                details={"report_id": request.target_report_id}
            )
        )
    
    base_scenarios = db.query(LoadTestScenario).filter(LoadTestScenario.report_id == request.base_report_id).all()
    target_scenarios = db.query(LoadTestScenario).filter(LoadTestScenario.report_id == request.target_report_id).all()
    
    if not base_scenarios or not target_scenarios:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error_code=ErrorCode.MISSING_FIELD,
                message="No scenarios found in one or both reports",
                details={"base_count": len(base_scenarios), "target_count": len(target_scenarios)}
            )
        )
    
    thresholds = request.thresholds or ComparisonThreshold()
    service = ComparisonService(thresholds)
    
    scenario_comparisons = service.compare_scenarios(
        base_scenarios,
        target_scenarios,
        request.scenario_pattern
    )
    
    if not scenario_comparisons:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error_code=ErrorCode.MISSING_FIELD,
                message="No matching scenarios found between reports",
                details={"pattern": request.scenario_pattern}
            )
        )
    
    comparison_id = service.generate_comparison_id()
    
    degraded_count = sum(1 for s in scenario_comparisons if s.conclusion == ConclusionType.DEGRADED)
    pass_count = sum(1 for s in scenario_comparisons if s.conclusion == ConclusionType.PASS)
    need_review_count = sum(1 for s in scenario_comparisons if s.conclusion == ConclusionType.NEED_REVIEW)
    
    if degraded_count > 0:
        overall = ConclusionType.DEGRADED
    elif need_review_count > 0:
        overall = ConclusionType.NEED_REVIEW
    else:
        overall = ConclusionType.PASS
    
    for comp in scenario_comparisons:
        db_comp = ComparisonResult(
            comparison_id=comparison_id,
            base_report_id=request.base_report_id,
            target_report_id=request.target_report_id,
            scenario_name=comp.scenario_name,
            throughput_degradation=comp.throughput_degradation_pct,
            p95_degradation=comp.p95_degradation_pct,
            error_rate_increase=comp.error_rate_increase_pct,
            conclusion=comp.conclusion,
            need_manual_review=comp.need_manual_review,
            reviewed=False
        )
        db.add(db_comp)
    
    db.commit()
    
    return ComparisonResponse(
        comparison_id=comparison_id,
        base_report_id=request.base_report_id,
        target_report_id=request.target_report_id,
        scenarios=scenario_comparisons,
        overall_conclusion=overall,
        degraded_count=degraded_count,
        pass_count=pass_count,
        need_review_count=need_review_count
    )


@app.get("/api/v1/comparisons/{comparison_id}", response_model=ComparisonResponse)
async def get_comparison(comparison_id: str, db: Session = Depends(get_db)):
    comp_results = db.query(ComparisonResult).filter(ComparisonResult.comparison_id == comparison_id).all()
    if not comp_results:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error_code=ErrorCode.NOT_FOUND,
                message=f"Comparison {comparison_id} not found",
                details={"comparison_id": comparison_id}
            )
        )
    
    base_report_id = comp_results[0].base_report_id
    target_report_id = comp_results[0].target_report_id
    
    base_scenarios = db.query(LoadTestScenario).filter(LoadTestScenario.report_id == base_report_id).all()
    target_scenarios = db.query(LoadTestScenario).filter(LoadTestScenario.report_id == target_report_id).all()
    base_map = {s.scenario_name: s for s in base_scenarios}
    target_map = {s.scenario_name: s for s in target_scenarios}
    
    scenarios = []
    for comp in comp_results:
        base = base_map.get(comp.scenario_name)
        target = target_map.get(comp.scenario_name)
        if base and target:
            scenarios.append({
                "scenario_name": comp.scenario_name,
                "base_throughput": base.throughput,
                "target_throughput": target.throughput,
                "throughput_degradation_pct": comp.throughput_degradation,
                "base_p95": base.p95,
                "target_p95": target.p95,
                "p95_degradation_pct": comp.p95_degradation,
                "base_error_rate": base.error_rate,
                "target_error_rate": target.error_rate,
                "error_rate_increase_pct": comp.error_rate_increase,
                "conclusion": comp.conclusion,
                "need_manual_review": comp.need_manual_review
            })
    
    degraded_count = sum(1 for c in comp_results if c.conclusion == ConclusionType.DEGRADED)
    pass_count = sum(1 for c in comp_results if c.conclusion == ConclusionType.PASS)
    need_review_count = sum(1 for c in comp_results if c.conclusion == ConclusionType.NEED_REVIEW)
    
    if degraded_count > 0:
        overall = ConclusionType.DEGRADED
    elif need_review_count > 0:
        overall = ConclusionType.NEED_REVIEW
    else:
        overall = ConclusionType.PASS
    
    return ComparisonResponse(
        comparison_id=comparison_id,
        base_report_id=base_report_id,
        target_report_id=target_report_id,
        scenarios=scenarios,
        overall_conclusion=overall,
        degraded_count=degraded_count,
        pass_count=pass_count,
        need_review_count=need_review_count
    )


@app.post("/api/v1/comparisons/{comparison_id}/review")
async def review_comparison(comparison_id: str, request: ReviewRequest, db: Session = Depends(get_db)):
    comp_results = db.query(ComparisonResult).filter(ComparisonResult.comparison_id == comparison_id).all()
    if not comp_results:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error_code=ErrorCode.NOT_FOUND,
                message=f"Comparison {comparison_id} not found",
                details={"comparison_id": comparison_id}
            )
        )
    
    if comp_results[0].reviewed:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error_code=ErrorCode.ALREADY_PROCESSED,
                message=f"Comparison {comparison_id} already reviewed",
                details={"comparison_id": comparison_id}
            )
        )
    
    need_review = any(c.need_manual_review for c in comp_results)
    if not need_review and not request.approved:
        raise HTTPException(
            status_code=400,
            detail=ErrorResponse(
                error_code=ErrorCode.INVALID_STATE,
                message="Comparison does not require review",
                details={"comparison_id": comparison_id}
            )
        )
    
    for comp in comp_results:
        comp.reviewed = True
        comp.notes = request.notes
    
    db.commit()
    
    return {
        "comparison_id": comparison_id,
        "reviewed": True,
        "approved": request.approved,
        "notes": request.notes
    }


@app.delete("/api/v1/reports/{report_id}")
async def delete_report(report_id: str, db: Session = Depends(get_db)):
    report = db.query(LoadTestReport).filter(LoadTestReport.report_id == report_id).first()
    if not report:
        raise HTTPException(
            status_code=404,
            detail=ErrorResponse(
                error_code=ErrorCode.NOT_FOUND,
                message=f"Report {report_id} not found",
                details={"report_id": report_id}
            )
        )
    
    db.query(LoadTestScenario).filter(LoadTestScenario.report_id == report_id).delete()
    db.query(ComparisonResult).filter(
        (ComparisonResult.base_report_id == report_id) |
        (ComparisonResult.target_report_id == report_id)
    ).delete()
    db.delete(report)
    db.commit()
    
    return {"message": f"Report {report_id} deleted successfully"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
