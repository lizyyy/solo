from fastapi import APIRouter, Depends, HTTPException, Query, Path
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import os

from app.database import get_db
from app.schemas import ApiResponse, ExportResponse
from app.services.query_export_service import RiskQueryService, AuditExportService
from app.config import settings

router = APIRouter(prefix="/query-export", tags=["风险查询与审计导出"])

@router.get("/search/plans", response_model=ApiResponse)
async def search_plans(
    keyword: Optional[str] = Query(None, description="搜索关键词（计划编号、名称、区段、负责人）"),
    line: Optional[str] = Query(None, description="线路"),
    status: Optional[str] = Query(None, description="状态"),
    start_date: Optional[str] = Query(None, description="开始日期，格式：YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期，格式：YYYY-MM-DD"),
    has_conflicts: Optional[bool] = Query(None, description="是否存在未解决冲突"),
    offset: int = Query(0, ge=0, description="偏移量"),
    limit: int = Query(100, ge=1, le=1000, description="每页数量"),
    db: Session = Depends(get_db)
):
    """综合搜索施工计划"""
    try:
        start_dt = None
        end_dt = None
        
        if start_date:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        
        if end_date:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        
        result = RiskQueryService.search_plans(
            db, keyword, line, status,
            start_dt, end_dt, has_conflicts,
            offset, limit
        )
        
        return ApiResponse(
            success=True,
            message=f"共 {result['total']} 条计划",
            data=result
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"搜索失败: {str(e)}")

