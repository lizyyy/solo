content = '''import hashlib
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime
from ..models import Recommendation, ImportRecord
from ..storage import JSONStorage
from ..audit import AuditLogger
from .version_manager import VersionManager


class Importer:
    def __init__(
        self,
        storage: JSONStorage,
        audit_logger: AuditLogger,
        version_manager: Optional[VersionManager] = None,
    ):
        self.storage = storage
        self.audit = audit_logger
        self.version_manager = version_manager

    def _compute_content_hash(self, content: str) -> str:
        return hashlib.sha256(content.encode("utf-8")).hexdigest()

    def _record_version_change(
        self,
        recommendation_id: str,
        field_name: str,
        old_value: Optional[str],
        new_value: Optional[str],
        changed_by: str,
        change_reason: str,
        source: str = None,
    ):
        if self.version_manager is not None:
            self.version_manager.record_change(
                recommendation_id=recommendation_id,
                field_name=field_name,
                old_value=old_value,
                new_value=new_value,
                changed_by=changed_by,
                change_reason=change_reason,
                source=source,
            )

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
                old_content = existing.content
                old_source = existing.source_model_output

                content_changed = old_content != content
                source_changed = old_source != source_model_output

                if not content_changed and not source_changed:
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
                        old_value=old_content,
                        new_value=content,
                        updated_by=imported_by,
                        reason="model_output_update",
                        source_batch=batch_id,
                    )

                    if content_changed:
                        self._record_version_change(
                            recommendation_id=existing.id,
                            field_name="content",
                            old_value=old_content,
                            new_value=content,
                            changed_by=imported_by,
                            change_reason="model_output_content_update",
                            source=f"model_output_batch:{batch_id}",
                        )
                    if source_changed:
                        self._record_version_change(
                            recommendation_id=existing.id,
                            field_name="source_model_output",
                            old_value=old_source,
                            new_value=source_model_output,
                            changed_by=imported_by,
                            change_reason="model_output_source_update",
                            source=f"model_output_batch:{batch_id}",
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

            old_manual_review = rec.source_manual_review
            old_review_comment = rec.review_comment
            old_review_status = rec.review_status
            old_reviewer = rec.reviewer

            manual_changed = bool(manual_content) and old_manual_review != manual_content
            comment_changed = bool(review_comment) and old_review_comment != review_comment

            if manual_content:
                rec.source_manual_review = manual_content
            if review_comment:
                rec.review_comment = review_comment

            rec.manual_review_id = review.get("review_id")
            rec.reviewer = applied_by
            rec.review_status = "reviewed"
            rec.updated_at = datetime.now()

            has_changes = manual_changed or comment_changed

            if has_changes:
                rec.version += 1

            self.storage.save_recommendation(rec)

            if has_changes:
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

                if manual_changed:
                    self._record_version_change(
                        recommendation_id=rec.id,
                        field_name="source_manual_review",
                        old_value=old_manual_review,
                        new_value=manual_content,
                        changed_by=applied_by,
                        change_reason="manual_review_content_update",
                        source=f"manual_review_batch:{batch_id}",
                    )

                if comment_changed:
                    self._record_version_change(
                        recommendation_id=rec.id,
                        field_name="review_comment",
                        old_value=old_review_comment,
                        new_value=review_comment,
                        changed_by=applied_by,
                        change_reason="manual_review_comment_update",
                        source=f"manual_review_batch:{batch_id}",
                    )
            else:
                unchanged += 1

            if old_review_status != rec.review_status:
                self._record_version_change(
                    recommendation_id=rec.id,
                    field_name="review_status",
                    old_value=old_review_status,
                    new_value=rec.review_status,
                    changed_by=applied_by,
                    change_reason="manual_review_status_update",
                    source=f"manual_review_batch:{batch_id}",
                )
                if not has_changes and rec.version == 1:
                    rec.version += 1
                    self.storage.save_recommendation(rec)

            if old_reviewer != rec.reviewer:
                self._record_version_change(
                    recommendation_id=rec.id,
                    field_name="reviewer",
                    old_value=old_reviewer,
                    new_value=rec.reviewer,
                    changed_by=applied_by,
                    change_reason="manual_review_reviewer_update",
                    source=f"manual_review_batch:{batch_id}",
                )

        return updated, not_found, unchanged
'''

with open('/Users/lzy/pro/solo/workspaces/zy72513/learning_path_recommender/core/importer.py', 'w', encoding='utf-8') as f:
    f.write(content)

import os
print(f"File written, size: {os.path.getsize('/Users/lzy/pro/solo/workspaces/zy72513/learning_path_recommender/core/importer.py')} bytes")
print(f"Lines: {len(content.splitlines())}")
