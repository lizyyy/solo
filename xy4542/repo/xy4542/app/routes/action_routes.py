from fastapi import APIRouter, Depends, HTTPException, Query, Form
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
import os

from app.config import get_db, EXPORT_DIR
from app.services.risk_service import RiskService
from app.services.export_service import ExportService
from app.models.models import Bundle, RiskAlert, AuditLog

router = APIRouter(prefix="/action", tags=["操作接口"])


@router.post("/recalculate", summary="执行风险重算")
async def recalculate_risks(
    business_date: str = Form(..., description="营业日期, 格式: YYYY-MM-DD"),
    operator: Optional[str] = Form("system", description="操作人"),
    db: Session = Depends(get_db)
):
    try:
        sync_count = RiskService.sync_bundles_from_sources(db, business_date)
        
        risk_count = RiskService.run_all_checks(db, business_date, operator)
        
        return {
            "success": True,
            "message": f"风险重算完成：同步扎把 {sync_count} 条，发现风险 {risk_count} 条",
            "data": {
                "sync_count": sync_count,
                "risk_count": risk_count
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"风险重算失败: {str(e)}")


@router.post("/review/{alert_id}", summary="人工复核风险预警")
async def review_alert(
    alert_id: int,
    reviewer: str = Form(..., description="复核人"),
    decision: str = Form(..., description="复核结论: confirm(确认风险)/dismiss(忽略风险)"),
    remark: str = Form("", description="复核备注"),
    db: Session = Depends(get_db)
):
    if decision not in ["confirm", "dismiss"]:
        raise HTTPException(status_code=400, detail="decision 必须是 confirm 或 dismiss")
    
    try:
        alert = RiskService.review_alert(db, alert_id, reviewer, decision, remark)
        
        return {
            "success": True,
            "message": f"复核成功，结论: {decision}",
            "data": {
                "alert_id": alert.id,
                "alert_code": alert.alert_code,
                "is_reviewed": alert.is_reviewed,
                "reviewed_by": alert.reviewed_by,
                "review_remark": alert.review_remark
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"复核失败: {str(e)}")


@router.post("/review/batch", summary="批量复核风险预警")
async def batch_review_alerts(
    alert_ids: str = Form(..., description="风险预警ID列表, 逗号分隔"),
    reviewer: str = Form(..., description="复核人"),
    decision: str = Form(..., description="复核结论: confirm(确认风险)/dismiss(忽略风险)"),
    remark: str = Form("", description="复核备注"),
    db: Session = Depends(get_db)
):
    if decision not in ["confirm", "dismiss"]:
        raise HTTPException(status_code=400, detail="decision 必须是 confirm 或 dismiss")
    
    try:
        ids = [int(id.strip()) for id in alert_ids.split(",") if id.strip()]
        success_count = 0
        failed_ids = []
        
        for alert_id in ids:
            try:
                RiskService.review_alert(db, alert_id, reviewer, decision, remark)
                success_count += 1
            except ValueError:
                failed_ids.append(alert_id)
        
        return {
            "success": True,
            "message": f"批量复核完成: 成功 {success_count} 条, 失败 {len(failed_ids)} 条",
            "data": {
                "success_count": success_count,
                "failed_count": len(failed_ids),
                "failed_ids": failed_ids
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"批量复核失败: {str(e)}")


@router.post("/verify-bundle/{bundle_no}", summary="复核扎把状态")
async def verify_bundle(
    bundle_no: str,
    business_date: str = Form(..., description="营业日期"),
    status: str = Form(..., description="状态: verified(通过)/rejected(驳回)"),
    reviewer: str = Form(..., description="复核人"),
    db: Session = Depends(get_db)
):
    if status not in ["verified", "rejected"]:
        raise HTTPException(status_code=400, detail="status 必须是 verified 或 rejected")
    
    bundle = db.query(Bundle).filter(
        Bundle.bundle_no == bundle_no,
        Bundle.business_date == business_date
    ).first()
    
    if not bundle:
        raise HTTPException(status_code=404, detail=f"未找到扎把编号: {bundle_no}")
    
    bundle.status = status
    bundle.updated_at = datetime.utcnow()
    
    audit = AuditLog(
        operation_type="verify_bundle",
        operator=reviewer,
        business_date=business_date,
        details=f"复核扎把 {bundle_no}, 状态: {status}"
    )
    db.add(audit)
    db.commit()
    
    return {
        "success": True,
        "message": f"扎把 {bundle_no} 状态已更新为 {status}",
        "data": {
            "bundle_no": bundle_no,
            "status": status,
            "reviewer": reviewer
        }
    }


@router.get("/export/handover", summary="导出Markdown交接单")
async def export_handover(
    business_date: str = Query(..., description="营业日期"),
    download: bool = Query(False, description="是否直接下载文件"),
    db: Session = Depends(get_db)
):
    try:
        content = ExportService.generate_handover_report(db, business_date)
        
        if download:
            filepath = ExportService.save_handover_report(db, business_date)
            filename = os.path.basename(filepath)
            return FileResponse(
                path=filepath,
                media_type="text/markdown",
                filename=filename
            )
        
        return {
            "success": True,
            "message": "交接单生成成功",
            "data": {
                "business_date": business_date,
                "content": content
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出交接单失败: {str(e)}")


@router.get("/export/audit", summary="导出JSON审计明细")
async def export_audit(
    business_date: str = Query(..., description="营业日期"),
    download: bool = Query(False, description="是否直接下载文件"),
    db: Session = Depends(get_db)
):
    try:
        content = ExportService.generate_audit_json(db, business_date)
        
        if download:
            filepath = ExportService.save_audit_json(db, business_date)
            filename = os.path.basename(filepath)
            return FileResponse(
                path=filepath,
                media_type="application/json",
                filename=filename
            )
        
        return {
            "success": True,
            "message": "审计明细生成成功",
            "data": {
                "business_date": business_date,
                "content": content
            }
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"导出审计明细失败: {str(e)}")


@router.get("/export/list", summary="查询已导出文件列表")
async def list_export_files(
    business_date: Optional[str] = Query(None, description="营业日期过滤"),
    db: Session = Depends(get_db)
):
    try:
        if not os.path.exists(EXPORT_DIR):
            return {
                "success": True,
                "count": 0,
                "data": []
            }
        
        files = []
        for filename in os.listdir(EXPORT_DIR):
            if business_date and business_date not in filename:
                continue
            
            filepath = os.path.join(EXPORT_DIR, filename)
            if os.path.isfile(filepath):
                stat = os.stat(filepath)
                file_type = "handover" if "handover" in filename else "audit" if "audit" in filename else "other"
                files.append({
                    "filename": filename,
                    "file_type": file_type,
                    "size_bytes": stat.st_size,
                    "created_at": datetime.fromtimestamp(stat.st_ctime).isoformat()
                })
        
        files.sort(key=lambda x: x["created_at"], reverse=True)
        
        return {
            "success": True,
            "count": len(files),
            "data": files
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"查询导出文件失败: {str(e)}")


@router.get("/export/download/{filename}", summary="下载导出文件")
async def download_export_file(
    filename: str,
    db: Session = Depends(get_db)
):
    filepath = os.path.join(EXPORT_DIR, filename)
    
    if not os.path.exists(filepath) or not os.path.isfile(filepath):
        raise HTTPException(status_code=404, detail=f"文件不存在: {filename}")
    
    if filename.endswith(".md"):
        media_type = "text/markdown"
    elif filename.endswith(".json"):
        media_type = "application/json"
    else:
        media_type = "application/octet-stream"
    
    return FileResponse(
        path=filepath,
        media_type=media_type,
        filename=filename
    )
