import re
from typing import List, Set, Tuple
from datetime import datetime
from .models import TranscriptSegment, Violation, ViolationType


RULE_VERSION = "1.0.0"

APOLOGY_KEYWORDS = {
    "对不起", "抱歉", "不好意思", "给您带来不便", "深表歉意",
    "sorry", "apologize", "apologies", "my bad"
}

REFUND_KEYWORDS = {
    "退款", "退钱", "退费", "返还", "赔偿", "补偿",
    "refund", "reimburse", "compensate", "give back"
}

SENSITIVE_WORDS = {
    "傻逼", "操你妈", "他妈的", "去死", "垃圾",
    "fuck", "shit", "bitch", "asshole", "damn"
}

SENSITIVE_DATA_PATTERNS = {
    'phone': re.compile(r'(?:\+?86)?1[3-9]\d{9}'),
    'email': re.compile(r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'),
    'id_card': re.compile(r'[1-9]\d{5}(?:18|19|20)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])\d{3}[\dXx]'),
    'bank_card': re.compile(r'\d{16,19}')
}


def mask_sensitive_data(text: str) -> str:
    masked = text
    for pattern in SENSITIVE_DATA_PATTERNS.values():
        masked = pattern.sub(lambda m: '*' * len(m.group()), masked)
    return masked


def check_missing_speaker(segments: List[TranscriptSegment]) -> List[Violation]:
    violations = []
    for idx, seg in enumerate(segments):
        if not seg.speaker or seg.speaker.strip() == "":
            violations.append(Violation(
                type=ViolationType.MISSING_SPEAKER,
                message=f"第 {idx + 1} 段缺少说话人标识",
                severity="low",
                segment_index=idx
            ))
    return violations


def check_timestamp_overlap(segments: List[TranscriptSegment]) -> List[Violation]:
    violations = []
    for i in range(len(segments) - 1):
        curr = segments[i]
        next_seg = segments[i + 1]
        if curr.end_time > next_seg.start_time:
            violations.append(Violation(
                type=ViolationType.TIMESTAMP_OVERLAP,
                message=f"段 {i + 1} 与段 {i + 2} 时间戳重叠: {curr.end_time}s > {next_seg.start_time}s",
                severity="medium",
                segment_index=i,
                details={"overlap_seconds": curr.end_time - next_seg.start_time}
            ))
    return violations


def check_apology(segments: List[TranscriptSegment], metadata: dict = None) -> List[Violation]:
    violations = []
    full_text = " ".join(seg.text.lower() for seg in segments)
    
    has_complaint_context = False
    if metadata:
        has_complaint_context = metadata.get("is_complaint", False)
    
    if not has_complaint_context:
        complaint_keywords = {"投诉", "不满", "问题", "complaint", "issue", "problem"}
        has_complaint_context = any(kw in full_text for kw in complaint_keywords)
    
    if has_complaint_context:
        has_apology = any(kw in full_text for kw in APOLOGY_KEYWORDS)
        if not has_apology:
            violations.append(Violation(
                type=ViolationType.MISSING_APOLOGY,
                message="检测到投诉场景，但未发现道歉用语",
                severity="high"
            ))
    
    return violations


def check_refund_promise(segments: List[TranscriptSegment], metadata: dict = None) -> List[Violation]:
    violations = []
    full_text = " ".join(seg.text.lower() for seg in segments)
    
    has_refund_request = any(kw in full_text for kw in {"退款", "退钱", "退", "refund"})
    
    if has_refund_request:
        has_promise = any(kw in full_text for kw in {"会", "将", "可以", "给您", "will", "can", "shall"})
        if not has_promise:
            violations.append(Violation(
                type=ViolationType.MISSING_REFUND_PROMISE,
                message="检测到退款请求，但未发现明确的退款承诺或处理说明",
                severity="high"
            ))
    
    return violations


def check_sensitive_words(segments: List[TranscriptSegment]) -> List[Violation]:
    violations = []
    for idx, seg in enumerate(segments):
        text_lower = seg.text.lower()
        found_words = [kw for kw in SENSITIVE_WORDS if kw in text_lower]
        if found_words:
            violations.append(Violation(
                type=ViolationType.SENSITIVE_WORD,
                message=f"段 {idx + 1} 包含敏感词: {', '.join(found_words)}",
                severity="high",
                segment_index=idx,
                details={"sensitive_words": found_words}
            ))
    return violations


def scan_transcript(segments: List[TranscriptSegment], metadata: dict = None) -> Tuple[List[Violation], dict]:
    violations = []
    
    violations.extend(check_missing_speaker(segments))
    violations.extend(check_timestamp_overlap(segments))
    violations.extend(check_apology(segments, metadata))
    violations.extend(check_refund_promise(segments, metadata))
    violations.extend(check_sensitive_words(segments))
    
    details = {
        "total_segments": len(segments),
        "speaker_count": len(set(s.speaker for s in segments if s.speaker)),
        "duration_seconds": segments[-1].end_time if segments else 0,
        "rule_version": RULE_VERSION
    }
    
    return violations, details
