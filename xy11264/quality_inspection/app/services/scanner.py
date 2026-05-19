import re
import uuid
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass

from app.models import (
    Issue,
    IssueType,
    IssueLocation,
    TranscriptionSegment,
    SensitiveWord,
    InspectionRecord,
)
from app.utils import get_storage


APOLOGY_PATTERNS = [
    r"对不起",
    r"抱歉",
    r"不好意思",
    r"给您带来.*不便",
    r"非常抱歉",
    r"真的对不起",
    r"深表歉意",
    r"致歉",
    r"请您谅解",
    r"请原谅",
]


REFUND_PROMISE_PATTERNS = [
    r"给您退款",
    r"帮您退款",
    r"为您退款",
    r"全额退款",
    r"部分退款",
    r"退还.*费用",
    r"退款给您",
    r"可以退款",
    r"同意退款",
    r"给予退款",
    r"费用退还",
]


class TextScanner:
    def __init__(self):
        self.apology_patterns = [re.compile(p, re.IGNORECASE) for p in APOLOGY_PATTERNS]
        self.refund_patterns = [re.compile(p, re.IGNORECASE) for p in REFUND_PROMISE_PATTERNS]
        self._storage = get_storage()
    
    def _find_pattern_matches(self, text: str, patterns: List[re.Pattern]) -> List[Tuple[int, int, str]]:
        matches = []
        for pattern in patterns:
            for match in pattern.finditer(text):
                matches.append((match.start(), match.end(), match.group()))
        return sorted(matches, key=lambda x: x[0])
    
    def _check_has_apology(self, text: str) -> bool:
        matches = self._find_pattern_matches(text, self.apology_patterns)
        return len(matches) > 0
    
    def _check_has_refund_promise(self, text: str) -> bool:
        matches = self._find_pattern_matches(text, self.refund_patterns)
        return len(matches) > 0
    
    def _find_sensitive_words(self, text: str, sensitive_words: List[SensitiveWord]) -> List[Tuple[int, int, SensitiveWord]]:
        results = []
        for sw in sensitive_words:
            pattern = re.compile(re.escape(sw.word), re.IGNORECASE)
            for match in pattern.finditer(text):
                results.append((match.start(), match.end(), sw))
        return sorted(results, key=lambda x: x[0])
    
    def _create_issue(self, issue_type: IssueType, location: IssueLocation, description: str, severity: int = 3, suggested_fix: str = None) -> Issue:
        return Issue(
            id=str(uuid.uuid4()),
            issue_type=issue_type,
            location=location,
            description=description,
            severity=severity,
            suggested_fix=suggested_fix,
            confidence=0.95,
        )
    
    def scan_transcription(self, segments: List[TranscriptionSegment], sensitive_words: List[SensitiveWord] = None) -> List[Issue]:
        if sensitive_words is None:
            sensitive_words = self._storage.get_all_sensitive_words()
        
        issues = []
        full_text = " ".join([seg.text for seg in segments])
        agent_text = " ".join([seg.text for seg in segments if seg.speaker.lower() in ["客服", "agent", "坐席", "服务代表"]])
        
        if not agent_text:
            agent_text = full_text
        
        has_apology = self._check_has_apology(agent_text)
        has_refund = self._check_has_refund_promise(agent_text)
        
        if not has_apology:
            issues.append(self._create_issue(
                IssueType.MISSING_APOLOGY,
                IssueLocation(
                    original_text=agent_text[:200] if len(agent_text) > 200 else agent_text,
                ),
                description="客服对话中未检测到道歉用语，客户产生投诉时应主动致歉",
                severity=2,
                suggested_fix="在合适时机添加道歉用语，如'对不起给您带来不便'",
            ))
        
        complaint_patterns = [r"投诉", r"不满", r"生气", r"愤怒", r"不满意", r"太差"]
        has_complaint = any(re.search(p, full_text, re.IGNORECASE) for p in complaint_patterns)
        
        refund_mentioned_patterns = [r"退款", r"退钱", r"退费", r"退回.*钱"]
        refund_mentioned = any(re.search(p, full_text, re.IGNORECASE) for p in refund_mentioned_patterns)
        
        if (has_complaint or refund_mentioned) and not has_refund:
            issues.append(self._create_issue(
                IssueType.MISSING_REFUND_PROMISE,
                IssueLocation(
                    original_text=agent_text[:200] if len(agent_text) > 200 else agent_text,
                ),
                description="客户提及退款需求或表达不满时，客服未明确给出退款承诺",
                severity=3,
                suggested_fix="明确告知客户退款政策，如'我们可以为您办理全额退款'",
            ))
        
        for seg_idx, segment in enumerate(segments):
            sensitive_matches = self._find_sensitive_words(segment.text, sensitive_words)
            for start, end, sw in sensitive_matches:
                issues.append(self._create_issue(
                    IssueType.SENSITIVE_WORD,
                    IssueLocation(
                        segment_index=seg_idx,
                        start_index=start,
                        end_index=end,
                        original_text=segment.text[max(0, start-10):min(len(segment.text), end+10)],
                    ),
                    description=f"检测到敏感词: '{sw.word}' (类别: {sw.category})",
                    severity=sw.severity,
                    suggested_fix=f"避免使用'{sw.word}'，使用更中性的表述",
                ))
        
        return issues
    
    def scan_record(self, record: InspectionRecord, re_scan: bool = False) -> InspectionRecord:
        if not re_scan and record.is_complete:
            return record
        
        issues = self.scan_transcription(record.transcription)
        record.issues = issues
        record.is_complete = True
        return record
    
    def get_sensitive_word_stats(self, records: List[InspectionRecord]) -> List[Dict]:
        word_count = {}
        for record in records:
            for issue in record.issues:
                if issue.issue_type == IssueType.SENSITIVE_WORD:
                    match = re.search(r"'([^']+)'", issue.description)
                    if match:
                        word = match.group(1)
                        word_count[word] = word_count.get(word, 0) + 1
        
        sorted_words = sorted(word_count.items(), key=lambda x: x[1], reverse=True)
        return [{"word": w, "count": c} for w, c in sorted_words[:10]]
    
    def add_apology_pattern(self, pattern: str):
        self.apology_patterns.append(re.compile(pattern, re.IGNORECASE))
    
    def add_refund_pattern(self, pattern: str):
        self.refund_patterns.append(re.compile(pattern, re.IGNORECASE))


_scanner_instance = None


def get_scanner() -> TextScanner:
    global _scanner_instance
    if _scanner_instance is None:
        _scanner_instance = TextScanner()
    return _scanner_instance
