from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import desc, or_

from app.database.models import CallRecord, RiskAssessment, FollowUp, SupervisorNote, Schedule
from app.parsers.json_parser import CallSummaryParser
from app.parsers.csv_parser import ScheduleParser, FollowUpParser
from app.engine.text_scorer import RiskRuleEngine
from app.config import RISK_FLAGS


class CallService:
    def __init__(self, db_session: Session):
        self.db = db_session
        self.rule_engine = RiskRuleEngine()

    def import_call_summaries(self, file_path: Path) -> Tuple[int, List[str]]:
        records = CallSummaryParser.parse_file(file_path)
        imported = 0
        errors = []

        for record in records:
            try:
                existing = self.db.query(CallRecord).filter(
                    CallRecord.call_id == record["call_id"]
                ).first()
                
                if existing:
                    for key, value in record.items():
                        if hasattr(existing, key):
                            setattr(existing, key, value)
                    existing.updated_at = datetime.now()
                else:
                    new_call = CallRecord(**record)
                    self.db.add(new_call)
                
                self.db.flush()
                imported += 1
            except Exception as e:
                errors.append(f"来电ID {record.get('call_id')}: {str(e)}")
        
        self.db.commit()
        
        for record in records:
            try:
                call = self.db.query(CallRecord).filter(
                    CallRecord.call_id == record["call_id"]
                ).first()
                if call:
                    self._auto_assess_call(call)
            except Exception as e:
                errors.append(f"评估来电 {record.get('call_id')} 时出错: {str(e)}")
        
        return imported, errors

    def import_schedules(self, file_path: Path) -> Tuple[int, List[str]]:
        records = ScheduleParser.parse_file(file_path)
        imported = 0
        errors = []

        for record in records:
            try:
                existing = self.db.query(Schedule).filter(
                    Schedule.schedule_id == record["schedule_id"]
                ).first()
                
                if existing:
                    for key, value in record.items():
                        if hasattr(existing, key):
                            setattr(existing, key, value)
                else:
                    new_schedule = Schedule(**record)
                    self.db.add(new_schedule)
                
                imported += 1
            except Exception as e:
                errors.append(f"排班 {record.get('schedule_id')}: {str(e)}")
        
        self.db.commit()
        return imported, errors

    def import_follow_ups(self, file_path: Path) -> Tuple[int, List[str]]:
        records = FollowUpParser.parse_file(file_path)
        imported = 0
        errors = []

        for record in records:
            try:
                call = self.db.query(CallRecord).filter(
                    CallRecord.call_id == record.pop("call_id")
                ).first()
                
                if not call:
                    errors.append(f"找不到对应的来电记录: {record.get('call_id')}")
                    continue
                
                existing = self.db.query(FollowUp).filter(
                    FollowUp.follow_up_id == record["follow_up_id"]
                ).first()
                
                record["call_record_id"] = call.id
                
                if existing:
                    for key, value in record.items():
                        if hasattr(existing, key):
                            setattr(existing, key, value)
                    existing.updated_at = datetime.now()
                else:
                    new_fu = FollowUp(**record)
                    self.db.add(new_fu)
                
                imported += 1
            except Exception as e:
                errors.append(f"回访记录 {record.get('follow_up_id')}: {str(e)}")
        
        self.db.commit()
        return imported, errors

    def _auto_assess_call(self, call: CallRecord) -> RiskAssessment:
        caller_history = self.db.query(CallRecord).filter(
            CallRecord.caller_id == call.caller_id,
            CallRecord.id != call.id
        ).order_by(desc(CallRecord.call_time)).all()
        
        history_dicts = [{
            "call_time": c.call_time,
            "initial_risk_level": c.initial_risk_level,
            "caller_id": c.caller_id,
            "summary_text": c.summary_text,
        } for c in caller_history]
        
        follow_ups = self.db.query(FollowUp).filter(
            FollowUp.call_record_id == call.id
        ).all()
        
        fu_dicts = [{
            "scheduled_time": fu.scheduled_time,
            "actual_time": fu.actual_time,
            "is_completed": fu.is_completed,
        } for fu in follow_ups]
        
        call_dict = {
            "call_time": call.call_time,
            "initial_risk_level": call.initial_risk_level,
            "caller_id": call.caller_id,
            "summary_text": call.summary_text,
            "has_referral": call.has_referral,
            "referral_time": call.referral_time,
        }
        
        assessment_result = self.rule_engine.assess_call(
            call_dict, history_dicts, fu_dicts
        )
        
        existing_assessment = self.db.query(RiskAssessment).filter(
            RiskAssessment.call_record_id == call.id,
            RiskAssessment.is_system_generated == True
        ).order_by(desc(RiskAssessment.assessment_time)).first()
        
        if existing_assessment:
            existing_assessment.risk_level = assessment_result["risk_level"]
            existing_assessment.risk_score = assessment_result["risk_score"]
            existing_assessment.flags = str(assessment_result["flags"])
            existing_assessment.reasons = f"自动评估: 文本评分 {assessment_result['text_score']}分, 触发标志: {assessment_result['flags']}"
            existing_assessment.assessment_time = datetime.now()
            new_assessment = existing_assessment
        else:
            new_assessment = RiskAssessment(
                call_record_id=call.id,
                risk_level=assessment_result["risk_level"],
                risk_score=assessment_result["risk_score"],
                flags=str(assessment_result["flags"]),
                reasons=f"自动评估: 文本评分 {assessment_result['text_score']}分, 触发标志: {assessment_result['flags']}",
                is_system_generated=True,
                assessment_time=datetime.now(),
            )
            self.db.add(new_assessment)
        
        self.db.commit()
        return new_assessment

    def get_risk_queue(self, risk_levels: List[str] = None) -> List[Dict[str, Any]]:
        query = self.db.query(CallRecord).join(RiskAssessment)
        
        if risk_levels:
            query = query.filter(RiskAssessment.risk_level.in_(risk_levels))
        
        calls = query.order_by(desc(CallRecord.call_time)).all()
        
        result = []
        for call in calls:
            latest_assessment = call.get_latest_assessment()
            if not latest_assessment:
                continue
            
            follow_ups = self.db.query(FollowUp).filter(
                FollowUp.call_record_id == call.id
            ).all()
            
            supervisor_notes = self.db.query(SupervisorNote).filter(
                SupervisorNote.call_record_id == call.id
            ).order_by(desc(SupervisorNote.created_at)).all()
            
            result.append({
                "id": call.id,
                "call_id": call.call_id,
                "caller_id": call.caller_id,
                "call_time": call.call_time,
                "duration_minutes": call.duration_minutes,
                "summary_text": call.summary_text,
                "initial_risk_level": call.initial_risk_level,
                "operator_id": call.operator_id,
                "operator_name": call.operator_name,
                "has_referral": call.has_referral,
                "referral_to": call.referral_to,
                "current_risk_level": latest_assessment.risk_level,
                "risk_score": latest_assessment.risk_score,
                "assessment_flags": latest_assessment.get_flags_list(),
                "assessment_reasons": latest_assessment.reasons,
                "follow_ups": [
                    {
                        "id": fu.id,
                        "scheduled_time": fu.scheduled_time,
                        "actual_time": fu.actual_time,
                        "is_completed": fu.is_completed,
                        "content": fu.content,
                        "result": fu.result,
                    }
                    for fu in follow_ups
                ],
                "supervisor_notes": [
                    {
                        "id": sn.id,
                        "note_text": sn.note_text,
                        "supervisor_name": sn.supervisor_name,
                        "created_at": sn.created_at,
                    }
                    for sn in supervisor_notes
                ],
            })
        
        priority_order = {"red": 0, "orange": 1, "yellow": 2, "green": 3}
        result.sort(key=lambda x: (priority_order.get(x["current_risk_level"], 4), -x["risk_score"]))
        
        return result

    def get_call_by_id(self, call_id: str) -> Optional[Dict[str, Any]]:
        call = self.db.query(CallRecord).filter(CallRecord.call_id == call_id).first()
        if not call:
            return None
        
        latest_assessment = call.get_latest_assessment()
        follow_ups = self.db.query(FollowUp).filter(
            FollowUp.call_record_id == call.id
        ).all()
        supervisor_notes = self.db.query(SupervisorNote).filter(
            SupervisorNote.call_record_id == call.id
        ).order_by(desc(SupervisorNote.created_at)).all()
        
        return {
            "id": call.id,
            "call_id": call.call_id,
            "caller_id": call.caller_id,
            "call_time": call.call_time,
            "duration_minutes": call.duration_minutes,
            "summary_text": call.summary_text,
            "initial_risk_level": call.initial_risk_level,
            "operator_id": call.operator_id,
            "operator_name": call.operator_name,
            "has_referral": call.has_referral,
            "referral_to": call.referral_to,
            "referral_time": call.referral_time,
            "current_risk_level": latest_assessment.risk_level if latest_assessment else call.initial_risk_level,
            "risk_score": latest_assessment.risk_score if latest_assessment else 0,
            "assessment_flags": latest_assessment.get_flags_list() if latest_assessment else [],
            "assessment_reasons": latest_assessment.reasons if latest_assessment else "",
            "follow_ups": [
                {
                    "id": fu.id,
                    "follow_up_id": fu.follow_up_id,
                    "scheduled_time": fu.scheduled_time,
                    "actual_time": fu.actual_time,
                    "is_completed": fu.is_completed,
                    "operator_id": fu.operator_id,
                    "operator_name": fu.operator_name,
                    "content": fu.content,
                    "result": fu.result,
                    "missed_reason": fu.missed_reason,
                }
                for fu in follow_ups
            ],
            "supervisor_notes": [
                {
                    "id": sn.id,
                    "note_text": sn.note_text,
                    "supervisor_id": sn.supervisor_id,
                    "supervisor_name": sn.supervisor_name,
                    "created_at": sn.created_at,
                    "updated_at": sn.updated_at,
                }
                for sn in supervisor_notes
            ],
        }

    def update_risk_assessment(
        self, 
        call_id: str, 
        new_risk_level: str,
        reasons: str,
        supervisor_name: str = None
    ) -> RiskAssessment:
        call = self.db.query(CallRecord).filter(CallRecord.call_id == call_id).first()
        if not call:
            raise ValueError(f"找不到来电记录: {call_id}")
        
        latest_assessment = call.get_latest_assessment()
        score = latest_assessment.risk_score if latest_assessment else 0
        
        new_assessment = RiskAssessment(
            call_record_id=call.id,
            risk_level=new_risk_level,
            risk_score=score,
            flags=latest_assessment.flags if latest_assessment else None,
            reasons=reasons,
            assessed_by=supervisor_name,
            is_system_generated=False,
            assessment_time=datetime.now(),
        )
        
        self.db.add(new_assessment)
        self.db.commit()
        
        return new_assessment

    def add_supervisor_note(
        self,
        call_id: str,
        note_text: str,
        supervisor_name: str = None
    ) -> SupervisorNote:
        call = self.db.query(CallRecord).filter(CallRecord.call_id == call_id).first()
        if not call:
            raise ValueError(f"找不到来电记录: {call_id}")
        
        note = SupervisorNote(
            call_record_id=call.id,
            note_text=note_text,
            supervisor_name=supervisor_name,
            created_at=datetime.now(),
            updated_at=datetime.now(),
        )
        
        self.db.add(note)
        self.db.commit()
        
        return note

    def update_follow_up(
        self,
        follow_up_id: int,
        is_completed: bool = None,
        content: str = None,
        result: str = None,
        actual_time: datetime = None,
    ) -> FollowUp:
        fu = self.db.query(FollowUp).filter(FollowUp.id == follow_up_id).first()
        if not fu:
            raise ValueError(f"找不到回访记录: {follow_up_id}")
        
        if is_completed is not None:
            fu.is_completed = is_completed
        if content is not None:
            fu.content = content
        if result is not None:
            fu.result = result
        if actual_time is not None:
            fu.actual_time = actual_time
        
        fu.updated_at = datetime.now()
        self.db.commit()
        
        return fu

    def get_statistics(self) -> Dict[str, Any]:
        total_calls = self.db.query(CallRecord).count()
        
        from sqlalchemy import func
        risk_stats = self.db.query(
            RiskAssessment.risk_level,
            func.count(RiskAssessment.id)
        ).group_by(RiskAssessment.risk_level).all()
        
        risk_distribution = dict(risk_stats)
        
        flag_stats = {}
        assessments = self.db.query(RiskAssessment).all()
        for assessment in assessments:
            flags = assessment.get_flags_list()
            for flag in flags:
                flag_stats[flag] = flag_stats.get(flag, 0) + 1
        
        follow_ups_pending = self.db.query(FollowUp).filter(
            FollowUp.is_completed == False
        ).count()
        
        return {
            "total_calls": total_calls,
            "risk_distribution": risk_distribution,
            "flag_distribution": flag_stats,
            "pending_follow_ups": follow_ups_pending,
        }

    def reprocess_all_assessments(self) -> int:
        calls = self.db.query(CallRecord).all()
        count = 0
        for call in calls:
            self._auto_assess_call(call)
            count += 1
        return count
