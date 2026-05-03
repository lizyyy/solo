"""titration-tool 单元测试"""

import os
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent.parent))

from titration_tool.models import (
    TitrationPoint,
    TitrationCurve,
    EquivalencePoint,
    FitResult,
    AnalysisParams,
    DataQuality,
    SampleType,
    default_stock_solutions,
    default_buffer_systems,
    default_experiment_config,
)
from titration_tool import parser as data_parser
from titration_tool import calculation
from titration_tool import buffer_solver
from titration_tool import reporter


class TestModels(unittest.TestCase):
    """测试数据模型"""
    
    def test_titration_point(self):
        """测试滴定点"""
        point = TitrationPoint(volume=10.0, ph=7.0, temperature=25.0, index=5)
        self.assertEqual(point.volume, 10.0)
        self.assertEqual(point.ph, 7.0)
        self.assertEqual(point.temperature, 25.0)
        self.assertEqual(point.index, 5)
        self.assertFalse(point.is_outlier)
    
    def test_titration_curve(self):
        """测试滴定曲线"""
        points = [
            TitrationPoint(volume=0.0, ph=13.0),
            TitrationPoint(volume=5.0, ph=12.5),
            TitrationPoint(volume=10.0, ph=7.0),
            TitrationPoint(volume=15.0, ph=2.0),
        ]
        curve = TitrationCurve(sample_id="Test001", points=points)
        
        self.assertEqual(curve.sample_id, "Test001")
        self.assertEqual(len(curve.points), 4)
        self.assertEqual(curve.initial_ph, 13.0)
        self.assertEqual(curve.final_ph, 2.0)
        self.assertEqual(curve.min_ph, 2.0)
        self.assertEqual(curve.max_ph, 13.0)
    
    def test_default_config(self):
        """测试默认配置"""
        config = default_experiment_config()
        
        self.assertIsNotNone(config)
        self.assertEqual(config.experiment_name, "默认酸碱滴定实验")
        self.assertGreater(len(config.buffer_systems), 0)
        self.assertGreater(len(config.stock_solutions), 0)
        
        self.assertIn("Phosphate", config.buffer_systems)
        self.assertIn("Acetate", config.buffer_systems)
        self.assertIn("Tris", config.buffer_systems)


class TestParser(unittest.TestCase):
    """测试数据解析"""
    
    def setUp(self):
        """设置临时测试文件"""
        self.test_dir = tempfile.mkdtemp()
        
        self.csv_content = """样品编号,Test001
温度(°C),25.0
体积(mL),pH
0.00,13.00
1.00,12.89
2.00,12.76
3.00,12.60
4.00,12.40
5.00,12.15
6.00,11.83
7.00,11.40
8.00,10.80
9.00,9.90
9.50,9.10
9.80,8.30
9.90,7.90
9.95,7.40
10.00,7.00
10.05,6.60
10.10,6.10
10.20,5.70
10.50,5.10
11.00,4.60
12.00,4.10
13.00,3.80
14.00,3.60
15.00,3.45
"""
        self.csv_path = os.path.join(self.test_dir, "test_titration.csv")
        with open(self.csv_path, 'w', encoding='utf-8') as f:
            f.write(self.csv_content)
    
    def tearDown(self):
        """清理临时文件"""
        import shutil
        shutil.rmtree(self.test_dir)
    
    def test_parse_valid_csv(self):
        """测试解析有效的CSV文件"""
        result = data_parser.parse_titration_csv(self.csv_path)
        
        self.assertTrue(result.success)
        self.assertEqual(result.sample_id, "Test001")
        self.assertGreater(result.point_count, 0)
        self.assertIsNotNone(result.curve)
        self.assertEqual(len(result.errors), 0)
    
    def test_validate_point(self):
        """测试数据点验证"""
        errors = data_parser.validate_point(10.0, 7.0, 25.0)
        self.assertEqual(len(errors), 0)
        
        errors = data_parser.validate_point(-1.0, 7.0)
        self.assertGreater(len(errors), 0)
        
        errors = data_parser.validate_point(10.0, 15.0)
        self.assertGreater(len(errors), 0)
        
        errors = data_parser.validate_point(10.0, -1.0)
        self.assertGreater(len(errors), 0)
    
    def test_detect_csv_format(self):
        """测试CSV格式检测"""
        info = data_parser.detect_csv_format(self.csv_path)
        
        self.assertEqual(info.sample_id, "Test001")
        self.assertEqual(info.temperature, 25.0)
        self.assertTrue(info.has_header_row)
        self.assertIn('volume', info.column_indices)
        self.assertIn('ph', info.column_indices)


