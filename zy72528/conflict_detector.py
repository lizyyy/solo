from typing import List, Dict, Optional
from models import SampleRecord, ConflictEvidence, SampleStatus, MaterialType, HistoryRecord
from datetime import datetime


PROMPT_VERSION_METADATA = {
    "v1.0": {
        "release_date": "2024-01-15",
        "knowledge_docs": ["kb-001", "kb-002"],
        "hallucination_threshold": 0.7
    },
    "v1.1": {
        "release_date": "2024-03-20",
        "knowledge_docs": ["kb-001", "kb-002", "kb-003"],
        "hallucination_threshold": 0.75
    },
    "v1.2": {
        "release_date": "2024-06-10",
        "knowledge_docs": ["kb-001", "kb-003", "kb-004"],
        "hallucination_threshold": 0.8
    },
    "v2.0": {
        "release_date": "2024-09-01",
        "knowledge_docs": ["kb-005", "kb-006", "kb-007"],
        "hallucination_threshold": 0.85
    },
    "v2.1": {
        "release_date": "2024-12-01",
        "knowledge_docs": ["kb-005", "kb-006", "kb-007", "kb-008"],
        "hallucination_threshold": 0.85
    }
}


class ConflictDetector:
    def __init__(self):
        self.conflicts: List[ConflictEvidence] = []
        self.history: List[HistoryRecord] = []

    def detect_conflicts(self, sample: SampleRecord) -> Optional[ConflictEvidence]:
        if sample.material_type == MaterialType.WRONG_STANDARD:
            return self._detect_wrong_standard_conflict(sample)

        return self._detect_version_link_conflict(sample)

    def _detect_version_link_conflict(self, sample: SampleRecord) -> Optional[ConflictEvidence]:
        prompt_meta = PROMPT_VERSION_METADATA.get(sample.prompt_version, {})
        allowed_docs = prompt_meta.get("knowledge_docs", [])

        link_doc_id = self._extract_doc_id(sample.knowledge_link)

        if link_doc_id and link_doc_id not in allowed_docs:
            description = (
                f"提示词版本【{sample.prompt_version}】要求使用知识库文档：{allowed_docs}，"
                f"但实际引用链接对应的文档是【{link_doc_id}】，不在允许列表内。"
            )
            evidence = ConflictEvidence(
                sample_id=sample.sample_id,
                conflict_type="提示词版本与知识库链接不匹配",
                prompt_evidence=f"版本 {sample.prompt_version} 允许的文档: {', '.join(allowed_docs)}",
                link_evidence=f"实际引用链接文档: {link_doc_id}",
                description=description
            )
            self.conflicts.append(evidence)
            return evidence

        return None

    def _detect_wrong_standard_conflict(self, sample: SampleRecord) -> Optional[ConflictEvidence]:
        description = (
            f"该样本标记为【错口径材料】，需要人工复核提示词版本【{sample.prompt_version}】"
            f"与知识库链接【{sample.knowledge_link}】的对应关系是否正确。"
        )
        evidence = ConflictEvidence(
            sample_id=sample.sample_id,
            conflict_type="错口径材料待复核",
            prompt_evidence=f"提示词版本: {sample.prompt_version}",
            link_evidence=f"知识库链接: {sample.knowledge_link}",
            description=description
        )
        self.conflicts.append(evidence)
        return evidence

    def _extract_doc_id(self, link: str) -> Optional[str]:
        if "kb-" in link.lower():
            import re
            match = re.search(r'kb-\d+', link, re.IGNORECASE)
            if match:
                return match.group(0).lower()
        return None

    def resolve_conflict(
        self,
        sample_id: str,
        resolution: str,
        operator: str,
        confirm: bool = True
    ) -> ConflictEvidence:
        conflict = self.get_conflict(sample_id)
        if not conflict:
            from errors import ConflictNotFoundError
            raise ConflictNotFoundError(sample_id)

        conflict.resolved = True
        conflict.resolution = "确认通过" if confirm else "驳回"
        conflict.resolved_by = operator

        self._add_history(
            sample_id,
            "处理冲突",
            SampleStatus.CONFLICT.value,
            SampleStatus.CONFIRMED.value if confirm else SampleStatus.REJECTED.value,
            operator,
            f"冲突处理结果：{conflict.resolution}，备注：{resolution}"
        )

        return conflict

    def get_conflict(self, sample_id: str) -> Optional[ConflictEvidence]:
        for c in self.conflicts:
            if c.sample_id == sample_id and not c.resolved:
                return c
        return None

    def get_all_conflicts(self, resolved: bool = None) -> List[ConflictEvidence]:
        if resolved is None:
            return self.conflicts.copy()
        return [c for c in self.conflicts if c.resolved == resolved]

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

    def get_history(self, sample_id: str = None) -> List[HistoryRecord]:
        if sample_id:
            return [h for h in self.history if h.sample_id == sample_id]
        return self.history.copy()
