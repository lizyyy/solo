import os
import sys
import json
import shutil
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from models import (
    Status, AnomalyType, MeasurementMethod
)
from storage import (
    create_batch, add_sensor_log, get_batch, batch_exists,
    compute_data_hash, _save_batch, STORAGE_DIR, BATCH_INDEX_FILE
)
from data_import import generate_sample_data, parse_csv
from anomaly_detector import (
    detect_sampling_gaps, detect_unit_conversion_errors,
    detect_zero_drift, run_all_anomaly_detections
)
from calibration import (
    standing_wave_calibration, phase_comparison_calibration,
    calculate_theoretical_velocity, progressive_difference_method,
    determine_status
)
from version_diff import compare_raw_data, compare_anomalies
from grading_sheet import generate_grading_sheet, format_grading_sheet


def cleanup_test_data():
    if os.path.exists(STORAGE_DIR):
        shutil.rmtree(STORAGE_DIR)
    sample_dir = "sample_data"
    if os.path.exists(sample_dir):
        shutil.rmtree(sample_dir)
    grading_dir = "grading_reports"
    if os.path.exists(grading_dir):
        shutil.rmtree(grading_dir)


class TestDataModels(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cleanup_test_data()

    @classmethod
    def tearDownClass(cls):
        cleanup_test_data()

    def test_enum_values(self):
        self.assertEqual(MeasurementMethod.STANDING_WAVE.value, "驻波法")
        self.assertEqual(MeasurementMethod.PHASE_COMPARISON.value, "相位比较法")
        self.assertEqual(AnomalyType.SAMPLING_GAP.value, "采样缺口")
        self.assertEqual(AnomalyType.UNIT_CONVERSION_ERROR.value, "单位换算错误")
        self.assertEqual(AnomalyType.ZERO_DRIFT.value, "零点漂移")
        self.assertEqual(Status.PENDING.value, "待确认")
        self.assertEqual(Status.NORMAL.value, "正常")

    def test_theoretical_velocity(self):
        v0 = calculate_theoretical_velocity(0)
        self.assertAlmostEqual(v0, 331.45, places=1)

        v20 = calculate_theoretical_velocity(20)
        self.assertAlmostEqual(v20, 343.45, places=1)

        v25 = calculate_theoretical_velocity(25)
        self.assertAlmostEqual(v25, 346.45, places=1)


class TestStorage(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cleanup_test_data()

    @classmethod
    def tearDownClass(cls):
        cleanup_test_data()

    def test_create_and_get_batch(self):
        if batch_exists("TEST001"):
            import shutil
            cleanup_test_data()
        batch = create_batch(
            batch_id="TEST001",
            material_name="空气",
            student_name="测试学生",
            student_id="2023001",
            experiment_date="2026-05-31"
        )

        self.assertEqual(batch.batch_id, "TEST001")
        self.assertEqual(batch.student_name, "测试学生")
        self.assertTrue(batch_exists("TEST001"))
        self.assertFalse(batch_exists("NONEXIST"))

        retrieved = get_batch("TEST001")
        self.assertEqual(retrieved.batch_id, "TEST001")
        self.assertEqual(retrieved.student_id, "2023001")

    def test_duplicate_batch_error(self):
        with self.assertRaises(ValueError):
            create_batch(
                batch_id="TEST001",
                material_name="空气",
                student_name="另一个学生",
                student_id="2023002",
                experiment_date="2026-05-31"
            )

    def test_data_hash_deduplication(self):
        data1 = [{"timestamp": 0.1, "position": 1.0, "amplitude": 2.0, "phase": 0.0}]
        data2 = [{"timestamp": 0.1, "position": 1.0, "amplitude": 2.0, "phase": 0.0}]
        data3 = [{"timestamp": 0.1, "position": 2.0, "amplitude": 2.0, "phase": 0.0}]

        hash1 = compute_data_hash(data1)
        hash2 = compute_data_hash(data2)
        hash3 = compute_data_hash(data3)

        self.assertEqual(hash1, hash2)
        self.assertNotEqual(hash1, hash3)

    def test_add_sensor_log_versioning(self):
        if not batch_exists("TEST001"):
            create_batch(
                batch_id="TEST001",
                material_name="空气",
                student_name="测试学生",
                student_id="2023001",
                experiment_date="2026-05-31"
            )
        batch, version, is_new = add_sensor_log(
            batch_id="TEST001",
            raw_data=[{"timestamp": 0.1, "position": 1.0, "amplitude": 2.0, "phase": 0.0}],
            filename="test.csv"
        )
        self.assertEqual(version, 1)
        self.assertTrue(is_new)

        batch, version, is_new = add_sensor_log(
            batch_id="TEST001",
            raw_data=[{"timestamp": 0.1, "position": 1.0, "amplitude": 2.0, "phase": 0.0}],
            filename="test_duplicate.csv"
        )
        self.assertEqual(version, 1)
        self.assertFalse(is_new)

        batch, version, is_new = add_sensor_log(
            batch_id="TEST001",
            raw_data=[{"timestamp": 0.1, "position": 2.0, "amplitude": 2.0, "phase": 0.0}],
            filename="test_v2.csv"
        )
        self.assertEqual(version, 2)
        self.assertTrue(is_new)

        batch = get_batch("TEST001")
        self.assertEqual(len(batch.logs), 2)


class TestAnomalyDetection(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cleanup_test_data()

    @classmethod
    def tearDownClass(cls):
        cleanup_test_data()

    def test_detect_sampling_gaps(self):
        normal_data = []
        for i in range(10):
            normal_data.append({
                "timestamp": i * 0.1,
                "position": i * 1.0,
                "amplitude": 5.0,
                "phase": 0.0
            })
        gaps = detect_sampling_gaps(normal_data)
        self.assertEqual(len(gaps), 0)

        gap_data = normal_data.copy()
        gap_data[5]["timestamp"] = 1.0
        gaps = detect_sampling_gaps(gap_data)
        self.assertGreaterEqual(len(gaps), 1)
        self.assertEqual(gaps[0].anomaly_type, AnomalyType.SAMPLING_GAP)

    def test_detect_unit_conversion_errors(self):
        normal_data = []
        for i in range(12):
            normal_data.append({
                "timestamp": i * 0.1,
                "position": i * 4.2875,
                "amplitude": 5.0 * abs((i % 2) - 0.5) * 2,
                "phase": (i * 180) % 360
            })
        errors = detect_unit_conversion_errors(normal_data)
        self.assertEqual(len(errors), 0)

        unit_error_data = normal_data.copy()
        for i in range(6, 12):
            unit_error_data[i] = unit_error_data[i].copy()
            unit_error_data[i]["position"] = unit_error_data[i]["position"] / 1000

        errors = detect_unit_conversion_errors(unit_error_data)
        self.assertGreaterEqual(len(errors), 1)
        self.assertEqual(errors[0].anomaly_type, AnomalyType.UNIT_CONVERSION_ERROR)
        self.assertIn("1000", errors[0].description)

    def test_detect_zero_drift(self):
        normal_data = []
        for i in range(12):
            normal_data.append({
                "timestamp": i * 0.1,
                "position": i * 4.2875,
                "amplitude": 5.0 * abs((i % 2) - 0.5) * 2,
                "phase": (i * 180) % 360
            })
        drifts = detect_zero_drift(normal_data, method="驻波法")
        self.assertEqual(len(drifts), 0)

        drift_data = []
        offset = 500.0
        for i in range(12):
            drift_data.append({
                "timestamp": i * 0.1,
                "position": offset + i * 4.2875,
                "amplitude": 5.0 * abs((i % 2) - 0.5) * 2,
                "phase": (i * 180) % 360
            })
        drifts = detect_zero_drift(drift_data, method="驻波法")
        self.assertGreaterEqual(len(drifts), 1)
        self.assertEqual(drifts[0].anomaly_type, AnomalyType.ZERO_DRIFT)

    def test_determine_status_logic(self):
        from models import JudgmentTrail, AnomalyMark

        trails = []

        gaps = [AnomalyMark(anomaly_type=AnomalyType.SAMPLING_GAP, description="test")]
        status = determine_status(gaps, 1.0, trails)
        self.assertEqual(status, Status.PENDING)

        trails = []
        unit_errors = [AnomalyMark(anomaly_type=AnomalyType.UNIT_CONVERSION_ERROR, description="test")]
        status = determine_status(unit_errors, 1.0, trails)
        self.assertEqual(status, Status.PENDING)

        trails = []
        drifts = [AnomalyMark(anomaly_type=AnomalyType.ZERO_DRIFT, description="test")]
        status = determine_status(drifts, 1.0, trails)
        self.assertEqual(status, Status.PENDING)

        trails = []
        status = determine_status([], 6.0, trails)
        self.assertEqual(status, Status.PENDING)

        trails = []
        status = determine_status([], 3.0, trails)
        self.assertEqual(status, Status.NORMAL)

        trails = []
        status = determine_status([], 1.0, trails)
        self.assertEqual(status, Status.NORMAL)


class TestCalibration(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cleanup_test_data()
        cls.normal_file = generate_sample_data(
            "TEST_CALIB",
            has_unit_error=False,
            has_sampling_gap=False,
            has_zero_drift=False
        )
        cls.normal_data = parse_csv(cls.normal_file)

    @classmethod
    def tearDownClass(cls):
        cleanup_test_data()

    def test_progressive_difference_method(self):
        import numpy as np

        values = np.array([0.0, 1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0, 11.0])
        avg_diff, std_diff, trails = progressive_difference_method(values, group_size=6)

        self.assertAlmostEqual(avg_diff, 1.0, places=5)
        self.assertGreater(len(trails), 0)
        self.assertTrue(any("逐差法" in t.criterion for t in trails))

    def test_standing_wave_calibration_normal(self):
        result, info = standing_wave_calibration(
            data=self.normal_data,
            frequency=40000.0,
            temperature=20.0,
            position_unit="mm"
        )

        self.assertEqual(result.method, MeasurementMethod.STANDING_WAVE)
        self.assertGreater(result.measured_velocity, 300)
        self.assertLess(result.measured_velocity, 400)
        self.assertGreater(len(result.judgment_trails), 0)
        self.assertTrue(any("逐差法" in t.criterion for t in result.judgment_trails))
        self.assertTrue(any("声速计算" in t.criterion for t in result.judgment_trails))

    def test_phase_comparison_calibration_normal(self):
        result, info = phase_comparison_calibration(
            data=self.normal_data,
            frequency=40000.0,
            temperature=20.0,
            position_unit="mm"
        )

        self.assertEqual(result.method, MeasurementMethod.PHASE_COMPARISON)
        self.assertGreater(result.measured_velocity, 300)
        self.assertLess(result.measured_velocity, 400)
        self.assertGreater(len(result.judgment_trails), 0)

    def test_calibration_with_unit_error(self):
        unit_error_file = generate_sample_data(
            "TEST_CALIB_UNIT",
            has_unit_error=True,
            has_sampling_gap=False,
            has_zero_drift=False
        )
        unit_error_data = parse_csv(unit_error_file)

        result, info = standing_wave_calibration(
            data=unit_error_data,
            frequency=40000.0,
            temperature=20.0,
            position_unit="mm"
        )

        self.assertEqual(result.status, Status.PENDING)
        self.assertTrue(any(a.anomaly_type == AnomalyType.UNIT_CONVERSION_ERROR for a in result.anomalies))

    def test_calibration_with_sampling_gap(self):
        gap_file = generate_sample_data(
            "TEST_CALIB_GAP",
            has_unit_error=False,
            has_sampling_gap=True,
            has_zero_drift=False
        )
        gap_data = parse_csv(gap_file)

        result, info = standing_wave_calibration(
            data=gap_data,
            frequency=40000.0,
            temperature=20.0,
            position_unit="mm"
        )

        self.assertEqual(result.status, Status.PENDING)
        self.assertTrue(any(a.anomaly_type == AnomalyType.SAMPLING_GAP for a in result.anomalies))

    def test_judgment_trail_presence(self):
        result, info = standing_wave_calibration(
            data=self.normal_data,
            frequency=40000.0,
            temperature=20.0,
            position_unit="mm"
        )

        expected_criteria = [
            "校准方法选择",
            "单位换算确认",
            "波峰检测算法",
            "波长计算",
            "声速计算",
            "理论声速计算",
            "相对误差计算",
            "最终状态判定"
        ]

        actual_criteria = [t.criterion for t in result.judgment_trails]
        for criterion in expected_criteria:
            self.assertTrue(
                any(criterion in actual for actual in actual_criteria),
                f"缺少判断轨迹: {criterion}"
            )

        for trail in result.judgment_trails:
            self.assertIsNotNone(trail.reason)
            self.assertIsNotNone(trail.result)
            self.assertIsNotNone(trail.timestamp)


class TestVersionDiff(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cleanup_test_data()

    @classmethod
    def tearDownClass(cls):
        cleanup_test_data()

    def test_compare_raw_data_identical(self):
        data1 = [
            {"timestamp": 0.1, "position": 1.0, "amplitude": 2.0, "phase": 0.0},
            {"timestamp": 0.2, "position": 2.0, "amplitude": 3.0, "phase": 180.0}
        ]
        diffs = compare_raw_data(data1, data1)
        self.assertEqual(len(diffs), 0)

    def test_compare_raw_data_different(self):
        data1 = [
            {"timestamp": 0.1, "position": 1.0, "amplitude": 2.0, "phase": 0.0},
            {"timestamp": 0.2, "position": 2.0, "amplitude": 3.0, "phase": 180.0}
        ]
        data2 = [
            {"timestamp": 0.1, "position": 1.0, "amplitude": 2.0, "phase": 0.0},
            {"timestamp": 0.2, "position": 0.002, "amplitude": 3.0, "phase": 180.0}
        ]
        diffs = compare_raw_data(data1, data2)
        self.assertGreater(len(diffs), 0)
        self.assertTrue(any("1000倍" in d.impact for d in diffs))

    def test_compare_raw_data_length(self):
        data1 = [
            {"timestamp": 0.1, "position": 1.0, "amplitude": 2.0, "phase": 0.0},
            {"timestamp": 0.2, "position": 2.0, "amplitude": 3.0, "phase": 180.0}
        ]
        data2 = [
            {"timestamp": 0.1, "position": 1.0, "amplitude": 2.0, "phase": 0.0},
            {"timestamp": 0.2, "position": 2.0, "amplitude": 3.0, "phase": 180.0},
            {"timestamp": 0.3, "position": 3.0, "amplitude": 4.0, "phase": 0.0}
        ]
        diffs = compare_raw_data(data1, data2)
        self.assertTrue(any("新增数据点" in d.field for d in diffs))

    def test_compare_anomalies(self):
        from models import AnomalyMark

        old = [AnomalyMark(anomaly_type=AnomalyType.SAMPLING_GAP, description="gap1", position="pos1")]
        new = [AnomalyMark(anomaly_type=AnomalyType.UNIT_CONVERSION_ERROR, description="unit1", position="pos2")]

        changes = compare_anomalies(old, new)
        self.assertTrue(any("异常消失" in c for c in changes))
        self.assertTrue(any("新增异常" in c for c in changes))
        self.assertIn("采样缺口", changes[0])
        self.assertIn("单位换算错误", changes[1])


class TestGradingSheet(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cleanup_test_data()

        create_batch(
            batch_id="TEST_GRADING",
            material_name="空气",
            student_name="测试学生",
            student_id="2023001",
            experiment_date="2026-05-31"
        )

        data_file = generate_sample_data(
            "TEST_GRADING",
            has_unit_error=True,
            has_sampling_gap=True,
            has_zero_drift=False
        )
        data = parse_csv(data_file)

        add_sensor_log("TEST_GRADING", data, "test.csv")

        from calibration import run_full_calibration
        from storage import add_calibration_record

        results = run_full_calibration(data, 40000.0, 20.0, "mm")
        for r in results:
            add_calibration_record("TEST_GRADING", r)

    @classmethod
    def tearDownClass(cls):
        cleanup_test_data()

    def test_generate_grading_sheet(self):
        sheet = generate_grading_sheet("TEST_GRADING")

        self.assertEqual(sheet.batch_id, "TEST_GRADING")
        self.assertEqual(sheet.student_name, "测试学生")
        self.assertEqual(sheet.final_status, "待确认")
        self.assertIn("驻波法", sheet.methods_used)
        self.assertIn("相位比较法", sheet.methods_used)
        self.assertGreater(len(sheet.results_summary), 0)
        self.assertGreater(len(sheet.anomalies_found), 0)
        self.assertGreater(len(sheet.reasons), 0)
        self.assertGreater(len(sheet.next_steps), 0)

    def test_format_grading_sheet_text(self):
        sheet = generate_grading_sheet("TEST_GRADING")
        text = format_grading_sheet(sheet, "text")

        self.assertIn("声速测量校准实验", text)
        self.assertIn("批改表", text)
        self.assertIn("测试学生", text)
        self.assertIn("待确认", text)
        self.assertIn("测量结果汇总", text)
        self.assertIn("检测到的异常", text)
        self.assertIn("自动判断理由", text)
        self.assertIn("下一步操作建议", text)
        self.assertIn("单位换算错误", text)

    def test_format_grading_sheet_markdown(self):
        sheet = generate_grading_sheet("TEST_GRADING")
        md = format_grading_sheet(sheet, "markdown")

        self.assertIn("# 声速测量校准实验", md)
        self.assertIn("| 项目 | 内容 |", md)
        self.assertIn("## 一、测量结果汇总", md)
        self.assertIn("待确认", md)
        self.assertIn("**重要说明**", md)

    def test_next_steps_contains_specific_guidance(self):
        sheet = generate_grading_sheet("TEST_GRADING")

        has_unit_guidance = any("单位换算错误" in step and "mm" in step for step in sheet.next_steps)
        has_gap_guidance = any("采样缺口" in step for step in sheet.next_steps)

        self.assertTrue(has_unit_guidance, "缺少单位换算错误的具体指导")
        self.assertTrue(has_gap_guidance, "缺少采样缺口的具体指导")

    def test_reasons_contains_judgment_trail(self):
        sheet = generate_grading_sheet("TEST_GRADING")

        has_judgment = any("自动判断依据" in reason for reason in sheet.reasons)
        self.assertTrue(has_judgment, "缺少自动判断依据的说明")


class TestEndToEndWorkflow(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cleanup_test_data()

    @classmethod
    def tearDownClass(cls):
        cleanup_test_data()

    def test_full_workflow_normal_data(self):
        from sound_velocity_calibration import SoundVelocityCalibrator

        calibrator = SoundVelocityCalibrator()

        data_file = calibrator.generate_test_data(
            "E2E_NORMAL",
            has_unit_error=False,
            has_sampling_gap=False,
            has_zero_drift=False
        )

        filename, version, is_new = calibrator.import_data(
            file_path=data_file,
            batch_id="E2E_NORMAL",
            student_name="端到端测试",
            student_id="E2E001",
            experiment_date="2026-05-31"
        )

        self.assertEqual(version, 1)
        self.assertTrue(is_new)

        results = calibrator.calibrate(
            batch_id="E2E_NORMAL",
            frequency=40000.0,
            temperature=20.0,
            position_unit="mm"
        )

        self.assertEqual(len(results), 2)
        self.assertEqual(results[0].status, Status.NORMAL)
        self.assertEqual(results[1].status, Status.NORMAL)

        for r in results:
            self.assertGreater(r.measured_velocity, 330)
            self.assertLess(r.measured_velocity, 350)
            self.assertLess(r.relative_error, 5.0)

        sheet_text = calibrator.get_grading_sheet("E2E_NORMAL", format_type="text")
        self.assertIn("🟢 正常", sheet_text)
        self.assertNotIn("🔴 待确认", sheet_text)

    def test_full_workflow_anomalous_data(self):
        from sound_velocity_calibration import SoundVelocityCalibrator

        calibrator = SoundVelocityCalibrator()

        data_file = calibrator.generate_test_data(
            "E2E_ANOMALY",
            has_unit_error=True,
            has_sampling_gap=True,
            has_zero_drift=True
        )

        calibrator.import_data(
            file_path=data_file,
            batch_id="E2E_ANOMALY",
            student_name="异常测试",
            student_id="E2E002",
            experiment_date="2026-05-31"
        )

        results = calibrator.calibrate(
            batch_id="E2E_ANOMALY",
            frequency=40000.0,
            temperature=20.0,
            position_unit="mm"
        )

        for r in results:
            self.assertEqual(r.status, Status.PENDING)

        sheet = generate_grading_sheet("E2E_ANOMALY")
        self.assertEqual(sheet.final_status, "待确认")

        anomaly_types = [a["异常类型"] for a in sheet.anomalies_found]
        self.assertIn("采样缺口", anomaly_types)
        self.assertIn("单位换算错误", anomaly_types)
        self.assertIn("零点漂移", anomaly_types)

    def test_full_workflow_version_updates(self):
        from sound_velocity_calibration import SoundVelocityCalibrator

        calibrator = SoundVelocityCalibrator()

        bad_file = calibrator.generate_test_data(
            "E2E_VERSION",
            has_unit_error=True,
            has_sampling_gap=False,
            has_zero_drift=False
        )

        calibrator.import_data(
            file_path=bad_file,
            batch_id="E2E_VERSION",
            student_name="版本测试",
            student_id="E2E003",
            experiment_date="2026-05-31"
        )

        results_v1 = calibrator.calibrate(
            batch_id="E2E_VERSION",
            frequency=40000.0,
            temperature=20.0,
            position_unit="mm"
        )

        self.assertEqual(results_v1[0].status, Status.PENDING)

        good_file = calibrator.generate_test_data(
            "E2E_VERSION_V2",
            has_unit_error=False,
            has_sampling_gap=False,
            has_zero_drift=False
        )

        calibrator.import_data(
            file_path=good_file,
            batch_id="E2E_VERSION",
            student_name="版本测试",
            student_id="E2E003",
            experiment_date="2026-05-31"
        )

        batch = get_batch("E2E_VERSION")
        self.assertEqual(len(batch.logs), 2)

        results_v2 = calibrator.calibrate(
            batch_id="E2E_VERSION",
            frequency=40000.0,
            temperature=20.0,
            position_unit="mm"
        )

        batch = get_batch("E2E_VERSION")
        self.assertEqual(len(batch.calibration_records), 4)

        diff_report = calibrator.get_version_diff("E2E_VERSION", 1, 2)
        self.assertIn("版本差异报告", diff_report)
        self.assertIn("单位换算错误", diff_report)

        sheet = calibrator.get_grading_sheet("E2E_VERSION", format_type="text")
        self.assertIn("多个版本", sheet)

        v1_log = get_batch("E2E_VERSION").logs[0]
        v2_log = get_batch("E2E_VERSION").logs[1]
        self.assertNotEqual(v1_log.data_hash, v2_log.data_hash)
        self.assertEqual(v1_log.version, 1)
        self.assertEqual(v2_log.version, 2)


if __name__ == "__main__":
    unittest.main(verbosity=2)
