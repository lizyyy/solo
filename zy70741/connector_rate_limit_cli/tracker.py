from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Dict, Optional, Any
from collections import defaultdict
import hashlib

from .parser import LogRecord
from .state_machine import SleepSession


@dataclass
class FailureCause:
    cause_type: str
    description: str
    confidence: float
    evidence: List[LogRecord] = field(default_factory=list)
    severity: str = "medium"

    def to_dict(self) -> Dict[str, Any]:
        return {
            'cause_type': self.cause_type,
            'description': self.description,
            'confidence': self.confidence,
            'severity': self.severity,
            'evidence_count': len(self.evidence),
            'evidence_sample': self.evidence[0].raw_content if self.evidence else None,
        }


@dataclass
class SourceTrace:
    record: LogRecord
    source_file: str
    line_number: int
    raw_content: str
    trace_hash: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            'source_file': self.source_file,
            'line_number': self.line_number,
            'raw_content': self.raw_content,
            'trace_hash': self.trace_hash,
            'connector': self.record.connector,
            'supplier': self.record.supplier,
            'timestamp': self.record.timestamp.isoformat() if self.record.timestamp else None,
        }


class FailureCauseAnalyzer:
    def __init__(self):
        self.cause_patterns = {
            'insufficient_sleep': {
                'keywords': ['sleep', 'rate', 'limit', '429'],
                'min_sleep_threshold': 5.0,
            },
            'retry_storm': {
                'keywords': ['retry', 'rate', 'limit'],
                'max_retry_threshold': 10,
            },
            'missing_recovery': {
                'keywords': ['sleep', 'retry'],
                'recovery_missing': True,
            },
            'duplicate_recovery': {
                'keywords': ['recover', 'recover'],
            },
            'sleep_before_rate_limit': {
                'keywords': ['sleep', 'rate'],
            },
            'no_sleep_after_rate_limit': {
                'keywords': ['rate', 'limit'],
            },
        }

    def analyze_session(self, session: SleepSession) -> List[FailureCause]:
        causes = []

        if not session.is_idempotent:
            recovery_records = [r for r in session.records if r.is_recovery]
            description = '检测到非幂等恢复，恢复事件间隔小于配置的最小休眠间隔'
            if session.recovery_count > 1:
                description = f'检测到非幂等恢复，{session.recovery_count}次恢复事件间隔小于配置的最小休眠间隔'
            causes.append(FailureCause(
                cause_type='non_idempotent_recovery',
                description=description,
                confidence=0.95,
                severity='high',
                evidence=recovery_records,
            ))

        if session.recovery_count > 1 and session.is_idempotent:
            causes.append(FailureCause(
                cause_type='multiple_recovery_events',
                description=f'检测到多次恢复事件 ({session.recovery_count}次)，可能存在重复恢复',
                confidence=0.85,
                severity='medium',
                evidence=[r for r in session.records if r.is_recovery],
            ))

        if session.rate_limit_count > 0 and session.sleep_count == 0:
            causes.append(FailureCause(
                cause_type='no_sleep_after_rate_limit',
                description=f'检测到 {session.rate_limit_count} 次限流事件但无休眠操作',
                confidence=0.95,
                severity='critical',
                evidence=[r for r in session.records if r.is_rate_limit],
            ))

        avg_sleep = session.total_sleep_duration / session.sleep_count if session.sleep_count > 0 else 0
        if avg_sleep > 0 and avg_sleep < 5.0 and session.rate_limit_count > session.sleep_count:
            causes.append(FailureCause(
                cause_type='insufficient_sleep_duration',
                description=f'平均休眠时长过短 ({avg_sleep:.2f}s)，可能不足以恢复限流',
                confidence=0.8,
                severity='high',
                evidence=[r for r in session.records if r.is_sleep],
            ))

        if session.sleep_count > 10:
            causes.append(FailureCause(
                cause_type='excessive_sleep_count',
                description=f'休眠次数过多 ({session.sleep_count}次)，可能陷入无限重试循环',
                confidence=0.75,
                severity='medium',
                evidence=session.records,
            ))

        if session.error_count > 0:
            causes.append(FailureCause(
                cause_type='errors_during_recovery',
                description=f'恢复过程中出现 {session.error_count} 次错误',
                confidence=0.9,
                severity='high',
                evidence=[r for r in session.records if r.is_error],
            ))

        retry_records = [r for r in session.records if r.is_retry]
        if len(retry_records) > 0:
            max_retry = max(
                [r.extra.get('retry_attempt', 0) for r in retry_records],
                default=0
            )
            if max_retry > 5:
                causes.append(FailureCause(
                    cause_type='high_retry_count',
                    description=f'检测到高重试次数 (最高 {max_retry} 次)',
                    confidence=0.7,
                    severity='medium',
                    evidence=retry_records,
                ))

        causes.sort(key=lambda c: (-c.confidence, c.cause_type))
        return causes

    def analyze_records(self, records: List[LogRecord]) -> List[FailureCause]:
        causes = []
        bad_records = [r for r in records if r.is_bad_line]

        if bad_records:
            causes.append(FailureCause(
                cause_type='malformed_log_entries',
                description=f'检测到 {len(bad_records)} 条格式错误的日志记录',
                confidence=1.0,
                severity='low',
                evidence=bad_records,
            ))

        return causes


