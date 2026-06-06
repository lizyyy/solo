import unittest
from orchestra_seat_adjustment import OrchestraSeatAdjustmentSystem
from models import AdjustmentStatus, ChangeType


class TestOrchestraSeatAdjustmentSystem(unittest.TestCase):
    def setUp(self):
        self.system = OrchestraSeatAdjustmentSystem()
        self.test_data = [
            {
                "row_number": 1,
                "seat_number": "A-01",
                "instrument": "小提琴",
                "track_remark": "正常调整",
            },
            {
                "row_number": 2,
                "seat_number": "B-05",
                "instrument": "大提琴",
                "track_remark": "返工：音准有问题需重新调",
            },
        ]

    def test_import_creates_records(self):
        batch, adjustments = self.system.import_tuner_messages(
            self.test_data,
            source_file="test.xlsx",
            imported_by="老周",
        )
        self.assertEqual(len(adjustments), 2)
        self.assertEqual(len(self.system.adjustments), 2)
        self.assertEqual(len(self.system.tuner_messages), 2)
        self.assertFalse(batch.is_duplicate)

    def test_rework_detection_on_import(self):
        _, adjustments = self.system.import_tuner_messages(
            self.test_data,
            source_file="test.xlsx",
        )
        statuses = [adj.status for adj in adjustments]
        self.assertIn(AdjustmentStatus.REWORK_REVIEW, statuses)
        self.assertIn(AdjustmentStatus.PENDING, statuses)

        rework_count = sum(
            1 for msg in self.system.tuner_messages.values() if msg.is_rework
        )
        self.assertEqual(rework_count, 1)

    def test_duplicate_import_no_duplication(self):
        batch1, _ = self.system.import_tuner_messages(
            self.test_data, source_file="test1.xlsx"
        )
        count_before = len(self.system.adjustments)

        batch2, adjustments2 = self.system.import_tuner_messages(
            self.test_data, source_file="test2.xlsx"
        )
        count_after = len(self.system.adjustments)

        self.assertEqual(count_before, count_after)
        self.assertTrue(batch2.is_duplicate)
        self.assertEqual(batch2.duplicate_of_batch, batch1.id)

    def test_manual_edit_records_history(self):
        _, adjustments = self.system.import_tuner_messages(
            self.test_data, source_file="test.xlsx"
        )
        adj = [a for a in adjustments if a.status == AdjustmentStatus.PENDING][0]

        old_remark = adj.current_remark
        new_remark = "修改后的备注内容"

        edited = self.system.manager_edit_remark(
            adj.id, new_remark, editor="老周", edit_reason="测试修改"
        )

        self.assertEqual(edited.current_remark, new_remark)

        histories = self.system.get_change_history(adj.id)
        edit_history = [
            h for h in histories if h.change_type == ChangeType.MANUAL_EDIT
        ][0]

        self.assertEqual(edit_history.old_value, old_remark)
        self.assertEqual(edit_history.new_value, new_remark)
        self.assertEqual(edit_history.changed_by, "老周")

    def test_edit_with_rework_keyword_changes_status(self):
        _, adjustments = self.system.import_tuner_messages(
            self.test_data, source_file="test.xlsx"
        )
        normal_adj = [a for a in adjustments if a.status == AdjustmentStatus.PENDING][0]

        edited = self.system.manager_edit_remark(
            normal_adj.id,
            "这里需要返工重新调整",
            editor="老周",
        )

        self.assertEqual(edited.status, AdjustmentStatus.REWORK_REVIEW)

        histories = self.system.get_change_history(normal_adj.id)
        status_changes = [
            h for h in histories if h.change_type == ChangeType.STATUS_CHANGE
        ]
        self.assertTrue(len(status_changes) > 0)

    def test_rework_status_not_auto_removed(self):
        _, adjustments = self.system.import_tuner_messages(
            self.test_data, source_file="test.xlsx"
        )
        rework_adj = [
            a for a in adjustments if a.status == AdjustmentStatus.REWORK_REVIEW
        ][0]

        edited = self.system.manager_edit_remark(
            rework_adj.id,
            "已经修好，没有问题了",
            editor="老周",
        )

        self.assertEqual(edited.status, AdjustmentStatus.REWORK_REVIEW)

    def test_copyright_review_approve(self):
        _, adjustments = self.system.import_tuner_messages(
            self.test_data, source_file="test.xlsx"
        )
        rework_adj = [
            a for a in adjustments if a.status == AdjustmentStatus.REWORK_REVIEW
        ][0]

        reviewed = self.system.copyright_review_rework(
            rework_adj.id,
            approve=True,
            reviewer="版权运营",
            review_comment="测试通过",
        )

        self.assertEqual(reviewed.status, AdjustmentStatus.CONFIRMED)

    def test_copyright_review_reject(self):
        _, adjustments = self.system.import_tuner_messages(
            self.test_data, source_file="test.xlsx"
        )
        rework_adj = [
            a for a in adjustments if a.status == AdjustmentStatus.REWORK_REVIEW
        ][0]

        reviewed = self.system.copyright_review_rework(
            rework_adj.id,
            approve=False,
            reviewer="版权运营",
        )

        self.assertEqual(reviewed.status, AdjustmentStatus.NORMAL)

    def test_copyright_review_on_wrong_status_raises(self):
        _, adjustments = self.system.import_tuner_messages(
            self.test_data, source_file="test.xlsx"
        )
        normal_adj = [a for a in adjustments if a.status == AdjustmentStatus.PENDING][0]

        with self.assertRaises(ValueError):
            self.system.copyright_review_rework(
                normal_adj.id,
                approve=True,
            )

    def test_rollback_restores_values(self):
        _, adjustments = self.system.import_tuner_messages(
            self.test_data, source_file="test.xlsx"
        )
        adj = adjustments[0]
        original_remark = adj.current_remark

        self.system.manager_edit_remark(adj.id, "已修改的备注", editor="老周")

        rolled_back = self.system.rollback_adjustment(
            adj.id, operator="老周", rollback_reason="测试回滚"
        )

        self.assertEqual(rolled_back.status, AdjustmentStatus.ROLLED_BACK)
        self.assertEqual(rolled_back.current_remark, original_remark)

    def test_three_step_workflow(self):
        tuner_data = [
            {
                "row_number": 5,
                "seat_number": "C-08",
                "instrument": "长号",
                "track_remark": "返工：需重新确认位置",
            }
        ]

        batch, adjustments = self.system.import_tuner_messages(
            tuner_data, source_file="三步流程测试.xlsx"
        )
        self.assertEqual(len(adjustments), 1)
        adj = adjustments[0]
        self.assertEqual(adj.status, AdjustmentStatus.REWORK_REVIEW)

        signup_data = {"date": "2026-06-07", "attendees": ["张三"]}
        updated = self.system.update_rehearsal_signup(
            adj.id, signup_data, operator="老周"
        )
        self.assertIsNotNone(updated.rehearsal_group_signup)
        self.assertEqual(updated.status, AdjustmentStatus.REWORK_REVIEW)

        change_record = {"change_type": "座位调整", "note": "左移10cm"}
        updated = self.system.update_rehearsal_change(
            adj.id, change_record, operator="老周"
        )
        self.assertIsNotNone(updated.rehearsal_change_record)
        self.assertEqual(updated.status, AdjustmentStatus.REWORK_REVIEW)

        evidence = self.system.get_adjustment_with_evidence(adj.id)
        self.assertEqual(evidence["evidence_summary"]["original_row_number"], 5)
        self.assertEqual(
            evidence["evidence_summary"]["original_source_file"], "三步流程测试.xlsx"
        )

    def test_get_statistics(self):
        self.system.import_tuner_messages(self.test_data, source_file="test.xlsx")
        stats = self.system.get_statistics()

        self.assertEqual(stats["total_adjustments"], 2)
        self.assertEqual(stats["total_tuner_messages"], 2)
        self.assertEqual(stats["rework_awaiting_review"], 1)
        self.assertIn("pending", stats["status_distribution"])
        self.assertIn("rework_review", stats["status_distribution"])

    def test_evidence_chain_complete(self):
        _, adjustments = self.system.import_tuner_messages(
            self.test_data, source_file="test.xlsx"
        )
        adj = adjustments[0]

        self.system.manager_edit_remark(adj.id, "第一次修改", editor="老周")
        self.system.manager_edit_remark(adj.id, "第二次修改", editor="老周")

        evidence = self.system.get_adjustment_with_evidence(adj.id)
        self.assertEqual(evidence["evidence_summary"]["manual_edit_count"], 2)
        self.assertIsNotNone(evidence["tuner_message"])
        self.assertGreater(len(evidence["change_history"]), 0)

    def test_rehearsal_update_records_history(self):
        _, adjustments = self.system.import_tuner_messages(
            self.test_data, source_file="test.xlsx"
        )
        adj = adjustments[0]

        signup_data = {"group": "A组", "date": "2026-06-07"}
        self.system.update_rehearsal_signup(adj.id, signup_data, operator="老周")

        histories = self.system.get_change_history(adj.id)
        rehearsal_updates = [
            h for h in histories if h.change_type == ChangeType.REHEARSAL_UPDATE
        ]
        self.assertTrue(len(rehearsal_updates) > 0)


if __name__ == "__main__":
    unittest.main()
