import csv
import io
import json
from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from app import models, schemas
from app.models import RiskLevel


def export_markdown_notification(
    db: Session, plan: models.RouteChangePlan
) -> str:
    lines = []
    
    lines.append("# 临时改线通知单")
    lines.append("")
    lines.append(f"**方案编号**: {plan.plan_no}")
    lines.append(f"**标题**: {plan.title}")
    lines.append(f"**生效日期**: {plan.effective_date}")
    lines.append(f"**当前状态**: {plan.status.value if hasattr(plan.status, 'value') else plan.status}")
    lines.append("")
    
    lines.append("## 改线原因")
    lines.append("")
    lines.append(f"**原因分类**: {plan.reason_category}")
    lines.append("")
    lines.append(plan.reason)
    lines.append("")
    
    lines.append("## 车辆分配详情")
    lines.append("")
    
    for idx, va in enumerate(plan.vehicle_assignments, 1):
        lines.append(f"### 车次 {idx}: {va.trip_direction}")
        lines.append("")
        
        if va.vehicle:
            lines.append(f"- **车辆**: {va.vehicle.vehicle_no} ({va.vehicle.plate_number})")
            lines.append(f"- **座位数**: {va.vehicle.capacity}")
        if va.driver:
            lines.append(f"- **司机**: {va.driver.name}")
            lines.append(f"- **司机电话**: {va.driver.phone or '未提供'}")
        if va.attendant_teacher:
            lines.append(f"- **随车老师**: {va.attendant_teacher}")
            lines.append(f"- **随车老师电话**: {va.attendant_teacher_phone or '未提供'}")
        lines.append("")
        
        lines.append("#### 站点顺序")
        lines.append("")
        lines.append("| 序号 | 站点名称 | 预计到达时间 | 备注 |")
        lines.append("|------|----------|--------------|------|")
        
        for stop in sorted(va.stop_assignments, key=lambda x: x.sequence):
            stop_name = stop.stop.name if stop.stop else "未知站点"
            arr_time = stop.estimated_arrival_time.strftime("%H:%M") if stop.estimated_arrival_time else "-"
            remarks = []
            if stop.is_added:
                remarks.append("新增站点")
            if stop.is_removed:
                remarks.append("取消站点")
            if stop.remarks:
                remarks.append(stop.remarks)
            remarks_str = "; ".join(remarks) if remarks else "-"
            lines.append(f"| {stop.sequence} | {stop_name} | {arr_time} | {remarks_str} |")
        lines.append("")
        
        student_count = len(va.student_assignments)
        lines.append(f"#### 学生名单 ({student_count} 人)")
        lines.append("")
        lines.append("| 学号 | 姓名 | 年级 | 接送人 | 交接记录 |")
        lines.append("|------|------|------|--------|----------|")
        
        for sa in va.student_assignments:
            student = sa.student
            if not student:
                continue
            guardian = sa.authorized_guardian_name or "-"
            handover = "已确认" if sa.has_handover_record else "未确认"
            if sa.needs_handover_record:
                handover += " (需交接)"
            lines.append(f"| {student.student_no} | {student.name} | {student.grade} | {guardian} | {handover} |")
        lines.append("")
    
    risk_reports = db.query(models.RiskReport).filter(
        models.RiskReport.plan_id == plan.id
    ).all()
    
    if risk_reports:
        lines.append("## 风险提示")
        lines.append("")
        
        critical_risks = [r for r in risk_reports if r.risk_level == RiskLevel.CRITICAL]
        high_risks = [r for r in risk_reports if r.risk_level == RiskLevel.HIGH]
        medium_risks = [r for r in risk_reports if r.risk_level == RiskLevel.MEDIUM]
        
        if critical_risks:
            lines.append("### ⚠️ 严重风险")
            lines.append("")
            for r in critical_risks:
                lines.append(f"**{r.title}**")
                lines.append("")
                lines.append(r.description)
                lines.append("")
                if r.suggestion:
                    lines.append(f"> 建议: {r.suggestion}")
                lines.append("")
        
        if high_risks:
            lines.append("### ⚠️ 高风险")
            lines.append("")
            for r in high_risks:
                lines.append(f"**{r.title}**")
                lines.append("")
                lines.append(r.description)
                lines.append("")
                if r.suggestion:
                    lines.append(f"> 建议: {r.suggestion}")
                lines.append("")
        
        if medium_risks:
            lines.append("### 📋 中等风险")
            lines.append("")
            for r in medium_risks:
                lines.append(f"**{r.title}**")
                lines.append("")
                lines.append(r.description)
                lines.append("")
                if r.suggestion:
                    lines.append(f"> 建议: {r.suggestion}")
                lines.append("")
    
    lines.append("---")
    lines.append("")
    lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    return "\n".join(lines)


