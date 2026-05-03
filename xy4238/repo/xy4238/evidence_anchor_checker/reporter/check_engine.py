"""
核对引擎 - 核心的证据锚点检查逻辑
"""

from collections import Counter
from datetime import datetime
from typing import List, Dict, Any, Tuple

from ..rules.validation_rules import (
    ValidationError,
    ValidationRules,
    ErrorType,
    EvidenceAnchor,
    EvidenceCatalogEntry,
    TranscriptSegment,
    TimestampEntry
)
from ..indexer.local_index import LocalIndex, CheckResult


class CheckEngine:
    def __init__(self, index: LocalIndex):
        self.index = index

    def run_all_checks(self) -> Tuple[List[ValidationError], CheckResult]:
        all_errors = []

        errors = self.check_evidence_number_validity()
        all_errors.extend(errors)

        errors = self.check_page_numbers()
        all_errors.extend(errors)

        errors = self.check_duplicate_anchors()
        all_errors.extend(errors)

        errors = self.check_timestamp_alignment()
        all_errors.extend(errors)

        errors = self.check_speaker_consistency()
        all_errors.extend(errors)

        error_summary = Counter()
        for error in all_errors:
            error_summary[error.error_type.value] += 1

        result = CheckResult(
            total_errors=len(all_errors),
            total_warnings=0,
            error_summary=dict(error_summary),
            check_time=datetime.now().isoformat()
        )

        self.index.last_check_result = result

        return all_errors, result

    def check_evidence_number_validity(self) -> List[ValidationError]:
        errors = []
        valid_numbers = self.index.get_all_evidence_numbers()
        all_anchors = self.index.get_all_anchors()

        for anchor in all_anchors:
            valid, msg = ValidationRules.validate_evidence_number(anchor.evidence_number)
            if not valid:
                errors.append(ValidationError(
                    error_type=ErrorType.EVIDENCE_NUMBER_INVALID,
                    message=msg,
                    location=f"第{anchor.transcript_line}行 - 发言人: {anchor.speaker}",
                    suggestion="请检查证据编号格式，应为 证1、1 或 1-1 格式"
                ))
                continue

            exists = any(
                ValidationRules.evidence_numbers_match(anchor.evidence_number, valid_num)
                for valid_num in valid_numbers
            )
            if not exists:
                errors.append(ValidationError(
                    error_type=ErrorType.EVIDENCE_NUMBER_NOT_EXIST,
                    message=f"证据编号 '{anchor.evidence_number}' 不存在于证据目录",
                    location=f"第{anchor.transcript_line}行 - 发言人: {anchor.speaker}",
                    suggestion=f"请核对证据目录，有效证据编号包括: {', '.join(sorted(valid_numbers))}"
                ))

        return errors

    def check_page_numbers(self) -> List[ValidationError]:
        errors = []
        all_anchors = self.index.get_all_anchors()

        for anchor in all_anchors:
            if not anchor.page_numbers:
                errors.append(ValidationError(
                    error_type=ErrorType.PAGE_MISSING,
                    message=f"证据 '{anchor.evidence_number}' 缺少引用页码",
                    location=f"第{anchor.transcript_line}行 - 发言人: {anchor.speaker}",
                    suggestion="请为该证据添加页码引用，如 '证1 第3页' 或 '证1 第1-5页'"
                ))
            else:
                for page in anchor.page_numbers:
                    valid, msg = ValidationRules.validate_page_number(page)
                    if not valid:
                        errors.append(ValidationError(
                            error_type=ErrorType.PAGE_INVALID,
                            message=f"页码 '{page}' 格式无效: {msg}",
                            location=f"第{anchor.transcript_line}行 - 证据: {anchor.evidence_number}",
                            suggestion="页码格式应为 1 或 1-5（表示页码范围）"
                        ))

                evidence = self.index.get_evidence_by_number(anchor.evidence_number)
                if evidence and evidence.page_count > 0:
                    for page in anchor.page_numbers:
                        match = ValidationRules.PAGE_RANGE_PATTERN.match(page.strip())
                        if match:
                            start = int(match.group(1))
                            end = int(match.group(3)) if match.group(3) else start
                            if end > evidence.page_count:
                                errors.append(ValidationError(
                                    error_type=ErrorType.PAGE_INVALID,
                                    message=f"引用页码 {end} 超出该证据总页数 {evidence.page_count}",
                                    location=f"第{anchor.transcript_line}行 - 证据: {anchor.evidence_number}",
                                    suggestion=f"该证据 '{evidence.evidence_name}' 共 {evidence.page_count} 页"
                                ))

        return errors

    def check_duplicate_anchors(self) -> List[ValidationError]:
        errors = []
        all_anchors = self.index.get_all_anchors()

        seen = {}
        for anchor in all_anchors:
            key = (anchor.speaker, anchor.transcript_line, anchor.evidence_number)

            if key in seen:
                errors.append(ValidationError(
                    error_type=ErrorType.DUPLICATE_ANCHOR,
                    message=f"同一发言段落重复锚定证据 '{anchor.evidence_number}'",
                    location=f"第{anchor.transcript_line}行 - 发言人: {anchor.speaker}",
                    suggestion="请删除重复的锚定标记，同一段落同一证据只需标注一次"
                ))
            else:
                seen[key] = anchor

        return errors

    def check_timestamp_alignment(self) -> List[ValidationError]:
        errors = []
        all_anchors = self.index.get_all_anchors()

        valid_timestamps = {
            entry.timestamp: entry
            for entry in self.index.timestamp_entries
        }

        for anchor in all_anchors:
            if not anchor.timestamp:
                continue

            valid, msg = ValidationRules.validate_timestamp(anchor.timestamp)
            if not valid:
                errors.append(ValidationError(
                    error_type=ErrorType.TIMESTAMP_INVALID,
                    message=f"时间码格式错误: {msg}",
                    location=f"第{anchor.transcript_line}行 - 时间码: {anchor.timestamp}",
                    suggestion="时间码格式应为 HH:MM:SS，如 01:30:45"
                ))
                continue

            if anchor.timestamp not in valid_timestamps:
                closest = self._find_closest_timestamp(anchor.timestamp)
                suggestion = f"请核对时间码，最近的有效时间码: {closest}" if closest else "请检查时间码CSV文件"
                errors.append(ValidationError(
                    error_type=ErrorType.TIMESTAMP_MISMATCH,
                    message=f"时间码 '{anchor.timestamp}' 不存在于时间码列表",
                    location=f"第{anchor.transcript_line}行 - 发言人: {anchor.speaker}",
                    suggestion=suggestion
                ))

        return errors

    def check_speaker_consistency(self) -> List[ValidationError]:
        errors = []
        all_anchors = self.index.get_all_anchors()

        valid_speakers = {
            entry.speaker
            for entry in self.index.timestamp_entries
            if entry.speaker
        }

        if not valid_speakers:
            return errors

        for anchor in all_anchors:
            if not anchor.speaker:
                continue

            if anchor.speaker not in valid_speakers:
                errors.append(ValidationError(
                    error_type=ErrorType.SPEAKER_MISMATCH,
                    message=f"发言人 '{anchor.speaker}' 与时间码记录的发言人不一致",
                    location=f"第{anchor.transcript_line}行",
                    suggestion=f"时间码中记录的发言人包括: {', '.join(sorted(valid_speakers))}"
                ))

        return errors

    def _find_closest_timestamp(self, target: str) -> str:
        target_sec = ValidationRules.timestamp_to_seconds(target)
        if target_sec < 0:
            return ""

        closest = ""
        min_diff = float('inf')

        for entry in self.index.timestamp_entries:
            ts_sec = ValidationRules.timestamp_to_seconds(entry.timestamp)
            if ts_sec < 0:
                continue
            diff = abs(ts_sec - target_sec)
            if diff < min_diff:
                min_diff = diff
                closest = entry.timestamp

        return closest
