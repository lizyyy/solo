from typing import List
from .base_rule import BaseRule, RuleContext
from ..models import ValidationResult


class RecoveryValidationRule(BaseRule):
    rule_id = "R003"
    rule_name = "恢复动作校验"
    description = "检查每个放开窗口是否有对应的恢复动作，恢复是否成功及时"

    def validate(self, context: RuleContext) -> List[ValidationResult]:
        results = []

        for window in context.parse_result.windows:
            recoveries = context.recoveries_by_window_id.get(window.id, [])

            if not recoveries:
                if not window.is_active:
                    results.append(
                        self._fail(
                            f"窗口已关闭但无恢复记录: {window.id}",
                            details={
                                "window_id": window.id,
                                "exception_id": window.exception_id,
                                "start_time": window.start_time.isoformat(),
                                "end_time": window.end_time.isoformat(),
                                "is_active": window.is_active,
                                "source_location": window.source.get_location_str(),
                            },
                            related_records=[window.id],
                        )
                    )
                else:
                    results.append(
                        self._warn(
                            f"活动窗口暂无恢复记录: {window.id}",
                            details={
                                "window_id": window.id,
                                "source_location": window.source.get_location_str(),
                            },
                            related_records=[window.id],
                        )
                    )
            else:
                successful_recoveries = [r for r in recoveries if r.is_successful]
                failed_recoveries = [r for r in recoveries if not r.is_successful]

                if failed_recoveries:
                    for recovery in failed_recoveries:
                        results.append(
                            self._fail(
                                f"恢复动作失败: {recovery.recovered_by} at {recovery.recovered_at}",
                                details={
                                    "recovery_id": recovery.id,
                                    "window_id": recovery.window_id,
                                    "recovered_by": recovery.recovered_by,
                                    "recovered_at": recovery.recovered_at.isoformat(),
                                    "recovery_method": recovery.recovery_method,
                                    "source_location": recovery.source.get_location_str(),
                                },
                                related_records=[recovery.id, recovery.window_id],
                            )
                        )

                if successful_recoveries:
                    latest_recovery = max(
                        successful_recoveries, key=lambda r: r.recovered_at
                    )
                    if window.end_time and latest_recovery.recovered_at > window.end_time:
                        results.append(
                            self._warn(
                                f"恢复时间晚于窗口结束时间: 窗口结束 {window.end_time}, 恢复 {latest_recovery.recovered_at}",
                                details={
                                    "recovery_id": latest_recovery.id,
                                    "window_id": window.id,
                                    "window_end": window.end_time.isoformat(),
                                    "recovered_at": latest_recovery.recovered_at.isoformat(),
                                    "delay_hours": round(
                                        (latest_recovery.recovered_at - window.end_time).total_seconds() / 3600, 2
                                    ),
                                    "source_location": latest_recovery.source.get_location_str(),
                                },
                                related_records=[latest_recovery.id, window.id],
                            )
                        )
                    else:
                        results.append(
                            self._pass(
                                f"恢复成功: {latest_recovery.recovered_by} at {latest_recovery.recovered_at}",
                                details={
                                    "recovery_id": latest_recovery.id,
                                    "window_id": window.id,
                                    "source_location": latest_recovery.source.get_location_str(),
                                },
                                related_records=[latest_recovery.id, window.id],
                            )
                        )

        if not results:
            results.append(self._skip("无放开窗口记录"))

        return results
