from typing import List, Dict, Optional, Tuple
from collections import defaultdict
from datetime import datetime
import uuid
from core.models import ReplayRecord, ReplayStatus, Parameter
from core.replay_engine import ReplayEngine


class DraftManager:
    def __init__(self, engine: ReplayEngine):
        self.engine = engine
        self._records: Dict[str, List[ReplayRecord]] = defaultdict(list)
        self._record_index: Dict[str, ReplayRecord] = {}

    def add_draft(self, problem_id: str, problem_title: str, parameters: List[Parameter],
                  created_by: str = "学生草稿", is_boundary: bool = False,
                  remark: str = "") -> ReplayRecord:
        existing_versions = self._records.get(problem_id, [])
        next_version = len(existing_versions) + 1

        record_id = f"{problem_id}_v{next_version}_{uuid.uuid4().hex[:8]}"

        record = ReplayRecord(
            record_id=record_id,
            problem_id=problem_id,
            problem_title=problem_title,
            version=next_version,
            status=ReplayStatus.DRAFT,
            parameters=parameters,
            steps=[],
            is_boundary=is_boundary,
            remark=remark,
            created_by=created_by,
        )

        self._records[problem_id].append(record)
        self._record_index[record_id] = record

        return record

    def replay_draft(self, record_id: str) -> ReplayRecord:
        record = self._record_index.get(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        return self.engine.replay(record)

    def replay_all_drafts(self, problem_id: str = None) -> List[ReplayRecord]:
        if problem_id:
            records = self._records.get(problem_id, [])
        else:
            records = list(self._record_index.values())

        for record in records:
            if record.status == ReplayStatus.DRAFT:
                self.engine.replay(record)

        return records

    def get_record(self, record_id: str) -> Optional[ReplayRecord]:
        return self._record_index.get(record_id)

    def get_problem_versions(self, problem_id: str) -> List[ReplayRecord]:
        return self._records.get(problem_id, [])

    def get_latest_version(self, problem_id: str) -> Optional[ReplayRecord]:
        versions = self._records.get(problem_id, [])
        return versions[-1] if versions else None

    def list_all_records(self, status_filter: ReplayStatus = None,
                         problem_id: str = None,
                         include_boundary: bool = True) -> List[ReplayRecord]:
        records = list(self._record_index.values())

        if problem_id:
            records = [r for r in records if r.problem_id == problem_id]

        if status_filter:
            records = [r for r in records if r.status == status_filter]

        if not include_boundary:
            records = [r for r in records if not r.is_boundary]

        return sorted(records, key=lambda r: (r.problem_id, r.version))

    def add_remark(self, record_id: str, remark: str) -> bool:
        record = self._record_index.get(record_id)
        if not record:
            return False

        if record.remark:
            record.remark = f"{record.remark}\n{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}: {remark}"
        else:
            record.remark = f"{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}: {remark}"

        record.updated_at = datetime.now()
        return True

    def get_fail_statistics(self) -> Dict[str, int]:
        stats = defaultdict(int)
        for record in self._record_index.values():
            stats[record.status.value] += 1
        return dict(stats)

    def get_unit_missing_records(self) -> List[ReplayRecord]:
        return [r for r in self._record_index.values()
                if r.status == ReplayStatus.FAILED_UNIT]

    def get_boundary_records(self) -> List[ReplayRecord]:
        return [r for r in self._record_index.values() if r.is_boundary]

    def compare_two_versions(self, problem_id: str, version_a: int, version_b: int) -> Optional[Dict]:
        versions = self._records.get(problem_id, [])
        if len(versions) < max(version_a, version_b):
            return None

        record_a = versions[version_a - 1]
        record_b = versions[version_b - 1]

        return self.engine.compare_records(record_a, record_b)

    def compare_two_records(self, record_id_a: str, record_id_b: str) -> Optional[Dict]:
        record_a = self._record_index.get(record_id_a)
        record_b = self._record_index.get(record_id_b)

        if not record_a or not record_b:
            return None

        return self.engine.compare_records(record_a, record_b)
