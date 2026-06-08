import os
import json
import difflib
from typing import Dict, List, Optional, Any, Tuple
from datetime import datetime
from pathlib import Path
from dataclasses import dataclass, asdict
import copy

from .exceptions import VersionNotFoundError, RollbackError


@dataclass
class ChangeRecord:
    timestamp: str
    field: str
    old_value: Any
    new_value: Any
    author: str
    comment: str = ""


@dataclass
class Version:
    version_id: str
    parent_version: Optional[str]
    timestamp: str
    author: str
    description: str
    changes: List[ChangeRecord]
    data_snapshot: Dict
    is_rollback: bool = False


class HistoryManager:
    def __init__(self, history_dir: str):
        self.history_dir = Path(history_dir)
        self.history_dir.mkdir(parents=True, exist_ok=True)
        self.versions_file = self.history_dir / "versions.json"
        self.current_version_file = self.history_dir / "current_version.txt"
        self.versions: Dict[str, Version] = {}
        self.current_version_id: Optional[str] = None
        self._id_counter = 0
        self._load_history()

    def _load_history(self) -> None:
        max_counter = 0
        if self.versions_file.exists():
            with open(self.versions_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                self.versions = {}
                for vid, vdata in data["versions"].items():
                    changes = [ChangeRecord(**c) for c in vdata.pop("changes", [])]
                    self.versions[vid] = Version(changes=changes, **vdata)
                    parts = vid.rsplit("_", 1)
                    if len(parts) == 2 and parts[1].isdigit():
                        max_counter = max(max_counter, int(parts[1]))
                self.current_version_id = data.get("current_version_id")
        elif self.current_version_file.exists():
            with open(self.current_version_file, 'r') as f:
                self.current_version_id = f.read().strip()
        self._id_counter = max_counter

    def _save_history(self) -> None:
        data = {
            "versions": {
                vid: {**asdict(ver), "changes": [asdict(c) for c in ver.changes]}
                for vid, ver in self.versions.items()
            },
            "current_version_id": self.current_version_id
        }
        with open(self.versions_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _generate_version_id(self) -> str:
        self._id_counter += 1
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")[:-3]
        return f"v_{timestamp}_{self._id_counter:04d}"

    def create_version(self, data: Dict, author: str, description: str,
                       changes: List[ChangeRecord] = None,
                       parent_version: str = None) -> str:
        version_id = self._generate_version_id()
        version = Version(
            version_id=version_id,
            parent_version=parent_version or self.current_version_id,
            timestamp=datetime.now().isoformat(),
            author=author,
            description=description,
            changes=changes or [],
            data_snapshot=copy.deepcopy(data)
        )
        self.versions[version_id] = version
        self.current_version_id = version_id
        self._save_history()
        return version_id

    def record_annotation_update(self, item_id: str, old_annotation: Dict, 
                                  new_annotation: Dict, author: str,
                                  comment: str = "") -> ChangeRecord:
        change = ChangeRecord(
            timestamp=datetime.now().isoformat(),
            field=f"annotation.{item_id}",
            old_value=old_annotation,
            new_value=new_annotation,
            author=author,
            comment=comment
        )
        return change

    def record_import(self, source_file: str, file_hash: str, 
                      record_count: int, metadata: Dict = None) -> str:
        description = f"导入数据文件: {source_file}, {record_count}条记录"
        data = {
            "type": "import",
            "source_file": source_file,
            "file_hash": file_hash,
            "record_count": record_count,
            "metadata": metadata or {}
        }
        return self.create_version(
            data=data,
            author="system",
            description=description
        )

    def get_version(self, version_id: str) -> Version:
        if version_id not in self.versions:
            raise VersionNotFoundError(version_id)
        return self.versions[version_id]

    def list_versions(self, limit: int = None) -> List[Version]:
        versions = sorted(self.versions.values(), key=lambda v: v.timestamp, reverse=True)
        if limit:
            versions = versions[:limit]
        return versions

    def compare_versions(self, version_id1: str, version_id2: str) -> Dict:
        v1 = self.get_version(version_id1)
        v2 = self.get_version(version_id2)

        data1 = json.dumps(v1.data_snapshot, ensure_ascii=False, sort_keys=True, indent=2)
        data2 = json.dumps(v2.data_snapshot, ensure_ascii=False, sort_keys=True, indent=2)

        diff = list(difflib.unified_diff(
            data1.splitlines(keepends=True),
            data2.splitlines(keepends=True),
            fromfile=version_id1,
            tofile=version_id2,
            lineterm=""
        ))

        return {
            "version1": version_id1,
            "version2": version_id2,
            "diff": diff,
            "v1_timestamp": v1.timestamp,
            "v2_timestamp": v2.timestamp,
            "v1_author": v1.author,
            "v2_author": v2.author
        }

    def rollback_to_version(self, version_id: str, author: str, 
                            reason: str = "") -> Dict:
        if version_id not in self.versions:
            raise VersionNotFoundError(version_id)

        target_version = self.versions[version_id]
        rollback_version_id = self._generate_version_id()
        
        changes = [ChangeRecord(
            timestamp=datetime.now().isoformat(),
            field="rollback",
            old_value=self.current_version_id,
            new_value=version_id,
            author=author,
            comment=reason
        )]

        rollback_version = Version(
            version_id=rollback_version_id,
            parent_version=self.current_version_id,
            timestamp=datetime.now().isoformat(),
            author=author,
            description=f"回滚到版本 {version_id}: {reason}",
            changes=changes,
            data_snapshot=copy.deepcopy(target_version.data_snapshot),
            is_rollback=True
        )

        self.versions[rollback_version_id] = rollback_version
        self.current_version_id = rollback_version_id
        self._save_history()

        return {
            "status": "success",
            "rollback_version_id": rollback_version_id,
            "target_version_id": version_id,
            "data_snapshot": target_version.data_snapshot
        }

    def get_current_snapshot(self) -> Optional[Dict]:
        if self.current_version_id and self.current_version_id in self.versions:
            return self.versions[self.current_version_id].data_snapshot
        return None

    def get_version_chain(self, version_id: str = None) -> List[str]:
        if version_id is None:
            version_id = self.current_version_id
        if not version_id:
            return []
        
        chain = []
        current = version_id
        while current:
            chain.append(current)
            if current in self.versions:
                current = self.versions[current].parent_version
            else:
                break
        return chain

    def record_error_note_update(self, update_result: Dict) -> Tuple[str, ChangeRecord]:
        change = ChangeRecord(
            timestamp=update_result.get("changed_at", datetime.now().isoformat()),
            field=f"error_notes.{update_result['customer_id']}.{update_result['timestamp']}",
            old_value=update_result["old_value"],
            new_value=update_result["new_value"],
            author=update_result["modifier"],
            comment=update_result.get("reason", "")
        )
        version_id = self.create_version(
            data={
                "type": "error_note_update",
                **update_result
            },
            author=update_result["modifier"],
            description=(f"更新误差说明：客户{update_result['customer_id']}，"
                        f"学生{update_result.get('student_id','')}v{update_result.get('answer_version','')}；"
                        f"原因：{update_result.get('reason', '未说明')}"),
            changes=[change]
        )
        return version_id, change

    def record_annotation_update(self, update_result: Dict) -> Tuple[str, ChangeRecord]:
        change = ChangeRecord(
            timestamp=update_result.get("changed_at", datetime.now().isoformat()),
            field=f"annotations.{update_result['customer_id']}.{update_result['timestamp']}",
            old_value=update_result["old_value"],
            new_value=update_result["new_value"],
            author=update_result["modifier"],
            comment=update_result.get("reason", "")
        )
        version_id = self.create_version(
            data={
                "type": "annotation_update",
                **update_result
            },
            author=update_result["modifier"],
            description=(f"更新备注/批注：客户{update_result['customer_id']}，"
                        f"学生{update_result.get('student_id','')}v{update_result.get('answer_version','')}；"
                        f"原因：{update_result.get('reason', '未说明')}"),
            changes=[change]
        )
        return version_id, change

    def record_field_rollback(self, rollback_result: Dict) -> Tuple[str, ChangeRecord]:
        change = ChangeRecord(
            timestamp=datetime.now().isoformat(),
            field=f"rollback.{rollback_result['field']}.{rollback_result['customer_id']}.{rollback_result['timestamp']}",
            old_value=rollback_result["new_value"],
            new_value=rollback_result["old_value"],
            author=rollback_result["modifier"],
            comment=rollback_result.get("reason", "回滚")
        )
        version_id = self.create_version(
            data={
                "type": "field_rollback",
                **rollback_result
            },
            author=rollback_result["modifier"],
            description=(f"回滚字段{rollback_result['field']}：客户{rollback_result['customer_id']}"),
            changes=[change]
        )
        return version_id, change

    def find_previous_field_value(self, customer_id: str, timestamp_str: str,
                                   field: str) -> Optional[Any]:
        try:
            import pandas as pd
            target = pd.to_datetime(timestamp_str).isoformat()
        except Exception:
            target = timestamp_str

        for version in self.list_versions():
            snap = version.data_snapshot
            if snap.get("customer_id") != customer_id:
                continue
            if snap.get("field") != field:
                continue
            if snap.get("type") not in ("error_note_update", "annotation_update", "field_rollback"):
                continue
            try:
                actual = pd.to_datetime(snap.get("timestamp", "")).isoformat()
            except Exception:
                actual = str(snap.get("timestamp", ""))
            if actual == target:
                return snap.get("old_value")
        return None

    def summary_report(self) -> Dict:
        counts = {
            "import": 0,
            "error_note_update": 0,
            "annotation_update": 0,
            "field_rollback": 0,
            "review_approve": 0,
            "review_reject": 0,
            "review_request_info": 0,
            "rollback": 0,
            "other": 0
        }
        unique_students_in_history = set()
        for v in self.list_versions():
            t = v.data_snapshot.get("type", "other")
            if isinstance(t, str) and t in counts:
                counts[t] += 1
            else:
                counts["other"] += 1
            stu = v.data_snapshot.get("student_id")
            if stu:
                unique_students_in_history.add(str(stu))
            if "review_id" in v.data_snapshot:
                counts["review_approve"] += 1
            if v.is_rollback:
                counts["rollback"] += 1
        return {
            "total_versions": len(self.versions),
            "current_version_id": self.current_version_id,
            "operation_counts": counts,
            "unique_students_touched": sorted(unique_students_in_history)
        }
