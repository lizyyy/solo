from __future__ import annotations

import unittest
from datetime import datetime

from models import (
    ExceptionStatus,
    FieldName,
    SourceType,
    compute_attachment_digest,
    compute_idempotency_key,
)
from reconciliation_engine import ReconciliationEngine


class TestStrayAnimalReconciliation(unittest.TestCase):

    def setUp(self):
        self.engine = ReconciliationEngine()

    # ── 场景 1：两次相同请求 + 晚到附件不重复计数 ────────────────────────
    def test_duplicate_submission_with_late_attachment_not_double_counted(self):
        case_id = "CASE-A001"
        animal_id = "ANIMAL-001"
        submitter = "阿宁"

        fields_1 = {
            FieldName.ANIMAL_NAME: "小黄",
            FieldName.APPOINTMENT_TIME: "2026-06-10 14:00",
            FieldName.VACCINE_DATE: None,
        }

        attach = {
            "file_name": "疫苗卡_小黄.jpg",
            "file_size": 1048576,
            "content_hash": "abc123def456",
        }

        result1 = self.engine.submit_rescue_payload(
            case_id=case_id,
            animal_id=animal_id,
            submitter=submitter,
            field_values=fields_1,
            source_type=SourceType.WECHAT_NOTE,
            source_id="wechat-msg-001",
            attachment_meta=attach,
        )
        self.assertEqual(result1["status"], "applied")
        self.assertTrue(result1["attachment_registered"])
        self.assertFalse(result1["attachment_deduped"])

        record = self.engine.records[case_id]
        initial_attach_count = len(record.attachment_digests)
        self.assertEqual(initial_attach_count, 1)

        result2 = self.engine.submit_rescue_payload(
            case_id=case_id,
            animal_id=animal_id,
            submitter=submitter,
            field_values=fields_1,
            source_type=SourceType.WECHAT_NOTE,
            source_id="wechat-msg-001",
            attachment_meta=attach,
        )
        self.assertEqual(result2["status"], "ignored_duplicate")
        self.assertTrue(result2["attachment_deduped"])

        self.assertEqual(len(record.attachment_digests), 1,
                         "重复提交不能把一条晚到附件算成两份")
        self.assertEqual(len(record.submissions_seen), 1)

    # ── 场景 2：多源混淆（旧微信备注 / 晚到附件 / 口头备注）分清谁影响结论 ──
    def test_multi_source_conflict_traces_who_affected_conclusion(self):
        case_id = "CASE-B002"
        animal_id = "ANIMAL-002"

        self.engine.submit_rescue_payload(
            case_id=case_id,
            animal_id=animal_id,
            submitter="阿宁",
            field_values={
                FieldName.ANIMAL_NAME: "阿黄（旧微信备注）",
                FieldName.VACCINE_DATE: "2025-11-01",
                FieldName.APPOINTMENT_TIME: "2026-06-11 09:00",
                FieldName.HEALTH_STATUS: "皮肤有藓",
            },
            source_type=SourceType.WECHAT_NOTE,
            source_id="wechat-old-002",
            source_version=1,
            raw_ref="主人2025-12月的旧消息",
        )

        self.engine.submit_rescue_payload(
            case_id=case_id,
            animal_id=animal_id,
            submitter="阿宁",
            field_values={
                FieldName.VACCINE_DATE: "2026-05-20",
                FieldName.DEWORMING_DATE: "2026-04-10",
            },
            source_type=SourceType.ATTACHMENT,
            source_id="attach-vaccine-card",
            source_version=1,
            attachment_meta={
                "file_name": "疫苗本扫描件.pdf",
                "file_size": 2097152,
                "content_hash": "attach-hash-002",
            },
        )

        self.engine.submit_rescue_payload(
            case_id=case_id,
            animal_id=animal_id,
            submitter="阿宁",
            field_values={
                FieldName.HEALTH_STATUS: "耳螨+眼部发炎",
                FieldName.REMARKS: "主人电话里特别提醒要先看耳朵",
            },
            source_type=SourceType.VERBAL_NOTE,
            source_id="verbal-call-003",
            source_version=1,
        )

        record = self.engine.records[case_id]

        self.assertEqual(record.fields[FieldName.VACCINE_DATE].value, "2026-05-20")
        self.assertEqual(record.fields[FieldName.VACCINE_DATE].source_info.source_type,
                         SourceType.ATTACHMENT)

        trace = self.engine.get_conclusion_trace(case_id, FieldName.VACCINE_DATE)
        self.assertEqual(len(trace), 2)
        wechat_entry = next(t for t in trace if t["source_type"] == "wechat_note")
        attach_entry = next(t for t in trace if t["source_type"] == "attachment")
        self.assertEqual(wechat_entry["origin"], "被覆盖")
        self.assertEqual(attach_entry["origin"], "胜出")

        self.assertEqual(record.fields[FieldName.HEALTH_STATUS].value, "皮肤有藓")
        self.assertEqual(record.fields[FieldName.HEALTH_STATUS].source_info.source_type,
                         SourceType.WECHAT_NOTE)

    # ── 场景 3：疫苗日期缺失 → 提醒写清找谁确认 / 先看哪条来源 ─────────
    def test_missing_vaccine_date_shows_confirm_person_and_priority_source(self):
        case_id = "CASE-C003"
        animal_id = "ANIMAL-003"

        self.engine.submit_rescue_payload(
            case_id=case_id,
            animal_id=animal_id,
            submitter="阿宁",
            field_values={
                FieldName.ANIMAL_NAME: "小花",
                FieldName.APPOINTMENT_TIME: "2026-06-12 10:30",
            },
            source_type=SourceType.WECHAT_NOTE,
            source_id="wechat-msg-003",
            source_version=1,
            raw_ref="主人的微信消息-003",
        )

        self.engine.submit_rescue_payload(
            case_id=case_id,
            animal_id=animal_id,
            submitter="阿宁",
            field_values={
                FieldName.HEALTH_STATUS: "偏瘦",
            },
            source_type=SourceType.VERBAL_NOTE,
            source_id="verbal-004",
        )

        vaccine_exc = next(
            (e for e in self.engine.exceptions.values()
             if e.missing_field == FieldName.VACCINE_DATE),
            None,
        )
        self.assertIsNotNone(vaccine_exc, "缺少疫苗日期必须生成异常")

        self.assertEqual(vaccine_exc.confirm_person, "主治兽医",
                         "提醒必须写清找谁确认：主治兽医")

        self.assertEqual(vaccine_exc.priority_source.source_type, SourceType.WECHAT_NOTE)
        self.assertEqual(vaccine_exc.priority_source.source_id, "wechat-msg-003",
                         "优先查看来源应指向最早尝试过该字段的提交")

        queue_text = self.engine.render_exception_queue_for_communication()
        self.assertIn("主治兽医", queue_text)
        self.assertIn("优先查看来源", queue_text)
        self.assertIn("wechat-msg-003", queue_text)

    # ── 场景 4：重复导入 → 记录不翻倍 + 人工备注不被覆盖 ──────────────
    def test_duplicate_import_no_doubling_and_manual_notes_protected(self):
        case_id = "CASE-D004"
        animal_id = "ANIMAL-004"

        self.engine.submit_rescue_payload(
            case_id=case_id,
            animal_id=animal_id,
            submitter="阿宁",
            field_values={
                FieldName.ANIMAL_NAME: "小黑",
                FieldName.VACCINE_DATE: "2026-03-15",
                FieldName.APPOINTMENT_TIME: "2026-06-13 15:00",
            },
            source_type=SourceType.WECHAT_NOTE,
            source_id="wechat-msg-004",
        )

        self.engine.submit_rescue_payload(
            case_id=case_id,
            animal_id=animal_id,
            submitter="负责人",
            field_values={
                FieldName.REMARKS: "【人工补录】主人提醒：小黑晕车，需提前给药",
                FieldName.OWNER_CONTACT: "13800000000",
            },
            source_type=SourceType.MANUAL_EDIT,
            source_id="manual-edit-001",
        )

        record = self.engine.records[case_id]
        original_remark = record.fields[FieldName.REMARKS].value
        original_contact = record.fields[FieldName.OWNER_CONTACT].value
        self.assertEqual(original_remark, "【人工补录】主人提醒：小黑晕车，需提前给药")

        self.engine.submit_rescue_payload(
            case_id=case_id,
            animal_id=animal_id,
            submitter="阿宁",
            field_values={
                FieldName.ANIMAL_NAME: "小黑",
                FieldName.VACCINE_DATE: "2026-03-15",
                FieldName.APPOINTMENT_TIME: "2026-06-13 15:00",
                FieldName.REMARKS: "来自新一批导入的备注",
                FieldName.OWNER_CONTACT: "13999999999",
            },
            source_type=SourceType.WECHAT_NOTE,
            source_id="wechat-msg-004",
        )

        record_after = self.engine.records[case_id]
        self.assertEqual(record_after.fields[FieldName.REMARKS].value, original_remark,
                         "人工备注不能被后续低优先级来源覆盖")
        self.assertEqual(record_after.fields[FieldName.OWNER_CONTACT].value, original_contact,
                         "人工录入的联系方式不能被覆盖")

        self.assertEqual(len(record_after.submissions_seen), 3,
                         "三次内容不同的提交（即使同源同ID）应分别登记，相同内容重复提交才会被拦截")

    # ── 场景 5：异常队列显示补录 / 改判痕迹 ────────────────────────────
    def test_exception_queue_shows_supplemented_and_overruled_markers(self):
        case_id = "CASE-E005"
        animal_id = "ANIMAL-005"

        self.engine.submit_rescue_payload(
            case_id=case_id,
            animal_id=animal_id,
            submitter="阿宁",
            field_values={
                FieldName.ANIMAL_NAME: "奶牛",
                FieldName.APPOINTMENT_TIME: "2026-06-14 09:30",
            },
            source_type=SourceType.WECHAT_NOTE,
            source_id="wechat-old-005",
            source_version=1,
        )

        pending_exc = next(
            e for e in self.engine.exceptions.values()
            if e.missing_field == FieldName.VACCINE_DATE
        )
        self.assertEqual(pending_exc.status, ExceptionStatus.PENDING)
        self.assertFalse(pending_exc.is_supplemented())
        self.assertFalse(pending_exc.is_overruled())

        self.engine.submit_rescue_payload(
            case_id=case_id,
            animal_id=animal_id,
            submitter="阿宁",
            field_values={
                FieldName.VACCINE_DATE: "2026-01-10",
            },
            source_type=SourceType.VERBAL_NOTE,
            source_id="verbal-vaccine",
        )

        after_verbal = next(
            e for e in self.engine.exceptions.values()
            if e.missing_field == FieldName.VACCINE_DATE and e.animal_case_id == case_id
        )
        self.assertEqual(after_verbal.status, ExceptionStatus.SUPPLEMENTED)
        self.assertTrue(after_verbal.is_supplemented(), "口头备注补上后异常应标记已补录")

        self.engine.submit_rescue_payload(
            case_id=case_id,
            animal_id=animal_id,
            submitter="阿宁",
            field_values={
                FieldName.VACCINE_DATE: "2026-02-20",
            },
            source_type=SourceType.ATTACHMENT,
            source_id="attach-vaccine-proof",
            attachment_meta={
                "file_name": "疫苗证书.pdf",
                "file_size": 512000,
                "content_hash": "cert-hash-005",
            },
        )

        final_exc = next(
            e for e in self.engine.exceptions.values()
            if e.missing_field == FieldName.VACCINE_DATE and e.animal_case_id == case_id
        )
        self.assertEqual(final_exc.status, ExceptionStatus.OVERRULED)
        self.assertTrue(final_exc.is_overruled(),
                        "附件（高优先级）覆盖口头备注后，异常应标记已改判")

        queue_text = self.engine.render_exception_queue_for_communication()
        self.assertIn("已补录", queue_text)
        self.assertIn("已改判", queue_text)
        self.assertIn("✅已补", queue_text)
        self.assertIn("⚠️改判", queue_text)
        self.assertIn("改判说明", queue_text)

    # ── 场景 6：输出是可直接沟通的异常队列（非功能清单） ──────────────
    def test_output_is_communication_ready_not_feature_list(self):
        case_id = "CASE-F006"
        self.engine.submit_rescue_payload(
            case_id=case_id,
            animal_id="ANIMAL-006",
            submitter="阿宁",
            field_values={
                FieldName.ANIMAL_NAME: "三花",
            },
            source_type=SourceType.WECHAT_NOTE,
            source_id="wechat-msg-006",
        )

        queue_text = self.engine.render_exception_queue_for_communication()

        self.assertTrue(queue_text.startswith("【流浪动物救助排程对账 · 异常队列】"))
        self.assertIn("■ 待处理", queue_text)
        self.assertIn("找谁确认", queue_text)
        self.assertIn("优先查看来源", queue_text)
        self.assertIn("救助单号", queue_text)
        self.assertIn("汇总：待处理", queue_text)

        forbidden_words = ["功能清单", "接口文档", "API", "使用说明", "字段说明"]
        for w in forbidden_words:
            self.assertNotIn(w, queue_text, f"异常队列不应包含「{w}」字样")

    # ── 辅助函数单测 ──────────────────────────────────────────────────
    def test_idempotency_key_deterministic(self):
        k1 = compute_idempotency_key("C1", "fp1", "阿宁")
        k2 = compute_idempotency_key("C1", "fp1", "阿宁")
        self.assertEqual(k1, k2)
        k3 = compute_idempotency_key("C1", "fp1", "另一个人")
        self.assertNotEqual(k1, k3)

    def test_attachment_digest_deterministic(self):
        d1 = compute_attachment_digest("a.jpg", 100, "hash1")
        d2 = compute_attachment_digest("a.jpg", 100, "hash1")
        self.assertEqual(d1, d2)
        d3 = compute_attachment_digest("a.jpg", 100, "hash2")
        self.assertNotEqual(d1, d3)


if __name__ == "__main__":
    unittest.main(verbosity=2)
