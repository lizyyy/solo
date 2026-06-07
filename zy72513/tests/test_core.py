import os
import shutil
import json
import unittest
from datetime import datetime

from learning_path_recommender.storage import JSONStorage
from learning_path_recommender.audit import AuditLogger
from learning_path_recommender.core import Importer, VersionManager, MaskingEngine
from learning_path_recommender.workflow import ThreeStepWorkflow
from learning_path_recommender.config import BOUNDARY_RULES, get_boundary_rule, validate_operation


class TestImporter(unittest.TestCase):
    def setUp(self):
        self.test_dir = "test_data"
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)
        self.storage = JSONStorage(self.test_dir)
        self.audit = AuditLogger(self.storage)
        self.importer = Importer(self.storage, self.audit)

    def tearDown(self):
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)

    def test_import_new_items(self):
        items = [
            {"id": "M1", "content": "推荐学习 Python"},
            {"id": "M2", "content": "推荐学习 Java"},
        ]
        record = self.importer.import_model_outputs(items, batch_id="B1", imported_by="test")
        self.assertEqual(record.item_count, 2)
        self.assertEqual(record.new_count, 2)
        self.assertEqual(record.duplicate_count, 0)
        self.assertEqual(len(record.item_ids), 2)

    def test_import_duplicate_items(self):
        items = [
            {"id": "M1", "content": "推荐学习 Python"},
        ]
        self.importer.import_model_outputs(items, batch_id="B1", imported_by="test")
        record2 = self.importer.import_model_outputs(items, batch_id="B2", imported_by="test")
        self.assertEqual(record2.duplicate_count, 1)
        self.assertEqual(record2.new_count, 0)

        recs = self.storage.list_recommendations()
        self.assertEqual(len(recs), 1)

    def test_import_updated_content(self):
        items1 = [{"id": "M1", "content": "推荐学习 Python"}]
        self.importer.import_model_outputs(items1, batch_id="B1")
        items2 = [{"id": "M1", "content": "推荐学习 Python 进阶"}]
        record2 = self.importer.import_model_outputs(items2, batch_id="B2")
        self.assertEqual(record2.updated_count, 1)

        rec = self.storage.find_recommendation_by_model_output_id("M1")
        self.assertEqual(rec.content, "推荐学习 Python 进阶")
        self.assertEqual(rec.version, 2)

    def test_apply_manual_review(self):
        items = [{"id": "M1", "content": "推荐学习 Python"}]
        self.importer.import_model_outputs(items, batch_id="B1")
        reviews = [
            {"model_output_id": "M1", "review_content": "建议先学基础", "comment": "小孟复核"}
        ]
        updated, not_found, unchanged = self.importer.apply_manual_review(
            reviews, batch_id="B1", applied_by="xiaomeng"
        )
        self.assertEqual(updated, 1)
        self.assertEqual(not_found, 0)

        rec = self.storage.find_recommendation_by_model_output_id("M1")
        self.assertEqual(rec.source_manual_review, "建议先学基础")
        self.assertEqual(rec.reviewer, "xiaomeng")
        self.assertEqual(rec.review_status, "reviewed")


class TestMaskingEngine(unittest.TestCase):
    def setUp(self):
        self.test_dir = "test_data"
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)
        self.storage = JSONStorage(self.test_dir)
        self.audit = AuditLogger(self.storage)
        self.engine = MaskingEngine(self.storage, self.audit)

    def tearDown(self):
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)

    def test_phone_detection(self):
        text = "联系电话 13812345678"
        violations = self.engine.check_unmasked_content(text)
        has_phone = any(v["rule_name"] == "phone_number_china" for v in violations)
        self.assertTrue(has_phone)

    def test_phone_masking(self):
        text = "联系电话 13812345678"
        masked, violations = self.engine.apply_masking(text)
        self.assertIn("1*********", masked)
        self.assertNotIn("13812345678", masked)

    def test_process_recommendation_with_phone(self):
        from learning_path_recommender.models import Recommendation
        rec = Recommendation(
            content="电话 13812345678",
            model_output_id="M1",
        )
        self.storage.save_recommendation(rec)
        result = self.engine.process_recommendation(rec.id, processed_by="test")
        self.assertTrue(result["has_unmasked_phone"])
        self.assertTrue(result["review_required"])

        rec_updated = self.storage.get_recommendation(rec.id)
        self.assertTrue(rec_updated.has_unmasked_phone)
        self.assertEqual(rec_updated.masking_status, "needs_review")

    def test_export_skips_phone_issues(self):
        from learning_path_recommender.models import Recommendation
        rec1 = Recommendation(
            content="正常内容",
            model_output_id="M1",
            has_unmasked_phone=False,
        )
        rec2 = Recommendation(
            content="电话 13812345678",
            model_output_id="M2",
            has_unmasked_phone=True,
        )
        self.storage.save_recommendation(rec1)
        self.storage.save_recommendation(rec2)

        exported, skipped = self.engine.export_masked(
            [rec1.id, rec2.id], exported_by="test"
        )
        self.assertEqual(len(exported), 1)
        self.assertEqual(len(skipped), 1)
        self.assertIn(rec2.id, skipped)

    def test_mark_for_algorithm_review(self):
        from learning_path_recommender.models import Recommendation
        rec = Recommendation(
            content="电话 13812345678",
            model_output_id="M1",
        )
        self.storage.save_recommendation(rec)
        result = self.engine.mark_for_algorithm_review(
            rec.id, marked_by="xiaomeng", comment="手机号漏遮待复核"
        )
        self.assertEqual(result.review_status, "pending_algorithm_review")
        self.assertEqual(result.reviewer, "xiaomeng")


