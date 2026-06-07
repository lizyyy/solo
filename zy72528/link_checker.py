from typing import Dict, Optional
from models import SampleRecord, SampleStatus, HistoryRecord
from errors import Link404Error
import re


VALID_LINKS_CACHE = {
    "https://kb.example.com/kb-001": True,
    "https://kb.example.com/kb-002": True,
    "https://kb.example.com/kb-003": True,
    "https://kb.example.com/kb-004": True,
    "https://kb.example.com/kb-005": True,
    "https://kb.example.com/kb-006": True,
    "https://kb.example.com/kb-007": True,
    "https://kb.example.com/kb-008": True,
    "https://kb.example.com/kb-999": False,
    "https://kb.example.com/404-page": False,
}


class LinkChecker:
    def __init__(self):
        self.check_results: Dict[str, bool] = {}
        self.history: list[HistoryRecord] = []

    def check_link(self, sample: SampleRecord, auto_mark_status: bool = True) -> bool:
        link = sample.knowledge_link
        is_valid = self._simulate_check(link)
        self.check_results[sample.sample_id] = is_valid
        sample.link_valid = is_valid

        if not is_valid:
            if auto_mark_status:
                before_status = sample.status.value
                sample.status = SampleStatus.NEED_PRODUCT_REVIEW
                self._add_history(
                    sample.sample_id,
                    "链接检测",
                    before_status,
                    sample.status.value,
                    "系统",
                    f"链接【{link}】检测为404，自动标记为待产品复核"
                )
            raise Link404Error(link, sample.sample_id)

        self._add_history(
            sample.sample_id,
            "链接检测",
            sample.status.value,
            sample.status.value,
            "系统",
            f"链接【{link}】检测通过"
        )

        return is_valid

    def _simulate_check(self, link: str) -> bool:
        if link in VALID_LINKS_CACHE:
            return VALID_LINKS_CACHE[link]

        if re.search(r'404|invalid|not-found', link, re.IGNORECASE):
            return False

        return True

    def batch_check(self, samples: list[SampleRecord]) -> Dict[str, bool]:
        results = {}
        for sample in samples:
            try:
                self.check_link(sample, auto_mark_status=True)
                results[sample.sample_id] = True
            except Link404Error:
                results[sample.sample_id] = False
        return results

    def get_result(self, sample_id: str) -> Optional[bool]:
        return self.check_results.get(sample_id)

    def _add_history(
        self,
        sample_id: str,
        action: str,
        before_status: str,
        after_status: str,
        operator: str,
        detail: str
    ):
        record = HistoryRecord(
            sample_id=sample_id,
            action=action,
            before_status=before_status,
            after_status=after_status,
            operator=operator,
            detail=detail
        )
        self.history.append(record)

    def get_history(self, sample_id: str = None):
        if sample_id:
            return [h for h in self.history if h.sample_id == sample_id]
        return self.history.copy()
