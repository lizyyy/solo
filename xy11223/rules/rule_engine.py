from typing import List, Any, Dict
from sqlalchemy.orm import Session
from rules.base import BaseRule
from rules.sample_rules import ExpiredSampleRule
from rules.temperature_rules import TemperatureAbnormalRule, TemperatureGapRule
from rules.batch_rules import BatchConsistencyRule
from models import FoodSample, TemperatureRecord, WasteRecord, RuleResult, RecordStatus
from database import SessionLocal


class RuleEngine:
    def __init__(self, db: Session = None):
        self.db = db or SessionLocal()
        self.rules: List[BaseRule] = [
            ExpiredSampleRule(self.db),
            TemperatureAbnormalRule(self.db),
            TemperatureGapRule(self.db),
            BatchConsistencyRule(self.db)
        ]

    def __del__(self):
        if hasattr(self, 'db'):
            self.db.close()

    def add_rule(self, rule: BaseRule):
        self.rules.append(rule)

    def apply_rules(self, record: Any, save_results: bool = True) -> List[RuleResult]:
        all_results = []

        for rule in self.rules:
            if rule.should_apply(record):
                results = rule.apply(record)
                all_results.extend(results)

                if save_results:
                    for result in results:
                        self.db.add(result)

        if save_results:
            self.db.commit()

        return all_results

    def apply_all_samples(self, store_id: str = None, batch_size: int = 100) -> Dict[str, Any]:
        query = self.db.query(FoodSample)
        if store_id:
            query = query.filter(FoodSample.store_id == store_id)

        total = query.count()
        processed = 0
        blocked = 0
        rule_results_count = 0

        offset = 0
        while offset < total:
            batch = query.offset(offset).limit(batch_size).all()

            for sample in batch:
                results = self.apply_rules(sample, save_results=True)
                rule_results_count += len(results)
                if any(r.is_blocked for r in results):
                    blocked += 1
                processed += 1

            offset += batch_size
            self.db.commit()

        return {
            "total_records": total,
            "processed_records": processed,
            "blocked_records": blocked,
            "rule_results_count": rule_results_count
        }

    def apply_all_temperature(self, store_id: str = None, batch_size: int = 100) -> Dict[str, Any]:
        query = self.db.query(TemperatureRecord)
        if store_id:
            query = query.filter(TemperatureRecord.store_id == store_id)

        total = query.count()
        processed = 0
        rule_results_count = 0

        offset = 0
        while offset < total:
            batch = query.offset(offset).limit(batch_size).all()

            for record in batch:
                results = self.apply_rules(record, save_results=True)
                rule_results_count += len(results)
                processed += 1

            offset += batch_size
            self.db.commit()

        return {
            "total_records": total,
            "processed_records": processed,
            "rule_results_count": rule_results_count
        }

    def apply_all_waste(self, store_id: str = None, batch_size: int = 100) -> Dict[str, Any]:
        query = self.db.query(WasteRecord)
        if store_id:
            query = query.filter(WasteRecord.store_id == store_id)

        total = query.count()
        processed = 0
        rule_results_count = 0

        offset = 0
        while offset < total:
            batch = query.offset(offset).limit(batch_size).all()

            for record in batch:
                results = self.apply_rules(record, save_results=True)
                rule_results_count += len(results)
                processed += 1

            offset += batch_size
            self.db.commit()

        return {
            "total_records": total,
            "processed_records": processed,
            "rule_results_count": rule_results_count
        }

    def run_all(self, store_id: str = None) -> Dict[str, Any]:
        sample_stats = self.apply_all_samples(store_id)
        temp_stats = self.apply_all_temperature(store_id)
        waste_stats = self.apply_all_waste(store_id)

        return {
            "samples": sample_stats,
            "temperature": temp_stats,
            "waste": waste_stats,
            "total_processed": sample_stats["processed_records"] + temp_stats["processed_records"] + waste_stats["processed_records"]
        }

    def get_record_rule_results(self, record_id: str, record_type: str = "sample") -> List[Dict[str, Any]]:
        query = self.db.query(RuleResult)

        if record_type == "sample":
            query = query.filter(RuleResult.sample_id == record_id)
        elif record_type == "temperature":
            query = query.filter(RuleResult.temperature_record_id == record_id)
        elif record_type == "waste":
            query = query.filter(RuleResult.waste_record_id == record_id)

        results = query.all()
        return [r.to_dict() for r in results]
