from fastapi import FastAPI, Depends, HTTPException, Query
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from pydantic import BaseModel, Field

from database import (
    get_db, init_db, ChangeLog, ProcessingStatus, RiskLevel,
    ModuleTag, Interface, CustomerImpact, RiskWordMatch
)
from processor import ChangeLogProcessor, ExportService
import enum


class ErrorCode(str, enum.Enum):
    MISSING_FIELD = "missing_field"
    INVALID_STATUS = "invalid_status"
    NEEDS_REVIEW = "needs_review"
    ALREADY_PROCESSED = "already_processed"
    NOT_FOUND = "not_found"
    VALIDATION_ERROR = "validation_error"


class ChangelogCreate(BaseModel):
    title: str = Field(..., description="变更日志标题")
    content: str = Field(..., description="Markdown格式的变更日志内容")
    version: Optional[str] = Field(None, description="版本号")
    release_date: Optional[datetime] = Field(None, description="发布日期")


class ChangelogUpdate(BaseModel):
    title: Optional[str] = None
    content: Optional[str] = None
    version: Optional[str] = None
    release_date: Optional[datetime] = None
    review_notes: Optional[str] = None


class ChangelogFilter(BaseModel):
    status: Optional[ProcessingStatus] = None
    risk_level: Optional[RiskLevel] = None
    needs_human_review: Optional[bool] = None
    tag: Optional[str] = None
    version: Optional[str] = None


class ErrorResponse(BaseModel):
    error_code: ErrorCode
    message: str
    details: Optional[dict] = None


app = FastAPI(
    title="变更日志影响抽取风险分级后端API",
    description="从Release Note中抽取影响客户功能和接口，进行风险分级的工具",
    version="1.0.0"
)


@app.on_event("startup")
async def startup_event():
    init_db()


@app.exception_handler(HTTPException)
async def http_exception_handler(request, exc):
    return JSONResponse(
        status_code=exc.status_code,
        content={"detail": exc.detail}
    )


def create_error_response(
    error_code: ErrorCode,
    message: str,
    status_code: int = 400,
    details: Optional[dict] = None
) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={
            "error_code": error_code.value,
            "message": message,
            "details": details
        }
    )


@app.post("/api/v1/changelogs", response_model=dict, summary="导入变更日志")
async def create_changelog(
    changelog: ChangelogCreate,
    db: Session = Depends(get_db)
):
    try:
        if not changelog.title:
            return create_error_response(
                ErrorCode.MISSING_FIELD,
                "缺少必填字段 title",
                400,
                {"field": "title"}
            )
        if not changelog.content:
            return create_error_response(
                ErrorCode.MISSING_FIELD,
                "缺少必填字段 content",
                400,
                {"field": "content"}
            )
        
        db_changelog = ChangeLog(
            title=changelog.title,
            content=changelog.content,
            version=changelog.version,
            release_date=changelog.release_date
        )
        db.add(db_changelog)
        db.commit()
        db.refresh(db_changelog)
        
        return {
            "id": db_changelog.id,
            "title": db_changelog.title,
            "status": db_changelog.status.value,
            "created_at": db_changelog.created_at.isoformat()
        }
    except Exception as e:
        return create_error_response(
            ErrorCode.VALIDATION_ERROR,
            str(e),
            500
        )


@app.post("/api/v1/changelogs/{changelog_id}/process", summary="处理变更日志")
async def process_changelog(
    changelog_id: int,
    db: Session = Depends(get_db)
):
    try:
        changelog = db.query(ChangeLog).filter_by(id=changelog_id).first()
        if not changelog:
            return create_error_response(
                ErrorCode.NOT_FOUND,
                f"变更日志 {changelog_id} 不存在",
                404
            )
        
        if changelog.status == ProcessingStatus.PROCESSED:
            return create_error_response(
                ErrorCode.ALREADY_PROCESSED,
                "该变更日志已经处理过",
                400,
                {"changelog_id": changelog_id, "current_status": changelog.status.value}
            )
        
        processor = ChangeLogProcessor(db)
        result = processor.process_changelog(changelog_id)
        
        response_data = ExportService.export_to_dict(result)
        
        if result.status == ProcessingStatus.NEEDS_REVIEW:
            return create_error_response(
                ErrorCode.NEEDS_REVIEW,
                "自动处理完成，但需要人工复核",
                202,
                response_data
            )
        
        return response_data
        
    except ValueError as e:
        if "already processed" in str(e).lower():
            return create_error_response(
                ErrorCode.ALREADY_PROCESSED,
                str(e),
                400
            )
        return create_error_response(
            ErrorCode.INVALID_STATUS,
            str(e),
            400
        )
    except Exception as e:
        return create_error_response(
            ErrorCode.VALIDATION_ERROR,
            str(e),
            500
        )


