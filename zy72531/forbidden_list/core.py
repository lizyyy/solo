import re
import uuid
from datetime import datetime
from typing import List, Optional, Tuple
from urllib.parse import urlparse

from .models import (
    AnnotatorComment,
    ModelOutputFragment,
    ForbiddenRecord,
    ForbiddenStatus,
    RecordSource,
    ConflictSample,
    ConflictType,
    WorkflowState,
)


class ForbiddenListEngine:
    def __init__(self):
        self.annotator_comments: List[AnnotatorComment] = []
        self.model_outputs: List[ModelOutputFragment] = []
        self.forbidden_records: List[ForbiddenRecord] = []
        self.conflict_samples: List[ConflictSample] = []
        self.workflow_state = WorkflowState()
        self._known_bad_urls = set()
        self._known_good_urls = set()

    def _extract_keyword(self, text: str) -> str:
        patterns = [
            r'"([^"]+)"',
            r"'([^']+)'",
            r"【([^】]+)】",
            r"\[([^\]]+)\]",
            r"禁[推售][：:]\s*(\S+)",
            r"不[能得可]推荐\s*(\S+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1)
        words = text.split()
        return words[0] if words else "未识别关键词"

    def _extract_urls(self, text: str) -> List[str]:
        url_pattern = r'https?://[^\s<>"\'）)]+'
        return re.findall(url_pattern, text)

    def _simulate_url_check(self, url: str) -> bool:
        """模拟链接检查，返回True表示正常，False表示404"""
        if "404" in url or "broken" in url or "invalid" in url:
            return False
        if "example.com/good" in url:
            return True
        if url in self._known_bad_urls:
            return False
        if url in self._known_good_urls:
            return True
        return True

    def mark_url_as_bad(self, url: str):
        self._known_bad_urls.add(url)

    def mark_url_as_good(self, url: str):
        self._known_good_urls.add(url)

    def import_annotator_comment(
        self,
        content: str,
        annotator: str,
        reference_url: Optional[str] = None,
        product_id: Optional[str] = None,
        reason: Optional[str] = None,
    ) -> AnnotatorComment:
        comment = AnnotatorComment(
            id=str(uuid.uuid4())[:8],
            content=content,
            annotator=annotator,
            timestamp=datetime.now(),
            reference_url=reference_url,
            product_id=product_id,
            reason=reason,
        )
        self.annotator_comments.append(comment)
        return comment

    def import_model_output(
        self,
        content: str,
        model_version: str,
        source_task_id: str,
        matched_product_id: Optional[str] = None,
    ) -> ModelOutputFragment:
        fragment = ModelOutputFragment(
            id=str(uuid.uuid4())[:8],
            content=content,
            model_version=model_version,
            timestamp=datetime.now(),
            source_task_id=source_task_id,
            matched_product_id=matched_product_id,
        )
        self.model_outputs.append(fragment)
        return fragment

    def create_forbidden_record_from_comment(
        self, comment: AnnotatorComment
    ) -> ForbiddenRecord:
        keyword = self._extract_keyword(comment.content)
        urls = self._extract_urls(comment.content)
        reference_url = comment.reference_url or (urls[0] if urls else None)

        record = ForbiddenRecord(
            id=str(uuid.uuid4())[:8],
            keyword=keyword,
            status=ForbiddenStatus.PENDING,
            source=RecordSource.ANNOTATOR_COMMENT,
            created_at=datetime.now(),
            updated_at=datetime.now(),
            annotator_comment_id=comment.id,
            reference_url=reference_url,
        )
        record.add_history("从标注员留言创建", comment.annotator, comment.content)
        self.forbidden_records.append(record)
        self.workflow_state.records_processed += 1
        return record

    def check_links_and_update_status(self, record: ForbiddenRecord) -> ForbiddenStatus:
        if not record.reference_url:
            record.status = ForbiddenStatus.NORMAL
            record.add_history("无引用链接，标记正常通过", "系统")
            return record.status

        is_alive = self._simulate_url_check(record.reference_url)
        if not is_alive:
            record.link_404 = True
            record.status = ForbiddenStatus.LINK_404_PASSED
            record.add_history(
                "链接检查404", "系统", f"失效链接: {record.reference_url}"
            )
        else:
            record.status = ForbiddenStatus.NORMAL
            record.add_history("链接检查正常", "系统")
        return record.status

    def review_by_lead(
        self, record: ForbiddenRecord, operator: str, decision: str, note: str = ""
    ) -> ForbiddenStatus:
        if decision == "pass_normal":
            record.status = ForbiddenStatus.NORMAL
            record.add_history("标注负责人复核通过", operator, note)
        elif decision == "flag_404_for_pm":
            record.status = ForbiddenStatus.NEED_PM_REVIEW
            record.add_history(
                "标记404问题待产品经理复核", operator, f"原链接: {record.reference_url}"
            )
            self.workflow_state.pm_review_needed += 1
        elif decision == "reject":
            record.status = ForbiddenStatus.REJECTED
            record.add_history("标注负责人驳回", operator, note)
        return record.status

    def supplement_from_model_output(
        self, record: ForbiddenRecord, fragment: ModelOutputFragment, operator: str
    ) -> Tuple[ForbiddenRecord, Optional[ConflictSample]]:
        record.model_output_id = fragment.id
        record.add_history(
            "补录模型输出片段",
            operator,
            f"模型版本: {fragment.model_version}, 内容: {fragment.content[:50]}...",
        )

        old_keyword = record.keyword

        if "旧口径" in fragment.content or "废弃" in fragment.content:
            conflict = ConflictSample(
                id=str(uuid.uuid4())[:8],
                forbidden_record_id=record.id,
                conflict_type=ConflictType.OLD_CALIBER_FOUND,
                old_content=old_keyword,
                new_content=fragment.content,
                detected_at=datetime.now(),
            )
            self.conflict_samples.append(conflict)
            self.workflow_state.conflicts_found += 1
            record.status = ForbiddenStatus.CONFLICT
            record.conflict_note = f"从模型输出发现旧口径，原关键词: {old_keyword}"
            record.add_history(
                "检测到口径冲突",
                "系统",
                f"旧口径内容: {fragment.content[:50]}...",
            )
            return record, conflict

        record.status = ForbiddenStatus.SUPPLEMENTED
        return record, None

    def resolve_conflict(
        self,
        conflict: ConflictSample,
        operator: str,
        resolution: str,
        keep_new: bool = True,
    ):
        conflict.resolved = True
        conflict.resolved_by = operator
        conflict.resolved_at = datetime.now()
        conflict.resolution_note = resolution

        record = self._find_record_by_id(conflict.forbidden_record_id)
        if record:
            if keep_new:
                record.keyword = self._extract_keyword(conflict.new_content)
            record.status = ForbiddenStatus.SUPPLEMENTED
            record.add_history("冲突已解决", operator, resolution)

    def _find_record_by_id(self, record_id: str) -> Optional[ForbiddenRecord]:
        for r in self.forbidden_records:
            if r.id == record_id:
                return r
        return None

    def get_statistics(self) -> dict:
        status_counts = {}
        for r in self.forbidden_records:
            key = r.status.value
            status_counts[key] = status_counts.get(key, 0) + 1

        return {
            "总记录数": len(self.forbidden_records),
            "标注员留言数": len(self.annotator_comments),
            "模型输出片段数": len(self.model_outputs),
            "冲突样本数": len(self.conflict_samples),
            "状态分布": status_counts,
            "待产品经理复核数": self.workflow_state.pm_review_needed,
            "工作流步骤": self.workflow_state.step,
        }

    def run_full_workflow_step1_import(self, demo_data: dict) -> List[ForbiddenRecord]:
        self.workflow_state.step = 1
        self.workflow_state.current_operator = "标注员"
        records = []
        for item in demo_data.get("annotator_comments", []):
            comment = self.import_annotator_comment(**item)
            record = self.create_forbidden_record_from_comment(comment)
            self.check_links_and_update_status(record)
            records.append(record)
        return records

    def run_full_workflow_step2_review(
        self, operator: str, review_decisions: dict
    ) -> List[ForbiddenRecord]:
        self.workflow_state.step = 2
        self.workflow_state.current_operator = operator
        for record_id, decision in review_decisions.items():
            record = self._find_record_by_id(record_id)
            if record:
                self.review_by_lead(
                    record,
                    operator,
                    decision.get("decision", "pass_normal"),
                    decision.get("note", ""),
                )
        return self.forbidden_records

    def run_full_workflow_step3_supplement(
        self, operator: str, supplements: dict
    ) -> List[ConflictSample]:
        self.workflow_state.step = 3
        self.workflow_state.current_operator = operator
        new_conflicts = []
        for record_id, frag_data in supplements.items():
            record = self._find_record_by_id(record_id)
            if not record:
                continue
            fragment = self.import_model_output(**frag_data)
            _, conflict = self.supplement_from_model_output(record, fragment, operator)
            if conflict:
                new_conflicts.append(conflict)
        return new_conflicts
