import os
import hashlib
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Optional
import re

from .models import AudioFile
from .audit_log import AuditLog


class AudioScanner:
    def __init__(self, config: Dict, audit_log: AuditLog):
        self.config = config
        self.audit_log = audit_log
        self.supported_formats = tuple(config.get('audio', {}).get('supported_formats', ['.mp3', '.wav', '.flac']))
        
    def scan_directory(self, directory: str, operator: str = "系统") -> List[AudioFile]:
        dir_path = Path(directory)
        if not dir_path.exists():
            raise FileNotFoundError(f"目录不存在: {directory}")
            
        self.audit_log.log(
            operator=operator,
            action="扫描音频目录",
            reason=f"开始扫描目录: {dir_path}",
            source=directory
        )
        
        audio_files = []
        
        for root, _, files in os.walk(dir_path):
            for file in files:
                if file.lower().endswith(self.supported_formats):
                    file_path = Path(root) / file
                    audio_file = self._extract_metadata(file_path)
                    if audio_file:
                        audio_files.append(audio_file)
                        
        self.audit_log.log(
            operator=operator,
            action="扫描完成",
            reason=f"扫描完成，共发现 {len(audio_files)} 个音频文件",
            source=directory
        )
        
        return audio_files
    
    def _extract_metadata(self, file_path: Path) -> Optional[AudioFile]:
        try:
            stat = file_path.stat()
            
            file_name = file_path.stem
            title, artist = self._parse_filename(file_name)
            
            md5_hash = self._calculate_md5(file_path)
            
            duration = self._estimate_duration(file_path)
            
            return AudioFile(
                file_path=str(file_path),
                file_name=file_path.name,
                file_size=stat.st_size,
                modified_at=datetime.fromtimestamp(stat.st_mtime),
                title=title,
                artist=artist,
                duration=duration,
                md5_hash=md5_hash
            )
            
        except Exception as e:
            self.audit_log.log(
                operator="系统",
                action="元数据提取失败",
                file_path=str(file_path),
                reason=f"提取元数据失败: {str(e)}",
                source=str(file_path)
            )
            return None
    
    def _parse_filename(self, filename: str):
        patterns = [
            r'^(.+?)\s*-\s*(.+)$',
            r'^(.+?)\s*—\s*(.+)$',
            r'^【(.+?)】(.+)$',
            r'^\[(.+?)\](.+)$',
        ]
        
        for pattern in patterns:
            match = re.match(pattern, filename)
            if match:
                return match.group(2).strip(), match.group(1).strip()
                
        return filename.strip(), None
    
    def _calculate_md5(self, file_path: Path, chunk_size: int = 8192) -> str:
        md5 = hashlib.md5()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(chunk_size), b''):
                md5.update(chunk)
        return md5.hexdigest()
    
    def _estimate_duration(self, file_path: Path) -> Optional[float]:
        try:
            file_size = file_path.stat().st_size
            ext = file_path.suffix.lower()
            
            if ext == '.mp3':
                approx_bitrate = 192000
                return (file_size * 8) / approx_bitrate
            elif ext == '.wav':
                return file_size / (44100 * 2 * 2)
            elif ext == '.flac':
                return file_size / (44100 * 2 * 1.5)
                
        except:
            pass
            
        return None
    
    def analyze_energy(self, audio_files: List[AudioFile]) -> List[AudioFile]:
        for audio_file in audio_files:
            audio_file.energy_score = self._calculate_energy_score(audio_file)
        return audio_files
    
    def _calculate_energy_score(self, audio_file: AudioFile) -> float:
        filename = audio_file.file_name.lower()
        
        energy_indicators = {
            'high': ['remix', 'club', 'dance', 'edm', 'bass', 'drop', '劲爆', '电音', '嗨曲', 'dj'],
            'medium': ['pop', 'rock', 'original', '原版', '正式'],
            'low': ['acoustic', 'ballad', 'piano', 'soft', '轻柔', '抒情', '慢歌']
        }
        
        score = 0.5
        
        for keyword in energy_indicators['high']:
            if keyword in filename:
                score += 0.2
                
        for keyword in energy_indicators['low']:
            if keyword in filename:
                score -= 0.2
                
        return max(0.0, min(1.0, score))
