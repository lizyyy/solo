from datetime import datetime, timedelta
from typing import List
from .models import DailyData, ValidationIssue, MenuItem, Reservation


class Validator:
    MIN_WEIGHT = 100
    DESTRUCTION_GRACE_PERIOD_HOURS = 48

    def validate(self, daily_data: DailyData, current_time: datetime = None) -> List[ValidationIssue]:
        if current_time is None:
            current_time = datetime.now()

        issues = []
        issues.extend(self._check_missing_reservations(daily_data))
        issues.extend(self._check_weight_issues(daily_data))
        issues.extend(self._check_duplicate_reservations(daily_data))
        issues.extend(self._check_premature_destruction(daily_data))
        issues.extend(self._check_expired_reservations(daily_data, current_time))

        return issues

    def _check_missing_reservations(self, daily_data: DailyData) -> List[ValidationIssue]:
        issues = []
        reserved_item_ids = {
            res.menu_item_id
            for res in daily_data.reservations
            if res.status in ["registered", "destroyed"]
        }

        missed_item_ids = {item["menu_item_id"] for item in daily_data.missed_items}

        for item in daily_data.menu_items:
            if item.id not in reserved_item_ids and item.id not in missed_item_ids:
                issues.append(ValidationIssue(
                    type="missing",
                    severity="high",
                    message=f"菜品未留样: {item.name} (窗口: {item.window})",
                    menu_item=item
                ))

        return issues

    def _check_weight_issues(self, daily_data: DailyData) -> List[ValidationIssue]:
        issues = []
        for res in daily_data.reservations:
            if res.weight < self.MIN_WEIGHT:
                issues.append(ValidationIssue(
                    type="weight",
                    severity="medium",
                    message=f"留样重量不足: {res.menu_item_name} - {res.weight}g (最低要求: {self.MIN_WEIGHT}g)",
                    reservation=res
                ))

        return issues

    def _check_duplicate_reservations(self, daily_data: DailyData) -> List[ValidationIssue]:
        issues = []
        item_reservations = {}

        for res in daily_data.reservations:
            if res.status in ["registered", "destroyed"]:
                if res.menu_item_id not in item_reservations:
                    item_reservations[res.menu_item_id] = []
                item_reservations[res.menu_item_id].append(res)

        for item_id, reservations in item_reservations.items():
            if len(reservations) > 1:
                item = next(
                    (item for item in daily_data.menu_items if item.id == item_id),
                    None
                )
                item_name = item.name if item else item_id
                issues.append(ValidationIssue(
                    type="duplicate",
                    severity="high",
                    message=f"同一菜品重复登记: {item_name} - 已登记 {len(reservations)} 次",
                    menu_item=item
                ))

        return issues

    def _check_premature_destruction(self, daily_data: DailyData) -> List[ValidationIssue]:
        issues = []
        for res in daily_data.reservations:
            if (
                res.status == "destroyed"
                and res.actual_destruction_time
                and res.actual_destruction_time < res.expected_destruction_time
            ):
                issues.append(ValidationIssue(
                    type="premature",
                    severity="high",
                    message=f"销毁过早: {res.menu_item_name} - 预计销毁时间: {res.expected_destruction_time.strftime('%Y-%m-%d %H:%M')}, 实际销毁时间: {res.actual_destruction_time.strftime('%Y-%m-%d %H:%M')}",
                    reservation=res
                ))

        return issues

    def _check_expired_reservations(self, daily_data: DailyData, current_time: datetime) -> List[ValidationIssue]:
        issues = []
        for res in daily_data.reservations:
            if (
                res.status == "registered"
                and current_time > res.expected_destruction_time
            ):
                issues.append(ValidationIssue(
                    type="expired",
                    severity="medium",
                    message=f"留样已过期未销毁: {res.menu_item_name} - 预计销毁时间: {res.expected_destruction_time.strftime('%Y-%m-%d %H:%M')}",
                    reservation=res
                ))

        return issues

    def get_destruction_reminders(self, daily_data: DailyData, hours_before: int = 2) -> List[Reservation]:
        current_time = datetime.now()
        reminders = []

        for res in daily_data.reservations:
            if res.status == "registered":
                time_diff = res.expected_destruction_time - current_time
                if 0 < time_diff.total_seconds() < hours_before * 3600:
                    reminders.append(res)

        return reminders

    def get_responsible_persons(self, daily_data: DailyData) -> dict:
        statistics = {
            "operators": {},
            "windows": {}
        }

        for item in daily_data.missed_items:
            operator = item.get("operator", "未知")
            if operator not in statistics["operators"]:
                statistics["operators"][operator] = 0
            statistics["operators"][operator] += 1

            menu_item = next(
                (mi for mi in daily_data.menu_items if mi.id == item["menu_item_id"]),
                None
            )
            if menu_item:
                window = menu_item.window
                if window not in statistics["windows"]:
                    statistics["windows"][window] = 0
                statistics["windows"][window] += 1

        for res in daily_data.reservations:
            if res.status in ["registered", "destroyed"]:
                operator = res.operator
                if operator not in statistics["operators"]:
                    statistics["operators"][operator] = 0

        return statistics
