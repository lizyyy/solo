# -*- coding: utf-8 -*-
"""RINEX 观测文件解析模块

支持 RINEX 2.x 和 3.x 格式，处理以下边界情况：
- 跨 UTC 日期
- 混合采样率
- 缺少 END OF HEADER
- 不完整的观测记录
"""

import os
import re
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from collections import defaultdict


@dataclass
class RinexHeader:
    """RINEX 文件头信息"""
    version: float = 0.0
    file_type: str = ""
    station_name: str = ""
    marker_number: str = ""
    observer: str = ""
    agency: str = ""
    receiver_number: str = ""
    receiver_type: str = ""
    receiver_version: str = ""
    antenna_number: str = ""
    antenna_type: str = ""
    approx_position: Tuple[float, float, float] = (0.0, 0.0, 0.0)
    antenna_hen: Tuple[float, float, float] = (0.0, 0.0, 0.0)
    time_of_first_obs: Optional[datetime] = None
    time_of_last_obs: Optional[datetime] = None
    interval: Optional[float] = None
    leap_seconds: int = 0
    observation_types: Dict[str, List[str]] = field(default_factory=dict)
    raw_header_lines: List[str] = field(default_factory=list)
    has_end_of_header: bool = False


@dataclass
class ObservationEpoch:
    """观测历元"""
    time: datetime
    epoch_flag: int
    num_satellites: int
    prn_list: List[str] = field(default_factory=list)
    observations: Dict[str, Dict[str, Any]] = field(default_factory=dict)
    is_valid: bool = True


@dataclass
class CycleSlipCandidate:
    """周跳疑点"""
    prn: str
    time: datetime
    previous_time: datetime
    gap_seconds: float
    indicator: str = ""


@dataclass
class RinexStatistics:
    """RINEX 文件统计信息"""
    station_name: str
    file_path: str
    first_epoch: Optional[datetime] = None
    last_epoch: Optional[datetime] = None
    total_epochs: int = 0
    valid_epochs: int = 0
    missing_epochs: int = 0
    observation_duration_seconds: float = 0.0
    nominal_interval: Optional[float] = None
    actual_intervals: List[float] = field(default_factory=list)
    has_mixed_interval: bool = False
    cycle_slips: List[CycleSlipCandidate] = field(default_factory=list)
    satellite_epoch_counts: Dict[str, int] = field(default_factory=lambda: defaultdict(int))
    issues: List[Dict[str, Any]] = field(default_factory=list)


