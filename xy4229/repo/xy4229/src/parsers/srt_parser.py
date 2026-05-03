"""SRT 字幕解析器"""
from datetime import timedelta
from typing import List, Optional
import re

from src.models.models import Subtitle, parse_srt_time


class SRTParser:
    """SRT 字幕文件解析器"""
    
    SRT_TIME_PATTERN = re.compile(
        r'(\d{2}:\d{2}:\d{2}[,\.]\d{3})\s*-->\s*(\d{2}:\d{2}:\d{2}[,\.]\d{3})'
    )
    
    @classmethod
    def parse(cls, content: str) -> List[Subtitle]:
        """解析 SRT 内容为字幕列表"""
        subtitles = []
        
        # 统一换行符
        content = content.replace('\r\n', '\n').replace('\r', '\n')
        
        # 按空行分割字幕块
        blocks = re.split(r'\n\s*\n', content.strip())
        
        for block in blocks:
            if not block.strip():
                continue
            
            lines = block.strip().split('\n')
            if len(lines) < 2:
                continue
            
            # 解析字幕序号
            try:
                index = int(lines[0].strip())
            except ValueError:
                # 如果第一行不是数字，尝试查找时间码
                index = len(subtitles) + 1
            
            # 解析时间码和文本
            time_match = None
            text_start = 1
            
            for i, line in enumerate(lines):
                time_match = cls.SRT_TIME_PATTERN.match(line.strip())
                if time_match:
                    text_start = i + 1
                    break
            
            if not time_match:
                continue
            
            start_time_str = time_match.group(1)
            end_time_str = time_match.group(2)
            
            try:
                start_time = parse_srt_time(start_time_str)
                end_time = parse_srt_time(end_time_str)
            except ValueError:
                continue
            
            # 解析字幕文本
            text_lines = lines[text_start:]
            text = '\n'.join(text_lines).strip()
            
            if not text:
                continue
            
            # 提取说话人信息
            speaker = cls._extract_speaker(text)
            # 检测是否是音效提示
            sound_effect = cls._detect_sound_effect(text)
            
            subtitle = Subtitle(
                index=index,
                start_time=start_time,
                end_time=end_time,
                text=text,
                speaker=speaker,
                sound_effect=sound_effect
            )
            
            subtitles.append(subtitle)
        
        # 按序号排序
        subtitles.sort(key=lambda s: s.index)
        
        # 重新分配序号以确保连续
        for i, sub in enumerate(subtitles):
            sub.index = i + 1
        
        return subtitles
    
    @classmethod
    def parse_file(cls, file_path: str, encoding: str = 'utf-8') -> List[Subtitle]:
        """从文件解析 SRT"""
        with open(file_path, 'r', encoding=encoding) as f:
            content = f.read()
        return cls.parse(content)
    
    @staticmethod
    def _extract_speaker(text: str) -> Optional[str]:
        """从字幕文本中提取说话人信息"""
        # 常见的说话人标注格式
        # 例如: [张三]、张三:、【张三】、(张三)
        patterns = [
            r'^\[([^\]]+)\]',  # [张三]
            r'^【([^】]+)】',  # 【张三】
            r'^([^：:]+)[:：]\s*',  # 张三: 或 张三：
            r'^\(([^\)]+)\)',  # (张三)
        ]
        
        for pattern in patterns:
            match = re.match(pattern, text.strip())
            if match:
                return match.group(1).strip()
        
        return None
    
    @staticmethod
    def _detect_sound_effect(text: str) -> bool:
        """检测文本是否是音效提示"""
        # 音效提示通常的格式
        sound_effect_patterns = [
            r'^\[.*?\]$',  # [敲门声]
            r'^【.*?】$',  # 【敲门声】
            r'^\(.*?\)$',  # (敲门声)
            r'^<.*?>$',  # <敲门声>
        ]
        
        # 常见音效关键词
        sound_keywords = [
            '音乐', '音效', '掌声', '笑声', '哭声', '敲门声',
            '门铃声', '电话声', '汽车声', '脚步声', '水声',
            '雷声', '雨声', '风声', '爆炸声', '枪声', '音乐',
            '背景音乐', '主题曲', '插曲'
        ]
        
        text_stripped = text.strip()
        
        # 检查格式
        for pattern in sound_effect_patterns:
            if re.match(pattern, text_stripped):
                return True
        
        # 检查关键词
        for keyword in sound_keywords:
            if keyword in text_stripped:
                return True
        
        return False
    
    @classmethod
    def to_srt(cls, subtitles: List[Subtitle]) -> str:
        """将字幕列表转换为 SRT 格式字符串"""
        from src.models.models import timedelta_to_srt_format
        
        srt_lines = []
        for sub in subtitles:
            srt_lines.append(f"{sub.index}")
            start_str = timedelta_to_srt_format(sub.start_time)
            end_str = timedelta_to_srt_format(sub.end_time)
            srt_lines.append(f"{start_str} --> {end_str}")
            srt_lines.append(sub.text)
            srt_lines.append('')  # 空行分隔
        
        return '\n'.join(srt_lines)
    
    @classmethod
    def write_file(cls, subtitles: List[Subtitle], file_path: str, encoding: str = 'utf-8'):
        """将字幕列表写入 SRT 文件"""
        content = cls.to_srt(subtitles)
        with open(file_path, 'w', encoding=encoding) as f:
            f.write(content)
