from fastapi import APIRouter, Depends, HTTPException, Body, Query
from fastapi.responses import PlainTextResponse, JSONResponse
from sqlalchemy.orm import Session
from typing import Optional, List
from datetime import datetime
import json

from app.db.database import get_db
from app.schemas.schemas import ApiResponse
from app.models.models import PatientStatus
from app.services.export_service import ExportService
from app.services.status_service import StatusJudgmentService

router = APIRouter()

@router.get("/markdown/{handoff_id}")
async def export_markdown(
    handoff_id: str,
    db: Session = Depends(get_db)
):
    service = ExportService(db)
    markdown = service.generate_markdown_handoff(handoff_id)
    
    if not markdown:
        raise HTTPException(status_code=404, detail=f"交接记录 {handoff_id} 不存在")
    
    return PlainTextResponse(
        content=markdown,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f"attachment; filename=handoff_{handoff_id}.md"
        }
    )

@router.get("/audit/{handoff_id}")
async def export_audit(
    handoff_id: str,
    db: Session = Depends(get_db)
):
    service = ExportService(db)
    package = service.generate_audit_package(handoff_id)
    
    if not package:
        raise HTTPException(status_code=404, detail=f"交接记录 {handoff_id} 不存在")
    
    return JSONResponse(
        content=package,
        headers={
            "Content-Disposition": f"attachment; filename=audit_{handoff_id}.json"
        }
    )

@router.post("/batch/audit", response_model=ApiResponse)
async def export_batch_audit(
    handoff_ids: List[str] = Body(..., embed=True, description="交接记录ID列表"),
    db: Session = Depends(get_db)
):
    service = ExportService(db)
    result = service.export_batch_audit(handoff_ids)
    
    return ApiResponse(
        success=result["failed_count"] == 0,
        message=f"批量导出完成: 成功 {result['success_count']} 条, 失败 {result['failed_count']} 条",
        data=result
    )

@router.get("/shift-report")
async def export_shift_report(
    shift_date: Optional[str] = Query(None, description="交接日期 YYYY-MM-DD"),
    status: Optional[PatientStatus] = Query(None, description="状态筛选"),
    db: Session = Depends(get_db)
):
    status_service = StatusJudgmentService(db)
    export_service = ExportService(db)
    
    if shift_date:
        try:
            shift_dt = datetime.strptime(shift_date, "%Y-%m-%d")
            start_dt = shift_dt
            end_dt = shift_dt.replace(hour=23, minute=59, second=59)
        except ValueError:
            raise HTTPException(status_code=400, detail="日期格式错误, 请使用 YYYY-MM-DD")
    else:
        start_dt = None
        end_dt = None
    
    handoffs = status_service.get_all_handoffs(start_dt, end_dt, status)
    
    report = {
        "report_type": "交接班汇总报告",
        "generated_at": datetime.now().isoformat(),
        "shift_date": shift_date or datetime.now().strftime("%Y-%m-%d"),
        "total_count": len(handoffs),
        "status_summary": {
            "normal_care": len([h for h in handoffs if (h.final_status or h.status) == PatientStatus.NORMAL_CARE]),
            "need_review": len([h for h in handoffs if (h.final_status or h.status) == PatientStatus.NEED_REVIEW]),
            "alert": len([h for h in handoffs if (h.final_status or h.status) == PatientStatus.ALERT])
        },
        "anomaly_summary": {
            "awakening_timeout": len([h for h in handoffs if h.has_awakening_timeout]),
            "infusion_interruption": len([h for h in handoffs if h.has_infusion_interruption]),
            "temp_oxygen_abnormal": len([h for h in handoffs if h.has_temp_oxygen_abnormal]),
            "medication_conflict": len([h for h in handoffs if h.has_medication_conflict])
        },
        "handoff_records": [
            {
                "handoff_id": h.handoff_id,
                "patient_id": h.patient_id,
                "patient_name": h.patient_name,
                "species": h.species,
                "status": (h.final_status or h.status).value if (h.final_status or h.status) else None,
                "is_reviewed": h.is_reviewed,
                "nurse_name": h.nurse_name,
                "has_awakening_timeout": h.has_awakening_timeout,
                "has_infusion_interruption": h.has_infusion_interruption,
                "has_temp_oxygen_abnormal": h.has_temp_oxygen_abnormal,
                "has_medication_conflict": h.has_medication_conflict,
                "created_at": h.created_at.isoformat() if h.created_at else None
            }
            for h in handoffs
        ]
    }
    
    return JSONResponse(
        content=report,
        headers={
            "Content-Disposition": f"attachment; filename=shift_report_{datetime.now().strftime('%Y%m%d')}.json"
        }
    )