def export_csv_risk_list(
    db: Session, plan: models.RouteChangePlan
) -> str:
    output = io.StringIO()
    writer = csv.writer(output)
    
    writer.writerow([
        "风险等级",
        "检查类型",
        "标题",
        "描述",
        "影响实体",
        "建议",
    ])
    
    risk_reports = db.query(models.RiskReport).filter(
        models.RiskReport.plan_id == plan.id
    ).order_by(
        models.RiskReport.risk_level.desc(),
        models.RiskReport.created_at
    ).all()
    
    level_order = {
        RiskLevel.CRITICAL: 4,
        RiskLevel.HIGH: 3,
        RiskLevel.MEDIUM: 2,
        RiskLevel.LOW: 1,
    }
    risk_reports.sort(key=lambda r: level_order.get(r.risk_level, 0), reverse=True)
    
    level_names = {
        RiskLevel.CRITICAL: "严重",
        RiskLevel.HIGH: "高",
        RiskLevel.MEDIUM: "中等",
        RiskLevel.LOW: "低",
    }
    
    for r in risk_reports:
        writer.writerow([
            level_names.get(r.risk_level, r.risk_level),
            r.check_type,
            r.title,
            r.description,
            r.affected_entities or "",
            r.suggestion or "",
        ])
    
    return output.getvalue()


def export_json_audit_package(
    db: Session, plan: models.RouteChangePlan
) -> str:
    audit_logs = db.query(models.AuditLog).filter(
        models.AuditLog.plan_id == plan.id
    ).order_by(models.AuditLog.created_at).all()
    
    risk_reports = db.query(models.RiskReport).filter(
        models.RiskReport.plan_id == plan.id
    ).all()
    
    vehicle_assignments = []
    for va in plan.vehicle_assignments:
        va_dict = {
            "sequence": va.sequence,
            "trip_direction": va.trip_direction,
            "attendant_teacher": va.attendant_teacher,
            "attendant_teacher_phone": va.attendant_teacher_phone,
            "vehicle": None,
            "driver": None,
            "stops": [],
            "students": [],
        }
        
        if va.vehicle:
            va_dict["vehicle"] = {
                "id": va.vehicle.id,
                "vehicle_no": va.vehicle.vehicle_no,
                "plate_number": va.vehicle.plate_number,
                "capacity": va.vehicle.capacity,
                "vehicle_type": va.vehicle.vehicle_type,
            }
        
        if va.driver:
            va_dict["driver"] = {
                "id": va.driver.id,
                "driver_no": va.driver.driver_no,
                "name": va.driver.name,
                "phone": va.driver.phone,
                "license_type": va.driver.license_type,
                "license_expiry_date": str(va.driver.license_expiry_date) if va.driver.license_expiry_date else None,
            }
        
        for stop in sorted(va.stop_assignments, key=lambda x: x.sequence):
            stop_dict = {
                "sequence": stop.sequence,
                "stop_name": stop.stop.name if stop.stop else None,
                "stop_code": stop.stop.stop_code if stop.stop else None,
                "estimated_arrival_time": str(stop.estimated_arrival_time) if stop.estimated_arrival_time else None,
                "is_added": stop.is_added,
                "is_removed": stop.is_removed,
                "remarks": stop.remarks,
            }
            va_dict["stops"].append(stop_dict)
        
        for sa in va.student_assignments:
            student_dict = {
                "student_no": sa.student.student_no if sa.student else None,
                "student_name": sa.student.name if sa.student else None,
                "grade": sa.student.grade if sa.student else None,
                "is_young_grade": sa.student.is_young_grade if sa.student else None,
                "needs_special_care": sa.student.needs_special_care if sa.student else None,
                "authorized_guardian_name": sa.authorized_guardian_name,
                "needs_handover_record": sa.needs_handover_record,
                "has_handover_record": sa.has_handover_record,
            }
            va_dict["students"].append(student_dict)
        
        vehicle_assignments.append(va_dict)
    
    risks_data = []
    for r in risk_reports:
        risks_data.append({
            "risk_level": r.risk_level.value if hasattr(r.risk_level, 'value') else r.risk_level,
            "check_type": r.check_type,
            "title": r.title,
            "description": r.description,
            "affected_entities": r.affected_entities,
            "suggestion": r.suggestion,
            "created_at": r.created_at.isoformat() if r.created_at else None,
        })
    
    audit_data = []
    for log in audit_logs:
        audit_data.append({
            "action": log.action,
            "actor": log.actor,
            "details": log.details,
            "created_at": log.created_at.isoformat() if log.created_at else None,
        })
    
    package = {
        "audit_package_version": "1.0",
        "exported_at": datetime.now().isoformat(),
        "plan": {
            "id": plan.id,
            "plan_no": plan.plan_no,
            "title": plan.title,
            "reason": plan.reason,
            "reason_category": plan.reason_category,
            "effective_date": str(plan.effective_date) if plan.effective_date else None,
            "status": plan.status.value if hasattr(plan.status, 'value') else plan.status,
            "created_by": plan.created_by,
            "submitted_by": plan.submitted_by,
            "approved_by": plan.approved_by,
            "published_by": plan.published_by,
            "withdrawn_by": plan.withdrawn_by,
            "created_at": plan.created_at.isoformat() if plan.created_at else None,
            "submitted_at": plan.submitted_at.isoformat() if plan.submitted_at else None,
            "approved_at": plan.approved_at.isoformat() if plan.approved_at else None,
            "published_at": plan.published_at.isoformat() if plan.published_at else None,
            "withdrawn_at": plan.withdrawn_at.isoformat() if plan.withdrawn_at else None,
        },
        "vehicle_assignments": vehicle_assignments,
        "risk_reports": risks_data,
        "audit_logs": audit_data,
    }
    
    return json.dumps(package, ensure_ascii=False, indent=2)