class TestCalculation(unittest.TestCase):
    """测试数值计算"""
    
    def setUp(self):
        """创建测试数据"""
        self.params = AnalysisParams()
        
        volumes = np.linspace(0, 15, 50)
        ph_values = []
        
        for v in volumes:
            if v < 10:
                oh_conc = 0.1 * (10 - v) / (50 + v)
                if oh_conc > 0:
                    ph = 14 + np.log10(oh_conc)
                else:
                    ph = 7.0
            elif v == 10:
                ph = 7.0
            else:
                h_conc = 0.1 * (v - 10) / (50 + v)
                if h_conc > 0:
                    ph = -np.log10(h_conc)
                else:
                    ph = 7.0
            ph_values.append(min(max(ph, 0.1), 13.9))
        
        points = [
            TitrationPoint(volume=float(v), ph=float(ph), index=i)
            for i, (v, ph) in enumerate(zip(volumes, ph_values))
        ]
        
        self.curve = TitrationCurve(
            sample_id="TestCurve",
            points=points,
            temperature=25.0,
        )
    
    def test_savitzky_golay(self):
        """测试Savitzky-Golay平滑"""
        x = np.linspace(0, 10, 100)
        y = np.sin(x) + np.random.normal(0, 0.1, 100)
        
        smoothed = calculation.savitzky_golay(y, window_size=5, polyorder=2)
        
        self.assertEqual(len(smoothed), len(y))
        
        original_noise = np.std(y - np.sin(x))
        smoothed_noise = np.std(smoothed - np.sin(x))
        self.assertLess(smoothed_noise, original_noise)
    
    def test_calculate_derivative(self):
        """测试导数计算"""
        x = np.linspace(0, 2 * np.pi, 100)
        y = np.sin(x)
        
        dy = calculation.calculate_derivative(x, y, order=1)
        d2y = calculation.calculate_derivative(x, y, order=2)
        
        self.assertEqual(len(dy), len(y))
        
        expected_dy = np.cos(x)
        max_error = np.max(np.abs(dy[1:-1] - expected_dy[1:-1]))
        self.assertLess(max_error, 0.1)
    
    def test_find_equivalence_points(self):
        """测试等当点检测"""
        eps = calculation.find_equivalence_points(
            x=np.array([p.volume for p in self.curve.points]),
            y=np.array([p.ph for p in self.curve.points]),
            method="second_derivative",
            threshold=0.01,
        )
        
        self.assertGreater(len(eps), 0)
        
        if eps:
            primary = max(eps, key=lambda ep: ep.confidence)
            self.assertAlmostEqual(primary.volume, 10.0, delta=1.0)
    
    def test_detect_outliers_iqr(self):
        """测试IQR离群点检测"""
        y = np.array([1.0, 2.0, 2.1, 1.9, 2.0, 2.2, 1.8, 10.0, 2.1, 1.9])
        
        outliers = calculation.detect_outliers_iqr(y, iqr_factor=1.5)
        
        self.assertIn(7, outliers)
    
    def test_analyze_titration_curve(self):
        """测试完整的曲线分析"""
        result = calculation.analyze_titration_curve(
            curve=self.curve,
            params=self.params,
        )
        
        self.assertEqual(result.sample_id, "TestCurve")
        self.assertIsNotNone(result.smoothed_curve)
        self.assertEqual(result.quality, DataQuality.GOOD)
        
        if result.primary_equivalence:
            self.assertAlmostEqual(result.primary_equivalence.volume, 10.0, delta=1.0)