@router.get("/shift-report/markdown")
async def export_shift_report_markdown(
    shift_date: Optional[str] = Query(None, description="交接日期 YYYY-MM-DD"),
    status: Optional[PatientStatus] = Query(None, description="状态筛选"),
    db: Session = Depends(get_db)
):
    status_service = StatusJudgmentService(db)
    
    if shift_date:
        try:
            shift_dt = datetime.strptime(shift_date, "%Y-%m-%d")
            start_dt = shift_dt
            end_dt = shift_dt.replace(hour=23, minute=59, second=59)
        except ValueError:
            raise HTTPException(status_code=400, detail="日期格式错误, 请使用 YYYY-MM-DD")
    else:
        start_dt = None
        end_dt = None
        shift_dt = datetime.now()
    
    handoffs = status_service.get_all_handoffs(start_dt, end_dt, status)
    
    normal_count = len([h for h in handoffs if (h.final_status or h.status) == PatientStatus.NORMAL_CARE])
    review_count = len([h for h in handoffs if (h.final_status or h.status) == PatientStatus.NEED_REVIEW])
    alert_count = len([h for h in handoffs if (h.final_status or h.status) == PatientStatus.ALERT])
    
    md_lines = []
    
    md_lines.append(f"# 交接班汇总报告\n")
    md_lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}  \n")
    md_lines.append(f"**报告日期**: {shift_dt.strftime('%Y-%m-%d')}  \n")
    md_lines.append(f"\n---\n")
    
    md_lines.append(f"## 状态统计\n")
    md_lines.append(f"| 状态 | 数量 |")
    md_lines.append(f"|------|------|")
    md_lines.append(f"| 🟢 转普通护理 | {normal_count} |")
    md_lines.append(f"| 🟡 需要复查 | {review_count} |")
    md_lines.append(f"| 🔴 必须报警 | {alert_count} |")
    md_lines.append(f"| **总计** | **{len(handoffs)}** |")
    md_lines.append(f"\n")
    
    md_lines.append(f"## 异常统计\n")
    awakening = len([h for h in handoffs if h.has_awakening_timeout])
    infusion = len([h for h in handoffs if h.has_infusion_interruption])
    temp_oxy = len([h for h in handoffs if h.has_temp_oxygen_abnormal])
    medication = len([h for h in handoffs if h.has_medication_conflict])
    
    md_lines.append(f"- ⏰ 苏醒超时: {awakening} 例")
    md_lines.append(f"- 💉 输液中断: {infusion} 例")
    md_lines.append(f"- 🌡️ 温氧异常: {temp_oxy} 例")
    md_lines.append(f"- 💊 用药冲突: {medication} 例")
    md_lines.append(f"\n")
    
    if alert_count > 0:
        md_lines.append(f"## ⚠️ 必须报警病例\n")
        alert_handoffs = [h for h in handoffs if (h.final_status or h.status) == PatientStatus.ALERT]
        for h in alert_handoffs:
            md_lines.append(f"### {h.patient_name or h.patient_id} (ID: {h.patient_id})\n")
            md_lines.append(f"- 交接编号: {h.handoff_id}")
            md_lines.append(f"- 护士: {h.nurse_name or '未记录'}")
            anomalies = []
            if h.has_awakening_timeout:
                anomalies.append("苏醒超时")
            if h.has_infusion_interruption:
                anomalies.append("输液中断")
            if h.has_temp_oxygen_abnormal:
                anomalies.append("温氧异常")
            if h.has_medication_conflict:
                anomalies.append("用药冲突")
            md_lines.append(f"- 异常: {', '.join(anomalies) if anomalies else '无'}")
            if h.abnormal_details:
                md_lines.append(f"\n  详情: {h.abnormal_details}")
            md_lines.append(f"\n")
    
    if review_count > 0:
        md_lines.append(f"## 📋 需要复查病例\n")
        review_handoffs = [h for h in handoffs if (h.final_status or h.status) == PatientStatus.NEED_REVIEW]
        for h in review_handoffs:
            md_lines.append(f"- {h.patient_name or h.patient_id} (ID: {h.patient_id}) - {h.handoff_id}")
    
    md_lines.append(f"\n---\n")
    md_lines.append(f"*报告由系统自动生成*")
    
    markdown = "\n".join(md_lines)
    
    return PlainTextResponse(
        content=markdown,
        media_type="text/markdown",
        headers={
            "Content-Disposition": f"attachment; filename=shift_report_{datetime.now().strftime('%Y%m%d')}.md"
        }
    )
