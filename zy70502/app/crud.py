from typing import List, Optional
from datetime import datetime, timedelta
from sqlalchemy.orm import Session
from app.models import ContractChange, VerdictStatus, VerdictReport, RiskLevel, ChangeCategory
from app.schemas import ContractChangeCreate, ManualCorrectionRequest, DeferralRequest
from app.services import ContractDiffAnalyzer, RiskEngine, ChangeHistoryService, VerdictReportGenerator


def create_contract_change(db: Session, change: ContractChangeCreate) -> ContractChange:
    raw_input = change.dict()
    db_change = ContractChange(
        api_path=change.api_path,
        http_method=change.http_method.upper(),
        old_contract=change.old_contract,
        new_contract=change.new_contract,
        caller=change.caller,
        raw_input=raw_input,
        status=VerdictStatus.ANALYZING
    )
    db.add(db_change)
    db.commit()
    db.refresh(db_change)

    try:
        diff_summary = ContractDiffAnalyzer.analyze_diff(
            change.old_contract, change.new_contract
        )
        risk_level, opinion, category = RiskEngine.calculate_risk(diff_summary)

        db_change.diff_summary = diff_summary
        db_change.risk_level = risk_level
        db_change.verdict_opinion = opinion
        db_change.change_category = category
        db_change.status = VerdictStatus.AWAITING_CONFIRMATION
        db_change.processing_basis = (
            f"基于契约差异分析：检测到{len(diff_summary.get('breaking_changes', []))}项破坏性变更，"
            f"{len(diff_summary.get('compatible_changes', []))}项兼容变更，"
            f"{len(diff_summary.get('documentation_changes', []))}项文档变更"
        )
        db.commit()
        db.refresh(db_change)
    except Exception as e:
        db_change.status = VerdictStatus.CREATED
        db_change.error_message = str(e)
        db.commit()
        db.refresh(db_change)

    return db_change


def get_contract_change(db: Session, change_id: int) -> Optional[ContractChange]:
    return db.query(ContractChange).filter(ContractChange.id == change_id).first()


def get_contract_changes(
    db: Session,
    api_path: Optional[str] = None,
    http_method: Optional[str] = None,
    caller: Optional[str] = None,
    risk_level: Optional[RiskLevel] = None,
    status: Optional[VerdictStatus] = None,
    change_category: Optional[ChangeCategory] = None,
    skip: int = 0,
    limit: int = 20
) -> List[ContractChange]:
    query = db.query(ContractChange)

    if api_path:
        query = query.filter(ContractChange.api_path.contains(api_path))
    if http_method:
        query = query.filter(ContractChange.http_method == http_method.upper())
    if caller:
        query = query.filter(ContractChange.caller.contains(caller))
    if risk_level:
        query = query.filter(ContractChange.risk_level == risk_level)
    if status:
        query = query.filter(ContractChange.status == status)
    if change_category:
        query = query.filter(ContractChange.change_category == change_category)

    return query.order_by(ContractChange.created_at.desc()).offset(skip).limit(limit).all()


def count_contract_changes(
    db: Session,
    api_path: Optional[str] = None,
    http_method: Optional[str] = None,
    caller: Optional[str] = None,
    risk_level: Optional[RiskLevel] = None,
    status: Optional[VerdictStatus] = None,
    change_category: Optional[ChangeCategory] = None
) -> int:
    query = db.query(ContractChange)

    if api_path:
        query = query.filter(ContractChange.api_path.contains(api_path))
    if http_method:
        query = query.filter(ContractChange.http_method == http_method.upper())
    if caller:
        query = query.filter(ContractChange.caller.contains(caller))
    if risk_level:
        query = query.filter(ContractChange.risk_level == risk_level)
    if status:
        query = query.filter(ContractChange.status == status)
    if change_category:
        query = query.filter(ContractChange.change_category == change_category)

    return query.count()