class TestBufferSolver(unittest.TestCase):
    """测试缓冲液配方计算"""
    
    def setUp(self):
        """设置测试数据"""
        stocks = default_stock_solutions()
        self.buffer_systems = default_buffer_systems(stocks)
    
    def test_henderson_hasselbalch(self):
        """测试Henderson-Hasselbalch方程"""
        pka = 4.76
        
        ph = pka
        acid_ratio, base_ratio = buffer_solver.henderson_hasselbalch(ph, pka)
        self.assertAlmostEqual(acid_ratio, 0.5, delta=0.01)
        self.assertAlmostEqual(base_ratio, 0.5, delta=0.01)
        
        ph = pka + 1.0
        acid_ratio, base_ratio = buffer_solver.henderson_hasselbalch(ph, pka)
        self.assertAlmostEqual(acid_ratio, 1/11, delta=0.01)
        self.assertAlmostEqual(base_ratio, 10/11, delta=0.01)
        
        ph = pka - 1.0
        acid_ratio, base_ratio = buffer_solver.henderson_hasselbalch(ph, pka)
        self.assertAlmostEqual(acid_ratio, 10/11, delta=0.01)
        self.assertAlmostEqual(base_ratio, 1/11, delta=0.01)
    
    def test_calculate_buffer_capacity(self):
        """测试缓冲容量计算"""
        c_total = 0.1
        pka = 7.2
        
        ph = pka
        capacity = buffer_solver.calculate_buffer_capacity(
            acid_concentration=c_total * 0.5,
            base_concentration=c_total * 0.5,
            ph=ph,
            pka=pka,
        )
        
        max_capacity = 2.303 * c_total * 0.25
        self.assertAlmostEqual(capacity, max_capacity, delta=0.001)
        
        ph = pka + 2.0
        acid_ratio, base_ratio = buffer_solver.henderson_hasselbalch(ph, pka)
        low_capacity = buffer_solver.calculate_buffer_capacity(
            acid_concentration=c_total * acid_ratio,
            base_concentration=c_total * base_ratio,
            ph=ph,
            pka=pka,
        )
        self.assertLess(low_capacity, capacity)
    
    def test_calculate_buffer_recipe(self):
        """测试缓冲液配方计算"""
        phosphate_system = self.buffer_systems["Phosphate"]
        
        recipe = buffer_solver.calculate_buffer_recipe(
            target_ph=7.4,
            target_volume=500.0,
            buffer_system=phosphate_system,
            temperature=25.0,
        )
        
        self.assertEqual(recipe.target_ph, 7.4)
        self.assertEqual(recipe.target_volume, 500.0)
        self.assertEqual(recipe.system_name, phosphate_system.name)
        
        self.assertGreater(recipe.acid_volume, 0)
        self.assertGreater(recipe.base_volume, 0)
        
        self.assertAlmostEqual(recipe.theoretical_ph, 7.4, delta=0.2)
        
        self.assertGreater(recipe.buffer_capacity, 0)
    
    def test_temperature_correction(self):
        """测试温度校正"""
        pka_25 = 8.3
        
        pka_cold = buffer_solver.calculate_pka_temperature_correction(pka_25, temperature=4.0)
        pka_hot = buffer_solver.calculate_pka_temperature_correction(pka_25, temperature=37.0)
        
        self.assertNotEqual(pka_cold, pka_25)
        self.assertNotEqual(pka_hot, pka_25)
    
    def test_validate_buffer_recipe(self):
        """测试配方验证"""
        phosphate_system = self.buffer_systems["Phosphate"]
        
        recipe = buffer_solver.calculate_buffer_recipe(
            target_ph=7.4,
            target_volume=500.0,
            buffer_system=phosphate_system,
            temperature=25.0,
        )
        
        validation = buffer_solver.validate_buffer_recipe(recipe, phosphate_system)
        
        self.assertTrue(validation['valid'])


