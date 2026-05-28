#!/usr/bin/env python3

import os
import sys
import unittest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import math
from models import (
    StudentRecord,
    GratingConstant,
    ScreenDistance,
    FringePosition,
    SourceType,
    AngleUnit,
)
import diffraction
import error_propagation
import anomaly_detector


class TestDiffractionCalculation(unittest.TestCase):
    """测试衍射计算核心模块"""

    def setUp(self):
        self.grating_constant = GratingConstant(
            value=1.0 / 300 * 1e-3,
            unit="m",
            uncertainty=1e-6,
        )
        self.screen_distance = ScreenDistance(
            value=1.5,
            unit="m",
            uncertainty=0.002,
        )

    def test_angle_conversion_degree_to_radian(self):
        """测试角度单位转换：度→弧度"""
        result = diffraction.convert_angle(30, AngleUnit.DEGREE, AngleUnit.RADIAN)
        self.assertAlmostEqual(result, math.pi / 6, places=6)

    def test_angle_conversion_radian_to_degree(self):
        """测试角度单位转换：弧度→度"""
        result = diffraction.convert_angle(math.pi / 4, AngleUnit.RADIAN, AngleUnit.DEGREE)
        self.assertAlmostEqual(result, 45, places=6)

    def test_angle_from_position(self):
        """测试从位置计算角度"""
        angle = diffraction.calculate_angle_from_position(0.1, 1.0)
        expected = math.atan(0.1 / 1.0)
        self.assertAlmostEqual(angle, expected, places=6)

    def test_grating_equation(self):
        """测试光栅方程计算"""
        d = 1.0 / 300 * 1e-3
        theta = math.radians(10)
        k = 1

        lambda_m, trace = diffraction.grating_equation(d, theta, k)
        expected = d * math.sin(theta) / k

        self.assertAlmostEqual(lambda_m, expected, places=10)
        self.assertIn("equation", trace)
        self.assertIn("calculation", trace)

    def test_grating_equation_zero_order(self):
        """测试零级条纹报错"""
        with self.assertRaises(ValueError):
            diffraction.grating_equation(1e-6, 0, 0)

    def test_calculate_wavelength(self):
        """测试完整波长计算"""
        fringe = FringePosition(
            order=1,
            side="right",
            position=0.082,
            unit="m",
            uncertainty=0.0005,
        )

        result, trace = diffraction.calculate_wavelength(
            self.grating_constant,
            fringe,
            self.screen_distance,
        )

        self.assertIsNotNone(result.value)
        self.assertGreater(result.value, 100e-9)
        self.assertLess(result.value, 800e-9)
        self.assertEqual(result.order, 1)
        self.assertIn("wavelength_nm", trace)


class TestErrorPropagation(unittest.TestCase):
    """测试误差传播分析模块"""

    def setUp(self):
        self.grating_constant = GratingConstant(
            value=1.0 / 300 * 1e-3,
            unit="m",
            uncertainty=1e-6,
        )
        self.screen_distance = ScreenDistance(
            value=1.5,
            unit="m",
            uncertainty=0.002,
        )
        self.fringe = FringePosition(
            order=1,
            side="right",
            position=0.082,
            unit="m",
            uncertainty=0.0005,
        )

    def test_partial_derivatives(self):
        """测试偏导数计算"""
        dx = error_propagation.partial_derivative_theta_x(0.1, 1.0)
        dL = error_propagation.partial_derivative_theta_L(0.1, 1.0)

        self.assertIsInstance(dx, float)
        self.assertIsInstance(dL, float)
        self.assertGreater(dx, 0)
        self.assertLess(dL, 0)

    def test_angle_uncertainty(self):
        """测试角度不确定度计算"""
        delta_theta, trace = error_propagation.calculate_angle_uncertainty(
            self.fringe,
            self.screen_distance,
        )

        self.assertGreater(delta_theta, 0)
        self.assertIn("method", trace)
        self.assertIn("components", trace)

    def test_wavelength_uncertainty(self):
        """测试波长不确定度计算"""
        delta_lambda, trace = error_propagation.calculate_wavelength_uncertainty(
            self.grating_constant,
            self.fringe,
            self.screen_distance,
        )

        self.assertGreater(delta_lambda, 0)
        self.assertIn("components", trace)
        self.assertIn("formula", trace["components"])

    def test_final_uncertainty(self):
        """测试最终不确定度合成"""
        from models import WavelengthResult

        results = [
            WavelengthResult(value=546e-9, uncertainty=2e-9, order=1),
            WavelengthResult(value=548e-9, uncertainty=3e-9, order=2),
        ]

        final_unc, trace = error_propagation.calculate_final_uncertainty(results)

        self.assertGreater(final_unc, 0)
        self.assertIn("weighted_average_m", trace)
        self.assertIn("final_uncertainty_m", trace)


