from typing import List
from .base_rule import BaseRule, RuleContext
from ..models import ValidationResult


class WindowExpiryRule(BaseRule):
    rule_id = "R002"
    rule_name = "放开窗口到期校验"
    description = "检查放开窗口是否已到期，活动窗口是否超过预期时间"

    def validate(self, context: RuleContext) -> List[ValidationResult]:
        results = []

        for window in context.parse_result.windows:
            exception = context.exceptions_by_id.get(window.exception_id)

            if window.is_active:
                if context.audit_time > window.end_time:
                    results.append(
                        self._fail(
                            f"放开窗口已到期但仍处于活动状态: {window.start_time} ~ {window.end_time}",
                            details={
                                "window_id": window.id,
                                "exception_id": window.exception_id,
                                "start_time": window.start_time.isoformat(),
                                "end_time": window.end_time.isoformat(),
                                "audit_time": context.audit_time.isoformat(),
                                "is_active": window.is_active,
                                "overdue_hours": round(
                                    (context.audit_time - window.end_time).total_seconds() / 3600, 2
                                ),
                                "source_location": window.source.get_location_str(),
                            },
                            related_records=[window.id, window.exception_id],
                        )
                    )
                else:
                    results.append(
                        self._warn(
                            f"放开窗口处于活动状态: {window.start_time} ~ {window.end_time}",
                            details={
                                "window_id": window.id,
                                "exception_id": window.exception_id,
                                "source_location": window.source.get_location_str(),
                            },
                            related_records=[window.id, window.exception_id],
                        )
                    )
            else:
                if window.actual_end_time:
                    expected_end = window.end_time
                    actual_end = window.actual_end_time

                    if actual_end > expected_end:
                        results.append(
                            self._warn(
                                f"窗口实际结束时间晚于预期: 预期 {expected_end}, 实际 {actual_end}",
                                details={
                                    "window_id": window.id,
                                    "exception_id": window.exception_id,
                                    "expected_end": expected_end.isoformat(),
                                    "actual_end": actual_end.isoformat(),
                                    "overrun_hours": round(
                                        (actual_end - expected_end).total_seconds() / 3600, 2
                                    ),
                                    "source_location": window.source.get_location_str(),
                                },
                                related_records=[window.id, window.exception_id],
                            )
                        )
                    else:
                        results.append(
                            self._pass(
                                f"窗口正常关闭: {window.start_time} ~ {actual_end}",
                                details={
                                    "window_id": window.id,
                                    "exception_id": window.exception_id,
                                    "source_location": window.source.get_location_str(),
                                },
                                related_records=[window.id, window.exception_id],
                            )
                        )
                else:
                    results.append(
                        self._warn(
                            f"窗口标记为非活动但未记录实际结束时间: {window.id}",
                            details={
                                "window_id": window.id,
                                "exception_id": window.exception_id,
                                "source_location": window.source.get_location_str(),
                            },
                            related_records=[window.id, window.exception_id],
                        )
                    )

        if not results:
            results.append(self._skip("无放开窗口记录"))

        return results
