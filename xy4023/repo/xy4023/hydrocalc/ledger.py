import json
import os
import uuid
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Dict, List, Optional, Tuple

from .models import (
    Inventory,
    Material,
    LedgerEntry,
    MaterialUsage,
    ElementLimit,
    WeighingPlan,
    CalculationResult,
)


class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return str(obj)
        return super().default(obj)


def decimal_decoder(dct: Dict) -> Dict:
    for key, value in dct.items():
        if isinstance(value, str):
            try:
                dct[key] = Decimal(value)
            except (ValueError, InvalidOperation):
                pass
        elif isinstance(value, dict):
            dct[key] = decimal_decoder(value)
        elif isinstance(value, list):
            dct[key] = [decimal_decoder(item) if isinstance(item, dict) else item for item in value]
    return dct


class LedgerManager:
    def __init__(self, ledger_path: str):
        self.ledger_path = ledger_path
        self.entries: List[LedgerEntry] = []
        self._load()

    def _load(self) -> None:
        if not os.path.exists(self.ledger_path):
            self.entries = []
            return

        with open(self.ledger_path, "r", encoding="utf-8") as f:
            data = json.load(f, object_hook=decimal_decoder)

        self.entries = []
        for entry_data in data:
            material_usages = [
                MaterialUsage(
                    material_name=u["material_name"],
                    grams_used=u["grams_used"],
                    cost=u["cost"],
                    remaining_before=u["remaining_before"],
                    remaining_after=u["remaining_after"],
                )
                for u in entry_data.get("material_usages", [])
            ]

            element_targets: Dict[str, ElementLimit] = {}
            for elem, limit_data in entry_data.get("element_targets", {}).items():
                element_targets[elem] = ElementLimit(
                    element=elem,
                    min_ppm=limit_data["min_ppm"],
                    max_ppm=limit_data["max_ppm"],
                )

            entry = LedgerEntry(
                batch_id=entry_data["batch_id"],
                timestamp=entry_data["timestamp"],
                volume_liters=entry_data["volume_liters"],
                material_usages=material_usages,
                total_cost=entry_data["total_cost"],
                element_actuals=entry_data.get("element_actuals", {}),
                element_targets=element_targets,
                notes=entry_data.get("notes", ""),
                inventory_snapshot=entry_data.get("inventory_snapshot", {}),
            )
            self.entries.append(entry)

    def _save(self) -> None:
        data = []
        for entry in self.entries:
            material_usages = [
                {
                    "material_name": u.material_name,
                    "grams_used": u.grams_used,
                    "cost": u.cost,
                    "remaining_before": u.remaining_before,
                    "remaining_after": u.remaining_after,
                }
                for u in entry.material_usages
            ]

            element_targets = {
                elem: {
                    "min_ppm": limit.min_ppm,
                    "max_ppm": limit.max_ppm,
                }
                for elem, limit in entry.element_targets.items()
            }

            data.append({
                "batch_id": entry.batch_id,
                "timestamp": entry.timestamp,
                "volume_liters": entry.volume_liters,
                "material_usages": material_usages,
                "total_cost": entry.total_cost,
                "element_actuals": entry.element_actuals,
                "element_targets": element_targets,
                "notes": entry.notes,
                "inventory_snapshot": entry.inventory_snapshot,
            })

        with open(self.ledger_path, "w", encoding="utf-8") as f:
            json.dump(data, f, cls=DecimalEncoder, ensure_ascii=False, indent=2)

    def record_usage(
        self,
        inventory: Inventory,
        calculation_result: CalculationResult,
        notes: str = "",
    ) -> Tuple[LedgerEntry, Dict[str, Decimal]]:
        batch_id = str(uuid.uuid4())[:8]
        timestamp = datetime.now().isoformat()

        inventory_snapshot: Dict[str, Decimal] = {}
        for material in inventory.list_materials():
            inventory_snapshot[material.name] = material.remaining_grams

        material_usages: List[MaterialUsage] = []
        for plan in calculation_result.plans:
            material = inventory.get_material(plan.material_name)
            if not material:
                continue

            remaining_before = material.remaining_grams
            remaining_after = remaining_before - plan.grams_needed

            usage = MaterialUsage(
                material_name=plan.material_name,
                grams_used=plan.grams_needed,
                cost=plan.cost,
                remaining_before=remaining_before,
                remaining_after=remaining_after,
            )
            material_usages.append(usage)

            inventory.deduct(plan.material_name, plan.grams_needed)

        element_actuals: Dict[str, Decimal] = {}
        element_targets: Dict[str, ElementLimit] = {}

        for elem, result in calculation_result.element_results.items():
            element_actuals[elem] = result.actual_ppm
            element_targets[elem] = ElementLimit(
                element=elem,
                min_ppm=result.target_min_ppm,
                max_ppm=result.target_max_ppm,
            )

        entry = LedgerEntry(
            batch_id=batch_id,
            timestamp=timestamp,
            volume_liters=calculation_result.volume_liters,
            material_usages=material_usages,
            total_cost=calculation_result.total_cost,
            element_actuals=element_actuals,
            element_targets=element_targets,
            notes=notes,
            inventory_snapshot=inventory_snapshot,
        )

        self.entries.append(entry)
        self._save()

        updated_inventory: Dict[str, Decimal] = {}
        for material in inventory.list_materials():
            updated_inventory[material.name] = material.remaining_grams

        return entry, updated_inventory

    def undo_last(self, inventory: Inventory) -> Optional[LedgerEntry]:
        if not self.entries:
            return None

        last_entry = self.entries.pop()

        for usage in reversed(last_entry.material_usages):
            material = inventory.get_material(usage.material_name)
            if material:
                material.remaining_grams += usage.grams_used

        self._save()
        return last_entry

    def get_last_entry(self) -> Optional[LedgerEntry]:
        if not self.entries:
            return None
        return self.entries[-1]

    def list_entries(self, limit: int = 10) -> List[LedgerEntry]:
        return self.entries[-limit:]

    def get_total_cost_per_liter(self, entry: LedgerEntry) -> Decimal:
        if entry.volume_liters <= 0:
            return Decimal("0")
        return entry.total_cost / entry.volume_liters
