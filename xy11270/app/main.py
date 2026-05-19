from fastapi import FastAPI, HTTPException
from typing import List
from datetime import datetime
import pandas as pd
import io
from fastapi.responses import StreamingResponse
import logging

from .models import (
    TranscriptRequest, ScanResult, ReviewRequest,
    ReviewStatus, SummaryStats
)
from .rules import scan_transcript, RULE_VERSION, mask_sensitive_data
from .storage import storage


logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('data/app.log'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


class MaskedLogFilter(logging.Filter):
    def filter(self, record):
        record.msg = mask_sensitive_data(str(record.msg))
        return True


logger.addFilter(MaskedLogFilter())


app = FastAPI(title="客服质检系统", version="1.0.0")


@app.post("/api/scan", response_model=ScanResult)
async def scan_transcript_endpoint(request: TranscriptRequest):
    logger.info(f"开始扫描转写文本: {mask_sensitive_data(request.transcript_id)}")
    
    existing = storage.get_scan_result(request.transcript_id)
    if existing and existing.get('rule_version') == RULE_VERSION:
        logger.info(f"使用已存在的扫描结果: {mask_sensitive_data(request.transcript_id)}")
        return existing
    
    violations, scan_details = scan_transcript(request.segments, request.metadata)
    
    has_high_severity = any(v.severity == "high" for v in violations)
    
    result = ScanResult(
        transcript_id=request.transcript_id,
        scanned_at=datetime.now(),
        violations=violations,
        passed=len(violations) == 0,
        review_required=has_high_severity,
        rule_version=RULE_VERSION,
        scan_details=scan_details
    )
    
    storage.save_scan_result(result)
    logger.info(f"扫描完成: {mask_sensitive_data(request.transcript_id)}, 违规数: {len(violations)}")
    
    return result


@app.post("/api/review")
async def review_transcript_endpoint(request: ReviewRequest):
    logger.info(f"开始复核: {mask_sensitive_data(request.transcript_id)}")
    
    if not storage.transcript_exists(request.transcript_id):
        raise HTTPException(status_code=404, detail="转写记录不存在")
    
    storage.save_review(
        transcript_id=request.transcript_id,
        status=request.status,
        reviewer=request.reviewer,
        comment=request.comment
    )
    
    logger.info(f"复核完成: {mask_sensitive_data(request.transcript_id)}, 状态: {request.status}")
    
    return {
        "transcript_id": request.transcript_id,
        "status": request.status,
        "message": "复核成功"
    }


@app.get("/api/result/{transcript_id}")
async def get_scan_result(transcript_id: str):
    result = storage.get_scan_result(transcript_id)
    if not result:
        raise HTTPException(status_code=404, detail="扫描结果不存在")
    
    review = storage.get_review(transcript_id)
    result["review"] = review
    
    return result


@app.get("/api/summary", response_model=SummaryStats)
async def get_summary():
    all_results = storage.get_all_scan_results()
    all_reviews = {r["transcript_id"]: r for r in storage.get_all_reviews()}
    
    violations_by_type = {}
    passed = 0
    failed = 0
    pending_review = 0
    
    for result in all_results:
        if result.get("passed"):
            passed += 1
        else:
            failed += 1
        
        for v in result.get("violations", []):
            v_type = v.get("type") if isinstance(v, dict) else v.type
            violations_by_type[v_type] = violations_by_type.get(v_type, 0) + 1
        
        tid = result.get("transcript_id")
        if tid in all_reviews:
            if all_reviews[tid]["status"] == ReviewStatus.PENDING:
                pending_review += 1
        elif result.get("review_required"):
            pending_review += 1
    
    return SummaryStats(
        total_scanned=len(all_results),
        passed=passed,
        failed=failed,
        pending_review=pending_review,
        violations_by_type=violations_by_type
    )


@app.post("/api/export")
async def export_results():
    all_results = storage.get_all_scan_results()
    all_reviews = {r["transcript_id"]: r for r in storage.get_all_reviews()}
    
    export_data = []
    for result in all_results:
        review = all_reviews.get(result["transcript_id"], {})
        
        row = {
            "转写ID": mask_sensitive_data(result["transcript_id"]),
            "扫描时间": result["scanned_at"],
            "是否通过": "是" if result["passed"] else "否",
            "违规数量": len(result["violations"]),
            "违规类型": ", ".join([
                v["type"] if isinstance(v, dict) else v.type 
                for v in result["violations"]
            ]),
            "复核状态": review.get("status", "待复核"),
            "复核人": review.get("reviewer", ""),
            "复核时间": review.get("reviewed_at", "")
        }
        export_data.append(row)
    
    df = pd.DataFrame(export_data)
    
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='质检结果')
    
    output.seek(0)
    
    return StreamingResponse(
        output,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=quality_check_results.xlsx"}
    )


@app.get("/api/rules")
async def get_rules():
    from .rules import APOLOGY_KEYWORDS, REFUND_KEYWORDS, SENSITIVE_WORDS
    
    return {
        "rule_version": RULE_VERSION,
        "apology_keywords": list(APOLOGY_KEYWORDS),
        "refund_keywords": list(REFUND_KEYWORDS),
        "sensitive_words": [mask_sensitive_data(w) for w in SENSITIVE_WORDS]
    }


@app.get("/health")
async def health_check():
    return {"status": "ok", "service": "客服质检系统"}
