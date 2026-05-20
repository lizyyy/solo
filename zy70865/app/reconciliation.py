from typing import List, Dict, Tuple
from datetime import datetime
import uuid
from .models import (
    WashItem, RecycleItem, RoomTypeConfig, ReconciliationItem,
    ReconciliationResult, ItemStatus, CompensationRecord, DamageType
)
from .database import db


ITEM_PRICES = {
    "bedsheet": 35.0,
    "pillowcase": 15.0,
    "towel": 20.0,
    "bathrobe": 80.0,
    "quilt_cover": 50.0
}


DAMAGE_RESPONSIBILITY = {
    DamageType.TEAR: "hotel",
    DamageType.STAIN: "laundry",
    DamageType.HOLE: "laundry",
    DamageType.WEAR: "hotel",
    DamageType.UNKNOWN: "pending"
}


class ReconciliationEngine:
    def __init__(self):
        self.prices = ITEM_PRICES
        self.damage_rules = DAMAGE_RESPONSIBILITY

    def get_item_price(self, item_type: str) -> float:
        return self.prices.get(item_type, 25.0)

    def group_items_by_key(self, wash_items: List[WashItem], recycle_items: List[RecycleItem]) -> Dict:
        wash_grouped = {}
        for item in wash_items:
            key = (item.item_type, item.room_type or "default")
            if key not in wash_grouped:
                wash_grouped[key] = {"quantity": 0, "items": []}
            wash_grouped[key]["quantity"] += item.quantity
            wash_grouped[key]["items"].append(item)

        recycle_grouped = {}
        for item in recycle_items:
            key = (item.item_type, item.room_type or "default")
            if key not in recycle_grouped:
                recycle_grouped[key] = {"quantity": 0, "damage_quantity": 0, "items": []}
            recycle_grouped[key]["quantity"] += item.quantity
            recycle_grouped[key]["damage_quantity"] += item.damage_quantity
            recycle_grouped[key]["items"].append(item)

        all_keys = set(wash_grouped.keys()) | set(recycle_grouped.keys())
        
        return {
            "keys": all_keys,
            "wash_grouped": wash_grouped,
            "recycle_grouped": recycle_grouped
        }

    def check_duplicate_billing(self, wash_items: List[WashItem], batch_id: str) -> List[str]:
        warnings = []
        item_counts = {}
        
        for item in wash_items:
            key = (item.item_type, item.room_type or "default")
            if key not in item_counts:
                item_counts[key] = 0
            item_counts[key] += 1
        
        for key, count in item_counts.items():
            if count > 1:
                warnings.append(f"物品 {key[0]} (房型: {key[1]}) 在送洗单中重复出现 {count} 次，可能存在重复计费")
        
        return warnings

    def analyze_damage(self, recycle_data: Dict, item_type: str) -> Tuple[str, str]:
        damage_items = [item for item in recycle_data["items"] if item.damage_quantity > 0]
        
        if not damage_items:
            return "none", ""

        total_damage = sum(item.damage_quantity for item in damage_items)
        damage_type = damage_items[0].damage_type or DamageType.UNKNOWN
        
        responsibility = self.damage_rules.get(damage_type, "pending")
        
        if responsibility == "hotel":
            suggestion = f"破损类型为 {damage_type}，判定为酒店使用损耗，计入正常损耗"
        elif responsibility == "laundry":
            suggestion = f"破损类型为 {damage_type}，判定为洗涤厂责任，需洗涤厂赔付"
        else:
            suggestion = f"破损类型未知，需人工确认破损原因"
        
        return responsibility, suggestion

    def create_compensation(self, batch_id: str, item_type: str, reason: str,
                          quantity: int, suggestion: str) -> CompensationRecord:
        unit_price = self.get_item_price(item_type)
        return CompensationRecord(
            compensation_id=f"COMP-{uuid.uuid4().hex[:8]}",
            source_batch_id=batch_id,
            source_item_type=item_type,
            reason=reason,
            quantity=quantity,
            unit_price=unit_price,
            total_amount=unit_price * quantity,
            suggestion=suggestion,
            created_at=datetime.now()
        )

    def reconcile(self, wash_items: List[WashItem], recycle_items: List[RecycleItem],
                  room_configs: List[RoomTypeConfig], batch_id: str) -> ReconciliationResult:
        grouped = self.group_items_by_key(wash_items, recycle_items)
        duplicate_warnings = self.check_duplicate_billing(wash_items, batch_id)
        
        normal_items = []
        pending_items = []
        failed_items = []
        total_compensation = 0.0

        for key in grouped["keys"]:
            item_type, room_type = key
            wash_data = grouped["wash_grouped"].get(key, {"quantity": 0, "items": []})
            recycle_data = grouped["recycle_grouped"].get(key, {"quantity": 0, "damage_quantity": 0, "items": []})
            
            wash_qty = wash_data["quantity"]
            recycle_qty = recycle_data["quantity"]
            damage_qty = recycle_data["damage_quantity"]
            difference = wash_qty - recycle_qty

            raw_wash = [item.dict() for item in wash_data["items"]] if wash_data["items"] else None
            raw_recycle = [item.dict() for item in recycle_data["items"]] if recycle_data["items"] else None

            item = ReconciliationItem(
                item_type=item_type,
                room_type=room_type if room_type != "default" else None,
                status=ItemStatus.NORMAL,
                wash_quantity=wash_qty,
                recycle_quantity=recycle_qty,
                difference=difference,
                raw_wash_data=raw_wash[0] if raw_wash else None,
                raw_recycle_data=raw_recycle[0] if raw_recycle else None
            )

            if abs(difference) <= 1 and damage_qty == 0:
                item.status = ItemStatus.NORMAL
                item.suggestion = "数量一致，无破损，对账正常"
                normal_items.append(item)
            
            elif damage_qty > 0:
                responsibility, damage_suggestion = self.analyze_damage(recycle_data, item_type)
                
                if responsibility == "laundry":
                    item.status = ItemStatus.FAILED
                    compensation = self.create_compensation(
                        batch_id, item_type,
                        f"洗涤厂责任破损，破损数量: {damage_qty}",
                        damage_qty,
                        f"洗涤厂需赔付 {damage_qty} 件 {item_type}，总金额: {self.get_item_price(item_type) * damage_qty} 元"
                    )
                    item.compensation = compensation
                    item.damage_details = {
                        "damage_quantity": damage_qty,
                        "responsibility": responsibility,
                        "suggestion": damage_suggestion
                    }
                    total_compensation += compensation.total_amount
                    db.add_compensation(compensation)
                    failed_items.append(item)
                
                elif responsibility == "pending":
                    item.status = ItemStatus.PENDING
                    item.suggestion = damage_suggestion
                    item.damage_details = {
                        "damage_quantity": damage_qty,
                        "responsibility": "pending",
                        "suggestion": damage_suggestion
                    }
                    pending_items.append(item)
                
                else:
                    item.status = ItemStatus.NORMAL
                    item.suggestion = damage_suggestion
                    item.damage_details = {
                        "damage_quantity": damage_qty,
                        "responsibility": responsibility
                    }
                    normal_items.append(item)
            
            elif difference > 2:
                item.status = ItemStatus.FAILED
                compensation = self.create_compensation(
                    batch_id, item_type,
                    f"送洗数量与回收数量不符，短少数量: {difference}",
                    difference,
                    f"洗涤厂需赔付短少的 {difference} 件 {item_type}，总金额: {self.get_item_price(item_type) * difference} 元"
                )
                item.compensation = compensation
                item.suggestion = f"短少 {difference} 件，超出正常损耗范围，建议向洗涤厂索赔"
                total_compensation += compensation.total_amount
                db.add_compensation(compensation)
                failed_items.append(item)
            
            elif difference < 0:
                item.status = ItemStatus.PENDING
                item.suggestion = f"回收数量 {abs(difference)} 件多于送洗数量，需核实是否为往期遗留物品"
                pending_items.append(item)
            
            else:
                item.status = ItemStatus.PENDING
                item.suggestion = f"差异 {difference} 件在正常范围内，建议人工复核"
                pending_items.append(item)

        if duplicate_warnings:
            for warning in duplicate_warnings:
                dup_item = ReconciliationItem(
                    item_type="system_check",
                    room_type=None,
                    status=ItemStatus.PENDING,
                    wash_quantity=0,
                    recycle_quantity=0,
                    difference=0,
                    suggestion=f"重复计费检测: {warning}"
                )
                pending_items.append(dup_item)

        result = ReconciliationResult(
            batch_id=batch_id,
            reconciliation_time=datetime.now(),
            total_wash=sum(item.quantity for item in wash_items),
            total_recycle=sum(item.quantity for item in recycle_items),
            normal_count=len(normal_items),
            pending_count=len(pending_items),
            failed_count=len(failed_items),
            normal_items=normal_items,
            pending_items=pending_items,
            failed_items=failed_items,
            total_compensation=total_compensation
        )

        db.save_reconciliation_result(result)
        return result


engine = ReconciliationEngine()
