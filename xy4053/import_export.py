import csv
import io
from typing import Dict, Any, List, Optional
from datetime import datetime
from sqlalchemy.orm import Session
from models import Case, Counselor, StatusTransition, SupervisionFeedback, RiskAssessment, CrisisEscalation
from config import CaseStatus, RiskLevel
import json


class CSVImporter:
    def __init__(self, db: Session):
        self.db = db
    
    def import_cases_from_csv(self, csv_content: str, counselor_id: int) -> Dict[str, Any]:
        cases = []
        errors = []
        success_count = 0
        
        try:
            csv_file = io.StringIO(csv_content)
            reader = csv.DictReader(csv_file)
            
            for row_num, row in enumerate(reader, start=2):
                try:
                    case_data = self._parse_csv_row(row)
                    
                    case_number = self._generate_case_number()
                    
                    case = Case(
                        case_number=case_number,
                        counselor_id=counselor_id,
                        status=CaseStatus.DRAFT,
                        risk_level=self._parse_risk_level(row.get("风险等级", "低风险")),
                        presenting_problem=row.get("主诉问题", ""),
                        background_info=row.get("背景信息", ""),
                        assessment_process=row.get("评估过程", ""),
                        intervention_strategy=row.get("干预策略", ""),
                        sds_score=self._parse_float(row.get("SDS分数")),
                        sas_score=self._parse_float(row.get("SAS分数")),
                        scl90_score=self._parse_float(row.get("SCL90分数")),
                        gad7_score=self._parse_float(row.get("GAD7分数")),
                        phq9_score=self._parse_float(row.get("PHQ9分数")),
                        risk_factors=row.get("风险因素", ""),
                        protective_factors=row.get("保护因素", "")
                    )
                    
                    self.db.add(case)
                    cases.append(case)
                    success_count += 1
                    
                except Exception as e:
                    errors.append({
                        "row": row_num,
                        "error": str(e),
                        "data": row
                    })
            
            self.db.commit()
            
            return {
                "success": True,
                "imported_count": success_count,
                "error_count": len(errors),
                "imported_cases": [{"id": c.id, "case_number": c.case_number} for c in cases],
                "errors": errors
            }
            
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "imported_count": 0
            }
    
    def _parse_csv_row(self, row: Dict[str, str]) -> Dict[str, Any]:
        required_fields = ["主诉问题"]
        for field in required_fields:
            if field not in row or not row[field].strip():
                raise ValueError(f"缺少必填字段: {field}")
        return row
    
    def _parse_risk_level(self, value: str) -> RiskLevel:
        risk_map = {
            "低风险": RiskLevel.LOW,
            "中风险": RiskLevel.MEDIUM,
            "高风险": RiskLevel.HIGH,
            "危机": RiskLevel.CRISIS
        }
        return risk_map.get(value, RiskLevel.LOW)
    
    def _parse_float(self, value: Optional[str]) -> Optional[float]:
        if not value:
            return None
        try:
            return float(value.strip())
        except (ValueError, TypeError):
            return None
    
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


