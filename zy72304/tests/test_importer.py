"""
抽样名单导入器测试

测试防止重复导入导致数量翻倍的功能
"""

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from bus_scheduling.validator import BoundaryValidator
from bus_scheduling.importer import SamplingImporter


class TestSamplingImporter:
    """抽样导入器测试类"""

    def setup_method(self):
        self.validator = BoundaryValidator()
        self.importer = SamplingImporter(self.validator)
        self.test_data_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "test_data"
        )

    def test_import_mixed_file(self):
        """测试导入包含混合数的文件"""
        file_path = os.path.join(self.test_data_dir, "sampling_list_mixed.csv")
        records, issues, import_stat = self.importer.import_file(
            file_path, "实验助理小穆"
        )

        assert len(records) == 8
        assert len(issues) == 8
        assert import_stat["has_mixed_numbers"] is True
        assert import_stat["total_records"] == 8
        assert import_stat["new_records"] == 8
        assert import_stat["duplicate_records"] == 0

    def test_import_duplicate_file(self):
        """测试重复导入同一文件"""
        file_path = os.path.join(self.test_data_dir, "sampling_list_mixed.csv")

        # 第一次导入
        records1, issues1, stat1 = self.importer.import_file(
            file_path, "实验助理小穆"
        )
        assert stat1["new_records"] == 8
        assert stat1["duplicate_records"] == 0

        # 第二次导入（同一文件）
        records2, issues2, stat2 = self.importer.import_file(
            file_path, "实验助理小穆"
        )
        assert stat2["new_records"] == 0
        assert stat2["duplicate_records"] == 8
        assert "warning" in stat2

        # 验证所有记录都被标记为重复
        for record in records2:
            assert record.is_duplicate is True

    def test_import_no_duplicate(self):
        """测试导入不同的文件"""
        file1 = os.path.join(self.test_data_dir, "sampling_list_mixed.csv")
        file2 = os.path.join(self.test_data_dir, "sampling_list_decimal_only.csv")

        # 第一次导入
        records1, issues1, stat1 = self.importer.import_file(
            file1, "实验助理小穆"
        )
        assert stat1["new_records"] == 8

        # 第二次导入（不同文件）
        records2, issues2, stat2 = self.importer.import_file(
            file2, "实验助理小穆"
        )
        assert stat2["new_records"] == 4
        assert stat2["duplicate_records"] == 0

    def test_import_decimal_only(self):
        """测试导入只有小数的文件"""
        file_path = os.path.join(self.test_data_dir, "sampling_list_decimal_only.csv")
        records, issues, import_stat = self.importer.import_file(
            file_path, "实验助理小穆"
        )

        assert len(records) == 4
        assert import_stat["has_mixed_numbers"] is False

    def test_import_percentage_only(self):
        """测试导入只有百分数的文件"""
        file_path = os.path.join(self.test_data_dir, "sampling_list_percentage_only.csv")
        records, issues, import_stat = self.importer.import_file(
            file_path, "实验助理小穆"
        )

        assert len(records) == 4
        assert import_stat["has_mixed_numbers"] is False

    def test_check_duplicate(self):
        """测试检查文件是否已导入"""
        file_path = os.path.join(self.test_data_dir, "sampling_list_mixed.csv")

        # 导入前检查
        assert self.importer.check_duplicate(file_path) is False

        # 导入后检查
        self.importer.import_file(file_path, "实验助理小穆")
        assert self.importer.check_duplicate(file_path) is True

    def test_fingerprint_generation(self):
        """测试指纹生成"""
        row_data1 = {
            "route_code": "R001",
            "route_name": "中关村专线",
            "departure_time": "08:30",
            "passenger_count_original": "85%",
        }
        row_data2 = {
            "route_code": "R001",
            "route_name": "中关村专线",
            "departure_time": "08:30",
            "passenger_count_original": "85%",
        }
        row_data3 = {
            "route_code": "R002",
            "route_name": "国贸专线",
            "departure_time": "08:45",
            "passenger_count_original": "120",
        }

        fp1 = self.importer._generate_fingerprint(row_data1)
        fp2 = self.importer._generate_fingerprint(row_data2)
        fp3 = self.importer._generate_fingerprint(row_data3)

        # 相同数据生成相同指纹
        assert fp1 == fp2
        # 不同数据生成不同指纹
        assert fp1 != fp3

    def test_import_history(self):
        """测试导入历史记录"""
        file_path = os.path.join(self.test_data_dir, "sampling_list_mixed.csv")

        # 导入前历史为空
        assert len(self.importer.get_import_history()) == 0

        # 导入后有历史记录
        self.importer.import_file(file_path, "实验助理小穆")
        history = self.importer.get_import_history()
        assert len(history) == 1
        assert history[0]["source_file"] == "sampling_list_mixed.csv"
        assert history[0]["operator"] == "实验助理小穆"


if __name__ == "__main__":
    test = TestSamplingImporter()

    print("=== 抽样导入器测试 ===")
    print()

    print("1. 测试导入包含混合数的文件...")
    test.setup_method()
    test.test_import_mixed_file()
    print("   ✓ 通过")

    print("2. 测试重复导入同一文件...")
    test.setup_method()
    test.test_import_duplicate_file()
    print("   ✓ 通过")

    print("3. 测试导入不同的文件...")
    test.setup_method()
    test.test_import_no_duplicate()
    print("   ✓ 通过")

    print("4. 测试导入只有小数的文件...")
    test.setup_method()
    test.test_import_decimal_only()
    print("   ✓ 通过")

    print("5. 测试导入只有百分数的文件...")
    test.setup_method()
    test.test_import_percentage_only()
    print("   ✓ 通过")

    print("6. 测试检查文件是否已导入...")
    test.setup_method()
    test.test_check_duplicate()
    print("   ✓ 通过")

    print("7. 测试指纹生成...")
    test.setup_method()
    test.test_fingerprint_generation()
    print("   ✓ 通过")

    print("8. 测试导入历史记录...")
    test.setup_method()
    test.test_import_history()
    print("   ✓ 通过")

    print()
    print("所有测试通过！")
