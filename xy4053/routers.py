from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from fastapi.responses import JSONResponse, PlainTextResponse
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
import json

from database import get_db
from models import Counselor, Case
from config import CaseStatus, RiskLevel, settings
from services import CaseService
from desensitization import desensitization_engine, scale_validator, risk_validator
from import_export import CSVImporter, MarkdownExporter, JSONExporter
from audit_service import AuditService
from pydantic import BaseModel
from typing import Dict, Any


router = APIRouter(prefix=settings.API_PREFIX, tags=["案例管理"])


class CounselorCreate(BaseModel):
    name: str
    employee_id: str
    department: Optional[str] = None
    qualification: Optional[str] = None


class CaseCreate(BaseModel):
    presenting_problem: str
    background_info: Optional[str] = None
    assessment_process: Optional[str] = None
    intervention_strategy: Optional[str] = None
    sds_score: Optional[float] = None
    sas_score: Optional[float] = None
    scl90_score: Optional[float] = None
    gad7_score: Optional[float] = None
    phq9_score: Optional[float] = None
    risk_factors: Optional[str] = None
    protective_factors: Optional[str] = None
    risk_level: RiskLevel = RiskLevel.LOW


class CaseUpdate(BaseModel):
    presenting_problem: Optional[str] = None
    background_info: Optional[str] = None
    assessment_process: Optional[str] = None
    intervention_strategy: Optional[str] = None
    sds_score: Optional[float] = None
    sas_score: Optional[float] = None
    scl90_score: Optional[float] = None
    gad7_score: Optional[float] = None
    phq9_score: Optional[float] = None
    risk_factors: Optional[str] = None
    protective_factors: Optional[str] = None
    risk_level: Optional[RiskLevel] = None


class SupplementRequest(BaseModel):
    reason: str
    required_items: List[str]


class SupervisionFeedbackCreate(BaseModel):
    overall_assessment: str
    strengths: Optional[str] = None
    areas_for_improvement: Optional[str] = None
    ethical_considerations: Optional[str] = None
    legal_implications: Optional[str] = None
    specific_recommendations: Optional[str] = None
    follow_up_requirements: Optional[str] = None


class CrisisEscalationCreate(BaseModel):
    trigger_event: str
    immediate_actions_taken: str
    parties_notified: Optional[str] = None
    crisis_level: Optional[str] = None
    safety_plan_activated: bool = False
    emergency_contacts_informed: bool = False


class ArchiveRequest(BaseModel):
    reason: str


@router.post("/counselors/", response_model=Dict[str, Any])
def create_counselor(counselor: CounselorCreate, db: Session = Depends(get_db)):
    existing = db.query(Counselor).filter(
        Counselor.employee_id == counselor.employee_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="员工号已存在")
    
    db_counselor = Counselor(**counselor.model_dump())
    db.add(db_counselor)
    db.commit()
    db.refresh(db_counselor)
    
    return {
        "success": True,
        "counselor": {
            "id": db_counselor.id,
            "name": db_counselor.name,
            "employee_id": db_counselor.employee_id,
            "department": db_counselor.department
        }
    }


@router.get("/counselors/", response_model=Dict[str, Any])
def list_counselors(skip: int = 0, limit: int = 100, db: Session = Depends(get_db)):
    counselors = db.query(Counselor).offset(skip).limit(limit).all()
    return {
        "success": True,
        "count": len(counselors),
        "counselors": [
            {
                "id": c.id,
                "name": c.name,
                "employee_id": c.employee_id,
                "department": c.department,
                "is_active": bool(c.is_active)
            }
            for c in counselors
        ]
    }


@router.post("/cases/", response_model=Dict[str, Any])
def create_case(case_data: CaseCreate, counselor_id: int = Query(..., description="咨询师ID"),
                db: Session = Depends(get_db)):
    counselor = db.query(Counselor).filter(Counselor.id == counselor_id).first()
    if not counselor:
        raise HTTPException(status_code=404, detail="咨询师不存在")
    
    service = CaseService(db)
    case = service.create_case(counselor_id, case_data.model_dump())
    
    return {
        "success": True,
        "case": {
            "id": case.id,
            "case_number": case.case_number,
            "status": case.status,
            "risk_level": case.risk_level,
            "created_at": case.created_at.isoformat() if case.created_at else None
        }
    }


