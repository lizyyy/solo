"""
场记解析模块测试
"""

import os
import tempfile
import pytest
from pathlib import Path

from field_recording_tool.field_log_parser import (
    FieldLogParser, 
    FieldLogEntry, 
    ParsedFieldLog,
    parse_field_log
)


class TestFieldLogParser:
    """FieldLogParser类测试"""
    
    def setup_method(self):
        """创建临时测试文件"""
        self.temp_dir = tempfile.mkdtemp()
        
        # 创建示例场记CSV
        self.csv_content = """场景,镜号,条数,开始时间码,结束时间码,时长,描述,好条,备注
1,1,1,09:30:00:00,09:30:15:12,00:00:15:12,开场空镜-街道环境,是,环境声
1,1,2,09:30:16:00,09:30:20:05,00:00:04:05,开场空镜-街道环境,否,有噪音
1,2,1,09:35:00:00,09:35:30:00,00:00:30:00,主角采访-自我介绍,是,声音清晰
2,1,1,10:00:00:00,10:02:15:00,00:02:15:00,室外环境-市场噪音,否,环境声待确认
3,1,1,11:00:00:00,11:05:30:00,00:05:30:00,私密对话-室内,否,可能涉及隐私
"""
        
        self.csv_path = Path(self.temp_dir) / "field_log.csv"
        with open(self.csv_path, 'w', encoding='utf-8') as f:
            f.write(self.csv_content)
    
    def teardown_method(self):
        """清理临时目录"""
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_parser_initialization(self):
        """测试解析器初始化"""
        parser = FieldLogParser(str(self.csv_path))
        
        assert parser.file_path == self.csv_path
        assert parser.parsed_log.file_path == str(self.csv_path)
        assert parser.parsed_log.file_name == "field_log.csv"
    
    def test_parser_initialization_nonexistent_file(self):
        """测试解析不存在的文件"""
        with pytest.raises(FileNotFoundError):
            FieldLogParser("/nonexistent/path/log.csv")
    
    def test_parse_csv(self):
        """测试CSV解析"""
        parser = FieldLogParser(str(self.csv_path))
        result = parser.parse()
        
        # 检查基本统计
        assert result.total_entries == 5
        assert result.good_takes_count == 2  # 两个"是"的好条
        assert result.unique_scenes_count == 3  # 场景1,2,3
        
        # 检查场景列表
        assert '1' in result.scenes
        assert '2' in result.scenes
        assert '3' in result.scenes
    
    def test_parse_entry_fields(self):
        """测试解析条目的字段"""
        parser = FieldLogParser(str(self.csv_path))
        result = parser.parse()
        
        # 检查第一条
        first_entry = result.entries[0]
        assert first_entry.scene_number == '1'
        assert first_entry.shot_number == '1'
        assert first_entry.take_number == '1'
        assert first_entry.timecode_start == '09:30:00:00'
        assert first_entry.timecode_end == '09:30:15:12'
        assert first_entry.duration == '00:00:15:12'
        assert first_entry.is_good_take == True
        
        # 检查包含"环境声"的条目应该被标记为wild_track
        assert '环境声' in first_entry.notes
    
    def test_good_take_detection(self):
        """测试好条检测"""
        parser = FieldLogParser(str(self.csv_path))
        result = parser.parse()
        
        # 统计好条
        good_takes = [e for e in result.entries if e.is_good_take]
        assert len(good_takes) == 2
        
        # 第一条和第三条应该是好条
        assert result.entries[0].is_good_take == True
        assert result.entries[2].is_good_take == True
    
    def test_wild_track_detection(self):
        """测试环境声/补录声检测"""
        parser = FieldLogParser(str(self.csv_path))
        result = parser.parse()
        
        # 第一条包含"环境声"
        assert result.entries[0].is_wild_track == True
        
        # 第三条不包含"环境声"或"补录"
        assert result.entries[2].is_wild_track == False
    
    def test_headers_capture(self):
        """测试表头捕获"""
        parser = FieldLogParser(str(self.csv_path))
        result = parser.parse()
        
        assert len(result.headers) > 0
        assert '场景' in result.headers or 'Scene' in result.headers or 'scene' in result.headers