class TestReporter(unittest.TestCase):
    """测试报告生成"""
    
    def setUp(self):
        """设置测试数据"""
        self.config = default_experiment_config()
        self.test_dir = tempfile.mkdtemp()
        
        self.fitted_data = {
            "fit_time": "2024-01-15T10:00:00",
            "parameters": {
                "smoothing_window": 5,
                "equivalence_point_method": "second_derivative",
                "blank_correction_enabled": True,
            },
            "results": [
                {
                    "sample_id": "S001",
                    "quality": "good",
                    "outlier_count": 0,
                    "primary_equivalence": {
                        "volume": 10.05,
                        "ph": 7.02,
                        "method": "second_derivative",
                        "confidence": 0.95,
                    },
                    "equivalence_points": [
                        {"volume": 10.05, "ph": 7.02, "confidence": 0.95}
                    ],
                    "warnings": [],
                    "statistics": {
                        "total_points": 50,
                        "valid_points": 50,
                        "ph_mean": 8.5,
                        "ph_std": 3.2,
                    },
                    "smoothed_points": [
                        {"volume": 0.0, "ph": 13.0},
                        {"volume": 10.0, "ph": 7.0},
                        {"volume": 15.0, "ph": 3.5},
                    ],
                },
                {
                    "sample_id": "S002",
                    "quality": "suspect",
                    "outlier_count": 1,
                    "primary_equivalence": {
                        "volume": 9.98,
                        "ph": 8.5,
                        "method": "second_derivative",
                        "confidence": 0.85,
                    },
                    "equivalence_points": [
                        {"volume": 9.98, "ph": 8.5, "confidence": 0.85}
                    ],
                    "warnings": ["检测到1个离群点"],
                    "statistics": {
                        "total_points": 50,
                        "valid_points": 49,
                        "ph_mean": 7.8,
                        "ph_std": 2.8,
                    },
                    "smoothed_points": [
                        {"volume": 0.0, "ph": 2.9},
                        {"volume": 10.0, "ph": 8.5},
                        {"volume": 15.0, "ph": 10.9},
                    ],
                    "outliers": [15],
                },
            ],
        }
        
        self.buffer_data = {
            "calculation_time": "2024-01-15T10:05:00",
            "target_ph": 7.4,
            "target_volume": 500.0,
            "temperature": 25.0,
            "system_name": "Phosphate",
            "system_info": {
                "name": "磷酸盐缓冲液",
                "effective_ph_range": [5.8, 8.0],
                "acid": {"name": "0.1M 磷酸二氢钠", "concentration": 0.1},
                "base": {"name": "0.1M 磷酸氢二钠", "concentration": 0.1},
            },
            "recipe": {
                "acid_volume": 195.5,
                "base_volume": 304.5,
                "theoretical_ph": 7.4,
                "buffer_capacity": 0.00576,
                "ph_deviation": 0.0,
                "warnings": [],
                "is_outside_optimal_range": False,
            },
            "instructions": [
                "1. 量取 195.50 mL 0.1M 磷酸二氢钠",
                "2. 量取 304.50 mL 0.1M 磷酸氢二钠",
                "3. 混合后用去离子水定容至 500.0 mL",
                "4. 充分混匀后，使用pH计验证实际pH值",
            ],
        }
    
    def tearDown(self):
        """清理临时文件"""
        import shutil
        shutil.rmtree(self.test_dir)
    
    def test_generate_markdown_report(self):
        """测试Markdown报告生成"""
        md_content = reporter.generate_markdown_report(
            config=self.config,
            fitted_data=self.fitted_data,
            buffer_data=self.buffer_data,
        )
        
        self.assertIsInstance(md_content, str)
        self.assertGreater(len(md_content), 0)
        
        self.assertIn("酸碱滴定实验报告", md_content)
        self.assertIn("S001", md_content)
        self.assertIn("S002", md_content)
        self.assertIn("磷酸盐缓冲液", md_content)
        self.assertIn("7.4", md_content)
    
    def test_generate_csv_summary(self):
        """测试CSV汇总生成"""
        csv_rows = reporter.generate_csv_summary(
            fitted_data=self.fitted_data,
            buffer_data=self.buffer_data,
        )
        
        self.assertGreater(len(csv_rows), 0)
        
        header_found = False
        for row in csv_rows:
            if "样品编号" in row:
                header_found = True
                break
        self.assertTrue(header_found)
    
    def test_generate_audit_trail(self):
        """测试审计数据包生成"""
        audit = reporter.generate_audit_trail(
            config=self.config,
            fitted_data=self.fitted_data,
            buffer_data=self.buffer_data,
        )
        
        self.assertIn("audit_id", audit)
        self.assertIn("generated_at", audit)
        self.assertIn("experiment_config", audit)
        self.assertIn("quality_assessment", audit)
        
        self.assertIn("titration_analysis", audit)
        self.assertIn("buffer_recipe", audit)
    
    def test_generate_report(self):
        """测试完整报告生成"""
        files = reporter.generate_report(
            config=self.config,
            fitted_data=self.fitted_data,
            buffer_data=self.buffer_data,
            output_dir=self.test_dir,
            generate_plots=False,
        )
        
        self.assertIn("markdown_report", files)
        self.assertIn("csv_summary", files)
        self.assertIn("audit_trail", files)
        
        for path in files.values():
            self.assertTrue(os.path.exists(path))


