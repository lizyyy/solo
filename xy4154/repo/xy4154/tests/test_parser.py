"""
数据解析模块测试
测试CSV解析、JSONL解析和照片扫描功能
"""

import os
import sys
import tempfile
from datetime import datetime
from pathlib import Path
from unittest import TestCase

# 添加项目根目录到路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from core.models import Exhibit, ScanRecord, PhotoRecord
from core.parser import CSVParser, JSONLParser, PhotoScanner, DataImporter


class TestCSVParser(TestCase):
    """CSV解析器测试"""
    
    def setUp(self):
        """创建临时测试文件"""
        self.temp_dir = tempfile.mkdtemp()
        self.csv_path = os.path.join(self.temp_dir, "test_exhibits.csv")
        
        # 创建测试CSV内容
        csv_content = """exhibit_id,name,category,location,condition,is_fragile,special_requirements,estimated_value,notes
EX-001,测试展品1,青铜器,展厅A,完好,否,,100000,测试备注1
EX-002,测试展品2,瓷器,展厅B,完好,是,恒温恒湿,200000,测试备注2
EX-003,测试展品3,书画,展厅C,有小划痕,否,,50000,
"""
        
        with open(self.csv_path, 'w', encoding='utf-8') as f:
            f.write(csv_content)
    
    def tearDown(self):
        """清理临时文件"""
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_parse_valid_csv(self):
        """测试解析有效的CSV文件"""
        exhibits, errors = CSVParser.parse(self.csv_path)
        
        self.assertEqual(len(errors), 0)
        self.assertEqual(len(exhibits), 3)
        
        # 检查第一个展品
        self.assertEqual(exhibits[0].exhibit_id, 'EX-001')
        self.assertEqual(exhibits[0].name, '测试展品1')
        self.assertEqual(exhibits[0].category, '青铜器')
        self.assertEqual(exhibits[0].is_fragile, False)
        self.assertEqual(exhibits[0].estimated_value, 100000.0)
        
        # 检查第二个展品（易碎品）
        self.assertEqual(exhibits[1].exhibit_id, 'EX-002')
        self.assertEqual(exhibits[1].is_fragile, True)
        self.assertEqual(exhibits[1].special_requirements, '恒温恒湿')
    
    def test_parse_with_chinese_headers(self):
        """测试使用中文表头的CSV"""
        chinese_csv = os.path.join(self.temp_dir, "chinese_headers.csv")
        content = """展品编号,展品名称,类别,位置,状态,易碎品,特殊要求,价值,备注
EX-004,中文表头测试,玉器,展厅D,完好,是,,150000,测试中文表头
"""
        with open(chinese_csv, 'w', encoding='utf-8') as f:
            f.write(content)
        
        exhibits, errors = CSVParser.parse(chinese_csv)
        
        self.assertEqual(len(errors), 0)
        self.assertEqual(len(exhibits), 1)
        self.assertEqual(exhibits[0].exhibit_id, 'EX-004')
        self.assertEqual(exhibits[0].name, '中文表头测试')
    
    def test_parse_nonexistent_file(self):
        """测试解析不存在的文件"""
        exhibits, errors = CSVParser.parse("/nonexistent/path.csv")
        
        self.assertEqual(len(exhibits), 0)
        self.assertGreater(len(errors), 0)
    
    def test_parse_missing_required_fields(self):
        """测试缺少必需字段的CSV"""
        invalid_csv = os.path.join(self.temp_dir, "invalid.csv")
        content = """name,category
测试,瓷器
"""
        with open(invalid_csv, 'w', encoding='utf-8') as f:
            f.write(content)
        
        exhibits, errors = CSVParser.parse(invalid_csv)
        
        # 应该有错误，因为缺少exhibit_id
        self.assertGreater(len(errors), 0)


