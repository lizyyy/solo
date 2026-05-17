from typing import List, Dict, Any, Optional
from collections import defaultdict
from datetime import date

from .models import Material, PurchaseOrder, UsageOrder, DamageReport, Store, WasteRecord, Unit
from .unit_converter import UnitConverter


class WasteAnalyzer:
    def __init__(
        self,
        materials: List[Material],
        purchases: List[PurchaseOrder],
        usages: List[UsageOrder],
        damages: List[DamageReport],
        stores: List[Store],
        waste_rate_threshold: float = 0.05,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
    ):
        self.materials = {m.material_id: m for m in materials}
        self.stores = {s.store_id: s for s in stores}
        self.purchases = purchases
        self.usages = usages
        self.damages = damages
        self.waste_rate_threshold = waste_rate_threshold
        self.start_date = start_date
        self.end_date = end_date

        self._filter_by_date()

    def _filter_by_date(self):
        if self.start_date:
            self.purchases = [p for p in self.purchases if p.purchase_date >= self.start_date]
            self.usages = [u for u in self.usages if u.usage_date >= self.start_date]
            self.damages = [d for d in self.damages if d.damage_date >= self.start_date]

        if self.end_date:
            self.purchases = [p for p in self.purchases if p.purchase_date <= self.end_date]
            self.usages = [u for u in self.usages if u.usage_date <= self.end_date]
            self.damages = [d for d in self.damages if d.damage_date <= self.end_date]

    def _aggregate_quantity(
        self,
        records: List[Any],
        material_id_key: str,
        store_id_key: str,
        quantity_key: str,
        unit_key: str,
        target_unit: Unit,
    ) -> Dict[tuple, float]:
        aggregated = defaultdict(float)
        for record in records:
            material_id = getattr(record, material_id_key)
            store_id = getattr(record, store_id_key)
            quantity = getattr(record, quantity_key)
            unit = getattr(record, unit_key)

            if material_id not in self.materials:
                continue
            if store_id not in self.stores:
                continue

            if UnitConverter.is_compatible(unit, target_unit):
                normalized_quantity = UnitConverter.convert(quantity, unit, target_unit)
                aggregated[(material_id, store_id)] += normalized_quantity

        return dict(aggregated)

    def calculate_waste_records(self) -> List[WasteRecord]:
        records = []
        all_keys = set()

        for material in self.materials.values():
            for store in self.stores.values():
                all_keys.add((material.material_id, store.store_id))

        purchases_agg = self._aggregate_quantity(
            self.purchases, "material_id", "store_id", "quantity", "unit", Unit.G
        )
        usages_agg = self._aggregate_quantity(
            self.usages, "material_id", "store_id", "quantity", "unit", Unit.G
        )
        damages_agg = self._aggregate_quantity(
            self.damages, "material_id", "store_id", "quantity", "unit", Unit.G
        )

        for material_id, store_id in all_keys:
            purchase_qty = purchases_agg.get((material_id, store_id), 0.0)
            usage_qty = usages_agg.get((material_id, store_id), 0.0)
            damage_qty = damages_agg.get((material_id, store_id), 0.0)

            if purchase_qty <= 0:
                continue

            waste_rate = damage_qty / purchase_qty if purchase_qty > 0 else 0.0
            is_abnormal = waste_rate > self.waste_rate_threshold

            material = self.materials[material_id]
            store = self.stores[store_id]

            try:
                display_unit = material.unit
                purchase_qty_display = UnitConverter.convert(purchase_qty, Unit.G, display_unit)
                usage_qty_display = UnitConverter.convert(usage_qty, Unit.G, display_unit)
                damage_qty_display = UnitConverter.convert(damage_qty, Unit.G, display_unit)
            except ValueError:
                display_unit = Unit.G
                purchase_qty_display = purchase_qty
                usage_qty_display = usage_qty
                damage_qty_display = damage_qty

            record = WasteRecord(
                material_id=material_id,
                material_name=material.material_name,
                category=material.category,
                store_id=store_id,
                store_name=store.store_name,
                purchase_quantity=round(purchase_qty_display, 2),
                usage_quantity=round(usage_qty_display, 2),
                damage_quantity=round(damage_qty_display, 2),
                waste_rate=round(waste_rate, 4),
                is_abnormal=is_abnormal,
                unit=display_unit,
            )
            records.append(record)

        return records

    def get_abnormal_records(self, records: List[WasteRecord]) -> List[WasteRecord]:
        return [r for r in records if r.is_abnormal]

    def get_store_ranking(self, records: List[WasteRecord], by: str = "waste_rate") -> List[Dict[str, Any]]:
        store_stats = defaultdict(lambda: {"total_purchase": 0.0, "total_damage": 0.0, "record_count": 0})

        for record in records:
            store_id = record.store_id
            store_stats[store_id]["total_purchase"] += record.purchase_quantity
            store_stats[store_id]["total_damage"] += record.damage_quantity
            store_stats[store_id]["record_count"] += 1

        ranking = []
        for store_id, stats in store_stats.items():
            store = self.stores[store_id]
            waste_rate = (
                stats["total_damage"] / stats["total_purchase"]
                if stats["total_purchase"] > 0
                else 0.0
            )
            ranking.append(
                {
                    "store_id": store_id,
                    "store_name": store.store_name,
                    "region": store.region,
                    "total_purchase": round(stats["total_purchase"], 2),
                    "total_damage": round(stats["total_damage"], 2),
                    "waste_rate": round(waste_rate, 4),
                    "record_count": stats["record_count"],
                }
            )

        if by == "waste_rate":
            ranking.sort(key=lambda x: x["waste_rate"], reverse=True)
        elif by == "total_damage":
            ranking.sort(key=lambda x: x["total_damage"], reverse=True)

        return ranking

    def get_category_summary(self, records: List[WasteRecord]) -> List[Dict[str, Any]]:
        category_stats = defaultdict(lambda: {"total_purchase": 0.0, "total_damage": 0.0})

        for record in records:
            category = record.category
            category_stats[category]["total_purchase"] += record.purchase_quantity
            category_stats[category]["total_damage"] += record.damage_quantity

        summary = []
        for category, stats in category_stats.items():
            waste_rate = (
                stats["total_damage"] / stats["total_purchase"]
                if stats["total_purchase"] > 0
                else 0.0
            )
            summary.append(
                {
                    "category": category,
                    "total_purchase": round(stats["total_purchase"], 2),
                    "total_damage": round(stats["total_damage"], 2),
                    "waste_rate": round(waste_rate, 4),
                }
            )

        summary.sort(key=lambda x: x["waste_rate"], reverse=True)
        return summary
