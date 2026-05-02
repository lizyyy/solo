"""
测试文件名解析器
"""
import unittest
from pathlib import Path
from datetime import datetime

from inspection_organizer.filename_parser import FilenameParser
from inspection_organizer.config import PhotoMetadata, StoreRule


class TestFilenameParser(unittest.TestCase):
    """测试文件名解析器"""
    
    def setUp(self):
        """设置测试环境"""
        # 创建测试用的门店规则
        self.store_rules = [
            StoreRule(
                store_code="SH001",
                store_name="上海南京路店",
                checkpoints=["入口", "收银台", "货架A", "货架B"],
                time_window={"start": "09:00", "end": "21:00"},
                photo_patterns=["SH001"],
                checkpoint_patterns={
                    "入口": ["入口", "门口"],
                    "收银台": ["收银", "收银台"],
                    "货架A": ["货架A", "货架1"],
                    "货架B": ["货架B", "货架2"],
                }
            ),
            StoreRule(
                store_code="SH002",
                store_name="上海陆家嘴店",
                checkpoints=["入口", "收银台", "货架区"],
                time_window={"start": "10:00", "end": "22:00"},
                photo_patterns=["SH002"],
                checkpoint_patterns={}
            ),
        ]
        
        self.parser = FilenameParser(self.store_rules)
    
    def test_extract_time_from_filename_complete(self):
        """测试从文件名提取完整时间"""
        # 测试格式: 20230501_143000
        time_str = self.parser._extract_time_from_filename("SH001_20230501_143000_入口.jpg")
        self.assertIsNotNone(time_str)
        self.assertEqual(time_str[:10], "2023-05-01")
        
        # 测试格式: 2023-05-01 14:30:00
        time_str = self.parser._extract_time_from_filename("照片_2023-05-01_14:30:00.jpg")
        self.assertIsNotNone(time_str)
        self.assertEqual(time_str[:10], "2023-05-01")
    
    def test_extract_time_from_filename_date_only(self):
        """测试从文件名提取仅日期"""
        time_str = self.parser._extract_time_from_filename("SH001_20230501_入口.jpg")
        self.assertIsNotNone(time_str)
        self.assertEqual(time_str[:10], "2023-05-01")
    
    def test_extract_time_from_filename_short_year(self):
        """测试从文件名提取短格式年份"""
        time_str = self.parser._extract_time_from_filename("照片_230501_入口.jpg")
        self.assertIsNotNone(time_str)
        self.assertEqual(time_str[:10], "2023-05-01")
    
    def test_extract_store_from_filename_exact_match(self):
        """测试从文件名精确匹配门店编码"""
        # 创建元数据
        metadata = PhotoMetadata(
            original_path="/test/SH001_20230501_入口.jpg",
            filename="SH001_20230501_入口.jpg",
            size=1000,
        )
        
        # 解析
        photo_path = Path("/test/SH001_20230501_入口.jpg")
        metadata = self.parser.parse_filename(photo_path, metadata)
        
        self.assertEqual(metadata.store_code_from_filename, "SH001")
        self.assertEqual(metadata.determined_store_code, "SH001")
    
    def test_extract_checkpoint_from_filename(self):
        """测试从文件名提取点位"""
        metadata = PhotoMetadata(
            original_path="/test/SH001_20230501_收银台.jpg",
            filename="SH001_20230501_收银台.jpg",
            size=1000,
            determined_store_code="SH001",
        )
        
        photo_path = Path("/test/SH001_20230501_收银台.jpg")
        metadata = self.parser.parse_filename(photo_path, metadata)
        
        self.assertEqual(metadata.checkpoint_from_filename, "收银台")
        self.assertEqual(metadata.determined_checkpoint, "收银台")
    
    def test_time_priority(self):
        """测试时间优先级（EXIF优先于文件名）"""
        metadata = PhotoMetadata(
            original_path="/test/photo.jpg",
            filename="photo.jpg",
            size=1000,
            exif_time="2023-05-01 10:00:00",
            filename_time="2023-05-02 11:00:00",
        )
        
        photo_path = Path("/test/photo.jpg")
        metadata = self.parser.parse_filename(photo_path, metadata)
        
        # 应该优先使用EXIF时间
        self.assertEqual(metadata.determined_time, "2023-05-01 10:00:00")
    
    def test_no_exif_fallback_to_filename(self):
        """测试无EXIF时回退到文件名时间"""
        metadata = PhotoMetadata(
            original_path="/test/SH001_20230501_143000_入口.jpg",
            filename="SH001_20230501_143000_入口.jpg",
            size=1000,
            exif_time=None,  # 无EXIF
        )
        
        photo_path = Path("/test/SH001_20230501_143000_入口.jpg")
        metadata = self.parser.parse_filename(photo_path, metadata)
        
        # 应该从文件名获取时间
        self.assertIsNotNone(metadata.determined_time)
        self.assertEqual(metadata.determined_time, metadata.filename_time)
    
    def test_unknown_store(self):
        """测试未知门店编码"""
        metadata = PhotoMetadata(
            original_path="/test/XX999_20230501_入口.jpg",
            filename="XX999_20230501_入口.jpg",
            size=1000,
        )
        
        photo_path = Path("/test/XX999_20230501_入口.jpg")
        metadata = self.parser.parse_filename(photo_path, metadata)
        
        # XX999不在规则中，但仍会被提取
        self.assertEqual(metadata.store_code_from_filename, "XX999")
        self.assertEqual(metadata.determined_store_code, "XX999")
    
    def test_generic_checkpoint_match(self):
        """测试通用点位匹配"""
        # 没有门店信息时使用通用匹配
        metadata = PhotoMetadata(
            original_path="/test/unknown_卫生间.jpg",
            filename="unknown_卫生间.jpg",
            size=1000,
            determined_store_code=None,  # 无门店信息
        )
        
        photo_path = Path("/test/unknown_卫生间.jpg")
        metadata = self.parser.parse_filename(photo_path, metadata)
        
        # 应该匹配到通用点位
        self.assertEqual(metadata.checkpoint_from_filename, "卫生间")


if __name__ == '__main__':
    unittest.main()
