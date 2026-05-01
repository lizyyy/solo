import copy
from datetime import datetime, timedelta
from typing import List, Dict, Tuple
from .models import (
    Yard, VesselDemand, TruckSlot, Move, Risk, SimulationResult
)


class BaseStrategy:
    def name(self) -> str:
        return "base"

    def select_source_yard(
        self,
        container_type: str,
        needed: int,
        yards: Dict[str, Yard],
        inventory: Dict[str, Dict[str, int]],
        strategy_config: Dict
    ) -> List[Tuple[str, int]]:
        raise NotImplementedError


class NearestFirstStrategy(BaseStrategy):
    def name(self) -> str:
        return "nearest_first"

    def select_source_yard(
        self,
        container_type: str,
        needed: int,
        yards: Dict[str, Yard],
        inventory: Dict[str, Dict[str, int]],
        strategy_config: Dict
    ) -> List[Tuple[str, int]]:
        sorted_yards = sorted(
            yards.values(),
            key=lambda y: y.distance_to_port
        )
        result = []
        remaining = needed
        for yard in sorted_yards:
            if remaining <= 0:
                break
            available = inventory[yard.id].get(container_type, 0)
            if available > 0:
                take = min(available, remaining)
                result.append((yard.id, take))
                remaining -= take
        return result


class PreserveReeferStrategy(BaseStrategy):
    def name(self) -> str:
        return "preserve_reefer"

    def select_source_yard(
        self,
        container_type: str,
        needed: int,
        yards: Dict[str, Yard],
        inventory: Dict[str, Dict[str, int]],
        strategy_config: Dict
    ) -> List[Tuple[str, int]]:
        reefer_types = strategy_config.get("reefer_types", [])
        is_reefer_ct = container_type in reefer_types

        yard_scores = []
        for yard in yards.values():
            available = inventory[yard.id].get(container_type, 0)
            if available <= 0:
                continue
            
            if is_reefer_ct:
                score = (yard.distance_to_port, yard.id)
            else:
                has_reefer = any(
                    inventory[yard.id].get(rt, 0) > 0
                    for rt in reefer_types
                )
                priority = 0 if has_reefer else 1
                score = (priority, yard.distance_to_port, yard.id)
            yard_scores.append((score, yard.id, available))
        
        yard_scores.sort(key=lambda x: x[0])
        
        result = []
        remaining = needed
        for _, yard_id, available in yard_scores:
            if remaining <= 0:
                break
            take = min(available, remaining)
            result.append((yard_id, take))
            remaining -= take
        return result


class SimulationEngine:
    def __init__(
        self,
        yards: Dict[str, Yard],
        initial_inventory: Dict[str, Dict[str, int]],
        vessels: List[VesselDemand],
        slots: List[TruckSlot],
        strategy: BaseStrategy,
        strategy_config: Dict
    ):
        self.yards = yards
        self.inventory = copy.deepcopy(initial_inventory)
        self.vessels = sorted(vessels, key=lambda v: v.eta)
        self.slots = sorted(slots, key=lambda s: s.start_time)
        self.strategy = strategy
        self.strategy_config = strategy_config
        self.moves: List[Move] = []
        self.risks: List[Risk] = []
        self.move_counter = 0
        self.port_yard = strategy_config.get("port_yard", "PORT")

    def get_available_slots(self, before: datetime) -> List[TruckSlot]:
        return [
            s for s in self.slots
            if s.end_time <= before and s.available_capacity > 0
        ]

    def generate_move_id(self) -> str:
        self.move_counter += 1
        return f"MOVE-{self.move_counter:04d}"

    def run(self) -> SimulationResult:
        for vessel in self.vessels:
            self._handle_vessel(vessel)
        
        final_inv_list = []
        for yard_id in self.inventory:
            for ct, qty in self.inventory[yard_id].items():
                if qty > 0:
                    final_inv_list.append(
                        type('YardInventory', (object,), {
                            'yard_id': yard_id,
                            'container_type': ct,
                            'quantity': qty
                        })()
                    )
        
        return SimulationResult(
            moves=self.moves,
            risks=self.risks,
            final_inventory=final_inv_list
        )

    def _handle_vessel(self, vessel: VesselDemand):
        deadline = vessel.eta - timedelta(hours=2)
        available_slots = self.get_available_slots(deadline)
        
        for ct, needed in vessel.demands.items():
            if needed <= 0:
                continue
            
            current_port = self.inventory[self.port_yard].get(ct, 0)
            still_needed = max(0, needed - current_port)
            
            if still_needed <= 0:
                continue
            
            sources = self.strategy.select_source_yard(
                ct, still_needed, self.yards, self.inventory, self.strategy_config
            )
            
            total_available = sum(qty for _, qty in sources)
            if total_available < still_needed:
                self.risks.append(Risk(
                    risk_type="shortage",
                    vessel_id=vessel.vessel_id,
                    container_type=ct,
                    shortage=still_needed - total_available,
                    description=f"船 {vessel.vessel_name} ({vessel.vessel_id}) 缺 {ct} 箱 {still_needed - total_available} 个"
                ))
            
            remaining_to_move = still_needed
            for yard_id, take in sources:
                if remaining_to_move <= 0:
                    break
                
                actual_take = min(take, remaining_to_move)
                
                for slot in available_slots:
                    if actual_take <= 0:
                        break
                    if slot.available_capacity <= 0:
                        continue
                    
                    move_qty = min(actual_take, slot.available_capacity)
                    
                    self.inventory[yard_id][ct] -= move_qty
                    self.inventory[self.port_yard][ct] = self.inventory[self.port_yard].get(ct, 0) + move_qty
                    
                    self.moves.append(Move(
                        move_id=self.generate_move_id(),
                        from_yard=yard_id,
                        to_yard=self.port_yard,
                        container_type=ct,
                        quantity=move_qty,
                        slot_id=slot.slot_id,
                        time=slot.start_time,
                        reason=f"为船 {vessel.vessel_name} 备货"
                    ))
                    
                    slot.available_capacity -= move_qty
                    actual_take -= move_qty
                    remaining_to_move -= move_qty
            
            if remaining_to_move > 0:
                used_capacity = sum(
                    s.capacity - s.available_capacity
                    for s in available_slots
                )
                self.risks.append(Risk(
                    risk_type="capacity",
                    vessel_id=vessel.vessel_id,
                    container_type=ct,
                    shortage=remaining_to_move,
                    description=f"拖车容量不足，未完成 {remaining_to_move} 个 {ct} 箱调运"
                ))


def get_strategy_by_name(name: str) -> BaseStrategy:
    if name == "nearest_first":
        return NearestFirstStrategy()
    elif name == "preserve_reefer":
        return PreserveReeferStrategy()
    else:
        raise ValueError(f"Unknown strategy: {name}")
