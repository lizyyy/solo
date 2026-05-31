import json
import hashlib
import os
from datetime import datetime
from typing import Optional, List, Dict, Any


STATUS_RECEIVED = "received"
STATUS_REVIEWING = "reviewing"
STATUS_APPROVED = "approved"
STATUS_PENDING = "pending"
STATUS_REJECTED = "rejected"

VALID_TRANSITIONS = {
    STATUS_RECEIVED: [STATUS_REVIEWING, STATUS_PENDING],
    STATUS_REVIEWING: [STATUS_APPROVED, STATUS_PENDING, STATUS_REJECTED],
    STATUS_PENDING: [STATUS_REVIEWING],
    STATUS_APPROVED: [STATUS_PENDING],
    STATUS_REJECTED: [STATUS_REVIEWING],
}

PENDING_REASON_MISSING_AUTH = "missing_auth"
PENDING_REASON_DUPLICATE = "duplicate"
PENDING_REASON_REVIEW_CHANGED = "review_comment_changed"
PENDING_REASON_OTHER = "other"

PENDING_REASON_LABELS = {
    PENDING_REASON_MISSING_AUTH: "缺授权文件",
    PENDING_REASON_DUPLICATE: "重复素材",
    PENDING_REASON_REVIEW_CHANGED: "审稿意见变更",
    PENDING_REASON_OTHER: "其他",
}

STATUS_LABELS = {
    STATUS_RECEIVED: "已接收",
    STATUS_REVIEWING: "审稿中",
    STATUS_APPROVED: "已通过",
    STATUS_PENDING: "待处理",
    STATUS_REJECTED: "已驳回",
}


def _now_iso():
    return datetime.now().strftime("%Y-%m-%dT%H:%M:%S")


def _material_fingerprint(material_name: str, source: str, content_bytes: bytes = b"") -> str:
    raw = f"{material_name}||{source}||{hashlib.sha256(content_bytes).hexdigest()}"
    return hashlib.sha256(raw.encode("utf-8")).hexdigest()[:16]


class ChangeEntry:
    def __init__(self, timestamp: str, operator: str, action: str, detail: str = ""):
        self.timestamp = timestamp
        self.operator = operator
        self.action = action
        self.detail = detail

    def to_dict(self) -> Dict[str, str]:
        return {
            "timestamp": self.timestamp,
            "operator": self.operator,
            "action": self.action,
            "detail": self.detail,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, str]) -> "ChangeEntry":
        return cls(d["timestamp"], d["operator"], d["action"], d.get("detail", ""))

    def __repr__(self):
        d = f" ({self.detail})" if self.detail else ""
        return f"[{self.timestamp}] {self.operator} - {self.action}{d}"


