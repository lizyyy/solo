from sqlalchemy.orm import Session
from datetime import datetime
import uuid
from typing import Optional, List, Tuple
from .models import (
    Tenant, RegionRule, DataResidencyApproval, ResidencyReport,
    ApprovalStatus, RegionRuleStatus, BlockReasonCategory
)
from .schemas import (
    ApprovalSubmitRequest, ApprovalReviewRequest,
    RegionValidationResult, ApprovalFilterRequest,
    TenantCreate, RegionRuleCreate
)

class ApprovalService:
    def __init__(self, db: Session):
        self.db = db

    def validate_region_rule(self, target_region: str, data_type: str) -> RegionValidationResult:
        rule = self.db.query(RegionRule).filter(
            RegionRule.region_code == target_region,
            RegionRule.data_type == data_type,
            RegionRule.status == RegionRuleStatus.ACTIVE
        ).first()

        if not rule:
            return RegionValidationResult(
                is_valid=False,
                requires_approval=True,
                allow_cross_border=False,
                message=f"No active rule found for region {target_region} and data type {data_type}",
                risk_level="HIGH"
            )

        risk_level = "LOW"
        if not rule.allow_cross_border:
            risk_level = "MEDIUM"
        if rule.requires_approval:
            risk_level = "HIGH"

        return RegionValidationResult(
            is_valid=True,
            requires_approval=rule.requires_approval,
            allow_cross_border=rule.allow_cross_border,
            message=f"Validated: region={target_region}, data_type={data_type}",
            risk_level=risk_level
        )

    def check_idempotency(self, idempotency_key: Optional[str]) -> Optional[DataResidencyApproval]:
        if not idempotency_key:
            return None
        return self.db.query(DataResidencyApproval).filter(
            DataResidencyApproval.idempotency_key == idempotency_key
        ).first()

    def submit_approval(self, request: ApprovalSubmitRequest) -> Tuple[Optional[DataResidencyApproval], Optional[str], Optional[str]]:
        existing_approval = self.check_idempotency(request.idempotency_key)
        if existing_approval:
            return existing_approval, None, "ALREADY_PROCESSED"

        tenant = self.db.query(Tenant).filter(Tenant.tenant_id == request.tenant_id).first()
        if not tenant:
            return None, "TENANT_NOT_FOUND", None

        validation_result = self.validate_region_rule(request.target_region, request.data_type)
        if not validation_result.is_valid:
            return None, "REGION_RULE_NOT_FOUND", None

        initial_status = ApprovalStatus.PENDING
        if validation_result.risk_level == "HIGH":
            initial_status = ApprovalStatus.NEEDS_REVIEW

        approval = DataResidencyApproval(
            request_id=request.request_id,
            tenant_id=request.tenant_id,
            target_region=request.target_region,
            data_type=request.data_type,
            data_volume_gb=request.data_volume_gb,
            status=initial_status,
            idempotency_key=request.idempotency_key
        )

        self.db.add(approval)
        self.db.commit()
        self.db.refresh(approval)

        return approval, None, None

    def review_approval(self, request_id: str, review: ApprovalReviewRequest) -> Tuple[Optional[DataResidencyApproval], Optional[str], Optional[str]]:
        approval = self.db.query(DataResidencyApproval).filter(
            DataResidencyApproval.request_id == request_id
        ).first()

        if not approval:
            return None, "APPROVAL_NOT_FOUND", None

        if approval.status in [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED]:
            return approval, None, "ALREADY_PROCESSED"

        if review.status == ApprovalStatus.BLOCKED and not review.block_reason:
            return None, "MISSING_FIELD", None

        if review.status == ApprovalStatus.APPROVED and approval.status != ApprovalStatus.PENDING:
            return None, "INVALID_STATUS", None

        approval.status = review.status
        approval.approver = review.approver
        approval.approval_comment = review.approval_comment
        approval.reviewed_at = datetime.utcnow()

        if review.status == ApprovalStatus.BLOCKED:
            approval.block_reason = review.block_reason
            approval.block_category = review.block_category

        if review.status in [ApprovalStatus.APPROVED, ApprovalStatus.REJECTED, ApprovalStatus.BLOCKED]:
            approval.completed_at = datetime.utcnow()

        self.db.commit()
        self.db.refresh(approval)

        return approval, None, None

    def get_block_reason_categories(self) -> List[str]:
        return [category.value for category in BlockReasonCategory]

    def filter_approvals(self, filter_request: ApprovalFilterRequest, page: int = 1, page_size: int = 20) -> Tuple[List[DataResidencyApproval], int]:
        query = self.db.query(DataResidencyApproval)

        if filter_request.tenant_id:
            query = query.filter(DataResidencyApproval.tenant_id == filter_request.tenant_id)
        if filter_request.target_region:
            query = query.filter(DataResidencyApproval.target_region == filter_request.target_region)
        if filter_request.data_type:
            query = query.filter(DataResidencyApproval.data_type == filter_request.data_type)
        if filter_request.status:
            query = query.filter(DataResidencyApproval.status == filter_request.status)
        if filter_request.start_date:
            query = query.filter(DataResidencyApproval.submitted_at >= filter_request.start_date)
        if filter_request.end_date:
            query = query.filter(DataResidencyApproval.submitted_at <= filter_request.end_date)

        total = query.count()
        items = query.order_by(DataResidencyApproval.submitted_at.desc()) \
            .offset((page - 1) * page_size) \
            .limit(page_size) \
            .all()

        return items, total

    def get_approval_by_request_id(self, request_id: str) -> Optional[DataResidencyApproval]:
        return self.db.query(DataResidencyApproval).filter(
            DataResidencyApproval.request_id == request_id
        ).first()

