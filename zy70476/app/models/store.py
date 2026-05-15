import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Any
from app.config import settings
from app.models.schemas import (
    LakePartition, DetectionRule, InvoiceRed冲Record,
    FailedItem, BatchRecord, DetectionResult, RuleType
)


class DataStore:
    def __init__(self):
        self.data_dir = settings.DATA_DIR
        self.failed_dir = settings.FAILED_ITEMS_DIR
        self.reports_dir = settings.REPORTS_DIR
        
        self.partitions_file = self.data_dir / "partitions.json"
        self.rules_file = self.data_dir / "rules.json"
        self.invoices_file = self.data_dir / "invoices.json"
        self.batches_file = self.data_dir / "batches.json"
        self.results_file = self.data_dir / "results.json"
        
        self._init_files()
    
    def _init_files(self):
        for file in [self.partitions_file, self.rules_file, self.invoices_file,
                     self.batches_file, self.results_file]:
            if not file.exists():
                file.write_text("[]", encoding="utf-8")
    
    def _read_json(self, file_path: Path) -> List[Dict]:
        try:
            return json.loads(file_path.read_text(encoding="utf-8"))
        except:
            return []
    
    def _write_json(self, file_path: Path, data: List[Dict]):
        file_path.write_text(json.dumps(data, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
    
    def save_partition(self, partition: LakePartition) -> str:
        partitions = self._read_json(self.partitions_file)
        partition_dict = partition.model_dump()
        partitions.append(partition_dict)
        self._write_json(self.partitions_file, partitions)
        return partition.id
    
    def get_partitions(self, environment: Optional[str] = None) -> List[LakePartition]:
        partitions = self._read_json(self.partitions_file)
        if environment:
            partitions = [p for p in partitions if p["environment"] == environment]
        return [LakePartition(**p) for p in partitions]
    
    def get_partition_by_id(self, partition_id: str) -> Optional[LakePartition]:
        partitions = self._read_json(self.partitions_file)
        for p in partitions:
            if p["id"] == partition_id:
                return LakePartition(**p)
        return None
    
    def save_rule(self, rule: DetectionRule) -> str:
        rules = self._read_json(self.rules_file)
        rule_dict = rule.model_dump()
        rules.append(rule_dict)
        self._write_json(self.rules_file, rules)
        return rule.rule_id
    
    def get_rules(self, rule_type: Optional[RuleType] = None, is_active: Optional[bool] = None) -> List[DetectionRule]:
        rules = self._read_json(self.rules_file)
        if rule_type:
            rules = [r for r in rules if r["rule_type"] == rule_type]
        if is_active is not None:
            rules = [r for r in rules if r["is_active"] == is_active]
        return [DetectionRule(**r) for r in rules]
    
    def get_latest_rule(self, rule_type: RuleType) -> Optional[DetectionRule]:
        rules = self.get_rules(rule_type=rule_type, is_active=True)
        if not rules:
            return None
        return sorted(rules, key=lambda r: r.created_at, reverse=True)[0]
    
    def get_rule_by_version(self, version: str) -> Optional[DetectionRule]:
        rules = self._read_json(self.rules_file)
        for r in rules:
            if r["version"] == version:
                return DetectionRule(**r)
        return None
    
    def save_invoice(self, invoice: InvoiceRed冲Record) -> str:
        invoices = self._read_json(self.invoices_file)
        invoice_dict = invoice.model_dump()
        invoices.append(invoice_dict)
        self._write_json(self.invoices_file, invoices)
        return invoice.id
    
    def get_invoices(self, environment: Optional[str] = None) -> List[InvoiceRed冲Record]:
        invoices = self._read_json(self.invoices_file)
        if environment:
            invoices = [i for i in invoices if i["environment"] == environment]
        return [InvoiceRed冲Record(**i) for i in invoices]
    
    def save_batch(self, batch: BatchRecord) -> str:
        batches = self._read_json(self.batches_file)
        batch_dict = batch.model_dump()
        batches.append(batch_dict)
        self._write_json(self.batches_file, batches)
        return batch.batch_id
    
    def update_batch(self, batch: BatchRecord) -> bool:
        batches = self._read_json(self.batches_file)
        for i, b in enumerate(batches):
            if b["batch_id"] == batch.batch_id:
                batches[i] = batch.model_dump()
                self._write_json(self.batches_file, batches)
                return True
        return False
    
    def get_batch(self, batch_id: str) -> Optional[BatchRecord]:
        batches = self._read_json(self.batches_file)
        for b in batches:
            if b["batch_id"] == batch_id:
                return BatchRecord(**b)
        return None
    
    def save_result(self, result: DetectionResult) -> str:
        results = self._read_json(self.results_file)
        result_dict = result.model_dump()
        results.append(result_dict)
        self._write_json(self.results_file, results)
        return result.batch_id
    
    def get_results(self, batch_id: Optional[str] = None) -> List[DetectionResult]:
        results = self._read_json(self.results_file)
        if batch_id:
            results = [r for r in results if r["batch_id"] == batch_id]
        return [DetectionResult(**r) for r in results]
    
    def save_failed_item(self, item: FailedItem) -> str:
        failed_file = self.failed_dir / f"{item.batch_id}_failed.json"
        failed_items = []
        if failed_file.exists():
            failed_items = json.loads(failed_file.read_text(encoding="utf-8"))
        
        failed_items.append(item.model_dump())
        failed_file.write_text(json.dumps(failed_items, ensure_ascii=False, indent=2, default=str), encoding="utf-8")
        return item.item_id
    
    def get_failed_items(self, batch_id: str) -> List[FailedItem]:
        failed_file = self.failed_dir / f"{batch_id}_failed.json"
        if not failed_file.exists():
            return []
        failed_items = json.loads(failed_file.read_text(encoding="utf-8"))
        return [FailedItem(**item) for item in failed_items]
    
    def save_report(self, batch_id: str, content: str, format: str = "json") -> str:
        report_file = self.reports_dir / f"{batch_id}_report.{format}"
        report_file.write_text(content, encoding="utf-8")
        return str(report_file)
    
    def get_report(self, batch_id: str, format: str = "json") -> Optional[str]:
        report_file = self.reports_dir / f"{batch_id}_report.{format}"
        if report_file.exists():
            return report_file.read_text(encoding="utf-8")
        return None


store = DataStore()
