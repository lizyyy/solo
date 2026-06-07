from typing import List, Dict, Any, Tuple
from datetime import datetime
from ..core import Importer, VersionManager, MaskingEngine
from ..audit import AuditLogger
from ..storage import JSONStorage


class ThreeStepWorkflow:
    def __init__(self, storage: JSONStorage):
        self.storage = storage
        self.audit = AuditLogger(storage)
        self.importer = Importer(storage, self.audit)
        self.version_manager = VersionManager(storage, self.audit)
        self.masking_engine = MaskingEngine(storage, self.audit)

    def step1_import_model_outputs(
        self,
        items: List[Dict[str, Any]],
        batch_id: str,
        imported_by: str = "system",
        source_file: str = None,
    ) -> Dict[str, Any]:
        self.audit.log_workflow_step(
            workflow_name="three_step",
            step_name="step1_import_model_outputs",
            status="started",
            operator=imported_by,
            context={"batch_id": batch_id, "item_count": len(items)},
        )

        import_record = self.importer.import_model_outputs(
            items=items,
            batch_id=batch_id,
            imported_by=imported_by,
            source_file=source_file,
        )

        for rec_id in import_record.item_ids:
            self.masking_engine.process_recommendation(
                recommendation_id=rec_id,
                processed_by=imported_by,
                auto_fix=False,
            )

        result = {
            "step": 1,
            "name": "import_model_outputs",
            "batch_id": batch_id,
            "import_record": import_record.to_dict(),
            "item_ids": import_record.item_ids,
        }

        self.audit.log_workflow_step(
            workflow_name="three_step",
            step_name="step1_import_model_outputs",
            status="completed",
            operator=imported_by,
            context=result,
        )

        return result

    def step2_apply_manual_reviews(
        self,
        reviews: List[Dict[str, Any]],
        batch_id: str,
        applied_by: str = "xiaomeng",
    ) -> Dict[str, Any]:
        self.audit.log_workflow_step(
            workflow_name="three_step",
            step_name="step2_apply_manual_reviews",
            status="started",
            operator=applied_by,
            context={"batch_id": batch_id, "review_count": len(reviews)},
        )

        updated, not_found, unchanged = self.importer.apply_manual_review(
            reviews=reviews,
            batch_id=batch_id,
            applied_by=applied_by,
        )

        recs = self.storage.list_recommendations(batch_id=batch_id)
        rec_ids = [r.id for r in recs]

        for rec_id in rec_ids:
            rec = self.storage.get_recommendation(rec_id)
            if rec and rec.review_status == "reviewed":
                self.masking_engine.process_recommendation(
                    recommendation_id=rec_id,
                    processed_by=applied_by,
                    auto_fix=False,
                )

        result = {
            "step": 2,
            "name": "apply_manual_reviews",
            "batch_id": batch_id,
            "updated": updated,
            "not_found": not_found,
            "unchanged": unchanged,
        }

        self.audit.log_workflow_step(
            workflow_name="three_step",
            step_name="step2_apply_manual_reviews",
            status="completed",
            operator=applied_by,
            context=result,
        )

        return result

    def step3_export_masked(
        self,
        batch_id: str,
        exported_by: str,
        include_unreviewed: bool = False,
        escalate_phone_issues: bool = True,
    ) -> Dict[str, Any]:
        self.audit.log_workflow_step(
            workflow_name="three_step",
            step_name="step3_export_masked",
            status="started",
            operator=exported_by,
            context={"batch_id": batch_id, "include_unreviewed": include_unreviewed},
        )

        recs = self.storage.list_recommendations(batch_id=batch_id)
        rec_ids = [r.id for r in recs]

        phone_issues = []
        for rec_id in rec_ids:
            rec = self.storage.get_recommendation(rec_id)
            if rec and rec.has_unmasked_phone:
                if escalate_phone_issues:
                    self.masking_engine.mark_for_algorithm_review(
                        recommendation_id=rec_id,
                        marked_by=exported_by,
                        comment="导出时发现手机号漏遮，留待算法同事复核",
                    )
                phone_issues.append(rec_id)

        exported, skipped = self.masking_engine.export_masked(
            recommendation_ids=rec_ids,
            exported_by=exported_by,
            include_unreviewed=include_unreviewed,
        )

        result = {
            "step": 3,
            "name": "export_masked",
            "batch_id": batch_id,
            "total": len(rec_ids),
            "exported_count": len(exported),
            "skipped_count": len(skipped),
            "phone_issue_count": len(phone_issues),
            "phone_issue_ids": phone_issues,
            "skipped_ids": skipped,
            "exported_data": exported,
        }

        self.audit.log_workflow_step(
            workflow_name="three_step",
            step_name="step3_export_masked",
            status="completed",
            operator=exported_by,
            context={k: v for k, v in result.items() if k != "exported_data"},
        )

        return result

    def run_full_workflow(
        self,
        model_items: List[Dict[str, Any]],
        manual_reviews: List[Dict[str, Any]],
        batch_id: str,
        operator: str = "xiaomeng",
    ) -> Dict[str, Any]:
        step1 = self.step1_import_model_outputs(
            items=model_items,
            batch_id=batch_id,
            imported_by=operator,
        )

        step2 = self.step2_apply_manual_reviews(
            reviews=manual_reviews,
            batch_id=batch_id,
            applied_by=operator,
        )

        step3 = self.step3_export_masked(
            batch_id=batch_id,
            exported_by=operator,
            include_unreviewed=False,
            escalate_phone_issues=True,
        )

        return {
            "batch_id": batch_id,
            "workflow": "three_step_complete",
            "steps": [step1, step2, step3],
            "summary": {
                "imported": step1["import_record"]["new_count"],
                "updated_step1": step1["import_record"]["updated_count"],
                "duplicates": step1["import_record"]["duplicate_count"],
                "reviews_applied": step2["updated"],
                "exported": step3["exported_count"],
                "skipped": step3["skipped_count"],
                "phone_issues": step3["phone_issue_count"],
            },
        }

    def get_workflow_summary(self, batch_id: str) -> Dict[str, Any]:
        recs = self.storage.list_recommendations(batch_id=batch_id)
        import_records = self.storage.list_import_records(batch_id=batch_id)

        with_phone = [r for r in recs if r.has_unmasked_phone]
        reviewed = [r for r in recs if r.review_status == "reviewed"]
        pending_alg = [r for r in recs if r.review_status == "pending_algorithm_review"]

        return {
            "batch_id": batch_id,
            "total_recommendations": len(recs),
            "import_records": len(import_records),
            "with_unmasked_phone": len(with_phone),
            "reviewed": len(reviewed),
            "pending_algorithm_review": len(pending_alg),
            "recommendation_ids": [r.id for r in recs],
            "phone_issue_ids": [r.id for r in with_phone],
        }
