import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import List, Dict, Any, Optional, Iterator
from uuid import uuid4

from classroom_cluster.models import (
    QuestionItem, TimeRange, SourceType, QuestionType, generate_id
)


QUESTION_INDICATORS = [
    "?", "？", "请问", "什么", "怎么", "如何", "为什么", "为何", "哪",
    "谁", "多少", "几", "吗", "呢", "吧？", "啊？", "能否", "可以",
    "麻烦问一下", "请教", "咨询", "疑问", "问题是", "想问一下",
    "不知道", "不明白", "不懂", "不清楚", "没理解", "没搞懂",
    "这个地方", "这里", "这块", "这部分",
]


@dataclass
class SRTBlock:
    index: int
    time_range: TimeRange
    text: str
    speaker: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "index": self.index,
            "time_range": self.time_range.to_srt_format(),
            "start_seconds": self.time_range.start_seconds,
            "end_seconds": self.time_range.end_seconds,
            "text": self.text,
            "speaker": self.speaker,
        }


class SRTParser:
    SRT_BLOCK_PATTERN = re.compile(
        r"(\d+)\r?\n"
        r"(\d{2}:\d{2}:\d{2}[,.]\d{3} --> \d{2}:\d{2}:\d{2}[,.]\d{3})\r?\n"
        r"(.*?)(?:\r?\n\r?\n|$)",
        re.DOTALL,
    )
    
    SPEAKER_PATTERN = re.compile(
        r"^([^:：]+)[:：]\s*(.*)$",
        re.DOTALL,
    )
    
    def __init__(self, file_path: Path, source_id: Optional[str] = None):
        self.file_path = file_path
        self.source_id = source_id or generate_id()
        self._blocks: List[SRTBlock] = []
        self._raw_content: str = ""
    
    def parse(self) -> List[SRTBlock]:
        if self._blocks:
            return self._blocks
        
        self._raw_content = self.file_path.read_text(encoding="utf-8")
        
        matches = list(self.SRT_BLOCK_PATTERN.finditer(self._raw_content))
        
        for match in matches:
            index = int(match.group(1))
            time_str = match.group(2)
            text = match.group(3).strip()
            
            time_range = TimeRange.from_srt_timestamp(time_str)
            
            speaker = ""
            speaker_match = self.SPEAKER_PATTERN.match(text)
            if speaker_match:
                speaker = speaker_match.group(1).strip()
                text = speaker_match.group(2).strip()
            
            block = SRTBlock(
                index=index,
                time_range=time_range,
                text=text,
                speaker=speaker,
            )
            self._blocks.append(block)
        
        self._merge_consecutive_speaker_blocks()
        
        return self._blocks
    
    def _merge_consecutive_speaker_blocks(self) -> None:
        if len(self._blocks) < 2:
            return
        
        merged: List[SRTBlock] = []
        current: Optional[SRTBlock] = None
        
        for block in self._blocks:
            if current is None:
                current = block
                continue
            
            if (current.speaker == block.speaker and 
                abs((current.time_range.end_seconds or 0) - block.time_range.start_seconds) < 2.0):
                current.text += " " + block.text
                if block.time_range.end_seconds:
                    current.time_range.end_seconds = block.time_range.end_seconds
            else:
                merged.append(current)
                current = block
        
        if current:
            merged.append(current)
        
        self._blocks = merged
    
    def extract_questions(self) -> List[QuestionItem]:
        questions: List[QuestionItem] = []
        
        for block in self._blocks:
            if self._is_likely_question(block.text):
                question_type = self._classify_question_type(block.text)
                
                question = QuestionItem(
                    content=block.text,
                    source_type=SourceType.SUBTITLE,
                    source_id=self.source_id,
                    time_range=block.time_range,
                    speaker=block.speaker,
                    question_type=question_type,
                    raw_text=block.text,
                    metadata={
                        "srt_index": block.index,
                        "file_path": str(self.file_path),
                    },
                )
                questions.append(question)
        
        return questions
    
    def _is_likely_question(self, text: str) -> bool:
        if not text or len(text.strip()) < 3:
            return False
        
        text_lower = text.lower()
        
        if "?" in text or "？" in text:
            return True
        
        for indicator in QUESTION_INDICATORS:
            if indicator in text_lower:
                if self._has_question_context(text_lower, indicator):
                    return True
        
        return False
    
    def _has_question_context(self, text: str, indicator: str) -> bool:
        indicator_pos = text.find(indicator)
        if indicator_pos == -1:
            return False
        
        context_start = max(0, indicator_pos - 20)
        context_end = min(len(text), indicator_pos + len(indicator) + 20)
        context = text[context_start:context_end]
        
        question_context_words = ["是", "有", "在", "能", "可以", "会", "要", "需", "想", "请问"]
        for word in question_context_words:
            if word in context:
                return True
        
        return indicator in ["请问", "什么", "怎么", "如何", "为什么", "为何"]
    
    def _classify_question_type(self, text: str) -> QuestionType:
        text_lower = text.lower()
        
        if "?" in text or "？" in text:
            explicit_indicators = ["请问", "我想问", "想请教", "咨询一下", "有个问题"]
            for indicator in explicit_indicators:
                if indicator in text_lower:
                    return QuestionType.EXPLICIT
            return QuestionType.EXPLICIT
        
        clarification_indicators = ["不明白", "不懂", "不清楚", "没理解", "没搞懂", "不知道"]
        for indicator in clarification_indicators:
            if indicator in text_lower:
                return QuestionType.CLARIFICATION
        
        return QuestionType.IMPLICIT
    
    def get_all_blocks(self) -> List[SRTBlock]:
        return self._blocks
    
    def get_blocks_by_time(self, start_seconds: float, end_seconds: float) -> List[SRTBlock]:
        result = []
        query_range = TimeRange(start_seconds=start_seconds, end_seconds=end_seconds)
        
        for block in self._blocks:
            if block.time_range.overlaps_with(query_range, tolerance=0):
                result.append(block)
        
        return result
