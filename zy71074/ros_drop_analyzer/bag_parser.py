import os
import re
import json
from typing import Dict, List, Optional, Tuple
from collections import defaultdict

from rich.console import Console

from .config import AnalyzerConfig
from .types import FrameRecord, SensorType

console = Console()


class BagParser:
    def __init__(self, config: AnalyzerConfig):
        self.config = config
        self.topic_mapping: Dict[str, Tuple[str, SensorType]] = {}
        self.invalid_records: List[Dict] = []
        self._build_topic_mapping()

    def _build_topic_mapping(self):
        for sensor_type, patterns in self.config.topic_patterns.items():
            for pattern in patterns:
                self.topic_mapping[pattern] = (f"{sensor_type.value}", sensor_type)

    def parse(self) -> Dict[str, List[FrameRecord]]:
        input_file = self.config.input_file

        if input_file.endswith('.bag'):
            return self._parse_rosbag(input_file)
        elif input_file.endswith('.txt') or input_file.endswith('.log'):
            return self._parse_text_dump(input_file)
        elif input_file.endswith('.json'):
            return self._parse_json(input_file)
        else:
            return self._parse_text_dump(input_file)

    def _parse_rosbag(self, bag_file: str) -> Dict[str, List[FrameRecord]]:
        try:
            import rosbag
        except ImportError:
            console.print("[yellow]⚠ rosbag Python 库未安装，尝试解析为文本格式[/yellow]")
            return self._parse_text_dump(bag_file)

        sensor_data: Dict[str, List[FrameRecord]] = defaultdict(list)
        bag = rosbag.Bag(bag_file)

        try:
            topics_info = bag.get_type_and_topic_info()
            console.print(f"[blue]ℹ 检测到 {len(topics_info.topics)} 个 topic[/blue]")

            for topic, msg, t in bag.read_messages():
                normalized_name, sensor_type = self._normalize_topic(topic)

                if not normalized_name:
                    continue

                if self.config.specific_topics and topic not in self.config.specific_topics:
                    continue

                timestamp = t.to_sec()

                if self.config.start_time and timestamp < self.config.start_time:
                    continue
                if self.config.end_time and timestamp > self.config.end_time:
                    continue

                seq = getattr(msg.header, 'seq', None) if hasattr(msg, 'header') else None

                record = FrameRecord(
                    timestamp=timestamp,
                    topic=topic,
                    sensor_type=sensor_type,
                    seq=seq,
                )
                sensor_data[normalized_name].append(record)

        finally:
            bag.close()

        return dict(sensor_data)

    def _parse_text_dump(self, text_file: str) -> Dict[str, List[FrameRecord]]:
        sensor_data: Dict[str, List[FrameRecord]] = defaultdict(list)

        with open(text_file, 'r', encoding='utf-8', errors='ignore') as f:
            lines = f.readlines()

        line_number = 0
        for line in lines:
            line_number += 1
            line = line.strip()

            if not line:
                continue

            try:
                record = self._parse_text_line(line, line_number)
                if record:
                    normalized_name, _ = self._normalize_topic(record.topic)

                    if normalized_name:
                        if self.config.specific_topics and record.topic not in self.config.specific_topics:
                            continue

                        if self.config.start_time and record.timestamp < self.config.start_time:
                            continue
                        if self.config.end_time and record.timestamp > self.config.end_time:
                            continue

                        sensor_data[normalized_name].append(record)
            except Exception as e:
                self.invalid_records.append({
                    'line_number': line_number,
                    'content': line,
                    'error': str(e),
                })
                if self.config.verbose:
                    console.print(f"[yellow]⚠ 第 {line_number} 行解析失败: {e}[/yellow]")

        if self.invalid_records:
            console.print(f"[yellow]⚠ 发现 {len(self.invalid_records)} 条无法解析的记录[/yellow]")

        return dict(sensor_data)

    def _parse_text_line(self, line: str, line_number: int) -> Optional[FrameRecord]:
        patterns = [
            r'^(\d+\.\d+)\s+(\S+)\s+.*$',
            r'^(\d+\.\d+):\s*topic:\s*(\S+)\s*.*$',
            r'^time:\s*(\d+\.\d+)\s*.*?topic:\s*(\S+).*$',
            r'^(\d+\.\d+)\s*\|*\s*(\S+)\s*\|*.*$',
            r'^(\d{10}\.\d+)\s+(.+)$',
        ]

        timestamp = None
        topic = None

        for pattern in patterns:
            match = re.match(pattern, line)
            if match:
                try:
                    timestamp = float(match.group(1))
                    topic = match.group(2).strip()
                    break
                except (ValueError, IndexError):
                    continue

        if timestamp is None or topic is None:
            return None

        sensor_type = self._detect_sensor_type(topic)

        seq_match = re.search(r'seq[:=]\s*(\d+)', line)
        seq = int(seq_match.group(1)) if seq_match else None

        return FrameRecord(
            timestamp=timestamp,
            topic=topic,
            sensor_type=sensor_type,
            seq=seq,
            line_number=line_number,
            raw_content=line if self.config.verbose else None,
        )

    def _parse_json(self, json_file: str) -> Dict[str, List[FrameRecord]]:
        sensor_data: Dict[str, List[FrameRecord]] = defaultdict(list)

        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if isinstance(data, list):
            for idx, item in enumerate(data):
                try:
                    timestamp = item.get('timestamp') or item.get('time') or item.get('t')
                    topic = item.get('topic') or item.get('topic_name')

                    if timestamp is None or topic is None:
                        self.invalid_records.append({
                            'index': idx,
                            'error': '缺少 timestamp 或 topic 字段',
                        })
                        continue

                    sensor_type = self._detect_sensor_type(topic)
                    normalized_name, _ = self._normalize_topic(topic)

                    if normalized_name:
                        record = FrameRecord(
                            timestamp=float(timestamp),
                            topic=topic,
                            sensor_type=sensor_type,
                            seq=item.get('seq'),
                            line_number=idx,
                        )
                        sensor_data[normalized_name].append(record)
                except Exception as e:
                    self.invalid_records.append({
                        'index': idx,
                        'error': str(e),
                    })

        return dict(sensor_data)

    def _normalize_topic(self, topic: str) -> Tuple[Optional[str], SensorType]:
        if topic in self.config.topic_aliases:
            topic = self.config.topic_aliases[topic]

        sensor_type = self._detect_sensor_type(topic)

        if sensor_type == SensorType.UNKNOWN:
            return None, sensor_type

        base_name = self._extract_base_topic_name(topic, sensor_type)
        return base_name, sensor_type

    def _detect_sensor_type(self, topic: str) -> SensorType:
        topic_lower = topic.lower()

        for sensor_type, patterns in self.config.topic_patterns.items():
            for pattern in patterns:
                if re.search(pattern, topic_lower):
                    return sensor_type

        if any(kw in topic_lower for kw in ['lidar', 'pointcloud', 'points', 'cloud']):
            return SensorType.LIDAR
        if any(kw in topic_lower for kw in ['camera', 'image', 'cam']):
            return SensorType.CAMERA
        if any(kw in topic_lower for kw in ['imu', 'gyro', 'accel', 'inertial']):
            return SensorType.IMU

        return SensorType.UNKNOWN

    def _extract_base_topic_name(self, topic: str, sensor_type: SensorType) -> str:
        topic_lower = topic.lower()

        base_name = f"{sensor_type.value}"

        if not self.config.merge_related_topics:
            match = re.search(r'(\d+)', topic)
            if match:
                base_name += f"_{match.group(1)}"

        return base_name

    def get_invalid_records(self) -> List[Dict]:
        return self.invalid_records
