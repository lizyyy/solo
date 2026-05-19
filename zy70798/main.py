from fastapi import FastAPI, Depends, HTTPException, status
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from database import init_db, get_db
from schemas import (
    QuarantinedTestCreate, QuarantinedTestUpdate, QuarantinedTestResponse,
    TestResultUpdate, CleanupReportResponse, CleanupSuggestionResponse,
    OwnerSummary, ErrorResponse, ErrorCodes, TestStatus
)
from services import QuarantineService, ResultMerger, ExpiryCalculator, CleanupAdvisor

app = FastAPI(title="测试隔离名单到期清理建议 API", version="1.0.0")


@app.on_event("startup")
async def startup_event():
    init_db()


@app.exception_handler(ValueError)
async def value_error_handler(request, exc):
    error_code = str(exc)
    if error_code == ErrorCodes.ALREADY_PROCESSED:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error_code": ErrorCodes.ALREADY_PROCESSED,
                "message": "该测试已被处理过",
                "details": {}
            }
        )
    elif error_code == ErrorCodes.INVALID_STATUS:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error_code": ErrorCodes.INVALID_STATUS,
                "message": "当前状态不允许此操作",
                "details": {"allowed_statuses": [TestStatus.READY_FOR_CLEANUP.value, TestStatus.EXPIRED.value]}
            }
        )
    elif error_code == ErrorCodes.REQUIRES_MANUAL_REVIEW:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "error_code": ErrorCodes.REQUIRES_MANUAL_REVIEW,
                "message": "需要人工复核",
                "details": {}
            }
        )
    return JSONResponse(
        status_code=status.HTTP_400_BAD_REQUEST,
        content={
            "error_code": ErrorCodes.VALIDATION_ERROR,
            "message": str(exc),
            "details": {}
        }
    )


def enrich_test_response(test) -> QuarantinedTestResponse:
    days = ExpiryCalculator.days_until_expiry(test.expiry_date)
    response = QuarantinedTestResponse.model_validate(test)
    response.days_until_expiry = days
    response.is_expired = days <= 0
    return response


@app.post("/api/quarantined-tests/", response_model=QuarantinedTestResponse, status_code=status.HTTP_201_CREATED)
def create_quarantined_test(test_data: QuarantinedTestCreate, db: Session = Depends(get_db)):
    """
    新增隔离测试记录
    """
    try:
        test = QuarantineService.create_test(db, test_data)
        return enrich_test_response(test)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={
                "error_code": ErrorCodes.VALIDATION_ERROR,
                "message": str(e)
            }
        )


@app.get("/api/quarantined-tests/", response_model=List[QuarantinedTestResponse])
def list_quarantined_tests(
    status: Optional[str] = None,
    owner: Optional[str] = None,
    reason_category: Optional[str] = None,
    expired_only: bool = False,
    expiring_soon_only: bool = False,
    db: Session = Depends(get_db)
):
    """
    查询隔离测试列表，支持按状态、负责人、原因分类筛选
    """
    tests = QuarantineService.list_tests(
        db, status, owner, reason_category, expired_only, expiring_soon_only
    )
    return [enrich_test_response(t) for t in tests]


@app.get("/api/quarantined-tests/{test_id}", response_model=QuarantinedTestResponse)
def get_quarantined_test(test_id: int, db: Session = Depends(get_db)):
    """
    获取单个隔离测试详情
    """
    test = QuarantineService.get_test(db, test_id)
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": ErrorCodes.NOT_FOUND,
                "message": "测试记录不存在"
            }
        )
    return enrich_test_response(test)


@app.patch("/api/quarantined-tests/{test_id}", response_model=QuarantinedTestResponse)
def update_quarantined_test(test_id: int, update_data: QuarantinedTestUpdate, db: Session = Depends(get_db)):
    """
    更新隔离测试信息
    """
    test = QuarantineService.update_test(db, test_id, update_data)
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": ErrorCodes.NOT_FOUND,
                "message": "测试记录不存在"
            }
        )
    return enrich_test_response(test)


@app.post("/api/quarantined-tests/{test_id}/result", response_model=QuarantinedTestResponse)
def update_test_result(test_id: int, result_data: TestResultUpdate, db: Session = Depends(get_db)):
    """
    更新测试运行结果
    """
    test = ResultMerger.update_test_result(db, test_id, result_data)
    if not test:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail={
                "error_code": ErrorCodes.NOT_FOUND,
                "message": "测试记录不存在"
            }
        )
    return enrich_test_response(test)


