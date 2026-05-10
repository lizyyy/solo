from typing import Dict, List, Optional, Tuple
from copy import deepcopy
from datetime import datetime

from .models import (
    Order, Workstation, DeliverySlot, 
    ProductionSchedule, ProcurementGap, FlowerRequirement
)
from .data_manager import DataManager


class Scheduler:
    def __init__(self, data_manager: DataManager):
        self.data_manager = data_manager
        self._temp_inventory = {}
    
    def generate_schedule(self) -> Dict:
        orders = self.data_manager.get_all_orders()
        workstations = self.data_manager.get_all_workstations()
        delivery_slots = self.data_manager.get_all_delivery_slots()
        
        self._temp_inventory = {
            f.name: f.quantity 
            for f in self.data_manager.get_all_inventory()
        }
        
        sorted_orders = sorted(
            orders, 
            key=lambda o: (not o.is_urgent, o.order_id)
        )
        
        schedules = []
        procurement_gaps = {}
        waitlist_orders = []
        orders_needing_attention = []
        
        for order in sorted_orders:
            schedule_result = self._schedule_order(order, workstations, delivery_slots)
            
            if schedule_result["status"] == "scheduled":
                schedules.append(schedule_result["schedule"])
            elif schedule_result["status"] == "waitlist":
                waitlist_orders.append({
                    "order_id": order.order_id,
                    "customer": order.customer_name,
                    "reason": schedule_result["reason"]
                })
            elif schedule_result["status"] == "needs_attention":
                orders_needing_attention.append({
                    "order_id": order.order_id,
                    "customer": order.customer_name,
                    "phone": order.phone,
                    "issues": schedule_result["issues"]
                })
            
            for gap in schedule_result.get("gaps", []):
                if gap.flower_name not in procurement_gaps:
                    procurement_gaps[gap.flower_name] = gap
                else:
                    procurement_gaps[gap.flower_name].required += gap.required
                    procurement_gaps[gap.flower_name].affected_orders.extend(gap.affected_orders)
        
        return {
            "schedules": schedules,
            "procurement_gaps": list(procurement_gaps.values()),
            "waitlist_orders": waitlist_orders,
            "orders_needing_attention": orders_needing_attention
        }
    
    def _schedule_order(self, order: Order, workstations: List[Workstation], 
                       delivery_slots: List[DeliverySlot]) -> Dict:
        result = {
            "status": "pending",
            "schedule": None,
            "gaps": [],
            "issues": [],
            "reason": ""
        }
        
        ws = self._find_available_workstation(order, workstations)
        if not ws:
            result["status"] = "waitlist"
            result["reason"] = f"无可用包装工位（需要：{order.packaging}）"
            return result
        
        slot = self._find_available_delivery_slot(order, delivery_slots)
        if not slot:
            result["status"] = "waitlist"
            result["reason"] = f"配送时段已满（首选：{order.preferred_delivery}）"
            return result
        
        flower_check = self._check_and_allocate_flowers(order)
        if flower_check["has_gaps"]:
            result["issues"] = flower_check["issues"]
            result["gaps"] = flower_check["gaps"]
        
        schedule = ProductionSchedule(
            order_id=order.order_id,
            workstation_id=ws.workstation_id,
            workstation_name=ws.name,
            flowers_required=flower_check["required"],
            flowers_reserved=flower_check["reserved"],
            flowers_replaced=flower_check["replacements"],
            delivery_slot=slot.slot_id if slot else None,
            status="scheduled",
            notes=""
        )
        
        if flower_check["needs_confirmation"] or not all([
            flower_check["reserved"].get(f.name, 0) >= f.quantity 
            for f in order.flowers
        ]):
            result["status"] = "needs_attention"
        else:
            result["status"] = "scheduled"
        
        result["schedule"] = schedule
        return result
    
    def _find_available_workstation(self, order: Order, workstations: List[Workstation]) -> Optional[Workstation]:
        for ws in workstations:
            if order.packaging in ws.packaging_types:
                if len(ws.current_orders) < ws.capacity:
                    return ws
        
        return None
    
    def _find_available_delivery_slot(self, order: Order, slots: List[DeliverySlot]) -> Optional[DeliverySlot]:
        preferred_time = order.preferred_delivery
        
        if preferred_time:
            for slot in slots:
                if (slot.time.date() == preferred_time.date() and 
                    slot.time.hour == preferred_time.hour):
                    if len(slot.current_orders) < slot.capacity:
                        return slot
        
        for slot in sorted(slots, key=lambda s: s.time):
            if len(slot.current_orders) < slot.capacity:
                return slot
        
        return None
    
    def _check_and_allocate_flowers(self, order: Order) -> Dict:
        required = {}
        reserved = {}
        replacements = {}
        gaps = []
        issues = []
        needs_confirmation = False
        
        for flower in order.flowers:
            required[flower.name] = flower.quantity
            
            available = self._temp_inventory.get(flower.name, 0)
            
            if available >= flower.quantity:
                self._temp_inventory[flower.name] = available - flower.quantity
                reserved[flower.name] = flower.quantity
            else:
                if flower.is_specified:
                    issues.append({
                        "flower": flower.name,
                        "type": "specified_out_of_stock",
                        "message": f"指定花材'{flower.name}'缺货（需要{flower.quantity}，仅有{available}）"
                    })
                    needs_confirmation = True
                    reserved[flower.name] = available
                    
                    gaps.append(ProcurementGap(
                        flower_name=flower.name,
                        required=flower.quantity,
                        available=available,
                        gap=flower.quantity - available,
                        affected_orders=[order.order_id]
                    ))
                else:
                    rule = self.data_manager.get_replacement_rule(flower.name)
                    if rule:
                        replaced = False
                        for alt in rule.alternatives:
                            alt_available = self._temp_inventory.get(alt, 0)
                            if alt_available >= flower.quantity:
                                self._temp_inventory[alt] = alt_available - flower.quantity
                                reserved[alt] = flower.quantity
                                replacements[flower.name] = alt
                                issues.append({
                                    "flower": flower.name,
                                    "replacement": alt,
                                    "type": "auto_replaced",
                                    "message": f"花材'{flower.name}'缺货，已自动替换为'{alt}'"
                                })
                                replaced = True
                                break
                        
                        if not replaced:
                            issues.append({
                                "flower": flower.name,
                                "type": "no_replacement_available",
                                "message": f"花材'{flower.name}'缺货，且替换花材均不可用"
                            })
                            needs_confirmation = True
                            reserved[flower.name] = available
                            gaps.append(ProcurementGap(
                                flower_name=flower.name,
                                required=flower.quantity,
                                available=available,
                                gap=flower.quantity - available,
                                affected_orders=[order.order_id]
                            ))
                    else:
                        issues.append({
                            "flower": flower.name,
                            "type": "no_replacement_rule",
                            "message": f"花材'{flower.name}'缺货，无替换规则"
                        })
                        needs_confirmation = True
                        reserved[flower.name] = available
                        gaps.append(ProcurementGap(
                            flower_name=flower.name,
                            required=flower.quantity,
                            available=available,
                            gap=flower.quantity - available,
                            affected_orders=[order.order_id]
                        ))
        
        return {
            "required": required,
            "reserved": reserved,
            "replacements": replacements,
            "gaps": gaps,
            "issues": issues,
            "needs_confirmation": needs_confirmation,
            "has_gaps": len(gaps) > 0
        }
    
    def process_replacement(self, order_id: str, original_flower: str, 
                           new_flower: str, quantity: int) -> Dict:
        order = self.data_manager.get_order(order_id)
        if not order:
            return {"success": False, "message": "订单不存在"}
        
        original_req = None
        for f in order.flowers:
            if f.name == original_flower:
                original_req = f
                break
        
        if not original_req:
            return {"success": False, "message": "原花材不在订单中"}
        
        inventory = self.data_manager.get_all_inventory()
        inv_dict = {f.name: f.quantity for f in inventory}
        
        if inv_dict.get(new_flower, 0) < quantity:
            return {"success": False, "message": f"替换花材'{new_flower}'库存不足"}
        
        self.data_manager.add_flower_replacement(order_id, original_flower, new_flower)
        
        return {
            "success": True,
            "message": f"已将'{original_flower}'替换为'{new_flower}'（{quantity}束）",
            "order_id": order_id,
            "original": original_flower,
            "replacement": new_flower,
            "quantity": quantity
        }
    
    def confirm_production(self, order_id: str) -> Dict:
        order = self.data_manager.get_order(order_id)
        if not order:
            return {"success": False, "message": "订单不存在"}
        
        schedule_result = self.generate_schedule()
        for s in schedule_result["schedules"]:
            if s.order_id == order_id:
                for flower_name, qty in s.flowers_reserved.items():
                    current = self._temp_inventory.get(flower_name, 0)
                    self.data_manager.update_inventory(flower_name, current)
                
                if s.workstation_id:
                    self.data_manager.assign_workstation(order_id, s.workstation_id)
                
                if s.delivery_slot:
                    self.data_manager.assign_delivery_slot(order_id, s.delivery_slot)
                
                self.data_manager.confirm_order(order_id)
                
                return {
                    "success": True,
                    "message": f"订单 {order_id} 已确认生产",
                    "workstation": s.workstation_name,
                    "delivery_slot": s.delivery_slot
                }
        
        for wait in schedule_result["waitlist_orders"]:
            if wait["order_id"] == order_id:
                return {"success": False, "message": f"订单在候补队列中：{wait['reason']}"}
        
        for attention in schedule_result["orders_needing_attention"]:
            if attention["order_id"] == order_id:
                return {"success": False, "message": f"订单需要人工处理：{attention['issues']}"}
        
        return {"success": False, "message": "订单未在排程中"}