class TestExamples(unittest.TestCase):
    """测试示例数据模块"""
    
    def test_list_example_files(self):
        """测试列出示例文件"""
        from titration_tool.examples import list_example_files, EXAMPLE_FILES
        
        files = list_example_files()
        
        self.assertEqual(files, EXAMPLE_FILES)
        self.assertGreater(len(files), 0)
    
    def test_generate_strong_acid_base_curve(self):
        """测试生成强酸强碱曲线"""
        from titration_tool.examples import generate_strong_acid_base_curve
        
        points = generate_strong_acid_base_curve(
            equivalence_volume=10.0,
            num_points=50,
            noise=0.0,
        )
        
        self.assertEqual(len(points), 50)
        
        first_ph = points[0][1]
        last_ph = points[-1][1]
        
        self.assertGreater(first_ph, 10.0)
        self.assertLess(last_ph, 5.0)
    
    def test_generate_weak_acid_curve(self):
        """测试生成弱酸曲线"""
        from titration_tool.examples import generate_weak_acid_curve
        
        points = generate_weak_acid_curve(
            equivalence_volume=10.0,
            pka=4.76,
            num_points=50,
            noise=0.0,
            add_outlier=False,
        )
        
        self.assertEqual(len(points), 50)
        
        points_with_outlier = generate_weak_acid_curve(
            equivalence_volume=10.0,
            num_points=50,
            add_outlier=True,
        )
        
        self.assertEqual(len(points_with_outlier), 50)
    
    def test_generate_blank_curve(self):
        """测试生成空白曲线"""
        from titration_tool.examples import generate_blank_curve
        
        points = generate_blank_curve(
            max_volume=15.0,
            initial_ph=7.0,
            final_ph=6.2,
            num_points=30,
        )
        
        self.assertEqual(len(points), 30)
        
        first_ph = points[0][1]
        last_ph = points[-1][1]
        
        self.assertAlmostEqual(first_ph, 7.0, delta=0.1)
        self.assertAlmostEqual(last_ph, 6.2, delta=0.1)
    
    def test_generate_polyprotic_curve(self):
        """测试生成多元酸曲线"""
        from titration_tool.examples import generate_polyprotic_curve
        
        points = generate_polyprotic_curve(
            equivalence_volumes=[10.0, 20.0, 30.0],
            pka_values=[2.15, 7.20, 12.35],
            num_points=60,
            noise=0.0,
        )
        
        self.assertEqual(len(points), 60)


if __name__ == "__main__":
    unittest.main()
