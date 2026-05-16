from datetime import datetime
from typing import Optional, List, Dict, Any, Tuple
import hashlib

from models import (
    ResidencyApproval, ResidencyReport, Tenant, Region,
    ApprovalStatus, DataType, RegionRuleStatus,
    BlockReason, ApprovalComment
)
from storage import store


class ResidencyApprovalService:
    def __init__(self):
        self._init_sample_regions()
    
    def _init_sample_regions(self):
        existing_regions = store.list_regions()
        if not existing_regions:
            sample_regions = [
                Region(
                    code="cn-north",
                    name="中国华北",
                    requires_data_residency=True,
                    allowed_data_types=[
                        DataType.USER_DATA, DataType.TRANSACTION_DATA,
                        DataType.METADATA, DataType.LOG_DATA
                    ],
                    blocked_data_types=[DataType.ANALYTICS_DATA]
                ),
                Region(
                    code="cn-south",
                    name="中国华南",
                    requires_data_residency=True,
                    allowed_data_types=[
                        DataType.USER_DATA, DataType.TRANSACTION_DATA,
                        DataType.METADATA, DataType.LOG_DATA, DataType.ANALYTICS_DATA
                    ],
                    blocked_data_types=[]
                ),
                Region(
                    code="us-west",
                    name="美国西部",
                    requires_data_residency=False,
                    allowed_data_types=[
                        DataType.USER_DATA, DataType.TRANSACTION_DATA,
                        DataType.METADATA, DataType.LOG_DATA, DataType.ANALYTICS_DATA
                    ],
                    blocked_data_types=[]
                ),
                Region(
                    code="eu-central",
                    name="欧盟中部",
                    requires_data_residency=True,
                    allowed_data_types=[
                        DataType.METADATA, DataType.LOG_DATA
                    ],
                    blocked_data_types=[DataType.USER_DATA, DataType.TRANSACTION_DATA, DataType.ANALYTICS_DATA]
                )
            ]
            for region in sample_regions:
                store.save_region(region)
    
    def _generate_idempotency_key(self, tenant_id: str, target_region: str, data_types: List[DataType]) -> str:
        key_str = f"{tenant_id}:{target_region}:{sorted([dt.value for dt in data_types])}"
        return hashlib.md5(key_str.encode()).hexdigest()
    
    def check_idempotency(self, tenant_id: str, target_region: str, data_types: List[DataType]) -> Optional[ResidencyApproval]:
        existing = store.get_approval_by_tenant_and_region(tenant_id, target_region)
        if existing:
            existing_types = sorted([dt.value for dt in existing.data_types])
            new_types = sorted([dt.value for dt in data_types])
            if existing_types == new_types:
                return existing
        return None
    
    def validate_region_rules(self, region: Region, data_types: List[DataType]) -> Tuple[RegionRuleStatus, List[BlockReason]]:
        block_reasons = []
        status = RegionRuleStatus.COMPLIANT
        
        if region.requires_data_residency:
            for data_type in data_types:
                if data_type in region.blocked_data_types:
                    status = RegionRuleStatus.NON_COMPLIANT
                    block_reasons.append(BlockReason(
                        reason_id=store.get_next_block_reason_id(),
                        category="data_type_restriction",
                        description=f"数据类型 '{data_type.value}' 在区域 '{region.name}' 被禁止驻留",
                        severity="high",
                        resolution_hint=f"请选择该区域允许的数据类型，或更换其他区域"
                    ))
                elif data_type not in region.allowed_data_types:
                    if status != RegionRuleStatus.NON_COMPLIANT:
                        status = RegionRuleStatus.NEEDS_REVIEW
                    block_reasons.append(BlockReason(
                        reason_id=store.get_next_block_reason_id(),
                        category="data_type_needs_review",
                        description=f"数据类型 '{data_type.value}' 在区域 '{region.name}' 需要人工复核",
                        severity="medium",
                        resolution_hint=f"请提交审批材料供合规团队审核"
                    ))
        
        return status, block_reasons
    
    def create_approval(self, tenant_id: str, target_region: str, data_types: List[DataType],
                       original_request: Dict[str, Any]) -> Tuple[ResidencyApproval, bool]:
        idempotent_approval = self.check_idempotency(tenant_id, target_region, data_types)
        if idempotent_approval:
            return idempotent_approval, False
        
        region = store.get_region(target_region)
        if not region:
            region = Region(
                code=target_region,
                name=f"未知区域({target_region})",
                requires_data_residency=True
            )
        
        region_status, block_reasons = self.validate_region_rules(region, data_types)
        
        if region_status == RegionRuleStatus.NON_COMPLIANT:
            status = ApprovalStatus.BLOCKED
        elif region_status == RegionRuleStatus.NEEDS_REVIEW:
            status = ApprovalStatus.PENDING_REVIEW
        else:
            status = ApprovalStatus.SUCCESS
        
        approval = ResidencyApproval(
            approval_id=store.get_next_approval_id(),
            tenant_id=tenant_id,
            target_region=target_region,
            data_types=data_types,
            status=status,
            original_request=original_request,
            block_reasons=block_reasons,
            region_check_result=region_status,
            processing_result={
                "region_check": region_status.value,
                "block_count": len(block_reasons),
                "timestamp": datetime.now().isoformat()
            }
        )
        
        store.save_approval(approval)
        return approval, True
    
    def advance_status(self, approval_id: str, new_status: ApprovalStatus,
                      reviewer: str, comment: str = "") -> Optional[ResidencyApproval]:
        approval = store.get_approval(approval_id)
        if not approval:
            return None
        
        old_status = approval.status
        approval.status = new_status
        approval.updated_at = datetime.now()
        
        if new_status == ApprovalStatus.COMPENSATED:
            approval.is_compensated = True
            approval.compensation_note = comment
        
        approval_comment = ApprovalComment(
            comment_id=store.get_next_comment_id(),
            reviewer=reviewer,
            comment=comment,
            status_before=old_status,
            status_after=new_status
        )
        approval.comments.append(approval_comment)
        
        store.save_approval(approval)
        return approval
    
    def manual_correct(self, approval_id: str, corrections: Dict[str, Any],
                      reviewer: str, comment: str) -> Optional[ResidencyApproval]:
        approval = store.get_approval(approval_id)
        if not approval:
            return None
        
        old_status = approval.status
        
        if "data_types" in corrections:
            approval.data_types = [DataType(dt) for dt in corrections["data_types"]]
        if "target_region" in corrections:
            approval.target_region = corrections["target_region"]
        if "block_reasons" in corrections:
            approval.block_reasons = [BlockReason(**br) for br in corrections["block_reasons"]]
        if "status" in corrections:
            approval.status = ApprovalStatus(corrections["status"])
        
        approval.updated_at = datetime.now()
        approval.processing_result = {
            "manual_correction": True,
            "corrections": corrections,
            "reviewer": reviewer,
            "timestamp": datetime.now().isoformat()
        }
        
        approval_comment = ApprovalComment(
            comment_id=store.get_next_comment_id(),
            reviewer=reviewer,
            comment=f"人工修正: {comment}",
            status_before=old_status,
            status_after=approval.status
        )
        approval.comments.append(approval_comment)
        
        store.save_approval(approval)
        return approval
    
    def get_approval(self, approval_id: str) -> Optional[ResidencyApproval]:
        return store.get_approval(approval_id)
    
    def list_approvals(self, tenant_id: Optional[str] = None, status: Optional[str] = None) -> List[ResidencyApproval]:
        return store.list_approvals(tenant_id, status)
    
    def generate_report(self, approval_id: str) -> Optional[ResidencyReport]:
        approval = store.get_approval(approval_id)
        if not approval:
            return None
        
        compliance_summary = {
            "region_check_result": approval.region_check_result.value,
            "is_compliant": approval.status == ApprovalStatus.SUCCESS,
            "has_block_reasons": len(approval.block_reasons) > 0,
            "block_reason_count": len(approval.block_reasons),
            "requires_manual_review": approval.status == ApprovalStatus.PENDING_REVIEW
        }
        
        recommendations = []
        if approval.status == ApprovalStatus.BLOCKED:
            recommendations.append("建议更换数据驻留区域或调整需驻留的数据类型")
            for br in approval.block_reasons:
                if br.resolution_hint:
                    recommendations.append(br.resolution_hint)
        elif approval.status == ApprovalStatus.PENDING_REVIEW:
            recommendations.append("请等待合规团队人工复核")
        elif approval.status == ApprovalStatus.SUCCESS:
            recommendations.append("可正常进行区域部署")
        
        report = ResidencyReport(
            report_id=store.get_next_report_id(),
            approval_id=approval.approval_id,
            tenant_id=approval.tenant_id,
            target_region=approval.target_region,
            overall_status=approval.status,
            compliance_summary=compliance_summary,
            data_types_verified=approval.data_types,
            block_reasons=approval.block_reasons,
            recommendations=recommendations,
            export_format="json"
        )
        
        store.save_report(report)
        return report
    
    def get_report(self, report_id: str) -> Optional[ResidencyReport]:
        return store.get_report(report_id)
    
    def list_reports(self, approval_id: Optional[str] = None) -> List[ResidencyReport]:
        return store.list_reports(approval_id)


service = ResidencyApprovalService()
