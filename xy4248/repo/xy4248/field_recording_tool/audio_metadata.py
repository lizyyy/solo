"""
音频元数据模块
负责提取音频文件的技术参数、时长、采样率、时间码等信息
"""

import re
from pathlib import Path
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field
from datetime import datetime

try:
    from mutagen import File as MutagenFile
    from mutagen.wave import WAVE
    from mutagen.mp3 import MP3
    from mutagen.aiff import AIFF
    from mutagen.flac import FLAC
    MUTAGEN_AVAILABLE = True
except ImportError:
    MUTAGEN_AVAILABLE = False
    print("警告: mutagen库未安装，部分音频元数据功能将不可用")


@dataclass
class AudioMetadata:
    """音频元数据类"""
    file_path: str
    file_name: str
    
    # 基础信息
    duration_seconds: float = 0.0
    duration_formatted: str = "00:00:00.000"
    
    # 技术参数
    sample_rate: int = 0
    bit_rate: int = 0
    channels: int = 0
    bits_per_sample: int = 0
    
    # 时间码相关
    timecode_start: Optional[str] = None
    timecode_end: Optional[str] = None
    timecode_format: str = "unknown"
    
    # 元数据标签
    title: str = ""
    artist: str = ""
    album: str = ""
    comment: str = ""
    genre: str = ""
    year: str = ""
    track_number: str = ""
    
    # 额外信息
    file_format: str = ""
    codec: str = ""
    extraction_time: str = field(default_factory=lambda: datetime.now().isoformat())
    
    # 原始标签（用于调试）
    raw_tags: Dict[str, Any] = field(default_factory=dict)