@router.get("/cases/", response_model=Dict[str, Any])
def list_cases(
    status: Optional[CaseStatus] = None,
    risk_level: Optional[RiskLevel] = None,
    counselor_id: Optional[int] = None,
    skip: int = 0,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    query = db.query(Case)
    
    if status:
        query = query.filter(Case.status == status)
    if risk_level:
        query = query.filter(Case.risk_level == risk_level)
    if counselor_id:
        query = query.filter(Case.counselor_id == counselor_id)
    
    cases = query.order_by(Case.created_at.desc()).offset(skip).limit(limit).all()
    
    return {
        "success": True,
        "count": len(cases),
        "cases": [
            {
                "id": c.id,
                "case_number": c.case_number,
                "status": c.status,
                "risk_level": c.risk_level,
                "counselor_id": c.counselor_id,
                "created_at": c.created_at.isoformat() if c.created_at else None,
                "updated_at": c.updated_at.isoformat() if c.updated_at else None
            }
            for c in cases
        ]
    }


@router.get("/cases/{case_id}", response_model=Dict[str, Any])
def get_case(case_id: int, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="案例不存在")
    
    counselor = None
    if case.counselor_id:
        counselor = db.query(Counselor).filter(Counselor.id == case.counselor_id).first()
    
    return {
        "success": True,
        "case": {
            "id": case.id,
            "case_number": case.case_number,
            "status": case.status,
            "risk_level": case.risk_level,
            "counselor": {
                "id": counselor.id if counselor else None,
                "name": counselor.name if counselor else None
            } if counselor else None,
            "presenting_problem": case.presenting_problem,
            "background_info": case.background_info,
            "assessment_process": case.assessment_process,
            "intervention_strategy": case.intervention_strategy,
            "scale_scores": {
                "SDS": case.sds_score,
                "SAS": case.sas_score,
                "SCL90": case.scl90_score,
                "GAD7": case.gad7_score,
                "PHQ9": case.phq9_score
            },
            "risk_factors": case.risk_factors,
            "protective_factors": case.protective_factors,
            "timestamps": {
                "created_at": case.created_at.isoformat() if case.created_at else None,
                "updated_at": case.updated_at.isoformat() if case.updated_at else None,
                "submitted_at": case.submitted_at.isoformat() if case.submitted_at else None,
                "reviewed_at": case.reviewed_at.isoformat() if case.reviewed_at else None,
                "archived_at": case.archived_at.isoformat() if case.archived_at else None
            }
        }
    }


@router.put("/cases/{case_id}", response_model=Dict[str, Any])
def update_case(case_id: int, case_data: CaseUpdate, db: Session = Depends(get_db)):
    case = db.query(Case).filter(Case.id == case_id).first()
    if not case:
        raise HTTPException(status_code=404, detail="案例不存在")
    
    if case.status != CaseStatus.DRAFT and case.status != CaseStatus.NEEDS_SUPPLEMENT:
        raise HTTPException(status_code=400, detail=f"当前状态 {case.status} 无法修改")
    
    update_data = case_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(case, key, value)
    
    case.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(case)
    
    return {
        "success": True,
        "case": {
            "id": case.id,
            "case_number": case.case_number,
            "status": case.status,
            "updated_at": case.updated_at.isoformat() if case.updated_at else None
        }
    }


@router.post("/cases/{case_id}/submit", response_model=Dict[str, Any])
def submit_case(case_id: int, counselor_id: int = Query(..., description="咨询师ID"),
                db: Session = Depends(get_db)):
    service = CaseService(db)
    try:
        result = service.submit_for_review(case_id, counselor_id)
        
        audit_service = AuditService(db)
        audit_service.log_action(
            action="提交督导",
            action_type="submit",
            case_id=case_id,
            counselor_id=counselor_id,
            old_value={"status": "草稿/需补充"},
            new_value={"status": "待督导"}
        )
        
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cases/{case_id}/supplement", response_model=Dict[str, Any])
def request_supplement(case_id: int, request: SupplementRequest,
                        supervisor_id: int = Query(..., description="督导者ID"),
                        db: Session = Depends(get_db)):
    service = CaseService(db)
    try:
        result = service.request_supplement(
            case_id, supervisor_id, request.reason, request.required_items
        )
        
        audit_service = AuditService(db)
        audit_service.log_action(
            action="要求补充资料",
            action_type="supplement",
            case_id=case_id,
            counselor_id=supervisor_id,
            old_value={"status": "待督导"},
            new_value={"status": "需补充", "reason": request.reason}
        )
        
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cases/{case_id}/review", response_model=Dict[str, Any])
def complete_review(case_id: int, feedback: SupervisionFeedbackCreate,
                    supervisor_id: int = Query(..., description="督导者ID"),
                    db: Session = Depends(get_db)):
    service = CaseService(db)
    try:
        result = service.complete_review(
            case_id, supervisor_id, feedback.model_dump()
        )
        
        audit_service = AuditService(db)
        audit_service.log_action(
            action="完成督导",
            action_type="review",
            case_id=case_id,
            counselor_id=supervisor_id,
            old_value={"status": "待督导"},
            new_value={"status": "已督导"}
        )
        
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cases/{case_id}/crisis", response_model=Dict[str, Any])
def escalate_crisis(case_id: int, crisis_data: CrisisEscalationCreate,
                    escalated_by: int = Query(..., description="升级人ID"),
                    db: Session = Depends(get_db)):
    service = CaseService(db)
    try:
        crisis_dict = crisis_data.model_dump()
        crisis_dict["safety_plan_activated"] = 1 if crisis_dict["safety_plan_activated"] else 0
        crisis_dict["emergency_contacts_informed"] = 1 if crisis_dict["emergency_contacts_informed"] else 0
        
        result = service.escalate_crisis(case_id, escalated_by, crisis_dict)
        
        audit_service = AuditService(db)
        audit_service.log_action(
            action="危机升级",
            action_type="crisis",
            case_id=case_id,
            counselor_id=escalated_by,
            old_value={"risk_level": "原风险等级"},
            new_value={"risk_level": "危机", "trigger": crisis_data.trigger_event}
        )
        
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/cases/{case_id}/archive", response_model=Dict[str, Any])
def archive_case(case_id: int, archive_request: ArchiveRequest,
                 archived_by: int = Query(..., description="归档人ID"),
                 db: Session = Depends(get_db)):
    service = CaseService(db)
    try:
        result = service.archive_case(case_id, archived_by, archive_request.reason)
        
        if result["success"]:
            audit_service = AuditService(db)
            audit_service.log_action(
                action="归档案例",
                action_type="archive",
                case_id=case_id,
                counselor_id=archived_by,
                old_value={"status": "原状态"},
                new_value={"status": "已归档", "reason": archive_request.reason}
            )
        
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.get("/cases/{case_id}/history", response_model=Dict[str, Any])
def get_case_history(case_id: int, db: Session = Depends(get_db)):
    service = CaseService(db)
    try:
        history = service.get_case_history(case_id)
        
        return {
            "success": True,
            "case_number": history["case"].case_number,
            "current_status": history["case"].status,
            "status_transitions": [
                {
                    "id": t.id,
                    "from_status": t.from_status,
                    "to_status": t.to_status,
                    "transition_date": t.transition_date.isoformat() if t.transition_date else None,
                    "reason": t.reason
                }
                for t in history["status_transitions"]
            ],
            "desensitized_versions": [
                {
                    "id": v.id,
                    "version_number": v.version_number,
                    "created_at": v.created_at.isoformat() if v.created_at else None,
                    "desensitization_check_passed": bool(v.desensitization_check_passed)
                }
                for v in history["desensitized_versions"]
            ],
            "risk_assessments": [
                {
                    "id": a.id,
                    "assessment_version": a.assessment_version,
                    "risk_level": a.risk_level,
                    "assessment_date": a.assessment_date.isoformat() if a.assessment_date else None
                }
                for a in history["risk_assessments"]
            ],
            "supervision_feedbacks": [
                {
                    "id": f.id,
                    "feedback_version": f.feedback_version,
                    "feedback_date": f.feedback_date.isoformat() if f.feedback_date else None
                }
                for f in history["supervision_feedbacks"]
            ],
            "crisis_escalations": [
                {
                    "id": e.id,
                    "escalation_number": e.escalation_number,
                    "escalation_date": e.escalation_date.isoformat() if e.escalation_date else None,
                    "is_resolved": bool(e.is_resolved)
                }
                for e in history["crisis_escalations"]
            ]
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/import/csv", response_model=Dict[str, Any])
async def import_csv(counselor_id: int = Query(..., description="咨询师ID"),
                     file: UploadFile = File(...),
                     db: Session = Depends(get_db)):
    if not file.filename.endswith('.csv'):
        raise HTTPException(status_code=400, detail="只支持CSV文件")
    
    content = await file.read()
    csv_content = content.decode('utf-8')
    
    importer = CSVImporter(db)
    result = importer.import_cases_from_csv(csv_content, counselor_id)
    
    audit_service = AuditService(db)
    audit_service.log_action(
        action=f"导入CSV: {file.filename}",
        action_type="import",
        counselor_id=counselor_id,
        old_value=None,
        new_value={"imported_count": result.get("imported_count", 0)}
    )
    
    return result


@router.get("/export/markdown/{case_id}", response_class=PlainTextResponse)
def export_markdown(case_id: int, db: Session = Depends(get_db)):
    exporter = MarkdownExporter(db)
    try:
        markdown_content = exporter.export_supervision_notes(case_id)
        
        audit_service = AuditService(db)
        audit_service.log_action(
            action="导出Markdown督导纪要",
            action_type="export",
            case_id=case_id
        )
        
        return PlainTextResponse(
            content=markdown_content,
            media_type="text/markdown",
            headers={"Content-Disposition": f"attachment; filename=case_{case_id}_supervision.md"}
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/export/json/{case_id}")
def export_json(case_id: int, db: Session = Depends(get_db)):
    exporter = JSONExporter(db)
    try:
        json_content = exporter.export_case_json(case_id)
        
        audit_service = AuditService(db)
        audit_service.log_action(
            action="导出JSON案例数据",
            action_type="export",
            case_id=case_id
        )
        
        return JSONResponse(
            content=json_content,
            headers={"Content-Disposition": f"attachment; filename=case_{case_id}.json"}
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.get("/audit/logs", response_model=Dict[str, Any])
def get_audit_logs(
    case_id: Optional[int] = None,
    counselor_id: Optional[int] = None,
    action_type: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    limit: int = 100,
    db: Session = Depends(get_db)
):
    audit_service = AuditService(db)
    
    start_dt = None
    end_dt = None
    
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="无效的开始日期格式")
    
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="无效的结束日期格式")
    
    logs = audit_service.get_all_audit_logs(start_dt, end_dt, limit)
    
    if case_id:
        logs = [log for log in logs if log.get("case_id") == case_id]
    if counselor_id:
        logs = [log for log in logs if log.get("counselor_id") == counselor_id]
    if action_type:
        logs = [log for log in logs if log.get("action_type") == action_type]
    
    return {
        "success": True,
        "count": len(logs),
        "logs": logs
    }


@router.get("/audit/export", response_model=Dict[str, Any])
def export_audit_package(
    case_id: Optional[int] = None,
    counselor_id: Optional[int] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    db: Session = Depends(get_db)
):
    audit_service = AuditService(db)
    
    start_dt = None
    end_dt = None
    
    if start_date:
        try:
            start_dt = datetime.fromisoformat(start_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="无效的开始日期格式")
    
    if end_date:
        try:
            end_dt = datetime.fromisoformat(end_date)
        except ValueError:
            raise HTTPException(status_code=400, detail="无效的结束日期格式")
    
    package = audit_service.export_audit_package(
        case_id=case_id,
        counselor_id=counselor_id,
        start_date=start_dt,
        end_date=end_dt
    )
    
    return JSONResponse(
        content=package,
        headers={"Content-Disposition": "attachment; filename=audit_package.json"}
    )


@router.post("/validate/desensitization", response_model=Dict[str, Any])
def validate_desensitization(text: str, db: Session = Depends(get_db)):
    passed, sensitive = desensitization_engine.check_text(text)
    
    return {
        "success": True,
        "validation_result": {
            "passed": passed,
            "sensitive_items": sensitive,
            "message": "脱敏检查通过" if passed else f"发现 {len(sensitive)} 处敏感信息"
        }
    }


@router.post("/validate/scale", response_model=Dict[str, Any])
def validate_scale(scores: Dict[str, float], db: Session = Depends(get_db)):
    passed, results = scale_validator.validate_all_scores(scores)
    
    return {
        "success": True,
        "validation_result": {
            "passed": passed,
            "scale_results": results
        }
    }


@router.get("/status/valid-transitions/{current_status}", response_model=Dict[str, Any])
def get_valid_transitions(current_status: CaseStatus):
    from services import state_machine
    
    valid_transitions = state_machine.get_valid_transitions(current_status)
    
    return {
        "success": True,
        "current_status": current_status,
        "valid_transitions": [t.value for t in valid_transitions]
    }