class TestJSONLParser(TestCase):
    """JSONL解析器测试"""
    
    def setUp(self):
        """创建临时测试文件"""
        self.temp_dir = tempfile.mkdtemp()
        self.jsonl_path = os.path.join(self.temp_dir, "test_scans.jsonl")
        
        # 创建测试JSONL内容
        jsonl_content = """{"scan_id": "SCAN-001", "exhibit_id": "EX-001", "box_number": "BOX-A01", "scan_time": "2024-05-15T09:30:00", "operator": "张三", "temperature": 22.5, "humidity": 55.0, "buffer_verified": true, "has_signature": true, "notes": "测试1", "photo_references": ["photo1.jpg"]}
{"scan_id": "SCAN-002", "exhibit_id": "EX-002", "box_number": "BOX-A01", "scan_time": "2024-05-15T10:00:00", "operator": "李四", "temperature": null, "humidity": null, "buffer_verified": false, "has_signature": false, "notes": "测试2", "photo_references": []}
"""
        
        with open(self.jsonl_path, 'w', encoding='utf-8') as f:
            f.write(jsonl_content)
    
    def tearDown(self):
        """清理临时文件"""
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_parse_valid_jsonl(self):
        """测试解析有效的JSONL文件"""
        scans, errors = JSONLParser.parse(self.jsonl_path)
        
        self.assertEqual(len(errors), 0)
        self.assertEqual(len(scans), 2)
        
        # 检查第一条扫描记录
        self.assertEqual(scans[0].scan_id, 'SCAN-001')
        self.assertEqual(scans[0].exhibit_id, 'EX-001')
        self.assertEqual(scans[0].box_number, 'BOX-A01')
        self.assertEqual(scans[0].operator, '张三')
        self.assertEqual(scans[0].temperature, 22.5)
        self.assertEqual(scans[0].humidity, 55.0)
        self.assertEqual(scans[0].buffer_verified, True)
        self.assertEqual(scans[0].has_signature, True)
        self.assertEqual(len(scans[0].photo_references), 1)
        
        # 检查第二条扫描记录（空值）
        self.assertEqual(scans[1].scan_id, 'SCAN-002')
        self.assertIsNone(scans[1].temperature)
        self.assertIsNone(scans[1].humidity)
        self.assertEqual(scans[1].buffer_verified, False)
        self.assertEqual(scans[1].has_signature, False)
    
    def test_parse_invalid_json(self):
        """测试解析无效的JSON行"""
        invalid_jsonl = os.path.join(self.temp_dir, "invalid.jsonl")
        # 注意：第1行和第3行缺少必需字段（box_number, scan_time, operator）
        # 所以会有多个错误：JSON格式错误 + 字段缺失错误
        content = """{"scan_id": "SCAN-001", "exhibit_id": "EX-001", "box_number": "BOX-A01", "scan_time": "2024-05-15T09:30:00", "operator": "张三"}
这不是有效的JSON
{"scan_id": "SCAN-002", "exhibit_id": "EX-002", "box_number": "BOX-A01", "scan_time": "2024-05-15T10:00:00", "operator": "李四"}
"""
        with open(invalid_jsonl, 'w', encoding='utf-8') as f:
            f.write(content)
        
        scans, errors = JSONLParser.parse(invalid_jsonl)
        
        # 应该有1个JSON解析错误，但2个有效行能被解析
        self.assertEqual(len(errors), 1)
        self.assertEqual(len(scans), 2)


