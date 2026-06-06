from datetime import datetime, timedelta
from typing import List, Dict, Tuple
from sqlalchemy.orm import Session
from .models import Customer, LoanAccount, RepaymentRecord, WarningRecord
from collections import defaultdict


class WarningEngine:
    WARNING_TYPES = {
        "MULTI_ACCOUNT_SAME_CUSTOMER": "同一客户多账号合并预警",
        "OVERDUE_IMMINENT": "贷款即将到期预警",
        "ALREADY_OVERDUE": "已逾期未还预警",
        "REFUND_CROSS_CLEARING": "退款跨清算日异常",
        "EXTENSION_SUSPECTED": "疑似展期操作预警",
        "DATA_QUALITY_ISSUE": "数据质量异常"
    }

    WARNING_LEVELS = {
        "HIGH": "高",
        "MEDIUM": "中",
        "LOW": "低"
    }

    def __init__(self, db: Session):
        self.db = db

    def detect_multi_account_customers(self) -> List[WarningRecord]:
        warnings = []

        id_card_groups = defaultdict(list)
        customers = self.db.query(Customer).all()

        for customer in customers:
            if customer.id_card:
                id_card_groups[customer.id_card].append(customer)

        for id_card, customer_list in id_card_groups.items():
            if len(customer_list) > 1:
                customer_ids = [c.customer_id for c in customer_list]
                accounts = self.db.query(LoanAccount).filter(
                    LoanAccount.customer_id.in_(customer_ids)
                ).all()

                if accounts:
                    total_outstanding = sum(a.outstanding_principal or 0 for a in accounts)
                    account_nos = [a.account_no for a in accounts]

                    for account in accounts:
                        warning = WarningRecord(
                            account_no=account.account_no,
                            customer_id=account.customer_id,
                            warning_type="MULTI_ACCOUNT_SAME_CUSTOMER",
                            warning_level="HIGH",
                            warning_message=(
                                f"发现同一客户（身份证 {id_card}）拆分为 {len(customer_list)} 个客户编号: "
                                f"{', '.join(customer_ids)}。"
                                f"涉及贷款账号 {len(account_nos)} 个: {', '.join(account_nos)}。"
                                f"合计剩余本金 {total_outstanding:.2f} 元。"
                                f"请合并处理该客户的所有贷款账户。"
                            ),
                            related_materials=(
                                f"客户编号列表: {customer_ids}; "
                                f"身份证: {id_card}; "
                                f"关联账号: {account_nos}; "
                                f"客户姓名: {customer_list[0].customer_name}"
                            ),
                            is_extended=False
                        )
                        warnings.append(warning)

        return warnings

    def detect_overdue_loans(self, warning_days: int = 7) -> List[WarningRecord]:
        warnings = []
        today = datetime.now().date()

        accounts = self.db.query(LoanAccount).all()

        for account in accounts:
            if not account.loan_due_date:
                continue

            days_to_due = (account.loan_due_date - today).days

            if days_to_due < 0 and (account.actual_repayment_date is None or account.actual_repayment_date > account.loan_due_date):
                overdue_days = abs(days_to_due)
                warning = WarningRecord(
                    account_no=account.account_no,
                    customer_id=account.customer_id,
                    warning_type="ALREADY_OVERDUE",
                    warning_level="HIGH",
                    warning_message=(
                        f"贷款已逾期 {overdue_days} 天。"
                        f"到期日期: {account.loan_due_date}，"
                        f"剩余本金: {account.outstanding_principal or 0:.2f} 元，"
                        f"当前状态: {account.status or '未知'}。"
                        f"请立即催收并确认是否需要办理展期。"
                    ),
                    related_materials=(
                        f"贷款账号: {account.account_no}; "
                        f"到期日期: {account.loan_due_date}; "
                        f"放款日期: {account.loan_start_date}; "
                        f"贷款金额: {account.loan_amount}; "
                        f"实际还款日期: {account.actual_repayment_date}"
                    ),
                    is_extended=False
                )
                warnings.append(warning)

            elif 0 <= days_to_due <= warning_days:
                warning = WarningRecord(
                    account_no=account.account_no,
                    customer_id=account.customer_id,
                    warning_type="OVERDUE_IMMINENT",
                    warning_level="MEDIUM",
                    warning_message=(
                        f"贷款将在 {days_to_due} 天后到期（{account.loan_due_date}）。"
                        f"剩余本金: {account.outstanding_principal or 0:.2f} 元。"
                        f"请提前联系客户确认还款安排，必要时办理展期手续。"
                    ),
                    related_materials=(
                        f"贷款账号: {account.account_no}; "
                        f"到期日期: {account.loan_due_date}; "
                        f"放款日期: {account.loan_start_date}; "
                        f"贷款金额: {account.loan_amount}"
                    ),
                    is_extended=False
                )
                warnings.append(warning)

        return warnings

    def detect_refund_cross_clearing(self) -> List[WarningRecord]:
        warnings = []

        refunds = self.db.query(RepaymentRecord).filter(
            RepaymentRecord.is_refund == True
        ).all()

        for refund in refunds:
            if refund.repayment_date and refund.clearing_date:
                if refund.clearing_date > refund.repayment_date:
                    days_diff = (refund.clearing_date - refund.repayment_date).days

                    account = self.db.query(LoanAccount).filter(
                        LoanAccount.account_no == refund.account_no
                    ).first()

                    warning = WarningRecord(
                        account_no=refund.account_no,
                        customer_id=account.customer_id if account else "",
                        warning_type="REFUND_CROSS_CLEARING",
                        warning_level="MEDIUM",
                        warning_message=(
                            f"退款跨清算日异常: 退款日期 {refund.repayment_date}，"
                            f"清算日期 {refund.clearing_date}，"
                            f"跨期 {days_diff} 天。"
                            f"退款金额: {refund.repayment_amount or 0:.2f} 元。"
                            f"请核对清算流水，确认资金归属期是否正确。"
                        ),
                        related_materials=(
                            f"来源材料: {refund.source_material or '未标注'}; "
                            f"还款记录ID: {refund.id}; "
                            f"退款日期: {refund.repayment_date}; "
                            f"清算日期: {refund.clearing_date}; "
                            f"还款类型: {refund.repayment_type}; "
                            f"金额: {refund.repayment_amount}"
                        ),
                        is_extended=False
                    )
                    warnings.append(warning)

        return warnings

    def detect_suspected_extension(self) -> List[WarningRecord]:
        warnings = []

        accounts = self.db.query(LoanAccount).all()

        for account in accounts:
            if account.actual_repayment_date and account.loan_due_date:
                if account.actual_repayment_date > account.loan_due_date:
                    extension_days = (account.actual_repayment_date - account.loan_due_date).days

                    warning = WarningRecord(
                        account_no=account.account_no,
                        customer_id=account.customer_id,
                        warning_type="EXTENSION_SUSPECTED",
                        warning_level="HIGH",
                        warning_message=(
                            f"疑似展期操作: 贷款到期日 {account.loan_due_date}，"
                            f"实际还款日期 {account.actual_repayment_date}，"
                            f"逾期/展期 {extension_days} 天。"
                            f"请核实是否已办理正式展期手续，是否存在未记录的展期协议。"
                        ),
                        related_materials=(
                            f"贷款账号: {account.account_no}; "
                            f"原到期日期: {account.loan_due_date}; "
                            f"实际还款日期: {account.actual_repayment_date}; "
                            f"剩余本金: {account.outstanding_principal}; "
                            f"当前状态: {account.status}"
                        ),
                        is_extended=True,
                        extension_days=extension_days
                    )
                    warnings.append(warning)

        return warnings

    def detect_data_quality_issues(self) -> List[WarningRecord]:
        warnings = []

        accounts = self.db.query(LoanAccount).filter(
            LoanAccount.data_quality_notes != ""
        ).all()

        for account in accounts:
            if account.data_quality_notes:
                warning = WarningRecord(
                    account_no=account.account_no,
                    customer_id=account.customer_id,
                    warning_type="DATA_QUALITY_ISSUE",
                    warning_level="LOW",
                    warning_message=(
                        f"数据质量问题: {account.data_quality_notes}。"
                        f"请补全或核实相关数据。"
                    ),
                    related_materials=(
                        f"原始数据: {account.raw_data or '无'}"
                    ),
                    is_extended=False
                )
                warnings.append(warning)

        return warnings

    def run_all_checks(self, warning_days: int = 7) -> List[WarningRecord]:
        all_warnings = []

        checks = [
            self.detect_multi_account_customers,
            lambda: self.detect_overdue_loans(warning_days),
            self.detect_refund_cross_clearing,
            self.detect_suspected_extension,
            self.detect_data_quality_issues
        ]

        for check in checks:
            try:
                warnings = check()
                all_warnings.extend(warnings)
            except Exception as e:
                print(f"预警检查执行异常: {str(e)}")

        return all_warnings

    def save_warnings(self, warnings: List[WarningRecord]) -> Tuple[int, int]:
        new_count = 0
        skip_count = 0

        existing_keys = set()
        existing = self.db.query(WarningRecord).all()
        for w in existing:
            key = (w.account_no, w.warning_type, w.warning_message[:100])
            existing_keys.add(key)

        for warning in warnings:
            key = (warning.account_no, warning.warning_type, warning.warning_message[:100])
            if key not in existing_keys:
                self.db.add(warning)
                new_count += 1
                existing_keys.add(key)
            else:
                skip_count += 1

        self.db.commit()
        return new_count, skip_count
