"""
音频元数据解析模块
负责解析音频文件的基本信息、检测静音段和音量峰值
"""

from __future__ import annotations

import os
import warnings
from typing import List, Dict, Any, Optional, Tuple, TYPE_CHECKING
from dataclasses import dataclass, field
from enum import Enum

warnings.filterwarnings('ignore')

try:
    from mutagen import File as MutagenFile
    from mutagen.mp3 import MP3
    from mutagen.wave import WAVE
    from mutagen.flac import FLAC
    from mutagen.oggvorbis import OggVorbis
    MUTAGEN_AVAILABLE = True
except ImportError:
    MUTAGEN_AVAILABLE = False

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False

try:
    from pydub import AudioSegment
    PYDUB_AVAILABLE = True
except ImportError:
    PYDUB_AVAILABLE = False


class AudioFormat(Enum):
    """支持的音频格式枚举"""
    MP3 = "mp3"
    WAV = "wav"
    FLAC = "flac"
    OGG = "ogg"
    M4A = "m4a"
    UNKNOWN = "unknown"


@dataclass
class AudioMetadata:
    """音频元数据类"""
    file_path: str
    file_name: str
    format: AudioFormat = AudioFormat.UNKNOWN
    duration_seconds: float = 0.0
    sample_rate: int = 0
    channels: int = 0
    bit_depth: int = 0
    bitrate: int = 0
    
    # 音频分析结果
    peak_dbfs: float = -float('inf')
    rms_dbfs: float = -float('inf')
    silence_segments: List[Tuple[float, float]] = field(default_factory=list)
    leading_silence_duration: float = 0.0
    trailing_silence_duration: float = 0.0
    
    # 解析状态
    parse_success: bool = False
    parse_error: str = ""
    
    @property
    def duration_formatted(self) -> str:
        """格式化时长显示"""
        minutes = int(self.duration_seconds // 60)
        seconds = int(self.duration_seconds % 60)
        milliseconds = int((self.duration_seconds * 1000) % 1000)
        return f"{minutes:02d}:{seconds:02d}.{milliseconds:03d}"
    
    @property
    def format_str(self) -> str:
        """格式字符串表示"""
        return self.format.value.upper()
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "file_path": self.file_path,
            "file_name": self.file_name,
            "format": self.format.value,
            "duration_seconds": self.duration_seconds,
            "duration_formatted": self.duration_formatted,
            "sample_rate": self.sample_rate,
            "channels": self.channels,
            "bit_depth": self.bit_depth,
            "bitrate": self.bitrate,
            "peak_dbfs": self.peak_dbfs,
            "rms_dbfs": self.rms_dbfs,
            "silence_segments": self.silence_segments,
            "leading_silence_duration": self.leading_silence_duration,
            "trailing_silence_duration": self.trailing_silence_duration,
            "parse_success": self.parse_success,
            "parse_error": self.parse_error
        }