class AudioMetadataExtractor:
    """音频元数据提取器"""
    
    # 常见的时间码标签（不同格式可能使用不同的标签名）
    TIMECODE_TAGS = [
        'timecode', 'time_code', 'tc', 'starttc', 'start_tc',
        'timecodestart', 'timecode_start',
        'replaygain_track_gain',  # 不是时间码，但可能包含时间信息
        'description', 'comment',  # 可能在备注中包含时间码
    ]
    
    # 时间码正则表达式模式
    TIMECODE_PATTERNS = [
        # 标准SMPTE时间码: HH:MM:SS:FF 或 HH;MM;SS;FF (丢帧)
        r'(\d{1,2}[:;]\d{2}[:;]\d{2}[:;]\d{2})',
        # 带毫秒的时间码: HH:MM:SS.sss
        r'(\d{1,2}:\d{2}:\d{2}\.\d{3})',
        # 简化格式: MM:SS.sss
        r'(\d{1,2}:\d{2}\.\d{3})',
    ]
    
    def __init__(self, file_path: str):
        """
        初始化音频元数据提取器
        
        Args:
            file_path: 音频文件路径
        """
        self.file_path = Path(file_path)
        if not self.file_path.exists():
            raise FileNotFoundError(f"音频文件不存在: {file_path}")
        if not self.file_path.is_file():
            raise IsADirectoryError(f"路径不是文件: {file_path}")
        
        self.metadata = AudioMetadata(
            file_path=str(self.file_path),
            file_name=self.file_path.name
        )
    
    def extract(self) -> AudioMetadata:
        """
        提取音频文件的所有元数据
        
        Returns:
            音频元数据对象
        """
        # 首先尝试使用mutagen库
        if MUTAGEN_AVAILABLE:
            self._extract_with_mutagen()
        
        # 从文件名中尝试提取时间码
        self._extract_timecode_from_filename()
        
        # 格式化时长
        self._format_duration()
        
        return self.metadata
    
    def _extract_with_mutagen(self):
        """使用mutagen库提取元数据"""
        try:
            audio = MutagenFile(str(self.file_path))
            
            if audio is None:
                return
            
            # 提取基础信息
            self._extract_basic_info(audio)
            
            # 提取标签信息
            self._extract_tags(audio)
            
            # 尝试提取时间码
            self._extract_timecode(audio)
            
            # 存储原始标签用于调试
            self.metadata.raw_tags = dict(audio)
            
        except Exception as e:
            print(f"使用mutagen提取元数据时出错 {self.file_path}: {e}")
    
    def _extract_basic_info(self, audio):
        """提取基础音频信息（时长、采样率等）"""
        # 尝试获取时长
        if hasattr(audio.info, 'length'):
            self.metadata.duration_seconds = audio.info.length
        
        # 尝试获取采样率
        if hasattr(audio.info, 'sample_rate'):
            self.metadata.sample_rate = audio.info.sample_rate
        
        # 尝试获取声道数
        if hasattr(audio.info, 'channels'):
            self.metadata.channels = audio.info.channels
        
        # 尝试获取比特率
        if hasattr(audio.info, 'bitrate'):
            self.metadata.bit_rate = audio.info.bitrate
        
        # 尝试获取位深
        if hasattr(audio.info, 'bits_per_sample'):
            self.metadata.bits_per_sample = audio.info.bits_per_sample
        
        # 根据文件类型设置格式
        ext = self.file_path.suffix.lower()
        self.metadata.file_format = ext.lstrip('.')
        
        # 尝试确定编解码器
        if ext == '.wav':
            self.metadata.codec = 'PCM'
        elif ext == '.mp3':
            self.metadata.codec = 'MPEG Audio Layer 3'
        elif ext == '.flac':
            self.metadata.codec = 'FLAC'
        elif ext in ['.aiff', '.aif']:
            self.metadata.codec = 'AIFF'
        elif ext == '.ogg':
            self.metadata.codec = 'Vorbis'
        elif ext == '.m4a':
            self.metadata.codec = 'AAC'
    
    def _extract_tags(self, audio):
        """提取ID3/其他格式的标签信息"""
        # 通用标签提取
        tag_mapping = {
            'title': ['TIT2', 'title', 'TITLE'],
            'artist': ['TPE1', 'artist', 'ARTIST'],
            'album': ['TALB', 'album', 'ALBUM'],
            'comment': ['COMM', 'comment', 'COMMENT', 'description', 'DESCRIPTION'],
            'genre': ['TCON', 'genre', 'GENRE'],
            'year': ['TYER', 'TDRC', 'year', 'YEAR'],
            'track_number': ['TRCK', 'tracknumber', 'TRACKNUMBER'],
        }
        
        for attr, possible_tags in tag_mapping.items():
            for tag in possible_tags:
                if tag in audio:
                    value = audio[tag]
                    # 处理不同类型的标签值
                    if isinstance(value, list) and len(value) > 0:
                        setattr(self.metadata, attr, str(value[0]))
                    elif isinstance(value, str):
                        setattr(self.metadata, attr, value)
                    break
    
    def _extract_timecode(self, audio):
        """尝试从标签中提取时间码"""
        # 检查所有可能包含时间码的标签
        for tag_name in self.TIMECODE_TAGS:
            if tag_name in audio:
                tag_value = str(audio[tag_name])
                timecode = self._parse_timecode_string(tag_value)
                if timecode:
                    self.metadata.timecode_start = timecode
                    self.metadata.timecode_format = self._detect_timecode_format(timecode)
                    return
        
        # 如果在专门的时间码标签中没找到，检查所有标签值
        for tag_value in audio.values():
            value_str = str(tag_value)
            timecode = self._parse_timecode_string(value_str)
            if timecode:
                self.metadata.timecode_start = timecode
                self.metadata.timecode_format = self._detect_timecode_format(timecode)
                break
    
    def _extract_timecode_from_filename(self):
        """尝试从文件名中提取时间码"""
        filename = self.file_path.stem
        timecode = self._parse_timecode_string(filename)
        if timecode and not self.metadata.timecode_start:
            self.metadata.timecode_start = timecode
            self.metadata.timecode_format = self._detect_timecode_format(timecode)
    
    def _parse_timecode_string(self, text: str) -> Optional[str]:
        """
        从文本中解析时间码
        
        Args:
            text: 可能包含时间码的文本
            
        Returns:
            找到的时间码字符串，未找到返回None
        """
        for pattern in self.TIMECODE_PATTERNS:
            match = re.search(pattern, text)
            if match:
                return match.group(1)
        return None
    
    def _detect_timecode_format(self, timecode: str) -> str:
        """
        检测时间码格式
        
        Args:
            timecode: 时间码字符串
            
        Returns:
            格式描述
        """
        if ';' in timecode:
            return 'drop_frame_smpte'
        elif ':' in timecode and timecode.count(':') == 3:
            return 'non_drop_frame_smpte'
        elif ':' in timecode and '.' in timecode:
            return 'time_with_milliseconds'
        else:
            return 'unknown'
    
    def _format_duration(self):
        """格式化时长为可读格式"""
        if self.metadata.duration_seconds > 0:
            hours = int(self.metadata.duration_seconds // 3600)
            minutes = int((self.metadata.duration_seconds % 3600) // 60)
            seconds = int(self.metadata.duration_seconds % 60)
            milliseconds = int((self.metadata.duration_seconds % 1) * 1000)
            self.metadata.duration_formatted = f"{hours:02d}:{minutes:02d}:{seconds:02d}.{milliseconds:03d}"
            
            # 如果有开始时间码，计算结束时间码
            if self.metadata.timecode_start:
                self._calculate_end_timecode()
    
    def _calculate_end_timecode(self):
        """根据开始时间码和时长计算结束时间码"""
        try:
            # 简单的计算（实际生产环境可能需要更精确的时间码处理）
            if self.metadata.timecode_format in ['drop_frame_smpte', 'non_drop_frame_smpte']:
                # SMPTE格式: HH:MM:SS:FF 或 HH;MM;SS;FF
                # 这里简化处理，实际可能需要考虑帧率
                self.metadata.timecode_end = self.metadata.timecode_start
            else:
                # 其他格式暂不计算结束时间码
                pass
        except Exception:
            pass


def extract_audio_metadata(file_path: str) -> AudioMetadata:
    """
    便捷函数：提取音频文件元数据
    
    Args:
        file_path: 音频文件路径
        
    Returns:
        音频元数据对象
    """
    extractor = AudioMetadataExtractor(file_path)
    return extractor.extract()


def batch_extract_metadata(file_paths: List[str]) -> List[AudioMetadata]:
    """
    批量提取多个音频文件的元数据
    
    Args:
        file_paths: 音频文件路径列表
        
    Returns:
        音频元数据对象列表
    """
    results = []
    for file_path in file_paths:
        try:
            metadata = extract_audio_metadata(file_path)
            results.append(metadata)
        except Exception as e:
            print(f"处理文件 {file_path} 时出错: {e}")
    return results
