# 解析模块
# 负责解析 SRT 字幕文件和 CSV 数据文件

import re
import csv
from datetime import datetime
from typing import List, Dict, Tuple, Optional, Any
from pathlib import Path

from .models import (
    SubtitleEntry,
    Speaker,
    SensitiveWord,
    NoteEntry,
    RiskLevel,
    RiskType,
    SpeakerPermission
)


class SRTParseError(Exception):
    """SRT 解析错误"""
    pass


class CSVParseError(Exception):
    """CSV 解析错误"""
    pass


class SRTParser:
    """SRT 字幕解析器"""
    
    # SRT 时间戳正则表达式: HH:MM:SS,mmm --> HH:MM:SS,mmm
    TIMECODE_PATTERN = re.compile(
        r'(\d{2}):(\d{2}):(\d{2}),(\d{3})\s*-->\s*(\d{2}):(\d{2}):(\d{2}),(\d{3})'
    )
    
    @classmethod
    def _timecode_to_seconds(cls, hours: int, minutes: int, seconds: int, milliseconds: int) -> float:
        """将时间戳转换为秒"""
        return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000.0
    
    @classmethod
    def _seconds_to_timecode(cls, total_seconds: float) -> str:
        """将秒转换为 SRT 时间戳格式"""
        hours = int(total_seconds // 3600)
        remainder = total_seconds % 3600
        minutes = int(remainder // 60)
        seconds = int(remainder % 60)
        milliseconds = int((total_seconds - int(total_seconds)) * 1000)
        return f"{hours:02d}:{minutes:02d}:{seconds:02d},{milliseconds:03d}"
    
    @classmethod
    def parse_string(cls, content: str) -> List[SubtitleEntry]:
        """
        从字符串解析 SRT 字幕
        
        Args:
            content: SRT 格式的字符串内容
            
        Returns:
            字幕条目列表
            
        Raises:
            SRTParseError: 解析失败时抛出
        """
        subtitles = []
        
        # 按空行分割成块
        blocks = re.split(r'\n\s*\n', content.strip())
        
        for block in blocks:
            lines = block.strip().split('\n')
            if len(lines) < 3:
                continue  # 跳过无效块
            
            # 解析序号
            try:
                subtitle_id = int(lines[0].strip())
            except ValueError:
                raise SRTParseError(f"无效的字幕序号: {lines[0]}")
            
            # 解析时间码
            timecode_match = cls.TIMECODE_PATTERN.match(lines[1])
            if not timecode_match:
                raise SRTParseError(f"无效的时间码格式: {lines[1]}")
            
            start_h, start_m, start_s, start_ms = map(int, timecode_match.groups()[:4])
            end_h, end_m, end_s, end_ms = map(int, timecode_match.groups()[4:])
            
            start_time = cls._timecode_to_seconds(start_h, start_m, start_s, start_ms)
            end_time = cls._timecode_to_seconds(end_h, end_m, end_s, end_ms)
            
            # 解析字幕文本（剩余行）
            text_lines = lines[2:]
            text = '\n'.join(text_lines).strip()
            
            # 尝试从文本中提取说话人（常见格式: [说话人] 文本 或 说话人: 文本）
            speaker = cls._extract_speaker(text)
            
            subtitle = SubtitleEntry(
                id=subtitle_id,
                start_time=start_time,
                end_time=end_time,
                text=text,
                speaker=speaker
            )
            
            subtitles.append(subtitle)
        
        return subtitles
    
    @classmethod
    def parse_file(cls, file_path: str) -> List[SubtitleEntry]:
        """
        从文件解析 SRT 字幕
        
        Args:
            file_path: SRT 文件路径
            
        Returns:
            字幕条目列表
            
        Raises:
            SRTParseError: 解析失败时抛出
            FileNotFoundError: 文件不存在时抛出
        """
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        try:
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
        except UnicodeDecodeError:
            # 尝试使用其他编码
            with open(path, 'r', encoding='gbk') as f:
                content = f.read()
        
        return cls.parse_string(content)
    
    @classmethod
    def _extract_speaker(cls, text: str) -> Optional[str]:
        """
        从字幕文本中尝试提取说话人
        
        支持的格式:
        - [张三] 大家好
        - [张三]: 大家好
        - 张三: 大家好
        - 张三：大家好（中文冒号）
        """
        # 匹配方括号格式: [说话人] 或 [说话人]:
        bracket_match = re.match(r'^\[([^\]]+)\]\s*:?\s*', text)
        if bracket_match:
            return bracket_match.group(1).strip()
        
        # 匹配冒号格式: 说话人: 或 说话人：
        colon_match = re.match(r'^([^：:\n\r]+?)[：:]\s+', text)
        if colon_match:
            speaker = colon_match.group(1).strip()
            # 过滤掉太短或明显不是人名的
            if len(speaker) >= 2 and len(speaker) <= 10:
                return speaker
        
        return None
    
    @classmethod
    def to_string(cls, subtitles: List[SubtitleEntry]) -> str:
        """
        将字幕列表转换为 SRT 格式字符串
        
        Args:
            subtitles: 字幕条目列表
            
        Returns:
            SRT 格式字符串
        """
        lines = []
        for i, subtitle in enumerate(subtitles, start=1):
            # 序号
            lines.append(str(i))
            # 时间码
            start_timecode = cls._seconds_to_timecode(subtitle.start_time)
            end_timecode = cls._seconds_to_timecode(subtitle.end_time)
            lines.append(f"{start_timecode} --> {end_timecode}")
            # 文本
            lines.append(subtitle.text)
            # 空行分隔
            lines.append('')
            lines.append('')
        
        return ''.join(lines).strip() + '\n'


class CSVParser:
    """CSV 数据解析器"""
    
    @classmethod
    def parse_speakers(cls, file_path: str) -> List[Speaker]:
        """
        解析说话人名单 CSV
        
        预期格式:
        - 列: name, permission, alias, notes, authorized_phrases
        - permission: FULL_AUTHORIZATION | PARTIAL_AUTHORIZATION | NO_AUTHORIZATION
        - alias: 逗号分隔的别名列表
        - authorized_phrases: 逗号分隔的授权短语列表
        
        Args:
            file_path: CSV 文件路径
            
        Returns:
            说话人信息列表
            
        Raises:
            CSVParseError: 解析失败时抛出
        """
        speakers = []
        path = Path(file_path)
        
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        try:
            with open(path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                
                for row in reader:
                    name = row.get('name', '').strip()
                    if not name:
                        continue
                    
                    # 解析权限
                    permission_str = row.get('permission', '').strip().upper()
                    try:
                        permission = SpeakerPermission[permission_str]
                    except KeyError:
                        # 默认值
                        permission = SpeakerPermission.NO_AUTHORIZATION
                    
                    # 解析别名
                    alias_str = row.get('alias', '').strip()
                    aliases = [a.strip() for a in alias_str.split(',') if a.strip()] if alias_str else []
                    
                    # 解析授权短语
                    authorized_str = row.get('authorized_phrases', '').strip()
                    authorized_phrases = [p.strip() for p in authorized_str.split(',') if p.strip()] if authorized_str else []
                    
                    notes = row.get('notes', '').strip()
                    
                    speaker = Speaker(
                        name=name,
                        permission=permission,
                        alias=aliases,
                        notes=notes,
                        authorized_phrases=authorized_phrases
                    )
                    
                    speakers.append(speaker)
        except Exception as e:
            raise CSVParseError(f"解析说话人名单失败: {str(e)}")
        
        return speakers
    
    @classmethod
    def parse_sensitive_words(cls, file_path: str) -> List[SensitiveWord]:
        """
        解析敏感词表 CSV
        
        预期格式:
        - 列: word, level, category, replacement, notes, is_pattern
        - level: LOW | MEDIUM | HIGH | CRITICAL
        - category: SENSITIVE_WORD | UNAUTHORIZED_NAME | ADDRESS | PERSONAL_ID | PHONE | EMAIL | COMPANY | OTHER
        - is_pattern: true | false (是否为正则表达式)
        
        Args:
            file_path: CSV 文件路径
            
        Returns:
            敏感词定义列表
        """
        sensitive_words = []
        path = Path(file_path)
        
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        try:
            with open(path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                
                for row in reader:
                    word = row.get('word', '').strip()
                    if not word:
                        continue
                    
                    # 解析风险等级
                    level_str = row.get('level', '').strip().upper()
                    try:
                        level = RiskLevel[level_str]
                    except KeyError:
                        level = RiskLevel.MEDIUM
                    
                    # 解析风险类型
                    category_str = row.get('category', '').strip().upper()
                    try:
                        category = RiskType[category_str]
                    except KeyError:
                        category = RiskType.SENSITIVE_WORD
                    
                    replacement = row.get('replacement', '[已脱敏]').strip()
                    notes = row.get('notes', '').strip()
                    is_pattern = row.get('is_pattern', '').strip().lower() in ('true', '1', 'yes')
                    
                    sensitive_word = SensitiveWord(
                        word=word,
                        level=level,
                        category=category,
                        replacement=replacement,
                        notes=notes,
                        is_pattern=is_pattern
                    )
                    
                    sensitive_words.append(sensitive_word)
        except Exception as e:
            raise CSVParseError(f"解析敏感词表失败: {str(e)}")
        
        return sensitive_words
    
    @classmethod
    def parse_notes(cls, file_path: str) -> List[NoteEntry]:
        """
        解析片段备注 CSV
        
        预期格式:
        - 列: subtitle_id, note_type, content, created_by
        
        Args:
            file_path: CSV 文件路径
            
        Returns:
            片段备注列表
        """
        notes = []
        path = Path(file_path)
        
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")
        
        try:
            with open(path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                
                for row in reader:
                    try:
                        subtitle_id = int(row.get('subtitle_id', '0').strip())
                    except ValueError:
                        continue
                    
                    note_type = row.get('note_type', 'general').strip()
                    content = row.get('content', '').strip()
                    
                    if not content:
                        continue
                    
                    created_by = row.get('created_by', '系统').strip()
                    
                    note = NoteEntry(
                        id=f"note_{datetime.now().timestamp()}_{subtitle_id}",
                        subtitle_id=subtitle_id,
                        note_type=note_type,
                        content=content,
                        created_by=created_by
                    )
                    
                    notes.append(note)
        except Exception as e:
            raise CSVParseError(f"解析片段备注失败: {str(e)}")
        
        return notes


class Parser:
    """统一的解析器入口"""
    
    srt_parser = SRTParser
    csv_parser = CSVParser
    
    @classmethod
    def parse_srt(cls, file_path: str) -> List[SubtitleEntry]:
        """解析 SRT 文件"""
        return cls.srt_parser.parse_file(file_path)
    
    @classmethod
    def parse_srt_string(cls, content: str) -> List[SubtitleEntry]:
        """解析 SRT 字符串"""
        return cls.srt_parser.parse_string(content)
    
    @classmethod
    def parse_speakers(cls, file_path: str) -> List[Speaker]:
        """解析说话人名单 CSV"""
        return cls.csv_parser.parse_speakers(file_path)
    
    @classmethod
    def parse_sensitive_words(cls, file_path: str) -> List[SensitiveWord]:
        """解析敏感词表 CSV"""
        return cls.csv_parser.parse_sensitive_words(file_path)
    
    @classmethod
    def parse_notes(cls, file_path: str) -> List[NoteEntry]:
        """解析片段备注 CSV"""
        return cls.csv_parser.parse_notes(file_path)
    
    @classmethod
    def subtitles_to_srt(cls, subtitles: List[SubtitleEntry]) -> str:
        """将字幕列表转换为 SRT 字符串"""
        return cls.srt_parser.to_string(subtitles)