class AudioAnalyzer:
    """音频分析器类"""
    
    # 默认参数
    DEFAULT_SILENCE_THRESHOLD_DB = -50.0
    DEFAULT_SILENCE_MIN_DURATION_MS = 500
    DEFAULT_PEAK_WARNING_THRESHOLD_DB = -1.0
    DEFAULT_PEAK_CRITICAL_THRESHOLD_DB = 0.0
    
    def __init__(self, 
                 silence_threshold_db: float = None,
                 silence_min_duration_ms: int = None,
                 peak_warning_threshold_db: float = None,
                 peak_critical_threshold_db: float = None):
        """
        初始化音频分析器
        
        Args:
            silence_threshold_db: 静音检测阈值（分贝）
            silence_min_duration_ms: 最小静音段时长（毫秒）
            peak_warning_threshold_db: 峰值警告阈值
            peak_critical_threshold_db: 峰值危险阈值
        """
        self.silence_threshold_db = silence_threshold_db or self.DEFAULT_SILENCE_THRESHOLD_DB
        self.silence_min_duration_ms = silence_min_duration_ms or self.DEFAULT_SILENCE_MIN_DURATION_MS
        self.peak_warning_threshold_db = peak_warning_threshold_db or self.DEFAULT_PEAK_WARNING_THRESHOLD_DB
        self.peak_critical_threshold_db = peak_critical_threshold_db or self.DEFAULT_PEAK_CRITICAL_THRESHOLD_DB
    
    def _detect_format(self, file_path: str) -> AudioFormat:
        """根据文件扩展名检测音频格式"""
        ext = os.path.splitext(file_path)[1].lower().lstrip('.')
        format_map = {
            'mp3': AudioFormat.MP3,
            'wav': AudioFormat.WAV,
            'wave': AudioFormat.WAV,
            'flac': AudioFormat.FLAC,
            'ogg': AudioFormat.OGG,
            'm4a': AudioFormat.M4A,
        }
        return format_map.get(ext, AudioFormat.UNKNOWN)
    
    def _parse_with_mutagen(self, file_path: str, metadata: AudioMetadata):
        """使用 mutagen 解析基本元数据"""
        if not MUTAGEN_AVAILABLE:
            return
        
        try:
            audio = MutagenFile(file_path)
            if audio is None:
                return
            
            # 获取时长
            if hasattr(audio, 'info') and hasattr(audio.info, 'length'):
                metadata.duration_seconds = audio.info.length
            
            # 获取采样率
            if hasattr(audio.info, 'sample_rate'):
                metadata.sample_rate = audio.info.sample_rate
            
            # 获取声道数
            if hasattr(audio.info, 'channels'):
                metadata.channels = audio.info.channels
            
            # 获取比特率
            if hasattr(audio.info, 'bitrate'):
                metadata.bitrate = audio.info.bitrate
            
            # 格式特定的信息
            if isinstance(audio, WAVE):
                if hasattr(audio.info, 'bits_per_sample'):
                    metadata.bit_depth = audio.info.bits_per_sample
            elif isinstance(audio, FLAC):
                if hasattr(audio.info, 'bits_per_sample'):
                    metadata.bit_depth = audio.info.bits_per_sample
                    
        except Exception as e:
            metadata.parse_error = f"Mutagen解析错误: {str(e)}"
    
    def _analyze_audio_data(self, file_path: str, metadata: AudioMetadata):
        """使用 pydub 分析音频数据（峰值、静音等）"""
        if not PYDUB_AVAILABLE or not NUMPY_AVAILABLE:
            return
        
        try:
            # 加载音频
            audio = AudioSegment.from_file(file_path)
            
            # 更新基本信息（如果 mutagen 没获取到）
            if metadata.duration_seconds == 0:
                metadata.duration_seconds = len(audio) / 1000.0
            
            if metadata.sample_rate == 0:
                metadata.sample_rate = audio.frame_rate
            
            if metadata.channels == 0:
                metadata.channels = audio.channels
            
            if metadata.bit_depth == 0:
                metadata.bit_depth = audio.sample_width * 8
            
            # 计算峰值
            samples = np.array(audio.get_array_of_samples())
            if audio.channels > 1:
                samples = samples.reshape(-1, audio.channels)
            
            # 归一化到 -1.0 到 1.0
            max_sample_value = 2 ** (audio.sample_width * 8 - 1)
            normalized_samples = samples.astype(np.float64) / max_sample_value
            
            # 计算峰值（dBFS）
            peak_amplitude = np.max(np.abs(normalized_samples))
            if peak_amplitude > 0:
                metadata.peak_dbfs = 20 * np.log10(peak_amplitude)
            else:
                metadata.peak_dbfs = -float('inf')
            
            # 计算 RMS
            rms_amplitude = np.sqrt(np.mean(normalized_samples ** 2))
            if rms_amplitude > 0:
                metadata.rms_dbfs = 20 * np.log10(rms_amplitude)
            else:
                metadata.rms_dbfs = -float('inf')
            
            # 检测静音段
            self._detect_silence(audio, metadata)
            
        except Exception as e:
            metadata.parse_error = f"音频分析错误: {str(e)}"
    
    def _detect_silence(self, audio: AudioSegment, metadata: AudioMetadata):
        """检测静音段"""
        if not NUMPY_AVAILABLE:
            return
        
        samples = np.array(audio.get_array_of_samples())
        sample_width = audio.sample_width
        frame_rate = audio.frame_rate
        max_sample = 2 ** (sample_width * 8 - 1)
        
        # 转换为分贝
        normalized = np.abs(samples.astype(np.float64)) / max_sample
        # 避免 log(0)
        normalized = np.clip(normalized, 1e-10, 1.0)
        db_samples = 20 * np.log10(normalized)
        
        # 找到低于阈值的样本
        is_silence = db_samples < self.silence_threshold_db
        
        # 找到连续的静音段
        silence_regions = []
        in_silence = False
        start_sample = 0
        
        for i, silent in enumerate(is_silence):
            if silent and not in_silence:
                in_silence = True
                start_sample = i
            elif not silent and in_silence:
                in_silence = False
                duration_samples = i - start_sample
                duration_ms = (duration_samples / frame_rate) * 1000
                
                if duration_ms >= self.silence_min_duration_ms:
                    start_time = start_sample / frame_rate
                    end_time = i / frame_rate
                    silence_regions.append((start_time, end_time))
        
        # 检查最后一个静音段
        if in_silence:
            duration_samples = len(is_silence) - start_sample
            duration_ms = (duration_samples / frame_rate) * 1000
            
            if duration_ms >= self.silence_min_duration_ms:
                start_time = start_sample / frame_rate
                end_time = len(is_silence) / frame_rate
                silence_regions.append((start_time, end_time))
        
        metadata.silence_segments = silence_regions
        
        # 计算片头静音
        if silence_regions:
            first_start, first_end = silence_regions[0]
            if first_start < 0.01:  # 几乎在开头
                metadata.leading_silence_duration = first_end
        
        # 计算片尾静音
        total_duration = metadata.duration_seconds
        if silence_regions:
            last_start, last_end = silence_regions[-1]
            if abs(last_end - total_duration) < 0.01:  # 几乎在结尾
                metadata.trailing_silence_duration = last_end - last_start
    
    def analyze_file(self, file_path: str) -> AudioMetadata:
        """
        分析单个音频文件
        
        Args:
            file_path: 音频文件路径
            
        Returns:
            AudioMetadata 对象，包含所有分析结果
        """
        metadata = AudioMetadata(
            file_path=file_path,
            file_name=os.path.basename(file_path)
        )
        
        # 检查文件是否存在
        if not os.path.exists(file_path):
            metadata.parse_error = f"文件不存在: {file_path}"
            return metadata
        
        # 检测格式
        metadata.format = self._detect_format(file_path)
        
        # 尝试用 mutagen 解析基本信息
        self._parse_with_mutagen(file_path, metadata)
        
        # 用 pydub 做详细分析
        self._analyze_audio_data(file_path, metadata)
        
        # 标记解析状态
        if metadata.parse_error:
            metadata.parse_success = False
        else:
            # 至少需要获取到时长才算成功
            metadata.parse_success = metadata.duration_seconds > 0
        
        return metadata
    
    def analyze_directory(self, directory_path: str) -> Dict[str, AudioMetadata]:
        """
        分析目录下的所有音频文件
        
        Args:
            directory_path: 目录路径
            
        Returns:
            字典，键为文件名，值为 AudioMetadata 对象
        """
        results = {}
        audio_extensions = {'.mp3', '.wav', '.flac', '.ogg', '.m4a', '.wave'}
        
        if not os.path.exists(directory_path):
            return results
        
        for filename in os.listdir(directory_path):
            ext = os.path.splitext(filename)[1].lower()
            if ext in audio_extensions:
                file_path = os.path.join(directory_path, filename)
                if os.path.isfile(file_path):
                    try:
                        metadata = self.analyze_file(file_path)
                        results[filename] = metadata
                    except Exception:
                        pass
        
        return results


