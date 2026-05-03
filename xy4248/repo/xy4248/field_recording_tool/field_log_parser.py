"""
场记解析模块
负责解析CSV格式的场记文件，提取场号、镜号、时间码和备注等信息
"""

import csv
import re
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
from datetime import datetime


@dataclass
class FieldLogEntry:
    """单条场记记录"""
    # 基础标识
    scene_number: str = ""      # 场号
    shot_number: str = ""       # 镜号
    take_number: str = ""       # 条数
    
    # 时间码
    timecode_start: str = ""    # 开始时间码
    timecode_end: str = ""      # 结束时间码
    duration: str = ""          # 时长
    
    # 内容信息
    scene_description: str = ""  # 场景描述
    shot_description: str = ""   # 镜头描述
    notes: str = ""             # 备注
    
    # 技术信息
    camera: str = ""            # 机位
    lens: str = ""              # 镜头
    filter: str = ""            # 滤镜
    audio_device: str = ""      # 录音设备
    audio_notes: str = ""       # 录音备注
    
    # 状态信息
    is_good_take: bool = False  # 是否好条
    is_wild_track: bool = False # 是否环境声/补录声
    sync_status: str = ""       # 同步状态
    
    # 原始数据
    raw_data: Dict[str, Any] = field(default_factory=dict)
    line_number: int = 0


@dataclass
class ParsedFieldLog:
    """解析后的场记文件"""
    file_path: str
    file_name: str
    
    # 统计信息
    total_entries: int = 0
    good_takes_count: int = 0
    wild_tracks_count: int = 0
    
    # 场景统计
    scenes: List[str] = field(default_factory=list)
    unique_scenes_count: int = 0
    
    # 条目列表
    entries: List[FieldLogEntry] = field(default_factory=list)
    
    # 元数据
    parse_time: str = field(default_factory=lambda: datetime.now().isoformat())
    headers: List[str] = field(default_factory=list)