class TestParseFieldLogFunction:
    """parse_field_log便捷函数测试"""
    
    def setup_method(self):
        """创建临时测试文件"""
        self.temp_dir = tempfile.mkdtemp()
        
        csv_content = """场景,镜号,条数,描述
1,1,1,测试场景
"""
        
        self.csv_path = Path(self.temp_dir) / "test_log.csv"
        with open(self.csv_path, 'w', encoding='utf-8') as f:
            f.write(csv_content)
    
    def teardown_method(self):
        """清理临时目录"""
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_parse_field_log_function(self):
        """测试便捷函数"""
        result = parse_field_log(str(self.csv_path))
        
        assert result.total_entries == 1
        assert result.entries[0].scene_number == '1'


class TestFieldLogEntry:
    """FieldLogEntry数据类测试"""
    
    def test_field_log_entry_creation(self):
        """测试FieldLogEntry对象创建"""
        entry = FieldLogEntry(
            scene_number='1',
            shot_number='2',
            take_number='3',
            timecode_start='09:30:00:00',
            timecode_end='09:35:00:00',
            duration='00:05:00:00',
            scene_description='测试场景',
            is_good_take=True
        )
        
        assert entry.scene_number == '1'
        assert entry.shot_number == '2'
        assert entry.take_number == '3'
        assert entry.is_good_take == True
        assert entry.is_wild_track == False  # 默认值


class TestParsedFieldLog:
    """ParsedFieldLog数据类测试"""
    
    def test_parsed_field_log_creation(self):
        """测试ParsedFieldLog对象创建"""
        log = ParsedFieldLog(
            file_path='/path/to/log.csv',
            file_name='log.csv'
        )
        
        assert log.file_path == '/path/to/log.csv'
        assert log.file_name == 'log.csv'
        assert log.total_entries == 0
        assert log.good_takes_count == 0
        assert len(log.entries) == 0
    
    def test_parsed_field_log_with_entries(self):
        """测试包含条目的ParsedFieldLog"""
        entry1 = FieldLogEntry(scene_number='1', shot_number='1')
        entry2 = FieldLogEntry(scene_number='1', shot_number='2')
        
        log = ParsedFieldLog(
            file_path='/path/to/log.csv',
            file_name='log.csv',
            entries=[entry1, entry2]
        )
        
        assert len(log.entries) == 2


class TestFieldLogParserEdgeCases:
    """场记解析器边界情况测试"""
    
    def setup_method(self):
        """创建临时测试目录"""
        self.temp_dir = tempfile.mkdtemp()
    
    def teardown_method(self):
        """清理临时目录"""
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_empty_csv(self):
        """测试空CSV"""
        csv_content = """场景,镜号,条数
"""  # 只有表头，没有数据
        
        csv_path = Path(self.temp_dir) / "empty.csv"
        with open(csv_path, 'w', encoding='utf-8') as f:
            f.write(csv_content)
        
        parser = FieldLogParser(str(csv_path))
        result = parser.parse()
        
        assert result.total_entries == 0
    
    def test_missing_columns(self):
        """测试缺少某些列的CSV"""
        csv_content = """场景,描述
1,测试场景1
2,测试场景2
"""
        
        csv_path = Path(self.temp_dir) / "missing_cols.csv"
        with open(csv_path, 'w', encoding='utf-8') as f:
            f.write(csv_content)
        
        parser = FieldLogParser(str(csv_path))
        result = parser.parse()
        
        # 应该能解析，但缺少的字段使用默认值
        assert result.total_entries == 2
        assert result.entries[0].scene_number == '1'
        assert result.entries[0].shot_number == ''  # 镜号列不存在
    
    def test_different_column_names(self):
        """测试不同的列名（英文列名）"""
        csv_content = """Scene,Shot,Take,Description,GoodTake
1,1,1,Test Scene 1,Yes
1,2,1,Test Scene 2,No
"""
        
        csv_path = Path(self.temp_dir) / "english_cols.csv"
        with open(csv_path, 'w', encoding='utf-8') as f:
            f.write(csv_content)
        
        parser = FieldLogParser(str(csv_path))
        result = parser.parse()
        
        # 解析器应该能识别英文列名
        assert result.total_entries == 2
