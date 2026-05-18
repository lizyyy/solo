from dataclasses import dataclass, field
from typing import List, Dict, Any, Set, Optional
from datetime import date, datetime
from enum import Enum

from backup_cli.parser.csv_parser import ParsedRecord


class RuleType(Enum):
    DEVICE_LOCK = "device_lock"
    DEPOSIT_FREEZE = "deposit_freeze"
    OVERDUE_REMINDER = "overdue_reminder"
    DAMAGE_CHARGE = "damage_charge"
    DEPOSIT_REFUND = "deposit_refund"


class RuleStatus(Enum):
    TRIGGERED = "triggered"
    NOT_TRIGGERED = "not_triggered"
    PENDING = "pending"


@dataclass
class RuleResult:
    rule_type: RuleType
    status: RuleStatus
    message: str
    details: Dict[str, Any] = field(default_factory=dict)
    severity: str = "info"


@dataclass
class ProcessedRecord:
    original_record: ParsedRecord
    rule_results: List[RuleResult]
    summary: Dict[str, Any]
    is_returned: bool
    is_overdue: bool
    has_damage: bool
    final_deposit_refund: float
    device_locked: bool
    deposit_frozen: bool


class BusinessRuleEngine:
    def __init__(self, today: Optional[date] = None, overdue_days_threshold: int = 0):
        self.today = today or datetime.now().date()
        self.overdue_days_threshold = overdue_days_threshold
        self.active_devices: Set[str] = set()
        self.device_lock_reasons: Dict[str, List[str]] = {}

    def process_records(self, records: List[ParsedRecord]) -> List[ProcessedRecord]:
        processed_records = []
        
        self._scan_active_devices(records)
        
        for record in records:
            processed = self._process_single_record(record)
            processed_records.append(processed)
        
        processed_records.sort(key=lambda r: (
            r.original_record.data.get('repair_order_id', ''),
            r.original_record.data.get('backup_device_id', '')
        ))
        
        return processed_records

    def _scan_active_devices(self, records: List[ParsedRecord]) -> None:
        for record in records:
            device_id = record.data.get('backup_device_id', '')
            actual_return = record.data.get('actual_return_date')
            
            if not actual_return:
                self.active_devices.add(device_id)
                if device_id not in self.device_lock_reasons:
                    self.device_lock_reasons[device_id] = []
                self.device_lock_reasons[device_id].append(
                    f"维修单 {record.data.get('repair_order_id')} 未归还"
                )

    def _process_single_record(self, record: ParsedRecord) -> ProcessedRecord:
        rule_results: List[RuleResult] = []
        data = record.data
        
        is_returned = 'actual_return_date' in data and data['actual_return_date'] is not None
        is_overdue = self._check_overdue(data)
        has_damage = self._check_damage(data)
        
        deposit_amount = data.get('deposit_amount', 0.0)
        damage_charge = data.get('damage_charge_amount', 0.0) if has_damage else 0.0
        final_refund = max(0.0, deposit_amount - damage_charge)
        
        device_id = data.get('backup_device_id', '')
        device_locked = device_id in self.active_devices and not is_returned
        deposit_frozen = not is_returned or has_damage
        
        rule_results.append(self._check_device_lock(data, device_locked))
        rule_results.append(self._check_deposit_freeze(data, deposit_frozen))
        
        if is_overdue:
            rule_results.append(self._check_overdue_rule(data))
        
        if has_damage:
            rule_results.append(self._check_damage_charge(data, damage_charge))
        
        if is_returned and not has_damage:
            rule_results.append(self._check_deposit_refund(data, final_refund))
        
        summary = {
            'customer_name': data.get('customer_name', ''),
            'repair_order_id': data.get('repair_order_id', ''),
            'backup_device_id': device_id,
            'deposit_amount': deposit_amount,
            'borrow_date': data.get('borrow_date'),
            'expected_return_date': data.get('expected_return_date'),
            'actual_return_date': data.get('actual_return_date'),
            'is_returned': is_returned,
            'is_overdue': is_overdue,
            'has_damage': has_damage,
            'damage_charge': damage_charge,
            'final_deposit_refund': final_refund,
            'device_locked': device_locked,
            'deposit_frozen': deposit_frozen
        }
        
        return ProcessedRecord(
            original_record=record,
            rule_results=rule_results,
            summary=summary,
            is_returned=is_returned,
            is_overdue=is_overdue,
            has_damage=has_damage,
            final_deposit_refund=final_refund,
            device_locked=device_locked,
            deposit_frozen=deposit_frozen
        )

    def _check_overdue(self, data: Dict[str, Any]) -> bool:
        expected_return = data.get('expected_return_date')
        actual_return = data.get('actual_return_date')
        
        if not expected_return:
            return False
        
        check_date = actual_return if actual_return else self.today
        days_overdue = (check_date - expected_return).days
        
        return days_overdue > self.overdue_days_threshold

    def _check_damage(self, data: Dict[str, Any]) -> bool:
        damage_result = data.get('damage_check_result', '')
        return damage_result.lower() in ['有损坏', '损坏', '需维修', '是', 'yes', 'true'] or \
               data.get('damage_charge_amount', 0) > 0

    def _check_device_lock(self, data: Dict[str, Any], is_locked: bool) -> RuleResult:
        device_id = data.get('backup_device_id', '')
        
        if is_locked:
            reasons = self.device_lock_reasons.get(device_id, [])
            return RuleResult(
                rule_type=RuleType.DEVICE_LOCK,
                status=RuleStatus.TRIGGERED,
                message=f"备机 {device_id} 已锁定",
                details={
                    'device_id': device_id,
                    'lock_reasons': reasons,
                    'repair_order_id': data.get('repair_order_id', '')
                },
                severity="warning"
            )
        
        return RuleResult(
            rule_type=RuleType.DEVICE_LOCK,
            status=RuleStatus.NOT_TRIGGERED,
            message=f"备机 {device_id} 正常可用",
            details={'device_id': device_id},
            severity="info"
        )

    def _check_deposit_freeze(self, data: Dict[str, Any], is_frozen: bool) -> RuleResult:
        deposit = data.get('deposit_amount', 0.0)
        repair_order = data.get('repair_order_id', '')
        
        if is_frozen:
            return RuleResult(
                rule_type=RuleType.DEPOSIT_FREEZE,
                status=RuleStatus.TRIGGERED,
                message=f"维修单 {repair_order} 押金 ¥{deposit:.2f} 已冻结",
                details={
                    'repair_order_id': repair_order,
                    'deposit_amount': deposit,
                    'freeze_reason': '未归还' if not data.get('actual_return_date') else '有损坏待处理'
                },
                severity="warning"
            )
        
        return RuleResult(
            rule_type=RuleType.DEPOSIT_FREEZE,
            status=RuleStatus.NOT_TRIGGERED,
            message=f"维修单 {repair_order} 押金可正常退还",
            details={'repair_order_id': repair_order, 'deposit_amount': deposit},
            severity="info"
        )

    def _check_overdue_rule(self, data: Dict[str, Any]) -> RuleResult:
        expected_return = data.get('expected_return_date')
        actual_return = data.get('actual_return_date')
        check_date = actual_return if actual_return else self.today
        days_overdue = (check_date - expected_return).days
        
        return RuleResult(
            rule_type=RuleType.OVERDUE_REMINDER,
            status=RuleStatus.TRIGGERED,
            message=f"逾期 {days_overdue} 天: 预计 {expected_return}，{'实际' if actual_return else '今日'} {check_date}",
            details={
                'expected_return_date': expected_return,
                'actual_return_date': actual_return,
                'check_date': check_date,
                'days_overdue': days_overdue,
                'repair_order_id': data.get('repair_order_id', '')
            },
            severity="error"
        )

    def _check_damage_charge(self, data: Dict[str, Any], charge_amount: float) -> RuleResult:
        damage_desc = data.get('damage_description', '未注明具体损坏')
        
        return RuleResult(
            rule_type=RuleType.DAMAGE_CHARGE,
            status=RuleStatus.TRIGGERED,
            message=f"损坏扣款 ¥{charge_amount:.2f}: {damage_desc}",
            details={
                'damage_description': damage_desc,
                'damage_charge_amount': charge_amount,
                'repair_order_id': data.get('repair_order_id', ''),
                'backup_device_id': data.get('backup_device_id', '')
            },
            severity="error"
        )

    def _check_deposit_refund(self, data: Dict[str, Any], refund_amount: float) -> RuleResult:
        deposit = data.get('deposit_amount', 0.0)
        
        return RuleResult(
            rule_type=RuleType.DEPOSIT_REFUND,
            status=RuleStatus.TRIGGERED,
            message=f"押金可退还 ¥{refund_amount:.2f} (押金 ¥{deposit:.2f})",
            details={
                'deposit_amount': deposit,
                'refund_amount': refund_amount,
                'repair_order_id': data.get('repair_order_id', '')
            },
            severity="success"
        )
