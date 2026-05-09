from typing import Optional, Dict, Any, List
from datetime import datetime
from decimal import Decimal
import json

from sqlalchemy.orm import Session
from sqlalchemy.exc import OperationalError

from app.models import (
    LoanAccount, RepaymentPlan, RepaymentInstallment,
    ExtensionApplication, ApprovalHistory, PenaltySnapshot,
    CreditLimitRecord, RuleCheckSnapshot
)
from app.utils import (
    ApplicationStatus, AccountStatus, ApprovalStage,
    OperationType, BusinessType, SourceType,
    IdGenerator, DateTimeUtils
)
from app.services.rule_engine import RuleEngine, RuleCheckResult
from app.services.audit_service import AuditService
from app.services.repayment_calculator import RepaymentCalculator
from app.services.limit_service import LimitService


class ExtensionApplicationException(Exception):
    pass


class ExtensionService:
    def __init__(self, db: Session):
        self.db = db
        self.rule_engine = RuleEngine(db)
        self.audit_service = AuditService(db)
        self.repayment_calculator = RepaymentCalculator(db)
        self.limit_service = LimitService(db)
    
    def submit_application(
        self,
        account_no: str,
        extension_months: int,
        applicant_id: str,
        applicant_name: str,
        extension_reason: Optional[str] = None,
        extension_interest_rate: Optional[Decimal] = None
    ) -> Dict[str, Any]:
        try:
            loan_account = self._get_loan_account(account_no)
            if not loan_account:
                raise ExtensionApplicationException(f"贷款账户不存在: {account_no}")
            
            before_data = self._snapshot_account(loan_account)
            
            rule_result = self.rule_engine.check_extension_eligibility(
                loan_account=loan_account,
                extension_months=extension_months
            )
            
            if not rule_result.overall_passed:
                raise ExtensionApplicationException(
                    "; ".join(rule_result.get_failed_messages())
                )
            
            rule_snapshot = self.rule_engine.save_rule_snapshot(
                check_result=rule_result,
                operator_id=applicant_id,
                operator_name=applicant_name
            )
            
            application = ExtensionApplication(
                application_no=IdGenerator.generate_application_no(),
                loan_account_id=loan_account.id,
                extension_months=extension_months,
                extension_reason=extension_reason,
                extension_interest_rate=extension_interest_rate,
                applicant_id=applicant_id,
                applicant_name=applicant_name,
                status=ApplicationStatus.PENDING.value,
                rule_check_snapshot_id=rule_snapshot.id
            )
            
            self.db.add(application)
            self.db.flush()
            
            self.audit_service.log_extension_application_submit(
                application_id=application.id,
                application_no=application.application_no,
                loan_account_id=loan_account.id,
                before_account_data=before_data,
                operator_id=applicant_id,
                operator_name=applicant_name
            )
            
            self._create_approval_history(
                application=application,
                stage=ApprovalStage.FIRST_APPROVAL.value,
                operation_type=OperationType.SUBMIT,
                operator_id=applicant_id,
                operator_name=applicant_name,
                before_status="NEW",
                after_status=ApplicationStatus.PENDING.value,
                rule_result=rule_result.to_dict()
            )
            
            self.db.commit()
            
            return {
                "success": True,
                "application_no": application.application_no,
                "application_id": application.id,
                "status": application.status,
                "rule_check_passed": rule_result.overall_passed
            }
            
        except ExtensionApplicationException:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise ExtensionApplicationException(f"提交展期申请失败: {str(e)}")
    
    def first_approve(
        self,
        application_no: str,
        approver_id: str,
        approver_name: str,
        comment: Optional[str] = None
    ) -> Dict[str, Any]:
        try:
            application = self._get_application(application_no)
            if not application:
                raise ExtensionApplicationException(f"申请不存在: {application_no}")
            
            if application.status != ApplicationStatus.PENDING.value:
                raise ExtensionApplicationException(f"申请状态不允许初审: {application.status}")
            
            loan_account = self.db.query(LoanAccount).get(application.loan_account_id)
            
            rule_result = self.rule_engine.check_extension_eligibility(
                loan_account=loan_account,
                extension_months=application.extension_months
            )
            
            before_status = application.status
            
            application.status = ApplicationStatus.FIRST_APPROVED.value
            application.first_approver_id = approver_id
            application.first_approver_name = approver_name
            application.first_approval_at = DateTimeUtils.now_naive()
            application.first_approval_comment = comment
            
            self._create_approval_history(
                application=application,
                stage=ApprovalStage.FIRST_APPROVAL.value,
                operation_type=OperationType.FIRST_APPROVE,
                operator_id=approver_id,
                operator_name=approver_name,
                before_status=before_status,
                after_status=ApplicationStatus.FIRST_APPROVED.value,
                comment=comment,
                rule_result=rule_result.to_dict()
            )
            
            self.audit_service.log_approval(
                application_id=application.id,
                application_no=application.application_no,
                approval_stage="初审",
                operation_type=OperationType.FIRST_APPROVE,
                before_status=before_status,
                after_status=ApplicationStatus.FIRST_APPROVED.value,
                operator_id=approver_id,
                operator_name=approver_name,
                comment=comment
            )
            
            self.db.commit()
            
            return {
                "success": True,
                "application_no": application.application_no,
                "status": application.status,
                "first_approval_time": application.first_approval_at.isoformat()
            }
            
        except ExtensionApplicationException:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise ExtensionApplicationException(f"初审失败: {str(e)}")
    
    def final_approve(
        self,
        application_no: str,
        approver_id: str,
        approver_name: str,
        comment: Optional[str] = None
    ) -> Dict[str, Any]:
        try:
            application = self._get_application(application_no)
            if not application:
                raise ExtensionApplicationException(f"申请不存在: {application_no}")
            
            if application.status != ApplicationStatus.FIRST_APPROVED.value:
                raise ExtensionApplicationException(f"申请状态不允许终审: {application.status}")
            
            loan_account = self.db.query(LoanAccount).get(application.loan_account_id)
            current_plan = self._get_current_plan(loan_account.id)
            
            rule_result = self.rule_engine.check_extension_eligibility(
                loan_account=loan_account,
                extension_months=application.extension_months
            )
            
            penalty_snapshot = self._create_penalty_snapshot(
                loan_account=loan_account,
                application=application,
                current_plan=current_plan
            )
            
            new_plan, _ = self.repayment_calculator.calculate_extension_plan(
                loan_account=loan_account,
                current_plan=current_plan,
                extension_months=application.extension_months,
                extension_rate=application.extension_interest_rate
            )
            
            before_status = application.status
            
            application.status = ApplicationStatus.FINAL_APPROVED.value
            application.final_approver_id = approver_id
            application.final_approver_name = approver_name
            application.final_approval_at = DateTimeUtils.now_naive()
            application.final_approval_comment = comment
            application.new_repayment_plan_id = new_plan.id
            
            self._create_approval_history(
                application=application,
                stage=ApprovalStage.FINAL_APPROVAL.value,
                operation_type=OperationType.FINAL_APPROVE,
                operator_id=approver_id,
                operator_name=approver_name,
                before_status=before_status,
                after_status=ApplicationStatus.FINAL_APPROVED.value,
                comment=comment,
                rule_result=rule_result.to_dict()
            )
            
            self.audit_service.log_approval(
                application_id=application.id,
                application_no=application.application_no,
                approval_stage="终审",
                operation_type=OperationType.FINAL_APPROVE,
                before_status=before_status,
                after_status=ApplicationStatus.FINAL_APPROVED.value,
                operator_id=approver_id,
                operator_name=approver_name,
                comment=comment
            )
            
            self.db.commit()
            
            return {
                "success": True,
                "application_no": application.application_no,
                "status": application.status,
                "final_approval_time": application.final_approval_at.isoformat(),
                "new_plan_no": new_plan.plan_no
            }
            
        except ExtensionApplicationException:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise ExtensionApplicationException(f"终审失败: {str(e)}")
    
    def execute_extension(
        self,
        application_no: str,
        execute_by_id: Optional[str] = None,
        execute_by_name: Optional[str] = None
    ) -> Dict[str, Any]:
        try:
            application = self._get_application(application_no)
            if not application:
                raise ExtensionApplicationException(f"申请不存在: {application_no}")
            
            if application.status != ApplicationStatus.FINAL_APPROVED.value:
                raise ExtensionApplicationException(f"申请状态不允许执行: {application.status}")
            
            loan_account = self.db.query(LoanAccount).get(application.loan_account_id)
            current_plan = self._get_current_plan(loan_account.id)
            new_plan = self.db.query(RepaymentPlan).get(application.new_repayment_plan_id)
            
            if not new_plan:
                raise ExtensionApplicationException("新还款计划不存在")
            
            application.status = ApplicationStatus.EXECUTING.value
            application.executed_at = DateTimeUtils.now_naive()
            self.db.flush()
            
            old_plan_snapshot = self.repayment_calculator.get_plan_snapshot(current_plan)
            new_plan_snapshot = self.repayment_calculator.get_plan_snapshot(new_plan)
            
            self.repayment_calculator.activate_new_plan(
                old_plan=current_plan,
                new_plan=new_plan,
                related_application_id=application.id,
                created_by=execute_by_id
            )
            
            before_account_data = self._snapshot_account(loan_account)
            
            loan_account.current_repayment_plan_id = new_plan.id
            loan_account.current_maturity_date = new_plan.end_date
            loan_account.extension_count += 1
            loan_account.status = AccountStatus.EXTENDED.value
            loan_account.version += 1
            
            self.limit_service.extend_limit(
                loan_account=loan_account,
                extension_months=application.extension_months,
                related_application_id=application.id,
                related_business_no=application.application_no
            )
            
            after_account_data = self._snapshot_account(loan_account)
            
            self.audit_service.log_plan_change(
                plan_id=new_plan.id,
                plan_no=new_plan.plan_no,
                before_data=old_plan_snapshot,
                after_data=new_plan_snapshot,
                operation_type=OperationType.RECALCULATE,
                operator_id=execute_by_id,
                operator_name=execute_by_name,
                reason=f"展期申请执行: {application.application_no}"
            )
            
            self._create_approval_history(
                application=application,
                stage=ApprovalStage.EXECUTION.value,
                operation_type=OperationType.EXECUTE,
                operator_id=execute_by_id or "SYSTEM",
                operator_name=execute_by_name or "系统自动执行",
                before_status=ApplicationStatus.FINAL_APPROVED.value,
                after_status=ApplicationStatus.EXECUTED.value
            )
            
            application.status = ApplicationStatus.EXECUTED.value
            application.executed_status = "SUCCESS"
            
            self.db.commit()
            
            return {
                "success": True,
                "application_no": application.application_no,
                "status": application.status,
                "executed_at": application.executed_at.isoformat(),
                "new_plan_no": new_plan.plan_no,
                "account_changes": {
                    "before": before_account_data,
                    "after": after_account_data
                }
            }
            
        except ExtensionApplicationException:
            self.db.rollback()
            if application:
                application.status = ApplicationStatus.EXECUTE_FAILED.value
                application.execution_error = str(ExtensionApplicationException)
                self.db.commit()
            raise
        except Exception as e:
            self.db.rollback()
            if application:
                application.status = ApplicationStatus.EXECUTE_FAILED.value
                application.execution_error = str(e)
                self.db.commit()
            raise ExtensionApplicationException(f"执行展期失败: {str(e)}")
    
    def reject_application(
        self,
        application_no: str,
        rejector_id: str,
        rejector_name: str,
        reject_reason: str
    ) -> Dict[str, Any]:
        try:
            application = self._get_application(application_no)
            if not application:
                raise ExtensionApplicationException(f"申请不存在: {application_no}")
            
            valid_statuses = [
                ApplicationStatus.PENDING.value,
                ApplicationStatus.FIRST_APPROVED.value
            ]
            if application.status not in valid_statuses:
                raise ExtensionApplicationException(f"申请状态不允许驳回: {application.status}")
            
            before_status = application.status
            
            application.status = ApplicationStatus.REJECTED.value
            application.rejected_by_id = rejector_id
            application.rejected_by_name = rejector_name
            application.rejected_at = DateTimeUtils.now_naive()
            application.reject_reason = reject_reason
            
            self._create_approval_history(
                application=application,
                stage=ApprovalStage.REJECTION.value,
                operation_type=OperationType.REJECT,
                operator_id=rejector_id,
                operator_name=rejector_name,
                before_status=before_status,
                after_status=ApplicationStatus.REJECTED.value,
                comment=reject_reason
            )
            
            self.audit_service.log_approval(
                application_id=application.id,
                application_no=application.application_no,
                approval_stage="驳回",
                operation_type=OperationType.REJECT,
                before_status=before_status,
                after_status=ApplicationStatus.REJECTED.value,
                operator_id=rejector_id,
                operator_name=rejector_name,
                comment=reject_reason
            )
            
            self.db.commit()
            
            return {
                "success": True,
                "application_no": application.application_no,
                "status": application.status,
                "reject_time": application.rejected_at.isoformat()
            }
            
        except ExtensionApplicationException:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise ExtensionApplicationException(f"驳回申请失败: {str(e)}")
    
    def cancel_application(
        self,
        application_no: str,
        canceller_id: str,
        canceller_name: str,
        cancel_reason: Optional[str] = None
    ) -> Dict[str, Any]:
        try:
            application = self._get_application(application_no)
            if not application:
                raise ExtensionApplicationException(f"申请不存在: {application_no}")
            
            valid_statuses = [
                ApplicationStatus.PENDING.value,
                ApplicationStatus.FIRST_APPROVED.value
            ]
            if application.status not in valid_statuses:
                raise ExtensionApplicationException(f"申请状态不允许撤销: {application.status}")
            
            before_status = application.status
            
            application.status = ApplicationStatus.CANCELLED.value
            application.cancelled_by_id = canceller_id
            application.cancelled_by_name = canceller_name
            application.cancelled_at = DateTimeUtils.now_naive()
            
            self._create_approval_history(
                application=application,
                stage=ApprovalStage.CANCELLATION.value,
                operation_type=OperationType.CANCEL,
                operator_id=canceller_id,
                operator_name=canceller_name,
                before_status=before_status,
                after_status=ApplicationStatus.CANCELLED.value,
                comment=cancel_reason
            )
            
            self.audit_service.log_approval(
                application_id=application.id,
                application_no=application.application_no,
                approval_stage="撤销",
                operation_type=OperationType.CANCEL,
                before_status=before_status,
                after_status=ApplicationStatus.CANCELLED.value,
                operator_id=canceller_id,
                operator_name=canceller_name,
                comment=cancel_reason
            )
            
            self.db.commit()
            
            return {
                "success": True,
                "application_no": application.application_no,
                "status": application.status,
                "cancel_time": application.cancelled_at.isoformat()
            }
            
        except ExtensionApplicationException:
            self.db.rollback()
            raise
        except Exception as e:
            self.db.rollback()
            raise ExtensionApplicationException(f"撤销申请失败: {str(e)}")
    
    def _get_loan_account(self, account_no: str) -> Optional[LoanAccount]:
        return self.db.query(LoanAccount).filter(
            LoanAccount.account_no == account_no
        ).first()
    
    def _get_application(self, application_no: str) -> Optional[ExtensionApplication]:
        return self.db.query(ExtensionApplication).filter(
            ExtensionApplication.application_no == application_no
        ).first()
    
    def _get_current_plan(self, loan_account_id: int) -> Optional[RepaymentPlan]:
        return self.db.query(RepaymentPlan).filter(
            RepaymentPlan.loan_account_id == loan_account_id,
            RepaymentPlan.is_current == True
        ).first()
    
    def _create_penalty_snapshot(
        self,
        loan_account: LoanAccount,
        application: ExtensionApplication,
        current_plan: RepaymentPlan
    ) -> PenaltySnapshot:
        now = DateTimeUtils.now_naive()
        
        overdue_installments = self.db.query(RepaymentInstallment).filter(
            RepaymentInstallment.plan_id == current_plan.id,
            RepaymentInstallment.due_date < now,
            RepaymentInstallment.status != "PAID"
        ).all()
        
        overdue_principal = sum(
            (inst.principal - inst.paid_principal) for inst in overdue_installments
        )
        overdue_interest = sum(
            (inst.interest - inst.paid_interest) for inst in overdue_installments
        )
        
        max_overdue_days = 0
        for inst in overdue_installments:
            days = DateTimeUtils.diff_days(now, inst.due_date)
            if days > max_overdue_days:
                max_overdue_days = days
        
        penalty_rate = Decimal("0.05")
        
        penalty_amount, penalty_details = self.repayment_calculator.calculate_penalty(
            overdue_principal=overdue_principal,
            overdue_interest=overdue_interest,
            overdue_days=max_overdue_days,
            penalty_rate=penalty_rate
        )
        
        snapshot = PenaltySnapshot(
            snapshot_no=IdGenerator.generate_snapshot_no(),
            loan_account_id=loan_account.id,
            extension_application_id=application.id,
            snapshot_time=now,
            snapshot_reason="展期审批罚息快照",
            overdue_principal=overdue_principal,
            overdue_interest=overdue_interest,
            overdue_days=max_overdue_days,
            penalty_amount=penalty_amount,
            penalty_rate=penalty_rate,
            penalty_details=json.dumps(penalty_details, ensure_ascii=False)
        )
        
        self.db.add(snapshot)
        self.db.flush()
        
        self.audit_service.log_penalty_snapshot(
            snapshot_id=snapshot.id,
            snapshot_no=snapshot.snapshot_no,
            loan_account_id=loan_account.id,
            penalty_amount=str(penalty_amount)
        )
        
        return snapshot
    
    def _create_approval_history(
        self,
        application: ExtensionApplication,
        stage: str,
        operation_type: OperationType,
        operator_id: str,
        operator_name: str,
        before_status: str,
        after_status: str,
        comment: Optional[str] = None,
        rule_result: Optional[Dict[str, Any]] = None
    ) -> ApprovalHistory:
        import json
        
        history = ApprovalHistory(
            application_id=application.id,
            approval_stage=stage,
            operation_type=operation_type.value,
            operation_time=DateTimeUtils.now_naive(),
            operator_id=operator_id,
            operator_name=operator_name,
            operation_comment=comment,
            before_status=before_status,
            after_status=after_status,
            rule_check_result=json.dumps(rule_result, ensure_ascii=False) if rule_result else None
        )
        
        self.db.add(history)
        self.db.flush()
        return history
    
    def _snapshot_account(self, account: LoanAccount) -> Dict[str, Any]:
        return {
            "id": account.id,
            "account_no": account.account_no,
            "status": account.status,
            "remaining_principal": str(account.remaining_principal),
            "current_maturity_date": account.current_maturity_date.isoformat() if account.current_maturity_date else None,
            "extension_count": account.extension_count,
            "credit_limit_used": str(account.credit_limit_used),
            "version": account.version
        }
    
    def get_application_detail(
        self,
        application_no: str
    ) -> Dict[str, Any]:
        application = self._get_application(application_no)
        if not application:
            raise ExtensionApplicationException(f"申请不存在: {application_no}")
        
        loan_account = self.db.query(LoanAccount).get(application.loan_account_id)
        
        histories = self.db.query(ApprovalHistory).filter(
            ApprovalHistory.application_id == application.id
        ).order_by(ApprovalHistory.operation_time.desc()).all()
        
        rule_snapshot = None
        if application.rule_check_snapshot_id:
            rule_snapshot = self.db.query(RuleCheckSnapshot).get(
                application.rule_check_snapshot_id
            )
        
        penalty_snapshots = self.db.query(PenaltySnapshot).filter(
            PenaltySnapshot.extension_application_id == application.id
        ).all()
        
        return {
            "application": {
                "id": application.id,
                "application_no": application.application_no,
                "account_no": loan_account.account_no if loan_account else None,
                "customer_name": loan_account.customer_name if loan_account else None,
                "extension_months": application.extension_months,
                "extension_reason": application.extension_reason,
                "status": application.status,
                "requested_at": application.requested_at.isoformat(),
                "applicant": {
                    "id": application.applicant_id,
                    "name": application.applicant_name
                },
                "first_approval": {
                    "approver_id": application.first_approver_id,
                    "approver_name": application.first_approver_name,
                    "time": application.first_approval_at.isoformat() if application.first_approval_at else None,
                    "comment": application.first_approval_comment
                } if application.first_approver_id else None,
                "final_approval": {
                    "approver_id": application.final_approver_id,
                    "approver_name": application.final_approver_name,
                    "time": application.final_approval_at.isoformat() if application.final_approval_at else None,
                    "comment": application.final_approval_comment
                } if application.final_approver_id else None,
                "execution": {
                    "status": application.executed_status,
                    "time": application.executed_at.isoformat() if application.executed_at else None,
                    "error": application.execution_error
                },
                "rejection": {
                    "rejector_id": application.rejected_by_id,
                    "rejector_name": application.rejected_by_name,
                    "time": application.rejected_at.isoformat() if application.rejected_at else None,
                    "reason": application.reject_reason
                } if application.status == "REJECTED" else None
            },
            "approval_histories": [
                {
                    "stage": h.approval_stage,
                    "operation_type": h.operation_type,
                    "operator": {
                        "id": h.operator_id,
                        "name": h.operator_name
                    },
                    "time": h.operation_time.isoformat(),
                    "before_status": h.before_status,
                    "after_status": h.after_status,
                    "comment": h.operation_comment
                }
                for h in histories
            ],
            "rule_check": json.loads(rule_snapshot.rule_results) if rule_snapshot else None,
            "penalty_snapshots": [
                {
                    "snapshot_no": s.snapshot_no,
                    "snapshot_time": s.snapshot_time.isoformat(),
                    "overdue_principal": str(s.overdue_principal),
                    "overdue_interest": str(s.overdue_interest),
                    "overdue_days": s.overdue_days,
                    "penalty_amount": str(s.penalty_amount),
                    "penalty_rate": str(s.penalty_rate)
                }
                for s in penalty_snapshots
            ]
        }