class ProgramScheduleItem:
    """节目单条目"""
    
    def __init__(self, 
                 item_id: str,
                 title: str,
                 start_time: str,
                 duration_seconds: float,
                 audio_file: str = "",
                 item_type: str = "program",
                 notes: str = ""):
        """
        初始化节目单条目
        
        Args:
            item_id: 条目编号（如 P001, A001）
            title: 标题/名称
            start_time: 开始时间（HH:MM:SS 格式）
            duration_seconds: 预计时长（秒）
            audio_file: 关联的音频文件名
            item_type: 类型：program(节目), ad(广告), jingle(片头/片花)
            notes: 口播备注
        """
        self.item_id = item_id.strip()
        self.title = title.strip()
        self.start_time = start_time.strip()
        self.duration_seconds = duration_seconds
        self.audio_file = audio_file.strip()
        self.item_type = item_type.strip().lower()
        self.notes = notes.strip()
        
        # 计算结束时间
        self.end_time_seconds = self._time_to_seconds(start_time) + duration_seconds
    
    @staticmethod
    def _time_to_seconds(time_str: str) -> float:
        """将 HH:MM:SS 或 HH:MM 格式转换为秒数"""
        parts = time_str.strip().split(':')
        if len(parts) == 3:
            h, m, s = parts
            return int(h) * 3600 + int(m) * 60 + float(s)
        elif len(parts) == 2:
            h, m = parts
            return int(h) * 3600 + int(m) * 60
        return 0.0
    
    @staticmethod
    def _seconds_to_time(seconds: float) -> str:
        """将秒数转换为 HH:MM:SS 格式"""
        h = int(seconds // 3600)
        m = int((seconds % 3600) // 60)
        s = int(seconds % 60)
        ms = int((seconds * 1000) % 1000)
        return f"{h:02d}:{m:02d}:{s:02d}.{ms:03d}"
    
    @property
    def end_time_formatted(self) -> str:
        """格式化结束时间"""
        return self._seconds_to_time(self.end_time_seconds)
    
    @property
    def duration_formatted(self) -> str:
        """格式化时长"""
        minutes = int(self.duration_seconds // 60)
        seconds = int(self.duration_seconds % 60)
        return f"{minutes:02d}:{seconds:02d}"
    
    @property
    def type_display(self) -> str:
        """类型显示名称"""
        type_map = {
            'program': '节目',
            'ad': '广告',
            'jingle': '片花'
        }
        return type_map.get(self.item_type, self.item_type)
    
    def to_dict(self) -> Dict[str, Any]:
        """转换为字典"""
        return {
            "item_id": self.item_id,
            "title": self.title,
            "start_time": self.start_time,
            "duration_seconds": self.duration_seconds,
            "duration_formatted": self.duration_formatted,
            "audio_file": self.audio_file,
            "item_type": self.item_type,
            "type_display": self.type_display,
            "notes": self.notes,
            "end_time_seconds": self.end_time_seconds,
            "end_time_formatted": self.end_time_formatted
        }


def parse_program_schedule(csv_path: str) -> List[ProgramScheduleItem]:
    """
    解析节目单 CSV 文件
    
    预期的 CSV 格式（包含表头）：
    编号,标题,开始时间,预计时长(秒),音频文件,类型,口播备注
    
    或更简单的格式：
    编号,标题,开始时间,预计时长,音频文件,类型,备注
    
    Args:
        csv_path: CSV 文件路径
        
    Returns:
        节目单条目列表
    """
    items = []
    
    try:
        with open(csv_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()
    except UnicodeDecodeError:
        with open(csv_path, 'r', encoding='gbk') as f:
            lines = f.readlines()
    
    if not lines:
        return items
    
    # 解析表头
    header_line = lines[0].strip()
    headers = [h.strip().lower() for h in header_line.split(',')]
    
    # 确定列映射
    col_mapping = {}
    for i, h in enumerate(headers):
        if '编号' in h or 'id' in h:
            col_mapping['id'] = i
        elif '标题' in h or 'name' in h or 'title' in h:
            col_mapping['title'] = i
        elif '开始' in h or 'start' in h and '时间' in h:
            col_mapping['start_time'] = i
        elif '时长' in h or 'duration' in h:
            col_mapping['duration'] = i
        elif '音频' in h or '文件' in h or 'audio' in h or 'file' in h:
            col_mapping['audio_file'] = i
        elif '类型' in h or 'type' in h:
            col_mapping['type'] = i
        elif '备注' in h or 'note' in h:
            col_mapping['notes'] = i
    
    # 解析数据行
    for line in lines[1:]:
        line = line.strip()
        if not line:
            continue
        
        parts = line.split(',')
        
        # 默认值
        item_id = ""
        title = ""
        start_time = "00:00:00"
        duration_seconds = 0.0
        audio_file = ""
        item_type = "program"
        notes = ""
        
        # 根据列映射取值
        if 'id' in col_mapping and col_mapping['id'] < len(parts):
            item_id = parts[col_mapping['id']]
        
        if 'title' in col_mapping and col_mapping['title'] < len(parts):
            title = parts[col_mapping['title']]
        
        if 'start_time' in col_mapping and col_mapping['start_time'] < len(parts):
            start_time = parts[col_mapping['start_time']]
        
        if 'duration' in col_mapping and col_mapping['duration'] < len(parts):
            duration_str = parts[col_mapping['duration']]
            try:
                # 尝试直接解析为秒
                duration_seconds = float(duration_str)
            except ValueError:
                # 尝试解析 MM:SS 格式
                if ':' in duration_str:
                    d_parts = duration_str.split(':')
                    if len(d_parts) == 2:
                        duration_seconds = int(d_parts[0]) * 60 + float(d_parts[1])
        
        if 'audio_file' in col_mapping and col_mapping['audio_file'] < len(parts):
            audio_file = parts[col_mapping['audio_file']]
        
        if 'type' in col_mapping and col_mapping['type'] < len(parts):
            item_type = parts[col_mapping['type']]
        
        if 'notes' in col_mapping and col_mapping['notes'] < len(parts):
            notes = parts[col_mapping['notes']]
        
        # 如果没有明确的列映射，尝试按顺序解析
        if not col_mapping:
            if len(parts) >= 1:
                item_id = parts[0]
            if len(parts) >= 2:
                title = parts[1]
            if len(parts) >= 3:
                start_time = parts[2]
            if len(parts) >= 4:
                try:
                    duration_seconds = float(parts[3])
                except ValueError:
                    pass
            if len(parts) >= 5:
                audio_file = parts[4]
            if len(parts) >= 6:
                item_type = parts[5]
            if len(parts) >= 7:
                notes = parts[6]
        
        # 至少需要有编号才算有效条目
        if item_id:
            item = ProgramScheduleItem(
                item_id=item_id,
                title=title,
                start_time=start_time,
                duration_seconds=duration_seconds,
                audio_file=audio_file,
                item_type=item_type,
                notes=notes
            )
            items.append(item)
    
    return items
