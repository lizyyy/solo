from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime
from decimal import Decimal
import json

from sqlalchemy.orm import Session

from app.models import (
    LoanAccount, RepaymentPlan, ExtensionApplication,
    PenaltySnapshot, RuleCheckSnapshot
)
from app.utils import (
    AccountStatus, ApplicationStatus, IdGenerator, DateTimeUtils
)


class RuleResult:
    def __init__(self, rule_name: str, passed: bool, message: str, details: Dict[str, Any] = None):
        self.rule_name = rule_name
        self.passed = passed
        self.message = message
        self.details = details or {}
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "rule_name": self.rule_name,
            "passed": self.passed,
            "message": self.message,
            "details": self.details
        }


class RuleCheckResult:
    def __init__(self):
        self.overall_passed = True
        self.rules: List[RuleResult] = []
        self.snapshot_data: Dict[str, Any] = {}
    
    def add_rule(self, rule: RuleResult):
        self.rules.append(rule)
        if not rule.passed:
            self.overall_passed = False
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "overall_passed": self.overall_passed,
            "rules": [r.to_dict() for r in self.rules],
            "snapshot_data": self.snapshot_data
        }
    
    def get_failed_rules(self) -> List[RuleResult]:
        return [r for r in self.rules if not r.passed]
    
    def get_failed_messages(self) -> List[str]:
        return [r.message for r in self.rules if not r.passed]