class SourceTracker:
    def __init__(self, preserve_order: bool = True):
        self.preserve_order = preserve_order
        self.traces: List[SourceTrace] = []
        self.trace_index: Dict[str, List[SourceTrace]] = defaultdict(list)

    def _compute_hash(self, record: LogRecord) -> str:
        content = f"{record.file_path}:{record.line_number}:{record.raw_content}"
        return hashlib.md5(content.encode('utf-8')).hexdigest()

    def track_record(self, record: LogRecord) -> SourceTrace:
        trace = SourceTrace(
            record=record,
            source_file=record.file_path,
            line_number=record.line_number,
            raw_content=record.raw_content,
            trace_hash=self._compute_hash(record),
        )
        self.traces.append(trace)
        key = f"{record.connector or 'unknown'}:{record.supplier or 'unknown'}"
        self.trace_index[key].append(trace)
        return trace

    def track_records(self, records: List[LogRecord]) -> List[SourceTrace]:
        if self.preserve_order:
            sorted_records = sorted(
                records,
                key=lambda r: (r.file_path, r.line_number)
            )
        else:
            sorted_records = records

        traces = []
        for record in sorted_records:
            traces.append(self.track_record(record))
        return traces

    def get_traces_by_connector(self, connector: str) -> List[SourceTrace]:
        return [t for t in self.traces if t.record.connector == connector]

    def get_traces_by_supplier(self, supplier: str) -> List[SourceTrace]:
        return [t for t in self.traces if t.record.supplier == supplier]

    def get_bad_line_traces(self) -> List[SourceTrace]:
        return [t for t in self.traces if t.record.is_bad_line]

    def get_rate_limit_traces(self) -> List[SourceTrace]:
        return [t for t in self.traces if t.record.is_rate_limit]

    def get_unique_sources(self) -> Dict[str, List[int]]:
        sources = defaultdict(list)
        for trace in self.traces:
            sources[trace.source_file].append(trace.line_number)
        for source in sources:
            sources[source].sort()
        return dict(sources)


class AnalysisResult:
    def __init__(self):
        self.records: List[LogRecord] = []
        self.sessions: List[SleepSession] = []
        self.traces: List[SourceTrace] = []
        self.failure_causes: List[FailureCause] = []
        self.metadata: Dict[str, Any] = {}

    def to_dict(self) -> Dict[str, Any]:
        sorted_sessions = sorted(
            self.sessions,
            key=lambda s: (s.connector, s.supplier, s.start_time)
        )
        sorted_failures = sorted(
            self.failure_causes,
            key=lambda c: (-c.confidence, c.cause_type)
        )
        sorted_bad_lines = sorted(
            [t for t in self.traces if t.record.is_bad_line],
            key=lambda t: (t.source_file, t.line_number)
        )
        
        return {
            'metadata': self.metadata,
            'summary': {
                'bad_line_count': len([r for r in self.records if r.is_bad_line]),
                'error_count': len([r for r in self.records if r.is_error]),
                'non_idempotent_sessions': len([s for s in self.sessions if not s.is_idempotent]),
                'rate_limit_count': len([r for r in self.records if r.is_rate_limit]),
                'recovery_count': len([r for r in self.records if r.is_recovery]),
                'recovered_sessions': len([s for s in self.sessions if s.is_recovered]),
                'retry_count': len([r for r in self.records if r.is_retry]),
                'sleep_count': len([r for r in self.records if r.is_sleep]),
                'total_failure_causes': len(self.failure_causes),
                'total_records': len(self.records),
                'total_sessions': len(self.sessions),
                'total_traces': len(self.traces),
            },
            'sessions': [
                {
                    'connector': s.connector,
                    'duration_seconds': s.duration_seconds(),
                    'end_time': s.end_time.isoformat() if s.end_time else None,
                    'error_count': s.error_count,
                    'is_idempotent': s.is_idempotent,
                    'is_recovered': s.is_recovered,
                    'rate_limit_count': s.rate_limit_count,
                    'recovery_count': s.recovery_count,
                    'retry_count': s.retry_count,
                    'session_id': s.session_id,
                    'sleep_count': s.sleep_count,
                    'start_time': s.start_time.isoformat(),
                    'state': s.state.value,
                    'supplier': s.supplier,
                    'total_sleep_duration': s.total_sleep_duration,
                    'transitions': [
                        {
                            'from': t.from_state.value,
                            'reason': t.reason,
                            'source_file': t.trigger_record.file_path,
                            'source_line': t.trigger_record.line_number,
                            'timestamp': t.timestamp.isoformat(),
                            'to': t.to_state.value,
                        }
                        for t in s.transitions
                    ],
                }
                for s in sorted_sessions
            ],
            'failure_causes': [c.to_dict() for c in sorted_failures],
            'bad_lines': [
                {
                    'line_number': t.line_number,
                    'raw_content': t.raw_content,
                    'source_file': t.source_file,
                    'trace_hash': t.trace_hash,
                }
                for t in sorted_bad_lines
            ],
        }
