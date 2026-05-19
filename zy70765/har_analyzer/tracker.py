from typing import List, Dict, Any, Optional
from collections import defaultdict
from .parser import HarEntry


class SourceTracker:
    def __init__(self):
        self.entry_sources: Dict[int, Dict[str, Any]] = {}
        self.file_stats: Dict[str, Dict[str, Any]] = defaultdict(lambda: {
            "total_entries": 0,
            "bad_entries": 0,
            "total_time": 0.0,
        })

    def track_entries(self, entries: List[HarEntry]) -> None:
        for entry in entries:
            source_file = entry.source_file
            raw_index = entry.raw_index

            self.entry_sources[raw_index] = {
                "source_file": source_file,
                "raw_index": raw_index,
                "is_bad": entry.is_bad,
                "bad_reason": entry.bad_reason if entry.is_bad else "",
                "time_ms": entry.time,
                "domain": entry.domain,
                "resource_type": entry.resource_type,
                "status": entry.status,
                "url": entry.url,
            }

            stats = self.file_stats[source_file]
            stats["total_entries"] += 1
            if entry.is_bad:
                stats["bad_entries"] += 1
            else:
                stats["total_time"] += entry.time

    def get_entry_source(self, raw_index: int) -> Optional[Dict[str, Any]]:
        return self.entry_sources.get(raw_index)

    def get_bad_entries_with_source(self) -> List[Dict[str, Any]]:
        bad_sources = []
        for raw_index, source_info in self.entry_sources.items():
            if source_info["is_bad"]:
                bad_sources.append({
                    "raw_index": raw_index,
                    "source_file": source_info["source_file"],
                    "bad_reason": source_info["bad_reason"],
                    "url": source_info["url"],
                })
        return sorted(bad_sources, key=lambda x: x["raw_index"])

    def get_file_summary(self) -> Dict[str, Any]:
        result = {}
        for file_path, stats in self.file_stats.items():
            result[file_path] = {
                "total_entries": stats["total_entries"],
                "bad_entries": stats["bad_entries"],
                "bad_ratio": stats["bad_entries"] / stats["total_entries"] if stats["total_entries"] > 0 else 0,
                "total_time_ms": stats["total_time"],
            }
        return dict(sorted(result.items()))

    def get_full_tracking(self) -> Dict[str, Any]:
        return {
            "file_summary": self.get_file_summary(),
            "bad_entries_detail": self.get_bad_entries_with_source(),
            "all_entries_sources": self.entry_sources,
        }