@app.post("/api/quarantined-tests/{test_id}/mark-cleaned", response_model=QuarantinedTestResponse)
def mark_test_cleaned(test_id: int, db: Session = Depends(get_db)):
    """
    标记测试为已清理（仅允许已到期或可清理状态的测试）
    """
    try:
        test = QuarantineService.mark_cleaned(db, test_id)
        if not test:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail={
                    "error_code": ErrorCodes.NOT_FOUND,
                    "message": "测试记录不存在"
                }
            )
        return enrich_test_response(test)
    except ValueError as e:
        raise


@app.get("/api/cleanup-suggestions/", response_model=List[CleanupSuggestionResponse])
def get_cleanup_suggestions(
    priority: Optional[str] = None,
    db: Session = Depends(get_db)
):
    """
    获取清理建议列表
    """
    tests = QuarantineService.list_tests(db)
    suggestions = []

    for test in tests:
        if test.status == TestStatus.CLEANED.value:
            continue

        suggestion_data = CleanupAdvisor.get_cleanup_suggestion(test)
        if priority and suggestion_data['priority'] != priority:
            continue

        suggestion = CleanupSuggestionResponse(
            test_id=test.id,
            test_name=test.test_name,
            test_path=test.test_path,
            owner=test.owner,
            reason_category=test.reason_category or 'other',
            expiry_date=test.expiry_date,
            days_until_expiry=ExpiryCalculator.days_until_expiry(test.expiry_date),
            consecutive_passes=test.consecutive_passes,
            **suggestion_data
        )
        suggestions.append(suggestion)

    return sorted(suggestions, key=lambda x: (x.priority != 'critical', x.priority != 'high', x.days_until_expiry))


@app.get("/api/owner-summary/", response_model=List[OwnerSummary])
def get_owner_summary(db: Session = Depends(get_db)):
    """
    按负责人汇总隔离测试情况
    """
    summaries = QuarantineService.get_owner_summary(db)
    result = []
    for summary in summaries:
        result.append(OwnerSummary(
            owner=summary['owner'],
            owner_email=summary['owner_email'],
            total_tests=summary['total_tests'],
            expired_count=summary['expired_count'],
            expiring_soon_count=summary['expiring_soon_count'],
            ready_for_cleanup_count=summary['ready_for_cleanup_count'],
            tests=[enrich_test_response(t) for t in summary['tests']]
        ))
    return result


@app.post("/api/cleanup-report/", response_model=CleanupReportResponse)
def generate_cleanup_report(generated_by: str = "system", db: Session = Depends(get_db)):
    """
    生成清理报告，包含统计数据和详细建议
    """
    report = QuarantineService.generate_cleanup_report(db, generated_by)
    suggestions = []
    tests = QuarantineService.list_tests(db)

    for test in tests:
        if test.status == TestStatus.CLEANED.value:
            continue

        suggestion_data = CleanupAdvisor.get_cleanup_suggestion(test)
        suggestion = CleanupSuggestionResponse(
            test_id=test.id,
            test_name=test.test_name,
            test_path=test.test_path,
            owner=test.owner,
            reason_category=test.reason_category or 'other',
            expiry_date=test.expiry_date,
            days_until_expiry=ExpiryCalculator.days_until_expiry(test.expiry_date),
            consecutive_passes=test.consecutive_passes,
            **suggestion_data
        )
        suggestions.append(suggestion)

    owner_summaries = []
    raw_summaries = QuarantineService.get_owner_summary(db)
    for summary in raw_summaries:
        owner_summaries.append(OwnerSummary(
            owner=summary['owner'],
            owner_email=summary['owner_email'],
            total_tests=summary['total_tests'],
            expired_count=summary['expired_count'],
            expiring_soon_count=summary['expiring_soon_count'],
            ready_for_cleanup_count=summary['ready_for_cleanup_count'],
            tests=[enrich_test_response(t) for t in summary['tests']]
        ))

    by_reason = {}
    for t in tests:
        cat = t.reason_category or 'other'
        by_reason[cat] = by_reason.get(cat, 0) + 1

    return CleanupReportResponse(
        id=report.id,
        report_date=report.report_date,
        total_quarantined=report.total_quarantined,
        expired=report.expired,
        expiring_soon=report.expiring_soon,
        ready_for_cleanup=report.ready_for_cleanup,
        requires_manual_review=report.requires_manual_review,
        suggestions=sorted(suggestions, key=lambda x: (
            x.priority != 'critical', x.priority != 'high', x.days_until_expiry
        )),
        by_owner=owner_summaries,
        by_reason=by_reason
    )


@app.get("/health")
def health_check():
    return {"status": "ok", "service": "test-quarantine-api"}