class MarkdownExporter:
    def __init__(self, db: Session):
        self.db = db
    
    def export_supervision_notes(self, case_id: int) -> str:
        case = self.db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise ValueError(f"案例不存在: {case_id}")
        
        counselor = None
        if case.counselor_id:
            counselor = self.db.query(Counselor).filter(
                Counselor.id == case.counselor_id
            ).first()
        
        feedbaks = self.db.query(SupervisionFeedback).filter(
            SupervisionFeedback.case_id == case_id
        ).order_by(SupervisionFeedback.feedback_date.asc()).all()
        
        risk_assessments = self.db.query(RiskAssessment).filter(
            RiskAssessment.case_id == case_id
        ).order_by(RiskAssessment.assessment_date.asc()).all()
        
        crisis_escalations = self.db.query(CrisisEscalation).filter(
            CrisisEscalation.case_id == case_id
        ).order_by(CrisisEscalation.escalation_date.asc()).all()
        
        status_transitions = self.db.query(StatusTransition).filter(
            StatusTransition.case_id == case_id
        ).order_by(StatusTransition.transition_date.asc()).all()
        
        md_content = f"""# 案例督导纪要

## 基本信息

- **案例编号**: {case.case_number}
- **咨询师**: {counselor.name if counselor else '未知'}
- **当前状态**: {case.status}
- **风险等级**: {case.risk_level}
- **创建时间**: {case.created_at.strftime('%Y-%m-%d %H:%M') if case.created_at else '未知'}
- **提交时间**: {case.submitted_at.strftime('%Y-%m-%d %H:%M') if case.submitted_at else '未提交'}
- **督导时间**: {case.reviewed_at.strftime('%Y-%m-%d %H:%M') if case.reviewed_at else '未督导'}

---

## 案例内容

### 主诉问题
{case.presenting_problem or '无记录'}

### 背景信息
{case.background_info or '无记录'}

### 评估过程
{case.assessment_process or '无记录'}

### 干预策略
{case.intervention_strategy or '无记录'}

---

## 量表评估结果

| 量表 | 分数 | 状态 |
|------|------|------|
"""
        
        scales = [
            ("SDS", case.sds_score, "(0-100)"),
            ("SAS", case.sas_score, "(0-100)"),
            ("SCL-90", case.scl90_score, "(0-270)"),
            ("GAD-7", case.gad7_score, "(0-21)"),
            ("PHQ-9", case.phq9_score, "(0-27)")
        ]
        
        for name, score, range_str in scales:
            if score is not None:
                md_content += f"| {name} | {score} | {range_str} |\n"
            else:
                md_content += f"| {name} | 未填写 | {range_str} |\n"
        
        md_content += """
---

## 风险评估记录
"""
        
        if risk_assessments:
            for idx, assessment in enumerate(risk_assessments, 1):
                assessor = None
                if assessment.assessor_id:
                    assessor = self.db.query(Counselor).filter(
                        Counselor.id == assessment.assessor_id
                    ).first()
                
                md_content += f"""
### 风险评估 #{idx}

- **评估日期**: {assessment.assessment_date.strftime('%Y-%m-%d %H:%M') if assessment.assessment_date else '未知'}
- **评估者**: {assessor.name if assessor else '未知'}
- **风险等级**: {assessment.risk_level}

**风险因素**: {assessment.risk_factors or '无记录'}

**保护因素**: {assessment.protective_factors or '无记录'}

**自杀风险**: {assessment.suicide_risk or '未评估'}
**自伤风险**: {assessment.self_harm_risk or '未评估'}
**暴力风险**: {assessment.violence_risk or '未评估'}

**评估备注**: {assessment.assessment_notes or '无记录'}

**推荐行动**: {assessment.recommended_actions or '无记录'}
"""
        else:
            md_content += "\n暂无风险评估记录\n"
        
        md_content += """
---

## 督导反馈记录
"""
        
        if feedbaks:
            for idx, feedback in enumerate(feedbaks, 1):
                supervisor = None
                if feedback.supervisor_id:
                    supervisor = self.db.query(Counselor).filter(
                        Counselor.id == feedback.supervisor_id
                    ).first()
                
                md_content += f"""
### 督导反馈 #{idx}

- **反馈日期**: {feedback.feedback_date.strftime('%Y-%m-%d %H:%M') if feedback.feedback_date else '未知'}
- **督导者**: {supervisor.name if supervisor else '未知'}

**整体评估**: {feedback.overall_assessment or '无记录'}

**优点**: {feedback.strengths or '无记录'}

**改进方向**: {feedback.areas_for_improvement or '无记录'}

**伦理考虑**: {feedback.ethical_considerations or '无记录'}

**法律影响**: {feedback.legal_implications or '无记录'}

**具体建议**: {feedback.specific_recommendations or '无记录'}

**跟进要求**: {feedback.follow_up_requirements or '无记录'}
"""
        else:
            md_content += "\n暂无督导反馈记录\n"
        
        md_content += """
---

## 危机升级记录
"""
        
        if crisis_escalations:
            for idx, escalation in enumerate(crisis_escalations, 1):
                escalated_by = None
                if escalation.escalated_by:
                    escalated_by = self.db.query(Counselor).filter(
                        Counselor.id == escalation.escalated_by
                    ).first()
                
                md_content += f"""
### 危机升级 #{idx}

- **升级日期**: {escalation.escalation_date.strftime('%Y-%m-%d %H:%M') if escalation.escalation_date else '未知'}
- **升级者**: {escalated_by.name if escalated_by else '未知'}
- **危机等级**: {escalation.crisis_level or '未指定'}
- **是否解决**: {'已解决' if escalation.is_resolved else '未解决'}

**触发事件**: {escalation.trigger_event or '无记录'}

**立即采取的行动**: {escalation.immediate_actions_taken or '无记录'}

**通知的相关方**: {escalation.parties_notified or '无记录'}

**安全计划是否激活**: {'是' if escalation.safety_plan_activated else '否'}
**紧急联系人是否通知**: {'是' if escalation.emergency_contacts_informed else '否'}

**跟进日期**: {escalation.follow_up_date.strftime('%Y-%m-%d') if escalation.follow_up_date else '未安排'}

**解决备注**: {escalation.resolution_notes or '无记录'}
"""
        else:
            md_content += "\n暂无危机升级记录\n"
        
        md_content += """
---

## 状态流转记录

| 序号 | 原状态 | 新状态 | 变更时间 | 变更人 | 原因 |
|------|--------|--------|----------|--------|------|
"""
        
        if status_transitions:
            for idx, transition in enumerate(status_transitions, 1):
                transitioned_by = None
                if transition.transitioned_by:
                    transitioned_by = self.db.query(Counselor).filter(
                        Counselor.id == transition.transitioned_by
                    ).first()
                
                md_content += f"| {idx} | {transition.from_status} | {transition.to_status} | "
                md_content += f"{transition.transition_date.strftime('%Y-%m-%d %H:%M') if transition.transition_date else '未知'} | "
                md_content += f"{transitioned_by.name if transitioned_by else '未知'} | "
                md_content += f"{transition.reason or '无记录'} |\n"
        else:
            md_content += "| - | - | - | - | - | 无状态流转记录 |\n"
        
        md_content += f"""

---

## 风险因素与保护因素

**风险因素**: {case.risk_factors or '无记录'}

**保护因素**: {case.protective_factors or '无记录'}

---

*文档生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""
        
        return md_content


class JSONExporter:
    def __init__(self, db: Session):
        self.db = db
    
    def export_case_json(self, case_id: int) -> Dict[str, Any]:
        case = self.db.query(Case).filter(Case.id == case_id).first()
        if not case:
            raise ValueError(f"案例不存在: {case_id}")
        
        counselor = None
        if case.counselor_id:
            counselor = self.db.query(Counselor).filter(
                Counselor.id == case.counselor_id
            ).first()
        
        feedbaks = self.db.query(SupervisionFeedback).filter(
            SupervisionFeedback.case_id == case_id
        ).order_by(SupervisionFeedback.feedback_date.asc()).all()
        
        risk_assessments = self.db.query(RiskAssessment).filter(
            RiskAssessment.case_id == case_id
        ).order_by(RiskAssessment.assessment_date.asc()).all()
        
        crisis_escalations = self.db.query(CrisisEscalation).filter(
            CrisisEscalation.case_id == case_id
        ).order_by(CrisisEscalation.escalation_date.asc()).all()
        
        status_transitions = self.db.query(StatusTransition).filter(
            StatusTransition.case_id == case_id
        ).order_by(StatusTransition.transition_date.asc()).all()
        
        return {
            "case_info": {
                "id": case.id,
                "case_number": case.case_number,
                "status": case.status,
                "risk_level": case.risk_level,
                "counselor": {
                    "id": counselor.id if counselor else None,
                    "name": counselor.name if counselor else None
                },
                "timestamps": {
                    "created_at": case.created_at.isoformat() if case.created_at else None,
                    "updated_at": case.updated_at.isoformat() if case.updated_at else None,
                    "submitted_at": case.submitted_at.isoformat() if case.submitted_at else None,
                    "reviewed_at": case.reviewed_at.isoformat() if case.reviewed_at else None,
                    "archived_at": case.archived_at.isoformat() if case.archived_at else None
                }
            },
            "case_content": {
                "presenting_problem": case.presenting_problem,
                "background_info": case.background_info,
                "assessment_process": case.assessment_process,
                "intervention_strategy": case.intervention_strategy
            },
            "scale_scores": {
                "SDS": case.sds_score,
                "SAS": case.sas_score,
                "SCL90": case.scl90_score,
                "GAD7": case.gad7_score,
                "PHQ9": case.phq9_score
            },
            "risk_factors": {
                "risk_factors": case.risk_factors,
                "protective_factors": case.protective_factors
            },
            "supervision_feedbacks": [
                {
                    "id": f.id,
                    "version": f.feedback_version,
                    "supervisor_id": f.supervisor_id,
                    "feedback_date": f.feedback_date.isoformat() if f.feedback_date else None,
                    "overall_assessment": f.overall_assessment,
                    "strengths": f.strengths,
                    "areas_for_improvement": f.areas_for_improvement,
                    "ethical_considerations": f.ethical_considerations,
                    "legal_implications": f.legal_implications,
                    "specific_recommendations": f.specific_recommendations,
                    "follow_up_requirements": f.follow_up_requirements,
                    "case_status_recommendation": f.case_status_recommendation
                }
                for f in feedbaks
            ],
            "risk_assessments": [
                {
                    "id": ra.id,
                    "version": ra.assessment_version,
                    "risk_level": ra.risk_level,
                    "assessment_date": ra.assessment_date.isoformat() if ra.assessment_date else None,
                    "assessor_id": ra.assessor_id,
                    "risk_factors": ra.risk_factors,
                    "protective_factors": ra.protective_factors,
                    "trigger_factors": ra.trigger_factors,
                    "suicide_risk": ra.suicide_risk,
                    "self_harm_risk": ra.self_harm_risk,
                    "violence_risk": ra.violence_risk,
                    "assessment_notes": ra.assessment_notes,
                    "recommended_actions": ra.recommended_actions
                }
                for ra in risk_assessments
            ],
            "crisis_escalations": [
                {
                    "id": ce.id,
                    "escalation_number": ce.escalation_number,
                    "escalation_date": ce.escalation_date.isoformat() if ce.escalation_date else None,
                    "escalated_by": ce.escalated_by,
                    "trigger_event": ce.trigger_event,
                    "immediate_actions_taken": ce.immediate_actions_taken,
                    "parties_notified": ce.parties_notified,
                    "crisis_level": ce.crisis_level,
                    "safety_plan_activated": bool(ce.safety_plan_activated),
                    "emergency_contacts_informed": bool(ce.emergency_contacts_informed),
                    "follow_up_date": ce.follow_up_date.isoformat() if ce.follow_up_date else None,
                    "resolution_notes": ce.resolution_notes,
                    "is_resolved": bool(ce.is_resolved)
                }
                for ce in crisis_escalations
            ],
            "status_transitions": [
                {
                    "id": st.id,
                    "from_status": st.from_status,
                    "to_status": st.to_status,
                    "transition_date": st.transition_date.isoformat() if st.transition_date else None,
                    "transitioned_by": st.transitioned_by,
                    "reason": st.reason,
                    "notes": st.notes
                }
                for st in status_transitions
            ],
            "export_metadata": {
                "export_time": datetime.now().isoformat(),
                "version": "1.0"
            }
        }