class MaterialRecord:
    def __init__(
        self,
        record_id: str,
        material_name: str,
        source: str,
        fingerprint: str,
        operator: str,
        status: str = STATUS_RECEIVED,
        pending_reason: Optional[str] = None,
    ):
        self.record_id = record_id
        self.material_name = material_name
        self.source = source
        self.fingerprint = fingerprint
        self.status = status
        self.pending_reason = pending_reason
        self.changelog: List[ChangeEntry] = []
        self.created_at = _now_iso()
        self.updated_at = self.created_at

        self.changelog.append(
            ChangeEntry(self.created_at, operator, "create", f"录入素材，来源: {source}")
        )

    def transition_status(
        self,
        new_status: str,
        operator: str,
        pending_reason: Optional[str] = None,
        detail: str = "",
    ) -> bool:
        if new_status not in VALID_TRANSITIONS.get(self.status, []):
            return False
        old_status = self.status
        self.status = new_status
        self.pending_reason = pending_reason if new_status == STATUS_PENDING else None
        self.updated_at = _now_iso()

        reason_str = ""
        if new_status == STATUS_PENDING and pending_reason:
            reason_str = f"，原因: {PENDING_REASON_LABELS.get(pending_reason, pending_reason)}"
        detail_str = f"，{detail}" if detail else ""

        self.changelog.append(
            ChangeEntry(
                self.updated_at,
                operator,
                f"status: {STATUS_LABELS.get(old_status, old_status)} -> {STATUS_LABELS.get(new_status, new_status)}{reason_str}",
                detail,
            )
        )
        return True

    def add_review_comment(self, operator: str, comment: str, changed: bool = False):
        self.updated_at = _now_iso()
        action = "review_comment_changed" if changed else "review_comment_added"
        label = "修改审稿意见" if changed else "添加审稿意见"
        self.changelog.append(
            ChangeEntry(self.updated_at, operator, label, comment)
        )

    def to_dict(self) -> Dict[str, Any]:
        return {
            "record_id": self.record_id,
            "material_name": self.material_name,
            "source": self.source,
            "fingerprint": self.fingerprint,
            "status": self.status,
            "pending_reason": self.pending_reason,
            "changelog": [c.to_dict() for c in self.changelog],
            "created_at": self.created_at,
            "updated_at": self.updated_at,
        }

    @classmethod
    def from_dict(cls, d: Dict[str, Any]) -> "MaterialRecord":
        rec = cls.__new__(cls)
        rec.record_id = d["record_id"]
        rec.material_name = d["material_name"]
        rec.source = d["source"]
        rec.fingerprint = d["fingerprint"]
        rec.status = d["status"]
        rec.pending_reason = d.get("pending_reason")
        rec.changelog = [ChangeEntry.from_dict(c) for c in d.get("changelog", [])]
        rec.created_at = d["created_at"]
        rec.updated_at = d["updated_at"]
        return rec


