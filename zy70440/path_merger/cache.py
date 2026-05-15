import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from collections import defaultdict

from .models import PathRecord, PathStatus, CacheEntry, MergeResult
from .merger import PathMerger


class CacheManager:
    def __init__(self, cache_dir: str = "./data/cache"):
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.index_file = self.cache_dir / "index.json"
        self.index = self._load_index()

    def _load_index(self) -> Dict[str, Dict]:
        if self.index_file.exists():
            with open(self.index_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {}

    def _save_index(self) -> None:
        with open(self.index_file, 'w', encoding='utf-8') as f:
            json.dump(self.index, f, ensure_ascii=False, indent=2, default=str)

    def get_cache_path(self, record_id: str) -> Path:
        return self.cache_dir / f"{record_id}.json"

    def check_cache(self, record: PathRecord) -> Tuple[bool, Optional[CacheEntry]]:
        record_hash = PathMerger.compute_record_hash(record)

        if record.record_id in self.index:
            cached_entry = self.index[record.record_id]
            cached_hash = cached_entry.get('file_hash')

            if cached_hash == record_hash:
                cache_path = self.get_cache_path(record.record_id)
                if cache_path.exists():
                    with open(cache_path, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                        entry = CacheEntry(**data)
                        return True, entry
            else:
                return False, CacheEntry(
                    record_id=cached_entry['record_id'],
                    batch_id=cached_entry['batch_id'],
                    file_hash=cached_hash,
                    merged_path=cached_entry.get('merged_path', []),
                    status=PathStatus.CONFLICT,
                    processed_time=datetime.fromisoformat(cached_entry['processed_time'])
                )

        return False, None

    def save_to_cache(self, record: PathRecord) -> None:
        record_hash = PathMerger.compute_record_hash(record)

        entry = CacheEntry(
            record_id=record.record_id,
            batch_id=record.batch_id,
            file_hash=record_hash,
            merged_path=record.merged_path or [],
            status=record.status,
            processed_time=record.processed_time or datetime.now(),
            issues=record.issues
        )

        cache_path = self.get_cache_path(record.record_id)
        with open(cache_path, 'w', encoding='utf-8') as f:
            json.dump(entry.model_dump(), f, ensure_ascii=False, indent=2, default=str)

        self.index[record.record_id] = {
            'record_id': record.record_id,
            'batch_id': record.batch_id,
            'file_hash': record_hash,
            'merged_path': record.merged_path or [],
            'status': record.status,
            'processed_time': (record.processed_time or datetime.now()).isoformat()
        }
        self._save_index()

    def process_with_cache(self, record: PathRecord, merger: PathMerger) -> PathRecord:
        is_cached, cache_entry = self.check_cache(record)

        if is_cached and cache_entry:
            record.merged_path = cache_entry.merged_path
            record.status = PathStatus.SKIPPED
            record.processed_time = cache_entry.processed_time
            record.issues = cache_entry.issues
            record.metadata['from_cache'] = True
            return record

        if cache_entry and cache_entry.status == PathStatus.CONFLICT:
            record.status = PathStatus.CONFLICT
            record.issues.append({
                'type': 'content_conflict',
                'message': 'Record content has changed since last processing',
                'old_hash': cache_entry.file_hash,
                'new_hash': PathMerger.compute_record_hash(record),
                'severity': 'medium'
            })
            record.metadata['conflict_detected'] = True
            return record

        processed = merger.merge_paths(record)
        self.save_to_cache(processed)
        return processed

    def process_batch_with_cache(self, records: List[PathRecord], batch_id: str, merger: PathMerger) -> MergeResult:
        import time
        start_time = time.time()
        start_datetime = datetime.now()

        processed_records = []
        for record in records:
            processed = self.process_with_cache(record, merger)
            processed_records.append(processed)

        success_count = sum(1 for r in processed_records if r.status == PathStatus.SUCCESS)
        failed_count = sum(1 for r in processed_records if r.status == PathStatus.FAILED)
        conflict_count = sum(1 for r in processed_records if r.status == PathStatus.CONFLICT)
        skipped_count = sum(1 for r in processed_records if r.status == PathStatus.SKIPPED)
        manual_fix_count = sum(1 for r in processed_records if r.status == PathStatus.MANUAL_FIX)

        suggestions = merger._generate_suggestions(processed_records)

        skipped = sum(1 for r in processed_records if r.metadata.get('from_cache'))
        if skipped > 0:
            suggestions.insert(0, f"复用 {skipped} 条历史处理结果")

        conflicts = sum(1 for r in processed_records if r.metadata.get('conflict_detected'))
        if conflicts > 0:
            suggestions.insert(0, f"检测到 {conflicts} 条内容冲突，需人工确认")

        end_time = time.time()
        end_datetime = datetime.now()

        return MergeResult(
            batch_id=batch_id,
            total_records=len(processed_records),
            success_count=success_count,
            failed_count=failed_count,
            conflict_count=conflict_count,
            skipped_count=skipped_count,
            manual_fix_count=manual_fix_count,
            execution_time_ms=(end_time - start_time) * 1000,
            start_time=start_datetime,
            end_time=end_datetime,
            records=processed_records,
            suggestions=suggestions
        )

    def get_batch_cache_info(self, batch_id: str) -> Dict[str, int]:
        counts = defaultdict(int)
        for entry in self.index.values():
            if entry['batch_id'] == batch_id:
                counts[entry['status']] += 1
        return dict(counts)

    def clear_cache(self, batch_id: Optional[str] = None) -> int:
        if batch_id:
            to_remove = [rid for rid, entry in self.index.items() if entry['batch_id'] == batch_id]
            for rid in to_remove:
                cache_path = self.get_cache_path(rid)
                if cache_path.exists():
                    cache_path.unlink()
                del self.index[rid]
            self._save_index()
            return len(to_remove)
        else:
            for cache_file in self.cache_dir.glob("*.json"):
                if cache_file != self.index_file:
                    cache_file.unlink()
            self.index = {}
            self._save_index()
            return 0
