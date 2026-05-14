import asyncio
import uuid
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path

from .models.scan import ScanConfig, ScanBatch, ScanItem, ScanStatus, ScanItemStatus
from .models.failure import FailureRecord
from .rules import RuleEngine, get_default_rule_set
from .storage import StorageManager
from .reports import ReportGenerator


class DeadConfigScanner:
    def __init__(self, scan_config: Optional[ScanConfig] = None):
        self.scan_config = scan_config or ScanConfig()
        self.rule_set = get_default_rule_set()
        self.rule_engine = RuleEngine(self.rule_set, self.scan_config)
        self.storage = StorageManager(self.scan_config.output_dir)
        self.reporter = ReportGenerator(self.scan_config.output_dir + "/reports")
    
    def create_batch(self, items: List[Dict[str, Any]], name: str = "") -> ScanBatch:
        batch_id = datetime.now().strftime("%Y%m%d_%H%M%S") + "_" + uuid.uuid4().hex[:8]
        scan_items = []
        for item_data in items:
            item = ScanItem(
                source=item_data.get("source", "unknown"),
                content=item_data.get("content", ""),
                metadata=item_data.get("metadata", {})
            )
            scan_items.append(item)
        
        return ScanBatch(
            batch_id=batch_id,
            name=name,
            items=scan_items,
            rule_set_version=self.rule_set.get_version_key()
        )
    
    async def scan_batch(self, batch: ScanBatch, use_cache: bool = True) -> Tuple[ScanBatch, List[FailureRecord]]:
        batch.status = ScanStatus.RUNNING
        current_rule_versions = self.rule_set.get_rule_versions()
        
        semaphore = asyncio.Semaphore(self.scan_config.concurrent)
        failures = []
        
        async def scan_item(item: ScanItem) -> ScanItem:
            async with semaphore:
                if use_cache:
                    cached_status, cached_error, has_conflict = self.storage.check_cached_item(
                        item, current_rule_versions
                    )
                    if cached_status is not None and not has_conflict:
                        item.status = cached_status
                        item.error_message = cached_error
                        if cached_status in [ScanItemStatus.INVALID, ScanItemStatus.ERROR]:
                            failures.append(self._create_failure_record(batch.batch_id, item))
                        return item
                    elif has_conflict:
                        item.metadata["cache_conflict"] = cached_error
                
                result = await self.rule_engine.apply_rules(item)
                self.storage.cache_item_result(result)
                
                if result.status in [ScanItemStatus.INVALID, ScanItemStatus.ERROR]:
                    failures.append(self._create_failure_record(batch.batch_id, result))
                
                return result
        
        tasks = [scan_item(item) for item in batch.items]
        batch.items = await asyncio.gather(*tasks)
        
        batch.status = ScanStatus.COMPLETED
        self.storage.save_batch(batch)
        
        for failure in failures:
            self.storage.save_failure(failure)
        
        return batch, failures
    
    def _create_failure_record(self, batch_id: str, item: ScanItem) -> FailureRecord:
        record_id = hashlib.md5(f"{batch_id}:{item.id}".encode()).hexdigest()
        return FailureRecord(
            record_id=record_id,
            batch_id=batch_id,
            item_id=item.id,
            content_hash=item.content_hash,
            source=item.source,
            content=item.content,
            failure_type="url_invalid" if item.status == ScanItemStatus.INVALID else "scan_error",
            failure_reason=item.error_message or "未知错误",
            rule_versions=item.rule_versions,
            metadata=item.metadata,
            status_code=item.metadata.get("status_code")
        )
    
    def load_items_from_file(self, file_path: str) -> List[Dict[str, Any]]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        items = []
        if path.suffix == ".txt":
            with open(path, "r", encoding="utf-8") as f:
                for line_num, line in enumerate(f, 1):
                    line = line.strip()
                    if line and not line.startswith("#"):
                        items.append({
                            "source": f"{file_path}:{line_num}",
                            "content": line
                        })
        elif path.suffix == ".json":
            import json
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
                if isinstance(data, list):
                    for i, item in enumerate(data):
                        if isinstance(item, str):
                            items.append({
                                "source": f"{file_path}:{i}",
                                "content": item
                            })
                        elif isinstance(item, dict):
                            items.append({
                                "source": item.get("source", f"{file_path}:{i}"),
                                "content": item.get("content", ""),
                                "metadata": item.get("metadata", {})
                            })
        
        return items
    
    def generate_reports(self, batch: ScanBatch, failures: List[FailureRecord]) -> Dict[str, str]:
        return {
            "json_report": self.reporter.generate_batch_report(batch, failures),
            "text_summary": self.reporter.generate_text_summary(batch, failures)
        }
    
    def get_exit_code(self, batch: ScanBatch) -> int:
        counts = batch.get_summary()["counts"]
        if counts["error"] > 0:
            return 2
        if counts["invalid"] > 0:
            return 1
        return 0