class RuleEngine:
    def __init__(self, db: Session):
        self.db = db
    
    def check_extension_eligibility(
        self, 
        loan_account: LoanAccount, 
        extension_months: int,
        extension_application: Optional[ExtensionApplication] = None
    ) -> RuleCheckResult:
        result = RuleCheckResult()
        
        result.snapshot_data = {
            "loan_account": self._snapshot_loan_account(loan_account),
            "check_time": DateTimeUtils.now_naive().isoformat(),
            "extension_months": extension_months
        }
        
        self._check_account_status(result, loan_account)
        self._check_max_extension_count(result, loan_account)
        self._check_max_extension_months(result, loan_account, extension_months)
        self._check_no_pending_application(result, loan_account)
        self._check_remaining_principal(result, loan_account)
        self._check_account_not_frozen(result, loan_account)
        
        result.snapshot_data["rule_results"] = [r.to_dict() for r in result.rules]
        
        return result
    
    def _check_account_status(self, result: RuleCheckResult, loan_account: LoanAccount):
        valid_statuses = [AccountStatus.ACTIVE, AccountStatus.OVERDUE]
        passed = loan_account.status in valid_statuses
        result.add_rule(RuleResult(
            rule_name="账户状态检查",
            passed=passed,
            message=f"账户状态{'合法' if passed else '不合法'}：当前状态为 {loan_account.status}",
            details={
                "current_status": loan_account.status,
                "valid_statuses": [s.value for s in valid_statuses]
            }
        ))
    
    def _check_max_extension_count(self, result: RuleCheckResult, loan_account: LoanAccount):
        passed = loan_account.extension_count < loan_account.max_extension_count
        result.add_rule(RuleResult(
            rule_name="展期次数限制检查",
            passed=passed,
            message=f"已展期次数{'未达' if passed else '已达'}上限：{loan_account.extension_count}/{loan_account.max_extension_count}",
            details={
                "extension_count": loan_account.extension_count,
                "max_extension_count": loan_account.max_extension_count
            }
        ))
    
    def _check_max_extension_months(self, result: RuleCheckResult, loan_account: LoanAccount, extension_months: int):
        passed = extension_months <= loan_account.max_extension_months and extension_months > 0
        result.add_rule(RuleResult(
            rule_name="展期期限检查",
            passed=passed,
            message=f"展期月数{'合法' if passed else '不合法'}：申请{extension_months}个月，最大{loan_account.max_extension_months}个月",
            details={
                "requested_months": extension_months,
                "max_months": loan_account.max_extension_months
            }
        ))
    
    def _check_no_pending_application(self, result: RuleCheckResult, loan_account: LoanAccount):
        pending_statuses = [
            ApplicationStatus.PENDING,
            ApplicationStatus.FIRST_APPROVED,
            ApplicationStatus.FINAL_APPROVED,
            ApplicationStatus.EXECUTING
        ]
        pending_apps = self.db.query(ExtensionApplication).filter(
            ExtensionApplication.loan_account_id == loan_account.id,
            ExtensionApplication.status.in_([s.value for s in pending_statuses])
        ).count()
        
        passed = pending_apps == 0
        result.add_rule(RuleResult(
            rule_name="无待处理展期申请检查",
            passed=passed,
            message=f"当前{'没有' if passed else f'有{pending_apps}个'}待处理的展期申请",
            details={
                "pending_count": pending_apps
            }
        ))
    
    def _check_remaining_principal(self, result: RuleCheckResult, loan_account: LoanAccount):
        passed = loan_account.remaining_principal > Decimal("0")
        result.add_rule(RuleResult(
            rule_name="剩余本金检查",
            passed=passed,
            message=f"贷款{'有' if passed else '没有'}剩余本金可展期",
            details={
                "remaining_principal": str(loan_account.remaining_principal)
            }
        ))
    
    def _check_account_not_frozen(self, result: RuleCheckResult, loan_account: LoanAccount):
        passed = loan_account.status != AccountStatus.FROZEN
        result.add_rule(RuleResult(
            rule_name="账户未冻结检查",
            passed=passed,
            message=f"账户{'未' if passed else '已'}被冻结",
            details={
                "account_status": loan_account.status
            }
        ))
    
    def save_rule_snapshot(
        self, 
        check_result: RuleCheckResult,
        application_id: Optional[int] = None,
        operator_id: Optional[str] = None,
        operator_name: Optional[str] = None
    ) -> RuleCheckSnapshot:
        snapshot = RuleCheckSnapshot(
            snapshot_no=IdGenerator.generate_snapshot_no(),
            application_id=application_id,
            check_time=DateTimeUtils.now_naive(),
            overall_result="PASSED" if check_result.overall_passed else "FAILED",
            loan_account_snapshot=json.dumps(check_result.snapshot_data.get("loan_account", {}), ensure_ascii=False),
            rule_results=json.dumps([r.to_dict() for r in check_result.rules], ensure_ascii=False),
            check_by_id=operator_id,
            check_by_name=operator_name
        )
        self.db.add(snapshot)
        self.db.flush()
        return snapshot
    
    def _snapshot_loan_account(self, account: LoanAccount) -> Dict[str, Any]:
        return {
            "id": account.id,
            "account_no": account.account_no,
            "customer_id": account.customer_id,
            "status": account.status,
            "loan_amount": str(account.loan_amount),
            "remaining_principal": str(account.remaining_principal),
            "annual_interest_rate": str(account.annual_interest_rate),
            "extension_count": account.extension_count,
            "max_extension_count": account.max_extension_count,
            "max_extension_months": account.max_extension_months,
            "current_maturity_date": account.current_maturity_date.isoformat() if account.current_maturity_date else None,
            "credit_limit_used": str(account.credit_limit_used),
            "version": account.version
        }
    
    def check_penalty_settlement(
        self,
        loan_account: LoanAccount,
        penalty_snapshot: PenaltySnapshot
    ) -> RuleCheckResult:
        result = RuleCheckResult()
        
        result.snapshot_data = {
            "loan_account": self._snapshot_loan_account(loan_account),
            "penalty_snapshot": self._snapshot_penalty(penalty_snapshot),
            "check_time": DateTimeUtils.now_naive().isoformat()
        }
        
        self._check_penalty_not_settled(result, penalty_snapshot)
        self._check_penalty_amount_valid(result, penalty_snapshot)
        
        return result
    
    def _check_penalty_not_settled(self, result: RuleCheckResult, penalty_snapshot: PenaltySnapshot):
        passed = not penalty_snapshot.settled
        result.add_rule(RuleResult(
            rule_name="罚息未结清检查",
            passed=passed,
            message=f"罚息快照{'未' if passed else '已'}结清",
            details={
                "settled": penalty_snapshot.settled,
                "settled_at": penalty_snapshot.settled_at.isoformat() if penalty_snapshot.settled_at else None
            }
        ))
    
    def _check_penalty_amount_valid(self, result: RuleCheckResult, penalty_snapshot: PenaltySnapshot):
        passed = penalty_snapshot.penalty_amount >= Decimal("0")
        result.add_rule(RuleResult(
            rule_name="罚息金额合法性检查",
            passed=passed,
            message=f"罚息金额{'合法' if passed else '不合法'}",
            details={
                "penalty_amount": str(penalty_snapshot.penalty_amount)
            }
        ))
    
    def _snapshot_penalty(self, penalty: PenaltySnapshot) -> Dict[str, Any]:
        return {
            "id": penalty.id,
            "snapshot_no": penalty.snapshot_no,
            "loan_account_id": penalty.loan_account_id,
            "snapshot_time": penalty.snapshot_time.isoformat(),
            "overdue_principal": str(penalty.overdue_principal),
            "overdue_interest": str(penalty.overdue_interest),
            "overdue_days": penalty.overdue_days,
            "penalty_amount": str(penalty.penalty_amount),
            "penalty_rate": str(penalty.penalty_rate),
            "settled": penalty.settled
        }