class RinexParser:
    """RINEX 观测文件解析器"""

    def __init__(self, file_path: str):
        self.file_path = file_path
        self.header: Optional[RinexHeader] = None
        self.epochs: List[ObservationEpoch] = []
        self.statistics: Optional[RinexStatistics] = None

    def parse(self) -> bool:
        """解析整个 RINEX 文件"""
        try:
            with open(self.file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
        except Exception as e:
            return False

        lines = content.split("\n")
        if not lines:
            return False

        self.header = self._parse_header(lines)
        self.epochs = self._parse_observations(lines)
        self.statistics = self._compute_statistics()

        return True

    def _is_epoch_header_line(self, line: str) -> bool:
        """检测一行是否是历元头"""
        if not line or len(line) < 10:
            return False

        if line.startswith(">"):
            return True

        if line[0] == " ":
            try:
                year_part = line[1:3].strip()
                if year_part and year_part.isdigit():
                    month_part = line[4:6].strip()
                    if month_part and month_part.isdigit():
                        return True
            except (ValueError, IndexError):
                pass

        return False

    def _parse_header(self, lines: List[str]) -> RinexHeader:
        """解析文件头"""
        header = RinexHeader()
        header_lines = []
        end_of_header_found = False

        known_labels = [
            "RINEX VERSION / TYPE",
            "PGM / RUN BY / DATE",
            "MARKER NAME",
            "MARKER NUMBER",
            "OBSERVER / AGENCY",
            "REC # / TYPE / VERS",
            "ANT # / TYPE",
            "APPROX POSITION XYZ",
            "ANTENNA: DELTA H/E/N",
            "# / TYPES OF OBSERV",
            "TIME OF FIRST OBS",
            "TIME OF LAST OBS",
            "INTERVAL",
            "LEAP SECONDS",
            "END OF HEADER",
        ]

        def extract_label(line: str) -> str:
            """从行中提取标签"""
            if len(line) >= 60:
                label = line[60:].strip()
                if label:
                    return label

            for known_label in known_labels:
                if known_label in line:
                    return known_label

            return ""

        for i, line in enumerate(lines):
            if self._is_epoch_header_line(line):
                break

            label = extract_label(line)
            header_lines.append(line)

            if label == "END OF HEADER":
                end_of_header_found = True
                break

            if label == "RINEX VERSION / TYPE":
                try:
                    header.version = float(line[0:20].strip())
                    header.file_type = line[20:21].strip()
                except ValueError:
                    pass

            elif label == "MARKER NAME":
                if len(line) >= 60:
                    header.station_name = line[0:60].strip()
                else:
                    parts = line.split("MARKER NAME")
                    if parts:
                        header.station_name = parts[0].strip()

            elif label == "MARKER NUMBER":
                if len(line) >= 60:
                    header.marker_number = line[0:60].strip()
                else:
                    parts = line.split("MARKER NUMBER")
                    if parts:
                        header.marker_number = parts[0].strip()

            elif label == "OBSERVER / AGENCY":
                header.observer = line[0:20].strip() if len(line) >= 20 else ""
                header.agency = line[20:40].strip() if len(line) >= 40 else ""

            elif label == "REC # / TYPE / VERS":
                header.receiver_number = line[0:20].strip() if len(line) >= 20 else ""
                header.receiver_type = line[20:40].strip() if len(line) >= 40 else ""
                header.receiver_version = line[40:60].strip() if len(line) >= 60 else ""

            elif label == "ANT # / TYPE":
                header.antenna_number = line[0:20].strip() if len(line) >= 20 else ""
                header.antenna_type = line[20:40].strip() if len(line) >= 40 else ""

            elif label == "APPROX POSITION XYZ":
                try:
                    x = float(line[0:14].strip()) if len(line) >= 14 else 0.0
                    y = float(line[14:28].strip()) if len(line) >= 28 else 0.0
                    z = float(line[28:42].strip()) if len(line) >= 42 else 0.0
                    header.approx_position = (x, y, z)
                except ValueError:
                    pass

            elif label == "ANTENNA: DELTA H/E/N":
                try:
                    h = float(line[0:14].strip()) if len(line) >= 14 else 0.0
                    e = float(line[14:28].strip()) if len(line) >= 28 else 0.0
                    n = float(line[28:42].strip()) if len(line) >= 42 else 0.0
                    header.antenna_hen = (h, e, n)
                except ValueError:
                    pass

            elif label == "TIME OF FIRST OBS":
                header.time_of_first_obs = self._parse_rinex_time(line[0:43] if len(line) >= 43 else line)

            elif label == "TIME OF LAST OBS":
                header.time_of_last_obs = self._parse_rinex_time(line[0:43] if len(line) >= 43 else line)

            elif label == "INTERVAL":
                try:
                    header.interval = float(line[0:10].strip()) if len(line) >= 10 else 0.0
                except ValueError:
                    pass

            elif label == "LEAP SECONDS":
                try:
                    header.leap_seconds = int(line[0:6].strip()) if len(line) >= 6 else 0
                except ValueError:
                    pass

            elif label == "# / TYPES OF OBSERV":
                try:
                    num_types = int(line[0:6].strip()) if len(line) >= 6 else 0
                    if header.version >= 3.0:
                        sys = line[6:7].strip() if len(line) >= 7 else ""
                        types = []
                        for j in range(num_types):
                            start = 10 + j * 6
                            if start + 6 <= len(line):
                                obs_type = line[start:start + 6].strip()
                                if obs_type:
                                    types.append(obs_type)
                        if sys:
                            header.observation_types[sys] = types
                    else:
                        types = []
                        for j in range(min(num_types, 9)):
                            start = 10 + j * 6
                            if start + 6 <= len(line):
                                obs_type = line[start:start + 6].strip()
                                if obs_type:
                                    types.append(obs_type)
                        header.observation_types["G"] = types
                except ValueError:
                    pass

        header.raw_header_lines = header_lines
        header.has_end_of_header = end_of_header_found

        return header

    def _parse_rinex_time(self, time_str: str) -> Optional[datetime]:
        """解析 RINEX 时间格式"""
        time_str = time_str.strip()
        if not time_str:
            return None

        try:
            if len(time_str) >= 26:
                year = int(time_str[0:4])
                month = int(time_str[5:7])
                day = int(time_str[8:10])
                hour = int(time_str[11:13])
                minute = int(time_str[14:16])
                second_str = time_str[17:].strip()
                second = float(second_str)
                microsecond = int((second - int(second)) * 1000000)
                return datetime(year, month, day, hour, minute, int(second), microsecond)
        except ValueError:
            pass

        return None

    def _parse_observations(self, lines: List[str]) -> List[ObservationEpoch]:
        """解析观测数据"""
        epochs = []
        header_end_idx = -1

        for i, line in enumerate(lines):
            if len(line) >= 60 and line[60:].strip() == "END OF HEADER":
                header_end_idx = i
                break

        if header_end_idx == -1:
            for i, line in enumerate(lines):
                if self._is_epoch_header_line(line):
                    header_end_idx = i - 1
                    break

        if header_end_idx == -1:
            header_end_idx = 0

        obs_lines = lines[header_end_idx + 1:] if header_end_idx + 1 < len(lines) else []

        i = 0
        while i < len(obs_lines):
            line = obs_lines[i].rstrip()
            if not line:
                i += 1
                continue

            epoch = self._parse_epoch_header(line)
            if epoch is None:
                i += 1
                continue

            if epoch.epoch_flag in (0, 1, 2, 3, 4, 5, 6):
                num_records_needed = (epoch.num_satellites + 11) // 12

                for j in range(num_records_needed):
                    rec_idx = i + 1 + j
                    if rec_idx < len(obs_lines):
                        rec_line = obs_lines[rec_idx]
                        for k in range(12):
                            start = k * 3
                            if start + 3 <= len(rec_line):
                                prn = rec_line[start:start + 3].strip()
                                if prn and prn not in epoch.prn_list:
                                    epoch.prn_list.append(prn)

                i += num_records_needed + 1

                if epoch.epoch_flag == 0:
                    obs_types = self._get_observation_types_for_epoch()
                    obs_per_sat = len(obs_types)

                    for prn_idx, prn in enumerate(epoch.prn_list):
                        obs_record_lines = (obs_per_sat + 4) // 5
                        obs_lines_for_prn = []

                        for rec_line_idx in range(obs_record_lines):
                            if i < len(obs_lines):
                                obs_lines_for_prn.append(obs_lines[i])
                                i += 1

                        epoch.observations[prn] = self._parse_observation_record(
                            obs_lines_for_prn, obs_types
                        )

            elif epoch.epoch_flag == 6:
                i += 1
                continue

            if epoch.epoch_flag == 0:
                epochs.append(epoch)
            else:
                if epoch.epoch_flag != 6:
                    epochs.append(epoch)

        return epochs

    def _parse_epoch_header(self, line: str) -> Optional[ObservationEpoch]:
        """解析历元头"""
        if self.header and self.header.version >= 3.0:
            return self._parse_epoch_header_v3(line)
        else:
            return self._parse_epoch_header_v2(line)

    def _parse_epoch_header_v2(self, line: str) -> Optional[ObservationEpoch]:
        """解析 RINEX 2.x 历元头"""
        if len(line) < 29:
            return None

        try:
            year = int(line[1:3])
            month = int(line[4:6])
            day = int(line[7:9])
            hour = int(line[10:12])
            minute = int(line[13:15])
            second = float(line[16:26].strip())

            if year < 80:
                year += 2000
            else:
                year += 1900

            epoch_flag = int(line[28])
            num_satellites = int(line[29:32]) if len(line) >= 32 else 0

            microsecond = int((second - int(second)) * 1000000)
            time = datetime(year, month, day, hour, minute, int(second), microsecond)

            return ObservationEpoch(
                time=time,
                epoch_flag=epoch_flag,
                num_satellites=num_satellites,
                is_valid=epoch_flag == 0
            )
        except ValueError:
            return None

    def _parse_epoch_header_v3(self, line: str) -> Optional[ObservationEpoch]:
        """解析 RINEX 3.x 历元头"""
        if len(line) < 41:
            return None

        try:
            if not line.startswith(">"):
                return None

            year = int(line[2:6])
            month = int(line[7:9])
            day = int(line[10:12])
            hour = int(line[13:15])
            minute = int(line[16:18])
            second = float(line[19:29].strip())

            epoch_flag = int(line[31])
            num_satellites = int(line[32:35]) if len(line) >= 35 else 0

            microsecond = int((second - int(second)) * 1000000)
            time = datetime(year, month, day, hour, minute, int(second), microsecond)

            return ObservationEpoch(
                time=time,
                epoch_flag=epoch_flag,
                num_satellites=num_satellites,
                is_valid=epoch_flag == 0
            )
        except ValueError:
            return None

    def _get_observation_types_for_epoch(self) -> List[str]:
        """获取观测类型列表"""
        if not self.header:
            return []

        all_types = []
        for sys_types in self.header.observation_types.values():
            all_types.extend(sys_types)
        return all_types

    def _parse_observation_record(
        self,
        lines: List[str],
        obs_types: List[str]
    ) -> Dict[str, Any]:
        """解析观测记录"""
        result = {}
        obs_idx = 0

        for line in lines:
            for i in range(5):
                if obs_idx >= len(obs_types):
                    break

                start = i * 16
                if start + 16 > len(line):
                    obs_idx += 1
                    continue

                value_str = line[start:start + 14].strip()
                lli = line[start + 14] if start + 14 < len(line) else " "
                signal_strength = line[start + 15] if start + 15 < len(line) else " "

                obs_type = obs_types[obs_idx]
                try:
                    value = float(value_str) if value_str else None
                except ValueError:
                    value = None

                result[obs_type] = {
                    "value": value,
                    "lli": lli,
                    "signal_strength": signal_strength
                }

                if lli in ("1", "2", "3", "4", "5", "6", "7"):
                    result[obs_type]["cycle_slip_flag"] = True

                obs_idx += 1

        return result

    def _compute_statistics(self) -> RinexStatistics:
        """计算统计信息"""
        stats = RinexStatistics(
            station_name=self.header.station_name if self.header else "UNKNOWN",
            file_path=self.file_path
        )

        if not self.epochs:
            return stats

        valid_epochs = [e for e in self.epochs if e.is_valid]
        if not valid_epochs:
            return stats

        stats.first_epoch = valid_epochs[0].time
        stats.last_epoch = valid_epochs[-1].time
        stats.total_epochs = len(self.epochs)
        stats.valid_epochs = len(valid_epochs)

        if stats.first_epoch and stats.last_epoch:
            stats.observation_duration_seconds = (
                stats.last_epoch - stats.first_epoch
            ).total_seconds()

        if self.header and self.header.interval:
            stats.nominal_interval = self.header.interval

        previous_time = None
        actual_intervals = []

        for epoch in valid_epochs:
            if previous_time is not None:
                interval = (epoch.time - previous_time).total_seconds()
                if interval > 0:
                    actual_intervals.append(interval)
            previous_time = epoch.time

        stats.actual_intervals = actual_intervals

        if actual_intervals:
            unique_intervals = sorted(set(actual_intervals))
            if len(unique_intervals) > 1:
                stats.has_mixed_interval = True

                if len(actual_intervals) > 10:
                    from collections import Counter
                    interval_counts = Counter(actual_intervals)
                    most_common_interval, _ = interval_counts.most_common(1)[0]
                    if stats.nominal_interval is None:
                        stats.nominal_interval = most_common_interval

            elif stats.nominal_interval is None:
                stats.nominal_interval = unique_intervals[0]

        if stats.nominal_interval and stats.observation_duration_seconds > 0:
            expected_epochs = int(stats.observation_duration_seconds / stats.nominal_interval) + 1
            stats.missing_epochs = max(0, expected_epochs - stats.valid_epochs)

        for epoch in valid_epochs:
            for prn in epoch.prn_list:
                stats.satellite_epoch_counts[prn] += 1

        stats.cycle_slips = self._detect_cycle_slips(valid_epochs)

        if self.header and not self.header.has_end_of_header:
            stats.issues.append({
                "type": "header_error",
                "severity": "warning",
                "message": "文件缺少 END OF HEADER 标记"
            })

        if stats.has_mixed_interval:
            stats.issues.append({
                "type": "interval_mixed",
                "severity": "warning",
                "message": f"检测到混合采样率，观测间隔有 {len(set(stats.actual_intervals))} 种不同值"
            })

        if stats.missing_epochs > 0:
            stats.issues.append({
                "type": "missing_epochs",
                "severity": "warning",
                "message": f"检测到 {stats.missing_epochs} 个缺历元"
            })

        if stats.cycle_slips:
            stats.issues.append({
                "type": "cycle_slips",
                "severity": "warning",
                "message": f"检测到 {len(stats.cycle_slips)} 个周跳疑点"
            })

        return stats

    def _detect_cycle_slips(self, valid_epochs: List[ObservationEpoch]) -> List[CycleSlipCandidate]:
        """检测周跳"""
        cycle_slips = []

        if not valid_epochs or len(valid_epochs) < 2:
            return cycle_slips

        nominal_interval = self.statistics.nominal_interval if self.statistics else None
        if nominal_interval is None:
            if valid_epochs and len(valid_epochs) >= 2:
                nominal_interval = (valid_epochs[1].time - valid_epochs[0].time).total_seconds()
            else:
                nominal_interval = 30.0

        for i in range(1, len(valid_epochs)):
            current_epoch = valid_epochs[i]
            previous_epoch = valid_epochs[i - 1]

            time_gap = (current_epoch.time - previous_epoch.time).total_seconds()

            if time_gap > nominal_interval * 2:
                common_prns = set(current_epoch.prn_list) & set(previous_epoch.prn_list)
                for prn in common_prns:
                    cycle_slips.append(CycleSlipCandidate(
                        prn=prn,
                        time=current_epoch.time,
                        previous_time=previous_epoch.time,
                        gap_seconds=time_gap,
                        indicator="time_gap"
                    ))

            for prn in current_epoch.prn_list:
                if prn in current_epoch.observations:
                    for obs_type, obs_data in current_epoch.observations[prn].items():
                        if obs_data.get("cycle_slip_flag", False):
                            cycle_slips.append(CycleSlipCandidate(
                                prn=prn,
                                time=current_epoch.time,
                                previous_time=previous_epoch.time,
                                gap_seconds=time_gap,
                                indicator=f"lli_flag_{obs_data['lli']}"
                            ))
                            break

        return cycle_slips