class Archive:
    def __init__(self, store_path: str = "archive_store.json"):
        self.store_path = store_path
        self.records: Dict[str, MaterialRecord] = {}
        self._counter = 0
        self._load()

    def _load(self):
        if os.path.exists(self.store_path):
            with open(self.store_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            for rd in data.get("records", []):
                rec = MaterialRecord.from_dict(rd)
                self.records[rec.record_id] = rec
            self._counter = data.get("counter", len(self.records))

    def _save(self):
        data = {
            "counter": self._counter,
            "records": [r.to_dict() for r in self.records.values()],
        }
        with open(self.store_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _next_id(self) -> str:
        self._counter += 1
        return f"MAT-{self._counter:04d}"

    def _find_by_fingerprint(self, fingerprint: str) -> Optional[MaterialRecord]:
        for rec in self.records.values():
            if rec.fingerprint == fingerprint:
                return rec
        return None

    def submit(
        self,
        material_name: str,
        source: str,
        operator: str,
        content_bytes: bytes = b"",
        review_comment: str = "",
        auth_docs_present: bool = True,
    ) -> MaterialRecord:
        fingerprint = _material_fingerprint(material_name, source, content_bytes)
        existing = self._find_by_fingerprint(fingerprint)

        if existing:
            existing.updated_at = _now_iso()
            existing.changelog.append(
                ChangeEntry(
                    existing.updated_at,
                    operator,
                    "re_submit",
                    f"同一素材再次提交，来源: {source}，历史保留不覆盖",
                )
            )
            if review_comment:
                existing.add_review_comment(operator, review_comment, changed=True)
                existing.transition_status(STATUS_PENDING, operator, PENDING_REASON_REVIEW_CHANGED, "再次提交时审稿意见有变化")
            self._save()
            return existing

        record_id = self._next_id()
        rec = MaterialRecord(record_id, material_name, source, fingerprint, operator)

        if not auth_docs_present:
            rec.transition_status(STATUS_PENDING, operator, PENDING_REASON_MISSING_AUTH, "授权文件缺失")
        elif review_comment:
            rec.add_review_comment(operator, review_comment)
            rec.transition_status(STATUS_REVIEWING, operator)

        self.records[record_id] = rec
        self._save()
        return rec

    def submit_batch(
        self,
        materials: List[Dict[str, Any]],
        operator: str,
    ) -> List[MaterialRecord]:
        results = []
        seen_in_batch = set()
        for m in materials:
            name = m["material_name"]
            source = m["source"]
            content = m.get("content_bytes", b"")
            comment = m.get("review_comment", "")
            auth = m.get("auth_docs_present", True)

            fp = _material_fingerprint(name, source, content)
            if fp in seen_in_batch:
                existing_result = None
                for r in results:
                    if r.fingerprint == fp:
                        existing_result = r
                        break
                if existing_result:
                    existing_result.transition_status(
                        STATUS_PENDING, operator, PENDING_REASON_DUPLICATE,
                        f"同批次内重复素材: {name}",
                    )
                continue

            seen_in_batch.add(fp)
            rec = self.submit(name, source, operator, content, comment, auth)
            results.append(rec)

        self._save()
        return results

    def update_status(
        self,
        record_id: str,
        new_status: str,
        operator: str,
        pending_reason: Optional[str] = None,
        detail: str = "",
    ) -> Optional[MaterialRecord]:
        rec = self.records.get(record_id)
        if not rec:
            return None
        ok = rec.transition_status(new_status, operator, pending_reason, detail)
        if ok:
            self._save()
        return rec if ok else None

    def add_review_comment(
        self,
        record_id: str,
        operator: str,
        comment: str,
        changed: bool = False,
    ) -> Optional[MaterialRecord]:
        rec = self.records.get(record_id)
        if not rec:
            return None
        rec.add_review_comment(operator, comment, changed)
        if changed:
            rec.transition_status(STATUS_PENDING, operator, PENDING_REASON_REVIEW_CHANGED, "审稿意见被修改，需重新确认")
        self._save()
        return rec

    def get_record(self, record_id: str) -> Optional[MaterialRecord]:
        return self.records.get(record_id)

    def list_records(
        self, status_filter: Optional[str] = None
    ) -> List[MaterialRecord]:
        recs = list(self.records.values())
        if status_filter:
            recs = [r for r in recs if r.status == status_filter]
        recs.sort(key=lambda r: r.updated_at, reverse=True)
        return recs

    def export_handover(self, output_path: str = "handover_note.txt") -> str:
        lines = []
        lines.append("=" * 60)
        lines.append("社媒素材归档 - 交接说明")
        lines.append(f"导出时间: {_now_iso()}")
        lines.append("=" * 60)
        lines.append("")

        all_records = self.list_records()
        pending_records = [r for r in all_records if r.status == STATUS_PENDING]

        lines.append(f"一、概览")
        lines.append(f"  总记录数: {len(all_records)}")
        for status, label in STATUS_LABELS.items():
            count = len([r for r in all_records if r.status == status])
            lines.append(f"  {label}: {count}")
        lines.append("")

        if pending_records:
            lines.append("二、待处理项（需下一班关注）")
            lines.append("-" * 40)
            for rec in pending_records:
                reason = PENDING_REASON_LABELS.get(rec.pending_reason, rec.pending_reason or "未标注")
                lines.append(f"  [{rec.record_id}] {rec.material_name}")
                lines.append(f"    来源: {rec.source}")
                lines.append(f"    待处理原因: {reason}")
                lines.append(f"    最后更新: {rec.updated_at}")
                lines.append(f"    变更记录:")
                for entry in rec.changelog:
                    lines.append(f"      {entry}")
                lines.append("")
        else:
            lines.append("二、待处理项: 无")
            lines.append("")

        lines.append("三、全部记录明细")
        lines.append("-" * 40)
        for rec in all_records:
            status_label = STATUS_LABELS.get(rec.status, rec.status)
            pending_info = ""
            if rec.status == STATUS_PENDING and rec.pending_reason:
                pending_info = f" ({PENDING_REASON_LABELS.get(rec.pending_reason, rec.pending_reason)})"
            lines.append(f"  [{rec.record_id}] {rec.material_name}")
            lines.append(f"    来源: {rec.source}")
            lines.append(f"    当前状态: {status_label}{pending_info}")
            lines.append(f"    录入时间: {rec.created_at}")
            lines.append(f"    最后更新: {rec.updated_at}")
            lines.append(f"    完整变更记录:")
            for entry in rec.changelog:
                lines.append(f"      {entry}")
            lines.append("")

        text = "\n".join(lines)
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(text)
        return text
