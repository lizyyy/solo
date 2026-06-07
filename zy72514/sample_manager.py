import uuid
import hashlib
from datetime import datetime
from typing import List, Dict, Optional, Tuple
from collections import defaultdict

from schemas import (
    ViolationSample,
    OriginalAnnotation,
    SampleStatus,
    ChangeType,
    HistoryRecord,
    ManualEdit,
    ModelOutput,
    BoundaryRule,
)


class SampleManager:
    def __init__(self):
        self.samples: Dict[str, ViolationSample] = {}
        self.video_id_index: Dict[str, List[str]] = defaultdict(list)
        self.annotation_hash_index: Dict[str, str] = {}
        self.boundary_rules: List[BoundaryRule] = self._init_boundary_rules()

    def _init_boundary_rules(self) -> List[BoundaryRule]:
        return [
            BoundaryRule(
                rule_id="BR001",
                name="低置信度样本不自动判定",
                description="模型置信度低于0.6的样本，不能被平均指标覆盖，需留给知识库编辑复核",
                condition="model_output.confidence < 0.6",
                action="标记为LOW_CONFIDENCE，状态设为NEEDS_REVIEW，不可直接归为CONFIRMED_NORMAL",
                rollback_supported=True,
            ),
            BoundaryRule(
                rule_id="BR002",
                name="标注员留言结论不可直接照抄",
                description="标注负责人回看时，必须对比模型输出后才能确认结论，不能直接复制标注员留言",
                condition="manager_review without model_output comparison",
                action="强制进入MANAGER_REVIEWED状态，需添加模型输出后才能继续",
                rollback_supported=True,
            ),
            BoundaryRule(
                rule_id="BR003",
                name="重复导入去重规则",
                description="同一source_file + line_number的标注员留言不重复创建样本",
                condition="annotation_hash already exists",
                action="更新现有样本的历史记录，不创建新样本",
                rollback_supported=False,
            ),
            BoundaryRule(
                rule_id="BR004",
                name="错口径样本返工规则",
                description="标注口径错误的样本，需回滚到ANNOTATOR_IMPORTED状态重新标注",
                condition="annotation_caliber_error detected",
                action="状态回滚，保留所有历史记录供追溯",
                rollback_supported=True,
            ),
        ]

    def _compute_annotation_hash(self, source_file: str, line_number: int, raw_content: str) -> str:
        content = f"{source_file}:{line_number}:{raw_content.strip()}"
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    def _generate_sample_id(self) -> str:
        return f"SAMPLE-{uuid.uuid4().hex[:12].upper()}"

    def _generate_record_id(self) -> str:
        return f"REC-{uuid.uuid4().hex[:10].upper()}"

    def _snapshot_sample(self, sample: ViolationSample) -> Dict:
        return {
            "sample_id": sample.sample_id,
            "current_status": sample.current_status.value,
            "current_annotation": sample.current_annotation,
            "model_outputs_count": len(sample.model_outputs),
            "manager_notes": sample.manager_notes,
            "is_low_confidence": sample.is_low_confidence,
        }

    def _add_history_record(
        self,
        sample: ViolationSample,
        change_type: ChangeType,
        operator: str,
        before_snapshot: Dict,
        after_snapshot: Dict,
        manual_edits: Optional[List[ManualEdit]] = None,
        comment: Optional[str] = None,
    ) -> None:
        record = HistoryRecord(
            record_id=self._generate_record_id(),
            change_type=change_type,
            timestamp=datetime.now(),
            operator=operator,
            before_snapshot=before_snapshot,
            after_snapshot=after_snapshot,
            manual_edits=manual_edits or [],
            comment=comment,
        )
        sample.history.append(record)
        sample.updated_at = datetime.now()

    def import_annotator_message(
        self,
        source_file: str,
        line_number: int,
        raw_content: str,
        annotator_name: str,
        video_id: str,
        cover_image_url: str,
        conclusion: Optional[str] = None,
        operator: str = "system",
    ) -> Tuple[ViolationSample, bool]:
        annotation_hash = self._compute_annotation_hash(source_file, line_number, raw_content)

        if annotation_hash in self.annotation_hash_index:
            existing_sample = self.samples[self.annotation_hash_index[annotation_hash]]
            before = self._snapshot_sample(existing_sample)
            existing_sample.updated_at = datetime.now()
            after = self._snapshot_sample(existing_sample)
            self._add_history_record(
                existing_sample,
                ChangeType.COMMENT_ADD,
                operator,
                before,
                after,
                comment="重复导入检测：已存在相同标注员留言，仅更新时间戳",
            )
            return existing_sample, False

        original_annotation = OriginalAnnotation(
            line_number=line_number,
            raw_content=raw_content,
            annotator_name=annotator_name,
            import_timestamp=datetime.now(),
            source_file=source_file,
            conclusion=conclusion,
        )

        sample_id = self._generate_sample_id()
        sample = ViolationSample(
            sample_id=sample_id,
            cover_image_url=cover_image_url,
            video_id=video_id,
            current_status=SampleStatus.ANNOTATOR_IMPORTED,
            original_annotation=original_annotation,
            current_annotation=raw_content,
        )

        self.samples[sample_id] = sample
        self.video_id_index[video_id].append(sample_id)
        self.annotation_hash_index[annotation_hash] = sample_id

        before = {}
        after = self._snapshot_sample(sample)
        self._add_history_record(
            sample,
            ChangeType.STATUS_CHANGE,
            operator,
            before,
            after,
            comment=f"标注员留言首次导入，来源：{source_file} 第{line_number}行",
        )

        return sample, True

    def manager_review(
        self,
        sample_id: str,
        manager_name: str,
        manager_notes: Optional[str] = None,
        edited_annotation: Optional[str] = None,
    ) -> ViolationSample:
        sample = self.samples[sample_id]
        before = self._snapshot_sample(sample)

        manual_edits = []

        if edited_annotation and edited_annotation != sample.current_annotation:
            edit = ManualEdit(
                editor=manager_name,
                edit_timestamp=datetime.now(),
                field_changed="current_annotation",
                old_value=sample.current_annotation,
                new_value=edited_annotation,
                reason="标注负责人周姐回看修正",
            )
            manual_edits.append(edit)
            sample.current_annotation = edited_annotation

        if manager_notes:
            sample.manager_notes = manager_notes

        sample.current_status = SampleStatus.MANAGER_REVIEWED

        after = self._snapshot_sample(sample)
        self._add_history_record(
            sample,
            ChangeType.ANNOTATION_EDIT,
            manager_name,
            before,
            after,
            manual_edits=manual_edits,
            comment="标注负责人完成回看" if not manual_edits else "标注负责人完成回看并修正标注内容",
        )

        return sample

    def add_model_output(
        self,
        sample_id: str,
        version: str,
        violation_score: float,
        confidence: float,
        raw_fragment: str,
        operator: str,
        model_metadata: Optional[Dict] = None,
    ) -> ViolationSample:
        sample = self.samples[sample_id]
        before = self._snapshot_sample(sample)

        model_output = ModelOutput(
            version=version,
            timestamp=datetime.now(),
            violation_score=violation_score,
            confidence=confidence,
            raw_fragment=raw_fragment,
            model_metadata=model_metadata or {},
        )

        sample.model_outputs.append(model_output)

        if confidence < 0.6:
            sample.is_low_confidence = True
            sample.current_status = SampleStatus.LOW_CONFIDENCE
            comment = f"模型输出v{version}已添加，置信度{confidence:.2f}<0.6，标记为低置信度，需知识库编辑复核"
        else:
            if sample.current_status == SampleStatus.MANAGER_REVIEWED:
                sample.current_status = SampleStatus.MODEL_OUTPUT_ADDED
            comment = f"模型输出v{version}已添加"

        after = self._snapshot_sample(sample)
        self._add_history_record(
            sample,
            ChangeType.MODEL_OUTPUT_ADD,
            operator,
            before,
            after,
            comment=comment,
        )

        return sample

    def update_model_version(
        self,
        sample_id: str,
        old_version: str,
        new_version: str,
        new_violation_score: float,
        new_confidence: float,
        new_raw_fragment: str,
        operator: str,
        model_metadata: Optional[Dict] = None,
    ) -> ViolationSample:
        sample = self.samples[sample_id]
        before = self._snapshot_sample(sample)

        old_output = next((m for m in sample.model_outputs if m.version == old_version), None)
        if not old_output:
            raise ValueError(f"未找到版本为{old_version}的模型输出")

        manual_edits = [
            ManualEdit(
                editor=operator,
                edit_timestamp=datetime.now(),
                field_changed=f"model_output.{old_version}.version",
                old_value=old_version,
                new_value=new_version,
                reason="模型版本对比更新",
            ),
            ManualEdit(
                editor=operator,
                edit_timestamp=datetime.now(),
                field_changed=f"model_output.{old_version}.violation_score",
                old_value=old_output.violation_score,
                new_value=new_violation_score,
                reason="模型版本对比更新",
            ),
            ManualEdit(
                editor=operator,
                edit_timestamp=datetime.now(),
                field_changed=f"model_output.{old_version}.confidence",
                old_value=old_output.confidence,
                new_value=new_confidence,
                reason="模型版本对比更新",
            ),
        ]

        old_output.version = new_version
        old_output.violation_score = new_violation_score
        old_output.confidence = new_confidence
        old_output.raw_fragment = new_raw_fragment
        old_output.timestamp = datetime.now()
        if model_metadata:
            old_output.model_metadata.update(model_metadata)

        if new_confidence < 0.6:
            sample.is_low_confidence = True
            sample.current_status = SampleStatus.LOW_CONFIDENCE
            comment = f"模型版本从{old_version}更新到{new_version}，置信度{new_confidence:.2f}<0.6，标记为低置信度"
        else:
            sample.current_status = SampleStatus.MODEL_VERSION_UPDATED
            comment = f"模型版本从{old_version}更新到{new_version}"

        after = self._snapshot_sample(sample)
        self._add_history_record(
            sample,
            ChangeType.MODEL_VERSION_UPDATE,
            operator,
            before,
            after,
            manual_edits=manual_edits,
            comment=comment,
        )

        return sample

    def rollback_to_status(
        self,
        sample_id: str,
        target_status: SampleStatus,
        operator: str,
        reason: str,
    ) -> ViolationSample:
        sample = self.samples[sample_id]
        before = self._snapshot_sample(sample)

        sample.current_status = target_status

        after = self._snapshot_sample(sample)
        self._add_history_record(
            sample,
            ChangeType.ROLLBACK,
            operator,
            before,
            after,
            comment=f"回滚到{target_status.value}状态，原因：{reason}",
        )

        return sample

    def kb_editor_review(
        self,
        sample_id: str,
        editor_name: str,
        final_status: SampleStatus,
        kb_notes: Optional[str] = None,
    ) -> ViolationSample:
        sample = self.samples[sample_id]
        before = self._snapshot_sample(sample)

        if sample.is_low_confidence and final_status == SampleStatus.CONFIRMED_NORMAL:
            raise ValueError("低置信度样本不能直接判定为正常，需人工确认违规或继续观察")

        sample.current_status = final_status
        if kb_notes:
            sample.kb_editor_notes = kb_notes

        after = self._snapshot_sample(sample)
        self._add_history_record(
            sample,
            ChangeType.STATUS_CHANGE,
            editor_name,
            before,
            after,
            comment=f"知识库编辑完成复核，最终判定：{final_status.value}",
        )

        return sample

    def get_sample_history(self, sample_id: str) -> List[HistoryRecord]:
        return self.samples[sample_id].history

    def get_sample_by_id(self, sample_id: str) -> Optional[ViolationSample]:
        return self.samples.get(sample_id)

    def get_samples_by_status(self, status: SampleStatus) -> List[ViolationSample]:
        return [s for s in self.samples.values() if s.current_status == status]

    def get_low_confidence_samples(self) -> List[ViolationSample]:
        return [s for s in self.samples.values() if s.is_low_confidence]

    def get_stats(self) -> Dict:
        status_counts = defaultdict(int)
        for sample in self.samples.values():
            status_counts[sample.current_status.value] += 1

        return {
            "total_samples": len(self.samples),
            "low_confidence_count": len(self.get_low_confidence_samples()),
            "status_distribution": dict(status_counts),
            "total_history_records": sum(len(s.history) for s in self.samples.values()),
        }
