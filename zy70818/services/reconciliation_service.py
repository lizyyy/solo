from datetime import date, datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from collections import defaultdict

from models.inventory import InventoryItem, InventoryStatus
from models.recall import RecallNotice, RecallBatch
from models.consumption import ConsumptionItem
from models.reconciliation import (
    ReconciliationResult, ReconciliationStatus,
    Discrepancy, DiscrepancyType, ReviewAction
)
from utils.storage import store


class DiscrepancyExplanation:
    @staticmethod
    def explain_recall(batch: str, material: str, store_name: str, notice: RecallNotice) -> str:
        return (
            f"批号 [{batch}] ({material}) 属于召回公告 [{notice.notice_number}] 范围，"
            f"召回原因为：{notice.reason}，召回级别：{notice.recall_level}，"
            f"该批次产品在门店 [{store_name}] 应立即停止使用并召回。"
        )

    @staticmethod
    def explain_near_expiry(batch: str, material: str, store_name: str, expiry_date: date, days_left: int) -> str:
        return (
            f"批号 [{batch}] ({material}) 在门店 [{store_name}] 即将过期，"
            f"有效期至 {expiry_date.strftime('%Y-%m-%d')}，距今天数：{days_left} 天，"
            f"建议优先使用或采取预警措施。"
        )

    @staticmethod
    def explain_expired(batch: str, material: str, store_name: str, expiry_date: date, days_expired: int) -> str:
        return (
            f"批号 [{batch}] ({material}) 在门店 [{store_name}] 已过期，"
            f"有效期至 {expiry_date.strftime('%Y-%m-%d')}，已过期 {days_expired} 天，"
            f"应立即下架销毁，不得继续使用。"
        )

    @staticmethod
    def explain_transfer(batch: str, material: str, from_store: str, to_store: str, quantity: int) -> str:
        return (
            f"批号 [{batch}] ({material}) 存在跨门店调拨，"
            f"从门店 [{from_store}] 调拨至 [{to_store}]，调拨数量：{quantity}，"
            f"对账时需同步调整两边门店库存数据。"
        )

    @staticmethod
    def explain_quantity_mismatch(batch: str, material: str, store_name: str, expected: int, actual: int) -> str:
        diff = actual - expected
        return (
            f"批号 [{batch}] ({material}) 在门店 [{store_name}] 数量不匹配，"
            f"理论库存应为：{expected}，实际库存：{actual}，差异：{'+' if diff > 0 else ''}{diff}，"
            f"需人工核查是否存在漏登、损耗或盘点误差。"
        )

    @staticmethod
    def explain_batch_not_found(batch: str, material: str, store_name: str) -> str:
        return (
            f"批号 [{batch}] ({material}) 在门店 [{store_name}] 的消耗记录中存在，"
            f"但库存记录中未找到该批号，可能存在入库未登记或批号录入错误。"
        )