class TestAnomalyDetector(unittest.TestCase):
    """测试异常检测模块"""

    def setUp(self):
        self.student_record = StudentRecord(
            student_id="test001",
            student_name="测试学生",
        )
        self.student_record.grating_constant = GratingConstant(
            value=1.0 / 300 * 1e-3,
            unit="m",
            uncertainty=1e-6,
        )
        self.student_record.screen_distance = ScreenDistance(
            value=1.5,
            unit="m",
            uncertainty=0.002,
        )
        self.student_record.reference_wavelength = 546.1e-9

    def test_detect_missing_center_fringe(self):
        """测试检测缺失零级条纹"""
        fringe = FringePosition(order=1, side="right", position=0.082, unit="m")
        self.student_record.add_fringe(fringe)

        anomalies = anomaly_detector.detect_missing_fringes(self.student_record)

        self.assertTrue(any(a.anomaly_type == "条纹缺失" for a in anomalies))

    def test_detect_order_confusion(self):
        """测试检测级次混淆"""
        from models import WavelengthResult

        results = [
            WavelengthResult(value=546e-9, order=1, fringe_id="f1"),
            WavelengthResult(value=550e-9, order=1, fringe_id="f2"),
            WavelengthResult(value=820e-9, order=2, fringe_id="f3"),
        ]

        anomalies = anomaly_detector.detect_order_confusion(
            self.student_record, results
        )

        self.assertTrue(any(a.anomaly_type == "级次混淆" for a in anomalies))

    def test_detect_angle_unit_error_too_large(self):
        """测试检测角度单位错误（过大）"""
        fringe = FringePosition(
            order=1,
            side="right",
            position=0,
            unit="m",
            angle=57.3,
            angle_unit=AngleUnit.RADIAN,
        )
        self.student_record.add_fringe(fringe)

        anomalies = anomaly_detector.detect_angle_unit_errors(self.student_record)

        self.assertTrue(any(a.anomaly_type == "角度单位错误" for a in anomalies))

    def test_detect_symmetry_error(self):
        """测试检测对称性异常"""
        self.student_record.add_fringe(
            FringePosition(order=-1, side="left", position=-0.08, unit="m")
        )
        self.student_record.add_fringe(
            FringePosition(order=1, side="right", position=0.12, unit="m")
        )

        anomalies = anomaly_detector.detect_symmetry_errors(
            self.student_record, tolerance_ratio=0.1
        )

        self.assertTrue(any(a.anomaly_type == "对称性异常" for a in anomalies))

    def test_detect_data_inconsistency(self):
        """测试检测数据不一致"""
        from models import WavelengthResult

        results = [
            WavelengthResult(value=500e-9, uncertainty=1e-9, order=1),
            WavelengthResult(value=550e-9, uncertainty=1e-9, order=1),
            WavelengthResult(value=600e-9, uncertainty=1e-9, order=2),
        ]

        anomalies = anomaly_detector.detect_data_inconsistency(results, cv_threshold=0.05)

        self.assertTrue(any(a.anomaly_type == "数据不一致" for a in anomalies))


class TestFullWorkflow(unittest.TestCase):
    """测试完整工作流程"""

    def test_complete_analysis_workflow(self):
        """测试完整分析流程"""
        record = StudentRecord(
            student_id="test001",
            student_name="测试学生",
            experiment_name="光栅衍射测波长",
        )

        record.grating_constant = GratingConstant(
            value=1.0 / 300 * 1e-3,
            unit="m",
            uncertainty=1e-6,
        )

        record.screen_distance = ScreenDistance(
            value=1.5,
            unit="m",
            uncertainty=0.002,
        )

        record.reference_wavelength = 546.1e-9

        fringes_data = [
            (0, "center", 0.0, 0.0005),
            (-1, "left", -0.082, 0.0005),
            (1, "right", 0.0818, 0.0005),
            (-2, "left", -0.167, 0.0005),
            (2, "right", 0.1665, 0.0005),
        ]

        for order, side, pos, unc in fringes_data:
            record.add_fringe(
                FringePosition(
                    order=order,
                    side=side,
                    position=pos,
                    unit="m",
                    uncertainty=unc,
                )
            )

        wavelength_results, traces = diffraction.calculate_wavelengths(record)
        self.assertGreater(len(wavelength_results), 0)

        for r in wavelength_results:
            self.assertGreater(r.value, 100e-9)
            self.assertLess(r.value, 800e-9)

        updated_results, err_traces = error_propagation.propagate_uncertainties(
            record, wavelength_results
        )

        for r in updated_results:
            self.assertGreater(r.uncertainty, 0)

        anomalies, anomaly_trace = anomaly_detector.detect_all_anomalies(
            record, updated_results, expected_max_order=3
        )

        self.assertIsInstance(anomalies, list)
        self.assertIsInstance(anomaly_trace, dict)


def run_all_tests():
    """运行所有测试"""
    print("=" * 60)
    print("运行光栅衍射分析工具测试套件")
    print("=" * 60)

    loader = unittest.TestLoader()
    suite = unittest.TestSuite()

    suite.addTests(loader.loadTestsFromTestCase(TestDiffractionCalculation))
    suite.addTests(loader.loadTestsFromTestCase(TestErrorPropagation))
    suite.addTests(loader.loadTestsFromTestCase(TestAnomalyDetector))
    suite.addTests(loader.loadTestsFromTestCase(TestFullWorkflow))

    runner = unittest.TextTestRunner(verbosity=2)
    result = runner.run(suite)

    print("\n" + "=" * 60)
    if result.wasSuccessful():
        print("✅ 所有测试通过!")
    else:
        print(f"❌ 测试失败: {len(result.failures)} 失败, {len(result.errors)} 错误")
    print("=" * 60)

    return result.wasSuccessful()


if __name__ == "__main__":
    success = run_all_tests()
    sys.exit(0 if success else 1)
