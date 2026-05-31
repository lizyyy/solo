#!/usr/bin/env python3
import os
import tempfile
import unittest
import csv

from models import (
    ReviewStatus,
    AnomalyType,
    SourceType,
    LeaderboardRecord,
)
from island_supply_service import IslandSupplyService, VersionDiff


class TestIslandSupplyService(unittest.TestCase):
    def setUp(self):
        self.test_db = tempfile.mktemp(suffix=".db")
        self.service = IslandSupplyService(db_path=self.test_db)

    def tearDown(self):
        if os.path.exists(self.test_db):
            os.remove(self.test_db)

    def _create_test_csv(self, records, filename):
        path = os.path.join(tempfile.gettempdir(), filename)
        with open(path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=records[0].keys())
            writer.writeheader()
            writer.writerows(records)
        return path

    def test_import_drop_configs(self):
        configs = [
            {
                "stage": "5",
                "item_name": "高级补给箱",
                "drop_rate": "15.5",
                "version": "1",
                "note": "测试",
            }
        ]
        csv_path = self._create_test_csv(configs, "test_drop.csv")
        result = self.service.import_drop_configs(csv_path)
        self.assertEqual(len(result), 1)
        self.assertEqual(result[0].stage, "5")
        self.assertEqual(result[0].item_name, "高级补给箱")
        self.assertEqual(result[0].drop_rate, 15.5)

    def test_import_leaderboard_new_records(self):
        records = [
            {
                "player_id": "P001",
                "player_name": "测试玩家1",
                "score": "10000",
                "rank": "1",
                "stage_progress": "10",
                "anomaly": "",
                "note": "",
            }
        ]
        csv_path = self._create_test_csv(records, "test_lb.csv")
        result = self.service.import_leaderboard(csv_path)
        self.assertEqual(len(result.new_records), 1)
        self.assertEqual(result.new_records[0].player_id, "P001")
        self.assertEqual(result.new_records[0].review_status, ReviewStatus.NORMAL)

    def test_import_leaderboard_auto_detect_anomaly(self):
        records = [
            {
                "player_id": "P002",
                "player_name": "断线玩家",
                "score": "5000",
                "rank": "2",
                "stage_progress": "5",
                "anomaly": "断线",
                "note": "掉线后分数不对",
            },
            {
                "player_id": "P003",
                "player_name": "刷分玩家",
                "score": "8000",
                "rank": "3",
                "stage_progress": "8",
                "anomaly": "刷分",
                "note": "",
            },
            {
                "player_id": "P004",
                "player_name": "漏发玩家",
                "score": "3000",
                "rank": "4",
                "stage_progress": "3",
                "anomaly": "漏发",
                "note": "",
            },
        ]
        csv_path = self._create_test_csv(records, "test_lb_anomaly.csv")
        result = self.service.import_leaderboard(csv_path)

        p002 = next(r for r in result.new_records if r.player_id == "P002")
        self.assertEqual(p002.review_status, ReviewStatus.PENDING_CONFIRM)
        self.assertEqual(p002.anomaly_type, AnomalyType.DISCONNECT_PROGRESS_CORRUPT)

        p003 = next(r for r in result.new_records if r.player_id == "P003")
        self.assertEqual(p003.review_status, ReviewStatus.PENDING_CONFIRM)
        self.assertEqual(p003.anomaly_type, AnomalyType.RESTART_BRUSH_SCORE)

        p004 = next(r for r in result.new_records if r.player_id == "P004")
        self.assertEqual(p004.review_status, ReviewStatus.PENDING_CONFIRM)
        self.assertEqual(p004.anomaly_type, AnomalyType.REWARD_MISSED)

    def test_import_leaderboard_update_existing(self):
        records_v1 = [
            {
                "player_id": "P001",
                "player_name": "玩家A",
                "score": "10000",
                "rank": "1",
                "stage_progress": "10",
                "anomaly": "",
                "note": "",
            }
        ]
        csv_path_v1 = self._create_test_csv(records_v1, "test_lb_v1.csv")
        result_v1 = self.service.import_leaderboard(csv_path_v1)
        self.assertEqual(result_v1.new_records[0].version, 1)

        records_v2 = [
            {
                "player_id": "P001",
                "player_name": "玩家A",
                "score": "15000",
                "rank": "1",
                "stage_progress": "12",
                "anomaly": "",
                "note": "",
            }
        ]
        csv_path_v2 = self._create_test_csv(records_v2, "test_lb_v2.csv")
        result_v2 = self.service.import_leaderboard(csv_path_v2)

        self.assertEqual(len(result_v2.updated_records), 1)
        self.assertEqual(result_v2.updated_records[0].version, 2)
        self.assertEqual(result_v2.updated_records[0].score, 15000)
        self.assertEqual(len(result_v2.version_diffs), 1)

        history = self.service.db.get_version_history(
            "leaderboard", result_v1.new_records[0].id
        )
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0].old_version, 1)
        self.assertEqual(history[0].new_version, 2)
        self.assertIn("score", history[0].changed_fields)

    def test_import_leaderboard_older_version_marked_anomaly(self):
        records_v1 = [
            {
                "player_id": "P001",
                "player_name": "玩家A",
                "score": "15000",
                "rank": "1",
                "stage_progress": "12",
                "anomaly": "",
                "note": "",
            }
        ]
        csv_path_v1 = self._create_test_csv(records_v1, "test_lb_v1.csv")
        result_v1 = self.service.import_leaderboard(csv_path_v1)
        self.assertEqual(result_v1.new_records[0].review_status, ReviewStatus.NORMAL)

        records_v2 = [
            {
                "player_id": "P001",
                "player_name": "玩家A",
                "score": "10000",
                "rank": "5",
                "stage_progress": "10",
                "anomaly": "",
                "note": "",
            }
        ]
        csv_path_v2 = self._create_test_csv(records_v2, "test_lb_v2.csv")
        result_v2 = self.service.import_leaderboard(csv_path_v2)

        self.assertEqual(len(result_v2.updated_records), 1)
        self.assertEqual(len(result_v2.skipped_records), 0)
        updated = result_v2.updated_records[0]
        self.assertEqual(updated.review_status, ReviewStatus.PENDING_CONFIRM)
        self.assertEqual(updated.anomaly_type, AnomalyType.DISCONNECT_PROGRESS_CORRUPT)
        self.assertEqual(updated.version, 2)
        self.assertIn("断线", updated.anomaly_note)

    def test_revoke_batch(self):
        records = [
            {
                "player_id": "P001",
                "player_name": "玩家A",
                "score": "10000",
                "rank": "1",
                "stage_progress": "10",
                "anomaly": "",
                "note": "",
            }
        ]
        csv_path = self._create_test_csv(records, "test_lb.csv")
        result = self.service.import_leaderboard(csv_path)
        batch_id = result.batch.batch_id

        success = self.service.revoke_batch(batch_id, "测试撤回", "测试员")
        self.assertTrue(success)

        batch = self.service.db.get_import_batch(batch_id)
        self.assertTrue(batch.is_revoked)
        self.assertEqual(batch.revoke_reason, "测试撤回")

        lb_records = self.service.db.find_leaderboard_by_batch(batch_id)
        self.assertEqual(lb_records[0].review_status, ReviewStatus.REJECTED)

    def test_revoke_batch_already_revoked(self):
        records = [
            {
                "player_id": "P001",
                "player_name": "玩家A",
                "score": "10000",
                "rank": "1",
                "stage_progress": "10",
                "anomaly": "",
                "note": "",
            }
        ]
        csv_path = self._create_test_csv(records, "test_lb.csv")
        result = self.service.import_leaderboard(csv_path)
        batch_id = result.batch.batch_id

        self.service.revoke_batch(batch_id, "第一次撤回", "测试员")
        success = self.service.revoke_batch(batch_id, "第二次撤回", "测试员")
        self.assertFalse(success)

    def test_mark_anomaly(self):
        records = [
            {
                "player_id": "P001",
                "player_name": "玩家A",
                "score": "10000",
                "rank": "1",
                "stage_progress": "10",
                "anomaly": "",
                "note": "",
            }
        ]
        csv_path = self._create_test_csv(records, "test_lb.csv")
        result = self.service.import_leaderboard(csv_path)
        record_id = result.new_records[0].id

        updated = self.service.mark_anomaly(
            record_id, AnomalyType.DISCONNECT_PROGRESS_CORRUPT, "手动标记断线", "测试员"
        )

        self.assertEqual(updated.review_status, ReviewStatus.PENDING_CONFIRM)
        self.assertEqual(updated.anomaly_type, AnomalyType.DISCONNECT_PROGRESS_CORRUPT)
        self.assertEqual(updated.version, 2)

    def test_confirm_record_normal(self):
        records = [
            {
                "player_id": "P001",
                "player_name": "玩家A",
                "score": "10000",
                "rank": "1",
                "stage_progress": "10",
                "anomaly": "断线",
                "note": "",
            }
        ]
        csv_path = self._create_test_csv(records, "test_lb.csv")
        result = self.service.import_leaderboard(csv_path)
        record_id = result.new_records[0].id

        updated = self.service.confirm_record(record_id, True, "核实无误", "测试员")
        self.assertEqual(updated.review_status, ReviewStatus.NORMAL)
        self.assertEqual(updated.version, 2)

    def test_confirm_record_rejected(self):
        records = [
            {
                "player_id": "P001",
                "player_name": "玩家A",
                "score": "10000",
                "rank": "1",
                "stage_progress": "10",
                "anomaly": "刷分",
                "note": "",
            }
        ]
        csv_path = self._create_test_csv(records, "test_lb.csv")
        result = self.service.import_leaderboard(csv_path)
        record_id = result.new_records[0].id

        updated = self.service.confirm_record(record_id, False, "确认刷分", "测试员")
        self.assertEqual(updated.review_status, ReviewStatus.REJECTED)

    def test_version_diff_detection(self):
        old = LeaderboardRecord(
            id=1,
            player_id="P001",
            player_name="玩家A",
            score=10000,
            rank=5,
            stage_progress=10,
        )
        new = LeaderboardRecord(
            id=1,
            player_id="P001",
            player_name="玩家A",
            score=15000,
            rank=1,
            stage_progress=12,
        )
        diff = VersionDiff(old, new)
        self.assertTrue(diff.has_changes)
        self.assertIn("score", diff.changed_fields)
        self.assertIn("rank", diff.changed_fields)
        self.assertIn("stage_progress", diff.changed_fields)
        self.assertEqual(diff.old_values["score"], 10000)
        self.assertEqual(diff.new_values["score"], 15000)

    def test_version_diff_no_changes(self):
        old = LeaderboardRecord(
            id=1, player_id="P001", player_name="玩家A", score=10000
        )
        new = LeaderboardRecord(
            id=1, player_id="P001", player_name="玩家A", score=10000
        )
        diff = VersionDiff(old, new)
        self.assertFalse(diff.has_changes)

    def test_get_version_diff_warnings(self):
        records_v1 = [
            {
                "player_id": "P001",
                "player_name": "玩家A",
                "score": "10000",
                "rank": "1",
                "stage_progress": "10",
                "anomaly": "",
                "note": "",
            }
        ]
        csv_path_v1 = self._create_test_csv(records_v1, "test_lb_v1.csv")
        self.service.import_leaderboard(csv_path_v1)

        records_v2 = [
            {
                "player_id": "P001",
                "player_name": "玩家A",
                "score": "15000",
                "rank": "1",
                "stage_progress": "12",
                "anomaly": "",
                "note": "",
            }
        ]
        csv_path_v2 = self._create_test_csv(records_v2, "test_lb_v2.csv")
        result_v2 = self.service.import_leaderboard(csv_path_v2)

        warnings = self.service.get_version_diff_warnings(result_v2.batch.batch_id)
        self.assertEqual(len(warnings), 1)
        self.assertEqual(warnings[0]["warning"], "已覆盖旧版本数据")
        self.assertIn("score", warnings[0]["changes"])

    def test_get_record_trace(self):
        drop_configs = [
            {
                "stage": "10",
                "item_name": "测试道具",
                "drop_rate": "10.0",
                "version": "1",
                "note": "",
            }
        ]
        drop_csv = self._create_test_csv(drop_configs, "test_drop.csv")
        self.service.import_drop_configs(drop_csv)

        records = [
            {
                "player_id": "P001",
                "player_name": "玩家A",
                "score": "10000",
                "rank": "1",
                "stage_progress": "10",
                "anomaly": "",
                "note": "",
            }
        ]
        csv_path = self._create_test_csv(records, "test_lb.csv")
        result = self.service.import_leaderboard(
            csv_path, source_ref="测试截图.png"
        )
        record_id = result.new_records[0].id

        trace = self.service.get_record_trace(record_id)
        self.assertIsNotNone(trace)
        self.assertEqual(trace["record"]["player_id"], "P001")
        self.assertEqual(trace["evidence"]["source_ref"], "测试截图.png")
        self.assertIsNotNone(trace["import_batch"])
        self.assertEqual(len(trace["related_drop_configs"]), 1)
        self.assertEqual(trace["related_drop_configs"][0]["item_name"], "测试道具")

    def test_detect_disconnect_corruption(self):
        records_v1 = [
            {
                "player_id": "P001",
                "player_name": "玩家A",
                "score": "20000",
                "rank": "1",
                "stage_progress": "15",
                "anomaly": "",
                "note": "",
            }
        ]
        csv_path_v1 = self._create_test_csv(records_v1, "test_lb_v1.csv")
        result_v1 = self.service.import_leaderboard(csv_path_v1)
        record_id = result_v1.new_records[0].id

        records_v2 = [
            {
                "player_id": "P001",
                "player_name": "玩家A",
                "score": "10000",
                "rank": "5",
                "stage_progress": "10",
                "anomaly": "",
                "note": "",
            }
        ]
        csv_path_v2 = self._create_test_csv(records_v2, "test_lb_v2.csv")
        self.service.import_leaderboard(csv_path_v2)

        suspicious_before = self.service.detect_disconnect_corruption(score_deviation_threshold=5000)
        self.assertEqual(len(suspicious_before), 0)

        self.service.confirm_record(record_id, True, "误判，实际正常", "测试员")

        suspicious_after = self.service.detect_disconnect_corruption(score_deviation_threshold=5000)
        self.assertEqual(len(suspicious_after), 1)
        self.assertEqual(suspicious_after[0].player_id, "P001")

    def test_export_with_trace(self):
        records = [
            {
                "player_id": "P001",
                "player_name": "玩家A",
                "score": "10000",
                "rank": "1",
                "stage_progress": "10",
                "anomaly": "",
                "note": "",
            },
            {
                "player_id": "P002",
                "player_name": "玩家B",
                "score": "8000",
                "rank": "2",
                "stage_progress": "8",
                "anomaly": "断线",
                "note": "",
            },
        ]
        csv_path = self._create_test_csv(records, "test_lb.csv")
        self.service.import_leaderboard(csv_path)

        output_path = os.path.join(tempfile.gettempdir(), "test_export.csv")
        results = self.service.export_with_trace(
            output_path, include_pending=True, include_trace=True
        )

        self.assertEqual(len(results), 2)

        base = os.path.splitext(output_path)[0]
        self.assertTrue(os.path.exists(f"{base}_summary.csv"))
        self.assertTrue(os.path.exists(f"{base}_detail.json"))
        self.assertTrue(os.path.exists(f"{base}_warnings.txt"))

        for f in [f"{base}_summary.csv", f"{base}_detail.json", f"{base}_warnings.txt"]:
            os.remove(f)

    def test_list_batches(self):
        records = [
            {
                "player_id": "P001",
                "player_name": "玩家A",
                "score": "10000",
                "rank": "1",
                "stage_progress": "10",
                "anomaly": "",
                "note": "",
            }
        ]
        csv_path = self._create_test_csv(records, "test_lb.csv")
        result = self.service.import_leaderboard(csv_path)

        batches = self.service.list_batches()
        self.assertEqual(len(batches), 1)
        self.assertEqual(batches[0]["batch"]["batch_id"], result.batch.batch_id)
        self.assertEqual(batches[0]["record_count"], 1)


if __name__ == "__main__":
    unittest.main()