class TestVersionManager(unittest.TestCase):
    def setUp(self):
        self.test_dir = "test_data"
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)
        self.storage = JSONStorage(self.test_dir)
        self.audit = AuditLogger(self.storage)
        self.vm = VersionManager(self.storage, self.audit)

    def tearDown(self):
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)

    def test_record_and_get_history(self):
        from learning_path_recommender.models import Recommendation
        rec = Recommendation(content="v1 content", model_output_id="M1")
        self.storage.save_recommendation(rec)

        rec.content = "v2 content"
        rec.version = 2
        self.storage.save_recommendation(rec)
        self.vm.record_change(
            recommendation_id=rec.id,
            field_name="content",
            old_value="v1 content",
            new_value="v2 content",
            changed_by="test",
            change_reason="test change",
        )

        histories = self.vm.get_history(rec.id)
        self.assertEqual(len(histories), 1)
        self.assertEqual(histories[0].old_value, "v1 content")
        self.assertEqual(histories[0].new_value, "v2 content")

    def test_rollback(self):
        from learning_path_recommender.models import Recommendation
        rec = Recommendation(content="v1 content", model_output_id="M1")
        self.storage.save_recommendation(rec)

        rec.content = "v2 content"
        rec.version = 2
        self.storage.save_recommendation(rec)
        self.vm.record_change(
            rec.id, "content", "v1 content", "v2 content", "test", "update"
        )

        rec_rolled, changes = self.vm.rollback_to_version(rec.id, 1, "test")
        self.assertEqual(rec_rolled.content, "v1 content")
        self.assertEqual(len(changes), 1)


class TestThreeStepWorkflow(unittest.TestCase):
    def setUp(self):
        self.test_dir = "test_data"
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)
        self.workflow = ThreeStepWorkflow(JSONStorage(self.test_dir))

    def tearDown(self):
        if os.path.exists(self.test_dir):
            shutil.rmtree(self.test_dir)

    def test_full_workflow(self):
        model_items = [
            {"id": "M1", "content": "学习路径A 电话 13812345678"},
            {"id": "M2", "content": "学习路径B 邮箱 test@example.com"},
            {"id": "M3", "content": "学习路径C 无敏感信息"},
        ]
        manual_reviews = [
            {"model_output_id": "M1", "review_content": "人工备注A"},
            {"model_output_id": "M2", "review_content": "人工备注B"},
        ]

        result = self.workflow.run_full_workflow(
            model_items=model_items,
            manual_reviews=manual_reviews,
            batch_id="TEST_BATCH",
            operator="xiaomeng",
        )

        self.assertEqual(result["summary"]["imported"], 3)
        self.assertEqual(result["summary"]["reviews_applied"], 2)
        self.assertEqual(result["summary"]["phone_issues"], 1)

        summary = self.workflow.get_workflow_summary("TEST_BATCH")
        self.assertEqual(summary["total_recommendations"], 3)
        self.assertEqual(summary["with_unmasked_phone"], 1)
        self.assertEqual(summary["pending_algorithm_review"], 1)


class TestBoundaryRules(unittest.TestCase):
    def test_rules_exist(self):
        self.assertIn("phone_number_masking", BOUNDARY_RULES)
        self.assertIn("duplicate_import", BOUNDARY_RULES)
        self.assertIn("three_step_workflow", BOUNDARY_RULES)

    def test_get_rule(self):
        rule = get_boundary_rule("RULE_001")
        self.assertIsNotNone(rule)
        self.assertEqual(rule["name"], "手机号漏遮判定规则")

    def test_validate_operation(self):
        valid, errors = validate_operation("auto_fix_phone", {})
        self.assertFalse(valid)
        self.assertTrue(any("RULE_001" in e for e in errors))


if __name__ == "__main__":
    unittest.main()
