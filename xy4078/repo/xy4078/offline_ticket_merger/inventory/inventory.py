"""库存校验模块"""

from collections import defaultdict
from typing import Dict, List, Optional, Set, Tuple

from ..models import (
    ConflictType,
    ImportedTicket,
    InventoryCheckResult,
    MergeConflict,
    MergeResult,
    SparePart,
    WorkOrder,
)


class SparePartInventory:
    def __init__(self, initial_inventory: Optional[List[SparePart]] = None):
        self._inventory: Dict[str, SparePart] = {}
        
        if initial_inventory:
            for part in initial_inventory:
                self._inventory[part.part_number] = SparePart(**part.model_dump())
    
    def get_available_quantity(self, part_number: str) -> int:
        part = self._inventory.get(part_number)
        return part.quantity if part else 0
    
    def get_part(self, part_number: str) -> Optional[SparePart]:
        return self._inventory.get(part_number)
    
    def add_part(self, part: SparePart) -> None:
        if part.part_number in self._inventory:
            existing = self._inventory[part.part_number]
            existing.quantity += part.quantity
        else:
            self._inventory[part.part_number] = SparePart(**part.model_dump())
    
    def remove_part(self, part_number: str, quantity: int) -> bool:
        if part_number not in self._inventory:
            return False
        
        part = self._inventory[part_number]
        if part.quantity < quantity:
            return False
        
        part.quantity -= quantity
        return True
    
    def get_all_parts(self) -> List[SparePart]:
        return [SparePart(**p.model_dump()) for p in self._inventory.values()]
    
    def to_dict(self) -> Dict[str, Dict]:
        return {
            part_number: part.model_dump()
            for part_number, part in self._inventory.items()
        }


class InventoryValidator:
    def __init__(self, inventory: SparePartInventory):
        self.inventory = inventory
        self._consumption_records: Dict[str, List[Dict]] = defaultdict(list)
    
    def validate_work_order(self, work_order: WorkOrder) -> List[InventoryCheckResult]:
        results: List[InventoryCheckResult] = []
        
        for spare_part in work_order.spare_parts:
            part_number = spare_part.part_number
            available = self.inventory.get_available_quantity(part_number)
            requested = spare_part.quantity
            
            past_consumptions = self._consumption_records.get(part_number, [])
            total_consumed = sum(r.get("quantity", 0) for r in past_consumptions)
            
            total_requested = total_consumed + requested
            is_overconsumed = total_requested > available
            overconsumption_amount = max(0, total_requested - available)
            
            part_info = self.inventory.get_part(part_number)
            
            result = InventoryCheckResult(
                part_number=part_number,
                part_name=part_info.part_name if part_info else spare_part.part_name,
                available_quantity=available,
                requested_quantity=requested,
                total_consumed=total_consumed,
                is_overconsumed=is_overconsumed,
                overconsumption_amount=overconsumption_amount,
                consuming_tickets=[r.get("ticket_number", "") for r in past_consumptions],
                consuming_engineers=[r.get("engineer", "") for r in past_consumptions],
                notes=(
                    f"WARNING: Overconsumption detected! "
                    f"Available: {available}, Total requested: {total_requested}, "
                    f"Excess: {overconsumption_amount}"
                    if is_overconsumed else None
                ),
            )
            results.append(result)
        
        return results
    
    def record_consumption(
        self,
        work_order: WorkOrder,
    ) -> None:
        for spare_part in work_order.spare_parts:
            self._consumption_records[spare_part.part_number].append({
                "quantity": spare_part.quantity,
                "ticket_number": work_order.ticket_number,
                "work_order_id": work_order.id,
                "engineer": work_order.engineer_name or work_order.engineer_id or "unknown",
                "used_at": spare_part.used_at,
            })
    
    def validate_all(
        self,
        work_orders: List[WorkOrder],
        track_consumptions: bool = True,
    ) -> Tuple[List[InventoryCheckResult], Dict[str, List[InventoryCheckResult]]]:
        all_results: List[InventoryCheckResult] = []
        results_by_work_order: Dict[str, List[InventoryCheckResult]] = defaultdict(list)
        
        for wo in work_orders:
            wo_results = self.validate_work_order(wo)
            all_results.extend(wo_results)
            results_by_work_order[wo.id] = wo_results
            
            if track_consumptions:
                self.record_consumption(wo)
        
        return all_results, results_by_work_order
    
    def get_conflicts(
        self,
        check_results: List[InventoryCheckResult],
        work_orders: List[WorkOrder],
    ) -> List[MergeConflict]:
        conflicts: List[MergeConflict] = []
        
        overconsumed_results = [r for r in check_results if r.is_overconsumed]
        
        wo_map = {wo.id: wo for wo in work_orders}
        
        for result in overconsumed_results:
            affected_wo_ids = set()
            for wo in work_orders:
                for sp in wo.spare_parts:
                    if sp.part_number == result.part_number:
                        affected_wo_ids.add(wo.id)
                        break
            
            affected_wos = [wo_map[wo_id] for wo_id in affected_wo_ids if wo_id in wo_map]
            
            if affected_wos:
                first_wo = affected_wos[0]
                
                conflicts.append(MergeConflict(
                    conflict_type=ConflictType.SPARE_PART_OVERCONSUMPTION,
                    work_order_id=first_wo.id,
                    ticket_number=first_wo.ticket_number,
                    field_name="spare_parts",
                    values=[{
                        "part_number": result.part_number,
                        "part_name": result.part_name,
                        "available": result.available_quantity,
                        "total_requested": result.total_consumed + result.requested_quantity,
                        "overconsumption": result.overconsumption_amount,
                    }],
                    source_tickets=[wo.ticket_number for wo in affected_wos],
                    source_engineers=[wo.engineer_name or "unknown" for wo in affected_wos],
                    description=(
                        f"Spare part '{result.part_name}' ({result.part_number}) overconsumed: "
                        f"Available {result.available_quantity}, but "
                        f"{result.total_consumed + result.requested_quantity} requested across tickets"
                    ),
                    severity="error",
                ))
        
        return conflicts