class ReconciliationEngine:
    def __init__(self):
        self.explanation = DiscrepancyExplanation()

    def run_reconciliation(
        self,
        name: str,
        start_date: date,
        end_date: date,
        store_filter: Optional[List[str]] = None
    ) -> ReconciliationResult:
        result = ReconciliationResult(
            name=name,
            start_date=start_date,
            end_date=end_date,
            status=ReconciliationStatus.PROCESSING
        )

        inventory_items = store.get_all('inventory', InventoryItem)
        recall_notices = store.get_all('recall', RecallNotice)
        consumption_items = store.get_all('consumption', ConsumptionItem)

        if store_filter:
            inventory_items = [i for i in inventory_items if i.store_name in store_filter]
            consumption_items = [c for c in consumption_items if c.store_name in store_filter]

        result.total_inventory_count = len(inventory_items)
        result.total_consumption_count = len(consumption_items)
        result.total_recall_count = len(recall_notices)

        discrepancies = []
        discrepancies.extend(self._check_recall_batches(inventory_items, recall_notices))
        discrepancies.extend(self._check_expiry_status(inventory_items))
        discrepancies.extend(self._check_transfer_records(consumption_items))
        discrepancies.extend(self._check_quantity_balance(inventory_items, consumption_items))

        for idx, disc in enumerate(discrepancies):
            if not disc.id:
                disc.id = store.generate_id()

        result.discrepancies = discrepancies
        result.discrepancy_count = len(discrepancies)
        result.unresolved_discrepancy_count = len([d for d in discrepancies if not d.is_reviewed])

        result.recalled_batch_count = len([d for d in discrepancies if d.type == DiscrepancyType.RECALL])
        result.near_expiry_count = len([d for d in discrepancies if d.type == DiscrepancyType.NEAR_EXPIRY])
        result.expired_count = len([d for d in discrepancies if d.type == DiscrepancyType.EXPIRED])
        result.transfer_count = len([d for d in discrepancies if d.type == DiscrepancyType.TRANSFER])

        result.summary_data = self._build_summary_data(inventory_items, consumption_items, discrepancies)
        result.status = ReconciliationStatus.COMPLETED
        result.completed_at = datetime.now()

        result_id = store.add('reconciliation', result)
        result.id = result_id

        return result

    def _check_recall_batches(
        self,
        inventory: List[InventoryItem],
        recalls: List[RecallNotice]
    ) -> List[Discrepancy]:
        discrepancies = []
        recalled_batches = {}

        for notice in recalls:
            for batch in notice.batches:
                recalled_batches[batch.batch_number] = notice

        for item in inventory:
            if item.batch_number in recalled_batches:
                notice = recalled_batches[item.batch_number]
                disc = Discrepancy(
                    type=DiscrepancyType.RECALL,
                    batch_number=item.batch_number,
                    material_name=item.material_name,
                    store_name=item.store_name,
                    description=f"批号 {item.batch_number} 属于召回范围",
                    explanation=self.explanation.explain_recall(
                        item.batch_number, item.material_name, item.store_name, notice
                    ),
                    expected_value="应召回",
                    actual_value="在库",
                    quantity_diff=item.quantity,
                    related_recall_id=notice.id
                )
                discrepancies.append(disc)

        return discrepancies

    def _check_expiry_status(self, inventory: List[InventoryItem]) -> List[Discrepancy]:
        discrepancies = []
        today = date.today()

        for item in inventory:
            days_to_expiry = (item.expiry_date - today).days

            if days_to_expiry < 0:
                disc = Discrepancy(
                    type=DiscrepancyType.EXPIRED,
                    batch_number=item.batch_number,
                    material_name=item.material_name,
                    store_name=item.store_name,
                    description=f"批号 {item.batch_number} 已过期",
                    explanation=self.explanation.explain_expired(
                        item.batch_number, item.material_name, item.store_name,
                        item.expiry_date, abs(days_to_expiry)
                    ),
                    expected_value="应已下架",
                    actual_value=f"已过期 {abs(days_to_expiry)} 天",
                    quantity_diff=item.quantity
                )
                discrepancies.append(disc)

            elif days_to_expiry <= 90:
                disc = Discrepancy(
                    type=DiscrepancyType.NEAR_EXPIRY,
                    batch_number=item.batch_number,
                    material_name=item.material_name,
                    store_name=item.store_name,
                    description=f"批号 {item.batch_number} 近效期预警",
                    explanation=self.explanation.explain_near_expiry(
                        item.batch_number, item.material_name, item.store_name,
                        item.expiry_date, days_to_expiry
                    ),
                    expected_value="正常效期",
                    actual_value=f"剩余 {days_to_expiry} 天",
                    quantity_diff=item.quantity
                )
                discrepancies.append(disc)

        return discrepancies

    def _check_transfer_records(self, consumption: List[ConsumptionItem]) -> List[Discrepancy]:
        discrepancies = []

        for item in consumption:
            if item.is_transfer and item.transfer_from_store and item.transfer_to_store:
                disc = Discrepancy(
                    type=DiscrepancyType.TRANSFER,
                    batch_number=item.batch_number,
                    material_name=item.material_name,
                    store_name=item.transfer_from_store,
                    description=f"批号 {item.batch_number} 跨门店调拨",
                    explanation=self.explanation.explain_transfer(
                        item.batch_number, item.material_name,
                        item.transfer_from_store, item.transfer_to_store, item.quantity
                    ),
                    expected_value=0,
                    actual_value=item.quantity,
                    quantity_diff=item.quantity,
                    related_transfer_id=item.id
                )
                discrepancies.append(disc)

        return discrepancies

    def _check_quantity_balance(
        self,
        inventory: List[InventoryItem],
        consumption: List[ConsumptionItem]
    ) -> List[Discrepancy]:
        discrepancies = []

        inventory_map = defaultdict(lambda: {'quantity': 0, 'material': '未知'})
        for item in inventory:
            key = (item.batch_number, item.store_name)
            inventory_map[key]['quantity'] += item.quantity
            inventory_map[key]['material'] = item.material_name

        normal_consumption_map = defaultdict(int)
        transfer_in_map = defaultdict(int)
        transfer_out_map = defaultdict(int)
        material_names = {}

        for item in consumption:
            key = (item.batch_number, item.store_name)
            material_names[(item.batch_number, item.store_name)] = item.material_name
            if item.transfer_to_store:
                material_names[(item.batch_number, item.transfer_to_store)] = item.material_name
            if item.transfer_from_store:
                material_names[(item.batch_number, item.transfer_from_store)] = item.material_name

            if not item.is_transfer:
                normal_consumption_map[key] += item.quantity
            if item.transfer_to_store:
                transfer_in_key = (item.batch_number, item.transfer_to_store)
                transfer_in_map[transfer_in_key] += item.quantity
            if item.transfer_from_store:
                transfer_out_key = (item.batch_number, item.transfer_from_store)
                transfer_out_map[transfer_out_key] += item.quantity

        all_keys = set()
        all_keys.update(inventory_map.keys())
        all_keys.update(normal_consumption_map.keys())
        all_keys.update(transfer_in_map.keys())
        all_keys.update(transfer_out_map.keys())

        for key in all_keys:
            batch, store_name = key
            inv_data = inventory_map.get(key, {'quantity': 0, 'material': material_names.get(key, '未知')})
            actual_quantity = inv_data.get('quantity', 0)
            consumed = normal_consumption_map.get(key, 0)
            transfer_in = transfer_in_map.get(key, 0)
            transfer_out = transfer_out_map.get(key, 0)

            has_activity = consumed > 0 or transfer_in > 0 or transfer_out > 0
            if not has_activity:
                continue

            total_out = consumed + transfer_out
            total_in = actual_quantity + transfer_in

            if actual_quantity <= 0 and total_out > 0:
                disc = Discrepancy(
                    type=DiscrepancyType.BATCH_NOT_FOUND,
                    batch_number=batch,
                    material_name=inv_data.get('material', '未知'),
                    store_name=store_name,
                    description=f"批号 {batch} 库存缺失",
                    explanation=self.explanation.explain_batch_not_found(
                        batch, inv_data.get('material', '未知'), store_name
                    ),
                    expected_value=total_out,
                    actual_value=actual_quantity,
                    quantity_diff=actual_quantity - total_out
                )
                discrepancies.append(disc)
            elif total_out > total_in:
                disc = Discrepancy(
                    type=DiscrepancyType.QUANTITY_MISMATCH,
                    batch_number=batch,
                    material_name=inv_data.get('material', '未知'),
                    store_name=store_name,
                    description=f"批号 {batch} 库存不足",
                    explanation=self.explanation.explain_quantity_mismatch(
                        batch, inv_data.get('material', '未知'), store_name,
                        total_out, total_in
                    ),
                    expected_value=total_out,
                    actual_value=total_in,
                    quantity_diff=total_in - total_out
                )
                discrepancies.append(disc)
            elif total_out > 0:
                disc = Discrepancy(
                    type=DiscrepancyType.QUANTITY_MISMATCH,
                    batch_number=batch,
                    material_name=inv_data.get('material', '未知'),
                    store_name=store_name,
                    description=f"批号 {batch} 数量对账",
                    explanation=(
                        f"批号 [{batch}] ({inv_data.get('material', '未知')}) 在门店 [{store_name}] 数量对账："
                        f"当前库存 {actual_quantity} + 调入 {transfer_in} - 消耗 {consumed} - 调出 {transfer_out} = "
                        f"理论期初 {actual_quantity + transfer_in - consumed - transfer_out}"
                    ),
                    expected_value=actual_quantity + transfer_in - transfer_out - consumed,
                    actual_value=actual_quantity,
                    quantity_diff=consumed + transfer_out - transfer_in
                )
                discrepancies.append(disc)
            elif transfer_in > 0:
                disc = Discrepancy(
                    type=DiscrepancyType.QUANTITY_MISMATCH,
                    batch_number=batch,
                    material_name=inv_data.get('material', '未知'),
                    store_name=store_name,
                    description=f"批号 {batch} 调入未入账",
                    explanation=self.explanation.explain_quantity_mismatch(
                        batch, inv_data.get('material', '未知'), store_name,
                        actual_quantity + transfer_in, actual_quantity
                    ),
                    expected_value=actual_quantity + transfer_in,
                    actual_value=actual_quantity,
                    quantity_diff=-transfer_in
                )
                discrepancies.append(disc)

        return discrepancies

    def _build_summary_data(
        self,
        inventory: List[InventoryItem],
        consumption: List[ConsumptionItem],
        discrepancies: List[Discrepancy]
    ) -> Dict[str, Any]:
        summary = {
            'by_store': defaultdict(lambda: {'inventory': 0, 'consumption': 0, 'discrepancies': 0}),
            'by_material_type': defaultdict(lambda: {'inventory': 0, 'discrepancies': 0}),
            'by_status': defaultdict(int),
            'stores': set(),
            'material_types': set()
        }

        for item in inventory:
            summary['by_store'][item.store_name]['inventory'] += item.quantity
            summary['by_material_type'][item.material_type]['inventory'] += item.quantity
            summary['by_status'][item.status] += 1
            summary['stores'].add(item.store_name)
            summary['material_types'].add(item.material_type)

        for item in consumption:
            summary['by_store'][item.store_name]['consumption'] += item.quantity

        for disc in discrepancies:
            summary['by_store'][disc.store_name]['discrepancies'] += 1
            summary['by_material_type'].setdefault('未知', {'inventory': 0, 'discrepancies': 0})['discrepancies'] += 1

        for key in ['by_store', 'by_material_type']:
            summary[key] = dict(summary[key])

        summary['stores'] = list(summary['stores'])
        summary['material_types'] = list(summary['material_types'])
        summary['by_status'] = dict(summary['by_status'])

        return summary


