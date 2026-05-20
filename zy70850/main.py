from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import Response
from typing import List
import json

from models import (
    ClaimApplication, Policy, ReconciliationResult, ReconciliationSummary,
    ReviewRequest, IssueType
)
from reconciliation import ReconciliationService
from report_generator import ReportGenerator

app = FastAPI(title="理赔对账服务 API", version="1.0.0")

reconciliation_service = ReconciliationService()
report_generator = ReportGenerator()


@app.post("/api/import/claim", response_model=ReconciliationResult, summary="导入理赔数据并对账")
async def import_and_process_claim(claim_json: UploadFile = File(...), policy_json: UploadFile = File(...)):
    try:
        claim_content = await claim_json.read()
        policy_content = await policy_json.read()
        
        claim_data = json.loads(claim_content.decode('utf-8'))
        policy_data = json.loads(policy_content.decode('utf-8'))
        
        claim = ClaimApplication(**claim_data)
        policy = Policy(**policy_data)
        
        reconciliation_service.data_importer.imported_claims[claim.claim_id] = claim
        reconciliation_service.data_importer.imported_policies[policy.policy_id] = policy
        
        result = reconciliation_service.process_claim(claim, policy)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"导入失败: {str(e)}")


@app.post("/api/import/claim/direct", response_model=ReconciliationResult, summary="直接传入理赔对象对账")
async def process_claim_direct(claim: ClaimApplication, policy: Policy):
    try:
        reconciliation_service.data_importer.imported_claims[claim.claim_id] = claim
        reconciliation_service.data_importer.imported_policies[policy.policy_id] = policy
        
        result = reconciliation_service.process_claim(claim, policy)
        return result
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"处理失败: {str(e)}")


@app.get("/api/claims", response_model=List[ReconciliationResult], summary="获取所有对账结果")
async def get_all_claims():
    return reconciliation_service.get_all_results()


@app.get("/api/claims/{claim_id}", response_model=ReconciliationResult, summary="获取单个对账结果")
async def get_claim(claim_id: str):
    result = reconciliation_service.get_result(claim_id)
    if not result:
        raise HTTPException(status_code=404, detail="未找到该理赔记录")
    return result


@app.post("/api/review", response_model=ReconciliationResult, summary="人工复核")
async def review_claim(review_request: ReviewRequest):
    try:
        result = reconciliation_service.process_review(review_request)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"复核失败: {str(e)}")


@app.post("/api/recalculate/{claim_id}", response_model=ReconciliationResult, summary="重新计算")
async def recalculate_claim(claim_id: str):
    try:
        result = reconciliation_service.recalculate_result(claim_id)
        return result
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@app.get("/api/summary", response_model=ReconciliationSummary, summary="获取汇总统计")
async def get_summary():
    return reconciliation_service.get_summary()


@app.get("/api/claims/{claim_id}/explanation/{issue_type}", summary="获取问题详细解释")
async def get_issue_explanation(claim_id: str, issue_type: IssueType):
    explanation = reconciliation_service.get_issue_explanation(claim_id, issue_type)
    if not explanation:
        raise HTTPException(status_code=404, detail="未找到该问题的解释")
    return explanation


@app.get("/api/claims/{claim_id}/justification", summary="生成理赔说明文本")
async def get_justification(claim_id: str):
    result = reconciliation_service.get_result(claim_id)
    if not result:
        raise HTTPException(status_code=404, detail="未找到该理赔记录")
    
    justification = report_generator.generate_justification_for_claim(result)
    return {"justification": justification}


@app.get("/api/reports/detail/{claim_id}", summary="下载明细报告")
async def download_detail_report(claim_id: str):
    result = reconciliation_service.get_result(claim_id)
    if not result:
        raise HTTPException(status_code=404, detail="未找到该理赔记录")
    
    report_content = report_generator.generate_detail_report_text(result)
    filename = f"detail_report_{claim_id}.txt"
    
    return Response(
        content=report_content,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )


@app.get("/api/reports/summary", summary="下载汇总报告")
async def download_summary_report():
    summary = reconciliation_service.get_summary()
    report_content = report_generator.generate_summary_report_text(summary)
    
    return Response(
        content=report_content,
        media_type="text/plain; charset=utf-8",
        headers={"Content-Disposition": "attachment; filename=summary_report.txt"}
    )


@app.get("/api/reports/csv/detail", summary="下载明细CSV")
async def download_detail_csv():
    results = reconciliation_service.get_all_results()
    csv_content = report_generator.generate_detail_csv(results)
    
    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": "attachment; filename=reconciliation_detail.csv"}
    )


@app.get("/api/reports/csv/issues", summary="下载问题CSV")
async def download_issues_csv():
    results = reconciliation_service.get_all_results()
    csv_content = report_generator.generate_issues_csv(results)
    
    return Response(
        content=csv_content,
        media_type="text/csv; charset=utf-8-sig",
        headers={"Content-Disposition": "attachment; filename=issues_detail.csv"}
    )


@app.delete("/api/clear", summary="清空所有数据")
async def clear_all_data():
    reconciliation_service.clear_all()
    return {"message": "所有数据已清空"}


@app.get("/", summary="健康检查")
async def root():
    return {
        "service": "理赔对账服务",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs"
    }


if __name__ == "__main__":
    import uvicorn
    print("=" * 60)
    print("        理赔对账服务启动中...")
    print("=" * 60)
    print("API 文档: http://localhost:8000/docs")
    print("备用文档: http://localhost:8000/redoc")
    print("=" * 60)
    uvicorn.run(app, host="0.0.0.0", port=8000)
