from datetime import datetime, timedelta
from typing import List, Tuple, Dict, Set

from models import (
    CreditLine, FreezeRecord, ReviewReport, RiskFlag, DataSourceStatus,
    PendingConfirmation, GapCalculationResult, UserFriendlyError
)
from error_messages import get_user_friendly_error, get_risk_flag_description


class RiskDetector:
    def __init__(self) -> None:
        self.pending_items: List[PendingConfirmation] = []
        self.risk_flags: List[RiskFlag] = []
        self.human_notes: List[str] = []

    def reset(self) -> None:
        self.pending_items = []
        self.risk_flags = []
        self.human_notes = []

    def detect_freeze_not_released(
        self,
        freeze_records: List[FreezeRecord],
        gap_result_id: str
    ) -> float:
        unreleased = [f for f in freeze_records if not f.is_released]
        total_amount = sum(f.amount for f in unreleased)

        if unreleased:
            self.risk_flags.append(RiskFlag.FREEZE_NOT_RELEASED)

            msg, suggestion = get_user_friendly_error(
                "FREEZE_NOT_RELEASED", count=len(unreleased)
            )
            self.human_notes.append(msg)
            if suggestion:
                self.human_notes.append(f"建议：{suggestion}")

            desc = get_risk_flag_description(
                RiskFlag.FREEZE_NOT_RELEASED,
                count=len(unreleased),
                amount=total_amount / 10000
            )
            affected = [f"冻结单{f.freeze_id}（{f.freeze_reason}，{f.amount:,.2f}元）"
                       for f in unreleased]
            pc = PendingConfirmation(
                gap_result_id=gap_result_id,
                risk_flag=RiskFlag.FREEZE_NOT_RELEASED,
                description=desc,
                affected_items=affected
            )
            self.pending_items.append(pc)

        return total_amount

    def detect_duplicate_credit(
        self,
        credit_lines: List[CreditLine],
        gap_result_id: str
    ) -> Tuple[float, List[CreditLine]]:
        customer_credits: Dict[str, List[CreditLine]] = {}
        for credit in credit_lines:
            if credit.customer_id not in customer_credits:
                customer_credits[credit.customer_id] = []
            customer_credits[credit.customer_id].append(credit)

        duplicate_customers = {
            cid: credits for cid, credits in customer_credits.items()
            if len(credits) > 1
        }

        if duplicate_customers:
            self.risk_flags.append(RiskFlag.DUPLICATE_CREDIT)

            count = len(duplicate_customers)
            total_amount = sum(
                sum(c.total_amount for c in credits)
                for credits in duplicate_customers.values()
            )

            msg, suggestion = get_user_friendly_error(
                "DUPLICATE_CREDIT", count=count
            )
            self.human_notes.append(msg)
            if suggestion:
                self.human_notes.append(f"建议：{suggestion}")

            affected = []
            for cid, credits in duplicate_customers.items():
                cname = credits[0].customer_name
                credit_info = "、".join(
                    [f"{c.credit_id}({c.total_amount:,.2f}元)" for c in credits]
                )
                affected.append(f"客户{cname}（{cid}）：{credit_info}")

            desc = get_risk_flag_description(
                RiskFlag.DUPLICATE_CREDIT,
                count=count,
                amount=total_amount / 10000
            )
            pc = PendingConfirmation(
                gap_result_id=gap_result_id,
                risk_flag=RiskFlag.DUPLICATE_CREDIT,
                description=desc,
                affected_items=affected
            )
            self.pending_items.append(pc)

            duplicate_credits = [
                c for credits in duplicate_customers.values() for c in credits
            ]
            return total_amount, duplicate_credits

        return 0.0, []

    def detect_manual_note_override(
        self,
        credit_lines: List[CreditLine],
        review_report: ReviewReport,
        gap_result_id: str
    ) -> List[CreditLine]:
        overridden = [
            c for c in credit_lines
            if c.manual_note is not None and c.previous_conclusion is not None
        ]

        if overridden:
            self.risk_flags.append(RiskFlag.MANUAL_NOTE_OVERRIDE)

            msg, suggestion = get_user_friendly_error(
                "MANUAL_NOTE_OVERRIDE", count=len(overridden)
            )
            self.human_notes.append(msg)
            if suggestion:
                self.human_notes.append(f"建议：{suggestion}")

            affected = []
            for c in overridden:
                affected.append(
                    f"授信{c.credit_id}（{c.customer_name}）："
                    f"原结论\"{c.previous_conclusion}\" → "
                    f"现备注\"{c.manual_note}\""
                )

            desc = get_risk_flag_description(
                RiskFlag.MANUAL_NOTE_OVERRIDE, count=len(overridden)
            )
            pc = PendingConfirmation(
                gap_result_id=gap_result_id,
                risk_flag=RiskFlag.MANUAL_NOTE_OVERRIDE,
                description=desc,
                affected_items=affected
            )
            self.pending_items.append(pc)

        return overridden

    def detect_late_supplement(
        self,
        review_report: ReviewReport,
        gap_result_id: str
    ) -> bool:
        if (review_report.supplementary_email_date is not None
                and review_report.data_source == DataSourceStatus.SUPPLEMENTED):
            days_late = (review_report.created_at.date()
                        - review_report.supplementary_email_date.date()).days

            if days_late > 0:
                self.risk_flags.append(RiskFlag.LATE_SUPPLEMENT)
                if RiskFlag.LATE_SUPPLEMENT not in review_report.risk_flags:
                    review_report.risk_flags.append(RiskFlag.LATE_SUPPLEMENT)

                msg, suggestion = get_user_friendly_error(
                    "LATE_SUPPLEMENT", days=days_late
                )
                self.human_notes.append(msg)
                if suggestion:
                    self.human_notes.append(f"建议：{suggestion}")

                desc = get_risk_flag_description(
                    RiskFlag.LATE_SUPPLEMENT, days=days_late
                )
                pc = PendingConfirmation(
                    gap_result_id=gap_result_id,
                    risk_flag=RiskFlag.LATE_SUPPLEMENT,
                    description=desc,
                    affected_items=[
                        f"补充邮件日期：{review_report.supplementary_email_date.date()}",
                        f"日报补传日期：{review_report.created_at.date()}"
                    ]
                )
                self.pending_items.append(pc)
                return True
        return False

    def detect_missing_review_report(
        self,
        review_report: ReviewReport,
        calculation_date: datetime,
        gap_result_id: str
    ) -> bool:
        if review_report is None:
            self.risk_flags.append(RiskFlag.MISSING_REVIEW_REPORT)

            msg, suggestion = get_user_friendly_error("MISSING_REVIEW_REPORT")
            self.human_notes.append(msg)
            if suggestion:
                self.human_notes.append(f"建议：{suggestion}")

            desc = get_risk_flag_description(
                RiskFlag.MISSING_REVIEW_REPORT, date=calculation_date.date()
            )
            pc = PendingConfirmation(
                gap_result_id=gap_result_id,
                risk_flag=RiskFlag.MISSING_REVIEW_REPORT,
                description=desc,
                affected_items=[f"应上传日期：{calculation_date.date()}"]
            )
            self.pending_items.append(pc)
            return True
        return False

    def validate_credit_data(self, credit_lines: List[CreditLine]) -> None:
        for credit in credit_lines:
            if credit.total_amount <= 0:
                user_msg, suggestion = get_user_friendly_error(
                    "INVALID_CREDIT_DATA",
                    detail=f"客户{credit.customer_name}的授信总额{credit.total_amount}不是正数"
                )
                raise UserFriendlyError(
                    error_code="INVALID_CREDIT_DATA",
                    user_message=user_msg,
                    suggestion=suggestion
                )

            if credit.used_amount < 0:
                user_msg, suggestion = get_user_friendly_error(
                    "INVALID_CREDIT_DATA",
                    detail=f"客户{credit.customer_name}的已用额度{credit.used_amount}是负数"
                )
                raise UserFriendlyError(
                    error_code="INVALID_CREDIT_DATA",
                    user_message=user_msg,
                    suggestion=suggestion
                )

            if credit.used_amount > credit.total_amount:
                user_msg, suggestion = get_user_friendly_error(
                    "INVALID_CREDIT_DATA",
                    detail=f"客户{credit.customer_name}的已用额度超过了授信总额"
                )
                raise UserFriendlyError(
                    error_code="INVALID_CREDIT_DATA",
                    user_message=user_msg,
                    suggestion=suggestion
                )

            if credit.effective_date > credit.expiry_date:
                user_msg, suggestion = get_user_friendly_error(
                    "INVALID_CREDIT_DATA",
                    detail=f"客户{credit.customer_name}的授信生效日晚于到期日"
                )
                raise UserFriendlyError(
                    error_code="INVALID_CREDIT_DATA",
                    user_message=user_msg,
                    suggestion=suggestion
                )
