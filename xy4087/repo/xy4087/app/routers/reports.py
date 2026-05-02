from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import PlainTextResponse, StreamingResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import io

from app.database import get_db
from app.models import Dataset
from app.schemas import ReportRequest, ReportResponse
from app.services.report_generator import report_generator

router = APIRouter(prefix="/datasets/{dataset_id}/reports", tags=["审计报告"])


@router.post("/generate", response_model=ReportResponse)
def generate_report(
    dataset_id: int,
    report_request: ReportRequest,
    db: Session = Depends(get_db)
):
    """
    生成审计报告
    
    支持两种格式：
    - markdown: Markdown格式，适合查看和文档
    - csv: CSV格式，适合数据分析
    """
    # 检查数据集是否存在
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail=f"数据集 {dataset_id} 不存在")
    
    try:
        content = report_generator.generate_report(
            db=db,
            dataset_id=dataset_id,
            report_format=report_request.format,
            include_transactions=report_request.include_transactions,
            include_audit_logs=report_request.include_audit_logs
        )
        
        return ReportResponse(
            dataset_id=dataset_id,
            dataset_name=dataset.name,
            generated_at=datetime.utcnow(),
            format=report_request.format,
            content=content
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/download/markdown")
def download_markdown_report(
    dataset_id: int,
    include_transactions: bool = Query(True, description="包含预算交易记录"),
    include_audit_logs: bool = Query(True, description="包含审计日志"),
    db: Session = Depends(get_db)
):
    """
    下载Markdown格式的审计报告
    
    返回可下载的 .md 文件
    """
    # 检查数据集是否存在
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail=f"数据集 {dataset_id} 不存在")
    
    try:
        content = report_generator.generate_report(
            db=db,
            dataset_id=dataset_id,
            report_format="markdown",
            include_transactions=include_transactions,
            include_audit_logs=include_audit_logs
        )
        
        # 创建响应
        filename = f"audit_report_{dataset_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.md"
        
        return StreamingResponse(
            io.StringIO(content),
            media_type="text/markdown",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/download/csv")
def download_csv_report(
    dataset_id: int,
    include_transactions: bool = Query(True, description="包含预算交易记录"),
    include_audit_logs: bool = Query(True, description="包含审计日志"),
    db: Session = Depends(get_db)
):
    """
    下载CSV格式的审计报告
    
    返回可下载的 .csv 文件
    """
    # 检查数据集是否存在
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail=f"数据集 {dataset_id} 不存在")
    
    try:
        content = report_generator.generate_report(
            db=db,
            dataset_id=dataset_id,
            report_format="csv",
            include_transactions=include_transactions,
            include_audit_logs=include_audit_logs
        )
        
        # 创建响应
        filename = f"audit_report_{dataset_id}_{datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
        
        return StreamingResponse(
            io.StringIO(content),
            media_type="text/csv",
            headers={
                "Content-Disposition": f"attachment; filename={filename}"
            }
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/preview/markdown")
def preview_markdown_report(
    dataset_id: int,
    include_transactions: bool = Query(True, description="包含预算交易记录"),
    include_audit_logs: bool = Query(True, description="包含审计日志"),
    db: Session = Depends(get_db)
):
    """
    预览Markdown格式的审计报告
    
    返回纯文本格式的报告内容，用于在线预览
    """
    # 检查数据集是否存在
    dataset = db.query(Dataset).filter(Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail=f"数据集 {dataset_id} 不存在")
    
    try:
        content = report_generator.generate_report(
            db=db,
            dataset_id=dataset_id,
            report_format="markdown",
            include_transactions=include_transactions,
            include_audit_logs=include_audit_logs
        )
        
        return PlainTextResponse(
            content=content,
            media_type="text/markdown"
        )
        
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