class ReviewService:
    def __init__(self):
        self.engine = ReconciliationEngine()

    def review_discrepancy(
        self,
        reconciliation_id: str,
        discrepancy_id: str,
        action: ReviewAction,
        notes: str,
        reviewed_by: str,
        adjustment_quantity: Optional[int] = None
    ) -> Tuple[bool, str, ReconciliationResult]:
        reconciliation = store.get('reconciliation', reconciliation_id, ReconciliationResult)
        if not reconciliation:
            return False, "对账任务不存在", None

        disc_index = None
        target_disc = None
        for idx, disc in enumerate(reconciliation.discrepancies):
            if disc.id == discrepancy_id:
                disc_index = idx
                target_disc = disc
                break

        if not target_disc:
            return False, "差异记录不存在", None

        target_disc.is_reviewed = True
        target_disc.review_action = action
        target_disc.review_notes = notes
        target_disc.reviewed_by = reviewed_by
        target_disc.reviewed_at = datetime.now()
        target_disc.adjustment_quantity = adjustment_quantity

        if adjustment_quantity is not None:
            self._update_inventory_quantity(target_disc, adjustment_quantity)

        updated_reconciliation = self._recalculate_reconciliation(reconciliation, reviewed_by)

        store.update('reconciliation', reconciliation_id, updated_reconciliation)

        return True, "复核完成，数据已重新计算", updated_reconciliation

    def _update_inventory_quantity(self, discrepancy: Discrepancy, new_quantity: int):
        inventory_items = store.get_all('inventory', InventoryItem)
        for item in inventory_items:
            if (item.batch_number == discrepancy.batch_number and
                item.store_name == discrepancy.store_name):
                item.quantity = new_quantity
                store.update('inventory', item.id, item)
                break

    def _recalculate_reconciliation(
        self,
        old_reconciliation: ReconciliationResult,
        reviewed_by: str
    ) -> ReconciliationResult:
        inventory_items = store.get_all('inventory', InventoryItem)
        recall_notices = store.get_all('recall', RecallNotice)
        consumption_items = store.get_all('consumption', ConsumptionItem)

        new_discrepancies = []
        new_discrepancies.extend(self.engine._check_recall_batches(inventory_items, recall_notices))
        new_discrepancies.extend(self.engine._check_expiry_status(inventory_items))
        new_discrepancies.extend(self.engine._check_transfer_records(consumption_items))
        new_discrepancies.extend(self.engine._check_quantity_balance(inventory_items, consumption_items))

        reviewed_discrepancies = {d.id: d for d in old_reconciliation.discrepancies if d.is_reviewed}

        final_discrepancies = []
        for new_disc in new_discrepancies:
            matching_reviewed = None
            for reviewed_id, reviewed_disc in reviewed_discrepancies.items():
                if (reviewed_disc.batch_number == new_disc.batch_number and
                    reviewed_disc.store_name == new_disc.store_name and
                    reviewed_disc.type == new_disc.type):
                    matching_reviewed = reviewed_disc
                    break

            if matching_reviewed:
                new_disc.id = matching_reviewed.id
                new_disc.is_reviewed = True
                new_disc.review_action = matching_reviewed.review_action
                new_disc.review_notes = matching_reviewed.review_notes
                new_disc.reviewed_by = matching_reviewed.reviewed_by
                new_disc.reviewed_at = matching_reviewed.reviewed_at
                new_disc.adjustment_quantity = matching_reviewed.adjustment_quantity

            if not new_disc.id:
                new_disc.id = store.generate_id()

            final_discrepancies.append(new_disc)

        old_reconciliation.discrepancies = final_discrepancies
        old_reconciliation.discrepancy_count = len(final_discrepancies)
        old_reconciliation.unresolved_discrepancy_count = len([d for d in final_discrepancies if not d.is_reviewed])
        old_reconciliation.recalled_batch_count = len([d for d in final_discrepancies if d.type == DiscrepancyType.RECALL])
        old_reconciliation.near_expiry_count = len([d for d in final_discrepancies if d.type == DiscrepancyType.NEAR_EXPIRY])
        old_reconciliation.expired_count = len([d for d in final_discrepancies if d.type == DiscrepancyType.EXPIRED])
        old_reconciliation.transfer_count = len([d for d in final_discrepancies if d.type == DiscrepancyType.TRANSFER])
        old_reconciliation.summary_data = self.engine._build_summary_data(inventory_items, consumption_items, final_discrepancies)
        old_reconciliation.updated_at = datetime.now()

        if old_reconciliation.unresolved_discrepancy_count == 0:
            old_reconciliation.status = ReconciliationStatus.COMPLETED
        else:
            old_reconciliation.status = ReconciliationStatus.REVIEWING

        return old_reconciliation


reconciliation_engine = ReconciliationEngine()
review_service = ReviewService()
