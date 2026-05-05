from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from .models import (
    Cabin, CabinInspection, WireRope, WireRopeInspection,
    WindSpeedRecord, Gripper, GripperLubrication, ReservationPeak,
    Shift, RiskAssessment
)


MAX_WIND_SPEED = 12.0
MAX_CAPACITY_PER_CABIN = 8
TOTAL_CABINS = 50
LUBRICATION_INTERVAL_DAYS = 30
MAX_REPEAT_ISSUES = 2


class RiskEngine:
    def __init__(self, db: Session):
        self.db = db
    
    def check_wire_rope_abnormal(self, check_date: datetime) -> List[Dict[str, Any]]:
        risks = []
        start_date = check_date - timedelta(days=7)
        
        abnormal_inspections = self.db.query(WireRopeInspection).filter(
            and_(
                WireRopeInspection.inspection_date >= start_date,
                WireRopeInspection.inspection_date <= check_date,
                WireRopeInspection.abnormal == "是"
            )
        ).all()
        
        for inspection in abnormal_inspections:
            risks.append({
                "risk_type": "探伤异常",
                "risk_level": "高",
                "action_required": "停运",
                "reason": f"钢丝绳 {inspection.rope_id} 探伤异常: {inspection.issues or '存在安全隐患'}",
                "cabin_number": None,
                "rope_id": inspection.rope_id
            })
        
        high_wear_inspections = self.db.query(WireRopeInspection).filter(
            and_(
                WireRopeInspection.inspection_date >= start_date,
                WireRopeInspection.inspection_date <= check_date,
                WireRopeInspection.wear_percentage > 10.0
            )
        ).all()
        
        for inspection in high_wear_inspections:
            risks.append({
                "risk_type": "探伤异常",
                "risk_level": "中",
                "action_required": "限载",
                "reason": f"钢丝绳 {inspection.rope_id} 磨损率过高: {inspection.wear_percentage}%",
                "cabin_number": None,
                "rope_id": inspection.rope_id
            })
        
        return risks
    
    def check_lubrication_overdue(self, check_date: datetime) -> List[Dict[str, Any]]:
        risks = []
        overdue_threshold = check_date - timedelta(days=LUBRICATION_INTERVAL_DAYS)
        
        overdue_grippers = self.db.query(Gripper).filter(
            and_(
                Gripper.last_lubrication_date != None,
                Gripper.last_lubrication_date < overdue_threshold
            )
        ).all()
        
        for gripper in overdue_grippers:
            days_overdue = (check_date - gripper.last_lubrication_date).days
            risks.append({
                "risk_type": "润滑超期",
                "risk_level": "中",
                "action_required": "补检",
                "reason": f"抱索器 {gripper.gripper_id} (吊厢 {gripper.cabin_number}) 润滑超期 {days_overdue} 天",
                "cabin_number": gripper.cabin_number,
                "gripper_id": gripper.gripper_id
            })
        
        no_lubrication_grippers = self.db.query(Gripper).filter(
            Gripper.last_lubrication_date == None
        ).all()
        
        for gripper in no_lubrication_grippers:
            risks.append({
                "risk_type": "润滑超期",
                "risk_level": "高",
                "action_required": "停运",
                "reason": f"抱索器 {gripper.gripper_id} (吊厢 {gripper.cabin_number}) 无润滑记录",
                "cabin_number": gripper.cabin_number,
                "gripper_id": gripper.gripper_id
            })
        
        return risks
    
    def check_wind_speed_window(self, check_date: datetime) -> List[Dict[str, Any]]:
        risks = []
        start_of_day = datetime(check_date.year, check_date.month, check_date.day)
        end_of_day = start_of_day + timedelta(days=1)
        
        wind_records = self.db.query(WindSpeedRecord).filter(
            and_(
                WindSpeedRecord.record_date >= start_of_day,
                WindSpeedRecord.record_date < end_of_day
            )
        ).order_by(WindSpeedRecord.time_slot).all()
        
        high_wind_slots = []
        for record in wind_records:
            if record.wind_speed > MAX_WIND_SPEED:
                high_wind_slots.append(record.time_slot)
        
        if high_wind_slots:
            risks.append({
                "risk_type": "风速窗口过窄",
                "risk_level": "高",
                "action_required": "停运",
                "reason": f"以下时段风速超过安全阈值 ({MAX_WIND_SPEED} m/s): {', '.join(high_wind_slots)}",
                "cabin_number": None,
                "affected_slots": high_wind_slots
            })
        
        return risks
    
    def check_repeat_repairs(self, check_date: datetime) -> List[Dict[str, Any]]:
        risks = []
        start_date = check_date - timedelta(days=7)
        
        cabin_issue_counts = self.db.query(
            CabinInspection.cabin_number,
            func.count(CabinInspection.id).label('issue_count')
        ).filter(
            and_(
                CabinInspection.inspection_date >= start_date,
                CabinInspection.inspection_date <= check_date,
                CabinInspection.status != "正常"
            )
        ).group_by(CabinInspection.cabin_number).having(
            func.count(CabinInspection.id) >= MAX_REPEAT_ISSUES
        ).all()
        
        for cabin_count in cabin_issue_counts:
            recent_issues = self.db.query(CabinInspection).filter(
                and_(
                    CabinInspection.cabin_number == cabin_count.cabin_number,
                    CabinInspection.inspection_date >= start_date,
                    CabinInspection.status != "正常"
                )
            ).all()
            
            issues_desc = "; ".join([f"{i.inspection_date.strftime('%m-%d')}: {i.issues or '异常'}" for i in recent_issues])
            
            risks.append({
                "risk_type": "同一吊厢重复报修",
                "risk_level": "高",
                "action_required": "停运",
                "reason": f"吊厢 {cabin_count.cabin_number} 7天内出现 {cabin_count.issue_count} 次异常: {issues_desc}",
                "cabin_number": cabin_count.cabin_number,
                "issue_count": cabin_count.issue_count
            })
        
        return risks
    
    def check_capacity_exceeded(self, check_date: datetime) -> List[Dict[str, Any]]:
        risks = []
        start_of_day = datetime(check_date.year, check_date.month, check_date.day)
        end_of_day = start_of_day + timedelta(days=1)
        
        available_cabins = self.db.query(Cabin).filter(
            Cabin.status == "正常"
        ).count()
        
        if available_cabins == 0:
            available_cabins = TOTAL_CABINS
        
        max_capacity = available_cabins * MAX_CAPACITY_PER_CABIN
        
        peak_records = self.db.query(ReservationPeak).filter(
            and_(
                ReservationPeak.record_date >= start_of_day,
                ReservationPeak.record_date < end_of_day
            )
        ).all()
        
        for peak in peak_records:
            if peak.peak_count > max_capacity:
                excess = peak.peak_count - max_capacity
                reduction_ratio = max_capacity / peak.peak_count
                risks.append({
                    "risk_type": "预约量超出可用运力",
                    "risk_level": "中",
                    "action_required": "限载",
                    "reason": f"时段 {peak.time_slot} 预约峰值 {peak.peak_count} 人超过可用运力 {max_capacity} 人，超出 {excess} 人，建议限流比例 {(1-reduction_ratio)*100:.1f}%",
                    "cabin_number": None,
                    "time_slot": peak.time_slot,
                    "peak_count": peak.peak_count,
                    "max_capacity": max_capacity
                })
        
        return risks
    
    def assess_all_risks(self, check_date: datetime) -> List[Dict[str, Any]]:
        all_risks = []
        
        all_risks.extend(self.check_wire_rope_abnormal(check_date))
        all_risks.extend(self.check_lubrication_overdue(check_date))
        all_risks.extend(self.check_wind_speed_window(check_date))
        all_risks.extend(self.check_repeat_repairs(check_date))
        all_risks.extend(self.check_capacity_exceeded(check_date))
        
        for risk in all_risks:
            existing = self.db.query(RiskAssessment).filter(
                and_(
                    RiskAssessment.assessment_date == check_date,
                    RiskAssessment.risk_type == risk["risk_type"],
                    RiskAssessment.reason == risk["reason"]
                )
            ).first()
            
            if not existing:
                new_risk = RiskAssessment(
                    assessment_date=check_date,
                    cabin_number=risk.get("cabin_number"),
                    risk_type=risk["risk_type"],
                    risk_level=risk["risk_level"],
                    action_required=risk["action_required"],
                    reason=risk["reason"],
                    status="待处理"
                )
                self.db.add(new_risk)
        
        self.db.commit()
        
        return all_risks
    
    def get_shift_risks(self, shift_date: datetime, shift_name: str) -> Dict[str, Any]:
        shift = self.db.query(Shift).filter(
            and_(
                Shift.shift_date == shift_date,
                Shift.shift_name == shift_name
            )
        ).first()
        
        if not shift:
            shift = Shift(
                shift_date=shift_date,
                shift_name=shift_name,
                status="正常"
            )
            self.db.add(shift)
            self.db.commit()
        
        risks = self.assess_all_risks(shift_date)
        
        actions = {
            "停运": False,
            "限载": False,
            "补检": False
        }
        
        high_risks = []
        medium_risks = []
        low_risks = []
        
        for risk in risks:
            if risk["action_required"] == "停运":
                actions["停运"] = True
                high_risks.append(risk)
            elif risk["action_required"] == "限载":
                actions["限载"] = True
                if risk["risk_level"] == "高":
                    high_risks.append(risk)
                else:
                    medium_risks.append(risk)
            elif risk["action_required"] == "补检":
                actions["补检"] = True
                medium_risks.append(risk)
        
        final_status = "正常"
        if actions["停运"]:
            final_status = "停运"
        elif actions["限载"]:
            final_status = "限载"
        elif actions["补检"]:
            final_status = "补检"
        
        shift.status = final_status
        self.db.commit()
        
        return {
            "shift_date": shift_date.strftime("%Y-%m-%d"),
            "shift_name": shift_name,
            "status": final_status,
            "actions_required": actions,
            "high_risks": high_risks,
            "medium_risks": medium_risks,
            "low_risks": low_risks,
            "total_risks": len(risks)
        }
