from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple

from ..constants import DELAY_HOURS_THRESHOLD, ValidationType
from ..exceptions import TimezoneError, BudgetChangeError, BackfillError


class DelayValidator:
    def __init__(self, delay_hours: int = None):
        self.delay_hours = delay_hours or DELAY_HOURS_THRESHOLD

    def validate(
        self, records: List[Dict[str, Any]]
    ) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
        delay_records = []
        normal_records = []
        processing_issues = []

        for record in records:
            try:
                delay_result = self._check_delay(record)
                if delay_result:
                    delay_records.append(delay_result)
                else:
                    normal_records.append(record)
            except TimezoneError as e:
                processing_issues.append(
                    {
                        "type": "timezone",
                        "plan_id": record.get("plan_id"),
                        "file_path": record.get("_source_file"),
                        "message": str(e),
                        "severity": "warning",
                    }
                )
                normal_records.append(record)
            except BudgetChangeError as e:
                processing_issues.append(
                    {
                        "type": "budget_change",
                        "plan_id": record.get("plan_id"),
                        "file_path": record.get("_source_file"),
                        "message": str(e),
                        "severity": "warning",
                    }
                )
                normal_records.append(record)
            except BackfillError as e:
                processing_issues.append(
                    {
                        "type": "backfill",
                        "plan_id": record.get("plan_id"),
                        "file_path": record.get("_source_file"),
                        "message": str(e),
                        "severity": "warning",
                    }
                )
                normal_records.append(record)

        return normal_records, delay_records, processing_issues

    def _check_delay(self, record: Dict[str, Any]) -> Dict[str, Any]:
        report_time = record.get("report_time")
        date = record.get("date")

        if not report_time or not date:
            return None

        expected_report_time = date + timedelta(days=1)
        actual_delay = report_time - expected_report_time
        delay_hours = actual_delay.total_seconds() / 3600

        if delay_hours >= self.delay_hours:
            return {
                **record,
                "_validation_type": ValidationType.SUSPECTED_DELAY.value,
                "_delay_hours": round(delay_hours, 1),
                "_delay_days": round(delay_hours / 24, 1),
                "_threshold_hours": self.delay_hours,
                "_validation_note": f"疑似延迟回传，报告时间比预期晚 {round(delay_hours, 1)} 小时",
            }

        return None

    def check_special_cases(
        self, records: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        special_cases = []
        seen_plans = {}

        for record in records:
            plan_id = record.get("plan_id")
            date = record.get("date")
            budget = record.get("budget")
            report_time = record.get("report_time")

            if plan_id and date and plan_id in seen_plans:
                for prev_date, prev_budget in seen_plans[plan_id].items():
                    if prev_date < date and prev_budget != budget:
                        special_cases.append(
                            {
                                "type": ValidationType.BUDGET_CHANGE.value,
                                "plan_id": plan_id,
                                "date": date.strftime("%Y-%m-%d") if date else None,
                                "previous_budget": prev_budget,
                                "current_budget": budget,
                                "file_path": record.get("_source_file"),
                                "message": f"计划 {plan_id} 在 {date.strftime('%Y-%m-%d') if date else '?'} 发生预算变动: {prev_budget} -> {budget}",
                            }
                        )

            if plan_id:
                if plan_id not in seen_plans:
                    seen_plans[plan_id] = {}
                if date:
                    seen_plans[plan_id][date] = budget

            if date and report_time:
                days_diff = (report_time.date() - date.date()).days
                if days_diff > 7:
                    special_cases.append(
                        {
                            "type": ValidationType.BACKFILL.value,
                            "plan_id": plan_id,
                            "date": date.strftime("%Y-%m-%d") if date else None,
                            "report_date": report_time.strftime("%Y-%m-%d") if report_time else None,
                            "days_late": days_diff,
                            "file_path": record.get("_source_file"),
                            "message": f"检测到回传补写: 日期 {date.strftime('%Y-%m-%d') if date else '?'} 的报告在 {report_time.strftime('%Y-%m-%d') if report_time else '?'} 才生成，延迟 {days_diff} 天",
                        }
                    )

        return special_cases
