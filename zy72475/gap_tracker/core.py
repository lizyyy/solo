import json
import os
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
from collections import defaultdict

from .models import ComplaintRecord, HistoryEntry
from .boundary import BoundaryRules


class GapTracker:
    def __init__(self, config_path: str = "config.yaml"):
        self.rules = BoundaryRules(config_path)
        with open(config_path, "r", encoding="utf-8") as f:
            import yaml
            config = yaml.safe_load(f)
        self.data_paths = config["data_paths"]
        self.complaints: Dict[str, ComplaintRecord] = {}
        self.history: List[HistoryEntry] = []
        self._load_data()

    def _ensure_dirs(self):
        for path in [self.data_paths["complaints_db"], self.data_paths["history_db"]]:
            os.makedirs(os.path.dirname(path), exist_ok=True)
        for dir_path in [self.data_paths["import_dir"], self.data_paths["export_dir"]]:
            os.makedirs(dir_path, exist_ok=True)

    def _load_data(self):
        self._ensure_dirs()
        if os.path.exists(self.data_paths["complaints_db"]):
            with open(self.data_paths["complaints_db"], "r", encoding="utf-8") as f:
                data = json.load(f)
                self.complaints = {k: ComplaintRecord.from_dict(v) for k, v in data.items()}
        if os.path.exists(self.data_paths["history_db"]):
            with open(self.data_paths["history_db"], "r", encoding="utf-8") as f:
                data = json.load(f)
                self.history = [HistoryEntry.from_dict(h) for h in data]

    def _save_data(self):
        self._ensure_dirs()
        with open(self.data_paths["complaints_db"], "w", encoding="utf-8") as f:
            json.dump({k: v.to_dict() for k, v in self.complaints.items()}, f, ensure_ascii=False, indent=2)
        with open(self.data_paths["history_db"], "w", encoding="utf-8") as f:
            json.dump([h.to_dict() for h in self.history], f, ensure_ascii=False, indent=2)

    def _gen_history_id(self) -> str:
        return f"hist_{uuid.uuid4().hex[:12]}"

    def _now(self) -> str:
        return datetime.now().isoformat()

    def _record_change(self, complaint_id: str, field_name: str, old_value: Any, new_value: Any,
                       changed_by: str, reason: str = ""):
        if old_value == new_value:
            return
        entry = HistoryEntry(
            history_id=self._gen_history_id(),
            complaint_id=complaint_id,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            changed_by=changed_by,
            changed_at=self._now(),
            change_reason=reason
        )
        self.history.append(entry)

    def import_complaints(self, records: List[Dict[str, Any]], imported_by: str = "admin") -> Dict[str, Any]:
        imported = 0
        skipped_duplicate = 0
        flagged_same_community: List[Dict[str, Any]] = []
        now = self._now()

        for idx, record_data in enumerate(records):
            complaint_id = str(record_data.get("complaint_id", "")).strip()
            if not complaint_id:
                continue

            original_line_number = int(record_data.get("original_line_number", idx + 1))
            community_name = str(record_data.get("community_name", "")).strip()
            gap_count = int(record_data.get("gap_count", 0))
            remark = str(record_data.get("remark", ""))

            if complaint_id in self.complaints:
                skipped_duplicate += 1
                continue

            record = ComplaintRecord(
                complaint_id=complaint_id,
                community_name=community_name,
                original_line_number=original_line_number,
                import_timestamp=now,
                gap_count=gap_count,
                status=self.rules.status_workflow["initial"],
                remark=remark,
                created_by=imported_by,
                updated_by=imported_by,
                updated_at=now,
                flags={}
            )

            for existing_id, existing in self.complaints.items():
                is_same, reason = self.rules.is_same_community(community_name, existing.community_name)
                if is_same:
                    flagged_same_community.append({
                        "complaint_id": complaint_id,
                        "community_name": community_name,
                        "matched_id": existing_id,
                        "matched_name": existing.community_name,
                        "match_reason": reason
                    })
                    record.flags["possible_duplicate_community"] = True
                    record.flags["matched_with"] = existing_id
                    record.flags["match_reason"] = reason
                    record.status = "needs_review"
                    break

            self.complaints[complaint_id] = record
            self._record_change(complaint_id, "status", None, record.status, imported_by, "初始导入")
            imported += 1

        self._save_data()

        return {
            "imported": imported,
            "skipped_duplicate": skipped_duplicate,
            "flagged_same_community": flagged_same_community,
            "total_after_import": len(self.complaints)
        }

    def update_field(self, complaint_id: str, field_name: str, new_value: Any,
                     changed_by: str, reason: str = "") -> Tuple[bool, str]:
        if complaint_id not in self.complaints:
            return False, f"投诉编号 {complaint_id} 不存在"

        if self.rules.is_field_immutable(field_name):
            return False, f"字段 {field_name} 是不可变字段，导入后不可修改"

        record = self.complaints[complaint_id]
        old_value = getattr(record, field_name, None)

        if self.rules.should_track_history(field_name):
            self._record_change(complaint_id, field_name, old_value, new_value, changed_by, reason)

        setattr(record, field_name, new_value)
        record.updated_by = changed_by
        record.updated_at = self._now()
        self._save_data()

        return True, f"字段 {field_name} 更新成功"

    def transition_status(self, complaint_id: str, target_status: str,
                          changed_by: str, role: str, reason: str = "") -> Tuple[bool, str]:
        if complaint_id not in self.complaints:
            return False, f"投诉编号 {complaint_id} 不存在"

        record = self.complaints[complaint_id]
        current_status = record.status

        can_trans, msg = self.rules.can_transition_status(current_status, target_status, role)
        if not can_trans:
            return False, msg

        self._record_change(complaint_id, "status", current_status, target_status, changed_by, reason)
        record.status = target_status
        record.updated_by = changed_by
        record.updated_at = self._now()
        self._save_data()

        return True, f"状态从 {current_status} 变更为 {target_status}"

    def step_photo_reviewed(self, complaint_id: str, changed_by: str = "anning",
                            gap_count: Optional[int] = None, remark: str = "") -> Tuple[bool, str]:
        ok, msg = self.transition_status(complaint_id, "photo_reviewed", changed_by, "project_manager",
                                         "城更项目经理补看路口照片")
        if not ok:
            return False, msg

        if gap_count is not None:
            self.update_field(complaint_id, "gap_count", gap_count, changed_by, "照片复核后更新缺口数")
        if remark:
            self.update_field(complaint_id, "remark", remark, changed_by, "照片复核补充备注")

        return True, "第二步完成：照片已复核"

    def step_mark_for_review(self, complaint_id: str, changed_by: str = "anning",
                             reason: str = "小区名称疑似重复") -> Tuple[bool, str]:
        return self.transition_status(complaint_id, "needs_review", changed_by, "project_manager", reason)

    def step_summary_updated(self, complaint_id: str, changed_by: str = "anning",
                             summary_remark: str = "") -> Tuple[bool, str]:
        if self.complaints[complaint_id].status == "needs_review":
            ok, msg = self.transition_status(complaint_id, "summary_updated", changed_by, "inspector",
                                             "市政巡检员复核通过")
            if not ok:
                return False, msg
        else:
            ok, msg = self.transition_status(complaint_id, "summary_updated", changed_by, "project_manager",
                                             "街道会看摘要已更新")
            if not ok:
                return False, msg

        if summary_remark:
            self.update_field(complaint_id, "remark", summary_remark, changed_by, "街道会看摘要补充")
        return True, "第三步完成：摘要已更新"

    def get_history(self, complaint_id: Optional[str] = None) -> List[HistoryEntry]:
        if complaint_id:
            return [h for h in self.history if h.complaint_id == complaint_id]
        return list(self.history)

    def get_record(self, complaint_id: str) -> Optional[ComplaintRecord]:
        return self.complaints.get(complaint_id)

    def get_all_records(self, status_filter: Optional[str] = None) -> List[ComplaintRecord]:
        records = list(self.complaints.values())
        if status_filter:
            records = [r for r in records if r.status == status_filter]
        return records

    def get_gap_summary(self) -> Dict[str, Any]:
        total = len(self.complaints)
        by_status = defaultdict(int)
        total_gaps = 0
        flagged = 0
        for r in self.complaints.values():
            by_status[r.status] += 1
            total_gaps += r.gap_count
            if r.flags.get("possible_duplicate_community"):
                flagged += 1

        return {
            "total_complaints": total,
            "total_gap_count": total_gaps,
            "flagged_for_review": flagged,
            "by_status": dict(by_status)
        }

    def rollback(self, history_id: str, rolled_back_by: str = "admin") -> Tuple[bool, str]:
        target_entry = None
        for entry in self.history:
            if entry.history_id == history_id:
                target_entry = entry
                break

        if not target_entry:
            return False, f"历史记录 {history_id} 不存在"

        if target_entry.complaint_id not in self.complaints:
            return False, f"关联的投诉编号 {target_entry.complaint_id} 不存在"

        if self.rules.is_field_immutable(target_entry.field_name):
            return False, f"字段 {target_entry.field_name} 是不可变字段，不可回滚"

        record = self.complaints[target_entry.complaint_id]
        current_value = getattr(record, target_entry.field_name, None)

        self._record_change(
            target_entry.complaint_id,
            target_entry.field_name,
            current_value,
            target_entry.old_value,
            rolled_back_by,
            f"回滚历史记录 {history_id}"
        )

        setattr(record, target_entry.field_name, target_entry.old_value)
        record.updated_by = rolled_back_by
        record.updated_at = self._now()
        self._save_data()

        return True, f"已回滚: {target_entry.field_name} 从 {current_value} 恢复为 {target_entry.old_value}"

    def export_audit_report(self, complaint_id: Optional[str] = None) -> Dict[str, Any]:
        if complaint_id:
            if complaint_id not in self.complaints:
                return {}
            record = self.complaints[complaint_id]
            history = self.get_history(complaint_id)
            return {
                "record": record.to_dict(),
                "history": [h.to_dict() for h in history],
                "summary": {
                    "total_changes": len(history),
                    "last_updated_at": record.updated_at,
                    "last_updated_by": record.updated_by
                }
            }
        else:
            records = []
            for cid, record in self.complaints.items():
                history = self.get_history(cid)
                records.append({
                    "complaint_id": cid,
                    "record": record.to_dict(),
                    "history_count": len(history),
                    "status": record.status
                })
            return {
                "summary": self.get_gap_summary(),
                "records": records
            }
