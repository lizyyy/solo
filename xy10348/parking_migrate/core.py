from datetime import datetime, date, timedelta
from typing import Optional, Dict, Any, List, Tuple
from dataclasses import dataclass

from .db import Database


@dataclass
class CardStatus:
    card_no: str
    owner_name: str
    plate_number: str
    space_no: str
    valid_start: Optional[date]
    valid_end: Optional[date]
    remaining_days: int
    total_paid: float
    is_expired: bool


@dataclass
class OperationResult:
    success: bool
    message: str
    requires_review: bool = False
    details: Optional[Dict[str, Any]] = None


class ParkingService:
    def __init__(self, db: Database):
        self.db = db

    def _parse_date(self, date_str: Optional[str]) -> Optional[date]:
        if not date_str:
            return None
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%Y%m%d"):
            try:
                return datetime.strptime(date_str, fmt).date()
            except ValueError:
                continue
        return None

    def _format_date(self, d: Optional[date]) -> str:
        return d.strftime("%Y-%m-%d") if d else ""

    def calculate_validity(self, card_id: int) -> Tuple[Optional[date], Optional[date], int]:
        payments = self.db.get_card_payments(card_id)
        if not payments:
            return None, None, 0
        
        valid_start: Optional[date] = None
        valid_end: Optional[date] = None
        
        for payment in payments:
            start = self._parse_date(payment["original_start_date"])
            end = self._parse_date(payment["original_end_date"])
            
            if start is None or end is None:
                continue
            
            if valid_start is None:
                valid_start = start
            
            if valid_end is None:
                valid_end = end
            else:
                if start <= valid_end:
                    overlap = (valid_end - start).days + 1
                    if overlap > 0:
                        valid_end = max(valid_end, end)
                    else:
                        valid_end = valid_end + (end - start + timedelta(days=1))
                else:
                    valid_end = end
        
        remaining_days = 0
        today = date.today()
        if valid_end and valid_start:
            if valid_end >= today:
                remaining_days = (valid_end - today).days + 1
            if remaining_days < 0:
                remaining_days = 0
        
        return valid_start, valid_end, remaining_days

    def get_card_status(self, card_no: str) -> Optional[CardStatus]:
        card = self.db.get_card_by_no(card_no)
        if not card:
            return None
        
        plate = self.db.get_active_plate(card["id"])
        space = self.db.get_active_space(card["id"])
        valid_start, valid_end, remaining = self.calculate_validity(card["id"])
        
        payments = self.db.get_card_payments(card["id"])
        total_paid = sum(p["amount"] or 0 for p in payments)
        
        return CardStatus(
            card_no=card["card_no"],
            owner_name=card["owner_name"] or "",
            plate_number=plate["plate_number"] if plate else "",
            space_no=space["space_no"] if space else "",
            valid_start=valid_start,
            valid_end=valid_end,
            remaining_days=remaining,
            total_paid=total_paid,
            is_expired=valid_end is not None and valid_end < date.today()
        )

    def create_card(
        self,
        card_no: str,
        owner_name: str,
        phone: str,
        plate_number: str,
        space_no: str,
        operator: str = "system"
    ) -> OperationResult:
        existing = self.db.get_card_by_no(card_no)
        if existing:
            return OperationResult(False, f"月卡 {card_no} 已存在")
        
        plate_owner = self.db.get_plate_owner(plate_number)
        if plate_owner:
            return OperationResult(
                False,
                f"车牌 {plate_number} 已被月卡 {plate_owner['card_no']} 使用",
                requires_review=True
            )
        
        space_owner = self.db.get_space_owner(space_no)
        if space_owner:
            return OperationResult(
                False,
                f"车位 {space_no} 已被月卡 {space_owner['card_no']} 占用",
                requires_review=True
            )
        
        now = datetime.now().isoformat()
        
        self.db.execute(
            """INSERT INTO monthly_cards 
               (card_no, owner_name, phone, created_at, created_by, updated_at)
               VALUES (?, ?, ?, ?, ?, ?)""",
            (card_no, owner_name, phone, now, operator, now)
        )
        
        card = self.db.get_card_by_no(card_no)
        card_id = card["id"]
        
        self.db.execute(
            """INSERT INTO license_plates 
               (card_id, plate_number, is_active, effective_from, created_at, created_by)
               VALUES (?, ?, 1, ?, ?, ?)""",
            (card_id, plate_number, now, now, operator)
        )
        
        self.db.execute(
            """INSERT INTO parking_spaces 
               (card_id, space_no, is_active, effective_from, created_at, created_by)
               VALUES (?, ?, 1, ?, ?, ?)""",
            (card_id, space_no, now, now, operator)
        )
        
        self.db.log_operation(
            card_id=card_id,
            operation_type="CREATE_CARD",
            operation_desc=f"创建月卡 {card_no}",
            new_value=f"{owner_name} | {plate_number} | {space_no}",
            source="manual",
            operator=operator,
            requires_review=False
        )
        
        return OperationResult(True, f"月卡 {card_no} 创建成功")

    def process_payment(
        self,
        card_no: str,
        payment_no: str,
        payment_date: str,
        amount: float,
        duration_days: int,
        start_date: str,
        source: str = "import",
        operator: str = "system"
    ) -> OperationResult:
        card = self.db.get_card_by_no(card_no)
        if not card:
            return OperationResult(False, f"月卡 {card_no} 不存在")
        
        existing_payment = self.db.get_payment_by_no(payment_no)
        if existing_payment:
            if existing_payment["card_id"] == card["id"]:
                self.db.log_operation(
                    card_id=card["id"],
                    operation_type="DUPLICATE_PAYMENT",
                    operation_desc=f"检测到重复支付流水 {payment_no}",
                    old_value=f"已存在: {existing_payment['original_start_date']} 至 {existing_payment['original_end_date']}",
                    new_value=f"尝试导入: {start_date} + {duration_days}天",
                    reason="重复支付流水，未延长有效期",
                    source=source,
                    operator=operator,
                    requires_review=True
                )
                return OperationResult(
                    False,
                    f"支付流水 {payment_no} 已存在，未重复延长有效期",
                    requires_review=True
                )
            else:
                other_card = self.db.get_card_by_no(str(
                    self.db.query_one(
                        "SELECT card_no FROM monthly_cards WHERE id = ?",
                        (existing_payment["card_id"],)
                    )["card_no"]
                ))
                self.db.log_operation(
                    card_id=card["id"],
                    operation_type="PAYMENT_CONFLICT",
                    operation_desc=f"支付流水 {payment_no} 已被其他月卡使用",
                    old_value=f"月卡 {other_card['card_no'] if other_card else 'unknown'}",
                    new_value=f"月卡 {card_no}",
                    reason="支付流水归属冲突",
                    source=source,
                    operator=operator,
                    requires_review=True
                )
                return OperationResult(
                    False,
                    f"支付流水 {payment_no} 已被其他月卡使用",
                    requires_review=True
                )
        
        valid_start, valid_end, _ = self.calculate_validity(card["id"])
        start = self._parse_date(start_date)
        if not start:
            return OperationResult(False, f"日期格式错误: {start_date}")
        
        if valid_end and start <= valid_end:
            actual_start = valid_end + timedelta(days=1)
        else:
            actual_start = start
        
        actual_end = actual_start + timedelta(days=duration_days - 1)
        
        now = datetime.now().isoformat()
        self.db.execute(
            """INSERT INTO payment_records 
               (card_id, payment_no, payment_date, amount, duration_days,
                original_start_date, original_end_date, status, source, created_at, created_by)
               VALUES (?, ?, ?, ?, ?, ?, ?, 'processed', ?, ?, ?)""",
            (
                card["id"], payment_no, payment_date, amount, duration_days,
                self._format_date(actual_start), self._format_date(actual_end),
                source, now, operator
            )
        )
        
        new_valid_end = actual_end
        new_remaining = max(0, (new_valid_end - date.today()).days + 1)
        
        self.db.log_operation(
            card_id=card["id"],
            operation_type="PAYMENT",
            operation_desc=f"续费成功: 支付流水 {payment_no}",
            old_value=f"原有效期至: {self._format_date(valid_end)}",
            new_value=f"新有效期至: {self._format_date(actual_end)} (剩余{new_remaining}天)",
            source=source,
            operator=operator,
            requires_review=False
        )
        
        return OperationResult(
            True,
            f"续费成功: 有效期延长至 {self._format_date(actual_end)}，剩余 {new_remaining} 天",
            details={
                "actual_start": self._format_date(actual_start),
                "actual_end": self._format_date(actual_end),
                "remaining_days": new_remaining
            }
        )

    def change_plate(
        self,
        card_no: str,
        new_plate: str,
        reason: str,
        effective_date: Optional[str] = None,
        source: str = "manual",
        operator: str = "system"
    ) -> OperationResult:
        card = self.db.get_card_by_no(card_no)
        if not card:
            return OperationResult(False, f"月卡 {card_no} 不存在")
        
        if not reason:
            return OperationResult(False, "车牌变更必须提供原因")
        
        current_plate = self.db.get_active_plate(card["id"])
        old_plate = current_plate["plate_number"] if current_plate else None
        
        if old_plate == new_plate:
            return OperationResult(False, "新车牌与当前车牌相同")
        
        plate_owner = self.db.get_plate_owner(new_plate)
        if plate_owner and plate_owner["id"] != card["id"]:
            return OperationResult(
                False,
                f"新车牌 {new_plate} 已被月卡 {plate_owner['card_no']} 使用",
                requires_review=True
            )
        
        now = datetime.now().isoformat()
        effective_from = effective_date or now
        
        if current_plate:
            self.db.execute(
                """UPDATE license_plates 
                   SET is_active = 0, effective_to = ?
                   WHERE id = ?""",
                (effective_from, current_plate["id"])
            )
        
        self.db.execute(
            """INSERT INTO license_plates 
               (card_id, plate_number, is_active, effective_from, created_at, created_by)
               VALUES (?, ?, 1, ?, ?, ?)""",
            (card["id"], new_plate, effective_from, now, operator)
        )
        
        self.db.log_operation(
            card_id=card["id"],
            operation_type="PLATE_CHANGE",
            operation_desc=f"车牌变更: {old_plate or '无'} -> {new_plate}",
            old_value=old_plate or "无",
            new_value=new_plate,
            reason=reason,
            source=source,
            operator=operator,
            requires_review=False
        )
        
        return OperationResult(
            True,
            f"车牌变更成功: {old_plate or '无'} -> {new_plate}"
        )

    def change_space(
        self,
        card_no: str,
        new_space: str,
        reason: str,
        effective_date: Optional[str] = None,
        source: str = "manual",
        operator: str = "system",
        force: bool = False
    ) -> OperationResult:
        card = self.db.get_card_by_no(card_no)
        if not card:
            return OperationResult(False, f"月卡 {card_no} 不存在")
        
        if not reason:
            return OperationResult(False, "车位变更必须提供原因")
        
        current_space = self.db.get_active_space(card["id"])
        old_space = current_space["space_no"] if current_space else None
        
        if old_space == new_space:
            return OperationResult(False, "新车位与当前车位相同")
        
        space_owner = self.db.get_space_owner(new_space)
        if space_owner and space_owner["id"] != card["id"]:
            conflict_msg = f"新车位 {new_space} 已被月卡 {space_owner['card_no']} 占用"
            if force:
                self.db.log_operation(
                    card_id=space_owner["id"],
                    operation_type="SPACE_FORCE_RELEASE",
                    operation_desc=f"车位 {new_space} 被强制释放（被月卡 {card_no} 抢占）",
                    old_value=f"原属月卡 {space_owner['card_no']}",
                    new_value=f"转至月卡 {card_no}",
                    reason=f"强制抢占: {reason}",
                    source=source,
                    operator=operator,
                    requires_review=True
                )
                
                other_space = self.db.get_active_space(space_owner["id"])
                if other_space:
                    self.db.execute(
                        """UPDATE parking_spaces 
                           SET is_active = 0, effective_to = ?
                           WHERE id = ?""",
                        (datetime.now().isoformat(), other_space["id"])
                    )
            else:
                return OperationResult(
                    False,
                    conflict_msg + "（使用 --force 强制调整）",
                    requires_review=True
                )
        
        now = datetime.now().isoformat()
        effective_from = effective_date or now
        
        if current_space:
            self.db.execute(
                """UPDATE parking_spaces 
                   SET is_active = 0, effective_to = ?
                   WHERE id = ?""",
                (effective_from, current_space["id"])
            )
        
        self.db.execute(
            """INSERT INTO parking_spaces 
               (card_id, space_no, is_active, effective_from, created_at, created_by)
               VALUES (?, ?, 1, ?, ?, ?)""",
            (card["id"], new_space, effective_from, now, operator)
        )
        
        self.db.log_operation(
            card_id=card["id"],
            operation_type="SPACE_CHANGE",
            operation_desc=f"车位变更: {old_space or '无'} -> {new_space}",
            old_value=old_space or "无",
            new_value=new_space,
            reason=reason,
            source=source,
            operator=operator,
            requires_review=force
        )
        
        msg = f"车位变更成功: {old_space or '无'} -> {new_space}"
        if force:
            msg += "（强制调整，请人工复核）"
        
        return OperationResult(True, msg, requires_review=force)

    def get_all_cards_status(self) -> List[CardStatus]:
        cards = self.db.list_cards()
        statuses = []
        for card in cards:
            status = self.get_card_status(card["card_no"])
            if status:
                statuses.append(status)
        return statuses

    def generate_reconciliation_report(self) -> List[Dict[str, Any]]:
        cards = self.get_all_cards_status()
        report = []
        today = date.today()
        
        for status in cards:
            card = self.db.get_card_by_no(status.card_no)
            if not card:
                continue
            
            payments = self.db.get_card_payments(card["id"])
            payment_count = len(payments)
            last_payment = payments[-1] if payments else None
            
            status_flag = "正常"
            if status.is_expired:
                status_flag = "已过期"
            elif status.remaining_days <= 7:
                status_flag = "即将过期"
            
            report.append({
                "月卡号": status.card_no,
                "车主": status.owner_name,
                "车牌": status.plate_number,
                "车位": status.space_no,
                "有效期起": self._format_date(status.valid_start),
                "有效期止": self._format_date(status.valid_end),
                "剩余天数": status.remaining_days,
                "累计缴费": status.total_paid,
                "缴费次数": payment_count,
                "最近缴费日期": last_payment["payment_date"] if last_payment else "",
                "状态": status_flag,
                "导出日期": today.strftime("%Y-%m-%d")
            })
        
        return sorted(report, key=lambda x: x["剩余天数"])
