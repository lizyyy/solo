import os
import re
from pathlib import Path
from typing import List, Dict
from .models import AudioFile
from .config import AUDIO_EXTENSIONS

class AudioScanner:
    def __init__(self, audio_dir: str):
        self.audio_dir = Path(audio_dir)
        if not self.audio_dir.exists():
            raise FileNotFoundError(f"音频目录不存在: {audio_dir}")
    
    def scan_files(self) -> List[AudioFile]:
        audio_files = []
        
        for file_path in self.audio_dir.rglob("*"):
            if file_path.is_file() and file_path.suffix.lower() in AUDIO_EXTENSIONS:
                audio_file = self._parse_audio_file(file_path)
                audio_files.append(audio_file)
        
        return audio_files
    
    def _parse_audio_file(self, file_path: Path) -> AudioFile:
        file_name = file_path.stem
        extension = file_path.suffix.lower()
        
        try:
            file_size = file_path.stat().st_size
        except OSError:
            file_size = 0
        
        audio_file = AudioFile(
            file_path=str(file_path),
            file_name=file_name,
            file_size=file_size,
            extension=extension
        )
        
        parsed = self._parse_filename(file_name)
        audio_file.parsed_track_id = parsed.get("track_id")
        audio_file.parsed_track_name = parsed.get("track_name")
        audio_file.parsed_student_name = parsed.get("student_name")
        
        if file_size == 0:
            audio_file.is_valid = False
            audio_file.error_message = "文件大小为0，可能已损坏"
        
        return audio_file
    
    def _parse_filename(self, filename: str) -> Dict[str, str]:
        result = {}
        
        pattern1 = r'^(TRK\d+)_([^_]+)_(.+?)(?:_|$)'
        match1 = re.match(pattern1, filename)
        if match1:
            result["track_id"] = match1.group(1)
            result["track_name"] = match1.group(2)
            result["student_name"] = match1.group(3).split("_")[0] if "_" in match1.group(3) else match1.group(3)
            return result
        
        pattern2 = r'^(TRK\d+)'
        match2 = re.match(pattern2, filename)
        if match2:
            result["track_id"] = match2.group(1)
        
        return result
    
    def get_audio_by_track_id(self, audio_files: List[AudioFile]) -> Dict[str, List[AudioFile]]:
        track_map = {}
        for af in audio_files:
            if af.parsed_track_id:
                if af.parsed_track_id not in track_map:
                    track_map[af.parsed_track_id] = []
                track_map[af.parsed_track_id].append(af)
        return track_map
