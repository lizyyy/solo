from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum
from parser import DataRow, DataSourceType


class ValidationRule(Enum):
    EQUIPMENT_LIST_MATCH = "equipment_list_match"
    RETURN_COMPLETENESS = "return_completeness"
    DEPOSIT_STATUS_CONSISTENCY = "deposit_status_consistency"
    POINTS_CALCULATION_ACCURACY = "points_calculation_accuracy"
    ITEM_MISSING_DETECTION = "item_missing_detection"


@dataclass
class ValidationIssue:
    rule: ValidationRule
    severity: str
    message: str
    source_rows: List[DataRow] = field(default_factory=list)
    related_ids: Dict[str, str] = field(default_factory=dict)
    missing_items: List[str] = field(default_factory=list)


class RuleValidator:
    def __init__(self):
        self.issues: List[ValidationIssue] = []
        self.members: Dict[str, DataRow] = {}
        self.rentals: Dict[str, DataRow] = {}
        self.equipments: Dict[str, DataRow] = {}
        self.return_checks: Dict[str, List[DataRow]] = {}
        self.deposits: Dict[str, DataRow] = {}
        self.points_per_yuan: float = 10.0
        self.level_multipliers: Dict[str, float] = {
            '普通': 1.0,
            '银卡': 1.2,
            '金卡': 1.5,
            '钻石': 2.0
        }

    def load_data(self, rows: List[DataRow]) -> None:
        for row in rows:
            if not row.is_valid:
                continue
            data = row.parsed_data
            if row.source_type == DataSourceType.MEMBER:
                self.members[data['member_id']] = row
            elif row.source_type == DataSourceType.RENTAL:
                self.rentals[data['rental_id']] = row
            elif row.source_type == DataSourceType.EQUIPMENT:
                self.equipments[data['equipment_id']] = row
            elif row.source_type == DataSourceType.RETURN_CHECK:
                rental_id = data['rental_id']
                if rental_id not in self.return_checks:
                    self.return_checks[rental_id] = []
                self.return_checks[rental_id].append(row)
            elif row.source_type == DataSourceType.DEPOSIT:
                self.deposits[data['rental_id']] = row

    def validate_all(self) -> List[ValidationIssue]:
        self.issues = []
        self._validate_equipment_list_match()
        self._validate_return_completeness()
        self._validate_deposit_status_consistency()
        self._validate_item_missing_detection()
        self._validate_points_calculation_accuracy()
        return sorted(self.issues, key=lambda x: (x.severity, x.rule.value))

    def _calculate_expected_points(self, rental_id: str) -> int:
        if rental_id not in self.rentals:
            return 0

        rental_row = self.rentals[rental_id]
        rental_data = rental_row.parsed_data
        member_id = rental_data['member_id']

        member_level = '普通'
        if member_id in self.members:
            member_data = self.members[member_id].parsed_data
            member_level = member_data['member_level']

        deduction_amount = 0.0
        if rental_id in self.return_checks:
            for check_row in sorted(self.return_checks[rental_id],
                                  key=lambda r: r.parsed_data['equipment_id']):
                check_data = check_row.parsed_data
                eq_id = check_data['equipment_id']
                if eq_id not in self.equipments:
                    continue
                eq_data = self.equipments[eq_id].parsed_data

                if eq_data['hook_included'] and not check_data['hook_returned']:
                    deduction_amount += eq_data['hook_price']
                if eq_data['line_included'] and not check_data['line_returned']:
                    deduction_amount += eq_data['line_price']
                if eq_data['net_included'] and not check_data['net_returned']:
                    deduction_amount += eq_data['net_price']

        multiplier = self.level_multipliers.get(member_level, 1.0)
        return int(round(deduction_amount * self.points_per_yuan * multiplier))

    def _validate_points_calculation_accuracy(self) -> None:
        for rental_id in sorted(self.rentals.keys()):
            if rental_id not in self.deposits:
                continue

            deposit_row = self.deposits[rental_id]
            deposit_data = deposit_row.parsed_data

            expected_points = self._calculate_expected_points(rental_id)
            actual_points = deposit_data['points_compensated']

            if expected_points != actual_points:
                rental_row = self.rentals[rental_id]
                source_rows = [deposit_row, rental_row]
                if rental_id in self.return_checks:
                    source_rows.extend(sorted(self.return_checks[rental_id],
                                           key=lambda r: r.parsed_data['equipment_id']))

                self.issues.append(ValidationIssue(
                    rule=ValidationRule.POINTS_CALCULATION_ACCURACY,
                    severity='high',
                    message=f"租借单 {rental_id}: 积分补偿计算不一致 "
                           f"(应补:{expected_points}, 实补:{actual_points}, 差异:{expected_points - actual_points:+d})",
                    source_rows=source_rows,
                    related_ids={'rental_id': rental_id}
                ))

    def _validate_equipment_list_match(self) -> None:
        for rental_id, rental_row in sorted(self.rentals.items()):
            rental_data = rental_row.parsed_data
            expected_equipments = set(rental_data['equipment_ids'])
            actual_equipments = set()

            if rental_id in self.return_checks:
                for check_row in sorted(self.return_checks[rental_id], 
                                      key=lambda r: r.parsed_data['equipment_id']):
                    actual_equipments.add(check_row.parsed_data['equipment_id'])

            missing_in_return = sorted(expected_equipments - actual_equipments)
            extra_in_return = sorted(actual_equipments - expected_equipments)

            if missing_in_return:
                self.issues.append(ValidationIssue(
                    rule=ValidationRule.EQUIPMENT_LIST_MATCH,
                    severity='high',
                    message=f"租借单 {rental_id}: 归还清单缺少渔具: {', '.join(missing_in_return)}",
                    source_rows=[rental_row],
                    related_ids={'rental_id': rental_id},
                    missing_items=missing_in_return
                ))

            if extra_in_return:
                self.issues.append(ValidationIssue(
                    rule=ValidationRule.EQUIPMENT_LIST_MATCH,
                    severity='medium',
                    message=f"租借单 {rental_id}: 归还清单有额外渔具: {', '.join(extra_in_return)}",
                    source_rows=[rental_row],
                    related_ids={'rental_id': rental_id}
                ))

    def _validate_return_completeness(self) -> None:
        for rental_id in sorted(self.rentals.keys()):
            if rental_id not in self.return_checks:
                rental_row = self.rentals[rental_id]
                self.issues.append(ValidationIssue(
                    rule=ValidationRule.RETURN_COMPLETENESS,
                    severity='high',
                    message=f"租借单 {rental_id}: 没有归还检查记录",
                    source_rows=[rental_row],
                    related_ids={'rental_id': rental_id}
                ))
                continue

            for check_row in sorted(self.return_checks[rental_id], 
                                  key=lambda r: r.parsed_data['equipment_id']):
                check_data = check_row.parsed_data
                eq_id = check_data['equipment_id']
                if eq_id not in self.equipments:
                    continue

                eq_data = self.equipments[eq_id].parsed_data
                missing_items = []

                if eq_data['hook_included'] and not check_data['hook_returned']:
                    missing_items.append('鱼钩')
                if eq_data['line_included'] and not check_data['line_returned']:
                    missing_items.append('鱼线')
                if eq_data['net_included'] and not check_data['net_returned']:
                    missing_items.append('鱼护')

                if missing_items:
                    self.issues.append(ValidationIssue(
                        rule=ValidationRule.RETURN_COMPLETENESS,
                        severity='high',
                        message=f"租借单 {rental_id} 渔具 {eq_id}: 缺少 {', '.join(missing_items)}",
                        source_rows=[check_row, self.equipments[eq_id]],
                        related_ids={'rental_id': rental_id, 'equipment_id': eq_id},
                        missing_items=missing_items
                    ))

    def _validate_deposit_status_consistency(self) -> None:
        for rental_id in sorted(self.rentals.keys()):
            rental_row = self.rentals[rental_id]
            rental_data = rental_row.parsed_data

            if rental_id not in self.deposits:
                self.issues.append(ValidationIssue(
                    rule=ValidationRule.DEPOSIT_STATUS_CONSISTENCY,
                    severity='medium',
                    message=f"租借单 {rental_id}: 没有押金记录",
                    source_rows=[rental_row],
                    related_ids={'rental_id': rental_id}
                ))
                continue

            deposit_row = self.deposits[rental_id]
            deposit_data = deposit_row.parsed_data

            if abs(rental_data['deposit_amount'] - deposit_data['original_deposit']) > 0.01:
                self.issues.append(ValidationIssue(
                    rule=ValidationRule.DEPOSIT_STATUS_CONSISTENCY,
                    severity='high',
                    message=f"租借单 {rental_id}: 押金金额不一致 "
                           f"(租借单:{rental_data['deposit_amount']}, 押金记录:{deposit_data['original_deposit']})",
                    source_rows=[rental_row, deposit_row],
                    related_ids={'rental_id': rental_id}
                ))

    def _validate_item_missing_detection(self) -> None:
        for rental_id in sorted(self.return_checks.keys()):
            if rental_id not in self.deposits:
                continue

            deposit_row = self.deposits[rental_id]
            deposit_data = deposit_row.parsed_data

            expected_deduction = 0.0
            missing_items_all = []

            for check_row in sorted(self.return_checks[rental_id], 
                                  key=lambda r: r.parsed_data['equipment_id']):
                check_data = check_row.parsed_data
                eq_id = check_data['equipment_id']
                if eq_id not in self.equipments:
                    continue

                eq_data = self.equipments[eq_id].parsed_data

                if eq_data['hook_included'] and not check_data['hook_returned']:
                    expected_deduction += eq_data['hook_price']
                    missing_items_all.append(f"{eq_id}-鱼钩")
                if eq_data['line_included'] and not check_data['line_returned']:
                    expected_deduction += eq_data['line_price']
                    missing_items_all.append(f"{eq_id}-鱼线")
                if eq_data['net_included'] and not check_data['net_returned']:
                    expected_deduction += eq_data['net_price']
                    missing_items_all.append(f"{eq_id}-鱼护")

            if abs(expected_deduction - deposit_data['deduction_amount']) > 0.01:
                self.issues.append(ValidationIssue(
                    rule=ValidationRule.ITEM_MISSING_DETECTION,
                    severity='high',
                    message=f"租借单 {rental_id}: 押金扣减金额不一致 "
                           f"(应扣:{expected_deduction:.2f}, 实扣:{deposit_data['deduction_amount']:.2f})",
                    source_rows=[deposit_row] + self.return_checks[rental_id],
                    related_ids={'rental_id': rental_id},
                    missing_items=missing_items_all
                ))

    def get_issues_by_severity(self, severity: str) -> List[ValidationIssue]:
        return [issue for issue in self.issues if issue.severity == severity]

    def get_issues_by_rental(self, rental_id: str) -> List[ValidationIssue]:
        return [issue for issue in self.issues if issue.related_ids.get('rental_id') == rental_id]
