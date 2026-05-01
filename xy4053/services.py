from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from config import settings, CaseStatus, RiskLevel
from models import Case, StatusTransition, DesensitizedVersion, RiskAssessment, SupervisionFeedback, CrisisEscalation
from desensitization import desensitization_engine, scale_validator, risk_validator


class StateMachine:
    def __init__(self):
        self.transitions = settings.STATUS_TRANSITIONS
    
    def can_transition(self, from_status: CaseStatus, to_status: CaseStatus) -> bool:
        if from_status not in self.transitions:
            return False
        return to_status in self.transitions[from_status]
    
    def get_valid_transitions(self, current_status: CaseStatus) -> List[CaseStatus]:
        return self.transitions.get(current_status, [])


class CaseService:
    def __init__(self, db: Session):
        self.db = db
        self.state_machine = StateMachine()
    
    def create_case(self, counselor_id: int, case_data: Dict[str, Any]) -> Case:
        case_number = self._generate_case_number()
        
        case = Case(
            case_number=case_number,
            counselor_id=counselor_id,
            status=CaseStatus.DRAFT,
            risk_level=RiskLevel.LOW,
            **case_data
        )
        
        self.db.add(case)
        self.db.commit()
        self.db.refresh(case)
        
        return case
    
    def _generate_case_number(self) -> str:
        today = datetime.now()
        date_str = today.strftime("%Y%m%d")
        
        latest = self.db.query(Case).filter(
            Case.case_number.like(f"CASE-{date_str}%")
        ).order_by(Case.case_number.desc()).first()
        
        if latest:
            try:
                seq = int(latest.case_number.split("-")[-1]) + 1
            except (IndexError, ValueError):
                seq = 1
        else:
            seq = 1
        
        return f"CASE-{date_str}-{seq:04d}"
    
    def submit_for_review(self, case_id: int, counselor_id: int) -> Dict[str, Any]:
        case = self.db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise ValueError(f"案例不存在: {case_id}")
        
        if case.status != CaseStatus.DRAFT and case.status != CaseStatus.NEEDS_SUPPLEMENT:
            raise ValueError(f"当前状态 {case.status} 无法提交督导")
        
        case_content = {
            "presenting_problem": case.presenting_problem,
            "background_info": case.background_info,
            "assessment_process": case.assessment_process,
            "intervention_strategy": case.intervention_strategy
        }
        
        desensitized_passed, desensitized_results = desensitization_engine.check_case_content(case_content)
        
        scores = {
            "SDS": case.sds_score,
            "SAS": case.sas_score,
            "SCL90": case.scl90_score,
            "GAD7": case.gad7_score,
            "PHQ9": case.phq9_score
        }
        scores = {k: v for k, v in scores.items() if v is not None}
        scale_passed, scale_results = scale_validator.validate_all_scores(scores)
        
        risk_triggers = []
        if case.risk_factors:
            risk_triggers = case.risk_factors.split(",")
        
        risk_passed = True
        risk_results = {}
        if risk_triggers:
            risk_passed, risk_results = risk_validator.validate_risk_match(
                case.risk_level, risk_triggers
            )
        
        desensitized_version = DesensitizedVersion(
            case_id=case.id,
            version_number=len(case.desensitized_versions) + 1,
            presenting_problem=case.presenting_problem,
            background_info=case.background_info,
            assessment_process=case.assessment_process,
            intervention_strategy=case.intervention_strategy,
            desensitization_check_passed=1 if desensitized_passed else 0,
            sensitive_fields_found=str(desensitized_results) if not desensitized_passed else None,
            created_by=counselor_id
        )
        self.db.add(desensitized_version)
        
        if not desensitized_passed:
            self.db.commit()
            return {
                "success": False,
                "error": "脱敏检查未通过",
                "error_type": "desensitization_failed",
                "details": desensitized_results
            }
        
        if not scale_passed:
            self.db.commit()
            return {
                "success": False,
                "error": "量表分数校验未通过",
                "error_type": "scale_validation_failed",
                "details": scale_results
            }
        
        if not risk_passed:
            self.db.commit()
            return {
                "success": False,
                "error": "风险等级与触发因素不匹配",
                "error_type": "risk_mismatch",
                "details": risk_results
            }
        
        old_status = case.status
        case.status = CaseStatus.PENDING_REVIEW
        case.submitted_at = datetime.utcnow()
        
        transition = StatusTransition(
            case_id=case.id,
            from_status=old_status,
            to_status=CaseStatus.PENDING_REVIEW,
            transitioned_by=counselor_id,
            reason="提交督导审核"
        )
        self.db.add(transition)
        
        self.db.commit()
        self.db.refresh(case)
        
        return {
            "success": True,
            "case": case,
            "message": "案例已成功提交督导",
            "desensitized_version": desensitized_version
        }
    
    def request_supplement(self, case_id: int, supervisor_id: int, 
                           reason: str, required_items: List[str]) -> Dict[str, Any]:
        case = self.db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise ValueError(f"案例不存在: {case_id}")
        
        if case.status != CaseStatus.PENDING_REVIEW:
            raise ValueError(f"当前状态 {case.status} 无法要求补充资料")
        
        old_status = case.status
        case.status = CaseStatus.NEEDS_SUPPLEMENT
        
        transition = StatusTransition(
            case_id=case.id,
            from_status=old_status,
            to_status=CaseStatus.NEEDS_SUPPLEMENT,
            transitioned_by=supervisor_id,
            reason=reason,
            notes=f"需要补充: {', '.join(required_items)}"
        )
        self.db.add(transition)
        
        feedback = SupervisionFeedback(
            case_id=case.id,
            feedback_version=len(case.supervision_feedbacks) + 1,
            supervisor_id=supervisor_id,
            overall_assessment=f"需要补充资料: {reason}",
            areas_for_improvement=f"需要补充的内容: {', '.join(required_items)}",
            case_status_recommendation=CaseStatus.NEEDS_SUPPLEMENT
        )
        self.db.add(feedback)
        
        self.db.commit()
        self.db.refresh(case)
        
        return {
            "success": True,
            "case": case,
            "message": "已要求咨询师补充资料",
            "transition": transition,
            "feedback": feedback
        }
    
    def complete_review(self, case_id: int, supervisor_id: int, 
                        feedback_data: Dict[str, Any]) -> Dict[str, Any]:
        case = self.db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise ValueError(f"案例不存在: {case_id}")
        
        if case.status != CaseStatus.PENDING_REVIEW:
            raise ValueError(f"当前状态 {case.status} 无法完成督导")
        
        old_status = case.status
        case.status = CaseStatus.REVIEWED
        case.reviewed_at = datetime.utcnow()
        
        transition = StatusTransition(
            case_id=case.id,
            from_status=old_status,
            to_status=CaseStatus.REVIEWED,
            transitioned_by=supervisor_id,
            reason="督导完成"
        )
        self.db.add(transition)
        
        feedback = SupervisionFeedback(
            case_id=case.id,
            feedback_version=len(case.supervision_feedbacks) + 1,
            supervisor_id=supervisor_id,
            **feedback_data,
            case_status_recommendation=CaseStatus.REVIEWED
        )
        self.db.add(feedback)
        
        self.db.commit()
        self.db.refresh(case)
        
        return {
            "success": True,
            "case": case,
            "message": "督导已完成",
            "transition": transition,
            "feedback": feedback
        }
    
    def escalate_crisis(self, case_id: int, escalated_by: int, 
                        crisis_data: Dict[str, Any]) -> Dict[str, Any]:
        case = self.db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise ValueError(f"案例不存在: {case_id}")
        
        valid_statuses = [CaseStatus.PENDING_REVIEW, CaseStatus.REVIEWED, CaseStatus.CRISIS_HANDLING]
        if case.status not in valid_statuses:
            raise ValueError(f"当前状态 {case.status} 无法升级危机")
        
        old_status = case.status
        case.status = CaseStatus.CRISIS_HANDLING
        case.risk_level = RiskLevel.CRISIS
        
        transition = StatusTransition(
            case_id=case.id,
            from_status=old_status,
            to_status=CaseStatus.CRISIS_HANDLING,
            transitioned_by=escalated_by,
            reason=f"危机升级: {crisis_data.get('trigger_event', '未知触发事件')}"
        )
        self.db.add(transition)
        
        crisis_escalation = CrisisEscalation(
            case_id=case.id,
            escalation_number=len(case.crisis_escalations) + 1,
            escalated_by=escalated_by,
            **crisis_data
        )
        self.db.add(crisis_escalation)
        
        risk_assessment = RiskAssessment(
            case_id=case.id,
            assessment_version=len(case.risk_assessments) + 1,
            risk_level=RiskLevel.CRISIS,
            assessor_id=escalated_by,
            risk_factors=crisis_data.get("trigger_event"),
            trigger_factors=crisis_data.get("trigger_event"),
            assessment_notes=f"危机升级记录: {crisis_data.get('immediate_actions_taken', '未记录行动')}"
        )
        self.db.add(risk_assessment)
        
        self.db.commit()
        self.db.refresh(case)
        
        return {
            "success": True,
            "case": case,
            "message": "危机已升级处理",
            "transition": transition,
            "crisis_escalation": crisis_escalation,
            "risk_assessment": risk_assessment
        }
    
    def archive_case(self, case_id: int, archived_by: int, reason: str) -> Dict[str, Any]:
        case = self.db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise ValueError(f"案例不存在: {case_id}")
        
        valid_statuses = [CaseStatus.DRAFT, CaseStatus.PENDING_REVIEW, CaseStatus.NEEDS_SUPPLEMENT, 
                         CaseStatus.REVIEWED, CaseStatus.CRISIS_HANDLING]
        if case.status not in valid_statuses:
            raise ValueError(f"当前状态 {case.status} 无法归档")
        
        if case.status == CaseStatus.CRISIS_HANDLING:
            unresolved = self.db.query(CrisisEscalation).filter(
                CrisisEscalation.case_id == case_id,
                CrisisEscalation.is_resolved == 0
            ).first()
            if unresolved:
                return {
                    "success": False,
                    "error": "存在未解决的危机记录",
                    "error_type": "unresolved_crisis"
                }
        
        old_status = case.status
        case.status = CaseStatus.ARCHIVED
        case.archived_at = datetime.utcnow()
        
        transition = StatusTransition(
            case_id=case.id,
            from_status=old_status,
            to_status=CaseStatus.ARCHIVED,
            transitioned_by=archived_by,
            reason=f"归档: {reason}"
        )
        self.db.add(transition)
        
        self.db.commit()
        self.db.refresh(case)
        
        return {
            "success": True,
            "case": case,
            "message": "案例已归档",
            "transition": transition
        }
    
    def get_case_history(self, case_id: int) -> Dict[str, Any]:
        case = self.db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise ValueError(f"案例不存在: {case_id}")
        
        return {
            "case": case,
            "status_transitions": case.status_transitions,
            "desensitized_versions": case.desensitized_versions,
            "risk_assessments": case.risk_assessments,
            "supervision_feedbacks": case.supervision_feedbacks,
            "crisis_escalations": case.crisis_escalations
        }


state_machine = StateMachine()
