"""调拨规则引擎"""
from datetime import date, timedelta
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any

from .database import Database
from .models import Store, Medicine, Batch, Inventory, Allocation
from .config import (
    NEAR_EXPIRY_DAYS,
    CRITICAL_EXPIRY_DAYS,
    STORAGE_TYPE_NORMAL,
    STORAGE_TYPE_COLD,
    STORAGE_TYPE_FROZEN,
    STATUS_PENDING,
    STATUS_APPROVED,
)


@dataclass
class AllocationSuggestion:
    source_store: Store
    target_store: Store
    batch: Batch
    medicine: Medicine
    source_inventory: Inventory
    target_inventory: Optional[Inventory]
    quantity: int
    days_until_expiry: int
    risk_level: str
    risk_reduction: float
    reasons: List[str] = field(default_factory=list)
    passed: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)


@dataclass
class AllocationValidationResult:
    valid: bool
    errors: List[str]
    warnings: List[str]
    details: Dict[str, Any]


class AllocationRulesEngine:
    def __init__(self, db: Database):
        self.db = db

    def calculate_risk_score(self, inventory: Inventory, batch: Batch) -> tuple:
        days = batch.get_days_until_expiry()
        days_stock = inventory.get_days_of_stock()
        
        risk_score = 0.0
        risk_level = "normal"
        
        if batch.is_expired():
            risk_score = 100.0
            risk_level = "expired"
        elif batch.is_critical_expiry():
            risk_score = 80.0
            risk_level = "critical"
        elif batch.is_near_expiry():
            risk_score = 50.0
            risk_level = "near"
        else:
            risk_score = 10.0
            risk_level = "normal"
        
        if days_stock != float('inf'):
            if days_stock < 30:
                risk_score += 10.0
            if days_stock < 7:
                risk_score += 20.0
        
        if days_stock > days and days != float('inf'):
            risk_score += 20.0
            if days_stock > days * 2:
                risk_score += 20.0
        
        risk_score = min(risk_score, 100.0)
        
        return risk_score, risk_level, days

    def find_high_risk_inventory(self) -> List[Inventory]:
        today = date.today()
        
        critical_cutoff = (today + timedelta(days=CRITICAL_EXPIRY_DAYS)).isoformat()
        near_cutoff = (today + timedelta(days=NEAR_EXPIRY_DAYS)).isoformat()
        
        query = """
            SELECT i.* 
            FROM inventory i
            JOIN batches b ON i.batch_id = b.id
            WHERE i.quantity > 0
              AND b.expiry_date >= ?
              AND b.expiry_date <= ?
            ORDER BY b.expiry_date ASC
        """
        
        rows = self.db.query(query, (today.isoformat(), near_cutoff))
        
        high_risk = []
        for row in rows:
            inv = Inventory.from_row(row)
            batch = inv.get_batch(self.db)
            if batch:
                risk_score, risk_level, days = self.calculate_risk_score(inv, batch)
                if risk_score >= 50.0:
                    high_risk.append(inv)
        
        return high_risk

    def validate_allocation(self, source_store: Store, target_store: Store, 
                            batch: Batch, medicine: Medicine,
                            source_inventory: Inventory, target_inventory: Optional[Inventory],
                            quantity: int) -> AllocationValidationResult:
        errors = []
        warnings = []
        details = {}
        
        if batch.is_expired():
            errors.append("批次已过期，禁止调拨")
            return AllocationValidationResult(False, errors, warnings, details)
        
        pending = Allocation.get_pending_duplicate(
            self.db, source_store.id, target_store.id, batch.id
        )
        if pending:
            errors.append(f"已存在相同源门店、目标门店和批次的待处理调拨: {pending.allocation_code}")
        
        if source_store.region != target_store.region:
            if medicine.storage_type == STORAGE_TYPE_COLD:
                errors.append("冷链药品不可跨区域调拨")
            elif medicine.storage_type == STORAGE_TYPE_FROZEN:
                errors.append("冷冻药品不可跨区域调拨")
        
        if target_inventory and target_inventory.daily_sales_rate > 0:
            days_stock_target = target_inventory.get_days_of_stock()
            if days_stock_target > 180:
                warnings.append("目标门店当前库存可供应超过180天，建议评估调拨必要性")
        
        if source_inventory.quantity < quantity:
            errors.append(f"源门店库存不足: 当前 {source_inventory.quantity}, 申请调拨 {quantity}")
        
        if target_inventory and target_inventory.daily_sales_rate > 0:
            projected_stock = (target_inventory.quantity + quantity) / target_inventory.daily_sales_rate
            if projected_stock < 14:
                warnings.append(f"调拨后目标门店预计库存仅可供应 {projected_stock:.1f} 天")
            elif projected_stock > 365:
                warnings.append(f"调拨后目标门店预计库存可供应 {projected_stock:.1f} 天，可能造成新的积压")
        
        batch_days = batch.get_days_until_expiry()
        if target_inventory and target_inventory.daily_sales_rate > 0:
            can_sell_quantity = int(target_inventory.daily_sales_rate * batch_days)
            if quantity > can_sell_quantity:
                warnings.append(
                    f"目标门店在效期内最多可销售 {can_sell_quantity} 盒，"
                    f"调拨 {quantity} 盒可能导致新的过期风险"
                )
        
        details["batch_days_until_expiry"] = batch_days
        details["source_store_region"] = source_store.region
        details["target_store_region"] = target_store.region
        details["storage_type"] = medicine.storage_type
        
        if errors:
            return AllocationValidationResult(False, errors, warnings, details)
        else:
            return AllocationValidationResult(True, errors, warnings, details)

    def find_target_stores(self, medicine: Medicine, batch: Batch, 
                           source_store: Store) -> List[Store]:
        stores = Store.get_all(self.db)
        target_stores = []
        
        for store in stores:
            if store.id == source_store.id:
                continue
            
            if medicine.storage_type in [STORAGE_TYPE_COLD, STORAGE_TYPE_FROZEN]:
                if store.region != source_store.region:
                    continue
            
            inv_rows = self.db.query(
                """SELECT i.* FROM inventory i
                   JOIN batches b ON i.batch_id = b.id
                   WHERE i.store_id = ? AND b.medicine_id = ?""",
                (store.id, medicine.id)
            )
            
            if inv_rows:
                for row in inv_rows:
                    inv = Inventory.from_row(row)
                    if inv.daily_sales_rate > 0:
                        target_stores.append(store)
                        break
            else:
                target_stores.append(store)
        
        return target_stores

    def calculate_transfer_quantity(self, source_inv: Inventory, target_inv: Optional[Inventory],
                                     batch: Batch) -> tuple:
        days = batch.get_days_until_expiry()
        
        if source_inv.quantity <= 0:
            return 0, 0.0
        
        if target_inv is None or target_inv.daily_sales_rate <= 0:
            return 0, 0.0
        
        can_sell_at_target = int(target_inv.daily_sales_rate * days * 0.8)
        
        if can_sell_at_target <= 0:
            return 0, 0.0
        
        original_risk_score, _, _ = self.calculate_risk_score(source_inv, batch)
        
        transfer_qty = min(source_inv.quantity, can_sell_at_target)
        
        if transfer_qty <= 0:
            return 0, 0.0
        
        remaining_qty = source_inv.quantity - transfer_qty
        remaining_inv = Inventory(
            id=source_inv.id,
            store_id=source_inv.store_id,
            batch_id=source_inv.batch_id,
            quantity=remaining_qty,
            daily_sales_rate=source_inv.daily_sales_rate,
        )
        
        new_risk_score, _, _ = self.calculate_risk_score(remaining_inv, batch)
        risk_reduction = original_risk_score - new_risk_score
        
        return transfer_qty, risk_reduction

    def generate_suggestions(self) -> List[AllocationSuggestion]:
        high_risk_invs = self.find_high_risk_inventory()
        
        suggestions = []
        
        for inv in high_risk_invs:
            source_store = inv.get_store(self.db)
            batch = inv.get_batch(self.db)
            medicine = batch.get_medicine(self.db)
            
            if not source_store or not batch or not medicine:
                continue
            
            target_stores = self.find_target_stores(medicine, batch, source_store)
            
            for target_store in target_stores:
                target_inv_rows = self.db.query(
                    """SELECT i.* FROM inventory i
                       WHERE i.store_id = ? AND i.batch_id = ?""",
                    (target_store.id, batch.id)
                )
                
                target_inv = None
                if target_inv_rows:
                    target_inv = Inventory.from_row(target_inv_rows[0])
                
                if target_inv is None:
                    medicine_invs = self.db.query(
                        """SELECT i.* FROM inventory i
                           JOIN batches b ON i.batch_id = b.id
                           WHERE i.store_id = ? AND b.medicine_id = ?
                           ORDER BY b.expiry_date ASC
                           LIMIT 1""",
                        (target_store.id, medicine.id)
                    )
                    if medicine_invs:
                        temp_inv = Inventory.from_row(medicine_invs[0])
                        target_inv = Inventory(
                            id=0,
                            store_id=target_store.id,
                            batch_id=batch.id,
                            quantity=0,
                            daily_sales_rate=temp_inv.daily_sales_rate,
                        )
                
                transfer_qty, risk_reduction = self.calculate_transfer_quantity(
                    inv, target_inv, batch
                )
                
                if transfer_qty <= 0:
                    continue
                
                risk_score, risk_level, days = self.calculate_risk_score(inv, batch)
                
                suggestion = AllocationSuggestion(
                    source_store=source_store,
                    target_store=target_store,
                    batch=batch,
                    medicine=medicine,
                    source_inventory=inv,
                    target_inventory=target_inv,
                    quantity=transfer_qty,
                    days_until_expiry=days,
                    risk_level=risk_level,
                    risk_reduction=risk_reduction,
                )
                
                validation = self.validate_allocation(
                    source_store, target_store, batch, medicine, inv, target_inv, transfer_qty
                )
                
                suggestion.errors = validation.errors
                suggestion.passed = []
                suggestion.reasons = []
                
                if not validation.errors:
                    if batch.is_critical_expiry():
                        suggestion.reasons.append("批次处于临期预警期")
                    elif batch.is_near_expiry():
                        suggestion.reasons.append("批次接近效期")
                    
                    if medicine.storage_type in [STORAGE_TYPE_COLD, STORAGE_TYPE_FROZEN]:
                        suggestion.reasons.append("同区域调拨，符合冷链要求")
                    
                    if target_inv and target_inv.daily_sales_rate > inv.daily_sales_rate:
                        suggestion.reasons.append("目标门店销售速度更快")
                    
                    suggestion.passed = [
                        "批次未过期",
                        "无重复待处理调拨",
                        "目标门店销售能力足够"
                    ]
                else:
                    suggestion.reasons = validation.errors
                
                suggestions.append(suggestion)
        
        suggestions.sort(key=lambda x: x.risk_reduction, reverse=True)
        
        return suggestions
