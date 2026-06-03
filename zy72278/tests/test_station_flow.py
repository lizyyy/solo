import unittest
from datetime import datetime
from uuid import uuid4
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from station_passenger_flow.processor import StationFlowProcessor
from station_passenger_flow.validator import DataValidator
from station_passenger_flow.replay import PathReplay
from station_passenger_flow.models import RangefinderRecord, WorkflowStep, DirectionStatus
from station_passenger_flow.exceptions import WorkflowStepError


class TestNormalMaterial(unittest.TestCase):
    """测试正常材料流程"""

    def setUp(self):
        self.processor = StationFlowProcessor()

    def test_normal_workflow(self):
        print("\n" + "=" * 60)
        print("测试场景1: 正常材料流程")
        print("=" * 60)

        result = self.processor.import_cad_layer(
            layer_name="站厅A-1号出入口",
            source_file="station_A.dwg",
            z_direction=1.0,
            points=[
                {"x": 0, "y": 0, "z": 0},
                {"x": 10.5, "y": 0, "z": 0},
            ],
            operator="小陶"
        )

        print(f"✓ CAD图层导入成功: {result.cad_layer.layer_name}")
        print(f"  Z轴方向状态: {result.z_direction_status}")
        self.assertEqual(result.current_step, WorkflowStep.CAD_IMPORT)
        self.assertEqual(result.z_direction_status, DirectionStatus.NORMAL)

        records = [
            RangefinderRecord(
                record_id=str(uuid4()),
                measure_time=datetime.now(),
                z_direction=1.0,
                distance=10.5,
                measure_point="1号出入口通道",
                operator="小陶",
                is_supplement=False
            )
        ]
        result = self.processor.supplement_rangefinder_records(records)

        print(f"✓ 测距仪记录补充成功: {len(result.rangefinder_records)}条")
        print(f"  当前冲突数: {len(result.conflicts)}")
        for c in result.conflicts:
            print(f"    冲突: {c.conflict_type} - {c.description}")
        self.assertEqual(result.current_step, WorkflowStep.RANGEFINDER_SUPPLEMENT)

        result = self.processor.calculate_bottleneck()

        print(f"✓ 客流瓶颈计算完成")
        print(f"  瓶颈位置: {result.bottleneck_location}")
        print(f"  瓶颈流量: {result.bottleneck_flow}")
        print(f"  容量: {result.capacity}")
        print(f"  利用率: {result.utilization_rate * 100}%")
        self.assertEqual(result.current_step, WorkflowStep.PATH_REPLAY_UPDATE)

        path_points = [
            {"x": 0, "y": 0, "z": 0, "timestamp": datetime.now(), "passenger_count": 45},
            {"x": 5, "y": 0, "z": 0, "timestamp": datetime.now(), "passenger_count": 52},
            {"x": 10, "y": 0, "z": 0, "timestamp": datetime.now(), "passenger_count": 38},
        ]
        result = self.processor.update_path_replay(path_points)

        print(f"✓ 路径回放更新完成")
        self.assertEqual(result.current_step, WorkflowStep.COMPLETED)
        self.assertEqual(len(result.path_history), 3)

        print("✓ 正常材料流程全部通过!")


