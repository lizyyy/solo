from datetime import datetime
from typing import Dict, List, Optional
from uuid import uuid4

from models import InsertionApproval, ApprovalStatus, PaymentPlan, PaymentPlanStatus
from repositories import ApprovalRepository, PaymentPlanRepository


class ApprovalService:
    def __init__(
        self,
        approval_repo: ApprovalRepository,
        plan_repo: PaymentPlanRepository
    ):
        self.approval_repo = approval_repo
        self.plan_repo = plan_repo

    def create_insertion_approval(
        self,
        plan_id: str,
        current_position: int,
        target_position: int,
        justification: str,
        requester: str,
        impact_analysis: Optional[str] = None
    ) -> Dict:
        rule_traces = []
        
        plan = self.plan_repo.get_by_id(plan_id)
        if not plan:
            raise ValueError(f'付款计划 {plan_id} 不存在')
        
        if target_position >= current_position:
            rule_traces.append({
                'rule': 'APPR_INS_001',
                'description': '检查插单目标位置',
                'input': {
                    'current_position': current_position,
                    'target_position': target_position
                },
                'output': '目标位置必须在当前位置之前',
                'passed': False
            })
            return {
                'success': False,
                'error': '插单只能向前插队，不能向后',
                'rule_traces': rule_traces
            }
        
        rule_traces.append({
            'rule': 'APPR_INS_001',
            'description': '检查插单目标位置',
            'input': {
                'current_position': current_position,
                'target_position': target_position
            },
            'output': '目标位置有效',
            'passed': True
        })
        
        approval_id = f'IA-{datetime.now().strftime("%Y%m%d")}-{str(uuid4())[:6].upper()}'
        
        approval = InsertionApproval(
            id=approval_id,
            payment_plan_id=plan_id,
            original_queue_position=current_position,
            requested_queue_position=target_position,
            justification=justification,
            impact_analysis=impact_analysis,
            requester=requester,
            status=ApprovalStatus.PENDING
        )
        
        self.approval_repo.save(approval)
        
        rule_traces.append({
            'rule': 'APPR_INS_002',
            'description': '创建插单审批',
            'input': {
                'plan_id': plan_id,
                'from_position': current_position,
                'to_position': target_position
            },
            'output': {'approval_id': approval_id},
            'passed': True
        })
        
        return {
            'success': True,
            'approval_id': approval_id,
            'plan_id': plan_id,
            'current_position': current_position,
            'target_position': target_position,
            'affected_count': current_position - target_position,
            'status': ApprovalStatus.PENDING.value,
            'message': f'插单审批已创建，请等待审批。将影响{current_position - target_position}个付款计划',
            'rule_traces': rule_traces
        }

    def approve_insertion(
        self,
        approval_id: str,
        approver: str,
        comment: Optional[str] = None
    ) -> Dict:
        rule_traces = []
        
        approval = self.approval_repo.get_by_id(approval_id)
        if not approval:
            raise ValueError(f'审批记录 {approval_id} 不存在')
        
        if approval.status != ApprovalStatus.PENDING:
            rule_traces.append({
                'rule': 'APPR_INS_003',
                'description': '检查审批状态',
                'input': {'current_status': approval.status.value},
                'output': '仅待审批状态可审批',
                'passed': False
            })
            return {
                'success': False,
                'error': f'审批当前状态为{approval.status.value}，无法审批',
                'rule_traces': rule_traces
            }
        
        approval.approver = approver
        approval.approval_comment = comment
        approval.status = ApprovalStatus.APPROVED
        approval.approved_at = datetime.now()
        approval.mark_updated()
        self.approval_repo.save(approval)
        
        rule_traces.append({
            'rule': 'APPR_INS_004',
            'description': '插单审批通过',
            'input': {'approval_id': approval_id},
            'output': {'status': ApprovalStatus.APPROVED.value},
            'passed': True
        })
        
        return {
            'success': True,
            'approval_id': approval_id,
            'plan_id': approval.payment_plan_id,
            'target_position': approval.requested_queue_position,
            'status': ApprovalStatus.APPROVED.value,
            'message': '插单审批已通过，系统将执行插单操作',
            'needs_scheduling_refresh': True,
            'rule_traces': rule_traces
        }

    def reject_insertion(
        self,
        approval_id: str,
        approver: str,
        rejection_reason: str
    ) -> Dict:
        rule_traces = []
        
        approval = self.approval_repo.get_by_id(approval_id)
        if not approval:
            raise ValueError(f'审批记录 {approval_id} 不存在')
        
        if approval.status != ApprovalStatus.PENDING:
            return {
                'success': False,
                'error': f'审批当前状态为{approval.status.value}，无法审批'
            }
        
        approval.approver = approver
        approval.approval_comment = rejection_reason
        approval.status = ApprovalStatus.REJECTED
        approval.approved_at = datetime.now()
        approval.mark_updated()
        self.approval_repo.save(approval)
        
        rule_traces.append({
            'rule': 'APPR_INS_005',
            'description': '插单审批驳回',
            'input': {'approval_id': approval_id},
            'output': {'status': ApprovalStatus.REJECTED.value},
            'passed': True
        })
        
        return {
            'success': True,
            'approval_id': approval_id,
            'plan_id': approval.payment_plan_id,
            'status': ApprovalStatus.REJECTED.value,
            'message': f'插单审批已驳回，原因：{rejection_reason}',
            'rule_traces': rule_traces
        }

    def get_pending_approvals(self) -> List[Dict]:
        approvals = self.approval_repo.get_by_status(ApprovalStatus.PENDING)
        
        result = []
        for approval in approvals:
            plan = self.plan_repo.get_by_id(approval.payment_plan_id)
            result.append({
                'approval_id': approval.id,
                'plan_id': approval.payment_plan_id,
                'vendor_name': plan.vendor_name if plan else '未知供应商',
                'plan_amount': plan.total_amount if plan else 0,
                'original_position': approval.original_queue_position,
                'target_position': approval.requested_queue_position,
                'justification': approval.justification,
                'requester': approval.requester,
                'submitted_at': approval.submitted_at.isoformat()
            })
        
        return result
