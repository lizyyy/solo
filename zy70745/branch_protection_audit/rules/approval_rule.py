from typing import List
from .base_rule import BaseRule, RuleContext
from ..models import ValidationResult


class ApprovalRule(BaseRule):
    rule_id = "R001"
    rule_name = "例外审批校验"
    description = "检查例外申请是否经过正式审批，已批准申请必须有审批人"

    def validate(self, context: RuleContext) -> List[ValidationResult]:
        results = []

        for exc in context.parse_result.exceptions:
            if exc.status == "APPROVED":
                if not exc.approver:
                    results.append(
                        self._fail(
                            f"例外申请已批准但未记录审批人: {exc.applicant} - {exc.reason[:30]}",
                            details={
                                "exception_id": exc.id,
                                "applicant": exc.applicant,
                                "reason": exc.reason,
                                "status": exc.status,
                                "requested_at": exc.requested_at.isoformat(),
                                "source_location": exc.source.get_location_str(),
                            },
                            related_records=[exc.id],
                        )
                    )
                else:
                    results.append(
                        self._pass(
                            f"例外申请审批正常: {exc.applicant} -> {exc.approver}",
                            details={
                                "exception_id": exc.id,
                                "applicant": exc.applicant,
                                "approver": exc.approver,
                                "source_location": exc.source.get_location_str(),
                            },
                            related_records=[exc.id],
                        )
                    )
            elif exc.status == "REJECTED":
                results.append(
                    self._pass(
                        f"例外申请已拒绝: {exc.applicant}",
                        details={
                            "exception_id": exc.id,
                            "applicant": exc.applicant,
                            "status": exc.status,
                            "source_location": exc.source.get_location_str(),
                        },
                        related_records=[exc.id],
                    )
                )
            elif exc.status == "PENDING":
                results.append(
                    self._warn(
                        f"例外申请待审批: {exc.applicant} - {exc.reason[:30]}",
                        details={
                            "exception_id": exc.id,
                            "applicant": exc.applicant,
                            "reason": exc.reason,
                            "status": exc.status,
                            "source_location": exc.source.get_location_str(),
                        },
                        related_records=[exc.id],
                    )
                )

        if not results:
            results.append(self._skip("无例外申请记录"))

        return results