class FieldLogParser:
    """场记解析器"""
    
    # 常见的场号列名
    SCENE_COLUMNS = ['scene', 'scene_number', '场号', '场景', '场', 'sc']
    
    # 常见的镜号列名
    SHOT_COLUMNS = ['shot', 'shot_number', '镜号', '镜头', '镜', 'sh']
    
    # 常见的条数列名
    TAKE_COLUMNS = ['take', 'take_number', '条数', '条', 'tk', 'take_num']
    
    # 常见的开始时间码列名
    TC_START_COLUMNS = [
        'timecode_in', 'tc_in', 'start_tc', 'timecode_start',
        '开始时间码', '入点', 'in_point', 'in', 'start_timecode'
    ]
    
    # 常见的结束时间码列名
    TC_END_COLUMNS = [
        'timecode_out', 'tc_out', 'end_tc', 'timecode_end',
        '结束时间码', '出点', 'out_point', 'out', 'end_timecode'
    ]
    
    # 常见的时长列名
    DURATION_COLUMNS = ['duration', '时长', 'length', '持续时间']
    
    # 常见的描述列名
    DESCRIPTION_COLUMNS = [
        'description', 'scene_description', 'shot_description',
        '描述', '场景描述', '镜头描述', '内容', '备注', 'notes'
    ]
    
    # 常见的"好条"标记列
    GOOD_TAKE_COLUMNS = [
        'good_take', 'is_good', '好条', '最佳', 'selected',
        'circle', '圈选', 'use', '可用'
    ]
    
    # 时间码正则表达式
    TIMECODE_PATTERN = re.compile(r'(\d{1,2}[:;]\d{2}[:;]\d{2}[:;.]\d{2,3})')
    
    def __init__(self, file_path: str):
        """
        初始化场记解析器
        
        Args:
            file_path: CSV文件路径
        """
        self.file_path = Path(file_path)
        if not self.file_path.exists():
            raise FileNotFoundError(f"场记文件不存在: {file_path}")
        if not self.file_path.is_file():
            raise IsADirectoryError(f"路径不是文件: {file_path}")
        
        self.parsed_log = ParsedFieldLog(
            file_path=str(self.file_path),
            file_name=self.file_path.name
        )
    
    def parse(self) -> ParsedFieldLog:
        """
        解析场记文件
        
        Returns:
            解析后的场记对象
        """
        try:
            with open(self.file_path, 'r', encoding='utf-8-sig') as f:
                # 尝试自动检测编码
                content = f.read()
            
            # 重新打开并解析
            with open(self.file_path, 'r', encoding='utf-8-sig') as f:
                # 使用csv.Sniffer自动检测格式
                sample = f.read(4096)
                f.seek(0)
                
                try:
                    dialect = csv.Sniffer().sniff(sample)
                except csv.Error:
                    # 如果无法自动检测，使用默认设置
                    dialect = csv.excel
                
                reader = csv.DictReader(f, dialect=dialect)
                
                if reader.fieldnames:
                    self.parsed_log.headers = list(reader.fieldnames)
                
                # 解析每一行
                for line_num, row in enumerate(reader, start=2):  # 从2开始是因为跳过表头
                    entry = self._parse_row(row, line_num)
                    if entry:
                        self.parsed_log.entries.append(entry)
                
                # 更新统计信息
                self._update_statistics()
                
        except Exception as e:
            print(f"解析场记文件时出错 {self.file_path}: {e}")
            # 尝试使用其他编码
            try:
                with open(self.file_path, 'r', encoding='gbk') as f:
                    reader = csv.DictReader(f)
                    if reader.fieldnames:
                        self.parsed_log.headers = list(reader.fieldnames)
                    
                    for line_num, row in enumerate(reader, start=2):
                        entry = self._parse_row(row, line_num)
                        if entry:
                            self.parsed_log.entries.append(entry)
                    
                    self._update_statistics()
            except Exception as e2:
                print(f"使用GBK编码解析也失败了: {e2}")
        
        return self.parsed_log
    
    def _parse_row(self, row: Dict[str, Any], line_number: int) -> Optional[FieldLogEntry]:
        """
        解析单行数据
        
        Args:
            row: 行数据字典
            line_number: 行号
            
        Returns:
            场记条目对象
        """
        entry = FieldLogEntry()
        entry.raw_data = row.copy()
        entry.line_number = line_number
        
        # 查找并解析各个字段
        self._parse_identifiers(row, entry)
        self._parse_timecodes(row, entry)
        self._parse_descriptions(row, entry)
        self._parse_status_flags(row, entry)
        
        # 检查是否是有效条目（至少有场号或镜号）
        if not entry.scene_number and not entry.shot_number:
            # 可能是空行或表头行，跳过
            return None
        
        return entry
    
    def _parse_identifiers(self, row: Dict[str, Any], entry: FieldLogEntry):
        """解析场号、镜号、条数"""
        # 场号
        for col in self.SCENE_COLUMNS:
            value = self._get_case_insensitive(row, col)
            if value:
                entry.scene_number = str(value).strip()
                break
        
        # 镜号
        for col in self.SHOT_COLUMNS:
            value = self._get_case_insensitive(row, col)
            if value:
                entry.shot_number = str(value).strip()
                break
        
        # 条数
        for col in self.TAKE_COLUMNS:
            value = self._get_case_insensitive(row, col)
            if value:
                entry.take_number = str(value).strip()
                break
    
    def _parse_timecodes(self, row: Dict[str, Any], entry: FieldLogEntry):
        """解析时间码"""
        # 开始时间码
        for col in self.TC_START_COLUMNS:
            value = self._get_case_insensitive(row, col)
            if value:
                tc = self._extract_timecode(str(value))
                if tc:
                    entry.timecode_start = tc
                    break
        
        # 结束时间码
        for col in self.TC_END_COLUMNS:
            value = self._get_case_insensitive(row, col)
            if value:
                tc = self._extract_timecode(str(value))
                if tc:
                    entry.timecode_end = tc
                    break
        
        # 时长
        for col in self.DURATION_COLUMNS:
            value = self._get_case_insensitive(row, col)
            if value:
                entry.duration = str(value).strip()
                break
        
        # 如果没有显式时长但有开始和结束时间码，尝试计算
        if not entry.duration and entry.timecode_start and entry.timecode_end:
            entry.duration = self._calculate_duration(entry.timecode_start, entry.timecode_end)
    
    def _parse_descriptions(self, row: Dict[str, Any], entry: FieldLogEntry):
        """解析描述和备注"""
        descriptions = []
        
        for col in self.DESCRIPTION_COLUMNS:
            value = self._get_case_insensitive(row, col)
            if value:
                descriptions.append(str(value).strip())
        
        if descriptions:
            # 合并所有描述
            full_description = " ".join(descriptions)
            entry.notes = full_description
            
            # 尝试区分场景描述和镜头描述
            if len(descriptions) >= 1:
                entry.scene_description = descriptions[0]
            if len(descriptions) >= 2:
                entry.shot_description = descriptions[1]
    
    def _parse_status_flags(self, row: Dict[str, Any], entry: FieldLogEntry):
        """解析状态标记（好条、环境声等）"""
        # 好条标记
        for col in self.GOOD_TAKE_COLUMNS:
            value = self._get_case_insensitive(row, col)
            if value:
                value_str = str(value).strip().lower()
                # 检查常见的"是"或"好"的标记
                if value_str in ['yes', 'true', '1', '是', '好', '✓', '√', 'circle', 'circled', '圈', '圈选', 'selected', '选']:
                    entry.is_good_take = True
                break
        
        # 检查是否是环境声/补录声（从描述或备注中识别）
        wild_keywords = ['wild', '环境', '补录', 'atmosphere', 'ambience', 'roomtone', 'room tone']
        full_text = (entry.notes + entry.scene_description + entry.shot_description).lower()
        
        for keyword in wild_keywords:
            if keyword in full_text:
                entry.is_wild_track = True
                break
    
    def _get_case_insensitive(self, row: Dict[str, Any], key: str) -> Optional[Any]:
        """
        不区分大小写地从字典中获取值
        
        Args:
            row: 行数据字典
            key: 键名
            
        Returns:
            值或None
        """
        # 精确匹配
        if key in row:
            return row[key]
        
        # 不区分大小写匹配
        key_lower = key.lower()
        for k, v in row.items():
            if k.lower() == key_lower:
                return v
        
        return None
    
    def _extract_timecode(self, text: str) -> Optional[str]:
        """
        从文本中提取时间码
        
        Args:
            text: 可能包含时间码的文本
            
        Returns:
            时间码字符串或None
        """
        match = self.TIMECODE_PATTERN.search(text)
        if match:
            return match.group(1)
        
        # 尝试简化格式
        simple_pattern = re.compile(r'(\d{1,2}:\d{2}:\d{2})')
        match = simple_pattern.search(text)
        if match:
            # 添加帧/毫秒占位符
            return match.group(1) + ":00"
        
        return None
    
    def _calculate_duration(self, start_tc: str, end_tc: str) -> str:
        """
        计算两个时间码之间的时长（简化版本）
        
        Args:
            start_tc: 开始时间码
            end_tc: 结束时间码
            
        Returns:
            时长字符串
        """
        # 这是一个简化实现，实际生产环境可能需要更精确的时间码计算
        # 包括考虑帧率、丢帧等情况
        return "计算中..."
    
    def _update_statistics(self):
        """更新统计信息"""
        self.parsed_log.total_entries = len(self.parsed_log.entries)
        self.parsed_log.good_takes_count = sum(1 for e in self.parsed_log.entries if e.is_good_take)
        self.parsed_log.wild_tracks_count = sum(1 for e in self.parsed_log.entries if e.is_wild_track)
        
        # 收集所有场景
        scenes = set()
        for entry in self.parsed_log.entries:
            if entry.scene_number:
                scenes.add(entry.scene_number)
        
        self.parsed_log.scenes = sorted(list(scenes))
        self.parsed_log.unique_scenes_count = len(self.parsed_log.scenes)


def parse_field_log(file_path: str) -> ParsedFieldLog:
    """
    便捷函数：解析场记文件
    
    Args:
        file_path: CSV文件路径
        
    Returns:
        解析后的场记对象
    """
    parser = FieldLogParser(file_path)
    return parser.parse()


def batch_parse_field_logs(file_paths: List[str]) -> List[ParsedFieldLog]:
    """
    批量解析多个场记文件
    
    Args:
        file_paths: CSV文件路径列表
        
    Returns:
        解析后的场记对象列表
    """
    results = []
    for file_path in file_paths:
        try:
            parsed = parse_field_log(file_path)
            results.append(parsed)
        except Exception as e:
            print(f"处理场记文件 {file_path} 时出错: {e}")
    return results