class TestPhotoScanner(TestCase):
    """照片扫描器测试"""
    
    def setUp(self):
        """创建临时测试目录"""
        self.temp_dir = tempfile.mkdtemp()
        
        # 创建模拟照片文件
        self.photo_dir = os.path.join(self.temp_dir, "photos")
        os.makedirs(self.photo_dir)
        
        # 创建一些测试图片文件
        test_photos = [
            "EX-001_BOX-A01_20240515_093000.jpg",
            "展品_EX-002_箱_BOX-A02_装箱前.png",
            "BOX-B01_20240515_100000_ex003_ex004.jpg",
            "random_photo.gif",  # 没有关联信息的照片
        ]
        
        for photo_name in test_photos:
            photo_path = os.path.join(self.photo_dir, photo_name)
            with open(photo_path, 'w') as f:
                f.write(f"模拟照片文件: {photo_name}")
    
    def tearDown(self):
        """清理临时文件"""
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_scan_photo_directory(self):
        """测试扫描照片目录"""
        photos, errors = PhotoScanner.scan(self.photo_dir)
        
        self.assertEqual(len(errors), 0)
        self.assertEqual(len(photos), 4)
        
        # 检查文件名解析
        photo_map = {p.file_name: p for p in photos}
        
        # 检查第一个照片: EX-001_BOX-A01_20240515_093000.jpg
        photo1 = photo_map["EX-001_BOX-A01_20240515_093000.jpg"]
        # 展品编号应该包含 EX-001 或类似格式
        self.assertTrue(any('EX-001' in ref or ref == 'EX-001' for ref in photo1.exhibit_references))
        # 箱号应该包含 A01
        self.assertTrue(any('A01' in ref for ref in photo1.box_references))
        
        # 检查第二个照片（中文命名）: 展品_EX-002_箱_BOX-A02_装箱前.png
        photo2 = photo_map["展品_EX-002_箱_BOX-A02_装箱前.png"]
        # 展品编号应该包含 EX-002
        self.assertTrue(any('EX-002' in ref for ref in photo2.exhibit_references))
        # 箱号应该包含 A02
        self.assertTrue(any('A02' in ref for ref in photo2.box_references))
    
    def test_scan_nonexistent_directory(self):
        """测试扫描不存在的目录"""
        photos, errors = PhotoScanner.scan("/nonexistent/directory")
        
        self.assertEqual(len(photos), 0)
        self.assertGreater(len(errors), 0)


class TestDataImporter(TestCase):
    """数据导入器测试"""
    
    def setUp(self):
        """创建临时测试目录和文件"""
        self.temp_dir = tempfile.mkdtemp()
        
        # 创建CSV文件
        csv_path = os.path.join(self.temp_dir, "exhibits.csv")
        csv_content = """exhibit_id,name,category
EX-001,测试1,青铜器
EX-002,测试2,瓷器
"""
        with open(csv_path, 'w', encoding='utf-8') as f:
            f.write(csv_content)
        
        # 创建JSONL文件
        jsonl_path = os.path.join(self.temp_dir, "scans.jsonl")
        jsonl_content = """{"scan_id": "SCAN-001", "exhibit_id": "EX-001", "box_number": "BOX-A01", "scan_time": "2024-05-15T09:30:00", "operator": "张三", "buffer_verified": true, "has_signature": true, "photo_references": []}
"""
        with open(jsonl_path, 'w', encoding='utf-8') as f:
            f.write(jsonl_content)
        
        # 创建照片目录
        self.photo_dir = os.path.join(self.temp_dir, "photos")
        os.makedirs(self.photo_dir)
        with open(os.path.join(self.photo_dir, "EX-001_BOX-A01.jpg"), 'w') as f:
            f.write("test")
        
        self.csv_path = csv_path
        self.jsonl_path = jsonl_path
    
    def tearDown(self):
        """清理临时文件"""
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_import_all(self):
        """测试导入所有数据"""
        importer = DataImporter()
        project_data, errors = importer.import_all(
            csv_path=self.csv_path,
            jsonl_path=self.jsonl_path,
            photo_dir=self.photo_dir,
            project_name="测试项目"
        )
        
        # 检查数据
        self.assertEqual(project_data.project_name, "测试项目")
        self.assertEqual(len(project_data.exhibits), 2)
        self.assertEqual(len(project_data.scan_records), 1)
        self.assertEqual(len(project_data.photo_records), 1)
        
        # 检查错误
        self.assertEqual(len(errors['csv']), 0)
        self.assertEqual(len(errors['jsonl']), 0)
        self.assertEqual(len(errors['photos']), 0)