@app.get("/api/v1/changelogs", summary="筛选查询变更日志列表")
async def list_changelogs(
    status: Optional[ProcessingStatus] = Query(None, description="状态筛选"),
    risk_level: Optional[RiskLevel] = Query(None, description="风险等级筛选"),
    needs_human_review: Optional[bool] = Query(None, description="是否需要人工复核"),
    tag: Optional[str] = Query(None, description="模块标签筛选"),
    version: Optional[str] = Query(None, description="版本号筛选"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    db: Session = Depends(get_db)
):
    query = db.query(ChangeLog)
    
    if status:
        query = query.filter(ChangeLog.status == status)
    if risk_level:
        query = query.filter(ChangeLog.risk_level == risk_level)
    if needs_human_review is not None:
        query = query.filter(ChangeLog.needs_human_review == needs_human_review)
    if tag:
        query = query.join(ChangeLog.tags).filter(ModuleTag.tag_name.ilike(f"%{tag}%"))
    if version:
        query = query.filter(ChangeLog.version.ilike(f"%{version}%"))
    
    total = query.count()
    changelogs = query.offset(skip).limit(limit).all()
    
    return {
        "total": total,
        "skip": skip,
        "limit": limit,
        "items": ExportService.export_list(changelogs)
    }


@app.get("/api/v1/changelogs/{changelog_id}", summary="获取单个变更日志详情")
async def get_changelog(
    changelog_id: int,
    db: Session = Depends(get_db)
):
    changelog = db.query(ChangeLog).filter_by(id=changelog_id).first()
    if not changelog:
        return create_error_response(
            ErrorCode.NOT_FOUND,
            f"变更日志 {changelog_id} 不存在",
            404
        )
    
    return ExportService.export_to_dict(changelog)


@app.put("/api/v1/changelogs/{changelog_id}", summary="更新变更日志")
async def update_changelog(
    changelog_id: int,
    update: ChangelogUpdate,
    db: Session = Depends(get_db)
):
    changelog = db.query(ChangeLog).filter_by(id=changelog_id).first()
    if not changelog:
        return create_error_response(
            ErrorCode.NOT_FOUND,
            f"变更日志 {changelog_id} 不存在",
            404
        )
    
    if changelog.status == ProcessingStatus.PROCESSED:
        return create_error_response(
            ErrorCode.ALREADY_PROCESSED,
            "已处理的变更日志不允许修改",
            400
        )
    
    update_data = update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(changelog, key, value)
    
    db.commit()
    db.refresh(changelog)
    
    return ExportService.export_to_dict(changelog)


@app.post("/api/v1/changelogs/{changelog_id}/approve", summary="人工审核通过")
async def approve_changelog(
    changelog_id: int,
    review_notes: Optional[str] = None,
    db: Session = Depends(get_db)
):
    changelog = db.query(ChangeLog).filter_by(id=changelog_id).first()
    if not changelog:
        return create_error_response(
            ErrorCode.NOT_FOUND,
            f"变更日志 {changelog_id} 不存在",
            404
        )
    
    if changelog.status != ProcessingStatus.NEEDS_REVIEW:
        return create_error_response(
            ErrorCode.INVALID_STATUS,
            f"当前状态不允许审核，当前状态: {changelog.status.value}",
            400,
            {"expected_status": ProcessingStatus.NEEDS_REVIEW.value, "actual_status": changelog.status.value}
        )
    
    changelog.status = ProcessingStatus.PROCESSED
    changelog.needs_human_review = False
    if review_notes:
        changelog.review_notes = review_notes
    
    db.commit()
    db.refresh(changelog)
    
    return ExportService.export_to_dict(changelog)


@app.get("/api/v1/export", summary="导出变更日志清单")
async def export_changelogs(
    status: Optional[ProcessingStatus] = Query(ProcessingStatus.PROCESSED, description="状态筛选"),
    risk_level: Optional[RiskLevel] = Query(None, description="风险等级筛选"),
    format: str = Query("json", description="导出格式: json"),
    db: Session = Depends(get_db)
):
    query = db.query(ChangeLog)
    
    if status:
        query = query.filter(ChangeLog.status == status)
    if risk_level:
        query = query.filter(ChangeLog.risk_level == risk_level)
    
    changelogs = query.all()
    
    if format == "json":
        return {
            "export_time": datetime.utcnow().isoformat(),
            "count": len(changelogs),
            "data": ExportService.export_list(changelogs)
        }
    
    return create_error_response(
        ErrorCode.VALIDATION_ERROR,
        f"不支持的导出格式: {format}",
        400
    )


@app.get("/api/v1/stats", summary="获取统计信息")
async def get_stats(db: Session = Depends(get_db)):
    total = db.query(ChangeLog).count()
    by_status = {}
    for status in ProcessingStatus:
        by_status[status.value] = db.query(ChangeLog).filter_by(status=status).count()
    
    by_risk = {}
    for risk in RiskLevel:
        by_risk[risk.value] = db.query(ChangeLog).filter_by(risk_level=risk).count()
    
    needs_review = db.query(ChangeLog).filter_by(needs_human_review=True).count()
    
    return {
        "total": total,
        "by_status": by_status,
        "by_risk": by_risk,
        "needs_human_review": needs_review
    }


@app.get("/health", summary="健康检查")
async def health_check():
    return {"status": "healthy", "service": "changelog-impact-analyzer"}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
