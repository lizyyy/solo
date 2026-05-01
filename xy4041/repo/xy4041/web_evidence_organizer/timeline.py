#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
时间线合并模块
从各种证据源提取事件，统一时区，生成时间线
"""

import json
import uuid
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import pytz

from .config import (
    CaseConfig,
    EvidenceRecord,
    EvidenceType,
    TimeTrustLevel,
    TimelineEvent,
)
from .chat_parser import ChatParser
from .har_parser import HARParser
from .html_parser import HTMLParser


class TimelineExtractor:
    """时间线提取器"""

    def __init__(self, config: CaseConfig):
        self.config = config
        self._events: List[Dict] = []
        self._timezone = pytz.timezone(config.timezone)

    def extract_from_evidence(self, evidence_records: List[EvidenceRecord]) -> List[Dict]:
        """
        从证据记录中提取事件

        Args:
            evidence_records: 证据记录列表

        Returns:
            事件列表
        """
        self._events = []

        for record in evidence_records:
            try:
                events = self._extract_from_single_evidence(record)
                for event in events:
                    event["evidence_id"] = record.evidence_id
                    self._events.append(event)
            except Exception as e:
                self._events.append({
                    "source": "system",
                    "source_file": record.file_path,
                    "timestamp": datetime.now(),
                    "time_source": "extraction_error",
                    "trust_level": TimeTrustLevel.LOW,
                    "event_type": "extraction_error",
                    "summary": f"提取事件时出错: {str(e)[:100]}",
                    "details": {"error": str(e), "evidence_id": record.evidence_id},
                    "evidence_id": record.evidence_id,
                })

        return self._events

    def _extract_from_single_evidence(self, record: EvidenceRecord) -> List[Dict]:
        """
        从单个证据文件中提取事件

        Args:
            record: 证据记录

        Returns:
            事件列表
        """
        events = []
        file_path = record.file_path

        if not Path(file_path).exists():
            return []

        if record.evidence_type in [EvidenceType.HTML_PAGE, EvidenceType.MHTML_ARCHIVE]:
            parser = HTMLParser(file_path)
            events.extend(parser.get_events())

        elif record.evidence_type == EvidenceType.HAR_LOG:
            parser = HARParser(file_path)
            events.extend(parser.get_events())

        elif record.evidence_type == EvidenceType.CHAT_LOG:
            parser = ChatParser(file_path)
            events.extend(parser.get_events())

        elif record.evidence_type in [EvidenceType.SCREENSHOT, EvidenceType.PDF_DOCUMENT]:
            events.extend(self._extract_from_binary_file(record))

        elif record.evidence_type == EvidenceType.ATTACHMENT:
            events.extend(self._extract_from_attachment(record))

        return events

    def _extract_from_binary_file(self, record: EvidenceRecord) -> List[Dict]:
        """
        从二进制文件（截图、PDF等）提取事件

        Args:
            record: 证据记录

        Returns:
            事件列表
        """
        events = []
        file_path = Path(record.file_path)
        stat = file_path.stat()

        trust_level = TimeTrustLevel.LOW
        time_source = "file_modified_time"

        if record.evidence_type == EvidenceType.SCREENSHOT:
            metadata = record.metadata
            if metadata.get("has_exif"):
                exif_data = metadata.get("exif_data", {})
                date_time = exif_data.get("DateTime") or exif_data.get("DateTimeOriginal")
                if date_time:
                    try:
                        dt = datetime.strptime(date_time, "%Y:%m:%d %H:%M:%S")
                        events.append({
                            "source": "screenshot",
                            "source_file": record.file_path,
                            "timestamp": dt,
                            "time_source": "screenshot_exif_time",
                            "trust_level": TimeTrustLevel.LOW,
                            "event_type": "snapshot_capture",
                            "summary": f"截图拍摄 (基于EXIF): {record.original_filename}",
                            "details": {
                                "original_filename": record.original_filename,
                                "exif_time": date_time,
                            },
                        })
                    except (ValueError, TypeError):
                        pass

        if not events:
            mtime = datetime.fromtimestamp(stat.st_mtime)
            events.append({
                "source": "binary_file",
                "source_file": record.file_path,
                "timestamp": mtime,
                "time_source": time_source,
                "trust_level": trust_level,
                "event_type": "file_snapshot",
                "summary": f"文件快照: {record.original_filename} (基于文件修改时间)",
                "details": {
                    "original_filename": record.original_filename,
                    "file_size": record.file_size,
                    "evidence_type": record.evidence_type.value,
                },
            })

        return events

    def _extract_from_attachment(self, record: EvidenceRecord) -> List[Dict]:
        """
        从附件提取事件

        Args:
            record: 证据记录

        Returns:
            事件列表
        """
        events = []
        file_path = Path(record.file_path)
        stat = file_path.stat()

        mtime = datetime.fromtimestamp(stat.st_mtime)
        events.append({
            "source": "attachment",
            "source_file": record.file_path,
            "timestamp": mtime,
            "time_source": "file_modified_time",
            "trust_level": TimeTrustLevel.LOW,
            "event_type": "attachment_snapshot",
            "summary": f"附件: {record.original_filename}",
            "details": {
                "original_filename": record.original_filename,
                "file_size": record.file_size,
                "sha256": record.sha256_hash,
            },
        })

        return events

    def normalize_events(self, events: List[Dict] = None) -> List[TimelineEvent]:
        """
        规范化事件，统一时区，生成事件ID

        Args:
            events: 事件列表（可选，默认为已提取的事件）

        Returns:
            规范化的时间线事件列表
        """
        if events is None:
            events = self._events

        normalized = []

        for event in events:
            timestamp = event.get("timestamp")
            if timestamp is None:
                continue

            if timestamp.tzinfo is None:
                timestamp = self._timezone.localize(timestamp)
            else:
                timestamp = timestamp.astimezone(self._timezone)

            event_id = self._generate_event_id()

            normalized_event = TimelineEvent(
                event_id=event_id,
                source=event.get("source", "unknown"),
                source_file=event.get("source_file", ""),
                timestamp=timestamp,
                timezone=str(self._timezone),
                trust_level=event.get("trust_level", TimeTrustLevel.LOW),
                event_type=event.get("event_type", "unknown"),
                summary=event.get("summary", ""),
                details=event.get("details", {}),
                evidence_id=event.get("evidence_id"),
            )

            normalized.append(normalized_event)

        return sorted(normalized, key=lambda e: e.timestamp)

    def _generate_event_id(self, prefix: str = "EVT") -> str:
        """生成唯一事件ID"""
        timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
        unique = uuid.uuid4().hex[:6].upper()
        return f"{prefix}-{timestamp}-{unique}"

    def get_time_range(self, events: List[TimelineEvent] = None) -> Dict:
        """
        获取时间线时间范围

        Args:
            events: 事件列表（可选）

        Returns:
            时间范围字典
        """
        if events is None:
            events = self.normalize_events()

        if not events:
            return {"start": None, "end": None, "duration_hours": 0}

        times = [e.timestamp for e in events]
        start = min(times)
        end = max(times)
        duration = (end - start).total_seconds() / 3600

        return {
            "start": start,
            "end": end,
            "duration_hours": round(duration, 2),
        }

    def get_statistics(self, events: List[TimelineEvent] = None) -> Dict:
        """
        获取时间线统计信息

        Args:
            events: 事件列表（可选）

        Returns:
            统计信息字典
        """
        if events is None:
            events = self.normalize_events()

        source_counts = {}
        type_counts = {}
        trust_counts = {}

        for event in events:
            source = event.source
            source_counts[source] = source_counts.get(source, 0) + 1

            evt_type = event.event_type
            type_counts[evt_type] = type_counts.get(evt_type, 0) + 1

            trust = event.trust_level.value
            trust_counts[trust] = trust_counts.get(trust, 0) + 1

        time_range = self.get_time_range(events)

        return {
            "total_events": len(events),
            "source_distribution": source_counts,
            "type_distribution": type_counts,
            "trust_distribution": trust_counts,
            "time_range": {
                "start": time_range["start"].isoformat() if time_range["start"] else None,
                "end": time_range["end"].isoformat() if time_range["end"] else None,
                "duration_hours": time_range["duration_hours"],
            },
        }

    def save_timeline(self, events: List[TimelineEvent], output_path: str) -> None:
        """
        保存时间线到JSON文件

        Args:
            events: 事件列表
            output_path: 输出文件路径
        """
        timeline = {
            "generated_at": datetime.now().isoformat(),
            "timezone": self.config.timezone,
            "statistics": self.get_statistics(events),
            "events": [
                event.model_dump(mode="json")
                for event in events
            ],
        }

        Path(output_path).parent.mkdir(parents=True, exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(timeline, f, ensure_ascii=False, indent=2, default=str)

    @staticmethod
    def load_timeline(input_path: str) -> Dict:
        """
        从JSON文件加载时间线

        Args:
            input_path: 输入文件路径

        Returns:
            时间线数据
        """
        with open(input_path, "r", encoding="utf-8") as f:
            return json.load(f)
