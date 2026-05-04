from datetime import datetime, date, timedelta
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from app.database import (
    Appointment, Cylinder, FillRecord, Risk, 
    ReviewRecord, CompressorMaintenance, Batch
)
import json
import os


class ExportService:
    def __init__(self, db: Session):
        self.db = db
    
    def _get_date_range(self, target_date: Optional[date] = None) -> tuple:
        if not target_date:
            target_date = date.today()
        
        start_of_day = datetime.combine(target_date, datetime.min.time())
        end_of_day = datetime.combine(target_date, datetime.max.time())
        
        return start_of_day, end_of_day
    
    def generate_markdown_pickup_list(self, target_date: Optional[date] = None) -> str:
        start, end = self._get_date_range(target_date)
        target_date_str = (target_date or date.today()).strftime("%Y年%m月%d日")
        
        appointments = self.db.query(Appointment).filter(
            Appointment.pickup_date >= start,
            Appointment.pickup_date <= end,
            Appointment.status.in_(["pending", "confirmed", "rescheduled"])
        ).order_by(Appointment.pickup_date).all()
        
        risk_engine = __import__('app.risk_engine', fromlist=['RiskEngine'])
        risk_engine_cls = risk_engine.RiskEngine
        risk_engine_instance = risk_engine_cls(self.db)
        active_risks = risk_engine_instance.get_active_risks()
        
        cylinder_risks = {}
        for risk in active_risks:
            if "serial_number" in risk:
                if risk["serial_number"] not in cylinder_risks:
                    cylinder_risks[risk["serial_number"]] = []
                cylinder_risks[risk["serial_number"]].append(risk)
        
        markdown_parts = []
        
        markdown_parts.append(f"# 当日取瓶清单 - {target_date_str}")
        markdown_parts.append(f"\n生成时间: {datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S')} UTC")
        markdown_parts.append(f"\n\n---")
        
        if not appointments:
            markdown_parts.append("\n## 当日无取瓶预约")
            return "\n".join(markdown_parts)
        
        confirmed = [a for a in appointments if a.status == "confirmed"]
        pending = [a for a in appointments if a.status == "pending"]
        rescheduled = [a for a in appointments if a.status == "rescheduled"]
        
        if confirmed:
            markdown_parts.append("\n## 已确认取瓶")
            markdown_parts.append("\n| 预约单号 | 气瓶序列号 | 客户姓名 | 取瓶时间 | 状态 |")
            markdown_parts.append("|----------|------------|----------|----------|------|")
            for appt in confirmed:
                cylinder = self.db.query(Cylinder).filter(Cylinder.id == appt.cylinder_id).first()
                serial = cylinder.serial_number if cylinder else "N/A"
                risks = cylinder_risks.get(serial, [])
                risk_indicator = " ⚠️" if risks else ""
                markdown_parts.append(
                    f"| {appt.appointment_number} | {serial} | {appt.customer_name} | "
                    f"{appt.pickup_date.strftime('%H:%M')} | ✅ 已确认{risk_indicator} |"
                )
        
        if pending:
            markdown_parts.append("\n## 待确认取瓶")
            markdown_parts.append("\n| 预约单号 | 气瓶序列号 | 客户姓名 | 取瓶时间 | 状态 |")
            markdown_parts.append("|----------|------------|----------|----------|------|")
            for appt in pending:
                cylinder = self.db.query(Cylinder).filter(Cylinder.id == appt.cylinder_id).first()
                serial = cylinder.serial_number if cylinder else "N/A"
                risks = cylinder_risks.get(serial, [])
                risk_indicator = " ⚠️" if risks else ""
                markdown_parts.append(
                    f"| {appt.appointment_number} | {serial} | {appt.customer_name} | "
                    f"{appt.pickup_date.strftime('%H:%M')} | ⏳ 待确认{risk_indicator} |"
                )
        
        if rescheduled:
            markdown_parts.append("\n## 已改期取瓶")
            markdown_parts.append("\n| 预约单号 | 气瓶序列号 | 客户姓名 | 新取瓶时间 | 状态 |")
            markdown_parts.append("|----------|------------|----------|------------|------|")
            for appt in rescheduled:
                cylinder = self.db.query(Cylinder).filter(Cylinder.id == appt.cylinder_id).first()
                serial = cylinder.serial_number if cylinder else "N/A"
                markdown_parts.append(
                    f"| {appt.appointment_number} | {serial} | {appt.customer_name} | "
                    f"{appt.pickup_date.strftime('%Y-%m-%d %H:%M')} | 🔄 已改期 |"
                )
        
        risks_for_today = []
        for risk in active_risks:
            if "appointment_number" in risk:
                appt = self.db.query(Appointment).filter(
                    Appointment.appointment_number == risk["appointment_number"]
                ).first()
                if appt and start <= appt.pickup_date <= end:
                    risks_for_today.append(risk)
            elif "serial_number" in risk:
                for appt in appointments:
                    cylinder = self.db.query(Cylinder).filter(Cylinder.id == appt.cylinder_id).first()
                    if cylinder and cylinder.serial_number == risk["serial_number"]:
                        risks_for_today.append(risk)
                        break
        
        if risks_for_today:
            markdown_parts.append("\n---")
            markdown_parts.append("\n## ⚠️ 风险提醒")
            
            by_severity = {}
            for risk in risks_for_today:
                sev = risk.get("severity", "medium")
                if sev not in by_severity:
                    by_severity[sev] = []
                by_severity[sev].append(risk)
            
            for severity in ["high", "medium", "low"]:
                if severity in by_severity:
                    sev_name = {"high": "🔴 高风险", "medium": "🟡 中风险", "low": "🟢 低风险"}[severity]
                    markdown_parts.append(f"\n### {sev_name}")
                    for risk in by_severity[severity]:
                        markdown_parts.append(f"- **{risk.get('type_name', risk.get('type'))}**: {risk.get('description', '')}")
                        if "serial_number" in risk:
                            markdown_parts.append(f"  - 气瓶: {risk['serial_number']}")
                        if "appointment_number" in risk:
                            markdown_parts.append(f"  - 预约: {risk['appointment_number']}")
        
        markdown_parts.append("\n---")
        markdown_parts.append(f"\n*此清单由潜水气瓶充填站管理系统自动生成*")
        
        return "\n".join(markdown_parts)
    
    def generate_audit_package(
        self,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> Dict[str, Any]:
        if not start_date:
            start_date = date.today() - timedelta(days=30)
        if not end_date:
            end_date = date.today()
        
        start_dt = datetime.combine(start_date, datetime.min.time())
        end_dt = datetime.combine(end_date, datetime.max.time())
        
        audit_package = {
            "package_info": {
                "generated_at": datetime.utcnow().isoformat(),
                "period_start": start_date.isoformat(),
                "period_end": end_date.isoformat()
            },
            "batches": [],
            "cylinders": [],
            "fill_records": [],
            "appointments": [],
            "risks": [],
            "reviews": [],
            "compressor_maintenance": [],
            "summary": {}
        }
        
        batches = self.db.query(Batch).filter(
            Batch.fill_date >= start_dt,
            Batch.fill_date <= end_dt
        ).all()
        audit_package["batches"] = [
            {
                "id": b.id,
                "batch_number": b.batch_number,
                "compressor_id": b.compressor_id,
                "fill_date": b.fill_date.isoformat() if b.fill_date else None,
                "operator_name": b.operator_name
            }
            for b in batches
        ]
        
        cylinders = self.db.query(Cylinder).all()
        audit_package["cylinders"] = [
            {
                "id": c.id,
                "serial_number": c.serial_number,
                "cylinder_type": c.cylinder_type,
                "capacity_liters": c.capacity_liters,
                "working_pressure_bar": c.working_pressure_bar,
                "test_expiry_date": c.test_expiry_date.isoformat() if c.test_expiry_date else None,
                "last_test_date": c.last_test_date.isoformat() if c.last_test_date else None,
                "owner_name": c.owner_name
            }
            for c in cylinders
        ]
        
        fill_records = self.db.query(FillRecord).filter(
            FillRecord.fill_date >= start_dt,
            FillRecord.fill_date <= end_dt
        ).all()
        audit_package["fill_records"] = []
        for fr in fill_records:
            cylinder = self.db.query(Cylinder).filter(Cylinder.id == fr.cylinder_id).first()
            audit_package["fill_records"].append({
                "id": fr.id,
                "cylinder_serial": cylinder.serial_number if cylinder else None,
                "fill_date": fr.fill_date.isoformat() if fr.fill_date else None,
                "fill_pressure_bar": fr.fill_pressure_bar,
                "target_pressure_bar": fr.target_pressure_bar,
                "compressor_id": fr.compressor_id,
                "operator_name": fr.operator_name,
                "cooling_start_time": fr.cooling_start_time.isoformat() if fr.cooling_start_time else None
            })
        
        appointments = self.db.query(Appointment).filter(
            Appointment.pickup_date >= start_dt,
            Appointment.pickup_date <= end_dt
        ).all()
        audit_package["appointments"] = []
        for appt in appointments:
            cylinder = self.db.query(Cylinder).filter(Cylinder.id == appt.cylinder_id).first()
            audit_package["appointments"].append({
                "id": appt.id,
                "appointment_number": appt.appointment_number,
                "cylinder_serial": cylinder.serial_number if cylinder else None,
                "customer_name": appt.customer_name,
                "customer_contact": appt.customer_contact,
                "pickup_date": appt.pickup_date.isoformat() if appt.pickup_date else None,
                "status": appt.status,
                "notes": appt.notes
            })
        
        risks = self.db.query(Risk).filter(
            Risk.detected_at >= start_dt,
            Risk.detected_at <= end_dt
        ).all()
        audit_package["risks"] = []
        for risk in risks:
            item = {
                "id": risk.id,
                "risk_type": risk.risk_type,
                "severity": risk.severity,
                "description": risk.description,
                "detected_at": risk.detected_at.isoformat() if risk.detected_at else None,
                "is_resolved": risk.is_resolved,
                "resolved_at": risk.resolved_at.isoformat() if risk.resolved_at else None,
                "resolved_by": risk.resolved_by
            }
            if risk.cylinder_id:
                cylinder = self.db.query(Cylinder).filter(Cylinder.id == risk.cylinder_id).first()
                if cylinder:
                    item["serial_number"] = cylinder.serial_number
            if risk.appointment_id:
                appt = self.db.query(Appointment).filter(Appointment.id == risk.appointment_id).first()
                if appt:
                    item["appointment_number"] = appt.appointment_number
            if risk.compressor_id:
                item["compressor_id"] = risk.compressor_id
            audit_package["risks"].append(item)
        
        reviews = self.db.query(ReviewRecord).filter(
            ReviewRecord.created_at >= start_dt,
            ReviewRecord.created_at <= end_dt
        ).all()
        audit_package["reviews"] = []
        for rev in reviews:
            item = {
                "id": rev.id,
                "review_number": rev.review_number,
                "review_type": rev.review_type,
                "reviewer_name": rev.reviewer_name,
                "review_date": rev.review_date.isoformat() if rev.review_date else None,
                "status": rev.status,
                "notes": rev.notes,
                "rescheduled_to": rev.rescheduled_to.isoformat() if rev.rescheduled_to else None
            }
            if rev.cylinder_id:
                cylinder = self.db.query(Cylinder).filter(Cylinder.id == rev.cylinder_id).first()
                if cylinder:
                    item["serial_number"] = cylinder.serial_number
            if rev.appointment_id:
                appt = self.db.query(Appointment).filter(Appointment.id == rev.appointment_id).first()
                if appt:
                    item["appointment_number"] = appt.appointment_number
            audit_package["reviews"].append(item)
        
        compressors = self.db.query(CompressorMaintenance).all()
        audit_package["compressor_maintenance"] = [
            {
                "id": cm.id,
                "compressor_id": cm.compressor_id,
                "model": cm.model,
                "last_maintenance_date": cm.last_maintenance_date.isoformat() if cm.last_maintenance_date else None,
                "filter_change_date": cm.filter_change_date.isoformat() if cm.filter_change_date else None,
                "filter_expiry_date": cm.filter_expiry_date.isoformat() if cm.filter_expiry_date else None,
                "next_service_date": cm.next_service_date.isoformat() if cm.next_service_date else None,
                "operating_hours": cm.operating_hours,
                "notes": cm.notes
            }
            for cm in compressors
        ]
        
        audit_package["summary"] = {
            "total_batches": len(audit_package["batches"]),
            "total_cylinders": len(audit_package["cylinders"]),
            "total_fill_records": len(audit_package["fill_records"]),
            "total_appointments": len(audit_package["appointments"]),
            "total_risks": len(audit_package["risks"]),
            "resolved_risks": sum(1 for r in audit_package["risks"] if r["is_resolved"]),
            "unresolved_risks": sum(1 for r in audit_package["risks"] if not r["is_resolved"]),
            "total_reviews": len(audit_package["reviews"]),
            "compressors_count": len(audit_package["compressor_maintenance"])
        }
        
        return audit_package
    
    def save_markdown_to_file(self, filepath: str, target_date: Optional[date] = None) -> str:
        markdown_content = self.generate_markdown_pickup_list(target_date)
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(markdown_content)
        return filepath
    
    def save_audit_package_to_file(
        self,
        filepath: str,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None
    ) -> str:
        audit_package = self.generate_audit_package(start_date, end_date)
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(audit_package, f, ensure_ascii=False, indent=2)
        return filepath
