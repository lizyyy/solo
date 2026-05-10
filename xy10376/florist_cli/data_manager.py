import json
from datetime import datetime
from typing import Dict, List, Optional

from .models import (
    Order, FlowerInventory, Workstation, DeliverySlot, 
    ReplacementRule, FlowerRequirement, SystemState
)


class DataManager:
    def __init__(self, state_file: str = "florist_state.json"):
        self.state_file = state_file
        self.state = SystemState()
        self._load_state()
    
    def _load_state(self):
        try:
            with open(self.state_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self._deserialize_state(data)
        except FileNotFoundError:
            pass
    
    def _save_state(self):
        with open(self.state_file, 'w', encoding='utf-8') as f:
            json.dump(self._serialize_state(), f, ensure_ascii=False, indent=2, default=str)
    
    def _serialize_state(self) -> Dict:
        return {
            "orders": {
                oid: {
                    **o.__dict__,
                    "flowers": [f.__dict__ for f in o.flowers],
                    "preferred_delivery": o.preferred_delivery.isoformat() if o.preferred_delivery else None,
                    "import_time": o.import_time.isoformat() if o.import_time else None
                }
                for oid, o in self.state.orders.items()
            },
            "inventory": {name: i.__dict__ for name, i in self.state.inventory.items()},
            "workstations": {wid: w.__dict__ for wid, w in self.state.workstations.items()},
            "delivery_slots": {
                sid: {
                    **s.__dict__,
                    "time": s.time.isoformat()
                }
                for sid, s in self.state.delivery_slots.items()
            },
            "replacement_rules": {rule.original: rule.__dict__ for rule in self.state.replacement_rules.values()},
            "import_sources": self.state.import_sources
        }
    
    def _deserialize_state(self, data: Dict):
        if "orders" in data:
            for oid, odata in data["orders"].items():
                flowers = [FlowerRequirement(**f) for f in odata.get("flowers", [])]
                self.state.orders[oid] = Order(
                    order_id=oid,
                    customer_name=odata["customer_name"],
                    phone=odata["phone"],
                    order_type=odata["order_type"],
                    is_urgent=odata["is_urgent"],
                    flowers=flowers,
                    packaging=odata["packaging"],
                    preferred_delivery=datetime.fromisoformat(odata["preferred_delivery"]) if odata.get("preferred_delivery") else None,
                    batch_id=odata.get("batch_id"),
                    source_file=odata.get("source_file"),
                    import_time=datetime.fromisoformat(odata["import_time"]) if odata.get("import_time") else None,
                    status=odata.get("status", "pending"),
                    workstation_id=odata.get("workstation_id"),
                    delivery_slot_id=odata.get("delivery_slot_id"),
                    flower_replacements=odata.get("flower_replacements", {}),
                    notes=odata.get("notes", "")
                )
        
        if "inventory" in data:
            for name, idata in data["inventory"].items():
                self.state.inventory[name] = FlowerInventory(**idata)
        
        if "workstations" in data:
            for wid, wdata in data["workstations"].items():
                self.state.workstations[wid] = Workstation(**wdata)
        
        if "delivery_slots" in data:
            for sid, sdata in data["delivery_slots"].items():
                self.state.delivery_slots[sid] = DeliverySlot(
                    slot_id=sid,
                    time=datetime.fromisoformat(sdata["time"]),
                    capacity=sdata["capacity"],
                    current_orders=sdata.get("current_orders", [])
                )
        
        if "replacement_rules" in data:
            for rule_data in data["replacement_rules"].values():
                rule = ReplacementRule(**rule_data)
                self.state.replacement_rules[rule.original] = rule
        
        if "import_sources" in data:
            self.state.import_sources = data["import_sources"]
    
    def import_inventory(self, inventory_data: Dict):
        for item in inventory_data:
            flower = FlowerInventory(**item)
            self.state.inventory[flower.name] = flower
        self._save_state()
        return len(inventory_data)
    
    def import_workstations(self, workstation_data: Dict):
        for item in workstation_data:
            ws = Workstation(**item)
            self.state.workstations[ws.workstation_id] = ws
        self._save_state()
        return len(workstation_data)
    
    def import_delivery_slots(self, slot_data: Dict):
        for item in slot_data:
            slot = DeliverySlot(
                slot_id=item["slot_id"],
                time=datetime.fromisoformat(item["time"]),
                capacity=item["capacity"],
                current_orders=item.get("current_orders", [])
            )
            self.state.delivery_slots[slot.slot_id] = slot
        self._save_state()
        return len(slot_data)
    
    def import_replacement_rules(self, rule_data: Dict):
        for item in rule_data:
            rule = ReplacementRule(**item)
            self.state.replacement_rules[rule.original] = rule
        self._save_state()
        return len(rule_data)
    
    def import_orders(self, orders_data: List[Dict], source_file: str) -> Dict:
        import_time = datetime.now()
        result = {
            "imported": [],
            "duplicates": [],
            "conflicts": []
        }
        
        for odata in orders_data:
            order_id = odata["order_id"]
            
            if order_id in self.state.orders:
                result["duplicates"].append(order_id)
                continue
            
            conflict_info = self._check_conflicts(odata)
            if conflict_info:
                result["conflicts"].append({
                    "order_id": order_id,
                    "conflict_type": conflict_info["type"],
                    "conflict_with": conflict_info["with"]
                })
            
            flowers = [FlowerRequirement(**f) for f in odata.get("flowers", [])]
            order = Order(
                order_id=order_id,
                customer_name=odata["customer_name"],
                phone=odata["phone"],
                order_type=odata["order_type"],
                is_urgent=odata.get("is_urgent", False),
                flowers=flowers,
                packaging=odata["packaging"],
                preferred_delivery=datetime.fromisoformat(odata["preferred_delivery"]) if odata.get("preferred_delivery") else None,
                batch_id=odata.get("batch_id"),
                source_file=source_file,
                import_time=import_time,
                status="pending"
            )
            
            self.state.orders[order_id] = order
            result["imported"].append(order_id)
        
        if source_file not in self.state.import_sources:
            self.state.import_sources[source_file] = []
        self.state.import_sources[source_file].extend(result["imported"])
        
        self._save_state()
        return result
    
    def _check_conflicts(self, odata: Dict) -> Optional[Dict]:
        phone = odata.get("phone", "")
        name = odata.get("customer_name", "")
        batch_id = odata.get("batch_id")
        
        for existing_id, existing in self.state.orders.items():
            if phone and existing.phone == phone:
                if existing.customer_name != name:
                    return {
                        "type": "same_phone_different_name",
                        "with": existing_id
                    }
            
            if name and existing.customer_name == name:
                if existing.phone != phone:
                    return {
                        "type": "same_name_different_phone",
                        "with": existing_id
                    }
            
            if batch_id and existing.batch_id == batch_id:
                if existing.order_id != odata["order_id"]:
                    return {
                        "type": "same_batch_different_order",
                        "with": existing_id
                    }
        
        return None
    
    def get_all_orders(self) -> List[Order]:
        return list(self.state.orders.values())
    
    def get_order(self, order_id: str) -> Optional[Order]:
        return self.state.orders.get(order_id)
    
    def get_all_inventory(self) -> List[FlowerInventory]:
        return list(self.state.inventory.values())
    
    def get_all_workstations(self) -> List[Workstation]:
        return list(self.state.workstations.values())
    
    def get_all_delivery_slots(self) -> List[DeliverySlot]:
        return list(self.state.delivery_slots.values())
    
    def get_replacement_rule(self, flower_name: str) -> Optional[ReplacementRule]:
        return self.state.replacement_rules.get(flower_name)
    
    def update_order(self, order: Order):
        self.state.orders[order.order_id] = order
        self._save_state()
    
    def update_inventory(self, flower_name: str, quantity: int):
        if flower_name in self.state.inventory:
            self.state.inventory[flower_name].quantity = quantity
            self._save_state()
    
    def assign_workstation(self, order_id: str, workstation_id: str):
        if order_id in self.state.orders and workstation_id in self.state.workstations:
            order = self.state.orders[order_id]
            ws = self.state.workstations[workstation_id]
            
            if order.workstation_id and order.workstation_id in self.state.workstations:
                old_ws = self.state.workstations[order.workstation_id]
                if order_id in old_ws.current_orders:
                    old_ws.current_orders.remove(order_id)
            
            if order_id not in ws.current_orders:
                ws.current_orders.append(order_id)
            
            order.workstation_id = workstation_id
            self._save_state()
    
    def assign_delivery_slot(self, order_id: str, slot_id: str):
        if order_id in self.state.orders and slot_id in self.state.delivery_slots:
            order = self.state.orders[order_id]
            slot = self.state.delivery_slots[slot_id]
            
            if order.delivery_slot_id and order.delivery_slot_id in self.state.delivery_slots:
                old_slot = self.state.delivery_slots[order.delivery_slot_id]
                if order_id in old_slot.current_orders:
                    old_slot.current_orders.remove(order_id)
            
            if order_id not in slot.current_orders:
                slot.current_orders.append(order_id)
            
            order.delivery_slot_id = slot_id
            self._save_state()
    
    def add_flower_replacement(self, order_id: str, original: str, replacement: str):
        if order_id in self.state.orders:
            order = self.state.orders[order_id]
            order.flower_replacements[original] = replacement
            self._save_state()
    
    def confirm_order(self, order_id: str):
        if order_id in self.state.orders:
            self.state.orders[order_id].status = "confirmed"
            self._save_state()
    
    def reset_state(self):
        self.state = SystemState()
        self._save_state()
