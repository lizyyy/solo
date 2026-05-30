import unittest
import tempfile
import shutil
import os
import json
import sys

from models import STANDARD_FREQUENCIES, FREQUENCY_LABELS
from acoustics_service import AcousticsService
from storage import StorageManager
from calculator import SabineCalculator, ValidationEngine


class TestSabineCalculator(unittest.TestCase):
    def setUp(self):
        self.calculator = SabineCalculator()

    def test_normalize_area(self):
        self.assertAlmostEqual(self.calculator._normalize_area(10, "m2"), 10)
        self.assertAlmostEqual(self.calculator._normalize_area(10, "m²"), 10)
        self.assertAlmostEqual(self.calculator._normalize_area(10000, "cm2"), 1)
        self.assertAlmostEqual(self.calculator._normalize_area(10, "ft2"), 0.92903, places=4)

    def test_calculate_t60(self):
        volume = 144
        absorption = {125: 20, 250: 25, 500: 30, 1000: 32, 2000: 30, 4000: 28}
        t60 = self.calculator.calculate_t60(volume, absorption)

        expected_125 = 0.161 * 144 / 20
        self.assertAlmostEqual(t60[125], expected_125, places=4)
        expected_500 = 0.161 * 144 / 30
        self.assertAlmostEqual(t60[500], expected_500, places=4)

    def test_calculate_t60_zero_absorption(self):
        volume = 144
        absorption = {125: 0, 250: 0, 500: 0, 1000: 0, 2000: 0, 4000: 0}
        t60 = self.calculator.calculate_t60(volume, absorption)
        self.assertEqual(t60[125], float('inf'))

    def test_sabine_applicability(self):
        from models import Room, Material
        from datetime import datetime

        materials = [
            Material("1", "测试材料", 20, "m2", {125: 0.1, 250: 0.2, 500: 0.3, 1000: 0.4, 2000: 0.4, 4000: 0.3},
                     datetime.now(), datetime.now())
        ]

        room = Room("1", "测试房间", 6, 6, 4, 144, 168, materials, "ready",
                   datetime.now(), datetime.now())

        issues = []
        applicable = self.calculator._check_sabine_applicability(room, issues)
        self.assertTrue(applicable)


