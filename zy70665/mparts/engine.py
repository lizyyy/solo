from typing import Dict, List, Optional, Tuple
from collections import defaultdict

from .models import (
    CarModel,
    MaintenanceItem,
    PartInventory,
    AlternativePart,
    PartRequirement,
    MaintenancePlanResult,
    ProcessResult,
    GapLevel,
)


class RulesEngine:
    def __init__(self):
        self.inventory_cache: Dict[str, int] = {}
        self.alternatives_map: Dict[str, List[AlternativePart]] = {}
        self.part_names: Dict[str, str] = {}

    def process(
        self,
        car_models: List[CarModel],
        maintenance_items: List[MaintenanceItem],
        inventory: List[PartInventory],
        alternatives: List[AlternativePart],
    ) -> ProcessResult:
        self._build_inventory_cache(inventory)
        self._build_alternatives_map(alternatives)
        self._build_part_names(inventory)

        working_inventory = self.inventory_cache.copy()
        plan_results: List[MaintenancePlanResult] = []

        for car_model in sorted(car_models, key=lambda x: x.model_id):
            for maintenance in sorted(maintenance_items, key=lambda x: x.maintenance_id):
                if car_model.model_id in maintenance.applicable_models:
                    plan_result = self._process_maintenance_plan(
                        car_model.model_id, maintenance, working_inventory
                    )
                    plan_results.append(plan_result)

        plan_results.sort(key=lambda x: (x.car_model, x.maintenance_id))

        return ProcessResult(
            car_models=car_models,
            maintenance_items=maintenance_items,
            inventory=inventory,
            alternatives=alternatives,
            bad_lines=[],
            plan_results=plan_results,
        )

    def _build_inventory_cache(self, inventory: List[PartInventory]) -> None:
        self.inventory_cache = defaultdict(int)
        for part in inventory:
            self.inventory_cache[part.part_number] += part.quantity

    def _build_alternatives_map(self, alternatives: List[AlternativePart]) -> None:
        self.alternatives_map = defaultdict(list)
        for alt in alternatives:
            self.alternatives_map[alt.original_part].append(alt)

    def _build_part_names(self, inventory: List[PartInventory]) -> None:
        self.part_names = {}
        for part in inventory:
            self.part_names[part.part_number] = part.part_name

    def _process_maintenance_plan(
        self, car_model_id: str, maintenance: MaintenanceItem, working_inventory: Dict[str, int]
    ) -> MaintenancePlanResult:
        parts_summary: List[PartRequirement] = []

        for part_number, required_qty in sorted(maintenance.required_parts.items()):
            part_req = self._calculate_part_requirement(
                car_model_id, part_number, required_qty, working_inventory
            )
            parts_summary.append(part_req)

        total_gap_count = sum(1 for p in parts_summary if p.gap_qty > 0)
        critical_gap_count = sum(
            1 for p in parts_summary if p.gap_level == GapLevel.CRITICAL
        )

        return MaintenancePlanResult(
            car_model=car_model_id,
            maintenance_name=maintenance.name,
            maintenance_id=maintenance.maintenance_id,
            parts_summary=parts_summary,
            total_gap_count=total_gap_count,
            critical_gap_count=critical_gap_count,
        )

    def _calculate_part_requirement(
        self,
        car_model_id: str,
        part_number: str,
        required_qty: int,
        working_inventory: Dict[str, int],
    ) -> PartRequirement:
        part_name = self.part_names.get(part_number, f"Unknown-{part_number}")
        alternatives_for_part = self._get_applicable_alternatives(
            part_number, car_model_id
        )
        alternative_part_numbers = [a.alternative_part for a in alternatives_for_part]

        source_trace = [
            f"保养项目: {part_number}:{required_qty}",
        ]

        remaining_needed = required_qty
        original_qty = working_inventory.get(part_number, 0)

        if original_qty > 0:
            used_from_original = min(original_qty, remaining_needed)
            working_inventory[part_number] -= used_from_original
            remaining_needed -= used_from_original
            if used_from_original > 0:
                source_trace.append(f"使用原配: {part_number} x{used_from_original}")

        for alt in alternatives_for_part:
            if remaining_needed <= 0:
                break
            alt_qty = working_inventory.get(alt.alternative_part, 0)
            if alt_qty > 0:
                used_from_alt = min(alt_qty, remaining_needed)
                working_inventory[alt.alternative_part] -= used_from_alt
                remaining_needed -= used_from_alt
                source_trace.append(
                    f"使用替代(优先级{alt.priority}): {alt.alternative_part} x{used_from_alt}"
                )

        gap_qty = remaining_needed
        gap_level = self._determine_gap_level(gap_qty, required_qty)

        if gap_qty > 0:
            source_trace.append(f"缺口: {gap_qty} 件 ({gap_level})")

        return PartRequirement(
            part_number=part_number,
            part_name=part_name,
            required_qty=required_qty,
            available_qty=required_qty - gap_qty,
            gap_qty=gap_qty,
            gap_level=gap_level,
            alternative_parts=alternative_part_numbers,
            source_trace=source_trace,
        )

    def _get_applicable_alternatives(
        self, part_number: str, car_model_id: str
    ) -> List[AlternativePart]:
        all_alternatives = self.alternatives_map.get(part_number, [])
        applicable = []

        for alt in all_alternatives:
            if alt.applicable_models is None or car_model_id in alt.applicable_models:
                applicable.append(alt)

        applicable.sort(key=lambda x: x.priority)
        return applicable

    def _determine_gap_level(self, gap_qty: int, required_qty: int) -> GapLevel:
        if gap_qty <= 0:
            return GapLevel.LOW

        gap_ratio = gap_qty / required_qty if required_qty > 0 else 1.0

        if gap_ratio >= 0.8:
            return GapLevel.CRITICAL
        elif gap_ratio >= 0.5:
            return GapLevel.HIGH
        elif gap_ratio >= 0.2:
            return GapLevel.MEDIUM
        else:
            return GapLevel.LOW
