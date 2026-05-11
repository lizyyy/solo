import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any

from .models import (
    BorrowRecord, ReturnRecord, CabinetStatus, FeeRule,
    Order, OrderStatus, Appeal, FeeAdjustment, AppealReason
)


class Storage:
    def __init__(self, data_dir: str):
        self.data_dir = data_dir
        self._ensure_dirs()

    def _ensure_dirs(self):
        os.makedirs(self.data_dir, exist_ok=True)

    def _file_path(self, name: str) -> str:
        return os.path.join(self.data_dir, f"{name}.json")

    def _load(self, name: str) -> Dict[str, Any]:
        path = self._file_path(name)
        if not os.path.exists(path):
            return {}
        with open(path, 'r', encoding='utf-8') as f:
            return json.load(f)

    def _save(self, name: str, data: Dict[str, Any]):
        with open(self._file_path(name), 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    def save_borrow_record(self, record: BorrowRecord, confirmed: bool = False):
        existing = self._load("borrow_records")
        if record.order_id in existing:
            if existing[record.order_id].get("is_confirmed") and not confirmed:
                return
            is_confirmed = confirmed or existing[record.order_id].get("is_confirmed", False)
        else:
            is_confirmed = confirmed
        existing[record.order_id] = {
            "order_id": record.order_id,
            "user_id": record.user_id,
            "device_id": record.device_id,
            "cabinet_id": record.cabinet_id,
            "borrow_time": record.borrow_time.isoformat(),
            "is_confirmed": is_confirmed,
            "raw_data": record.raw_data
        }
        self._save("borrow_records", existing)

    def save_return_record(self, record: ReturnRecord, confirmed: bool = False):
        existing = self._load("return_records")
        key = f"{record.order_id}_{record.return_time.isoformat()}"
        if key in existing:
            if existing[key].get("is_confirmed") and not confirmed:
                return
            is_confirmed = confirmed or existing[key].get("is_confirmed", False)
        else:
            is_confirmed = confirmed
        existing[key] = {
            "order_id": record.order_id,
            "user_id": record.user_id,
            "device_id": record.device_id,
            "cabinet_id": record.cabinet_id,
            "return_time": record.return_time.isoformat(),
            "slot_id": record.slot_id,
            "is_confirmed": is_confirmed,
            "raw_data": record.raw_data
        }
        self._save("return_records", existing)

    def save_cabinet_status(self, status: CabinetStatus):
        existing = self._load("cabinet_status")
        key = f"{status.cabinet_id}_{status.report_time.isoformat()}"
        existing[key] = {
            "cabinet_id": status.cabinet_id,
            "report_time": status.report_time.isoformat(),
            "is_online": status.is_online,
            "slot_status": status.slot_status,
            "raw_data": status.raw_data
        }
        self._save("cabinet_status", existing)

    def save_fee_rule(self, rule: FeeRule):
        existing = self._load("fee_rules")
        existing[rule.rule_id] = {
            "rule_id": rule.rule_id,
            "region": rule.region,
            "base_fee": rule.base_fee,
            "per_hour_fee": rule.per_hour_fee,
            "max_daily_fee": rule.max_daily_fee,
            "lost_fee": rule.lost_fee,
            "is_active": rule.is_active,
            "created_at": rule.created_at.isoformat()
        }
        self._save("fee_rules", existing)

    def save_order(self, order: Order):
        existing = self._load("orders")
        existing[order.order_id] = {
            "order_id": order.order_id,
            "user_id": order.user_id,
            "device_id": order.device_id,
            "borrow_cabinet_id": order.borrow_cabinet_id,
            "borrow_time": order.borrow_time.isoformat(),
            "return_cabinet_id": order.return_cabinet_id,
            "return_time": order.return_time.isoformat() if order.return_time else None,
            "return_slot_id": order.return_slot_id,
            "status": order.status.value,
            "status_reason": order.status_reason,
            "original_fee": order.original_fee,
            "adjusted_fee": order.adjusted_fee,
            "appeal": self._serialize_appeal(order.appeal),
            "fee_adjustments": [
                {
                    "adjustment_id": a.adjustment_id,
                    "order_id": a.order_id,
                    "original_fee": a.original_fee,
                    "adjusted_fee": a.adjusted_fee,
                    "reason": a.reason,
                    "created_at": a.created_at.isoformat(),
                    "operator": a.operator
                }
                for a in order.fee_adjustments
            ],
            "is_confirmed": order.is_confirmed,
            "cabinet_offline_at": order.cabinet_offline_at.isoformat() if order.cabinet_offline_at else None,
            "multiple_return_users": order.multiple_return_users
        }
        self._save("orders", existing)

    def _serialize_appeal(self, appeal: Optional[Appeal]) -> Optional[Dict[str, Any]]:
        if appeal:
            return {
                "appeal_id": appeal.appeal_id,
                "order_id": appeal.order_id,
                "user_id": appeal.user_id,
                "reason": appeal.reason.value,
                "description": appeal.description,
                "status": appeal.status,
                "created_at": appeal.created_at.isoformat(),
                "reviewed_at": appeal.reviewed_at.isoformat() if appeal.reviewed_at else None,
                "reviewer_note": appeal.reviewer_note
            }
        return None

    def get_borrow_records(self) -> List[BorrowRecord]:
        data = self._load("borrow_records")
        return [
            BorrowRecord(
                order_id=r["order_id"],
                user_id=r["user_id"],
                device_id=r["device_id"],
                cabinet_id=r["cabinet_id"],
                borrow_time=datetime.fromisoformat(r["borrow_time"]),
                is_confirmed=r.get("is_confirmed", False),
                raw_data=r.get("raw_data", {})
            )
            for r in data.values()
        ]

    def get_return_records(self) -> List[ReturnRecord]:
        data = self._load("return_records")
        return [
            ReturnRecord(
                order_id=r["order_id"],
                user_id=r["user_id"],
                device_id=r["device_id"],
                cabinet_id=r["cabinet_id"],
                return_time=datetime.fromisoformat(r["return_time"]),
                slot_id=r["slot_id"],
                is_confirmed=r.get("is_confirmed", False),
                raw_data=r.get("raw_data", {})
            )
            for r in data.values()
        ]

    def get_cabinet_statuses(self) -> List[CabinetStatus]:
        data = self._load("cabinet_status")
        return [
            CabinetStatus(
                cabinet_id=s["cabinet_id"],
                report_time=datetime.fromisoformat(s["report_time"]),
                is_online=s["is_online"],
                slot_status=s.get("slot_status", {}),
                raw_data=s.get("raw_data", {})
            )
            for s in data.values()
        ]

    def get_fee_rules(self) -> List[FeeRule]:
        data = self._load("fee_rules")
        return [
            FeeRule(
                rule_id=r["rule_id"],
                region=r["region"],
                base_fee=r["base_fee"],
                per_hour_fee=r["per_hour_fee"],
                max_daily_fee=r["max_daily_fee"],
                lost_fee=r["lost_fee"],
                is_active=r.get("is_active", True),
                created_at=datetime.fromisoformat(r["created_at"])
            )
            for r in data.values()
        ]

    def get_orders(self) -> List[Order]:
        data = self._load("orders")
        return [self._parse_order(order_dict) for order_dict in data.values()]

    def _parse_order(self, o: Dict[str, Any]) -> Order:
        return Order(
            order_id=o["order_id"],
            user_id=o["user_id"],
            device_id=o["device_id"],
            borrow_cabinet_id=o["borrow_cabinet_id"],
            borrow_time=datetime.fromisoformat(o["borrow_time"]),
            return_cabinet_id=o.get("return_cabinet_id"),
            return_time=datetime.fromisoformat(o["return_time"]) if o.get("return_time") else None,
            return_slot_id=o.get("return_slot_id"),
            status=OrderStatus(o["status"]),
            status_reason=o.get("status_reason", ""),
            original_fee=o["original_fee"],
            adjusted_fee=o.get("adjusted_fee"),
            appeal=self._parse_appeal(o.get("appeal")),
            fee_adjustments=self._parse_fee_adjustments(o.get("fee_adjustments", [])),
            is_confirmed=o.get("is_confirmed", False),
            cabinet_offline_at=datetime.fromisoformat(o["cabinet_offline_at"]) if o.get("cabinet_offline_at") else None,
            multiple_return_users=o.get("multiple_return_users", [])
        )

    def _parse_appeal(self, appeal_dict: Optional[Dict[str, Any]]) -> Optional[Appeal]:
        if appeal_dict:
            return Appeal(
                appeal_id=appeal_dict["appeal_id"],
                order_id=appeal_dict["order_id"],
                user_id=appeal_dict["user_id"],
                reason=AppealReason(appeal_dict["reason"]),
                description=appeal_dict["description"],
                status=appeal_dict["status"],
                created_at=datetime.fromisoformat(appeal_dict["created_at"]),
                reviewed_at=datetime.fromisoformat(appeal_dict["reviewed_at"]) if appeal_dict.get("reviewed_at") else None,
                reviewer_note=appeal_dict.get("reviewer_note")
            )
        return None

    def _parse_fee_adjustments(self, adj_list: List[Dict[str, Any]]) -> List[FeeAdjustment]:
        return [
            FeeAdjustment(
                adjustment_id=a["adjustment_id"],
                order_id=a["order_id"],
                original_fee=a["original_fee"],
                adjusted_fee=a["adjusted_fee"],
                reason=a["reason"],
                created_at=datetime.fromisoformat(a["created_at"]),
                operator=a["operator"]
            )
            for a in adj_list
        ]

    def get_order(self, order_id: str) -> Optional[Order]:
        orders = self._load("orders")
        if order_id in orders:
            return self._parse_order(orders[order_id])
        return None