class TestValidationEngine(unittest.TestCase):
    def setUp(self):
        self.validator = ValidationEngine()

    def _create_test_room(self, materials=None):
        from models import Room, Material
        from datetime import datetime

        if materials is None:
            materials = [
                Material("1", "矿棉板", 24, "m2",
                         {125: 0.2, 250: 0.4, 500: 0.7, 1000: 0.9, 2000: 0.95, 4000: 0.9},
                         datetime.now(), datetime.now())
            ]

        return Room("1", "测试房间", 8, 6, 3, 144, 180, materials, "ready",
                   datetime.now(), datetime.now())

    def test_validate_room_dimensions(self):
        from models import Room, Material
        from datetime import datetime

        room = Room("1", "测试房间", -1, 6, 3, -18, 180, [], "ready",
                   datetime.now(), datetime.now())

        issues = self.validator.validate_room(room)
        errors = [i for i in issues if i.severity == "error"]
        self.assertTrue(any(i.type == "dimension_error" for i in errors))

    def test_validate_material_area(self):
        from models import Material
        from datetime import datetime

        materials = [
            Material("1", "坏材料", -5, "m2",
                     {125: 0.2}, datetime.now(), datetime.now())
        ]
        room = self._create_test_room(materials)

        issues = self.validator.validate_room(room)
        errors = [i for i in issues if i.severity == "error"]
        self.assertTrue(any(i.type == "area_error" for i in errors))
        self.assertTrue(any("坏材料" in i.message for i in issues))

    def test_validate_absorption_coefficient(self):
        from models import Material
        from datetime import datetime

        materials = [
            Material("1", "坏材料", 10, "m2",
                     {125: 1.5}, datetime.now(), datetime.now())
        ]
        room = self._create_test_room(materials)

        issues = self.validator.validate_room(room)
        errors = [i for i in issues if i.severity == "error"]
        self.assertTrue(any(i.type == "absorption_error" for i in errors))
        self.assertTrue(any("坏材料" in i.message for i in issues))

    def test_validate_missing_frequencies(self):
        from models import Material
        from datetime import datetime

        materials = [
            Material("1", "不全材料", 10, "m2",
                     {125: 0.2, 250: 0.3}, datetime.now(), datetime.now())
        ]
        room = self._create_test_room(materials)

        issues = self.validator.validate_room(room)
        warnings = [i for i in issues if i.severity == "warning"]
        self.assertTrue(any(i.type == "missing_frequency" for i in warnings))
        self.assertTrue(any("不全材料" in i.message for i in warnings))
        self.assertTrue(any("500Hz" in i.message for i in warnings))

    def test_validate_unit_error(self):
        from models import Material
        from datetime import datetime

        materials = [
            Material("1", "单位错材料", 10, "invalid_unit",
                     {125: 0.2}, datetime.now(), datetime.now())
        ]
        room = self._create_test_room(materials)

        issues = self.validator.validate_room(room)
        errors = [i for i in issues if i.severity == "error"]
        self.assertTrue(any(i.type == "unit_error" for i in errors))
        self.assertTrue(any("单位错材料" in i.message for i in issues))

    def test_validate_duplicate_materials(self):
        from models import Material
        from datetime import datetime

        materials = [
            Material("1", "重复材料", 10, "m2",
                     {125: 0.2}, datetime.now(), datetime.now()),
            Material("2", "重复材料", 20, "m2",
                     {125: 0.3}, datetime.now(), datetime.now())
        ]
        room = self._create_test_room(materials)

        issues = self.validator.validate_room(room)
        warnings = [i for i in issues if i.severity == "warning"]
        self.assertTrue(any(i.type == "duplicate_material" for i in warnings))
        self.assertTrue(any("重复材料" in i.message for i in warnings))


class TestStorageManager(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.storage = StorageManager(self.test_dir)

    def tearDown(self):
        shutil.rmtree(self.test_dir)

    def test_save_and_get_room(self):
        from models import Room
        from datetime import datetime

        room = Room("test_id", "测试房间", 8, 6, 3, 144, 180, [], "pending_materials",
                   datetime.now(), datetime.now())

        self.assertTrue(self.storage.save_room(room))
        retrieved = self.storage.get_room("test_id")
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.name, "测试房间")
        self.assertEqual(retrieved.volume, 144)

    def test_checksum_verification(self):
        from models import Room
        from datetime import datetime

        room = Room("test_id", "测试房间", 8, 6, 3, 144, 180, [], "pending_materials",
                   datetime.now(), datetime.now())
        self.storage.save_room(room)

        integrity = self.storage.verify_data_integrity()
        self.assertTrue(integrity["checksums_valid"])

        rooms_file = os.path.join(self.test_dir, "rooms.json")
        with open(rooms_file, 'w') as f:
            json.dump({"tampered": "data"}, f)

        integrity = self.storage.verify_data_integrity()
        self.assertFalse(integrity["checksums_valid"])

    def test_data_persistence_after_restart(self):
        from models import Room
        from datetime import datetime

        room = Room("persist_id", "持久化测试", 10, 8, 4, 320, 304, [], "pending_materials",
                   datetime.now(), datetime.now())
        self.storage.save_room(room)

        first_export = self.storage.export_all_data()
        first_checksum = first_export["checksums"]["rooms"]

        new_storage = StorageManager(self.test_dir)
        retrieved = new_storage.get_room("persist_id")
        self.assertIsNotNone(retrieved)
        self.assertEqual(retrieved.name, "持久化测试")

        second_export = new_storage.export_all_data()
        second_checksum = second_export["checksums"]["rooms"]

        self.assertEqual(first_checksum, second_checksum)

    def test_export_and_import(self):
        from models import Room
        from datetime import datetime

        room = Room("export_id", "导出测试", 5, 5, 3, 75, 110, [], "pending_materials",
                   datetime.now(), datetime.now())
        self.storage.save_room(room)

        export_data = self.storage.export_all_data()
        self.assertEqual(len(export_data["rooms"]), 1)

        import_dir = tempfile.mkdtemp()
        try:
            import_storage = StorageManager(import_dir)
            report = import_storage.import_data(export_data)
            self.assertEqual(report["rooms_imported"], 1)

            imported_room = import_storage.get_room("export_id")
            self.assertIsNotNone(imported_room)
            self.assertEqual(imported_room.name, "导出测试")
        finally:
            shutil.rmtree(import_dir)


