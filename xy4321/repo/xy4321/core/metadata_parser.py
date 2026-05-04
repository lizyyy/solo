import os
from pathlib import Path
from typing import Dict, Any, Optional
from datetime import datetime

try:
    from mutagen import File as MutagenFile
    from mutagen.wave import WAVE
    from mutagen.mp3 import MP3
    from mutagen.mp4 import MP4
    MUTAGEN_AVAILABLE = True
except ImportError:
    MUTAGEN_AVAILABLE = False

from utils.audio_utils import (
    check_ffprobe_available,
    run_ffprobe,
    parse_ffprobe_output,
    get_file_hash
)


class MetadataParser:
    _ffprobe_available = None
    
    def __init__(self):
        if self._ffprobe_available is None:
            self._ffprobe_available = check_ffprobe_available()
    
    def parse_file(self, file_path: str, compute_hash: bool = True) -> Optional[Dict[str, Any]]:
        file_path = str(Path(file_path).resolve())
        
        if not os.path.exists(file_path):
            return None
        
        ext = Path(file_path).suffix.lower()
        supported_formats = {".wav", ".mp3", ".m4a", ".mp4", ".aac", ".flac"}
        
        if ext not in supported_formats:
            return None
        
        result = None
        
        if self._ffprobe_available:
            result = self._parse_with_ffprobe(file_path)
        
        if result is None and MUTAGEN_AVAILABLE:
            result = self._parse_with_mutagen(file_path)
        
        if result:
            if compute_hash:
                result["hash_value"] = get_file_hash(file_path)
            
            result["scan_time"] = datetime.now()
        
        return result
    
    def _parse_with_ffprobe(self, file_path: str) -> Optional[Dict[str, Any]]:
        try:
            ffprobe_data = run_ffprobe(file_path)
            if ffprobe_data:
                return parse_ffprobe_output(ffprobe_data, file_path)
        except Exception as e:
            print(f"ffprobe 解析失败: {e}")
        
        return None
    
    def _parse_with_mutagen(self, file_path: str) -> Optional[Dict[str, Any]]:
        try:
            audio = MutagenFile(file_path)
            if audio is None:
                return None
            
            ext = Path(file_path).suffix.lower()
            
            result = {
                "file_path": file_path,
                "file_name": Path(file_path).name,
                "file_size": os.path.getsize(file_path),
                "format": self._get_format_from_ext(ext),
                "duration_seconds": None,
                "sample_rate": None,
                "channels": None,
                "bit_rate": None,
                "bit_depth": None,
            }
            
            if hasattr(audio, "info"):
                info = audio.info
                
                if hasattr(info, "length"):
                    result["duration_seconds"] = info.length
                
                if hasattr(info, "sample_rate"):
                    result["sample_rate"] = info.sample_rate
                
                if hasattr(info, "channels"):
                    result["channels"] = info.channels
                
                if hasattr(info, "bitrate"):
                    result["bit_rate"] = info.bitrate
                
                if ext == ".wav" and hasattr(info, "bits_per_sample"):
                    result["bit_depth"] = info.bits_per_sample
            
            return result
            
        except Exception as e:
            print(f"mutagen 解析失败: {e}")
            return None
    
    def _get_format_from_ext(self, ext: str) -> str:
        format_map = {
            ".wav": "wav",
            ".mp3": "mp3",
            ".m4a": "m4a",
            ".mp4": "mp4",
            ".aac": "aac",
            ".flac": "flac"
        }
        return format_map.get(ext, ext.lstrip("."))
    
    def is_ffprobe_available(self) -> bool:
        return self._ffprobe_available
    
    def is_mutagen_available(self) -> bool:
        return MUTAGEN_AVAILABLE


metadata_parser = MetadataParser()
