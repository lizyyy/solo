import os
import json
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass, field

import pysrt


@dataclass
class ParsedSegment:
    start_time: float
    end_time: float
    text: str
    is_overlapping: bool = False
    overlap_with: Optional[int] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "start_time": self.start_time,
            "end_time": self.end_time,
            "text": self.text,
            "is_overlapping": self.is_overlapping,
            "overlap_with": self.overlap_with
        }


@dataclass
class ParseResult:
    segments: List[ParsedSegment] = field(default_factory=list)
    format: str = "unknown"
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    duration: float = 0.0
    
    @property
    def is_valid(self) -> bool:
        return len(self.errors) == 0 and len(self.segments) > 0


class TranscriptionFormatError(Exception):
    pass


class TranscriptionParser:
    
    @classmethod
    def parse_file(cls, file_path: str, audio_duration: Optional[float] = None) -> ParseResult:
        if not os.path.exists(file_path):
            result = ParseResult()
            result.errors.append(f"文件不存在: {file_path}")
            return result
        
        ext = os.path.splitext(file_path)[1].lower()
        
        if ext == ".srt":
            return cls._parse_srt(file_path, audio_duration)
        elif ext == ".json":
            return cls._parse_json(file_path, audio_duration)
        else:
            result = ParseResult()
            result.errors.append(f"不支持的文件格式: {ext}，请使用 .srt 或 .json 文件")
            return result
    
    @classmethod
    def _parse_srt(cls, file_path: str, audio_duration: Optional[float] = None) -> ParseResult:
        result = ParseResult(format="srt")
        
        try:
            subs = pysrt.open(file_path)
        except Exception as e:
            result.errors.append(f"解析SRT文件失败: {str(e)}")
            return result
        
        raw_segments: List[ParsedSegment] = []
        
        for sub in subs:
            start_sec = sub.start.seconds + sub.start.milliseconds / 1000.0
            end_sec = sub.end.seconds + sub.end.milliseconds / 1000.0
            text = sub.text.strip()
            
            if audio_duration is not None:
                if start_sec > audio_duration:
                    result.warnings.append(
                        f"片段 [{sub.index}] 开始时间 ({start_sec:.2f}s) 超出音频长度 ({audio_duration:.2f}s)"
                    )
                    continue
                if end_sec > audio_duration:
                    result.warnings.append(
                        f"片段 [{sub.index}] 结束时间 ({end_sec:.2f}s) 超出音频长度，将被截断"
                    )
                    end_sec = audio_duration
            
            if start_sec >= end_sec:
                result.warnings.append(
                    f"片段 [{sub.index}] 时间无效 (开始 >= 结束)，已跳过"
                )
                continue
            
            raw_segments.append(ParsedSegment(
                start_time=start_sec,
                end_time=end_sec,
                text=text
            ))
        
        cls._check_overlaps(raw_segments, result)
        
        if raw_segments:
            raw_segments.sort(key=lambda x: x.start_time)
            result.duration = max(seg.end_time for seg in raw_segments)
        
        result.segments = raw_segments
        return result
    
    @classmethod
    def _parse_json(cls, file_path: str, audio_duration: Optional[float] = None) -> ParseResult:
        result = ParseResult(format="json")
        
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except Exception as e:
            result.errors.append(f"解析JSON文件失败: {str(e)}")
            return result
        
        raw_segments: List[ParsedSegment] = []
        
        if "segments" in data and isinstance(data["segments"], list):
            raw_segments = cls._parse_json_segments(data["segments"], result, audio_duration)
        elif "words" in data and isinstance(data["words"], list):
            raw_segments = cls._parse_json_words(data["words"], result, audio_duration)
        elif isinstance(data, list):
            raw_segments = cls._parse_json_array(data, result, audio_duration)
        else:
            result.errors.append(
                "无法识别的JSON格式。请确保包含 'segments' 数组、'words' 数组，或是直接是片段数组。"
            )
            return result
        
        cls._check_overlaps(raw_segments, result)
        
        if raw_segments:
            raw_segments.sort(key=lambda x: x.start_time)
            result.duration = max(seg.end_time for seg in raw_segments)
        
        result.segments = raw_segments
        return result
    
    @classmethod
    def _parse_json_segments(cls, segments_data: List[Dict], result: ParseResult, 
                               audio_duration: Optional[float]) -> List[ParsedSegment]:
        parsed: List[ParsedSegment] = []
        
        for idx, seg in enumerate(segments_data):
            start_sec = cls._extract_time(seg, ["start", "startTime", "start_time", "begin"])
            end_sec = cls._extract_time(seg, ["end", "endTime", "end_time", "stop"])
            text = seg.get("text", seg.get("content", seg.get("words", "")))
            
            if isinstance(text, list):
                text = " ".join(w.get("word", w.get("text", "")) for w in text)
            
            if start_sec is None or end_sec is None:
                result.warnings.append(f"片段 [{idx}] 缺少时间信息，已跳过")
                continue
            
            start_sec, end_sec = cls._validate_segment_times(idx, start_sec, end_sec, audio_duration, result)
            if start_sec is None:
                continue
            
            parsed.append(ParsedSegment(
                start_time=start_sec,
                end_time=end_sec,
                text=str(text).strip()
            ))
        
        return parsed
    
    @classmethod
    def _parse_json_words(cls, words_data: List[Dict], result: ParseResult,
                           audio_duration: Optional[float]) -> List[ParsedSegment]:
        parsed: List[ParsedSegment] = []
        current_segment_words: List[Dict] = []
        gap_threshold = 2.0
        silence_threshold = 0.5
        
        for word in words_data:
            start_sec = cls._extract_time(word, ["start", "startTime", "start_time", "begin"])
            end_sec = cls._extract_time(word, ["end", "endTime", "end_time", "stop"])
            word_text = word.get("word", word.get("text", ""))
            
            if start_sec is None or end_sec is None:
                continue
            
            word["_start"] = start_sec
            word["_end"] = end_sec
            word["_text"] = word_text
            
            if current_segment_words:
                last_word = current_segment_words[-1]
                gap = start_sec - last_word["_end"]
                
                if gap > silence_threshold:
                    if current_segment_words:
                        seg = cls._words_to_segment(current_segment_words, audio_duration, result, len(parsed))
                        if seg:
                            parsed.append(seg)
                        current_segment_words = []
            
            current_segment_words.append(word)
        
        if current_segment_words:
            seg = cls._words_to_segment(current_segment_words, audio_duration, result, len(parsed))
            if seg:
                parsed.append(seg)
        
        return parsed
    
    @classmethod
    def _words_to_segment(cls, words: List[Dict], audio_duration: Optional[float],
                           result: ParseResult, idx: int) -> Optional[ParsedSegment]:
        if not words:
            return None
        
        start_sec = min(w["_start"] for w in words)
        end_sec = max(w["_end"] for w in words)
        text = " ".join(w["_text"] for w in words)
        
        start_sec, end_sec = cls._validate_segment_times(idx, start_sec, end_sec, audio_duration, result)
        if start_sec is None:
            return None
        
        return ParsedSegment(
            start_time=start_sec,
            end_time=end_sec,
            text=text.strip()
        )
    
    @classmethod
    def _parse_json_array(cls, data: List[Dict], result: ParseResult,
                           audio_duration: Optional[float]) -> List[ParsedSegment]:
        return cls._parse_json_segments(data, result, audio_duration)
    
    @staticmethod
    def _extract_time(data: Dict, keys: List[str]) -> Optional[float]:
        for key in keys:
            if key in data:
                val = data[key]
                if isinstance(val, (int, float)):
                    return float(val)
                elif isinstance(val, str):
                    try:
                        if ":" in val:
                            return TranscriptionParser._time_str_to_seconds(val)
                        return float(val)
                    except ValueError:
                        pass
        return None
    
    @staticmethod
    def _time_str_to_seconds(time_str: str) -> float:
        parts = time_str.split(":")
        seconds = 0.0
        
        if len(parts) == 3:
            seconds += float(parts[0]) * 3600
            seconds += float(parts[1]) * 60
            seconds += float(parts[2].replace(",", "."))
        elif len(parts) == 2:
            seconds += float(parts[0]) * 60
            seconds += float(parts[1].replace(",", "."))
        else:
            seconds += float(time_str.replace(",", "."))
        
        return seconds
    
    @staticmethod
    def _validate_segment_times(idx: int, start_sec: float, end_sec: float,
                                 audio_duration: Optional[float], result: ParseResult
                                 ) -> Tuple[Optional[float], Optional[float]]:
        if start_sec >= end_sec:
            result.warnings.append(f"片段 [{idx}] 时间无效 (开始 >= 结束)，已跳过")
            return None, None
        
        if audio_duration is not None:
            if start_sec > audio_duration:
                result.warnings.append(
                    f"片段 [{idx}] 开始时间 ({start_sec:.2f}s) 超出音频长度 ({audio_duration:.2f}s)，已跳过"
                )
                return None, None
            
            if end_sec > audio_duration:
                result.warnings.append(
                    f"片段 [{idx}] 结束时间 ({end_sec:.2f}s) 超出音频长度，将被截断"
                )
                end_sec = audio_duration
        
        return start_sec, end_sec
    
    @staticmethod
    def _check_overlaps(segments: List[ParsedSegment], result: ParseResult):
        if len(segments) < 2:
            return
        
        segments.sort(key=lambda x: x.start_time)
        
        for i in range(len(segments)):
            seg_i = segments[i]
            for j in range(i + 1, len(segments)):
                seg_j = segments[j]
                
                if seg_j.start_time >= seg_i.end_time:
                    break
                
                if not seg_j.is_overlapping:
                    seg_j.is_overlapping = True
                    seg_j.overlap_with = i
                    result.warnings.append(
                        f"检测到时间重叠: 片段 [{j}] ({seg_j.start_time:.2f}s - {seg_j.end_time:.2f}s) "
                        f"与片段 [{i}] ({seg_i.start_time:.2f}s - {seg_i.end_time:.2f}s) 重叠"
                    )
