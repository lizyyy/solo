from sqlalchemy.orm import Session
from models import Order, OrderLine, Warehouse, Inventory, FulfillmentRecord, WarehouseChangeLog, ShippingRule
from schemas import OrderCreate
from datetime import datetime
import json
from typing import List, Dict, Optional


class IdempotencyService:
    _processing_keys: set = set()

    @classmethod
    def is_processing(cls, key: str) -> bool:
        return key in cls._processing_keys

    @classmethod
    def start_processing(cls, key: str) -> bool:
        if key in cls._processing_keys:
            return False
        cls._processing_keys.add(key)
        return True

    @classmethod
    def finish_processing(cls, key: str):
        if key in cls._processing_keys:
            cls._processing_keys.remove(key)


class SplitOrderService:
    def __init__(self, db: Session):
        self.db = db

    def calculate_shipping_fee(self, warehouse_code: str, city: str, weight: float = 1.0) -> Dict:
        rules = self.db.query(ShippingRule).filter(
            ShippingRule.warehouse_code == warehouse_code,
            ShippingRule.is_active == True
        ).order_by(ShippingRule.priority.desc()).all()

        for rule in rules:
            if rule.city and rule.city != city:
                continue
            if rule.min_weight <= weight <= rule.max_weight:
                return {
                    "success": True,
                    "fee": rule.shipping_fee,
                    "rule_name": rule.rule_name,
                    "message": f"应用规则: {rule.rule_name}"
                }

        return {
            "success": False,
            "fee": 0,
            "rule_name": None,
            "message": "未找到匹配的运费规则"
        }

    def find_available_warehouses(self, sku: str, quantity: int, exclude_warehouse_ids: List[int] = None) -> List[Warehouse]:
        if exclude_warehouse_ids is None:
            exclude_warehouse_ids = []

        inventories = self.db.query(Inventory).filter(
            Inventory.sku == sku,
            (Inventory.quantity - Inventory.reserved_quantity) >= quantity
        ).all()

        warehouse_ids = [inv.warehouse_id for inv in inventories if inv.warehouse_id not in exclude_warehouse_ids]

        warehouses = self.db.query(Warehouse).filter(
            Warehouse.id.in_(warehouse_ids),
            Warehouse.is_active == True
        ).all()

        return warehouses

    def split_order(self, order_no: str, idempotency_key: str) -> Dict:
        if IdempotencyService.is_processing(idempotency_key):
            return {"detail": "订单正在处理中，请稍后再试"}

        if not IdempotencyService.start_processing(idempotency_key):
            return {"detail": "获取处理锁失败"}

        try:
            order = self.db.query(Order).filter(Order.order_no == order_no).first()
            if not order:
                return {"detail": "订单不存在"}

            if order.status in ["completed", "partial_completed", "finalized", "failed"]:
                fulfillment_records = self.db.query(FulfillmentRecord).filter(
                    FulfillmentRecord.order_id == order.id
                ).all()
                return {
                    "success": True,
                    "message": "订单已处理，返回历史结果",
                    "data": {
                        "order_no": order.order_no,
                        "status": order.status,
                        "version": order.version,
                        "fulfillment_records": [
                            {
                                "id": fr.id,
                                "warehouse_code": fr.warehouse_code,
                                "sku": fr.sku,
                                "quantity": fr.quantity,
                                "shipping_fee": fr.shipping_fee,
                                "status": fr.status
                            } for fr in fulfillment_records
                        ]
                    }
                }

            city = order.customer_address.split(" ")[0] if " " in order.customer_address else order.customer_address

            fulfillment_results = []
            shipping_rule_failed = []
            has_processed_lines = 0

            for order_line in order.order_lines:
                existing_record = self.db.query(FulfillmentRecord).filter(
                    FulfillmentRecord.order_line_id == order_line.id
                ).first()

                if existing_record:
                    fulfillment_results.append({
                        "order_line_id": order_line.id,
                        "sku": order_line.sku,
                        "warehouse_code": existing_record.warehouse_code,
                        "quantity": existing_record.quantity,
                        "shipping_fee": existing_record.shipping_fee,
                        "status": existing_record.status,
                        "shipping_rule_result": existing_record.shipping_rule_result
                    })
                    has_processed_lines += 1
                    continue

                warehouses = self.find_available_warehouses(order_line.sku, order_line.quantity)

                if not warehouses:
                    order_line.status = "no_inventory"
                    order_line.processed_result = json.dumps({"error": "无可用库存"}, ensure_ascii=False)
                    continue

                selected_warehouse = warehouses[0]

                shipping_result = self.calculate_shipping_fee(
                    selected_warehouse.warehouse_code,
                    city
                )

                inventory = self.db.query(Inventory).filter(
                    Inventory.warehouse_id == selected_warehouse.id,
                    Inventory.sku == order_line.sku
                ).first()
                if inventory:
                    inventory.reserved_quantity += order_line.quantity

                fulfillment_record = FulfillmentRecord(
                    order_id=order.id,
                    order_line_id=order_line.id,
                    warehouse_id=selected_warehouse.id,
                    warehouse_code=selected_warehouse.warehouse_code,
                    warehouse_name=selected_warehouse.warehouse_name,
                    sku=order_line.sku,
                    quantity=order_line.quantity,
                    shipping_fee=shipping_result["fee"] if shipping_result["success"] else 0,
                    status="assigned" if shipping_result["success"] else "shipping_rule_failed",
                    shipping_rule_result=json.dumps(shipping_result, ensure_ascii=False),
                    processed_at=datetime.now()
                )
                self.db.add(fulfillment_record)

                order_line.status = "assigned" if shipping_result["success"] else "shipping_rule_failed"
                order_line.processed_result = json.dumps({
                    "warehouse": selected_warehouse.warehouse_code,
                    "shipping_result": shipping_result
                }, ensure_ascii=False)

                result = {
                    "order_line_id": order_line.id,
                    "sku": order_line.sku,
                    "warehouse_code": selected_warehouse.warehouse_code,
                    "warehouse_name": selected_warehouse.warehouse_name,
                    "quantity": order_line.quantity,
                    "shipping_fee": shipping_result["fee"],
                    "status": fulfillment_record.status,
                    "shipping_rule_result": shipping_result
                }
                fulfillment_results.append(result)
                has_processed_lines += 1

                if not shipping_result["success"]:
                    shipping_rule_failed.append(result)

            total_lines = len(order.order_lines)
            all_assigned = all(fr["status"] == "assigned" for fr in fulfillment_results) if fulfillment_results else False
            all_completed = all_assigned and (has_processed_lines == total_lines)

            if has_processed_lines == 0:
                order.status = "failed"
                message = "拆单失败，无可用库存或无匹配仓库"
            elif all_completed:
                order.status = "completed"
                message = "拆单完成"
            else:
                order.status = "partial_completed"
                message = "拆单部分完成，存在运费规则失败或库存不足项"

            order.version += 1
            self.db.commit()

            return {
                "success": has_processed_lines > 0,
                "message": message,
                "data": {
                    "order_no": order.order_no,
                    "status": order.status,
                    "version": order.version,
                    "fulfillment_records": fulfillment_results,
                    "shipping_rule_failed_count": len(shipping_rule_failed),
                    "shipping_rule_failed": shipping_rule_failed,
                    "processed_lines": has_processed_lines,
                    "total_lines": total_lines
                }
            }

        finally:
            IdempotencyService.finish_processing(idempotency_key)

    def change_warehouse(self, fulfillment_record_id: int, new_warehouse_code: str, reason: str, processed_by: str) -> Dict:
        fulfillment_record = self.db.query(FulfillmentRecord).filter(
            FulfillmentRecord.id == fulfillment_record_id
        ).first()

        if not fulfillment_record:
            return {
                "success": False,
                "message": "履约记录不存在"
            }

        if fulfillment_record.is_final:
            return {
                "success": False,
                "message": "履约记录已最终确认，无法换仓"
            }

        new_warehouse = self.db.query(Warehouse).filter(
            Warehouse.warehouse_code == new_warehouse_code,
            Warehouse.is_active == True
        ).first()

        if not new_warehouse:
            return {
                "success": False,
                "message": "目标仓库不存在或未激活"
            }

        inventory = self.db.query(Inventory).filter(
            Inventory.warehouse_id == new_warehouse.id,
            Inventory.sku == fulfillment_record.sku,
            (Inventory.quantity - Inventory.reserved_quantity) >= fulfillment_record.quantity
        ).first()

        if not inventory:
            return {
                "success": False,
                "message": "目标仓库库存不足"
            }

        old_warehouse_id = fulfillment_record.warehouse_id
        old_warehouse_code = fulfillment_record.warehouse_code

        old_inventory = self.db.query(Inventory).filter(
            Inventory.warehouse_id == old_warehouse_id,
            Inventory.sku == fulfillment_record.sku
        ).first()
        if old_inventory:
            old_inventory.reserved_quantity -= fulfillment_record.quantity

        inventory.reserved_quantity += fulfillment_record.quantity

        change_log = WarehouseChangeLog(
            order_id=fulfillment_record.order_id,
            order_line_id=fulfillment_record.order_line_id,
            fulfillment_record_id=fulfillment_record.id,
            old_warehouse_id=old_warehouse_id,
            old_warehouse_code=old_warehouse_code,
            new_warehouse_id=new_warehouse.id,
            new_warehouse_code=new_warehouse_code,
            reason=reason,
            processed_by=processed_by
        )
        self.db.add(change_log)

        fulfillment_record.warehouse_id = new_warehouse.id
        fulfillment_record.warehouse_code = new_warehouse_code
        fulfillment_record.warehouse_name = new_warehouse.warehouse_name
        fulfillment_record.status = "warehouse_changed"

        order_line = self.db.query(OrderLine).filter(OrderLine.id == fulfillment_record.order_line_id).first()
        if order_line:
            order_line.processed_result = json.dumps({
                "warehouse": new_warehouse_code,
                "changed_from": old_warehouse_code,
                "reason": reason
            }, ensure_ascii=False)

        self.db.commit()

        return {
            "success": True,
            "message": "换仓成功",
            "data": {
                "fulfillment_record_id": fulfillment_record_id,
                "old_warehouse": old_warehouse_code,
                "new_warehouse": new_warehouse_code
            }
        }

    def correct_shipping_rule(self, fulfillment_record_id: int, new_shipping_fee: float, reason: str, processed_by: str) -> Dict:
        fulfillment_record = self.db.query(FulfillmentRecord).filter(
            FulfillmentRecord.id == fulfillment_record_id
        ).first()

        if not fulfillment_record:
            return {
                "success": False,
                "message": "履约记录不存在"
            }

        old_fee = fulfillment_record.shipping_fee
        old_result = json.loads(fulfillment_record.shipping_rule_result or "{}")

        fulfillment_record.shipping_fee = new_shipping_fee
        fulfillment_record.status = "shipping_corrected"
        fulfillment_record.shipping_rule_result = json.dumps({
            "success": True,
            "fee": new_shipping_fee,
            "rule_name": "人工修正",
            "message": reason,
            "corrected_by": processed_by,
            "old_fee": old_fee,
            "old_result": old_result
        }, ensure_ascii=False)

        order_line = self.db.query(OrderLine).filter(OrderLine.id == fulfillment_record.order_line_id).first()
        if order_line:
            order_line.status = "assigned"

        self.db.commit()

        return {
            "success": True,
            "message": "运费规则修正成功",
            "data": {
                "fulfillment_record_id": fulfillment_record_id,
                "old_shipping_fee": old_fee,
                "new_shipping_fee": new_shipping_fee
            }
        }

    def finalize_fulfillment(self, fulfillment_record_id: int) -> Dict:
        fulfillment_record = self.db.query(FulfillmentRecord).filter(
            FulfillmentRecord.id == fulfillment_record_id
        ).first()

        if not fulfillment_record:
            return {
                "success": False,
                "message": "履约记录不存在"
            }

        fulfillment_record.is_final = True
        fulfillment_record.status = "finalized"
        fulfillment_record.processed_at = datetime.now()

        self.db.commit()

        return {
            "success": True,
            "message": "履约已最终确认"
        }