class InventoryManager:
    def __init__(self, initial_inventory: Optional[List[SparePart]] = None):
        self.inventory = SparePartInventory(initial_inventory)
    
    def validate_and_merge(
        self,
        work_orders: List[WorkOrder],
        strategy: str = "warn",
    ) -> Tuple[List[InventoryCheckResult], List[MergeConflict]]:
        validator = InventoryValidator(self.inventory)
        
        check_results, _ = validator.validate_all(work_orders, track_consumptions=True)
        
        conflicts = validator.get_conflicts(check_results, work_orders)
        
        if strategy == "adjust":
            self._adjust_for_overconsumption(check_results, work_orders)
        
        return check_results, conflicts
    
    def _adjust_for_overconsumption(
        self,
        check_results: List[InventoryCheckResult],
        work_orders: List[WorkOrder],
    ) -> None:
        for result in check_results:
            if not result.is_overconsumed:
                continue
            
            available = result.available_quantity
            remaining = available
            
            all_spare_parts = []
            for wo in work_orders:
                for sp in wo.spare_parts:
                    if sp.part_number == result.part_number:
                        all_spare_parts.append((wo, sp))
            
            all_spare_parts.sort(
                key=lambda x: x[1].used_at or x[0].created_at
            )
            
            for wo, sp in all_spare_parts:
                if remaining <= 0:
                    sp.quantity = 0
                    if sp.notes:
                        sp.notes += " | Adjusted due to inventory shortage"
                    else:
                        sp.notes = "Adjusted due to inventory shortage"
                elif sp.quantity > remaining:
                    sp.quantity = remaining
                    remaining = 0
                    if sp.notes:
                        sp.notes += " | Partially adjusted due to inventory shortage"
                    else:
                        sp.notes = "Partially adjusted due to inventory shortage"
                else:
                    remaining -= sp.quantity
    
    def reconcile_inventory(
        self,
        work_orders: List[WorkOrder],
    ) -> Dict[str, Dict]:
        consumed: Dict[str, int] = defaultdict(int)
        consumed_by_ticket: Dict[str, List[Dict]] = defaultdict(list)
        
        for wo in work_orders:
            for sp in wo.spare_parts:
                consumed[sp.part_number] += sp.quantity
                consumed_by_ticket[sp.part_number].append({
                    "ticket": wo.ticket_number,
                    "quantity": sp.quantity,
                    "engineer": wo.engineer_name,
                })
        
        reconciliation: Dict[str, Dict] = {}
        all_part_numbers = set(self.inventory._inventory.keys()) | set(consumed.keys())
        
        for part_number in all_part_numbers:
            part_info = self.inventory.get_part(part_number)
            initial = part_info.quantity if part_info else 0
            consumed_qty = consumed.get(part_number, 0)
            remaining = initial - consumed_qty
            
            reconciliation[part_number] = {
                "part_number": part_number,
                "part_name": part_info.part_name if part_info else "Unknown",
                "initial_quantity": initial,
                "consumed_quantity": consumed_qty,
                "remaining_quantity": remaining,
                "consumed_by": consumed_by_ticket.get(part_number, []),
                "is_shortage": remaining < 0,
                "shortage_amount": abs(remaining) if remaining < 0 else 0,
            }
        
        return reconciliation


def validate_spare_parts(
    work_orders: List[WorkOrder],
    inventory_parts: Optional[List[SparePart]] = None,
) -> List[InventoryCheckResult]:
    inventory = SparePartInventory(inventory_parts)
    validator = InventoryValidator(inventory)
    results, _ = validator.validate_all(work_orders, track_consumptions=True)
    return results


def check_overconsumption(
    work_orders: List[WorkOrder],
    inventory_parts: Optional[List[SparePart]] = None,
) -> Tuple[List[InventoryCheckResult], List[MergeConflict]]:
    manager = InventoryManager(inventory_parts)
    return manager.validate_and_merge(work_orders)


def reconcile_inventory(
    work_orders: List[WorkOrder],
    inventory_parts: Optional[List[SparePart]] = None,
) -> Dict[str, Dict]:
    manager = InventoryManager(inventory_parts)
    return manager.reconcile_inventory(work_orders)
