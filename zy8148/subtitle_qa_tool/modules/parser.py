#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
解析模块
- 解析 SRT/VTT 字幕文件
- 解析 JSON 片段清单
- 解析 YAML 配置（说话人、敏感词）
"""

import re
import json
import os
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field


@dataclass
class SubtitleItem:
    """字幕条目数据结构"""
    index: int
    start_time: float  # 秒
    end_time: float    # 秒
    text: str
    speaker: str = ""
    segment_id: str = ""
    original_text: str = ""  # 原始文本，用于比较


@dataclass
class Segment:
    """片段数据结构"""
    segment_id: str
    start_time: float
    end_time: float
    speaker: str = ""
    content: str = ""


@dataclass
class QAConfig:
    """质检配置数据结构"""
    speakers: List[str] = field(default_factory=list)
    sensitive_words: List[str] = field(default_factory=list)
    max_chars_per_second: float = 5.0  # 每秒最大字符数
    min_subtitle_duration: float = 0.3  # 最小字幕时长（秒）


class SubtitleParser:
    """字幕解析器 - 支持 SRT 和 VTT 格式"""
    
    # 时间格式正则表达式
    # 支持：
    # - HH:MM:SS,mmm (标准 SRT 格式)
    # - HH:MM:SS.mmm (VTT 格式或其他变体)
    # - MM:SS,mmm (无小时格式)
    # - MM:SS.mmm (无小时格式)
    TIME_PATTERN_SRT = re.compile(
        r'(\d{1,2}):(\d{2}):(\d{2})[,.](\d{1,3})'
    )
    TIME_PATTERN_NO_HOUR = re.compile(
        r'(\d{1,2}):(\d{2})[,.](\d{1,3})'
    )
    
    def __init__(self):
        self.subtitles: List[SubtitleItem] = []
        self.warnings: List[str] = []
    
    def parse(self, file_path: str) -> List[SubtitleItem]:
        """
        解析字幕文件，自动检测格式
        """
        ext = os.path.splitext(file_path)[1].lower()
        
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
        
        if ext == '.srt':
            return self._parse_srt(content)
        elif ext == '.vtt':
            return self._parse_vtt(content)
        else:
            # 尝试自动检测格式
            if 'WEBVTT' in content[:100]:
                return self._parse_vtt(content)
            else:
                return self._parse_srt(content)
    
    def _parse_srt(self, content: str) -> List[SubtitleItem]:
        """
        解析 SRT 格式字幕
        处理边界情况：
        - 连续空行
        - 不同的时间格式
        - 跨小时时间
        """
        self.subtitles = []
        self.warnings = []
        
        # 标准化换行符并分割成块
        # 处理连续空行：将多个空行替换为单个空行
        content = content.replace('\r\n', '\n').replace('\r', '\n')
        content = re.sub(r'\n{3,}', '\n\n', content)
        
        # 分割字幕块
        blocks = content.strip().split('\n\n')
        
        index = 0
        for block in blocks:
            block = block.strip()
            if not block:
                continue
            
            lines = block.split('\n')
            if len(lines) < 2:
                continue
            
            # 尝试解析字幕序号
            first_line = lines[0].strip()
            time_line_idx = 1
            
            if first_line.isdigit():
                # 标准 SRT 格式：第一行是序号
                subtitle_index = int(first_line)
            else:
                # 可能没有序号，尝试将第一行作为时间行
                time_line_idx = 0
                subtitle_index = index + 1
                self.warnings.append(f"警告：第 {index + 1} 个字幕块缺少序号，自动分配序号 {subtitle_index}")
            
            # 解析时间行
            if time_line_idx >= len(lines):
                continue
            
            time_line = lines[time_line_idx]
            start_sec, end_sec = self._parse_time_range(time_line)
            
            if start_sec is None or end_sec is None:
                self.warnings.append(f"警告：无法解析时间行：{time_line}")
                continue
            
            # 解析字幕文本
            text_lines = lines[time_line_idx + 1:]
            text = '\n'.join(text_lines).strip()
            
            # 检查并提取说话人标签（格式：[说话人] 或 说话人:）
            speaker, clean_text = self._extract_speaker(text)
            
            subtitle = SubtitleItem(
                index=subtitle_index,
                start_time=start_sec,
                end_time=end_sec,
                text=clean_text,
                original_text=text,
                speaker=speaker
            )
            
            self.subtitles.append(subtitle)
            index += 1
        
        return self.subtitles
    
    def _parse_vtt(self, content: str) -> List[SubtitleItem]:
        """
        解析 VTT 格式字幕
        """
        self.subtitles = []
        self.warnings = []
        
        # 移除 WEBVTT 头部
        lines = content.replace('\r\n', '\n').replace('\r', '\n').split('\n')
        start_idx = 0
        
        # 跳过头部
        while start_idx < len(lines) and not lines[start_idx].strip():
            start_idx += 1
        
        if start_idx < len(lines) and 'WEBVTT' in lines[start_idx]:
            start_idx += 1
            # 跳过空行和头部元数据
            while start_idx < len(lines) and lines[start_idx].strip() and ' --> ' not in lines[start_idx]:
                start_idx += 1
        
        # 重新组合内容进行解析
        processed_content = '\n'.join(lines[start_idx:])
        processed_content = re.sub(r'\n{3,}', '\n\n', processed_content)
        
        blocks = processed_content.strip().split('\n\n')
        
        index = 0
        for block in blocks:
            block = block.strip()
            if not block:
                continue
            
            lines = block.split('\n')
            if len(lines) < 1:
                continue
            
            # VTT 可能有或没有字幕 ID
            subtitle_index = index + 1
            time_line_idx = 0
            
            # 检查第一行是否是时间行（包含 -->）
            if ' --> ' not in lines[0]:
                # 第一行是字幕 ID，跳过
                if len(lines) > 1:
                    time_line_idx = 1
                else:
                    continue
            
            # 解析时间行
            time_line = lines[time_line_idx]
            start_sec, end_sec = self._parse_time_range(time_line)
            
            if start_sec is None or end_sec is None:
                self.warnings.append(f"警告：无法解析时间行：{time_line}")
                continue
            
            # 解析字幕文本
            text_lines = lines[time_line_idx + 1:]
            text = '\n'.join(text_lines).strip()
            
            # 检查并提取说话人标签
            speaker, clean_text = self._extract_speaker(text)
            
            subtitle = SubtitleItem(
                index=subtitle_index,
                start_time=start_sec,
                end_time=end_sec,
                text=clean_text,
                original_text=text,
                speaker=speaker
            )
            
            self.subtitles.append(subtitle)
            index += 1
        
        return self.subtitles
    
    def _parse_time_range(self, time_line: str) -> Tuple[Optional[float], Optional[float]]:
        """
        解析时间范围，支持多种格式
        返回 (开始时间秒, 结束时间秒)
        """
        # 标准格式：时间1 --> 时间2
        if ' --> ' in time_line:
            parts = time_line.split(' --> ')
        elif '-->' in time_line:
            parts = time_line.split('-->')
        else:
            # 尝试用其他分隔符
            parts = re.split(r'\s*[-–—]\s*', time_line)
        
        if len(parts) < 2:
            return None, None
        
        start_time_str = parts[0].strip()
        end_time_str = parts[1].strip()
        
        # 移除 VTT 中的位置标记等额外信息
        end_time_str = end_time_str.split()[0]
        
        start_sec = self._time_to_seconds(start_time_str)
        end_sec = self._time_to_seconds(end_time_str)
        
        return start_sec, end_sec
    
    def _time_to_seconds(self, time_str: str) -> Optional[float]:
        """
        将时间字符串转换为秒
        支持格式：
        - HH:MM:SS,mmm
        - HH:MM:SS.mmm
        - MM:SS,mmm
        - MM:SS.mmm
        """
        # 尝试匹配带小时的格式
        match = self.TIME_PATTERN_SRT.search(time_str)
        if match:
            hours = int(match.group(1))
            minutes = int(match.group(2))
            seconds = int(match.group(3))
            milliseconds = int(match.group(4).ljust(3, '0')[:3])  # 补全或截断到3位
            return hours * 3600 + minutes * 60 + seconds + milliseconds / 1000.0
        
        # 尝试匹配不带小时的格式
        match = self.TIME_PATTERN_NO_HOUR.search(time_str)
        if match:
            minutes = int(match.group(1))
            seconds = int(match.group(2))
            milliseconds = int(match.group(3).ljust(3, '0')[:3])
            return minutes * 60 + seconds + milliseconds / 1000.0
        
        return None
    
    def _extract_speaker(self, text: str) -> Tuple[str, str]:
        """
        从文本中提取说话人标签
        支持格式：
        - [说话人] 文本
        - 说话人: 文本
        - 【说话人】文本
        """
        speaker = ""
        clean_text = text
        
        # 检查方括号格式 [说话人]
        match = re.match(r'^\[([^\]]+)\]\s*', text)
        if match:
            speaker = match.group(1).strip()
            clean_text = text[match.end():].strip()
            return speaker, clean_text
        
        # 检查中文方括号格式 【说话人】
        match = re.match(r'^【([^】]+)】\s*', text)
        if match:
            speaker = match.group(1).strip()
            clean_text = text[match.end():].strip()
            return speaker, clean_text
        
        # 检查冒号格式 说话人: 文本
        # 限制冒号前的长度，避免误匹配 URL 等
        match = re.match(r'^([^:：]{1,20})[:：]\s*', text)
        if match:
            potential_speaker = match.group(1).strip()
            # 排除数字开头的情况（可能是时间或序号）
            if not potential_speaker[0].isdigit() if potential_speaker else False:
                # 排除常见的非说话人情况
                excluded_prefixes = ['http', 'www', 'ftp', '注意', '提示', '说明', '重要']
                if not any(potential_speaker.lower().startswith(prefix.lower()) for prefix in excluded_prefixes):
                    speaker = potential_speaker
                    clean_text = text[match.end():].strip()
        
        return speaker, clean_text


class SegmentsParser:
    """片段清单解析器 - JSON 格式"""
    
    def __init__(self):
        self.segments: List[Segment] = []
    
    def parse(self, file_path: str) -> List[Segment]:
        """
        解析 JSON 格式的片段清单
        支持多种格式的时间表示
        """
        self.segments = []
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 支持多种数据结构
        items = []
        
        if isinstance(data, list):
            items = data
        elif isinstance(data, dict):
            # 可能包含 segments 字段
            if 'segments' in data:
                items = data['segments']
            elif 'items' in data:
                items = data['items']
            else:
                # 尝试作为单个片段
                items = [data]
        
        for item in items:
            segment = self._parse_segment(item)
            if segment:
                self.segments.append(segment)
        
        return self.segments
    
    def _parse_segment(self, item: Dict[str, Any]) -> Optional[Segment]:
        """
        解析单个片段
        """
        if not isinstance(item, dict):
            return None
        
        # 提取必需字段
        segment_id = str(item.get('id', item.get('segment_id', '')))
        
        # 解析时间 - 支持多种格式
        start_time = self._get_time(item, ['start', 'start_time', 'begin'])
        end_time = self._get_time(item, ['end', 'end_time', 'finish'])
        
        if start_time is None or end_time is None:
            return None
        
        # 提取可选字段
        speaker = item.get('speaker', item.get('speaker_name', ''))
        content = item.get('content', item.get('text', item.get('transcript', '')))
        
        return Segment(
            segment_id=segment_id,
            start_time=start_time,
            end_time=end_time,
            speaker=speaker,
            content=content
        )
    
    def _get_time(self, item: Dict[str, Any], keys: List[str]) -> Optional[float]:
        """
        从字典中获取时间值，支持多种键和格式
        """
        for key in keys:
            if key in item:
                value = item[key]
                if isinstance(value, (int, float)):
                    return float(value)
                elif isinstance(value, str):
                    # 尝试解析时间字符串
                    parser = SubtitleParser()
                    seconds = parser._time_to_seconds(value)
                    if seconds is not None:
                        return seconds
                    # 尝试直接转换为数字
                    try:
                        return float(value)
                    except ValueError:
                        pass
        return None


class ConfigParser:
    """配置解析器 - YAML 格式（说话人、敏感词）"""
    
    def __init__(self):
        self.config = QAConfig()
    
    def parse(self, file_path: str) -> QAConfig:
        """
        解析 YAML 配置文件
        """
        try:
            import yaml
        except ImportError:
            raise ImportError("请安装 pyyaml 库: pip install pyyaml")
        
        with open(file_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        if not data:
            data = {}
        
        # 解析说话人列表
        speakers = data.get('speakers', data.get('speaker_list', []))
        if isinstance(speakers, list):
            self.config.speakers = [str(s).strip() for s in speakers if s]
        
        # 解析敏感词列表
        sensitive_words = data.get('sensitive_words', data.get('banned_words', []))
        if isinstance(sensitive_words, list):
            self.config.sensitive_words = [str(s).strip() for s in sensitive_words if s]
        
        # 解析质检参数
        self.config.max_chars_per_second = data.get(
            'max_chars_per_second', 
            data.get('chars_per_second', 5.0)
        )
        self.config.min_subtitle_duration = data.get(
            'min_subtitle_duration', 
            data.get('min_duration', 0.3)
        )
        
        return self.config
    
    def get_default_config(self) -> QAConfig:
        """
        获取默认配置
        """
        return QAConfig(
            speakers=[],
            sensitive_words=[],
            max_chars_per_second=5.0,
            min_subtitle_duration=0.3
        )
