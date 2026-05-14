import os
import json
import hashlib
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional, Tuple, Any
from collections import defaultdict

from ..models.scan import ScanBatch, ScanItem, ScanItemStatus
from ..models.failure import FailureRecord


class StorageManager:
    def __init__(self, base_dir: str = "./output"):
        self.base_dir = Path(base_dir)
        self.batches_dir = self.base_dir / "batches"
        self.failures_dir = self.base_dir / "failures"
        self.cache_dir = self.base_dir / "cache"
        self._ensure_dirs()
        
        self.item_cache: Dict[str, Dict[str, Any]] = {}
        self._load_cache()
    
    def _ensure_dirs(self) -> None:
        for dir_path in [self.batches_dir, self.failures_dir, self.cache_dir]:
            dir_path.mkdir(parents=True, exist_ok=True)
    
    def _load_cache(self) -> None:
        cache_file = self.cache_dir / "item_cache.json"
        if cache_file.exists():
            with open(cache_file, "r", encoding="utf-8") as f:
                self.item_cache = json.load(f)
    
    def _save_cache(self) -> None:
        cache_file = self.cache_dir / "item_cache.json"
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(self.item_cache, f, indent=2, ensure_ascii=False)
    
    def save_batch(self, batch: ScanBatch) -> None:
        batch_file = self.batches_dir / f"{batch.batch_id}.json"
        batch_data = {
            "batch_id": batch.batch_id,
            "name": batch.name,
            "created_at": batch.created_at.isoformat(),
            "status": batch.status,
            "rule_set_version": batch.rule_set_version,
            "metadata": batch.metadata,
            "summary": batch.get_summary(),
            "items": [
                {
                    "id": item.id,
                    "source": item.source,
                    "content": item.content,
                    "content_hash": item.content_hash,
                    "metadata": item.metadata,
                    "status": item.status,
                    "error_message": item.error_message,
                    "scan_time": item.scan_time.isoformat() if item.scan_time else None,
                    "rule_versions": item.rule_versions
                }
                for item in batch.items
            ]
        }
        with open(batch_file, "w", encoding="utf-8") as f:
            json.dump(batch_data, f, indent=2, ensure_ascii=False)
    
    def load_batch(self, batch_id: str) -> Optional[Dict[str, Any]]:
        batch_file = self.batches_dir / f"{batch_id}.json"
        if not batch_file.exists():
            return None
        with open(batch_file, "r", encoding="utf-8") as f:
            return json.load(f)
    
    def list_batches(self) -> List[Dict[str, Any]]:
        batches = []
        for batch_file in sorted(self.batches_dir.glob("*.json"), reverse=True):
            with open(batch_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                batches.append({
                    "batch_id": data["batch_id"],
                    "name": data.get("name", ""),
                    "created_at": data["created_at"],
                    "status": data["status"],
                    "summary": data.get("summary", {})
                })
        return batches
    
    def check_cached_item(self, item: ScanItem, current_rule_versions: Dict[str, str]) -> Tuple[Optional[ScanItemStatus], Optional[str], bool]:
        cache_key = item.content_hash
        if cache_key not in self.item_cache:
            return None, None, False
        
        cached = self.item_cache[cache_key]
        
        cached_rules = cached.get("rule_versions", {})
        has_conflict = cached_rules != current_rule_versions
        
        if has_conflict:
            conflict_msg = f"规则版本冲突: 缓存使用 {cached_rules}, 当前使用 {current_rule_versions}"
            return ScanItemStatus(cached["status"]), conflict_msg, True
        
        return ScanItemStatus(cached["status"]), cached.get("error_message"), False
    
    def cache_item_result(self, item: ScanItem) -> None:
        self.item_cache[item.content_hash] = {
            "status": item.status,
            "error_message": item.error_message,
            "rule_versions": item.rule_versions,
            "last_updated": datetime.now().isoformat(),
            "source": item.source
        }
        self._save_cache()
    
    def save_failure(self, failure: FailureRecord) -> None:
        failure_file = self.failures_dir / f"{failure.record_id}.json"
        with open(failure_file, "w", encoding="utf-8") as f:
            json.dump(failure.to_dict(), f, indent=2, ensure_ascii=False)
    
    def list_failures(self, content_hash: Optional[str] = None, batch_id: Optional[str] = None) -> List[Dict[str, Any]]:
        failures = []
        for failure_file in self.failures_dir.glob("*.json"):
            with open(failure_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                if content_hash and data.get("content_hash") != content_hash:
                    continue
                if batch_id and data.get("batch_id") != batch_id:
                    continue
                failures.append(data)
        return sorted(failures, key=lambda x: x["detected_at"], reverse=True)
    
    def query_by_content_hash(self, content_hash: str) -> Dict[str, Any]:
        result = {
            "content_hash": content_hash,
            "cached_result": self.item_cache.get(content_hash),
            "failures": self.list_failures(content_hash=content_hash),
            "batch_appearances": []
        }
        
        for batch_file in self.batches_dir.glob("*.json"):
            with open(batch_file, "r", encoding="utf-8") as f:
                batch_data = json.load(f)
                matching_items = [
                    item for item in batch_data["items"]
                    if item.get("content_hash") == content_hash
                ]
                if matching_items:
                    result["batch_appearances"].append({
                        "batch_id": batch_data["batch_id"],
                        "batch_name": batch_data.get("name", ""),
                        "items": matching_items
                    })
        
        return result
    
    def mark_human_reviewed(self, record_id: str, comment: str = "") -> bool:
        failure_file = self.failures_dir / f"{record_id}.json"
        if not failure_file.exists():
            return False
        
        with open(failure_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        
        data["human_reviewed"] = True
        data["review_comment"] = comment
        data["reviewed_at"] = datetime.now().isoformat()
        
        with open(failure_file, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
        
        return True