class TestAcousticsService(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        self.service = AcousticsService(self.test_dir)

    def tearDown(self):
        shutil.rmtree(self.test_dir)

    def test_create_room(self):
        room, issues = self.service.create_room("录音棚A", 8, 6, 3, "张工", "主录音棚")
        self.assertEqual(room.name, "录音棚A")
        self.assertEqual(room.volume, 144)
        self.assertEqual(room.status, "pending_materials")

        history = self.service.get_room_history(room.id)
        self.assertEqual(len(history), 1)
        self.assertEqual(history[0]["operation"], "create")
        self.assertEqual(history[0]["operator"], "张工")

    def test_incremental_material_update(self):
        room, _ = self.service.create_room("增量测试", 8, 6, 3, "系统")
        room_id = room.id

        self.assertEqual(room.status, "pending_materials")
        self.assertIsNone(self.service.storage.get_result(room_id))

        absorption1 = {125: 0.2, 250: 0.4, 500: 0.7, 1000: 0.9, 2000: 0.95, 4000: 0.9}
        room, issues = self.service.add_material(room_id, "矿棉板", 24, "m2", absorption1, "李工")

        self.assertEqual(room.status, "ready")
        result1 = self.service.storage.get_result(room_id)
        self.assertIsNotNone(result1)
        t60_500_first = result1.t60_by_frequency[500]

        history = self.service.get_room_history(room_id)
        self.assertEqual(len(history), 3)

        absorption2 = {125: 0.1, 250: 0.15, 500: 0.2, 1000: 0.3, 2000: 0.35, 4000: 0.4}
        room, issues = self.service.add_material(room_id, "地毯", 48, "m2", absorption2, "李工")

        result2 = self.service.storage.get_result(room_id)
        self.assertIsNotNone(result2)
        t60_500_second = result2.t60_by_frequency[500]

        self.assertLess(t60_500_second, t60_500_first)

        history = self.service.get_room_history(room_id)
        self.assertEqual(len(history), 5)

        operations = [h["operation"] for h in history]
        self.assertIn("create", operations)
        self.assertIn("add_material", operations)
        self.assertIn("calculate", operations)

    def test_batch_process_separation(self):
        room1, _ = self.service.create_room("正常房间", 8, 6, 3)
        absorption = {125: 0.2, 250: 0.4, 500: 0.7, 1000: 0.9, 2000: 0.95, 4000: 0.9}
        self.service.add_material(room1.id, "矿棉板", 24, "m2", absorption)

        room2, _ = self.service.create_room("无材料房间", 5, 5, 3)

        room3, _ = self.service.create_room("有错误房间", 10, 8, 4)
        bad_absorption = {125: 1.5}
        self.service.add_material(room3.id, "坏材料", -10, "invalid", bad_absorption)

        batch_result = self.service.batch_process()

        self.assertEqual(batch_result["total_processed"], 3)
        self.assertEqual(batch_result["normal_count"], 1)
        self.assertEqual(batch_result["problem_count"], 2)

        normal_names = [r["room_name"] for r in batch_result["normal_records"]]
        problem_names = [r["room_name"] for r in batch_result["problem_records"]]

        self.assertIn("正常房间", normal_names)
        self.assertIn("无材料房间", problem_names)
        self.assertIn("有错误房间", problem_names)

    def test_frequency_analysis(self):
        room, _ = self.service.create_room("分析测试", 8, 6, 3)
        absorption1 = {125: 0.1, 250: 0.3, 500: 0.6, 1000: 0.8, 2000: 0.85, 4000: 0.8}
        self.service.add_material(room.id, "矿棉板", 24, "m2", absorption1)
        absorption2 = {125: 0.05, 250: 0.1, 500: 0.15, 1000: 0.2, 2000: 0.25, 4000: 0.3}
        self.service.add_material(room.id, "木地板", 48, "m2", absorption2)

        analysis = self.service.get_frequency_analysis(room.id)
        self.assertIsNotNone(analysis)
        self.assertEqual(len(analysis["frequency_data"]), 6)

        for fd in analysis["frequency_data"]:
            self.assertIn("frequency_label", fd)
            self.assertIn("t60_seconds", fd)
            self.assertIn("total_absorption_sabins", fd)
            self.assertIn("material_breakdown", fd)
            self.assertTrue(len(fd["material_breakdown"]) > 0)

    def test_manual_edit_history(self):
        room, _ = self.service.create_room("人工修改测试", 8, 6, 3)
        room_id = room.id

        success = self.service.manual_edit(
            room_id=room_id,
            field_name="notes",
            old_value="",
            new_value="客户要求T60控制在0.6-0.8秒",
            operator="王工",
            reason="客户需求变更"
        )
        self.assertTrue(success)

        history = self.service.get_room_history(room_id)
        manual_entries = [h for h in history if h["operation"] == "manual_edit"]
        self.assertEqual(len(manual_entries), 1)
        self.assertEqual(manual_entries[0]["operator"], "王工")
        self.assertEqual(manual_entries[0]["reason"], "客户需求变更")
        self.assertIn("客户要求T60控制在0.6-0.8秒", manual_entries[0]["new_value"])

    def test_update_material_triggers_recalculation(self):
        room, _ = self.service.create_room("更新测试", 8, 6, 3)
        absorption = {125: 0.2, 250: 0.4, 500: 0.7, 1000: 0.9, 2000: 0.95, 4000: 0.9}
        room, _ = self.service.add_material(room.id, "测试材料", 24, "m2", absorption)

        material_id = room.materials[0].id
        result1 = self.service.storage.get_result(room.id)
        t60_before = result1.t60_by_frequency[500]

        self.service.update_material(room.id, material_id, area=48, absorption_coefficients={500: 0.8})

        result2 = self.service.storage.get_result(room.id)
        t60_after = result2.t60_by_frequency[500]

        self.assertNotEqual(t60_before, t60_after)
        self.assertLess(t60_after, t60_before)

    def test_export_csv(self):
        room, _ = self.service.create_room("导出测试", 8, 6, 3)
        absorption = {125: 0.2, 250: 0.4, 500: 0.7, 1000: 0.9, 2000: 0.95, 4000: 0.9}
        self.service.add_material(room.id, "矿棉板", 24, "m2", absorption)

        csv_file = os.path.join(self.test_dir, "results.csv")
        result = self.service.export_to_csv(csv_file)
        self.assertEqual(result["exported_count"], 1)
        self.assertTrue(os.path.exists(csv_file))

        with open(csv_file, 'r', encoding='utf-8-sig') as f:
            content = f.read()
            self.assertIn("导出测试", content)
            self.assertIn("平均T60(s)", content)
            for freq in STANDARD_FREQUENCIES:
                self.assertIn(FREQUENCY_LABELS[freq], content)

    def test_data_consistency_after_restart(self):
        room, _ = self.service.create_room("一致性测试", 8, 6, 3, "测试员")
        absorption = {125: 0.2, 250: 0.4, 500: 0.7, 1000: 0.9, 2000: 0.95, 4000: 0.9}
        self.service.add_material(room.id, "矿棉板", 24, "m2", absorption, "测试员")

        self.service.manual_edit(
            room_id=room.id,
            field_name="notes",
            old_value="",
            new_value="测试备注",
            operator="测试员",
            reason="测试"
        )

        result_before = self.service.storage.get_result(room.id)
        history_before = self.service.get_room_history(room.id)
        integrity_before = self.service.verify_integrity()

        del self.service
        new_service = AcousticsService(self.test_dir)

        result_after = new_service.storage.get_result(room.id)
        history_after = new_service.get_room_history(room.id)
        integrity_after = new_service.verify_integrity()

        self.assertEqual(result_before.average_t60, result_after.average_t60)
        self.assertEqual(result_before.t60_by_frequency, result_after.t60_by_frequency)
        self.assertEqual(len(history_before), len(history_after))
        self.assertEqual(integrity_before["checksums_valid"], integrity_after["checksums_valid"])

        csv_export_before = os.path.join(self.test_dir, "before.csv")
        csv_export_after = os.path.join(self.test_dir, "after.csv")
        self.service = new_service
        self.service.export_to_csv(csv_export_before)
        new_service.export_to_csv(csv_export_after)

        with open(csv_export_before, 'r') as f1, open(csv_export_after, 'r') as f2:
            self.assertEqual(f1.read(), f2.read())


class TestCLI(unittest.TestCase):
    def setUp(self):
        self.test_dir = tempfile.mkdtemp()
        os.environ["ACOUSTICS_DATA_DIR"] = self.test_dir

    def tearDown(self):
        shutil.rmtree(self.test_dir)
        if "ACOUSTICS_DATA_DIR" in os.environ:
            del os.environ["ACOUSTICS_DATA_DIR"]

    def _run_cli(self, args):
        import subprocess
        cmd = [sys.executable, "cli.py"] + args
        env = os.environ.copy()
        env["ACOUSTICS_DATA_DIR"] = self.test_dir
        result = subprocess.run(cmd, capture_output=True, text=True, cwd="/Users/lzy/pro/solo/workspaces/zy71461", env=env)
        return result.returncode, result.stdout, result.stderr

    def test_create_room_cli(self):
        code, stdout, stderr = self._run_cli([
            "create-room",
            "--name", "CLI测试房间",
            "--length", "8",
            "--width", "6",
            "--height", "3",
            "--operator", "CLI用户"
        ])
        self.assertEqual(code, 0)
        self.assertIn("房间创建成功", stdout)
        self.assertIn("CLI测试房间", stdout)

    def test_add_material_cli(self):
        code, stdout, stderr = self._run_cli([
            "create-room",
            "--name", "材料测试",
            "--length", "8",
            "--width", "6",
            "--height", "3"
        ])
        self.assertEqual(code, 0)

        import re
        match = re.search(r"房间ID: ([a-f0-9\-]+)", stdout)
        self.assertIsNotNone(match)
        room_id = match.group(1)

        code, stdout, stderr = self._run_cli([
            "add-material",
            "--room-id", room_id,
            "--name", "矿棉板",
            "--area", "24",
            "--unit", "m2",
            "--absorption", "125:0.2,250:0.4,500:0.7,1000:0.9,2000:0.95,4000:0.9",
            "--operator", "CLI用户"
        ])
        self.assertEqual(code, 0)
        self.assertIn("材料添加成功", stdout)
        self.assertIn("自动计算结果", stdout)
        self.assertIn("平均混响时间", stdout)

    def test_verify_cli(self):
        self._run_cli(["create-room", "--name", "验证测试", "--length", "8", "--width", "6", "--height", "3"])
        code, stdout, stderr = self._run_cli(["verify"])
        self.assertEqual(code, 0)
        self.assertIn("数据完整性校验通过", stdout)

    def test_export_csv_cli(self):
        self._run_cli(["create-room", "--name", "导出测试", "--length", "8", "--width", "6", "--height", "3"])

        csv_file = os.path.join(self.test_dir, "test_output.csv")
        code, stdout, stderr = self._run_cli(["export-csv", "--output", csv_file])
        self.assertEqual(code, 0)
        self.assertIn("CSV导出完成", stdout)


if __name__ == "__main__":
    unittest.main(verbosity=2)
