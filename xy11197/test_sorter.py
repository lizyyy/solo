import os
import shutil
import tempfile
import csv
from pathlib import Path
import pytest
from uniform_sorter.sorter import UniformSorter
from uniform_sorter.models import OrderStatus


class TestUniformSorter:
    
    def setup_method(self):
        self.test_dir = tempfile.mkdtemp()
        self.input_dir = Path(self.test_dir) / "input"
        self.output_dir = Path(self.test_dir) / "output"
        self.input_dir.mkdir()
    
    def teardown_method(self):
        shutil.rmtree(self.test_dir)
    
    def create_test_csv(self, filename, rows):
        file_path = self.input_dir / filename
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["学校名称", "年级", "班级", "学生姓名", "学号", "性别", "校服类型", "尺码", "数量", "备注"])
            for row in rows:
                writer.writerow(row)
        return file_path
    
    def test_empty_directory(self):
        """测试空目录"""
        sorter = UniformSorter(str(self.input_dir), str(self.output_dir))
        result = sorter.process()
        
        assert len(result.errors) == 1
        assert result.errors[0].error_type == "空目录"
        assert "没有找到CSV文件" in result.errors[0].message
    
    def test_normal_orders(self):
        """测试正常订单分拣"""
        self.create_test_csv("test.csv", [
            ["测试小学", "一", "1", "张三", "2023001", "男", "夏季校服", "120", "1", ""],
            ["测试小学", "一", "1", "李四", "2023002", "女", "夏季校服", "110", "1", ""],
        ])
        
        sorter = UniformSorter(str(self.input_dir), str(self.output_dir))
        result = sorter.process()
        
        normal_count = sum(len(orders) for orders in result.normal_orders.values())
        assert normal_count == 2
        assert len(result.size_change_orders) == 0
        assert len(result.errors) == 0
        
        normal_dir = self.output_dir / "正常订单"
        assert normal_dir.exists()
        assert len(list(normal_dir.glob("*.csv"))) == 1
    
    def test_size_change_order(self):
        """测试换码订单"""
        self.create_test_csv("test.csv", [
            ["测试小学", "一", "1", "张三", "2023001", "男", "夏季校服", "120", "1", "换码"],
        ])
        
        sorter = UniformSorter(str(self.input_dir), str(self.output_dir))
        result = sorter.process()
        
        assert len(result.size_change_orders) == 1
        assert result.size_change_orders[0].status == OrderStatus.SIZE_CHANGE
        
        special_dir = self.output_dir / "特殊情况"
        assert (special_dir / "换码订单.csv").exists()
    
    def test_out_of_stock_order(self):
        """测试缺货订单"""
        self.create_test_csv("test.csv", [
            ["测试小学", "一", "1", "张三", "2023001", "男", "夏季校服", "120", "1", "缺货"],
        ])
        
        sorter = UniformSorter(str(self.input_dir), str(self.output_dir))
        result = sorter.process()
        
        assert len(result.out_of_stock_orders) == 1
        assert result.out_of_stock_orders[0].status == OrderStatus.OUT_OF_STOCK
        
        special_dir = self.output_dir / "特殊情况"
        assert (special_dir / "缺货订单.csv").exists()
    
    def test_duplicate_name_orders(self):
        """测试同名学生订单"""
        self.create_test_csv("test.csv", [
            ["测试小学", "一", "1", "张三", "2023001", "男", "夏季校服", "120", "1", ""],
            ["测试小学", "一", "1", "张三", "2023002", "男", "夏季校服", "125", "1", ""],
        ])
        
        sorter = UniformSorter(str(self.input_dir), str(self.output_dir))
        result = sorter.process()
        
        assert len(result.duplicate_name_orders) == 2
        assert result.duplicate_name_orders[0].status == OrderStatus.DUPLICATE_NAME
        
        special_dir = self.output_dir / "特殊情况"
        assert (special_dir / "同名学生订单.csv").exists()
    
    def test_bad_rows(self):
        """测试坏行数据"""
        bad_rows = [
            ["测试小学", "一", "1", "", "2023001", "男", "夏季校服", "120", "1", ""],  # 空姓名
            ["测试小学", "一", "1", "李四", "", "女", "夏季校服", "110", "1", ""],  # 空学号
            ["测试小学", "一", "1", "王五", "2023003", "男", "夏季校服", "120", "abc", ""],  # 数量非数字
            ["测试小学", "一", "1", "赵六", "2023004", "男", "夏季校服", "120", "0", ""],  # 数量为0
        ]
        
        self.create_test_csv("bad.csv", bad_rows)
        
        sorter = UniformSorter(str(self.input_dir), str(self.output_dir))
        result = sorter.process()
        
        assert len(result.errors) == 4
        
        error_file = self.output_dir / "异常摘要.csv"
        assert error_file.exists()
        
        with open(error_file, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            error_list = list(reader)
            assert len(error_list) == 4
            
            # 验证错误包含文件和行号
            for err in error_list:
                assert err["来源文件"] == "bad.csv"
                assert int(err["行号"]) > 0
    
    def test_repeat_execution(self):
        """测试重复执行"""
        self.create_test_csv("test.csv", [
            ["测试小学", "一", "1", "张三", "2023001", "男", "夏季校服", "120", "1", ""],
        ])
        
        sorter1 = UniformSorter(str(self.input_dir), str(self.output_dir))
        result1 = sorter1.process()
        
        normal_count1 = sum(len(orders) for orders in result1.normal_orders.values())
        assert normal_count1 == 1
        
        sorter2 = UniformSorter(str(self.input_dir), str(self.output_dir))
        result2 = sorter2.process()
        
        normal_count2 = sum(len(orders) for orders in result2.normal_orders.values())
        assert normal_count2 == 1
        
        output_files = list(self.output_dir.rglob("*.csv"))
        assert len(output_files) > 0
    
    def test_error_summary_contains_source_and_line(self):
        """测试异常摘要包含来源文件和行号"""
        bad_rows = [
            ["测试小学", "一", "1", "", "2023001", "男", "夏季校服", "120", "1", ""],
        ]
        
        self.create_test_csv("test_error.csv", bad_rows)
        
        sorter = UniformSorter(str(self.input_dir), str(self.output_dir))
        result = sorter.process()
        
        assert len(result.errors) == 1
        assert result.errors[0].file_name == "test_error.csv"
        assert result.errors[0].line_number == 2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
