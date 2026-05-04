import os
import hashlib
import subprocess
import json
from pathlib import Path
from typing import Dict, Any, Optional, Tuple
from datetime import datetime


def get_file_hash(file_path: str, algorithm: str = "sha256", block_size: int = 65536) -> Optional[str]:
    try:
        hasher = hashlib.new(algorithm)
        with open(file_path, "rb") as f:
            while block := f.read(block_size):
                hasher.update(block)
        return hasher.hexdigest()
    except Exception as e:
        print(f"计算文件哈希失败: {e}")
        return None


def check_ffprobe_available() -> bool:
    try:
        result = subprocess.run(
            ["ffprobe", "-version"],
            capture_output=True,
            text=True,
            timeout=5
        )
        return result.returncode == 0
    except (FileNotFoundError, subprocess.TimeoutExpired):
        return False


def run_ffprobe(file_path: str) -> Optional[Dict[str, Any]]:
    try:
        cmd = [
            "ffprobe",
            "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-show_streams",
            file_path
        ]
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=30
        )
        
        if result.returncode == 0:
            return json.loads(result.stdout)
        return None
    except Exception as e:
        print(f"ffprobe 执行失败: {e}")
        return None


def parse_ffprobe_output(ffprobe_data: Dict[str, Any], file_path: str) -> Dict[str, Any]:
    result = {
        "file_path": file_path,
        "file_name": Path(file_path).name,
        "file_size": os.path.getsize(file_path) if os.path.exists(file_path) else None,
        "format": None,
        "duration_seconds": None,
        "sample_rate": None,
        "channels": None,
        "bit_rate": None,
        "bit_depth": None,
    }
    
    try:
        format_info = ffprobe_data.get("format", {})
        result["format"] = format_info.get("format_name", "").split(",")[0]
        
        duration_str = format_info.get("duration")
        if duration_str:
            result["duration_seconds"] = float(duration_str)
        
        bit_rate_str = format_info.get("bit_rate")
        if bit_rate_str:
            result["bit_rate"] = int(bit_rate_str)
        
        streams = ffprobe_data.get("streams", [])
        for stream in streams:
            if stream.get("codec_type") == "audio":
                sample_rate_str = stream.get("sample_rate")
                if sample_rate_str:
                    result["sample_rate"] = int(sample_rate_str)
                
                result["channels"] = stream.get("channels")
                
                bits_per_sample = stream.get("bits_per_sample")
                if bits_per_sample:
                    result["bit_depth"] = int(bits_per_sample)
                
                break
        
    except Exception as e:
        print(f"解析 ffprobe 输出失败: {e}")
    
    return result


def format_duration(seconds: float) -> str:
    if seconds is None:
        return "未知"
    
    hours = int(seconds // 3600)
    minutes = int((seconds % 3600) // 60)
    secs = int(seconds % 60)
    
    if hours > 0:
        return f"{hours:02d}:{minutes:02d}:{secs:02d}"
    else:
        return f"{minutes:02d}:{secs:02d}"


def format_file_size(size_bytes: int) -> str:
    if size_bytes is None:
        return "未知"
    
    for unit in ["B", "KB", "MB", "GB", "TB"]:
        if size_bytes < 1024:
            return f"{size_bytes:.1f} {unit}"
        size_bytes /= 1024
    
    return f"{size_bytes:.1f} PB"
