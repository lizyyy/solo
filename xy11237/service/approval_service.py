from typing import List, Optional, Tuple

from repository import UnitOfWork
from models import (
    Application,
    ApprovalRecord,
    ApplicationStatus,
    ApprovalResult,
    OperationType,
    ExceptionType,
    OperationLog,
)
from rules import (
    ApprovalContext,
    RuleEngine,
    create_approval_rules,
    RuleResult,
)


class ApprovalService:
    def __init__(self, uow: UnitOfWork):
        self.uow = uow
        self.rule_engine = RuleEngine[ApprovalContext]()
        self.rule_engine.register_all(create_approval_rules())

    def create_approval(
        self,
        application_id: str,
        approver_id: str,
        approver_name: str,
        result: ApprovalResult,
        comment: Optional[str] = None,
    ) -> Tuple[ApprovalRecord, List[RuleResult], bool]:
        application = self.uow.applications.get_by_id(application_id)
        if not application:
            raise ValueError(f"申请单 {application_id} 不存在")

        if application.status not in [ApplicationStatus.PENDING, ApplicationStatus.APPROVING]:
            raise ValueError(f"申请单当前状态不允许审批")

        existing_approvals = self.uow.approvals.find_by_application_id(application_id)

        approval_record = ApprovalRecord(
            application_id=application_id,
            approver_id=approver_id,
            approver_name=approver_name,
            approval_level=len(existing_approvals) + 1,
            result=result,
            comment=comment,
        )

        context = ApprovalContext(
            application=application,
            approval_record=approval_record,
            existing_approvals=existing_approvals,
            requires_double_approval=application.requires_double_approval,
        )

        results, all_passed = self.rule_engine.execute(context)

        if not all_passed:
            for r in results:
                if not r.passed:
                    approval_record.exception_type = r.exception_type
                    approval_record.exception_message = r.message
                    break
            return approval_record, results, False

        if result == ApprovalResult.APPROVED:
            application.approve(approval_record.id)
            self._process_approved(application, approval_record)
        elif result == ApprovalResult.REJECTED:
            application.reject(comment or "")
            self._process_rejected(application, approval_record)

        self.uow.approvals.create(approval_record)
        self.uow.applications.update(application)
        self._log_operation(application_id, "Application", OperationType.APPROVE, approver_id, approver_name)

        return approval_record, results, True

    def _process_approved(self, application: Application, approval: ApprovalRecord):
        if application.requires_double_approval:
            approved_count = sum(
                1 for a in self.uow.approvals.find_by_application_id(application.id)
                if a.result == ApprovalResult.APPROVED
            ) + 1
            if approved_count >= 2:
                application.status = ApplicationStatus.APPROVED
                approval.is_final_approval = True
            else:
                application.status = ApplicationStatus.APPROVING
        else:
            application.status = ApplicationStatus.APPROVED
            approval.is_final_approval = True

    def _process_rejected(self, application: Application, approval: ApprovalRecord):
        application.status = ApplicationStatus.REJECTED
        approval.is_final_approval = True

    def get_approvals_by_application(self, application_id: str) -> List[ApprovalRecord]:
        return self.uow.approvals.find_by_application_id(application_id)

    def get_approval(self, approval_id: str) -> Optional[ApprovalRecord]:
        return self.uow.approvals.get_by_id(approval_id)

    def _log_operation(
        self,
        target_id: str,
        target_type: str,
        operation_type: OperationType,
        operator_id: str,
        operator_name: str,
    ):
        log = OperationLog(
            operation_type=operation_type,
            operator_id=operator_id,
            operator_name=operator_name,
            target_id=target_id,
            target_type=target_type,
        )
        self.uow.logs.create(log)
