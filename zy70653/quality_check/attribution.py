from typing import List, Dict, Optional
from dataclasses import dataclass
from .matching_engine import MatchResult
from .file_scanner import RecordingFile
from .data_parser import TicketRow
import hashlib


MISSING_REASON_CODES = {
    'MATCH_OK': '匹配正常',
    'NO_TICKET_ID': '工单无工单号',
    'NO_RECORDING_FILE': '未找到录音文件',
    'RECORDING_PARSE_FAILED': '录音文件名解析失败',
    'TICKET_ID_MISMATCH': '工单号模糊匹配',
    'AGENT_ID_MISMATCH': '坐席号不匹配',
    'DURATION_ZERO': '通话时长为0',
    'DURATION_TOO_SHORT': '通话时长过短',
    'DURATION_MISMATCH': '录音与工单时长不匹配',
    'AGENT_NOT_IN_LIST': '坐席不在坐席表',
    'INVALID_TICKET': '工单数据无效',
    'OTHER': '综合匹配度不足'
}


@dataclass
class AttributionResult:
    ticket_id: Optional[str]
    source_file: str
    source_row: int
    missing_reason_code: str
    missing_reason_desc: str
    confidence: float
    details: Dict[str, str]
    match_score: int
    has_recording: bool
    has_valid_agent: bool
    recording_files: List[str]


class AttributionEngine:
    def __init__(self, min_duration_seconds: int = 10):
        self.min_duration_seconds = min_duration_seconds
        self.attribution_results: List[AttributionResult] = []
        self.attribution_hash: str = ""

    def analyze_duration(
        self,
        ticket: TicketRow,
        recordings: List[RecordingFile]
    ) -> List[str]:
        issues = []
        
        if ticket.call_duration == 0:
            issues.append("工单通话时长为0")
        
        if ticket.call_duration and ticket.call_duration < self.min_duration_seconds:
            issues.append(f"工单通话时长过短({ticket.call_duration}秒)")
        
        for rec in recordings:
            if rec.duration_seconds == 0:
                issues.append(f"录音时长为0: {rec.file_name}")
            elif rec.duration_seconds and rec.duration_seconds < self.min_duration_seconds:
                issues.append(f"录音时长过短({rec.duration_seconds}秒): {rec.file_name}")
            
            if ticket.call_duration and rec.duration_seconds:
                diff = abs(ticket.call_duration - rec.duration_seconds)
                if diff > 30:
                    issues.append(f"录音与工单时长差异过大({diff}秒): {rec.file_name}")
        
        return issues

    def determine_missing_reason(
        self,
        match_result: MatchResult,
        duration_issues: List[str]
    ) -> tuple:
        reason_code = 'MATCH_OK'
        reason_desc = '匹配正常'
        confidence = 1.0

        if match_result.match_status == '工单无效':
            reason_code = 'INVALID_TICKET'
            reason_desc = '工单数据无效'
            confidence = 1.0
        elif not match_result.ticket.ticket_id:
            reason_code = 'NO_TICKET_ID'
            reason_desc = '工单无工单号'
            confidence = 1.0
        elif "未找到对应录音文件" in match_result.issues:
            reason_code = 'NO_RECORDING_FILE'
            reason_desc = '未找到录音文件'
            confidence = 0.9
        elif "工单通话时长为0" in duration_issues:
            reason_code = 'DURATION_ZERO'
            reason_desc = '工单通话时长为0'
            confidence = 0.95
        elif "录音与工单时长差异过大" in "|".join(duration_issues):
            reason_code = 'DURATION_MISMATCH'
            reason_desc = '录音与工单时长不匹配'
            confidence = 0.85
        elif "不在坐席表中" in "|".join(match_result.issues):
            reason_code = 'AGENT_NOT_IN_LIST'
            reason_desc = '坐席不在坐席表'
            confidence = 0.9
        elif "与工单不一致" in "|".join(match_result.issues):
            reason_code = 'AGENT_ID_MISMATCH'
            reason_desc = '坐席号不匹配'
            confidence = 0.8
        elif "模糊匹配" in "|".join(match_result.issues):
            reason_code = 'TICKET_ID_MISMATCH'
            reason_desc = '工单号模糊匹配'
            confidence = 0.7
        elif match_result.match_score < 90:
            reason_code = 'OTHER'
            reason_desc = '综合匹配度不足'
            confidence = 0.6

        return reason_code, reason_desc, confidence

    def generate_details(
        self,
        match_result: MatchResult,
        duration_issues: List[str]
    ) -> Dict[str, str]:
        details = {}
        
        if match_result.issues:
            details['匹配问题'] = " | ".join(match_result.issues)
        
        if duration_issues:
            details['时长问题'] = " | ".join(duration_issues)
        
        if match_result.matched_recordings:
            details['匹配录音'] = "; ".join(r.file_name for r in match_result.matched_recordings)
            details['录音路径'] = "; ".join(r.file_path for r in match_result.matched_recordings)
        
        if match_result.matched_agent:
            details['匹配坐席'] = match_result.matched_agent.agent_name or match_result.matched_agent.agent_id or ""
        
        if match_result.ticket.call_duration:
            minutes = match_result.ticket.call_duration // 60
            seconds = match_result.ticket.call_duration % 60
            details['工单时长'] = f"{minutes}分{seconds}秒"
        
        return details

    def attribute_all(self, match_results: List[MatchResult]) -> List[AttributionResult]:
        self.attribution_results = []
        
        for match_result in sorted(match_results, key=lambda x: x.ticket.ticket_id or ""):
            duration_issues = self.analyze_duration(
                match_result.ticket,
                match_result.matched_recordings
            )
            
            reason_code, reason_desc, confidence = self.determine_missing_reason(
                match_result,
                duration_issues
            )
            
            details = self.generate_details(match_result, duration_issues)
            
            attribution = AttributionResult(
                ticket_id=match_result.ticket.ticket_id,
                source_file=match_result.ticket.source_file,
                source_row=match_result.ticket.row_index,
                missing_reason_code=reason_code,
                missing_reason_desc=reason_desc,
                confidence=confidence,
                details=details,
                match_score=match_result.match_score,
                has_recording=len(match_result.matched_recordings) > 0,
                has_valid_agent=match_result.matched_agent is not None,
                recording_files=[r.file_path for r in match_result.matched_recordings]
            )
            
            self.attribution_results.append(attribution)
        
        self._generate_attribution_hash()
        return self.attribution_results

    def _generate_attribution_hash(self) -> None:
        content = "|".join(sorted(
            f"{a.ticket_id}:{a.missing_reason_code}:{a.confidence}"
            for a in self.attribution_results
        ))
        self.attribution_hash = hashlib.md5(content.encode()).hexdigest()

    def get_results_by_reason_code(self, reason_code: str) -> List[AttributionResult]:
        return [a for a in self.attribution_results if a.missing_reason_code == reason_code]

    def get_missing_recording_results(self) -> List[AttributionResult]:
        return [a for a in self.attribution_results if not a.has_recording]

    def summarize_by_reason(self) -> Dict[str, int]:
        summary: Dict[str, int] = {}
        for result in self.attribution_results:
            key = result.missing_reason_desc
            summary[key] = summary.get(key, 0) + 1
        return dict(sorted(summary.items(), key=lambda x: -x[1]))
