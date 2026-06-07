import json
import os
from typing import Dict, List, Optional
from config import DATA_DIR
from .gray_batch import GrayBatch, GrayRecord
from .annotation import AnnotationMessage
from .alert_result import AlertResult


class DataStore:
    def __init__(self):
        self.batches_file = os.path.join(DATA_DIR, "batches.json")
        self.annotations_file = os.path.join(DATA_DIR, "annotations.json")
        self.results_file = os.path.join(DATA_DIR, "results.json")
        self._ensure_files()

    def _ensure_files(self):
        for f in [self.batches_file, self.annotations_file, self.results_file]:
            if not os.path.exists(f):
                with open(f, 'w', encoding='utf-8') as fp:
                    json.dump([], fp, ensure_ascii=False, indent=2)

    def _load(self, filepath: str) -> List[dict]:
        with open(filepath, 'r', encoding='utf-8') as fp:
            return json.load(fp)

    def _save(self, filepath: str, data: List[dict]):
        with open(filepath, 'w', encoding='utf-8') as fp:
            json.dump(data, fp, ensure_ascii=False, indent=2)

    def save_batch(self, batch: GrayBatch):
        data = self._load(self.batches_file)
        batch_dict = {
            "batch_id": batch.batch_id,
            "name": batch.name,
            "records": [
                {
                    "session_id": r.session_id,
                    "knowledge_id": r.knowledge_id,
                    "original_question": r.original_question,
                    "current_answer": r.current_answer,
                    "status": r.status,
                    "raw_text": r.raw_text,
                    "created_at": r.created_at
                } for r in batch.records
            ],
            "created_by": batch.created_by,
            "created_at": batch.created_at,
            "processed": batch.processed
        }
        existing = next((i for i, b in enumerate(data) if b["batch_id"] == batch.batch_id), None)
        if existing is not None:
            data[existing] = batch_dict
        else:
            data.append(batch_dict)
        self._save(self.batches_file, data)

    def get_batch(self, batch_id: str) -> Optional[GrayBatch]:
        data = self._load(self.batches_file)
        for b in data:
            if b["batch_id"] == batch_id:
                records = [GrayRecord(**r) for r in b["records"]]
                return GrayBatch(
                    batch_id=b["batch_id"],
                    name=b["name"],
                    records=records,
                    created_by=b["created_by"],
                    created_at=b["created_at"],
                    processed=b["processed"]
                )
        return None

    def get_all_batches(self) -> List[GrayBatch]:
        data = self._load(self.batches_file)
        batches = []
        for b in data:
            records = [GrayRecord(**r) for r in b["records"]]
            batches.append(GrayBatch(
                batch_id=b["batch_id"],
                name=b["name"],
                records=records,
                created_by=b["created_by"],
                created_at=b["created_at"],
                processed=b["processed"]
            ))
        return batches

    def save_annotation(self, annotation: AnnotationMessage):
        data = self._load(self.annotations_file)
        ann_dict = {
            "annotation_id": annotation.annotation_id,
            "session_id": annotation.session_id,
            "knowledge_id": annotation.knowledge_id,
            "annotator": annotation.annotator,
            "on_site_statement": annotation.on_site_statement,
            "old_answer": annotation.old_answer,
            "remark": annotation.remark,
            "created_at": annotation.created_at,
            "reviewed_by": annotation.reviewed_by,
            "reviewed_at": annotation.reviewed_at
        }
        existing = next((i for i, a in enumerate(data) if a["annotation_id"] == annotation.annotation_id), None)
        if existing is not None:
            data[existing] = ann_dict
        else:
            data.append(ann_dict)
        self._save(self.annotations_file, data)

    def get_annotations_by_session(self, session_id: str) -> List[AnnotationMessage]:
        data = self._load(self.annotations_file)
        results = []
        for a in data:
            if a["session_id"] == session_id:
                results.append(AnnotationMessage(**a))
        return results

    def get_all_annotations(self) -> List[AnnotationMessage]:
        data = self._load(self.annotations_file)
        return [AnnotationMessage(**a) for a in data]

    def save_result(self, result: AlertResult):
        data = self._load(self.results_file)
        result_dict = {
            "result_id": result.result_id,
            "batch_id": result.batch_id,
            "session_id": result.session_id,
            "knowledge_id": result.knowledge_id,
            "original_question": result.original_question,
            "current_answer": result.current_answer,
            "annotation_remark": result.annotation_remark,
            "on_site_statement": result.on_site_statement,
            "alert_status": result.alert_status.value if hasattr(result.alert_status, 'value') else result.alert_status,
            "desensitization_status": result.desensitization_status.value if hasattr(result.desensitization_status, 'value') else result.desensitization_status,
            "evidence_source": result.evidence_source.value if hasattr(result.evidence_source, 'value') else result.evidence_source,
            "processed_by": result.processed_by,
            "processed_at": result.processed_at,
            "version": result.version,
            "history": result.history,
            "raw_phone_found": result.raw_phone_found,
            "created_at": result.created_at
        }
        existing = next((i for i, r in enumerate(data) if r["result_id"] == result.result_id), None)
        if existing is not None:
            data[existing] = result_dict
        else:
            data.append(result_dict)
        self._save(self.results_file, data)

    def get_results_by_batch(self, batch_id: str) -> List[AlertResult]:
        data = self._load(self.results_file)
        results = []
        for r in data:
            if r["batch_id"] == batch_id:
                from .alert_result import AlertStatus, DesensitizationStatus, EvidenceSource
                r["alert_status"] = AlertStatus(r["alert_status"])
                r["desensitization_status"] = DesensitizationStatus(r["desensitization_status"])
                r["evidence_source"] = EvidenceSource(r["evidence_source"])
                results.append(AlertResult(**r))
        return results

    def get_result(self, result_id: str) -> Optional[AlertResult]:
        data = self._load(self.results_file)
        for r in data:
            if r["result_id"] == result_id:
                from .alert_result import AlertStatus, DesensitizationStatus, EvidenceSource
                r["alert_status"] = AlertStatus(r["alert_status"])
                r["desensitization_status"] = DesensitizationStatus(r["desensitization_status"])
                r["evidence_source"] = EvidenceSource(r["evidence_source"])
                return AlertResult(**r)
        return None

    def get_all_results(self) -> List[AlertResult]:
        data = self._load(self.results_file)
        results = []
        from .alert_result import AlertStatus, DesensitizationStatus, EvidenceSource
        for r in data:
            r["alert_status"] = AlertStatus(r["alert_status"])
            r["desensitization_status"] = DesensitizationStatus(r["desensitization_status"])
            r["evidence_source"] = EvidenceSource(r["evidence_source"])
            results.append(AlertResult(**r))
        return results

    def clear_all(self):
        for f in [self.batches_file, self.annotations_file, self.results_file]:
            with open(f, 'w', encoding='utf-8') as fp:
                json.dump([], fp, ensure_ascii=False, indent=2)