def update_status(
    db: Session,
    change_id: int,
    new_status: VerdictStatus,
    reason: Optional[str] = None,
    updated_by: Optional[str] = None
) -> Optional[ContractChange]:
    db_change = get_contract_change(db, change_id)
    if not db_change:
        return None

    old_status = db_change.status
    db_change.status = new_status

    if new_status == VerdictStatus.CONFIRMED:
        db_change.confirmed_at = datetime.utcnow()
    elif new_status == VerdictStatus.COMPLETED:
        db_change.completed_at = datetime.utcnow()
        db_change.final_conclusion = reason or "流程完成"

    if updated_by:
        ChangeHistoryService.log_change(
            db, change_id, "status", old_status.value, new_status.value, updated_by, reason or "状态更新"
        )

    db.commit()
    db.refresh(db_change)
    return db_change


def apply_manual_correction(
    db: Session,
    change_id: int,
    request: ManualCorrectionRequest
) -> Optional[ContractChange]:
    db_change = get_contract_change(db, change_id)
    if not db_change:
        return None

    old_manual = db_change.manual_override or {}
    new_manual = old_manual.copy()

    if request.risk_level:
        old_risk = db_change.risk_level
        db_change.risk_level = request.risk_level
        new_manual["risk_level"] = request.risk_level.value
        ChangeHistoryService.log_change(
            db, change_id, "risk_level", old_risk.value, request.risk_level.value,
            request.corrected_by, request.reason
        )

    if request.verdict_opinion:
        old_opinion = db_change.verdict_opinion
        db_change.verdict_opinion = request.verdict_opinion
        new_manual["verdict_opinion"] = request.verdict_opinion
        ChangeHistoryService.log_change(
            db, change_id, "verdict_opinion", old_opinion, request.verdict_opinion,
            request.corrected_by, request.reason
        )

    if request.change_category:
        old_category = db_change.change_category
        db_change.change_category = request.change_category
        new_manual["change_category"] = request.change_category.value
        ChangeHistoryService.log_change(
            db, change_id, "change_category", old_category.value, request.change_category.value,
            request.corrected_by, request.reason
        )

    db_change.manual_override = new_manual
    db_change.status = VerdictStatus.APPEALED
    db.commit()
    db.refresh(db_change)

    try:
        diff_summary = ContractDiffAnalyzer.analyze_diff(
            db_change.old_contract, db_change.new_contract
        )
        risk_level, opinion, category = RiskEngine.calculate_risk(diff_summary)
        db_change.processing_basis = (
            f"人工修正后重新计算：原风险等级{old_risk.value if 'old_risk' in locals() else db_change.risk_level.value}，"
            f"新风险等级{risk_level.value}。修正原因：{request.reason}"
        )
        db.commit()
        db.refresh(db_change)
    except Exception as e:
        pass

    return db_change


def defer_verdict(
    db: Session,
    change_id: int,
    request: DeferralRequest
) -> Optional[ContractChange]:
    db_change = get_contract_change(db, change_id)
    if not db_change:
        return None

    db_change.status = VerdictStatus.DEFERRED
    db_change.deferral_reason = request.reason
    db_change.deferral_expiry = datetime.utcnow() + timedelta(days=request.expiry_days)

    ChangeHistoryService.log_change(
        db, change_id, "status", db_change.status.value, VerdictStatus.DEFERRED.value,
        request.requested_by, f"延期裁决：{request.reason}"
    )

    db.commit()
    db.refresh(db_change)
    return db_change


def generate_report(db: Session, change_id: int, report_type: str = "full") -> Optional[VerdictReport]:
    db_change = get_contract_change(db, change_id)
    if not db_change:
        return None

    report_content = VerdictReportGenerator.generate_report(db_change, report_type)

    db_report = VerdictReport(
        contract_change_id=change_id,
        report_type=report_type,
        content=report_content,
        generated_by="system"
    )
    db.add(db_report)
    db.commit()
    db.refresh(db_report)

    return db_report


def get_reports_by_change_id(db: Session, change_id: int) -> List[VerdictReport]:
    return db.query(VerdictReport).filter(VerdictReport.contract_change_id == change_id).order_by(VerdictReport.generated_at.desc()).all()
