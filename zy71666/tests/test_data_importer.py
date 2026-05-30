"""数据导入器测试用例。"""

from __future__ import annotations

import os
import tempfile
import unittest
from datetime import datetime

import pytz

from tide_berth_window.data_importer import DataImporter
from tide_berth_window.exceptions import (
    DataConflictError,
    TimeZoneError,
    ValidationError,
)


class TestDataImporter(unittest.TestCase):
    """数据导入器测试。"""

    def setUp(self) -> None:
        """设置测试环境。"""
        self.tz = pytz.timezone("Asia/Shanghai")
        self.importer = DataImporter(default_timezone="Asia/Shanghai")
        self.temp_dir = tempfile.mkdtemp()

    def tearDown(self) -> None:
        """清理测试环境。"""
        import shutil
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def _create_test_csv(self, filename: str, content: str) -> str:
        """创建临时CSV文件。"""
        filepath = os.path.join(self.temp_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        return filepath

    def test_import_tide_data(self) -> None:
        """测试潮位数据导入。"""
        csv_content = """time,tide_level,uncertainty,unit
2025-06-01 00:00,0.5,0.05,m
2025-06-01 01:00,0.8,0.05,m
2025-06-01 02:00,1.2,0.06,m
"""
        filepath = self._create_test_csv("tide.csv", csv_content)
        curve, readings = self.importer.import_tide_data(filepath)

        self.assertEqual(len(readings), 3)
        self.assertEqual(len(curve.readings), 3)
        self.assertAlmostEqual(readings[0].tide_level, 0.5)
        self.assertIsNotNone(readings[0].time.tzinfo)

    def test_import_wind_data(self) -> None:
        """测试风速数据导入。"""
        csv_content = """time,speed,direction,gust,uncertainty,unit
2025-06-01 00:00,5.0,180,7.5,1.0,m/s
2025-06-01 03:00,6.0,190,8.5,1.2,m/s
"""
        filepath = self._create_test_csv("wind.csv", csv_content)
        forecast, readings = self.importer.import_wind_data(filepath)

        self.assertEqual(len(readings), 2)
        self.assertEqual(len(forecast.readings), 2)
        self.assertAlmostEqual(readings[0].speed, 5.0)
        self.assertAlmostEqual(readings[0].gust, 7.5)

    def test_import_ship_data(self) -> None:
        """测试船舶数据导入。"""
        csv_content = """imo,name,draft,length,beam,maneuverability,unit
9876543,测试船,11.5,290,32,3,m
9876544,测试船2,9.2,220,30,4,m
"""
        filepath = self._create_test_csv("ship.csv", csv_content)
        ships = self.importer.import_ship_data(filepath)

        self.assertEqual(len(ships), 2)
        self.assertEqual(ships[0].imo, "9876543")
        self.assertAlmostEqual(ships[0].draft, 11.5)
        self.assertEqual(ships[0].maneuverability, 3)

    def test_import_berth_data(self) -> None:
        """测试泊位数据导入。"""
        csv_content = """berth_id,name,design_depth,max_length,max_beam,wind_limit,under_keel_margin,approach_channel_depth,unit
B01,1号泊位,12.0,300,40,15.0,0.5,11.5,m
"""
        filepath = self._create_test_csv("berth.csv", csv_content)
        berths = self.importer.import_berth_data(filepath)

        self.assertEqual(len(berths), 1)
        self.assertEqual(berths[0].berth_id, "B01")
        self.assertAlmostEqual(berths[0].design_depth, 12.0)
        self.assertAlmostEqual(berths[0].wind_limit, 15.0)

    def test_timezone_detection(self) -> None:
        """测试时区自动检测和警告。"""
        # 不带时区的时间字符串应该被记录警告
        csv_content = """time,tide_level,uncertainty,unit
2025-06-01 00:00,0.5,0.05,m
"""
        filepath = self._create_test_csv("tide_no_tz.csv", csv_content)

        curve, readings = self.importer.import_tide_data(filepath)

        # 应该有一个时区警告
        tz_errors = [e for e in self.importer.import_errors if isinstance(e, TimeZoneError)]
        self.assertEqual(len(tz_errors), 1)
        self.assertIn("缺少时区信息", tz_errors[0].message)

    def test_bad_data_handling(self) -> None:
        """测试坏数据处理（不崩溃，报告错误）。"""
        csv_content = """time,tide_level,uncertainty,unit
2025-06-01 00:00,0.5,0.05,m
2025-06-01 01:00,bad_value,0.05,m
,1.2,0.06,m
2025-06-01 03:00,999.0,0.07,m
2025-06-01 04:00,2.1,0.07,m
"""
        filepath = self._create_test_csv("tide_bad.csv", csv_content)

        # 不应该抛出异常
        curve, readings = self.importer.import_tide_data(filepath)

        # 应该只导入3条有效数据
        self.assertEqual(len(readings), 2)  # 999.0也会被验证拒绝
        self.assertTrue(any("bad_value" in str(e) for e in self.importer.import_errors))
        self.assertTrue(any("缺少时间字段" in str(e) for e in self.importer.import_errors))

    def test_version_management(self) -> None:
        """测试多版本数据管理。"""
        csv1 = """time,tide_level,uncertainty,unit
2025-06-01 06:00,2.2,0.08,m
"""
        csv2 = """time,tide_level,uncertainty,unit
2025-06-01 06:00,2.0,0.08,m
"""
        filepath1 = self._create_test_csv("tide_v1.csv", csv1)
        filepath2 = self._create_test_csv("tide_v2.csv", csv2)

        self.importer.import_tide_data(filepath1, notes="第一版预报")
        self.importer.import_tide_data(filepath2, notes="第二版预报")

        # 应该有两个版本
        self.assertEqual(len(self.importer.versions), 2)
        self.assertEqual(len(self.importer._tide_readings), 2)

        # 应该检测到冲突
        conflicts = [e for e in self.importer.data_conflicts if isinstance(e, DataConflictError)]
        self.assertGreaterEqual(len(conflicts), 1)

        # 最新版本应该生效
        curve = self.importer._build_tide_curve()
        self.assertAlmostEqual(curve.readings[0].tide_level, 2.0)

    def test_version_listing(self) -> None:
        """测试版本列表功能。"""
        csv_content = """time,tide_level,uncertainty,unit
2025-06-01 00:00,0.5,0.05,m
"""
        filepath = self._create_test_csv("tide.csv", csv_content)
        self.importer.import_tide_data(filepath)

        versions = self.importer.list_versions()
        self.assertEqual(len(versions), 1)
        self.assertEqual(versions[0]["data_type"], "tide")
        self.assertTrue(versions[0]["is_active"])

    def test_deactivate_version(self) -> None:
        """测试停用版本功能。"""
        csv1 = """time,tide_level,uncertainty,unit
2025-06-01 06:00,2.2,0.08,m
"""
        csv2 = """time,tide_level,uncertainty,unit
2025-06-01 06:00,2.0,0.08,m
"""
        filepath1 = self._create_test_csv("tide_v1.csv", csv1)
        filepath2 = self._create_test_csv("tide_v2.csv", csv2)

        self.importer.import_tide_data(filepath1)
        self.importer.import_tide_data(filepath2)

        # 停用最新版本
        latest_vid = self.importer.versions[-1].version_id
        self.importer.deactivate_version(latest_vid)

        # 应该使用旧版本
        curve = self.importer._build_tide_curve()
        self.assertAlmostEqual(curve.readings[0].tide_level, 2.2)

    def test_import_report(self) -> None:
        """测试导入报告生成。"""
        csv_content = """time,tide_level,uncertainty,unit
2025-06-01 00:00,0.5,0.05,m
bad_line
"""
        filepath = self._create_test_csv("tide.csv", csv_content)

        self.importer.import_tide_data(filepath)
        report = self.importer.get_import_report()

        self.assertIn("数据导入报告", report)
        self.assertIn("错误数", report)
        self.assertIn("总版本数", report)

    def test_unit_conversion(self) -> None:
        """测试单位自动转换。"""
        csv_content = """time,tide_level,uncertainty,unit
2025-06-01 00:00,1.64,0.164,ft
"""
        filepath = self._create_test_csv("tide_ft.csv", csv_content)
        curve, readings = self.importer.import_tide_data(filepath)

        # 1.64英尺 ≈ 0.5米
        self.assertAlmostEqual(readings[0].tide_level, 0.5, delta=0.01)

    def test_chinese_column_names(self) -> None:
        """测试中文列名支持。"""
        csv_content = """时间,潮位,不确定度,单位
2025-06-01 00:00,0.5,0.05,m
"""
        filepath = self._create_test_csv("tide_cn.csv", csv_content)
        curve, readings = self.importer.import_tide_data(filepath)

        self.assertEqual(len(readings), 1)
        self.assertAlmostEqual(readings[0].tide_level, 0.5)


if __name__ == "__main__":
    unittest.main()
