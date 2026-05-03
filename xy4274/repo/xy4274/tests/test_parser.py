"""解析校验模块测试"""

import tempfile
from pathlib import Path
from datetime import timedelta

import pytest
import pysrt

from interview_sanitizer.parser import (
    SRTParser,
    AuthorizationParser,
    SensitiveNamesParser,
    AudioManifestParser,
    ProjectScanner,
    IssueType,
    Issue,
    AuthorizationData,
    AuthorizationRecord,
    SensitiveNames,
    SensitiveName,
)


class TestSRTParser:
    """SRT 解析器测试"""
    
    def test_parse_valid_srt(self, tmp_path: Path):
        """测试解析有效 SRT 文件"""
        srt_content = """1
00:00:01,000 --> 00:00:04,500
大家好，我是测试用户。

2
00:00:05,000 --> 00:00:09,000
这是第二条字幕。
"""
        srt_file = tmp_path / "test.srt"
        srt_file.write_text(srt_content, encoding='utf-8')
        
        content = SRTParser.parse(srt_file)
        
        assert content.file_path == srt_file
        assert len(content.subtitles) == 2
        assert content.subtitles[0].text == "大家好，我是测试用户。"
        assert content.subtitles[1].text == "这是第二条字幕。"
    
    def test_check_timeline_overlap(self, tmp_path: Path):
        """测试检测时间轴重叠"""
        srt_content = """1
00:00:01,000 --> 00:00:05,000
第一条字幕。

2
00:00:04,000 --> 00:00:08,000
第二条字幕（时间轴重叠）。
"""
        srt_file = tmp_path / "test.srt"
        srt_file.write_text(srt_content, encoding='utf-8')
        
        content = SRTParser.parse(srt_file)
        
        assert len(content.issues) == 1
        assert content.issues[0].issue_type == IssueType.TIMELINE_OVERLAP
        assert "重叠" in content.issues[0].description


class TestAuthorizationParser:
    """授权表解析器测试"""
    
    def test_parse_authorization_csv(self, tmp_path: Path):
        """测试解析授权表 CSV"""
        csv_content = """姓名,化名,授权状态,授权片段,备注
张三,张大爷,已授权,,主要受访者
李四,李师傅,未授权,,未授权
"""
        csv_file = tmp_path / "授权表.csv"
        csv_file.write_text(csv_content, encoding='utf-8-sig')
        
        data = AuthorizationParser.parse(csv_file)
        
        assert len(data.records) == 2
        assert "张三" in data.records
        assert "李四" in data.records
        
        zhang = data.records["张三"]
        assert zhang.pseudonym == "张大爷"
        assert zhang.is_authorized is True
        
        li = data.records["李四"]
        assert li.pseudonym == "李师傅"
        assert li.is_authorized is False
    
    def test_authorization_with_segments(self, tmp_path: Path):
        """测试带授权片段的解析"""
        csv_content = """姓名,化名,授权状态,授权片段,备注
张三,张大爷,已授权,00:00:00-00:05:00;00:10:00-00:15:00,分片段授权
"""
        csv_file = tmp_path / "授权表.csv"
        csv_file.write_text(csv_content, encoding='utf-8-sig')
        
        data = AuthorizationParser.parse(csv_file)
        
        zhang = data.records["张三"]
        assert len(zhang.segments) == 2
        assert zhang.segments[0][0] == timedelta(seconds=0)
        assert zhang.segments[0][1] == timedelta(minutes=5)
        assert zhang.segments[1][0] == timedelta(minutes=10)
        assert zhang.segments[1][1] == timedelta(minutes=15)
    
    def test_is_authorized_check(self):
        """测试授权检查方法"""
        record = AuthorizationRecord(
            name="张三",
            pseudonym="张大爷",
            is_authorized=True,
            segments=[
                (timedelta(minutes=0), timedelta(minutes=5)),
                (timedelta(minutes=10), timedelta(minutes=15)),
            ]
        )
        
        data = AuthorizationData(file_path=Path("/test"))
        data.records["张三"] = record
        
        assert data.is_authorized("张三", timedelta(minutes=2), timedelta(minutes=3)) is True
        assert data.is_authorized("张三", timedelta(minutes=12), timedelta(minutes=13)) is True
        assert data.is_authorized("张三", timedelta(minutes=6), timedelta(minutes=7)) is False


class TestSensitiveNamesParser:
    """敏感词词典解析器测试"""
    
    def test_parse_sensitive_names_csv(self, tmp_path: Path):
        """测试解析敏感词词典"""
        csv_content = """姓名,分类,建议化名,备注
张三,受访者,张大爷,
李四,同事,李师傅,
王五,领导,王厂长,
"""
        csv_file = tmp_path / "敏感词.csv"
        csv_file.write_text(csv_content, encoding='utf-8-sig')
        
        names = SensitiveNamesParser.parse(csv_file)
        
        assert len(names.names) == 3
        assert "张三" in names.names
        assert names.names["张三"].suggested_pseudonym == "张大爷"
        assert names.names["张三"].categories == ["受访者"]
        
        all_names = names.get_all_names()
        assert "张三" in all_names
        assert "李四" in all_names
        assert "王五" in all_names


class TestAudioManifestParser:
    """音频清单解析器测试"""
    
    def test_parse_audio_manifest(self, tmp_path: Path):
        """测试解析音频清单"""
        csv_content = """片段索引,文件路径,开始时间,结束时间,备注
1,./audio/seg1.wav,00:00:00,00:00:05,开场白
2,./audio/seg2.wav,00:00:05,00:00:10,正文
"""
        csv_file = tmp_path / "音频清单.csv"
        csv_file.write_text(csv_content, encoding='utf-8-sig')
        
        manifest = AudioManifestParser.parse(csv_file)
        
        assert len(manifest.slices) == 2
        assert manifest.slices[0].segment_index == 1
        assert manifest.slices[0].start_time == timedelta(seconds=0)
        assert manifest.slices[0].end_time == timedelta(seconds=5)


class TestProjectScanner:
    """项目扫描器测试"""
    
    def test_scan_empty_directory(self, tmp_path: Path):
        """测试扫描空目录"""
        scanner = ProjectScanner(tmp_path)
        results = scanner.scan()
        
        assert results["files_found"]["srt"] is False
        assert results["files_found"]["authorization"] is False
        assert results["files_found"]["sensitive_names"] is False
        assert results["files_found"]["audio_manifest"] is False
    
    def test_scan_with_example_files(self, tmp_path: Path):
        """测试扫描包含示例文件的目录"""
        srt_content = """1
00:00:01,000 --> 00:00:04,500
大家好，我是张三，今天很高兴能在这里接受访谈。
"""
        (tmp_path / "访谈实录.srt").write_text(srt_content, encoding='utf-8')
        
        auth_content = """姓名,化名,授权状态,授权片段,备注
张三,张大爷,已授权,,主要受访者
"""
        (tmp_path / "受访者授权表.csv").write_text(auth_content, encoding='utf-8-sig')
        
        sensitive_content = """姓名,分类,建议化名,备注
张三,受访者,张大爷,
"""
        (tmp_path / "敏感姓名词典.csv").write_text(sensitive_content, encoding='utf-8-sig')
        
        scanner = ProjectScanner(tmp_path)
        results = scanner.scan()
        
        assert results["files_found"]["srt"] is True
        assert results["files_found"]["authorization"] is True
        assert results["files_found"]["sensitive_names"] is True
