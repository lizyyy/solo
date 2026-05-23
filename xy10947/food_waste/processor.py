from datetime import datetime
from typing import Dict, List, Tuple
from collections import defaultdict
from .models import (
    Material, Store, PurchaseItem, UsageItem, WasteItem,
    ProcessConfig, WasteReportItem, StoreRankingItem,
    CategoryAnalysisItem, FinalReport
)


class UnitConverter:
    @staticmethod
    def convert_quantity(quantity: float, from_unit: str, to_unit: str, material: Material) -> Tuple[float, str]:
        if from_unit == to_unit:
            return quantity, to_unit
        
        conversion = material.unit_conversion
        
        if from_unit in conversion:
            base_quantity = quantity * conversion[from_unit]
            if to_unit in conversion:
                return base_quantity / conversion[to_unit], to_unit
            else:
                return base_quantity, material.unit
        
        return quantity, from_unit


class WasteCalculator:
    def __init__(
        self,
        materials: Dict[str, Material],
        stores: Dict[str, Store],
        purchases: List[PurchaseItem],
        usages: List[UsageItem],
        wastes: List[WasteItem],
        config: ProcessConfig
    ):
        self.materials = materials
        self.stores = stores
        self.purchases = purchases
        self.usages = usages
        self.wastes = wastes
        self.config = config
        
        self.purchase_by_store_material: Dict[Tuple[str, str], List[PurchaseItem]] = defaultdict(list)
        self.usage_by_store_material: Dict[Tuple[str, str], List[UsageItem]] = defaultdict(list)
        self.waste_by_store_material: Dict[Tuple[str, str], List[WasteItem]] = defaultdict(list)
        
        self._group_data()

    def _filter_by_date(self, item_date: datetime) -> bool:
        if self.config.date_start and item_date < self.config.date_start:
            return False
        if self.config.date_end and item_date > self.config.date_end:
            return False
        return True

    def _group_data(self):
        for p in self.purchases:
            if self._filter_by_date(p.purchase_date):
                key = (p.store_id, p.material_id)
                self.purchase_by_store_material[key].append(p)
        
        for u in self.usages:
            if self._filter_by_date(u.usage_date):
                key = (u.store_id, u.material_id)
                self.usage_by_store_material[key].append(u)
        
        for w in self.wastes:
            if self._filter_by_date(w.waste_date):
                key = (w.store_id, w.material_id)
                self.waste_by_store_material[key].append(w)

    def _calculate_store_material_totals(self, store_id: str, material_id: str) -> Dict:
        key = (store_id, material_id)
        material = self.materials.get(material_id)
        
        if not material:
            return None
        
        base_unit = material.unit
        
        purchase_qty = 0.0
        purchase_amount = 0.0
        for p in self.purchase_by_store_material[key]:
            qty, _ = UnitConverter.convert_quantity(p.quantity, p.unit, base_unit, material)
            purchase_qty += qty
            purchase_amount += p.total_price
        
        usage_qty = 0.0
        for u in self.usage_by_store_material[key]:
            qty, _ = UnitConverter.convert_quantity(u.quantity, u.unit, base_unit, material)
            usage_qty += qty
        
        waste_qty = 0.0
        for w in self.waste_by_store_material[key]:
            qty, _ = UnitConverter.convert_quantity(w.quantity, w.unit, base_unit, material)
            waste_qty += qty
        
        waste_amount = waste_qty * material.price_per_unit
        
        return {
            'purchase_qty': purchase_qty,
            'purchase_amount': purchase_amount,
            'usage_qty': usage_qty,
            'waste_qty': waste_qty,
            'waste_amount': waste_amount,
            'unit': base_unit
        }

    def generate_report(self, validation_errors: List) -> FinalReport:
        all_store_material_keys = set()
        all_store_material_keys.update(self.purchase_by_store_material.keys())
        all_store_material_keys.update(self.usage_by_store_material.keys())
        all_store_material_keys.update(self.waste_by_store_material.keys())
        
        if self.config.target_store:
            all_store_material_keys = {
                k for k in all_store_material_keys if k[0] == self.config.target_store
            }
        
        report_items = []
        abnormal_items = []
        
        for store_id, material_id in all_store_material_keys:
            if store_id not in self.stores or material_id not in self.materials:
                continue
            
            store = self.stores[store_id]
            material = self.materials[material_id]
            
            if self.config.target_category and material.category != self.config.target_category:
                continue
            
            totals = self._calculate_store_material_totals(store_id, material_id)
            if not totals:
                continue
            
            purchase_qty = totals['purchase_qty']
            waste_qty = totals['waste_qty']
            
            waste_rate = (waste_qty / purchase_qty * 100) if purchase_qty > 0 else 0.0
            is_abnormal = waste_rate > self.config.threshold_waste_rate
            
            report_item = WasteReportItem(
                store_id=store_id,
                store_name=store.store_name,
                material_id=material_id,
                material_name=material.material_name,
                category=material.category,
                purchase_quantity=round(purchase_qty, 4),
                purchase_amount=round(totals['purchase_amount'], 2),
                usage_quantity=round(totals['usage_qty'], 4),
                waste_quantity=round(waste_qty, 4),
                waste_amount=round(totals['waste_amount'], 2),
                waste_rate=round(waste_rate, 2),
                is_abnormal=is_abnormal,
                unit=totals['unit']
            )
            
            report_items.append(report_item)
            if is_abnormal:
                abnormal_items.append(report_item)
        
        store_rankings = self._generate_store_rankings(report_items)
        category_analysis = self._generate_category_analysis(report_items)
        
        summary = {
            'total_stores': len(set(item.store_id for item in report_items)),
            'total_materials': len(set(item.material_id for item in report_items)),
            'total_categories': len(set(item.category for item in report_items)),
            'total_purchase_amount': round(sum(item.purchase_amount for item in report_items), 2),
            'total_waste_amount': round(sum(item.waste_amount for item in report_items), 2),
            'overall_waste_rate': round(
                sum(item.waste_amount for item in report_items) / sum(item.purchase_amount for item in report_items) * 100
                if sum(item.purchase_amount for item in report_items) > 0 else 0,
                2
            ),
            'abnormal_items_count': len(abnormal_items),
            'validation_errors_count': len(validation_errors)
        }
        
        return FinalReport(
            summary=summary,
            store_rankings=store_rankings,
            category_analysis=category_analysis,
            abnormal_items=sorted(abnormal_items, key=lambda x: x.waste_rate, reverse=True),
            validation_errors=validation_errors,
            config=self.config,
            generated_at=datetime.now()
        )

    def _generate_store_rankings(self, report_items: List[WasteReportItem]) -> List[StoreRankingItem]:
        store_data: Dict[str, Dict] = defaultdict(lambda: {
            'total_purchase': 0.0,
            'total_waste': 0.0,
            'waste_amount': 0.0,
            'store_name': ''
        })
        
        for item in report_items:
            store_data[item.store_id]['total_purchase'] += item.purchase_amount
            store_data[item.store_id]['total_waste'] += item.waste_quantity
            store_data[item.store_id]['waste_amount'] += item.waste_amount
            store_data[item.store_id]['store_name'] = item.store_name
        
        rankings = []
        for store_id, data in store_data.items():
            waste_rate = (data['waste_amount'] / data['total_purchase'] * 100) if data['total_purchase'] > 0 else 0.0
            rankings.append(StoreRankingItem(
                store_id=store_id,
                store_name=data['store_name'],
                total_purchase=round(data['total_purchase'], 2),
                total_waste=round(data['total_waste'], 4),
                waste_rate=round(waste_rate, 2),
                waste_amount=round(data['waste_amount'], 2),
                rank=0
            ))
        
        rankings = sorted(rankings, key=lambda x: x.waste_rate, reverse=True)
        for i, item in enumerate(rankings, 1):
            item.rank = i
        
        return rankings

    def _generate_category_analysis(self, report_items: List[WasteReportItem]) -> List[CategoryAnalysisItem]:
        category_data: Dict[str, Dict] = defaultdict(lambda: {
            'total_purchase': 0.0,
            'total_waste': 0.0,
            'waste_amount': 0.0
        })
        
        for item in report_items:
            category_data[item.category]['total_purchase'] += item.purchase_amount
            category_data[item.category]['total_waste'] += item.waste_quantity
            category_data[item.category]['waste_amount'] += item.waste_amount
        
        analysis = []
        for category, data in category_data.items():
            waste_rate = (data['waste_amount'] / data['total_purchase'] * 100) if data['total_purchase'] > 0 else 0.0
            analysis.append(CategoryAnalysisItem(
                category=category,
                total_purchase=round(data['total_purchase'], 2),
                total_waste=round(data['total_waste'], 4),
                waste_rate=round(waste_rate, 2),
                waste_amount=round(data['waste_amount'], 2)
            ))
        
        return sorted(analysis, key=lambda x: x.waste_rate, reverse=True)
