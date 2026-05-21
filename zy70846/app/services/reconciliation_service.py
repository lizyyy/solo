from datetime import datetime, date, timedelta
from typing import Dict, List, Optional, Tuple
from collections import defaultdict

from app.schemas.inventory import InventoryRecord, InventoryItem
from app.schemas.sales import SalesRecord, SalesItem
from app.schemas.replenishment import ReplenishmentRecord, ReplenishmentItem
from app.schemas.reconciliation import (
    ReconciliationRecord, ReconciliationSummary, DiscrepancyDetail,
    ReconciliationStatus, DiscrepancyType, ReviewAction
)
from app.schemas.common import AuditLog
from app.storage.memory import storage


class ReconciliationService:
    def __init__(self):
        pass
    
    def _get_sku_data_map(
        self,
        inventory: InventoryRecord,
        sales: SalesRecord,
        replenishment: ReplenishmentRecord
    ) -> Tuple[Dict, Dict, Dict, Dict, Dict, set]:
        
        inventory_map: Dict[str, List[InventoryItem]] = defaultdict(list)
        sales_map: Dict[str, int] = defaultdict(int)
        replenish_actual_map: Dict[str, int] = defaultdict(int)
        replenish_request_map: Dict[str, int] = defaultdict(int)
        unit_price_map: Dict[str, float] = {}
        
        for item in inventory.items:
            mapped_sku = storage.get_sku_by_alias(item.sku_name) or item.sku
            inventory_map[mapped_sku].append(item)
            if item.unit_price:
                unit_price_map[mapped_sku] = item.unit_price
        
        for item in sales.items:
            mapped_sku = storage.get_sku_by_alias(item.sku_name) or item.sku
            sales_map[mapped_sku] += item.quantity
            if item.unit_price and mapped_sku not in unit_price_map:
                unit_price_map[mapped_sku] = item.unit_price
        
        for item in replenishment.items:
            mapped_sku = storage.get_sku_by_alias(item.sku_name) or item.sku
            replenish_actual_map[mapped_sku] += item.actual_quantity
            replenish_request_map[mapped_sku] += item.requested_quantity
            if item.unit_price and mapped_sku not in unit_price_map:
                unit_price_map[mapped_sku] = item.unit_price
        
        all_skus = set(inventory_map.keys()) | set(sales_map.keys()) | set(replenish_actual_map.keys())
        return (
            dict(inventory_map), 
            dict(sales_map), 
            dict(replenish_actual_map),
            dict(replenish_request_map),
            dict(unit_price_map), 
            all_skus
        )
    
    def _is_expiring_soon(self, expiry_date: Optional[date], days: int = 30) -> bool:
        if not expiry_date:
            return False
        days_until_expiry = (expiry_date - date.today()).days
        return 0 <= days_until_expiry <= days
    
    def _generate_discrepancy_explanation(
        self,
        discrepancy_type: DiscrepancyType,
        sku: str,
        sku_name: str,
        discrepancy_qty: int,
        inventory_qty: int,
        sales_qty: int,
        replenish_qty: int,
        replenish_request_qty: int,
        is_sku_alias: bool,
        is_expiring: bool
    ) -> str:
        explanations = []
        
        if is_sku_alias:
            explanations.append(f"商品名称存在别名映射: {sku_name}")
        
        if is_expiring:
            explanations.append("该商品临期（30天内到期）")
        
        if discrepancy_type == DiscrepancyType.OVERSTOCK:
            explanations.append(
                f"盘盈: 实际库存({inventory_qty}) > 合理库存范围，差异{abs(discrepancy_qty)}个。"
                f"可能原因: 上期盘点偏差、补货多送、销售漏录"
            )
        elif discrepancy_type == DiscrepancyType.UNDERSTOCK:
            explanations.append(
                f"盘亏: 实际库存({inventory_qty}) < 合理库存范围，差异{abs(discrepancy_qty)}个。"
                f"可能原因: 损耗、被盗、销售多录、补货少送"
            )
        elif discrepancy_type == DiscrepancyType.OVER_REPLENISH:
            explanations.append(
                f"补货多送: 申请{replenish_request_qty}个，实际{replenish_qty}个，多送{abs(discrepancy_qty)}个"
            )
        elif discrepancy_type == DiscrepancyType.UNDER_REPLENISH:
            explanations.append(
                f"补货少送: 申请{replenish_request_qty}个，实际{replenish_qty}个，少送{abs(discrepancy_qty)}个"
            )
        elif discrepancy_type == DiscrepancyType.EXPIRING_SOON:
            explanations.append("商品临期预警，需尽快促销处理")
        elif discrepancy_type == DiscrepancyType.SKU_ALIAS:
            explanations.append("SKU名称不统一，已自动映射合并统计")
        
        return " | ".join(explanations)
    
    def create_reconciliation(
        self,
        inventory_id: str,
        sales_id: str,
        replenishment_id: str,
        operator: str,
        store_id: str,
        store_name: str
    ) -> ReconciliationRecord:
        
        inventory = storage.get_inventory(inventory_id)
        sales = storage.get_sales(sales_id)
        replenishment = storage.get_replenishment(replenishment_id)
        
        if not all([inventory, sales, replenishment]):
            raise ValueError("缺少必要的对账数据")
        
        record = ReconciliationRecord(
            id=storage.generate_id(),
            store_id=store_id,
            store_name=store_name,
            reconciliation_date=date.today(),
            operator=operator,
            inventory_record_id=inventory_id,
            sales_record_id=sales_id,
            replenishment_record_id=replenishment_id,
            status=ReconciliationStatus.PROCESSING
        )
        
        self._perform_reconciliation(record, inventory, sales, replenishment)
        record.status = ReconciliationStatus.REVIEWING
        
        self._add_audit_log(
            record.id, "创建对账", operator,
            {"inventory_id": inventory_id, "sales_id": sales_id, "replenishment_id": replenishment_id}
        )
        
        return storage.save_reconciliation(record)
    
    def _perform_reconciliation(
        self,
        record: ReconciliationRecord,
        inventory: InventoryRecord,
        sales: SalesRecord,
        replenishment: ReplenishmentRecord
    ):
        inv_map, sales_map, replenish_actual_map, replenish_request_map, price_map, all_skus = self._get_sku_data_map(
            inventory, sales, replenishment
        )
        
        discrepancies = []
        summary = ReconciliationSummary()
        
        for sku in all_skus:
            inv_items = inv_map.get(sku, [])
            inv_qty = sum(item.quantity for item in inv_items)
            sales_qty = sales_map.get(sku, 0)
            replenish_actual_qty = replenish_actual_map.get(sku, 0)
            replenish_request_qty = replenish_request_map.get(sku, 0)
            
            is_sku_alias = any(storage.get_sku_by_alias(item.sku_name) == sku for item in inv_items)
            is_expiring = any(self._is_expiring_soon(item.expiry_date) for item in inv_items)
            expiry_date = next((item.expiry_date for item in inv_items if item.expiry_date), None)
            
            sku_name = inv_items[0].sku_name if inv_items else sku
            unit_price = price_map.get(sku, 0)
            
            replenish_diff = replenish_actual_qty - replenish_request_qty
            
            net_flow = replenish_actual_qty - sales_qty
            inventory_reasonableness = abs(net_flow) * 0.1
            stock_diff = inv_qty - net_flow if abs(inv_qty - net_flow) > inventory_reasonableness else 0
            
            if replenish_diff != 0:
                rep_type = DiscrepancyType.OVER_REPLENISH if replenish_diff > 0 else DiscrepancyType.UNDER_REPLENISH
                explanation = self._generate_discrepancy_explanation(
                    rep_type, sku, sku_name, replenish_diff,
                    inv_qty, sales_qty, replenish_actual_qty, replenish_request_qty,
                    is_sku_alias, is_expiring
                )
                discrepancy = DiscrepancyDetail(
                    id=storage.generate_id(),
                    sku=sku,
                    sku_name=sku_name,
                    discrepancy_type=rep_type,
                    discrepancy_qty=replenish_diff,
                    discrepancy_value=abs(replenish_diff) * unit_price,
                    inventory_qty=inv_qty,
                    sales_qty=sales_qty,
                    replenish_qty=replenish_actual_qty,
                    expected_qty=replenish_request_qty,
                    actual_qty=replenish_actual_qty,
                    explanation=explanation,
                    source_records=[inventory.id, sales.id, replenishment.id],
                    is_sku_alias=is_sku_alias,
                    is_expiring_soon=is_expiring,
                    expiry_date=expiry_date
                )
                discrepancies.append(discrepancy)
                summary.discrepant_skus += 1
                summary.total_discrepancy_qty += abs(replenish_diff)
                summary.total_discrepancy_value += abs(replenish_diff) * unit_price
                if replenish_diff > 0:
                    summary.overstock_qty += replenish_diff
                else:
                    summary.understock_qty += abs(replenish_diff)
            
            if stock_diff != 0 and replenish_diff == 0:
                stock_type = DiscrepancyType.OVERSTOCK if stock_diff > 0 else DiscrepancyType.UNDERSTOCK
                explanation = self._generate_discrepancy_explanation(
                    stock_type, sku, sku_name, stock_diff,
                    inv_qty, sales_qty, replenish_actual_qty, replenish_request_qty,
                    is_sku_alias, is_expiring
                )
                discrepancy = DiscrepancyDetail(
                    id=storage.generate_id(),
                    sku=sku,
                    sku_name=sku_name,
                    discrepancy_type=stock_type,
                    discrepancy_qty=stock_diff,
                    discrepancy_value=abs(stock_diff) * unit_price,
                    inventory_qty=inv_qty,
                    sales_qty=sales_qty,
                    replenish_qty=replenish_actual_qty,
                    expected_qty=net_flow,
                    actual_qty=inv_qty,
                    explanation=explanation,
                    source_records=[inventory.id, sales.id, replenishment.id],
                    is_sku_alias=is_sku_alias,
                    is_expiring_soon=is_expiring,
                    expiry_date=expiry_date
                )
                discrepancies.append(discrepancy)
                summary.discrepant_skus += 1
                summary.total_discrepancy_qty += abs(stock_diff)
                summary.total_discrepancy_value += abs(stock_diff) * unit_price
                if stock_diff > 0:
                    summary.overstock_qty += stock_diff
                else:
                    summary.understock_qty += abs(stock_diff)
            
            if is_expiring and replenish_diff == 0 and stock_diff == 0:
                explanation = self._generate_discrepancy_explanation(
                    DiscrepancyType.EXPIRING_SOON, sku, sku_name, 0,
                    inv_qty, sales_qty, replenish_actual_qty, replenish_request_qty,
                    is_sku_alias, is_expiring
                )
                discrepancy = DiscrepancyDetail(
                    id=storage.generate_id(),
                    sku=sku,
                    sku_name=sku_name,
                    discrepancy_type=DiscrepancyType.EXPIRING_SOON,
                    discrepancy_qty=inv_qty,
                    discrepancy_value=inv_qty * unit_price,
                    inventory_qty=inv_qty,
                    sales_qty=sales_qty,
                    replenish_qty=replenish_actual_qty,
                    expected_qty=inv_qty,
                    actual_qty=inv_qty,
                    explanation=explanation,
                    source_records=[inventory.id, sales.id, replenishment.id],
                    is_sku_alias=is_sku_alias,
                    is_expiring_soon=is_expiring,
                    expiry_date=expiry_date
                )
                discrepancies.append(discrepancy)
                summary.discrepant_skus += 1
                summary.expiring_skus += 1
            
            if is_sku_alias and replenish_diff == 0 and stock_diff == 0 and not is_expiring:
                explanation = self._generate_discrepancy_explanation(
                    DiscrepancyType.SKU_ALIAS, sku, sku_name, 0,
                    inv_qty, sales_qty, replenish_actual_qty, replenish_request_qty,
                    is_sku_alias, is_expiring
                )
                discrepancy = DiscrepancyDetail(
                    id=storage.generate_id(),
                    sku=sku,
                    sku_name=sku_name,
                    discrepancy_type=DiscrepancyType.SKU_ALIAS,
                    discrepancy_qty=0,
                    discrepancy_value=0,
                    inventory_qty=inv_qty,
                    sales_qty=sales_qty,
                    replenish_qty=replenish_actual_qty,
                    expected_qty=inv_qty,
                    actual_qty=inv_qty,
                    explanation=explanation,
                    source_records=[inventory.id, sales.id, replenishment.id],
                    is_sku_alias=is_sku_alias,
                    is_expiring_soon=is_expiring,
                    expiry_date=expiry_date
                )
                discrepancies.append(discrepancy)
                summary.discrepant_skus += 1
                summary.alias_skus += 1
            
            summary.total_skus += 1
            summary.total_inventory_qty += inv_qty
            summary.total_sales_qty += sales_qty
            summary.total_replenish_qty += replenish_actual_qty
        
        summary.matched_skus = summary.total_skus - summary.discrepant_skus + summary.alias_skus
        summary.expected_inventory = summary.total_inventory_qty - summary.overstock_qty + summary.understock_qty
        summary.actual_inventory = summary.total_inventory_qty
        
        record.discrepancies = discrepancies
        record.summary = summary
    
    def _recalculate_summary(self, record: ReconciliationRecord):
        summary = ReconciliationSummary()
        
        for disc in record.discrepancies:
            summary.total_skus += 1
            summary.total_inventory_qty += disc.inventory_qty
            summary.total_sales_qty += disc.sales_qty
            summary.total_replenish_qty += disc.replenish_qty
            
            if disc.is_resolved:
                summary.resolved_skus += 1
                summary.matched_skus += 1
            else:
                summary.discrepant_skus += 1
                summary.total_discrepancy_qty += abs(disc.discrepancy_qty)
                summary.total_discrepancy_value += disc.discrepancy_value
                
                if disc.discrepancy_qty > 0:
                    summary.overstock_qty += disc.discrepancy_qty
                elif disc.discrepancy_qty < 0:
                    summary.understock_qty += abs(disc.discrepancy_qty)
                
                if disc.is_expiring_soon:
                    summary.expiring_skus += 1
                if disc.is_sku_alias:
                    summary.alias_skus += 1
        
        summary.expected_inventory = summary.total_inventory_qty - summary.overstock_qty + summary.understock_qty
        summary.actual_inventory = summary.total_inventory_qty
        record.summary = summary
    
    def review_discrepancy(
        self,
        reconciliation_id: str,
        discrepancy_id: str,
        action: ReviewAction,
        reviewer: str,
        remark: str = "",
        revised_qty: Optional[int] = None
    ) -> ReconciliationRecord:
        
        record = storage.get_reconciliation(reconciliation_id)
        if not record:
            raise ValueError("对账记录不存在")
        
        discrepancy = next((d for d in record.discrepancies if d.id == discrepancy_id), None)
        if not discrepancy:
            raise ValueError("差异记录不存在")
        
        discrepancy.review_action = action
        discrepancy.reviewer = reviewer
        discrepancy.review_remark = remark
        discrepancy.reviewed_at = datetime.now()
        
        if action == ReviewAction.APPROVE:
            discrepancy.is_resolved = True
        elif action == ReviewAction.REVISE and revised_qty is not None:
            old_discrepancy_qty = discrepancy.discrepancy_qty
            discrepancy.actual_qty = revised_qty
            discrepancy.discrepancy_qty = revised_qty - discrepancy.expected_qty
            if old_discrepancy_qty != 0:
                unit_value = discrepancy.discrepancy_value / abs(old_discrepancy_qty)
                discrepancy.discrepancy_value = abs(discrepancy.discrepancy_qty) * unit_value
        
        record.review_history.append({
            "discrepancy_id": discrepancy_id,
            "action": action.value,
            "reviewer": reviewer,
            "remark": remark,
            "timestamp": datetime.now().isoformat()
        })
        
        self._recalculate_summary(record)
        self._add_audit_log(
            reconciliation_id, "复核差异", reviewer,
            {"discrepancy_id": discrepancy_id, "action": action.value, "remark": remark}
        )
        
        all_resolved = all(d.is_resolved for d in record.discrepancies)
        if all_resolved:
            record.status = ReconciliationStatus.APPROVED
        
        return storage.save_reconciliation(record)
    
    def complete_reconciliation(self, reconciliation_id: str, operator: str) -> ReconciliationRecord:
        record = storage.get_reconciliation(reconciliation_id)
        if not record:
            raise ValueError("对账记录不存在")
        
        record.status = ReconciliationStatus.COMPLETED
        record.completed_at = datetime.now()
        
        self._add_audit_log(
            reconciliation_id, "完成对账", operator,
            {"status": "completed"}
        )
        
        return storage.save_reconciliation(record)
    
    def _add_audit_log(self, reconciliation_id: str, action: str, operator: str, details: Dict):
        log = AuditLog(
            id=storage.generate_id(),
            reconciliation_id=reconciliation_id,
            action=action,
            operator=operator,
            timestamp=datetime.now(),
            details=details
        )
        storage.add_audit_log(log)
    
    def get_reconciliation_history(self, store_id: Optional[str] = None) -> List[ReconciliationRecord]:
        return storage.list_reconciliation(store_id)
    
    def get_audit_history(self, reconciliation_id: str) -> List[AuditLog]:
        return storage.get_audit_logs(reconciliation_id)


reconciliation_service = ReconciliationService()
