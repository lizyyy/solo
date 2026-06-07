import uuid
import os
from datetime import datetime
from typing import List, Optional
from models import (
    GrayBatch, GrayRecord, AnnotationMessage, AlertResult,
    AlertStatus, DesensitizationStatus, EvidenceSource, DataStore
)
from .desensitization import DesensitizationChecker
from .knowledge_checker import KnowledgeChecker


class AlertProcessor:
    def __init__(self):
        self.store = DataStore()
        self.desens_checker = DesensitizationChecker()
        self.knowledge_checker = KnowledgeChecker()

    def _gen_id(self, prefix: str) -> str:
        return f"{prefix}_{uuid.uuid4().hex[:8]}"

    def process_batch(self, batch: GrayBatch, operator: str = "system") -> List[AlertResult]:
        results = []
        annotations = self.store.get_all_annotations()
        ann_map = {}
        for ann in annotations:
            key = (ann.session_id, ann.knowledge_id)
            ann_map[key] = ann

        for record in batch.records:
            result = self._process_record(batch.batch_id, record, ann_map, operator)
            results.append(result)
            self.store.save_result(result)

        batch.processed = True
        self.store.save_batch(batch)
        return results

    def _process_record(
        self,
        batch_id: str,
        record: GrayRecord,
        ann_map: dict,
        operator: str
    ) -> AlertResult:
        key = (record.session_id, record.knowledge_id)
        annotation = ann_map.get(key)

        result = AlertResult(
            result_id=self._gen_id("res"),
            batch_id=batch_id,
            session_id=record.session_id,
            knowledge_id=record.knowledge_id,
            original_question=record.original_question,
            current_answer=record.current_answer,
            processed_by=operator,
            processed_at=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        )

        desens_result = self.desens_checker.check_answer(record.current_answer)
        result.raw_phone_found = desens_result["raw_phones"]

        if annotation:
            result.annotation_remark = annotation.remark
            result.on_site_statement = annotation.on_site_statement
            result.evidence_source = EvidenceSource.BOTH

            ann_desens = self.desens_checker.check_answer(annotation.on_site_statement)
            if ann_desens["raw_phones"]:
                result.raw_phone_found.extend(ann_desens["raw_phones"])
        else:
            result.evidence_source = EvidenceSource.GRAY_BATCH

        if result.raw_phone_found:
            result.desensitization_status = DesensitizationStatus.PHONE_LEAKED
            result.alert_status = AlertStatus.NEED_REVIEW
            result.add_history("检测到手机号漏遮", operator, f"发现{len(result.raw_phone_found)}个未脱敏手机号: {result.raw_phone_found}")
        else:
            result.desensitization_status = DesensitizationStatus.PASSED

            combined_text = record.current_answer
            if annotation and annotation.on_site_statement:
                combined_text += " " + annotation.on_site_statement

            is_expired, reason = self.knowledge_checker.check_expired(
                record.current_answer,
                annotation.on_site_statement if annotation else ""
            )

            if is_expired:
                result.alert_status = AlertStatus.EXPIRED
                result.add_history("检测到知识过期", operator, reason)
            else:
                result.alert_status = AlertStatus.NORMAL
                result.add_history("首次检测通过", operator, "脱敏和知识口径均正常")

        return result

    def apply_annotation(self, result_id: str, annotation: AnnotationMessage, operator: str) -> AlertResult:
        result = self.store.get_result(result_id)
        if not result:
            raise ValueError(f"结果不存在: {result_id}")

        result.add_history("补录标注员留言", operator, f"标注员: {annotation.annotator}, 现场说法: {annotation.on_site_statement[:50]}...")
        result.annotation_remark = annotation.remark
        result.on_site_statement = annotation.on_site_statement
        result.evidence_source = EvidenceSource.BOTH

        ann_desens = self.desens_checker.check_answer(annotation.on_site_statement)
        if ann_desens["raw_phones"]:
            result.raw_phone_found.extend(ann_desens["raw_phones"])
            result.desensitization_status = DesensitizationStatus.PHONE_LEAKED
            result.alert_status = AlertStatus.NEED_REVIEW
            result.add_history("标注员留言中发现手机号", operator, f"新增{len(ann_desens['raw_phones'])}个手机号")
        else:
            is_expired, reason = self.knowledge_checker.check_expired(
                result.current_answer,
                annotation.on_site_statement
            )
            if is_expired:
                result.alert_status = AlertStatus.EXPIRED
                result.add_history("标注员留言触发过期预警", operator, reason)

        result.processed_by = operator
        result.processed_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        result.increment_version()
        self.store.save_result(result)

        annotation.reviewed_by = operator
        annotation.reviewed_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.store.save_annotation(annotation)

        return result

    def fix_masking(self, result_id: str, masked_answer: str, operator: str) -> AlertResult:
        result = self.store.get_result(result_id)
        if not result:
            raise ValueError(f"结果不存在: {result_id}")

        old_answer = result.current_answer
        result.current_answer = masked_answer
        result.desensitization_status = DesensitizationStatus.FIXED

        if result.alert_status == AlertStatus.NEED_REVIEW:
            is_expired, _ = self.knowledge_checker.check_expired(masked_answer, result.on_site_statement)
            if is_expired:
                result.alert_status = AlertStatus.EXPIRED
            else:
                result.alert_status = AlertStatus.NORMAL

        result.add_history("修复脱敏", operator, f"从 '{old_answer[:30]}...' 更新为脱敏版本")
        result.processed_by = operator
        result.processed_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        result.increment_version()
        self.store.save_result(result)
        return result

    def update_knowledge(self, result_id: str, new_answer: str, operator: str) -> AlertResult:
        result = self.store.get_result(result_id)
        if not result:
            raise ValueError(f"结果不存在: {result_id}")

        old_answer = result.current_answer
        result.current_answer = new_answer
        result.alert_status = AlertStatus.UPDATED

        desens_result = self.desens_checker.check_answer(new_answer)
        if desens_result["raw_phones"]:
            result.raw_phone_found = desens_result["raw_phones"]
            result.desensitization_status = DesensitizationStatus.PHONE_LEAKED
            result.alert_status = AlertStatus.NEED_REVIEW
        else:
            result.desensitization_status = DesensitizationStatus.PASSED

        result.add_history("更新口径", operator, f"旧口径: {old_answer[:30]}... -> 新口径: {new_answer[:30]}...")
        result.processed_by = operator
        result.processed_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        result.increment_version()
        self.store.save_result(result)
        return result

    def rework_record(self, result_id: str, new_answer: str, annotation: AnnotationMessage, operator: str) -> AlertResult:
        result = self.store.get_result(result_id)
        if not result:
            raise ValueError(f"结果不存在: {result_id}")

        old_status = result.alert_status.value
        result.current_answer = new_answer
        result.on_site_statement = annotation.on_site_statement
        result.annotation_remark = annotation.remark
        result.evidence_source = EvidenceSource.BOTH
        result.alert_status = AlertStatus.REWORKED

        desens_result = self.desens_checker.check_answer(new_answer)
        if desens_result["raw_phones"]:
            result.raw_phone_found = desens_result["raw_phones"]
            result.desensitization_status = DesensitizationStatus.PHONE_LEAKED
            result.alert_status = AlertStatus.NEED_REVIEW
        else:
            result.desensitization_status = DesensitizationStatus.PASSED

        result.add_history(
            "返工处理",
            operator,
            f"原状态: {old_status}, 标注员: {annotation.annotator}, 现场说法补充后重新判定"
        )
        result.processed_by = operator
        result.processed_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        result.increment_version()
        self.store.save_result(result)

        annotation.reviewed_by = operator
        annotation.reviewed_at = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        self.store.save_annotation(annotation)

        return result

    def rerun_batch(self, batch_id: str, operator: str) -> List[AlertResult]:
        batch = self.store.get_batch(batch_id)
        if not batch:
            raise ValueError(f"批次不存在: {batch_id}")

        old_results = self.store.get_results_by_batch(batch_id)
        old_map = {r.session_id + r.knowledge_id: r for r in old_results}

        all_results = self.store.get_all_results()
        other_results = [r for r in all_results if r.batch_id != batch_id]

        import json
        from config import DATA_DIR
        results_file = os.path.join(DATA_DIR, "results.json")
        other_data = []
        from .alert_result import AlertStatus, DesensitizationStatus, EvidenceSource
        for r in other_results:
            other_data.append({
                "result_id": r.result_id,
                "batch_id": r.batch_id,
                "session_id": r.session_id,
                "knowledge_id": r.knowledge_id,
                "original_question": r.original_question,
                "current_answer": r.current_answer,
                "annotation_remark": r.annotation_remark,
                "on_site_statement": r.on_site_statement,
                "alert_status": r.alert_status.value,
                "desensitization_status": r.desensitization_status.value,
                "evidence_source": r.evidence_source.value,
                "processed_by": r.processed_by,
                "processed_at": r.processed_at,
                "version": r.version,
                "history": r.history,
                "raw_phone_found": r.raw_phone_found,
                "created_at": r.created_at
            })

        batch.processed = False
        new_results = self.process_batch(batch, operator)

        final_results = []
        for new_r in new_results:
            old_r = old_map.get(new_r.session_id + new_r.knowledge_id)
            if old_r:
                new_r.result_id = old_r.result_id
                new_r.version = old_r.version + 1
                new_r.history = old_r.history + new_r.history
                new_r.add_history("重跑批次", operator, f"批次重跑，版本从v{old_r.version}更新到v{new_r.version}")
                if old_r.on_site_statement and not new_r.on_site_statement:
                    new_r.on_site_statement = old_r.on_site_statement
                    new_r.annotation_remark = old_r.annotation_remark
                    new_r.evidence_source = old_r.evidence_source
            final_results.append(new_r)

        final_data = other_data
        from .alert_result import AlertStatus, DesensitizationStatus, EvidenceSource
        for r in final_results:
            final_data.append({
                "result_id": r.result_id,
                "batch_id": r.batch_id,
                "session_id": r.session_id,
                "knowledge_id": r.knowledge_id,
                "original_question": r.original_question,
                "current_answer": r.current_answer,
                "annotation_remark": r.annotation_remark,
                "on_site_statement": r.on_site_statement,
                "alert_status": r.alert_status.value if hasattr(r.alert_status, 'value') else r.alert_status,
                "desensitization_status": r.desensitization_status.value if hasattr(r.desensitization_status, 'value') else r.desensitization_status,
                "evidence_source": r.evidence_source.value if hasattr(r.evidence_source, 'value') else r.evidence_source,
                "processed_by": r.processed_by,
                "processed_at": r.processed_at,
                "version": r.version,
                "history": r.history,
                "raw_phone_found": r.raw_phone_found,
                "created_at": r.created_at
            })

        with open(results_file, 'w', encoding='utf-8') as fp:
            json.dump(final_data, fp, ensure_ascii=False, indent=2)

        return final_results