@router.get("/audit-logs", response_model=ApiResponse)
async def get_audit_logs(
    operation_type: Optional[str] = Query(None, description="操作类型：导入/冲突检查/审签通过/驳回/撤销/查询/导出"),
    operator: Optional[str] = Query(None, description="操作人"),
    target_type: Optional[str] = Query(None, description="目标类型：plan/train/power/personnel/conflict"),
    start_date: Optional[str] = Query(None, description="开始日期，格式：YYYY-MM-DD"),
    end_date: Optional[str] = Query(None, description="结束日期，格式：YYYY-MM-DD"),
    offset: int = Query(0, ge=0, description="偏移量"),
    limit: int = Query(100, ge=1, le=1000, description="每页数量"),
    db: Session = Depends(get_db)
):
    """查询审计日志"""
    try:
        start_dt = None
        end_dt = None
        
        if start_date:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        
        if end_date:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        
        result = RiskQueryService.get_audit_logs(
            db, operation_type, operator, target_type,
            start_dt, end_dt, offset, limit
        )
        
        return ApiResponse(
            success=True,
            message=f"共 {result['total']} 条日志",
            data=result
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询失败: {str(e)}")

@router.post("/export/conflicts/csv", response_model=ExportResponse)
async def export_conflicts_csv(
    risk_level: Optional[str] = Query(None, description="风险等级"),
    conflict_type: Optional[str] = Query(None, description="冲突类型"),
    is_resolved: bool = Query(False, description="是否已解决"),
    start_date: Optional[str] = Query(None, description="开始日期"),
    end_date: Optional[str] = Query(None, description="结束日期"),
    db: Session = Depends(get_db)
):
    """导出冲突记录为 CSV"""
    try:
        start_dt = None
        end_dt = None
        
        if start_date:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        
        if end_date:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        
        filepath, filename = AuditExportService.export_conflicts_to_csv(
            db, risk_level, conflict_type, is_resolved,
            start_dt, end_dt
        )
        
        file_size = os.path.getsize(filepath)
        
        return ExportResponse(
            success=True,
            message="冲突记录导出成功",
            file_name=filename,
            file_path=filepath,
            file_size=file_size,
            export_time=datetime.now()
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")

@router.post("/export/audit-logs/csv", response_model=ExportResponse)
async def export_audit_logs_csv(
    operation_type: Optional[str] = Query(None, description="操作类型"),
    operator: Optional[str] = Query(None, description="操作人"),
    target_type: Optional[str] = Query(None, description="目标类型"),
    start_date: Optional[str] = Query(None, description="开始日期"),
    end_date: Optional[str] = Query(None, description="结束日期"),
    db: Session = Depends(get_db)
):
    """导出审计日志为 CSV"""
    try:
        start_dt = None
        end_dt = None
        
        if start_date:
            start_dt = datetime.strptime(start_date, "%Y-%m-%d")
        
        if end_date:
            end_dt = datetime.strptime(end_date, "%Y-%m-%d")
        
        filepath, filename = AuditExportService.export_audit_logs_to_csv(
            db, operation_type, operator, target_type,
            start_dt, end_dt
        )
        
        file_size = os.path.getsize(filepath)
        
        return ExportResponse(
            success=True,
            message="审计日志导出成功",
            file_name=filename,
            file_path=filepath,
            file_size=file_size,
            export_time=datetime.now()
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")

@router.post("/export/daily-report", response_model=ExportResponse)
async def export_daily_report(
    report_date: Optional[str] = Query(None, description="报告日期，格式：YYYY-MM-DD，默认今天"),
    format: str = Query("markdown", description="导出格式：markdown 或 csv"),
    db: Session = Depends(get_db)
):
    """导出每日审计报告"""
    try:
        if format not in ["markdown", "csv"]:
            raise HTTPException(status_code=400, detail="导出格式必须是 markdown 或 csv")
        
        report_dt = None
        if report_date:
            report_dt = datetime.strptime(report_date, "%Y-%m-%d")
        
        filepath, filename = AuditExportService.export_daily_audit_report(
            db, report_dt, format
        )
        
        file_size = os.path.getsize(filepath)
        
        return ExportResponse(
            success=True,
            message=f"每日报告导出成功（{format}格式）",
            file_name=filename,
            file_path=filepath,
            file_size=file_size,
            export_time=datetime.now()
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")

@router.post("/export/plan/{plan_id}", response_model=ExportResponse)
async def export_plan_detail(
    plan_id: int = Path(..., description="计划ID"),
    format: str = Query("markdown", description="导出格式：markdown 或 csv"),
    db: Session = Depends(get_db)
):
    """导出单个计划的详细报告"""
    try:
        if format not in ["markdown", "csv"]:
            raise HTTPException(status_code=400, detail="导出格式必须是 markdown 或 csv")
        
        filepath, filename = AuditExportService.export_plan_detail(
            db, plan_id, format
        )
        
        file_size = os.path.getsize(filepath)
        
        return ExportResponse(
            success=True,
            message=f"计划详情导出成功（{format}格式）",
            file_name=filename,
            file_path=filepath,
            file_size=file_size,
            export_time=datetime.now()
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出失败: {str(e)}")

@router.get("/download/{filename}")
async def download_file(
    filename: str = Path(..., description="文件名")
):
    """下载导出的文件"""
    filepath = os.path.join(settings.EXPORT_DIR, filename)
    
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="文件不存在")
    
    media_type = "text/markdown"
    if filename.endswith(".csv"):
        media_type = "text/csv"
    
    return FileResponse(
        path=filepath,
        media_type=media_type,
        filename=filename
    )

@router.get("/exported-files", response_model=ApiResponse)
async def list_exported_files():
    """列出所有已导出的文件"""
    try:
        files = []
        
        if os.path.exists(settings.EXPORT_DIR):
            for filename in os.listdir(settings.EXPORT_DIR):
                filepath = os.path.join(settings.EXPORT_DIR, filename)
                if os.path.isfile(filepath):
                    stat = os.stat(filepath)
                    files.append({
                        "filename": filename,
                        "size": stat.st_size,
                        "created_time": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                        "modified_time": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                        "download_url": f"/api/query-export/download/{filename}"
                    })
        
        files.sort(key=lambda x: x["modified_time"], reverse=True)
        
        return ApiResponse(
            success=True,
            message=f"共 {len(files)} 个导出文件",
            data={
                "total": len(files),
                "files": files
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"获取文件列表失败: {str(e)}")
