from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import and_
from .models import (
    Cabin, CabinInspection, WireRope, WireRopeInspection,
    WindSpeedRecord, Gripper, GripperLubrication, ReservationPeak,
    Shift, RiskAssessment, ReviewNote
)


class QueryService:
    def __init__(self, db: Session):
        self.db = db
    
    def query_by_date(self, query_date: datetime) -> Dict[str, Any]:
        start_of_day = datetime(query_date.year, query_date.month, query_date.day)
        end_of_day = start_of_day + timedelta(days=1)
        
        cabin_inspections = self.db.query(CabinInspection).filter(
            and_(
                CabinInspection.inspection_date >= start_of_day,
                CabinInspection.inspection_date < end_of_day
            )
        ).all()
        
        wire_rope_inspections = self.db.query(WireRopeInspection).filter(
            and_(
                WireRopeInspection.inspection_date >= start_of_day,
                WireRopeInspection.inspection_date < end_of_day
            )
        ).all()
        
        wind_records = self.db.query(WindSpeedRecord).filter(
            and_(
                WindSpeedRecord.record_date >= start_of_day,
                WindSpeedRecord.record_date < end_of_day
            )
        ).all()
        
        lubrications = self.db.query(GripperLubrication).filter(
            and_(
                GripperLubrication.record_date >= start_of_day,
                GripperLubrication.record_date < end_of_day
            )
        ).all()
        
        reservations = self.db.query(ReservationPeak).filter(
            and_(
                ReservationPeak.record_date >= start_of_day,
                ReservationPeak.record_date < end_of_day
            )
        ).all()
        
        shifts = self.db.query(Shift).filter(
            and_(
                Shift.shift_date >= start_of_day,
                Shift.shift_date < end_of_day
            )
        ).all()
        
        risks = self.db.query(RiskAssessment).filter(
            and_(
                RiskAssessment.assessment_date >= start_of_day,
                RiskAssessment.assessment_date < end_of_day
            )
        ).all()
        
        return {
            "date": query_date.strftime("%Y-%m-%d"),
            "cabin_inspections": [
                {
                    "cabin_number": ci.cabin_number,
                    "inspector": ci.inspector,
                    "condition": ci.condition,
                    "issues": ci.issues,
                    "status": ci.status
                }
                for ci in cabin_inspections
            ],
            "wire_rope_inspections": [
                {
                    "rope_id": wri.rope_id,
                    "broken_wires": wri.broken_wires,
                    "corrosion": wri.corrosion,
                    "wear_percentage": wri.wear_percentage,
                    "abnormal": wri.abnormal,
                    "issues": wri.issues
                }
                for wri in wire_rope_inspections
            ],
            "wind_records": [
                {
                    "time_slot": wr.time_slot,
                    "wind_speed": wr.wind_speed,
                    "direction": wr.direction
                }
                for wr in wind_records
            ],
            "lubrications": [
                {
                    "gripper_id": gl.gripper_id,
                    "cabin_number": gl.cabin_number,
                    "lubrication_date": gl.lubrication_date.strftime("%Y-%m-%d") if gl.lubrication_date else None,
                    "technician": gl.technician,
                    "status": gl.status
                }
                for gl in lubrications
            ],
            "reservations": [
                {
                    "time_slot": rp.time_slot,
                    "peak_count": rp.peak_count,
                    "estimated_arrival": rp.estimated_arrival
                }
                for rp in reservations
            ],
            "shifts": [
                {
                    "shift_name": s.shift_name,
                    "status": s.status,
                    "start_time": s.start_time.strftime("%H:%M") if s.start_time else None,
                    "end_time": s.end_time.strftime("%H:%M") if s.end_time else None
                }
                for s in shifts
            ],
            "risks": [
                {
                    "risk_type": r.risk_type,
                    "risk_level": r.risk_level,
                    "action_required": r.action_required,
                    "reason": r.reason,
                    "status": r.status
                }
                for r in risks
            ]
        }
    
    def query_by_cabin(self, cabin_number: str) -> Dict[str, Any]:
        cabin = self.db.query(Cabin).filter(Cabin.cabin_number == cabin_number).first()
        
        if not cabin:
            return {"error": f"吊厢 {cabin_number} 不存在"}
        
        inspections = self.db.query(CabinInspection).filter(
            CabinInspection.cabin_number == cabin_number
        ).order_by(CabinInspection.inspection_date.desc()).all()
        
        grippers = self.db.query(Gripper).filter(
            Gripper.cabin_number == cabin_number
        ).all()
        
        risks = self.db.query(RiskAssessment).filter(
            RiskAssessment.cabin_number == cabin_number
        ).order_by(RiskAssessment.assessment_date.desc()).all()
        
        return {
            "cabin_number": cabin.cabin_number,
            "status": cabin.status,
            "max_capacity": cabin.max_capacity,
            "recent_inspections": [
                {
                    "date": i.inspection_date.strftime("%Y-%m-%d"),
                    "inspector": i.inspector,
                    "condition": i.condition,
                    "issues": i.issues,
                    "status": i.status
                }
                for i in inspections[:10]
            ],
            "grippers": [
                {
                    "gripper_id": g.gripper_id,
                    "last_lubrication_date": g.last_lubrication_date.strftime("%Y-%m-%d") if g.last_lubrication_date else None,
                    "lubrication_interval_days": g.lubrication_interval_days
                }
                for g in grippers
            ],
            "risks": [
                {
                    "date": r.assessment_date.strftime("%Y-%m-%d"),
                    "risk_type": r.risk_type,
                    "risk_level": r.risk_level,
                    "action_required": r.action_required,
                    "reason": r.reason,
                    "status": r.status
                }
                for r in risks
            ]
        }
    
    def query_all_risks(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        query = self.db.query(RiskAssessment).order_by(RiskAssessment.assessment_date.desc())
        
        if status:
            query = query.filter(RiskAssessment.status == status)
        
        risks = query.all()
        
        return [
            {
                "id": r.id,
                "assessment_date": r.assessment_date.strftime("%Y-%m-%d"),
                "cabin_number": r.cabin_number,
                "risk_type": r.risk_type,
                "risk_level": r.risk_level,
                "action_required": r.action_required,
                "reason": r.reason,
                "status": r.status
            }
            for r in risks
        ]
    
    def add_review_note(self, risk_id: int, reviewer: str, note: str, action_taken: Optional[str] = None) -> Dict[str, Any]:
        risk = self.db.query(RiskAssessment).filter(RiskAssessment.id == risk_id).first()
        
        if not risk:
            return {"error": f"风险记录 {risk_id} 不存在"}
        
        review_note = ReviewNote(
            risk_id=risk_id,
            reviewer=reviewer,
            note=note,
            action_taken=action_taken
        )
        self.db.add(review_note)
        
        if action_taken:
            risk.status = "已处理"
        
        self.db.commit()
        
        return {
            "success": True,
            "risk_id": risk_id,
            "reviewer": reviewer,
            "note": note,
            "action_taken": action_taken
        }


class ExportService:
    def __init__(self, db: Session):
        self.db = db
    
    def export_markdown_handover(self, export_date: datetime) -> str:
        query_service = QueryService(self.db)
        data = query_service.query_by_date(export_date)
        
        date_str = export_date.strftime("%Y年%m月%d日")
        
        markdown = f"""# 景区索道运营交接单 - {date_str}

## 一、班次状态
"""
        
        if data["shifts"]:
            for shift in data["shifts"]:
                status_icon = "🟢" if shift["status"] == "正常" else "🟡" if shift["status"] == "限载" else "🔴"
                markdown += f"- **{shift['shift_name']}**: {status_icon} {shift['status']}\n"
        else:
            markdown += "- 无班次记录\n"
        
        markdown += """
## 二、风险评估
"""
        
        if data["risks"]:
            high_risks = [r for r in data["risks"] if r["risk_level"] == "高"]
            medium_risks = [r for r in data["risks"] if r["risk_level"] == "中"]
            low_risks = [r for r in data["risks"] if r["risk_level"] == "低"]
            
            if high_risks:
                markdown += "### 🔴 高风险\n"
                for r in high_risks:
                    markdown += f"- **{r['risk_type']}** ({r['action_required']}): {r['reason']}\n"
            
            if medium_risks:
                markdown += "\n### 🟡 中风险\n"
                for r in medium_risks:
                    markdown += f"- **{r['risk_type']}** ({r['action_required']}): {r['reason']}\n"
            
            if low_risks:
                markdown += "\n### 🟢 低风险\n"
                for r in low_risks:
                    markdown += f"- **{r['risk_type']}** ({r['action_required']}): {r['reason']}\n"
        else:
            markdown += "- 无风险记录\n"
        
        markdown += """
## 三、设备点检
"""
        
        if data["cabin_inspections"]:
            markdown += "### 吊厢点检\n"
            for ci in data["cabin_inspections"]:
                status_icon = "🟢" if ci["status"] == "正常" else "🔴"
                markdown += f"- 吊厢 {ci['cabin_number']}: {status_icon} {ci['status']}"
                if ci["issues"]:
                    markdown += f" - 问题: {ci['issues']}"
                markdown += "\n"
        else:
            markdown += "- 无吊厢点检记录\n"
        
        if data["wire_rope_inspections"]:
            markdown += "\n### 钢丝绳探伤\n"
            for wri in data["wire_rope_inspections"]:
                status_icon = "🟢" if wri["abnormal"] == "否" else "🔴"
                markdown += f"- 钢丝绳 {wri['rope_id']}: {status_icon} 断丝:{wri['broken_wires']} 磨损:{wri['wear_percentage']}%"
                if wri["issues"]:
                    markdown += f" - 问题: {wri['issues']}"
                markdown += "\n"
        
        markdown += """
## 四、环境数据
"""
        
        if data["wind_records"]:
            markdown += "### 风速记录\n"
            for wr in data["wind_records"]:
                status_icon = "🟢" if wr["wind_speed"] <= 12.0 else "🔴"
                markdown += f"- {wr['time_slot']}: {status_icon} {wr['wind_speed']} m/s ({wr['direction']})\n"
        else:
            markdown += "- 无风速记录\n"
        
        markdown += """
## 五、预约情况
"""
        
        if data["reservations"]:
            for rp in data["reservations"]:
                markdown += f"- {rp['time_slot']}: 峰值 {rp['peak_count']} 人"
                if rp["estimated_arrival"]:
                    markdown += f" (预计到达 {rp['estimated_arrival']})"
                markdown += "\n"
        else:
            markdown += "- 无预约记录\n"
        
        markdown += """
## 六、润滑记录
"""
        
        if data["lubrications"]:
            for gl in data["lubrications"]:
                markdown += f"- 抱索器 {gl['gripper_id']} (吊厢 {gl['cabin_number']}): {gl['status']} - {gl['technician']}\n"
        else:
            markdown += "- 无润滑记录\n"
        
        markdown += f"""
---
*生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""
        
        return markdown
    
    def export_json_audit(self, start_date: datetime, end_date: datetime) -> Dict[str, Any]:
        start_of_start = datetime(start_date.year, start_date.month, start_date.day)
        end_of_end = datetime(end_date.year, end_date.month, end_date.day) + timedelta(days=1)
        
        risks = self.db.query(RiskAssessment).filter(
            and_(
                RiskAssessment.assessment_date >= start_of_start,
                RiskAssessment.assessment_date < end_of_end
            )
        ).order_by(RiskAssessment.assessment_date).all()
        
        shifts = self.db.query(Shift).filter(
            and_(
                Shift.shift_date >= start_of_start,
                Shift.shift_date < end_of_end
            )
        ).order_by(Shift.shift_date).all()
        
        review_notes = self.db.query(ReviewNote).join(RiskAssessment).filter(
            and_(
                RiskAssessment.assessment_date >= start_of_start,
                RiskAssessment.assessment_date < end_of_end
            )
        ).all()
        
        risk_summary = {
            "total": len(risks),
            "by_type": {},
            "by_level": {"高": 0, "中": 0, "低": 0},
            "by_status": {"待处理": 0, "已处理": 0, "已忽略": 0},
            "by_action": {"停运": 0, "限载": 0, "补检": 0}
        }
        
        for r in risks:
            if r.risk_type not in risk_summary["by_type"]:
                risk_summary["by_type"][r.risk_type] = 0
            risk_summary["by_type"][r.risk_type] += 1
            
            if r.risk_level in risk_summary["by_level"]:
                risk_summary["by_level"][r.risk_level] += 1
            
            if r.status in risk_summary["by_status"]:
                risk_summary["by_status"][r.status] += 1
            
            if r.action_required in risk_summary["by_action"]:
                risk_summary["by_action"][r.action_required] += 1
        
        return {
            "audit_period": {
                "start_date": start_date.strftime("%Y-%m-%d"),
                "end_date": end_date.strftime("%Y-%m-%d")
            },
            "summary": risk_summary,
            "risks": [
                {
                    "id": r.id,
                    "assessment_date": r.assessment_date.strftime("%Y-%m-%d %H:%M:%S"),
                    "cabin_number": r.cabin_number,
                    "risk_type": r.risk_type,
                    "risk_level": r.risk_level,
                    "action_required": r.action_required,
                    "reason": r.reason,
                    "status": r.status,
                    "created_at": r.created_at.strftime("%Y-%m-%d %H:%M:%S") if r.created_at else None
                }
                for r in risks
            ],
            "shifts": [
                {
                    "id": s.id,
                    "shift_date": s.shift_date.strftime("%Y-%m-%d"),
                    "shift_name": s.shift_name,
                    "status": s.status,
                    "start_time": s.start_time.strftime("%H:%M") if s.start_time else None,
                    "end_time": s.end_time.strftime("%H:%M") if s.end_time else None
                }
                for s in shifts
            ],
            "review_notes": [
                {
                    "id": rn.id,
                    "risk_id": rn.risk_id,
                    "reviewer": rn.reviewer,
                    "note": rn.note,
                    "action_taken": rn.action_taken,
                    "created_at": rn.created_at.strftime("%Y-%m-%d %H:%M:%S") if rn.created_at else None
                }
                for rn in review_notes
            ],
            "generated_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        }