class TestWrongCaliberMaterial(unittest.TestCase):
    """测试错口径材料（Z轴方向写反）"""

    def setUp(self):
        self.processor = StationFlowProcessor()

    def test_z_axis_reversed(self):
        print("\n" + "=" * 60)
        print("测试场景2: 错口径材料 - Z轴方向写反")
        print("=" * 60)

        result = self.processor.import_cad_layer(
            layer_name="站厅B-2号出入口",
            source_file="station_B.dwg",
            z_direction=-1.0,
            points=[
                {"x": 0, "y": 0, "z": 0},
                {"x": 8, "y": 0, "z": 0},
            ],
            operator="小陶"
        )

        print(f"✓ CAD图层导入完成")
        print(f"  Z轴方向状态: {result.z_direction_status}")
        print(f"  冲突数量: {len(result.conflicts)}")

        self.assertEqual(result.z_direction_status, DirectionStatus.PENDING_REVIEW)
        self.assertGreater(len(result.conflicts), 0)

        z_conflict = result.conflicts[0]
        self.assertEqual(z_conflict.conflict_type, "z_axis_direction")

        print("\n冲突详情:")
        print(f"  CAD值: {z_conflict.cad_value}")
        print(f"  说明: {z_conflict.description}")
        print("  (留给现场班组复核，不自动修正)")

        print("\n模拟园区运维小陶选择: 驳回，以实际为准")
        result = self.processor.resolve_conflict(
            conflict_index=0,
            confirmed=False,
            operator="小陶",
            comment="现场确认是向上，CAD写反了"
        )

        print(f"✓ 冲突已解决")
        print(f"  修正后Z轴方向: {result.cad_layer.z_direction}")
        self.assertEqual(result.cad_layer.z_direction, 1.0)
        self.assertEqual(len(result.conflicts), 0)

        print("✓ 错口径材料场景通过!")

    def test_cad_rangefinder_conflict(self):
        print("\n" + "=" * 60)
        print("测试场景2b: CAD与测距仪数据冲突")
        print("=" * 60)

        result = self.processor.import_cad_layer(
            layer_name="站厅C-3号出入口",
            source_file="station_C.dwg",
            z_direction=1.0,
            points=[
                {"x": 0, "y": 0, "z": 0},
                {"x": 10, "y": 0, "z": 0},
            ],
            operator="小陶"
        )

        records = [
            RangefinderRecord(
                record_id=str(uuid4()),
                measure_time=datetime.now(),
                z_direction=-1.0,
                distance=15.0,
                measure_point="3号出入口通道",
                operator="小陶",
                is_supplement=False
            )
        ]
        result = self.processor.supplement_rangefinder_records(records)

        print(f"✓ 发现冲突: {len(result.conflicts)}处")
        self.assertGreater(len(result.conflicts), 0)

        for i, conflict in enumerate(result.conflicts):
            print(f"\n冲突 #{i+1}: {conflict.conflict_type}")
            print(f"  位置: {conflict.location}")
            print(f"  CAD值: {conflict.cad_value}")
            print(f"  测距仪值: {conflict.rangefinder_value}")

        print("\n提示: 不自动拍板，让用户选择确认或驳回")
        print("✓ 冲突检测机制正常工作!")


class TestSupplementMaterial(unittest.TestCase):
    """测试补录材料流程"""

    def setUp(self):
        self.processor = StationFlowProcessor()

    def test_supplement_recalculate(self):
        print("\n" + "=" * 60)
        print("测试场景3: 补录材料流程")
        print("=" * 60)

        result = self.processor.import_cad_layer(
            layer_name="站厅D-4号出入口",
            source_file="station_D.dwg",
            z_direction=1.0,
            points=[
                {"x": 0, "y": 0, "z": 0},
                {"x": 12, "y": 0, "z": 0},
            ],
            operator="小陶"
        )
        print(f"✓ 首次导入CAD完成")

        records = [
            RangefinderRecord(
                record_id=str(uuid4()),
                measure_time=datetime.now(),
                z_direction=1.0,
                distance=12.0,
                measure_point="4号出入口初测",
                operator="小陶",
                is_supplement=False
            )
        ]
        result = self.processor.supplement_rangefinder_records(records)
        result = self.processor.calculate_bottleneck()

        print(f"✓ 首次计算完成")
        print(f"  版本: {result.version}")
        print(f"  瓶颈流量: {result.bottleneck_flow}")
        initial_flow = result.bottleneck_flow

        supplement_records = [
            RangefinderRecord(
                record_id=str(uuid4()),
                measure_time=datetime.now(),
                z_direction=1.0,
                distance=18.0,
                measure_point="4号出入口补测-拐角处",
                operator="小陶",
                is_supplement=True,
                notes="昨天漏测了拐角"
            )
        ]
        result = self.processor.supplement_rangefinder_records(supplement_records)

        print(f"✓ 补录数据完成")
        print(f"  补录标记: {result.is_supplemented}")
        self.assertTrue(result.is_supplemented)

        validator = DataValidator()
        sup_check = validator.check_supplement_recalculate(result, supplement_records)
        print(f"  补录检查: {sup_check.message}")

        result = self.processor.calculate_bottleneck()

        print(f"✓ 重新计算完成")
        print(f"  版本: {result.version}")
        print(f"  原瓶颈流量: {initial_flow}")
        print(f"  新瓶颈流量: {result.bottleneck_flow}")
        self.assertNotEqual(result.bottleneck_flow, initial_flow)
        self.assertEqual(result.version, 3)

        print("✓ 补录重算流程通过!")


