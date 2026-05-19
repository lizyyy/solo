from typing import List, Dict
from collections import defaultdict
from sqlalchemy import and_
from rules.base import BaseRule
from models import RuleResult, FoodSample, WasteRecord, ExceptionType, RecordStatus


class BatchConsistencyRule(BaseRule):
    def __init__(self, db):
        super().__init__(db)
        self.rule_name = "同批次一致性检查"
        self.rule_code = "RULE_BATCH_CONSISTENCY"
        self.exception_type = ExceptionType.BATCH_INCONSISTENCY
        self.blocked = False

    def should_apply(self, record) -> bool:
        return isinstance(record, (FoodSample, WasteRecord)) and record.batch_id

    def apply(self, record) -> List[RuleResult]:
        results = []

        if not self.should_apply(record):
            return results

        batch_id = record.batch_id
        store_id = record.store_id

        if isinstance(record, FoodSample):
            batch_samples = self.db.query(FoodSample).filter(
                and_(
                    FoodSample.batch_id == batch_id,
                    FoodSample.id != record.id
                )
            ).all()

            if batch_samples:
                store_counts = defaultdict(int)
                for s in batch_samples:
                    store_counts[s.store_id] += 1
                store_counts[store_id] += 1

                if len(store_counts) > 1:
                    store_list = ", ".join([f"{k}({v}条)" for k, v in store_counts.items()])
                    reason = f"同批次菜品存在多个门店，批次ID: {batch_id}"
                    details = f"涉及门店: {store_list}, 当前菜品: {record.dish_name}"
                    result = self._create_rule_result(record, reason, details, severity="low")
                    results.append(result)

        elif isinstance(record, WasteRecord):
            batch_waste = self.db.query(WasteRecord).filter(
                and_(
                    WasteRecord.batch_id == batch_id,
                    WasteRecord.id != record.id
                )
            ).all()

            if batch_waste:
                total_weight = sum(w.waste_weight or 0 for w in batch_waste) + (record.waste_weight or 0)
                avg_weight = total_weight / (len(batch_waste) + 1)

                if record.waste_weight and abs(record.waste_weight - avg_weight) / avg_weight > 0.5:
                    reason = f"同批次废弃重量偏差过大，批次平均: {avg_weight:.1f}kg，当前: {record.waste_weight:.1f}kg"
                    details = f"菜品: {record.dish_name}, 共{len(batch_waste) + 1}条记录"
                    result = self._create_rule_result(record, reason, details, severity="medium")
                    results.append(result)

        return results
