import csv
import json
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any

from .models import (
    BorrowRecord, ReturnRecord, CabinetStatus, FeeRule,
    Order, OrderStatus, Appeal, FeeAdjustment, AppealReason
)
from .storage import Storage


class PowerBankService:
    def __init__(self, data_dir: str):
        self.storage = Storage(data_dir)

    def import_borrow_records(self, file_path: str, confirmed: bool = False) -> int:
        records = self._parse_csv(file_path)
        count = 0
        for row in records:
            record = BorrowRecord(
                order_id=row["order_id"],
                user_id=row["user_id"],
                device_id=row["device_id"],
                cabinet_id=row["cabinet_id"],
                borrow_time=datetime.fromisoformat(row["borrow_time"]),
                raw_data=row
            )
            self.storage.save_borrow_record(record, confirmed=confirmed)
            count += 1
        return count

    def import_return_records(self, file_path: str, confirmed: bool = False) -> int:
        records = self._parse_csv(file_path)
        count = 0
        for row in records:
            record = ReturnRecord(
                order_id=row["order_id"],
                user_id=row["user_id"],
                device_id=row["device_id"],
                cabinet_id=row["cabinet_id"],
                return_time=datetime.fromisoformat(row["return_time"]),
                slot_id=row["slot_id"],
                raw_data=row
            )
            self.storage.save_return_record(record, confirmed=confirmed)
            count += 1
        return count

    def import_cabinet_status(self, file_path: str) -> int:
        records = self._parse_csv(file_path)
        count = 0
        for row in records:
            slot_status = {}
            if row.get("slot_status"):
                for item in row["slot_status"].split(";"):
                    if ":" in item:
                        slot_id, status = item.split(":", 1)
                        slot_status[slot_id.strip()] = status.strip()
            
            status = CabinetStatus(
                cabinet_id=row["cabinet_id"],
                report_time=datetime.fromisoformat(row["report_time"]),
                is_online=row["is_online"].lower() in ["true", "1", "yes"],
                slot_status=slot_status,
                raw_data=row
            )
            self.storage.save_cabinet_status(status)
            count += 1
        return count

    def import_fee_rules(self, file_path: str) -> int:
        records = self._parse_csv(file_path)
        count = 0
        for row in records:
            rule = FeeRule(
                rule_id=row["rule_id"],
                region=row["region"],
                base_fee=float(row["base_fee"]),
                per_hour_fee=float(row["per_hour_fee"]),
                max_daily_fee=float(row["max_daily_fee"]),
                lost_fee=float(row["lost_fee"]),
                is_active=row.get("is_active", "true").lower() in ["true", "1", "yes"]
            )
            self.storage.save_fee_rule(rule)
            count += 1
        return count

    def _parse_csv(self, file_path: str) -> List[Dict[str, str]]:
        with open(file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            return [row for row in reader]

    def process_orders(self) -> Dict[str, Any]:
        borrow_records = self.storage.get_borrow_records()
        return_records = self.storage.get_return_records()
        cabinet_statuses = self.storage.get_cabinet_statuses()
        
        existing_orders = {o.order_id: o for o in self.storage.get_orders()}
        
        cabinet_status_map = defaultdict(list)
        for cs in cabinet_statuses:
            cabinet_status_map[cs.cabinet_id].append(cs)
        
        device_return_map = defaultdict(list)
        for rr in return_records:
            device_return_map[rr.device_id].append(rr)
        
        new_orders = []
        updated_orders = []
        skipped_orders = []
        
        for borrow in borrow_records:
            if borrow.order_id in existing_orders:
                order = existing_orders[borrow.order_id]
                if order.is_confirmed:
                    skipped_orders.append(borrow.order_id)
                    continue
            
            order = Order(
                order_id=borrow.order_id,
                user_id=borrow.user_id,
                device_id=borrow.device_id,
                borrow_cabinet_id=borrow.cabinet_id,
                borrow_time=borrow.borrow_time
            )
            
            related_returns = [r for r in return_records if r.order_id == borrow.order_id]
            same_device_returns = device_return_map[borrow.device_id]
            other_users_returns = [r for r in same_device_returns if r.user_id != borrow.user_id]
            
            if other_users_returns:
                order.multiple_return_users = list({r.user_id for r in other_users_returns})
                order.status = OrderStatus.SUSPICIOUS_LOST
                order.status_reason = f"该设备被其他用户归还，涉及用户: {', '.join(order.multiple_return_users)}"
            elif len(related_returns) == 1:
                ret = related_returns[0]
                order.return_cabinet_id = ret.cabinet_id
                order.return_time = ret.return_time
                order.return_slot_id = ret.slot_id
                
                cabinet_offline = self._check_cabinet_offline(
                    ret.cabinet_id, ret.return_time, cabinet_status_map
                )
                if cabinet_offline:
                    order.cabinet_offline_at = cabinet_offline
                    order.status = OrderStatus.RETURN_FAILED
                    order.status_reason = f"归还时柜机离线，离线时间: {cabinet_offline.isoformat()}"
                else:
                    cabinet_histories = cabinet_status_map.get(ret.cabinet_id, [])
                    slot_occupied = False
                    for cs in cabinet_histories:
                        if cs.report_time > ret.return_time:
                            if ret.slot_id in cs.slot_status and cs.slot_status[ret.slot_id] == "occupied":
                                slot_occupied = True
                                break
                    
                    if slot_occupied:
                        order.status = OrderStatus.NORMAL_RETURN
                        order.status_reason = "正常归还，柜机状态确认充电宝已在仓位内"
                    else:
                        order.status = OrderStatus.RETURN_FAILED
                        order.status_reason = "归还记录存在但柜机状态显示仓位未被占用"
            elif len(related_returns) > 1:
                order.status = OrderStatus.SUSPICIOUS_LOST
                order.status_reason = f"同一订单存在{len(related_returns)}条归还记录"
            else:
                order.status = OrderStatus.SUSPICIOUS_LOST
                order.status_reason = "借出后未找到对应归还记录"
            
            order.original_fee = self._calculate_fee(order)
            
            if borrow.order_id in existing_orders:
                updated_orders.append(order.order_id)
            else:
                new_orders.append(order.order_id)
            
            self.storage.save_order(order)
        
        return {
            "new": len(new_orders),
            "updated": len(updated_orders),
            "skipped_confirmed": len(skipped_orders),
            "new_orders": new_orders,
            "updated_orders": updated_orders,
            "skipped_orders": skipped_orders
        }

    def _check_cabinet_offline(
        self,
        cabinet_id: str,
        return_time: datetime,
        cabinet_status_map: Dict[str, List[CabinetStatus]]
    ) -> Optional[datetime]:
        statuses = cabinet_status_map.get(cabinet_id, [])
        statuses.sort(key=lambda s: s.report_time)
        
        window_start = return_time - timedelta(minutes=30)
        window_end = return_time + timedelta(minutes=30)
        
        for status in statuses:
            if window_start <= status.report_time <= window_end:
                if not status.is_online:
                    return status.report_time
        
        return None

    def _calculate_fee(self, order: Order) -> float:
        fee_rules = [r for r in self.storage.get_fee_rules() if r.is_active]
        if not fee_rules:
            return 0.0
        
        rule = fee_rules[0]
        
        if order.status in [OrderStatus.SUSPICIOUS_LOST, OrderStatus.CONFIRMED_LOST]:
            return rule.lost_fee
        
        if not order.return_time:
            return rule.lost_fee
        
        duration = order.return_time - order.borrow_time
        hours = duration.total_seconds() / 3600
        hours = max(hours, 0)
        
        base_fee = rule.base_fee
        if hours <= 1:
            return base_fee
        
        additional_hours = hours - 1
        additional_fee = additional_hours * rule.per_hour_fee
        total = base_fee + additional_fee
        
        days = duration.total_seconds() / 86400
        max_total = days * rule.max_daily_fee
        
        return min(total, max_total)

    def register_appeal(
        self,
        order_id: str,
        user_id: str,
        reason: AppealReason,
        description: str
    ) -> Appeal:
        order = self.storage.get_order(order_id)
        if not order:
            raise ValueError(f"订单不存在: {order_id}")
        
        appeal_id = f"AP-{datetime.now().strftime('%Y%m%d%H%M%S')}-{order_id[-4:]}"
        
        appeal = Appeal(
            appeal_id=appeal_id,
            order_id=order_id,
            user_id=user_id,
            reason=reason,
            description=description,
            status="pending",
            created_at=datetime.now()
        )
        
        order.appeal = appeal
        order.status = OrderStatus.APPEAL_PENDING
        self.storage.save_order(order)
        
        return appeal

    def review_appeal(
        self,
        order_id: str,
        approved: bool,
        reviewer_note: str,
        adjusted_fee: Optional[float] = None,
        adjustment_reason: str = "",
        operator: str = "system"
    ) -> Tuple[Order, Optional[FeeAdjustment]]:
        order = self.storage.get_order(order_id)
        if not order:
            raise ValueError(f"订单不存在: {order_id}")
        if not order.appeal:
            raise ValueError(f"订单没有待处理申诉: {order_id}")
        
        order.appeal.reviewed_at = datetime.now()
        order.appeal.reviewer_note = reviewer_note
        
        adjustment = None
        if approved:
            order.appeal.status = "approved"
            order.status = OrderStatus.APPEAL_APPROVED
            
            if adjusted_fee is not None and adjusted_fee != order.original_fee:
                adj_id = f"ADJ-{datetime.now().strftime('%Y%m%d%H%M%S')}"
                adjustment = FeeAdjustment(
                    adjustment_id=adj_id,
                    order_id=order.order_id,
                    original_fee=order.original_fee,
                    adjusted_fee=adjusted_fee,
                    reason=adjustment_reason or "申诉通过费用调整",
                    created_at=datetime.now(),
                    operator=operator
                )
                order.fee_adjustments.append(adjustment)
                order.adjusted_fee = adjusted_fee
        else:
            order.appeal.status = "rejected"
            order.status = OrderStatus.APPEAL_REJECTED
        
        order.is_confirmed = True
        self.storage.save_order(order)
        
        return order, adjustment

    def adjust_fee(
        self,
        order_id: str,
        new_fee: float,
        reason: str,
        operator: str = "system"
    ) -> FeeAdjustment:
        order = self.storage.get_order(order_id)
        if not order:
            raise ValueError(f"订单不存在: {order_id}")
        
        original_fee = order.adjusted_fee if order.adjusted_fee is not None else order.original_fee
        
        adj_id = f"ADJ-{datetime.now().strftime('%Y%m%d%H%M%S')}"
        adjustment = FeeAdjustment(
            adjustment_id=adj_id,
            order_id=order.order_id,
            original_fee=original_fee,
            adjusted_fee=new_fee,
            reason=reason,
            created_at=datetime.now(),
            operator=operator
        )
        
        order.fee_adjustments.append(adjustment)
        order.adjusted_fee = new_fee
        order.is_confirmed = True
        self.storage.save_order(order)
        
        return adjustment

    def get_fee_explanation(self, order_id: str) -> str:
        order = self.storage.get_order(order_id)
        if not order:
            return f"订单不存在: {order_id}"
        
        lines = []
        lines.append(f"订单 {order.order_id} 费用说明")
        lines.append(f"用户: {order.user_id}")
        lines.append(f"设备: {order.device_id}")
        lines.append(f"借出时间: {order.borrow_time}")
        if order.return_time:
            lines.append(f"归还时间: {order.return_time}")
            duration = order.return_time - order.borrow_time
            lines.append(f"使用时长: {duration}")
        lines.append(f"订单状态: {order.status_display}")
        lines.append(f"状态原因: {order.status_reason}")
        lines.append("-" * 40)
        lines.append(f"原始费用: ¥{order.original_fee:.2f}")
        
        if order.adjusted_fee is not None:
            lines.append(f"调整后费用: ¥{order.adjusted_fee:.2f}")
            lines.append(f"费用差额: ¥{order.original_fee - order.adjusted_fee:.2f}")
            if order.fee_adjustments:
                for adj in order.fee_adjustments:
                    lines.append(f"调整记录 {adj.adjustment_id}:")
                    lines.append(f"  调整原因: {adj.reason}")
                    lines.append(f"  调整时间: {adj.created_at}")
                    lines.append(f"  操作员: {adj.operator}")
        
        if order.appeal:
            lines.append("-" * 40)
            lines.append(f"申诉记录 {order.appeal.appeal_id}:")
            lines.append(f"  申诉原因: {order.appeal.reason.value}")
            lines.append(f"  申诉描述: {order.appeal.description}")
            lines.append(f"  申诉状态: {order.appeal.status}")
            if order.appeal.reviewer_note:
                lines.append(f"  复核意见: {order.appeal.reviewer_note}")
        
        lines.append("-" * 40)
        lines.append(f"最终费用: ¥{order.final_fee:.2f}")
        
        return "\n".join(lines)

    def export_asset_report(self, file_path: str, status_filter: Optional[str] = None) -> int:
        orders = self.storage.get_orders()
        
        if status_filter:
            orders = [o for o in orders if o.status.value == status_filter or o.status_display == status_filter]
        
        with open(file_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow([
                "订单ID", "用户ID", "设备ID", "借出柜机", "借出时间",
                "归还柜机", "归还时间", "状态", "状态原因",
                "原始费用", "调整后费用", "最终费用",
                "申诉状态", "是否确认", "柜机离线时间", "其他归还用户"
            ])
            
            for order in orders:
                writer.writerow([
                    order.order_id,
                    order.user_id,
                    order.device_id,
                    order.borrow_cabinet_id,
                    order.borrow_time.isoformat(),
                    order.return_cabinet_id or "",
                    order.return_time.isoformat() if order.return_time else "",
                    order.status_display,
                    order.status_reason,
                    f"{order.original_fee:.2f}",
                    f"{order.adjusted_fee:.2f}" if order.adjusted_fee is not None else "",
                    f"{order.final_fee:.2f}",
                    order.appeal.status if order.appeal else "",
                    "是" if order.is_confirmed else "否",
                    order.cabinet_offline_at.isoformat() if order.cabinet_offline_at else "",
                    ", ".join(order.multiple_return_users)
                ])
        
        return len(orders)

    def get_orders(self, status_filter: Optional[str] = None) -> List[Order]:
        orders = self.storage.get_orders()
        if status_filter:
            orders = [o for o in orders if o.status.value == status_filter or o.status_display == status_filter]
        return orders

    def get_order(self, order_id: str) -> Optional[Order]:
        return self.storage.get_order(order_id)

    def confirm_order(self, order_id: str):
        order = self.storage.get_order(order_id)
        if not order:
            raise ValueError(f"订单不存在: {order_id}")
        order.is_confirmed = True
        self.storage.save_order(order)