class ReportService:
    def __init__(self, db: Session):
        self.db = db

    def generate_report(self, approval_id: int, generated_by: str) -> Tuple[Optional[ResidencyReport], Optional[str]]:
        approval = self.db.query(DataResidencyApproval).filter(
            DataResidencyApproval.id == approval_id
        ).first()

        if not approval:
            return None, "APPROVAL_NOT_FOUND"

        existing_report = self.db.query(ResidencyReport).filter(
            ResidencyReport.approval_id == approval_id
        ).first()

        if existing_report:
            return existing_report, None

        report_content = self._build_report_content(approval)

        report = ResidencyReport(
            report_id=f"RPT-{uuid.uuid4().hex[:8].upper()}",
            approval_id=approval_id,
            report_content=report_content,
            generated_by=generated_by
        )

        self.db.add(report)
        self.db.commit()
        self.db.refresh(report)

        return report, None

    def _build_report_content(self, approval: DataResidencyApproval) -> str:
        lines = [
            "=" * 60,
            "DATA RESIDENCY APPROVAL REPORT",
            "=" * 60,
            "",
            f"Request ID: {approval.request_id}",
            f"Tenant ID: {approval.tenant_id}",
            f"Target Region: {approval.target_region}",
            f"Data Type: {approval.data_type}",
            f"Data Volume: {approval.data_volume_gb or 'N/A'} GB",
            f"Status: {approval.status.value}",
            "",
            "-" * 60,
            "TIMELINE",
            "-" * 60,
            f"Submitted: {approval.submitted_at}",
            f"Reviewed: {approval.reviewed_at or 'N/A'}",
            f"Completed: {approval.completed_at or 'N/A'}",
            "",
        ]

        if approval.approver:
            lines.extend([
                "-" * 60,
                "REVIEW DETAILS",
                "-" * 60,
                f"Approver: {approval.approver}",
                f"Comment: {approval.approval_comment or 'N/A'}",
                "",
            ])

        if approval.block_reason:
            lines.extend([
                "-" * 60,
                "BLOCK DETAILS",
                "-" * 60,
                f"Block Category: {approval.block_category.value if approval.block_category else 'N/A'}",
                f"Block Reason: {approval.block_reason}",
                "",
            ])

        lines.extend([
            "=" * 60,
            "END OF REPORT",
            "=" * 60,
        ])

        return "\n".join(lines)

    def get_report_by_id(self, report_id: str) -> Optional[ResidencyReport]:
        return self.db.query(ResidencyReport).filter(
            ResidencyReport.report_id == report_id
        ).first()

class TenantService:
    def __init__(self, db: Session):
        self.db = db

    def create_tenant(self, tenant_data: TenantCreate) -> Tenant:
        tenant = Tenant(
            tenant_id=tenant_data.tenant_id,
            tenant_name=tenant_data.tenant_name,
            industry=tenant_data.industry,
            region=tenant_data.region
        )
        self.db.add(tenant)
        self.db.commit()
        self.db.refresh(tenant)
        return tenant

    def get_tenant(self, tenant_id: str) -> Optional[Tenant]:
        return self.db.query(Tenant).filter(Tenant.tenant_id == tenant_id).first()

class RegionRuleService:
    def __init__(self, db: Session):
        self.db = db

    def create_rule(self, rule_data: RegionRuleCreate) -> RegionRule:
        rule = RegionRule(
            region_code=rule_data.region_code,
            region_name=rule_data.region_name,
            data_type=rule_data.data_type,
            requires_approval=rule_data.requires_approval,
            allow_cross_border=rule_data.allow_cross_border,
            max_retention_days=rule_data.max_retention_days
        )
        self.db.add(rule)
        self.db.commit()
        self.db.refresh(rule)
        return rule

    def get_rules_by_region(self, region_code: str) -> List[RegionRule]:
        return self.db.query(RegionRule).filter(
            RegionRule.region_code == region_code,
            RegionRule.status == RegionRuleStatus.ACTIVE
        ).all()
