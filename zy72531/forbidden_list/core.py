import re
import uuid
import json
from datetime import datetime
from typing import List, Optional, Tuple, Dict, Any
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
    ActionType,
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
            r"最新口径应为[：:]\s*[\"\']?([^\"\',，]+)",
            r"应为[：:]\s*[\"\']?([^\"\',，]+)",
        ]
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()
        words = text.split()
        return words[0] if words else "未识别关键词"

    def _extract_urls(self, text: str) -> List[str]:
        url_pattern = r'https?://[^\s<>"\'）)]+'
        return re.findall(url_pattern, text)

    def _simulate_url_check(self, url: str) -> bool:
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
            confirm_reason=comment.reason,
        )
        record.add_history(
            action="从标注员留言创建",
            operator=comment.annotator,
            note=comment.content,
            before_status=None,
            after_status=ForbiddenStatus.PENDING.value,
            annotator_comment_id=comment.id,
            product_id=comment.product_id,
        )
        self.forbidden_records.append(record)
        self.workflow_state.records_processed += 1
        return record

    def check_links_and_update_status(self, record: ForbiddenRecord) -> ForbiddenStatus:
        before = record.status.value
        if not record.reference_url:
            record.status = ForbiddenStatus.NORMAL
            record.add_history(
                action="链接检查",
                operator="系统",
                note="无引用链接，标记正常通过",
                before_status=before,
                after_status=record.status.value,
            )
            return record.status

        is_alive = self._simulate_url_check(record.reference_url)
        if not is_alive:
            record.link_404 = True
            record.status = ForbiddenStatus.LINK_404_PASSED
            record.add_history(
                action="链接检查",
                operator="系统",
                note=f"失效链接: {record.reference_url}",
                before_status=before,
                after_status=record.status.value,
                reference_url=record.reference_url,
            )
        else:
            record.status = ForbiddenStatus.NORMAL
            record.add_history(
                action="链接检查",
                operator="系统",
                note=f"链接正常: {record.reference_url}",
                before_status=before,
                after_status=record.status.value,
                reference_url=record.reference_url,
            )
        return record.status

    def review_by_lead(
        self,
        record: ForbiddenRecord,
        operator: str,
        decision: str,
        note: str = "",
        confirm_reason: Optional[str] = None,
        reject_reason: Optional[str] = None,
    ) -> ForbiddenStatus:
        before = record.status.value
        if decision == "pass_normal":
            record.status = ForbiddenStatus.NORMAL
            record.confirm_reason = confirm_reason or note
            record.add_history(
                action="标注负责人复核通过",
                operator=operator,
                note=note,
                before_status=before,
                after_status=record.status.value,
                confirm_reason=confirm_reason,
            )
        elif decision == "flag_404_for_pm":
            record.status = ForbiddenStatus.NEED_PM_REVIEW
            record.pm_review_note = note
            record.add_history(
                action="标注负责人转产品经理复核",
                operator=operator,
                note=note,
                before_status=before,
                after_status=record.status.value,
                broken_url=record.reference_url,
                confirm_reason=confirm_reason,
            )
            self.workflow_state.pm_review_needed += 1
        elif decision == "reject":
            record.status = ForbiddenStatus.REJECTED
            record.reject_reason = reject_reason or note
            record.add_history(
                action="标注负责人驳回",
                operator=operator,
                note=note,
                before_status=before,
                after_status=record.status.value,
                reject_reason=reject_reason,
            )
        return record.status

    def supplement_from_model_output(
        self, record: ForbiddenRecord, fragment: ModelOutputFragment, operator: str
    ) -> Tuple[ForbiddenRecord, Optional[ConflictSample]]:
        before = record.status.value
        record.model_output_id = fragment.id
        record.add_history(
            action="补录模型输出片段",
            operator=operator,
            note=fragment.content,
            before_status=before,
            after_status=None,
            model_output_id=fragment.id,
            model_version=fragment.model_version,
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
                action="检测到口径冲突",
                operator="系统",
                note=record.conflict_note,
                before_status=before,
                after_status=record.status.value,
                conflict_sample_id=conflict.id,
                old_keyword=old_keyword,
            )
            return record, conflict

        record.status = ForbiddenStatus.SUPPLEMENTED
        record.add_history(
            action="补录完成无冲突",
            operator=operator,
            note="模型输出与原口径一致，无冲突",
            before_status=before,
            after_status=record.status.value,
        )
        return record, None

    def manual_correct(
        self,
        record: ForbiddenRecord,
        operator: str,
        new_keyword: Optional[str] = None,
        new_reference_url: Optional[str] = None,
        note: str = "",
        confirm_reason: Optional[str] = None,
    ) -> ForbiddenRecord:
        before = record.status.value
        old_keyword = record.keyword
        old_url = record.reference_url
        if new_keyword:
            record.keyword = new_keyword
            record.resolved_keyword = new_keyword
        if new_reference_url:
            record.reference_url = new_reference_url
        record.status = ForbiddenStatus.SUPPLEMENTED
        record.add_history(
            action="人工修正",
            operator=operator,
            note=note,
            before_status=before,
            after_status=record.status.value,
            old_keyword=old_keyword,
            new_keyword=new_keyword,
            old_reference_url=old_url,
            new_reference_url=new_reference_url,
            confirm_reason=confirm_reason,
        )
        self.workflow_state.manual_corrections += 1
        return record

    def resolve_conflict(
        self,
        conflict: ConflictSample,
        operator: str,
        resolution: str,
        keep_new: bool = True,
        confirm_reason: Optional[str] = None,
        reject_reason: Optional[str] = None,
    ):
        conflict.resolved = True
        conflict.resolved_by = operator
        conflict.resolved_at = datetime.now()
        conflict.resolution_note = resolution
        conflict.confirm_reason = confirm_reason
        conflict.reject_reason = reject_reason

        record = self._find_record_by_id(conflict.forbidden_record_id)
        if record:
            before = record.status.value
            if keep_new:
                new_keyword = self._extract_keyword(conflict.new_content)
                record.resolved_keyword = new_keyword
                record.keyword = new_keyword
            record.status = ForbiddenStatus.SUPPLEMENTED
            record.add_history(
                action="冲突已解决",
                operator=operator,
                note=resolution,
                before_status=before,
                after_status=record.status.value,
                conflict_sample_id=conflict.id,
                keep_new_keyword=keep_new,
                confirm_reason=confirm_reason,
                reject_reason=reject_reason,
            )

    def pm_review(
        self,
        record: ForbiddenRecord,
        operator: str,
        decision: str,
        reason: str,
    ) -> ForbiddenStatus:
        before = record.status.value
        if decision == "approve":
            record.status = ForbiddenStatus.PM_APPROVED
            record.pm_review_note = f"PM通过: {reason}"
            record.confirm_reason = reason
            record.add_history(
                action="产品经理复核通过",
                operator=operator,
                note=reason,
                before_status=before,
                after_status=record.status.value,
                confirm_reason=reason,
            )
            if self.workflow_state.pm_review_needed > 0:
                self.workflow_state.pm_review_needed -= 1
        elif decision == "reject":
            record.status = ForbiddenStatus.PM_REJECTED
            record.pm_review_note = f"PM驳回: {reason}"
            record.reject_reason = reason
            record.add_history(
                action="产品经理驳回",
                operator=operator,
                note=reason,
                before_status=before,
                after_status=record.status.value,
                reject_reason=reason,
            )
            if self.workflow_state.pm_review_needed > 0:
                self.workflow_state.pm_review_needed -= 1
        return record.status

    def rerun_record(
        self,
        record: ForbiddenRecord,
        operator: str,
        note: str = "",
    ) -> ForbiddenRecord:
        before = record.status.value
        record.rerun_count += 1
        record.last_rerun_at = datetime.now()
        record.status = ForbiddenStatus.RERUN

        original_comment = self._find_comment_by_id(record.annotator_comment_id)
        annotator_content = original_comment.content if original_comment else "未知"

        if record.link_404 and record.reference_url:
            is_alive = self._simulate_url_check(record.reference_url)
            link_result = "仍404" if not is_alive else "已恢复"
        else:
            link_result = "无链接/正常"

        record.add_history(
            action="执行重跑",
            operator=operator,
            note=note,
            before_status=before,
            after_status=record.status.value,
            rerun_number=record.rerun_count,
            link_recheck_result=link_result,
            original_annotator_comment=annotator_content,
        )

        if record.conflict_note:
            record.add_history(
                action="重跑结果生效",
                operator=operator,
                note=f"重跑第{record.rerun_count}次，已重新核对口径",
                before_status=record.status.value,
                after_status=ForbiddenStatus.SUPPLEMENTED.value,
                rerun_number=record.rerun_count,
            )
            record.status = ForbiddenStatus.SUPPLEMENTED

        self.workflow_state.rerun_executed += 1
        return record

    def _find_record_by_id(self, record_id: str) -> Optional[ForbiddenRecord]:
        for r in self.forbidden_records:
            if r.id == record_id:
                return r
        return None

    def _find_comment_by_id(self, comment_id: Optional[str]) -> Optional[AnnotatorComment]:
        if not comment_id:
            return None
        for c in self.annotator_comments:
            if c.id == comment_id:
                return c
        return None

    def _find_fragment_by_id(self, frag_id: Optional[str]) -> Optional[ModelOutputFragment]:
        if not frag_id:
            return None
        for f in self.model_outputs:
            if f.id == frag_id:
                return f
        return None

    def _find_conflicts_by_record_id(self, record_id: str) -> List[ConflictSample]:
        return [c for c in self.conflict_samples if c.forbidden_record_id == record_id]

    def get_record_detail(self, record_id: str) -> Optional[Dict[str, Any]]:
        record = self._find_record_by_id(record_id)
        if not record:
            return None
        comment = self._find_comment_by_id(record.annotator_comment_id)
        fragment = self._find_fragment_by_id(record.model_output_id)
        conflicts = self._find_conflicts_by_record_id(record.id)

        return {
            "record": {
                "id": record.id,
                "keyword": record.keyword,
                "resolved_keyword": record.resolved_keyword,
                "status": record.status.value,
                "source": record.source.value,
                "reference_url": record.reference_url,
                "link_404": record.link_404,
                "conflict_note": record.conflict_note,
                "pm_review_note": record.pm_review_note,
                "confirm_reason": record.confirm_reason,
                "reject_reason": record.reject_reason,
                "rerun_count": record.rerun_count,
                "last_rerun_at": record.last_rerun_at.isoformat() if record.last_rerun_at else None,
                "created_at": record.created_at.isoformat(),
                "updated_at": record.updated_at.isoformat(),
            },
            "annotator_comment": {
                "id": comment.id,
                "content": comment.content,
                "annotator": comment.annotator,
                "reason": comment.reason,
                "product_id": comment.product_id,
                "timestamp": comment.timestamp.isoformat(),
            } if comment else None,
            "model_output": {
                "id": fragment.id,
                "content": fragment.content,
                "model_version": fragment.model_version,
                "source_task_id": fragment.source_task_id,
                "timestamp": fragment.timestamp.isoformat(),
            } if fragment else None,
            "conflicts": [
                {
                    "id": c.id,
                    "type": c.conflict_type.value,
                    "old_content": c.old_content,
                    "new_content": c.new_content,
                    "resolved": c.resolved,
                    "resolution_note": c.resolution_note,
                    "resolved_by": c.resolved_by,
                    "confirm_reason": c.confirm_reason,
                    "reject_reason": c.reject_reason,
                }
                for c in conflicts
            ],
            "history": list(reversed(record.history)),
        }

    def get_record_history(self, record_id: str) -> Optional[List[Dict]]:
        record = self._find_record_by_id(record_id)
        if not record:
            return None
        return list(reversed(record.history))

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
            "已解决冲突数": len([c for c in self.conflict_samples if c.resolved]),
            "状态分布": status_counts,
            "待产品经理复核数": self.workflow_state.pm_review_needed,
            "人工修正次数": self.workflow_state.manual_corrections,
            "重跑执行次数": self.workflow_state.rerun_executed,
            "工作流步骤": self.workflow_state.step,
            "当前操作人": self.workflow_state.current_operator,
        }

    def generate_report(self) -> Dict[str, Any]:
        stats = self.get_statistics()
        record_summaries = []
        for r in self.forbidden_records:
            comment = self._find_comment_by_id(r.annotator_comment_id)
            record_summaries.append({
                "id": r.id,
                "keyword": r.keyword,
                "status": r.status.value,
                "source": r.source.value,
                "link_404": r.link_404,
                "reference_url": r.reference_url,
                "annotator": comment.annotator if comment else "未知",
                "rerun_count": r.rerun_count,
                "has_conflict": r.conflict_note is not None,
                "confirm_reason": r.confirm_reason,
                "reject_reason": r.reject_reason,
            })

        return {
            "生成时间": datetime.now().isoformat(),
            "统计概览": stats,
            "记录明细": record_summaries,
            "冲突样本表": [
                {
                    "id": c.id,
                    "forbidden_record_id": c.forbidden_record_id,
                    "type": c.conflict_type.value,
                    "old_content": c.old_content,
                    "new_content": c.new_content,
                    "resolved": c.resolved,
                    "resolution_note": c.resolution_note,
                    "resolved_by": c.resolved_by,
                    "confirm_reason": c.confirm_reason,
                }
                for c in self.conflict_samples
            ],
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
                    confirm_reason=decision.get("confirm_reason"),
                    reject_reason=decision.get("reject_reason"),
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

    def run_full_workflow_step4_manual_correct(
        self, operator: str, corrections: dict
    ) -> List[ForbiddenRecord]:
        self.workflow_state.step = 4
        self.workflow_state.current_operator = operator
        corrected = []
        for record_id, corr_data in corrections.items():
            record = self._find_record_by_id(record_id)
            if not record:
                continue
            r = self.manual_correct(
                record,
                operator,
                new_keyword=corr_data.get("new_keyword"),
                new_reference_url=corr_data.get("new_reference_url"),
                note=corr_data.get("note", ""),
                confirm_reason=corr_data.get("confirm_reason"),
            )
            corrected.append(r)
            if "resolve_conflict_id" in corr_data:
                conflict = next(
                    (c for c in self.conflict_samples if c.id == corr_data["resolve_conflict_id"]),
                    None
                )
                if conflict:
                    self.resolve_conflict(
                        conflict,
                        operator,
                        corr_data.get("resolution", "人工修正解决冲突"),
                        keep_new=corr_data.get("keep_new", True),
                        confirm_reason=corr_data.get("confirm_reason"),
                    )
        return corrected

    def run_full_workflow_step5_rerun(
        self, operator: str, rerun_record_ids: List[str]
    ) -> List[ForbiddenRecord]:
        self.workflow_state.step = 5
        self.workflow_state.current_operator = operator
        rerun_records = []
        for rid in rerun_record_ids:
            record = self._find_record_by_id(rid)
            if record:
                self.rerun_record(record, operator, note="工作流第五步：自动重跑验证")
                rerun_records.append(record)
        return rerun_records
