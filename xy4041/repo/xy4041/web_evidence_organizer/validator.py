#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
校验规则模块
检查证据完整性、时间线一致性、敏感信息等问题
"""

import re
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Set, Tuple

from .config import (
    CaseConfig,
    EvidenceRecord,
    EvidenceType,
    TimelineEvent,
    ValidationIssue,
)
from .chat_parser import ChatParser
from .har_parser import HARParser
from .html_parser import HTMLParser


class Validator:
    """证据校验器"""

    SEVERITY_CRITICAL = "critical"
    SEVERITY_HIGH = "high"
    SEVERITY_MEDIUM = "medium"
    SEVERITY_LOW = "low"

    def __init__(self, config: CaseConfig):
        self.config = config
        self._issues: List[ValidationIssue] = []

    def _generate_issue_id(self) -> str:
        """生成问题ID"""
        return f"ISS-{uuid.uuid4().hex[:8].upper()}"

    def validate_all(
        self,
        evidence_records: List[EvidenceRecord],
        timeline_events: List[TimelineEvent] = None,
    ) -> List[ValidationIssue]:
        """
        执行所有校验

        Args:
            evidence_records: 证据记录列表
            timeline_events: 时间线事件列表（可选）

        Returns:
            校验问题列表
        """
        self._issues = []

        self.validate_evidence_ids(evidence_records)
        self.validate_duplicate_hashes(evidence_records)

        if timeline_events:
            self.validate_timeline_order(timeline_events)
            self.validate_timezone_consistency(timeline_events)

        self.validate_har_errors(evidence_records)
        self.validate_chat_page_breaks(evidence_records)
        self.validate_sensitive_data(evidence_records)

        return self._issues

    def validate_evidence_ids(self, evidence_records: List[EvidenceRecord]) -> List[ValidationIssue]:
        """
        检查证据编号缺失

        Args:
            evidence_records: 证据记录列表

        Returns:
            问题列表
        """
        issues = []

        for record in evidence_records:
            if not record.evidence_id:
                issue = ValidationIssue(
                    issue_id=self._generate_issue_id(),
                    issue_type="missing_evidence_id",
                    severity=self.SEVERITY_HIGH,
                    description="证据记录缺少证据编号",
                    evidence_id=None,
                    file_path=record.file_path,
                    details={
                        "original_filename": record.original_filename,
                        "stored_filename": record.stored_filename,
                    },
                    suggested_action="重新导入该文件以生成证据编号",
                )
                self._issues.append(issue)
                issues.append(issue)

        return issues

    def validate_duplicate_hashes(self, evidence_records: List[EvidenceRecord]) -> List[ValidationIssue]:
        """
        检查附件哈希重复

        Args:
            evidence_records: 证据记录列表

        Returns:
            问题列表
        """
        issues = []
        hash_map: Dict[str, List[EvidenceRecord]] = {}

        for record in evidence_records:
            file_hash = record.sha256_hash
            if file_hash not in hash_map:
                hash_map[file_hash] = []
            hash_map[file_hash].append(record)

        for file_hash, records in hash_map.items():
            if len(records) > 1:
                issue = ValidationIssue(
                    issue_id=self._generate_issue_id(),
                    issue_type="duplicate_hash",
                    severity=self.SEVERITY_MEDIUM,
                    description=f"发现 {len(records)} 个文件具有相同的哈希值",
                    evidence_id=records[0].evidence_id,
                    file_path=records[0].file_path,
                    details={
                        "hash": file_hash,
                        "duplicate_files": [
                            {
                                "evidence_id": r.evidence_id,
                                "filename": r.original_filename,
                                "file_path": r.file_path,
                            }
                            for r in records
                        ],
                    },
                    suggested_action="检查这些文件是否为重复文件，考虑删除冗余副本",
                )
                self._issues.append(issue)
                issues.append(issue)

        return issues

    def validate_timeline_order(self, timeline_events: List[TimelineEvent]) -> List[ValidationIssue]:
        """
        检查时间倒序

        Args:
            timeline_events: 时间线事件列表

        Returns:
            问题列表
        """
        issues = []

        sorted_events = sorted(timeline_events, key=lambda e: e.timestamp)

        for i in range(1, len(sorted_events)):
            prev = sorted_events[i - 1]
            curr = sorted_events[i]

            if curr.timestamp < prev.timestamp:
                issue = ValidationIssue(
                    issue_id=self._generate_issue_id(),
                    issue_type="time_out_of_order",
                    severity=self.SEVERITY_MEDIUM,
                    description="发现时间线事件顺序异常",
                    evidence_id=curr.evidence_id,
                    file_path=curr.source_file,
                    details={
                        "previous_event": {
                            "event_id": prev.event_id,
                            "timestamp": prev.timestamp.isoformat(),
                            "summary": prev.summary[:100],
                        },
                        "current_event": {
                            "event_id": curr.event_id,
                            "timestamp": curr.timestamp.isoformat(),
                            "summary": curr.summary[:100],
                        },
                        "time_difference_seconds": (prev.timestamp - curr.timestamp).total_seconds(),
                    },
                    suggested_action="检查事件时间戳来源，可能需要手动调整",
                )
                self._issues.append(issue)
                issues.append(issue)

        return issues

    def validate_timezone_consistency(self, timeline_events: List[TimelineEvent]) -> List[ValidationIssue]:
        """
        检查跨时区冲突

        Args:
            timeline_events: 时间线事件列表

        Returns:
            问题列表
        """
        issues = []
        timezones = set()

        for event in timeline_events:
            if event.timezone:
                timezones.add(event.timezone)

        if len(timezones) > 1:
            issue = ValidationIssue(
                issue_id=self._generate_issue_id(),
                issue_type="timezone_conflict",
                severity=self.SEVERITY_HIGH,
                description=f"发现 {len(timezones)} 个不同的时区，可能导致时间线混乱",
                details={
                    "timezones": list(timezones),
                    "configured_timezone": self.config.timezone,
                },
                suggested_action="统一所有时间戳到配置的时区，或确认多时区是预期行为",
            )
            self._issues.append(issue)
            issues.append(issue)

        return issues

    def validate_har_errors(self, evidence_records: List[EvidenceRecord]) -> List[ValidationIssue]:
        """
        检查HAR里有4xx/5xx关键请求

        Args:
            evidence_records: 证据记录列表

        Returns:
            问题列表
        """
        issues = []

        for record in evidence_records:
            if record.evidence_type != EvidenceType.HAR_LOG:
                continue

            try:
                parser = HARParser(record.file_path)
                parser.parse()
                error_entries = parser.get_error_entries()

                if error_entries:
                    client_errors = [e for e in error_entries if 400 <= e["response"]["status"] < 500]
                    server_errors = [e for e in error_entries if 500 <= e["response"]["status"] < 600]

                    issue = ValidationIssue(
                        issue_id=self._generate_issue_id(),
                        issue_type="har_request_errors",
                        severity=self.SEVERITY_HIGH if server_errors else self.SEVERITY_MEDIUM,
                        description=f"HAR日志包含错误请求: {len(client_errors)}个4xx, {len(server_errors)}个5xx",
                        evidence_id=record.evidence_id,
                        file_path=record.file_path,
                        details={
                            "total_errors": len(error_entries),
                            "client_errors_4xx": len(client_errors),
                            "server_errors_5xx": len(server_errors),
                            "sample_errors": [
                                {
                                    "method": e["request"]["method"],
                                    "url": e["request"]["url"][:100],
                                    "status": e["response"]["status"],
                                }
                                for e in error_entries[:5]
                            ],
                        },
                        suggested_action="分析错误请求是否影响证据完整性，可能需要重新获取完整的页面",
                    )
                    self._issues.append(issue)
                    issues.append(issue)

            except Exception as e:
                issue = ValidationIssue(
                    issue_id=self._generate_issue_id(),
                    issue_type="har_parse_error",
                    severity=self.SEVERITY_MEDIUM,
                    description=f"无法解析HAR文件: {str(e)[:100]}",
                    evidence_id=record.evidence_id,
                    file_path=record.file_path,
                    details={"error": str(e)},
                    suggested_action="检查HAR文件格式是否正确",
                )
                self._issues.append(issue)
                issues.append(issue)

        return issues

    def validate_chat_page_breaks(self, evidence_records: List[EvidenceRecord]) -> List[ValidationIssue]:
        """
        检查聊天记录缺页

        Args:
            evidence_records: 证据记录列表

        Returns:
            问题列表
        """
        issues = []

        for record in evidence_records:
            if record.evidence_type != EvidenceType.CHAT_LOG:
                continue

            try:
                parser = ChatParser(record.file_path)
                summary = parser.get_summary()

                if summary.get("has_timestamp_gaps") or summary.get("potential_missing_pages"):
                    page_issues = summary.get("issues", [])

                    issue = ValidationIssue(
                        issue_id=self._generate_issue_id(),
                        issue_type="chat_missing_pages",
                        severity=self.SEVERITY_HIGH,
                        description=f"聊天记录可能存在缺页: {len(page_issues)}个异常",
                        evidence_id=record.evidence_id,
                        file_path=record.file_path,
                        details={
                            "total_messages": summary.get("total_messages"),
                            "speakers": summary.get("speakers"),
                            "time_range": summary.get("time_range"),
                            "gaps": [
                                {
                                    "type": g.get("type"),
                                    "description": g.get("description"),
                                    "message_index": g.get("message_index"),
                                }
                                for g in page_issues
                            ],
                        },
                        suggested_action="检查聊天记录的完整性，确认是否有缺失的页面或消息",
                    )
                    self._issues.append(issue)
                    issues.append(issue)

            except Exception as e:
                issue = ValidationIssue(
                    issue_id=self._generate_issue_id(),
                    issue_type="chat_parse_error",
                    severity=self.SEVERITY_MEDIUM,
                    description=f"无法解析聊天记录: {str(e)[:100]}",
                    evidence_id=record.evidence_id,
                    file_path=record.file_path,
                    details={"error": str(e)},
                    suggested_action="检查聊天记录格式",
                )
                self._issues.append(issue)
                issues.append(issue)

        return issues

    def validate_sensitive_data(self, evidence_records: List[EvidenceRecord]) -> List[ValidationIssue]:
        """
        检查敏感信息未脱敏

        Args:
            evidence_records: 证据记录列表

        Returns:
            问题列表
        """
        issues = []

        sensitive_patterns = [
            (r"1[3-9]\d{9}", "手机号"),
            (r"[\w.-]+@[\w.-]+\.\w+", "邮箱"),
            (r"\d{17}[\dXx]", "身份证号"),
            (r"[\u4e00-\u9fa5]{2,}(?:省|市|区|县|镇|街道|路|号|楼|层|室)[\u4e00-\u9fa5\d]*", "地址"),
        ]

        for keyword in self.config.custom_redaction_keywords:
            sensitive_patterns.append((re.escape(keyword), f"自定义关键词: {keyword}"))

        for record in evidence_records:
            if record.evidence_type in [EvidenceType.SCREENSHOT, EvidenceType.PDF_DOCUMENT]:
                continue

            try:
                content = ""

                if record.evidence_type in [EvidenceType.HTML_PAGE, EvidenceType.MHTML_ARCHIVE]:
                    parser = HTMLParser(record.file_path)
                    parsed = parser.parse()
                    content = parsed.get("text_content", "")
                    content += " " + str(parsed.get("meta_tags", {}))

                elif record.evidence_type == EvidenceType.HAR_LOG:
                    parser = HARParser(record.file_path)
                    parsed = parser.parse()
                    for entry in parser.get_entries():
                        content += " " + entry["request"]["url"]
                        headers = entry["request"].get("headers", [])
                        for h in headers:
                            content += " " + str(h.get("name", "")) + " " + str(h.get("value", ""))

                elif record.evidence_type == EvidenceType.CHAT_LOG:
                    with open(record.file_path, "r", encoding="utf-8", errors="ignore") as f:
                        content = f.read()

                found_sensitive = []
                for pattern, description in sensitive_patterns:
                    matches = re.findall(pattern, content)
                    if matches:
                        found_sensitive.append({
                            "type": description,
                            "count": len(matches),
                            "samples": [str(m)[:50] for m in matches[:3]],
                        })

                if found_sensitive:
                    issue = ValidationIssue(
                        issue_id=self._generate_issue_id(),
                        issue_type="sensitive_data_found",
                        severity=self.SEVERITY_CRITICAL,
                        description=f"发现敏感信息需要脱敏: {', '.join([s['type'] for s in found_sensitive])}",
                        evidence_id=record.evidence_id,
                        file_path=record.file_path,
                        details={
                            "sensitive_items": found_sensitive,
                            "original_filename": record.original_filename,
                        },
                        suggested_action="运行 redact 命令对敏感信息进行脱敏处理",
                    )
                    self._issues.append(issue)
                    issues.append(issue)

            except Exception as e:
                issue = ValidationIssue(
                    issue_id=self._generate_issue_id(),
                    issue_type="sensitive_scan_error",
                    severity=self.SEVERITY_LOW,
                    description=f"扫描敏感信息时出错: {str(e)[:100]}",
                    evidence_id=record.evidence_id,
                    file_path=record.file_path,
                    details={"error": str(e)},
                    suggested_action="手动检查该文件是否包含敏感信息",
                )
                self._issues.append(issue)
                issues.append(issue)

        return issues

    def get_issues_summary(self) -> Dict:
        """
        获取问题摘要

        Returns:
            摘要信息字典
        """
        severity_counts = {
            "critical": 0,
            "high": 0,
            "medium": 0,
            "low": 0,
        }
        type_counts = {}

        for issue in self._issues:
            severity_counts[issue.severity] += 1
            issue_type = issue.issue_type
            type_counts[issue_type] = type_counts.get(issue_type, 0) + 1

        return {
            "total_issues": len(self._issues),
            "severity_distribution": severity_counts,
            "type_distribution": type_counts,
            "issues": [
                {
                    "issue_id": i.issue_id,
                    "issue_type": i.issue_type,
                    "severity": i.severity,
                    "description": i.description,
                }
                for i in self._issues
            ],
        }