class TestSelfCheck(unittest.TestCase):
    """测试自检功能"""

    def setUp(self):
        self.validator = DataValidator()
        self.processor = StationFlowProcessor()

    def test_duplicate_import_check(self):
        print("\n" + "=" * 60)
        print("测试自检: 重复导入检查")
        print("=" * 60)

        self.processor.import_cad_layer(
            layer_name="重复测试图层",
            source_file="test.dwg",
            z_direction=1.0,
            points=[{"x": 0, "y": 0, "z": 0}],
            operator="小陶"
        )

        result = self.processor.import_cad_layer(
            layer_name="重复测试图层",
            source_file="test.dwg",
            z_direction=1.0,
            points=[{"x": 0, "y": 0, "z": 0}],
            operator="小陶"
        )

        dup_check = result.self_check_results[1]
        print(f"检查结果: {dup_check.message}")
        self.assertFalse(dup_check.passed)

        print("✓ 重复导入检查通过!")

    def test_export_consistency_check(self):
        print("\n" + "=" * 60)
        print("测试自检: 导出一致性检查")
        print("=" * 60)

        result = self.processor.import_cad_layer(
            layer_name="导出测试",
            source_file="export.dwg",
            z_direction=1.0,
            points=[{"x": 0, "y": 0, "z": 0}],
            operator="小陶"
        )

        export1 = self.processor.export_result()
        print(f"✓ 首次导出完成")

        result.bottleneck_flow = 999
        export2 = self.processor.export_result()

        export_check = result.self_check_results[-1]
        print(f"检查结果: {export_check.message}")
        self.assertFalse(export_check.passed)

        print("✓ 导出一致性检查通过!")


class TestPathReplay(unittest.TestCase):
    """测试路径回放功能"""

    def test_path_history_compare(self):
        print("\n" + "=" * 60)
        print("测试: 路径回放与历史记录一致性")
        print("=" * 60)

        replay = PathReplay()
        processor = StationFlowProcessor()

        result = processor.import_cad_layer(
            layer_name="回放测试站厅",
            source_file="replay.dwg",
            z_direction=1.0,
            points=[{"x": 0, "y": 0, "z": 0}],
            operator="小陶"
        )

        records = [
            RangefinderRecord(
                record_id=str(uuid4()),
                measure_time=datetime.now(),
                z_direction=1.0,
                distance=10.0,
                measure_point="测试点",
                operator="小陶",
                is_supplement=False
            )
        ]
        result = processor.supplement_rangefinder_records(records)
        result = processor.calculate_bottleneck()

        path1 = [
            {"x": 0, "y": 0, "z": 0, "timestamp": datetime.now(), "passenger_count": 50},
            {"x": 5, "y": 0, "z": 0, "timestamp": datetime.now(), "passenger_count": 60},
        ]
        result = processor.update_path_replay(path1)

        check1 = replay.check_history_consistency(result)
        print(f"第一次: {check1['message']}")

        path2 = [
            {"x": 0, "y": 0, "z": 0, "timestamp": datetime.now(), "passenger_count": 50},
            {"x": 5, "y": 0, "z": 0, "timestamp": datetime.now(), "passenger_count": 75},
        ]
        result = processor.update_path_replay(path2)

        check2 = replay.check_history_consistency(result)
        print(f"第二次: {check2['message']}")
        self.assertIn("新版本号", check2["message"])

        replay.print_replay_summary(result)
        print("✓ 路径回放测试通过!")


if __name__ == "__main__":
    print("\n" + "#" * 60)
    print("# 地铁站厅客流瓶颈 - 三场景测试")
    print("#" * 60)

    unittest.main(verbosity=2)
