import json
from pathlib import Path
from typing import Dict, Optional, List
from datetime import datetime

from .models import ConfirmStatus, RegressionConclusion


class ReviewRecord:
    def __init__(
        self,
        query_signature: str,
        query_template: str,
        status: ConfirmStatus,
        reviewer: str = "",
        notes: str = "",
        reviewed_at: Optional[datetime] = None
    ):
        self.query_signature = query_signature
        self.query_template = query_template
        self.status = status
        self.reviewer = reviewer
        self.notes = notes
        self.reviewed_at = reviewed_at or datetime.now()

    def to_dict(self) -> dict:
        return {
            "query_signature": self.query_signature,
            "query_template": self.query_template,
            "status": self.status.value,
            "reviewer": self.reviewer,
            "notes": self.notes,
            "reviewed_at": self.reviewed_at.isoformat()
        }

    @classmethod
    def from_dict(cls, data: dict) -> 'ReviewRecord':
        return cls(
            query_signature=data["query_signature"],
            query_template=data["query_template"],
            status=ConfirmStatus(data["status"]),
            reviewer=data.get("reviewer", ""),
            notes=data.get("notes", ""),
            reviewed_at=datetime.fromisoformat(data["reviewed_at"]) if data.get("reviewed_at") else None
        )


class ReviewManager:
    def __init__(self, review_file: str = "review_records.json"):
        self.review_file = Path(review_file)
        self.records: Dict[str, ReviewRecord] = {}
        self._load()

    def _load(self):
        if self.review_file.exists():
            try:
                with open(self.review_file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                for record_data in data:
                    record = ReviewRecord.from_dict(record_data)
                    self.records[record.query_signature] = record
            except Exception as e:
                print(f"警告：加载审核记录失败: {e}")

    def _save(self):
        self.review_file.parent.mkdir(parents=True, exist_ok=True)
        records_list = [r.to_dict() for r in self.records.values()]
        with open(self.review_file, 'w', encoding='utf-8') as f:
            json.dump(records_list, f, ensure_ascii=False, indent=2, sort_keys=True)

    def add_review(
        self,
        query_signature: str,
        query_template: str,
        status: ConfirmStatus,
        reviewer: str = "",
        notes: str = ""
    ) -> ReviewRecord:
        record = ReviewRecord(
            query_signature=query_signature,
            query_template=query_template,
            status=status,
            reviewer=reviewer,
            notes=notes
        )
        self.records[query_signature] = record
        self._save()
        return record

    def get_review(self, query_signature: str) -> Optional[ReviewRecord]:
        return self.records.get(query_signature)

    def get_all_reviews(self) -> List[ReviewRecord]:
        return sorted(self.records.values(), key=lambda r: r.reviewed_at, reverse=True)

    def get_reviews_by_status(self, status: ConfirmStatus) -> List[ReviewRecord]:
        return [r for r in self.records.values() if r.status == status]

    def delete_review(self, query_signature: str) -> bool:
        if query_signature in self.records:
            del self.records[query_signature]
            self._save()
            return True
        return False

    def get_conclusion(self, query_signature: str) -> Optional[RegressionConclusion]:
        record = self.get_review(query_signature)
        if record:
            if record.status == ConfirmStatus.CONFIRMED:
                return RegressionConclusion.REGRESSED
            elif record.status == ConfirmStatus.REJECTED:
                return RegressionConclusion.FALSE_POSITIVE
        return None

    def print_summary(self):
        print("\n" + "=" * 60)
        print("审核记录摘要")
        print("=" * 60)
        print(f"总记录数: {len(self.records)}")

        status_counts = {}
        for record in self.records.values():
            status = record.status.value
            status_counts[status] = status_counts.get(status, 0) + 1

        print("\n状态分布:")
        for status in ConfirmStatus:
            count = status_counts.get(status.value, 0)
            if count > 0:
                print(f"  {status.value:20s}: {count} 条")

        if self.records:
            print("\n最近审核:")
            recent = sorted(self.records.values(), key=lambda r: r.reviewed_at, reverse=True)[:5]
            for record in recent:
                reviewer = f" by {record.reviewer}" if record.reviewer else ""
                print(f"  [{record.status.value}] {record.query_template[:40]}...{reviewer}")

        print("=" * 60 + "\n")
