import json
from pathlib import Path
from typing import List, Optional, Dict, Any
from datetime import datetime

from .models import PathRecord, PathStatus, IssueType, QueryFilter, MergeResult


class QueryEngine:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.results_dir = self.data_dir / "results"
        self.failed_dir = self.data_dir / "failed"
        self.manual_dir = self.data_dir / "manual_fixes"

        for d in [self.results_dir, self.failed_dir, self.manual_dir]:
            d.mkdir(parents=True, exist_ok=True)

    def query(self, filter: QueryFilter) -> List[PathRecord]:
        records = []
        for batch_file in self.results_dir.glob("batch_*.json"):
            batch_records = self._load_batch_records(batch_file)
            records.extend(batch_records)

        for failed_file in self.failed_dir.glob("*.json"):
            with open(failed_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                record = PathRecord(**data)
                records.append(record)

        return self._apply_filter(records, filter)

    def _load_batch_records(self, batch_file: Path) -> List[PathRecord]:
        with open(batch_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            return [PathRecord(**r) for r in data.get('records', [])]

    def _apply_filter(self, records: List[PathRecord], filter: QueryFilter) -> List[PathRecord]:
        filtered = records

        if filter.batch_id:
            filtered = [r for r in filtered if r.batch_id == filter.batch_id]

        if filter.status:
            filtered = [r for r in filtered if r.status == filter.status]

        if filter.issue_type:
            filtered = [
                r for r in filtered
                if any(issue.get('type') == filter.issue_type for issue in r.issues)
            ]

        if filter.start_date:
            filtered = [r for r in filtered if r.start_time >= filter.start_date]

        if filter.end_date:
            filtered = [r for r in filtered if r.end_time <= filter.end_date]

        if filter.agent_id:
            filtered = [r for r in filtered if r.agent_id == filter.agent_id]

        return filtered

    def get_by_status(self, status: PathStatus, batch_id: Optional[str] = None) -> List[PathRecord]:
        filter = QueryFilter(status=status, batch_id=batch_id)
        return self.query(filter)

    def get_success_records(self, batch_id: Optional[str] = None) -> List[PathRecord]:
        return self.get_by_status(PathStatus.SUCCESS, batch_id)

    def get_failed_records(self, batch_id: Optional[str] = None) -> List[PathRecord]:
        return self.get_by_status(PathStatus.FAILED, batch_id)

    def get_manual_fix_records(self, batch_id: Optional[str] = None) -> List[PathRecord]:
        return self.get_by_status(PathStatus.MANUAL_FIX, batch_id)

    def get_by_issue_type(self, issue_type: IssueType, batch_id: Optional[str] = None) -> List[PathRecord]:
        filter = QueryFilter(issue_type=issue_type, batch_id=batch_id)
        return self.query(filter)

    def get_permission_over_grant_records(self, batch_id: Optional[str] = None) -> List[PathRecord]:
        return self.get_by_issue_type(IssueType.PERMISSION_OVER_GRANT, batch_id)

    def get_statistics(self, batch_id: Optional[str] = None) -> Dict[str, Any]:
        all_records = self.query(QueryFilter(batch_id=batch_id))

        stats = {
            'total': len(all_records),
            'by_status': {},
            'by_issue_type': {},
            'cross_day_count': 0,
            'manual_fix_count': 0
        }

        for status in PathStatus:
            count = sum(1 for r in all_records if r.status == status)
            if count > 0:
                stats['by_status'][status.value] = count

        for issue_type in IssueType:
            count = sum(
                1 for r in all_records
                if any(issue.get('type') == issue_type for issue in r.issues)
            )
            if count > 0:
                stats['by_issue_type'][issue_type.value] = count

        stats['cross_day_count'] = sum(
            1 for r in all_records
            if any(issue.get('type') == IssueType.CROSS_DAY_BOUNDARY for issue in r.issues)
        )

        stats['manual_fix_count'] = sum(1 for r in all_records if r.is_manual_fix)

        if all_records:
            total_time = sum(r.execution_time_ms for r in all_records)
            stats['avg_execution_time_ms'] = total_time / len(all_records)
            stats['total_execution_time_ms'] = total_time

        return stats

    def save_result(self, result: MergeResult) -> None:
        result_file = self.results_dir / f"batch_{result.batch_id}.json"
        with open(result_file, 'w', encoding='utf-8') as f:
            json.dump(result.model_dump(), f, ensure_ascii=False, indent=2, default=str)

        for record in result.records:
            if record.status == PathStatus.FAILED:
                failed_file = self.failed_dir / f"{record.record_id}.json"
                with open(failed_file, 'w', encoding='utf-8') as f:
                    json.dump(record.model_dump(), f, ensure_ascii=False, indent=2, default=str)

            if record.is_manual_fix:
                manual_file = self.manual_dir / f"{record.record_id}.json"
                with open(manual_file, 'w', encoding='utf-8') as f:
                    json.dump(record.model_dump(), f, ensure_ascii=False, indent=2, default=str)

    def load_result(self, batch_id: str) -> Optional[MergeResult]:
        result_file = self.results_dir / f"batch_{batch_id}.json"
        if result_file.exists():
            with open(result_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                records = [PathRecord(**r) for r in data.get('records', [])]
                data['records'] = records
                return MergeResult(**data)
        return None
