from dataclasses import dataclass
from enum import Enum
from typing import Any, Dict, List, Optional


class ValidationLevel(Enum):
    ERROR = "错误"
    WARNING = "警告"
    INFO = "提示"


class ValidationCode(Enum):
    DUPLICATE_SEAT = "E001"
    INVALID_SEAT_NUMBER = "E002"
    INVALID_ROW = "E003"
    OVERLAPPING_AREA = "E004"
    WHEELCHAIR_ACCESS_ISSUE = "E005"
    PACKAGE_SEAT_CONFLICT = "E006"
    EXTRA_SEAT_WITHOUT_PARENT = "E007"
    CAPACITY_EXCEEDED = "E008"
    MISSING_REQUIRED_FIELD = "E009"
    INVALID_SEAT_TYPE = "E010"
    PRICE_ANOMALY = "W001"
    ISOLATED_SEAT = "W002"
    EMPTY_ROW = "W003"
    SEAT_SKIPPED = "I001"


@dataclass
class ValidationIssue:
    level: ValidationLevel
    code: ValidationCode
    message: str
    seat_id: Optional[str] = None
    row: Optional[str] = None
    details: Optional[Dict[str, Any]] = None


class SeatValidator:
    def __init__(self):
        self.issues: List[ValidationIssue] = []
        self.processed_seats = set()
        self.row_seat_map: Dict[str, set] = {}
        self.extra_seat_parents = set()
        self.wheelchair_zones = set()
        self.package_groups: Dict[str, List[str]] = {}

    def validate(self, parsed_data: Dict[str, Any]) -> List[ValidationIssue]:
        self.issues = []
        self.processed_seats = set()
        self.row_seat_map = {}
        self.extra_seat_parents = set()
        self.wheelchair_zones = set()
        self.package_groups = {}

        seats = parsed_data.get('seats', [])
        
        for seat in seats:
            self._validate_single_seat(seat)
        
        self._validate_cross_seat_rules()
        
        return self.issues

    def _validate_single_seat(self, seat: Dict[str, Any]):
        seat_id = seat.get('seat_id') or seat.get('座位编号')
        row = seat.get('row') or seat.get('排号')
        seat_num = seat.get('seat_number') or seat.get('座号')
        seat_type = seat.get('type') or seat.get('类型', 'normal')
        is_extra = seat.get('is_extra') or seat.get('是否加座', False)
        is_wheelchair = seat.get('is_wheelchair') or seat.get('是否轮椅位', False)
        package_id = seat.get('package_id') or seat.get('套票组')
        parent_seat = seat.get('parent_seat') or seat.get('父座位')

        if not seat_id:
            self._add_issue(
                ValidationLevel.ERROR,
                ValidationCode.MISSING_REQUIRED_FIELD,
                "座位缺少必填字段: seat_id",
                details=seat
            )
            return

        if seat_id in self.processed_seats:
            self._add_issue(
                ValidationLevel.ERROR,
                ValidationCode.DUPLICATE_SEAT,
                f"座位编号重复: {seat_id}",
                seat_id=seat_id,
                row=row
            )
            return

        self.processed_seats.add(seat_id)

        if row:
            if row not in self.row_seat_map:
                self.row_seat_map[row] = set()
            self.row_seat_map[row].add(seat_id)

        if is_extra:
            if parent_seat:
                self.extra_seat_parents.add(parent_seat)
            else:
                self._add_issue(
                    ValidationLevel.ERROR,
                    ValidationCode.EXTRA_SEAT_WITHOUT_PARENT,
                    f"加座 {seat_id} 缺少关联的父座位编号",
                    seat_id=seat_id,
                    row=row
                )

        if is_wheelchair:
            if row:
                self.wheelchair_zones.add(row)

        if package_id:
            if package_id not in self.package_groups:
                self.package_groups[package_id] = []
            self.package_groups[package_id].append(seat_id)

        if seat_num and isinstance(seat_num, (int, float)):
            if seat_num <= 0:
                self._add_issue(
                    ValidationLevel.ERROR,
                    ValidationCode.INVALID_SEAT_NUMBER,
                    f"座号无效，应为正整数: {seat_num}",
                    seat_id=seat_id,
                    row=row
                )

        valid_types = ['normal', 'extra', 'wheelchair', 'vip', 'box']
        if seat_type not in valid_types:
            self._add_issue(
                ValidationLevel.ERROR,
                ValidationCode.INVALID_SEAT_TYPE,
                f"座位类型无效: {seat_type}，有效类型: {valid_types}",
                seat_id=seat_id,
                row=row
            )

        price = seat.get('price') or seat.get('价格')
        if price is not None and isinstance(price, (int, float)):
            if price < 0:
                self._add_issue(
                    ValidationLevel.WARNING,
                    ValidationCode.PRICE_ANOMALY,
                    f"票价为负值: {price}",
                    seat_id=seat_id,
                    row=row
                )

    def _validate_cross_seat_rules(self):
        for package_id, seats in self.package_groups.items():
            if len(seats) < 2:
                self._add_issue(
                    ValidationLevel.WARNING,
                    ValidationCode.PACKAGE_SEAT_CONFLICT,
                    f"套票组 {package_id} 座位数不足，仅 {len(seats)} 个座位",
                    details={'package_id': package_id, 'seats': seats}
                )

        for extra_parent in self.extra_seat_parents:
            if extra_parent not in self.processed_seats:
                self._add_issue(
                    ValidationLevel.ERROR,
                    ValidationCode.EXTRA_SEAT_WITHOUT_PARENT,
                    f"加座关联的父座位 {extra_parent} 不存在于座位列表中",
                    details={'parent_seat': extra_parent}
                )

        for row, seats in self.row_seat_map.items():
            if len(seats) > 50:
                self._add_issue(
                    ValidationLevel.WARNING,
                    ValidationCode.CAPACITY_EXCEEDED,
                    f"第 {row} 排座位数过多: {len(seats)} 个，可能超出剧场容量",
                    row=row
                )

    def _add_issue(self, level: ValidationLevel, code: ValidationCode, message: str,
                   seat_id: Optional[str] = None, row: Optional[str] = None,
                   details: Optional[Dict[str, Any]] = None):
        self.issues.append(ValidationIssue(
            level=level,
            code=code,
            message=message,
            seat_id=seat_id,
            row=row,
            details=details
        ))
