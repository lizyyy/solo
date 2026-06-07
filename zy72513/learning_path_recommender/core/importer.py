import hashlib
from typing import List, Dict, Any, Tuple
from datetime import datetime
from ..models import Recommendation, ImportRecord
from ..storage import JSONStorage
from ..audit import AuditLogger


class Importer:
    def __init__(self, storage: JSONStorage, audit_logger: AuditLogger):
        self.storage = storage
        self.audit = audit_logger

    def _compute_content_hash(self, content: str) -> str:
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    def import_model_outputs(
        self,
        items: List[Dict[str, Any]],
        batch_id: str,
        imported_by: str = "system",
        source_file: str = None,
    ) -> ImportRecord:
        record = ImportRecord(
            batch_id=batch_id,
            source_type="model_output",
            source_file=source_file,
            imported_by=imported_by,
            item_count=len(items),
        )

        new_count = 0
        duplicate_count = 0
        updated_count = 0
        item_ids = []

        for item in items:
            model_output_id = item.get("id") or item.get("model_output_id")
            content = item.get("content") or item.get("recommendation") or ""
            source_model_output = item.get("raw_content") or content

            if not model_output_id:
                model_output_id = self._compute_content_hash(content)

            existing = self.storage.find_recommendation_by_model_output_id(model_output_id)

            if existing:
                if existing.content == content:
                    duplicate_count += 1
                    item_ids.append(existing.id)
                    self.audit.log_duplicate_detection(
                        recommendation_id=existing.id,
                        batch_id=batch_id,
                        detected_by=imported_by,
                        reason="content_identical",
                    )
                    continue
                else:
                    existing.content = content
                    existing.source_model_output = source_model_output
                    existing.batch_id = batch_id
                    existing.updated_at = datetime.now()
                    existing.version += 1
                    self.storage.save_recommendation(existing)
                    updated_count += 1
                    item_ids.append(existing.id)
                    self.audit.log_recommendation_update(
                        recommendation_id=existing.id,
                        field="content",
                        old_value=None,
                        new_value=content,
                        updated_by=imported_by,
                        reason="model_output_update",
                        source_batch=batch_id,
                    )
            else:
                rec = Recommendation(
                    content=content,
                    source_model_output=source_model_output,
                    model_output_id=model_output_id,
                    batch_id=batch_id,
                    masking_status="pending",
                    review_status="pending",
                    version=1,
                    metadata={"import_source": "model_output", "content_hash": self._compute_content_hash(content)},
                )
                self.storage.save_recommendation(rec)
                new_count += 1
                item_ids.append(rec.id)
                self.audit.log_recommendation_create(
                    recommendation_id=rec.id,
                    created_by=imported_by,
                    source="model_output",
                    batch_id=batch_id,
                )

        record.new_count = new_count
        record.duplicate_count = duplicate_count
        record.updated_count = updated_count
        record.item_ids = item_ids
        record.status = "completed"
        self.storage.save_import_record(record)

        self.audit.log_import_complete(
            batch_id=batch_id,
            source_type="model_output",
            total=record.item_count,
            new=new_count,
            updated=updated_count,
            duplicates=duplicate_count,
            imported_by=imported_by,
        )

        return record

    def apply_manual_review(
        self,
        reviews: List[Dict[str, Any]],
        batch_id: str,
        applied_by: str = "xiaomeng",
    ) -> Tuple[int, int, int]:
        updated = 0
        not_found = 0
        unchanged = 0

        for review in reviews:
            model_output_id = review.get("model_output_id") or review.get("id")
            manual_content = review.get("review_content") or review.get("remark") or ""
            review_comment = review.get("comment")

            if not model_output_id:
                not_found += 1
                continue

            rec = self.storage.find_recommendation_by_model_output_id(model_output_id)
            if not rec:
                not_found += 1
                self.audit.log_warning(
                    message=f"Manual review skipped: recommendation not found for model_output_id={model_output_id}",
                    context={"batch_id": batch_id, "applied_by": applied_by},
                )
                continue

            old_content = rec.content
            old_manual_review = rec.source_manual_review

            content_changed = False
            if manual_content and rec.source_manual_review != manual_content:
                rec.source_manual_review = manual_content
                content_changed = True

            if review_comment and rec.review_comment != review_comment:
                rec.review_comment = review_comment
                content_changed = True

            rec.manual_review_id = review.get("review_id")
            rec.reviewer = applied_by
            rec.review_status = "reviewed"
            rec.updated_at = datetime.now()

            if content_changed:
                rec.version += 1
                self.storage.save_recommendation(rec)
                updated += 1
                self.audit.log_recommendation_update(
                    recommendation_id=rec.id,
                    field="manual_review",
                    old_value=old_manual_review,
                    new_value=manual_content,
                    updated_by=applied_by,
                    reason="manual_review_apply",
                    source_batch=batch_id,
                )
            else:
                unchanged += 1

        return updated, not_found, unchanged
