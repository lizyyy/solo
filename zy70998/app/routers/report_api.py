from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from app.database import get_db, REPORT_DIR
from app.services.reporter import (
    generate_report,
    list_reports,
    get_report_detail,
    get_explanation_for_record,
    get_report_file_path,
)
from app.schemas import ReportGenerateRequest
from pathlib import Path

router = APIRouter(prefix="/api/report", tags=["报告"])


@router.post("/generate", summary="生成对账报告")
async def create_report(
    req: ReportGenerateRequest,
    db: Session = Depends(get_db),
):
    result = generate_report(db, req.title, req.batch_nos, req.generated_by)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "报告生成失败"))
    return result


@router.get("/list", summary="查询报告列表")
async def get_reports(db: Session = Depends(get_db)):
    return list_reports(db)


@router.get("/{report_id}", summary="查询报告详情（含完整明细追溯）")
async def get_detail(report_id: int, db: Session = Depends(get_db)):
    detail = get_report_detail(db, report_id)
    if not detail:
        raise HTTPException(status_code=404, detail="报告不存在")
    return detail


@router.get("/{report_id}/download", summary="下载报告 CSV 文件")
async def download_report(report_id: int, db: Session = Depends(get_db)):
    from app.models import Report
    report = db.query(Report).filter_by(id=report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="报告不存在")

    path = get_report_file_path(report.report_no)
    if not path:
        raise HTTPException(status_code=404, detail="报告文件不存在")

    return FileResponse(
        path=path,
        filename=report.file_name,
        media_type="text/csv",
    )


@router.get("/explanation/{rec_id}", summary="单条记录的完整差异解释（用于对外说明）")
async def get_explanation(rec_id: int, db: Session = Depends(get_db)):
    explanation = get_explanation_for_record(db, rec_id)
    if not explanation:
        raise HTTPException(status_code=404, detail="对账记录不存在")
    return explanation
