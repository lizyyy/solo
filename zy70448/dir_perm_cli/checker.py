import uuid
from typing import List, Dict, Any, Tuple, Optional
from .models import (
    SubmissionMaterial,
    DriftConclusion,
    CheckResult,
    CheckStatus,
    ApprovalStatus,
    DevicePermissionItem,
    ApprovalNode
)


class PermissionDriftChecker:
    def __init__(self):
        self.check_rules = [
            self._check_required_fields,
            self._check_permission_target_format,
            self._check_approval_chain_completeness,
            self._check_null_value_trap,
            self._check_meeting_attachment_consistency,
        ]
    
    def check(self, material: SubmissionMaterial) -> DriftConclusion:
        check_results = []
        
        for rule in self.check_rules:
            result = rule(material)
            check_results.append(result)
        
        overall_status = self._calculate_overall_status(check_results)
        
        conclusion = DriftConclusion(
            conclusion_id=f"CON{uuid.uuid4().hex[:12]}",
            submission_id=material.submission_id,
            batch_id=material.batch_id,
            overall_status=overall_status,
            check_results=check_results
        )
        
        return conclusion
    
    def _calculate_overall_status(self, results: List[CheckResult]) -> CheckStatus:
        has_fail = any(r.status == CheckStatus.FAIL for r in results)
        has_warning = any(r.status == CheckStatus.WARNING for r in results)
        
        if has_fail:
            return CheckStatus.FAIL
        elif has_warning:
            return CheckStatus.WARNING
        else:
            return CheckStatus.PASS
    
    def _check_required_fields(self, material: SubmissionMaterial) -> CheckResult:
        missing_fields = []
        affected_items = []
        
        for idx, item in enumerate(material.permission_items):
            item_missing = []
            if not item.device_id:
                item_missing.append("device_id")
            if not item.device_name:
                item_missing.append("device_name")
            if not item.store_name:
                item_missing.append("store_name")
            if not item.permission_type:
                item_missing.append("permission_type")
            if not item.permission_target:
                item_missing.append("permission_target")
            if not item.applicant:
                item_missing.append("applicant")
            if not item.application_reason:
                item_missing.append("application_reason")
            
            if item_missing:
                missing_fields.append(f"设备{item.device_id or idx}: {', '.join(item_missing)}")
                affected_items.append(item.device_id or f"item_{idx}")
        
        if missing_fields:
            return CheckResult(
                check_id="R001",
                check_name="必填字段校验",
                status=CheckStatus.FAIL,
                message=f"发现 {len(missing_fields)} 项必填字段缺失",
                details={"missing_fields": missing_fields},
                affected_items=affected_items
            )
        
        return CheckResult(
            check_id="R001",
            check_name="必填字段校验",
            status=CheckStatus.PASS,
            message="所有必填字段均已填写"
        )
    
    def _check_permission_target_format(self, material: SubmissionMaterial) -> CheckResult:
        invalid_targets = []
        affected_items = []
        
        valid_prefixes = ["//", "/", "\\\\", "\\"]
        
        for idx, item in enumerate(material.permission_items):
            target = item.permission_target
            if not target:
                continue
            
            has_valid_prefix = any(target.startswith(prefix) for prefix in valid_prefixes)
            if not has_valid_prefix:
                invalid_targets.append(f"设备{item.device_id}: '{target}' 格式不正确")
                affected_items.append(item.device_id)
        
        if invalid_targets:
            return CheckResult(
                check_id="R002",
                check_name="权限路径格式校验",
                status=CheckStatus.WARNING,
                message=f"发现 {len(invalid_targets)} 项权限路径格式可能不正确",
                details={"invalid_targets": invalid_targets},
                affected_items=affected_items
            )
        
        return CheckResult(
            check_id="R002",
            check_name="权限路径格式校验",
            status=CheckStatus.PASS,
            message="所有权限路径格式均符合规范"
        )
    
    def _check_approval_chain_completeness(self, material: SubmissionMaterial) -> CheckResult:
        incomplete_nodes = []
        affected_items = []
        
        for idx, node in enumerate(material.approval_nodes):
            if node.status == ApprovalStatus.APPROVED:
                if not node.approver:
                    incomplete_nodes.append(f"节点{node.node_id}: 已批准但缺少审批人")
                    affected_items.append(node.node_id)
                if not node.approved_at:
                    incomplete_nodes.append(f"节点{node.node_id}: 已批准但缺少审批时间")
                    affected_items.append(node.node_id)
        
        if incomplete_nodes:
            return CheckResult(
                check_id="R003",
                check_name="审批链完整性校验",
                status=CheckStatus.FAIL,
                message=f"发现 {len(incomplete_nodes)} 项审批节点信息不完整",
                details={"incomplete_nodes": incomplete_nodes},
                affected_items=affected_items
            )
        
        return CheckResult(
            check_id="R003",
            check_name="审批链完整性校验",
            status=CheckStatus.PASS,
            message="审批链完整"
        )
    
    def _check_null_value_trap(self, material: SubmissionMaterial) -> CheckResult:
        null_success_issues = []
        affected_items = []
        
        for idx, node in enumerate(material.approval_nodes):
            if node.status == ApprovalStatus.APPROVED:
                all_empty = (
                    node.approver in [None, ""] and
                    node.comment in [None, ""] and
                    node.approved_at is None
                )
                
                if all_empty:
                    null_success_issues.append(
                        f"节点{node.node_id}({node.node_name}): 状态标记为已批准，但所有审批字段均为空值 - "
                        f"这是空值被误判为成功的典型漂移场景！"
                    )
                    affected_items.append(node.node_id)
        
        for idx, item in enumerate(material.permission_items):
            if item.permission_target in [None, ""] and item.application_reason not in [None, ""]:
                null_success_issues.append(
                    f"设备{item.device_id}: permission_target为空但申请原因已填写 - "
                    f"可能存在空值路径被默认为允许访问的权限漂移风险"
                )
                affected_items.append(item.device_id)
        
        if null_success_issues:
            return CheckResult(
                check_id="R004",
                check_name="空值成功陷阱检测",
                status=CheckStatus.FAIL,
                message=f"检测到 {len(null_success_issues)} 项空值被误判为成功的权限漂移风险",
                details={"issues": null_success_issues},
                affected_items=affected_items
            )
        
        return CheckResult(
            check_id="R004",
            check_name="空值成功陷阱检测",
            status=CheckStatus.PASS,
            message="未检测到空值成功陷阱"
        )
    
    def _check_meeting_attachment_consistency(self, material: SubmissionMaterial) -> CheckResult:
        consistency_issues = []
        affected_items = []
        
        for idx, att in enumerate(material.meeting_attachments):
            if att.content_before and att.content_after:
                if att.content_before == att.content_after:
                    consistency_issues.append(
                        f"附件{att.file_name}: 修改前后内容完全一致，可能存在虚假修改记录"
                    )
                    affected_items.append(att.file_name)
            
            if att.content_after and not att.modification_note:
                consistency_issues.append(
                    f"附件{att.file_name}: 有修改后内容但缺少修改说明"
                )
                affected_items.append(att.file_name)
        
        if consistency_issues:
            return CheckResult(
                check_id="R005",
                check_name="会议纪要一致性校验",
                status=CheckStatus.WARNING,
                message=f"发现 {len(consistency_issues)} 项会议纪要一致性问题",
                details={"issues": consistency_issues},
                affected_items=affected_items
            )
        
        return CheckResult(
            check_id="R005",
            check_name="会议纪要一致性校验",
            status=CheckStatus.PASS,
            message="会议纪要内容一致"
        )
