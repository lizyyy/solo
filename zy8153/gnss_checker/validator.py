# -*- coding: utf-8 -*-
"""数据验证模块

负责：
- 读取基站台账 CSV
- 读取测段计划 YAML
- 验证坐标一致性
- 验证天线高一致性
- 验证观测时长符合性
- 汇总所有 issues
"""

import os
import csv
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple, Any
from collections import defaultdict

import yaml

from .rinex_parser import RinexParser, RinexStatistics, RinexHeader


@dataclass
class StationInfo:
    """基站信息"""
    station_name: str
    marker_number: str = ""
    x: float = 0.0
    y: float = 0.0
    z: float = 0.0
    lon: Optional[float] = None
    lat: Optional[float] = None
    height: Optional[float] = None
    antenna_height: float = 0.0
    antenna_type: str = ""
    receiver_type: str = ""
    notes: str = ""


@dataclass
class SessionPlan:
    """测段计划"""
    session_name: str
    station_name: str
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    expected_duration_seconds: float = 0.0
    expected_interval: float = 30.0
    antenna_height: Optional[float] = None
    antenna_type: str = ""
    receiver_type: str = ""
    notes: str = ""


@dataclass
class ValidationIssue:
    """验证问题"""
    issue_id: str
    station_name: str
    session_name: str = ""
    issue_type: str = ""
    severity: str = "warning"
    message: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    rinex_file: str = ""
    timestamp: Optional[datetime] = None


class DataValidator:
    """数据验证器"""

    def __init__(self):
        self.stations: Dict[str, StationInfo] = {}
        self.sessions: List[SessionPlan] = []
        self.rinex_parsers: Dict[str, RinexParser] = {}
        self.issues: List[ValidationIssue] = []
        self.issue_counter: int = 0

    def load_station_csv(self, csv_path: str) -> bool:
        """加载基站台账 CSV"""
        if not os.path.exists(csv_path):
            self._add_issue(
                station_name="SYSTEM",
                issue_type="file_missing",
                severity="error",
                message=f"基站台账文件不存在: {csv_path}"
            )
            return False

        try:
            with open(csv_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    station = self._parse_station_row(row)
                    if station:
                        self.stations[station.station_name] = station
        except Exception as e:
            self._add_issue(
                station_name="SYSTEM",
                issue_type="file_error",
                severity="error",
                message=f"读取基站台账文件失败: {csv_path}, 错误: {str(e)}"
            )
            return False

        return True

    def _parse_station_row(self, row: Dict[str, str]) -> Optional[StationInfo]:
        """解析 CSV 行"""
        station_name = row.get("station_name", "").strip() or row.get("站名", "").strip()
        if not station_name:
            return None

        station = StationInfo(station_name=station_name)

        station.marker_number = row.get("marker_number", "").strip() or row.get("点号", "").strip()

        for coord_key in ["x", "X", "x_coord", "X坐标"]:
            if coord_key in row and row[coord_key].strip():
                try:
                    station.x = float(row[coord_key].strip())
                    break
                except ValueError:
                    pass

        for coord_key in ["y", "Y", "y_coord", "Y坐标"]:
            if coord_key in row and row[coord_key].strip():
                try:
                    station.y = float(row[coord_key].strip())
                    break
                except ValueError:
                    pass

        for coord_key in ["z", "Z", "z_coord", "Z坐标"]:
            if coord_key in row and row[coord_key].strip():
                try:
                    station.z = float(row[coord_key].strip())
                    break
                except ValueError:
                    pass

        for coord_key in ["lon", "经度", "longitude"]:
            if coord_key in row and row[coord_key].strip():
                try:
                    station.lon = float(row[coord_key].strip())
                    break
                except ValueError:
                    pass

        for coord_key in ["lat", "纬度", "latitude"]:
            if coord_key in row and row[coord_key].strip():
                try:
                    station.lat = float(row[coord_key].strip())
                    break
                except ValueError:
                    pass

        for coord_key in ["height", "高程", "h"]:
            if coord_key in row and row[coord_key].strip():
                try:
                    station.height = float(row[coord_key].strip())
                    break
                except ValueError:
                    pass

        for ant_key in ["antenna_height", "天线高", "ant_h", "h_ant"]:
            if ant_key in row and row[ant_key].strip():
                try:
                    station.antenna_height = float(row[ant_key].strip())
                    break
                except ValueError:
                    pass

        station.antenna_type = row.get("antenna_type", "").strip() or row.get("天线类型", "").strip()
        station.receiver_type = row.get("receiver_type", "").strip() or row.get("接收机类型", "").strip()
        station.notes = row.get("notes", "").strip() or row.get("备注", "").strip()

        return station

    def load_session_yaml(self, yaml_path: str) -> bool:
        """加载测段计划 YAML"""
        if not os.path.exists(yaml_path):
            self._add_issue(
                station_name="SYSTEM",
                issue_type="file_missing",
                severity="error",
                message=f"测段计划文件不存在: {yaml_path}"
            )
            return False

        try:
            with open(yaml_path, "r", encoding="utf-8") as f:
                data = yaml.safe_load(f)

            if not data:
                return True

            sessions_data = data.get("sessions", [])
            if not isinstance(sessions_data, list):
                sessions_data = [sessions_data]

            for session_data in sessions_data:
                session = self._parse_session_data(session_data)
                if session:
                    self.sessions.append(session)

        except Exception as e:
            self._add_issue(
                station_name="SYSTEM",
                issue_type="file_error",
                severity="error",
                message=f"读取测段计划文件失败: {yaml_path}, 错误: {str(e)}"
            )
            return False

        return True

    def _parse_session_data(self, data: Dict[str, Any]) -> Optional[SessionPlan]:
        """解析 YAML 中的测段数据"""
        if not isinstance(data, dict):
            return None

        station_name = data.get("station_name", "").strip()
        if not station_name:
            return None

        session = SessionPlan(
            session_name=data.get("session_name", f"{station_name}_session"),
            station_name=station_name
        )

        start_time_str = data.get("start_time", "")
        if start_time_str:
            session.start_time = self._parse_yaml_time(start_time_str)

        end_time_str = data.get("end_time", "")
        if end_time_str:
            session.end_time = self._parse_yaml_time(end_time_str)

        if session.start_time and session.end_time:
            session.expected_duration_seconds = (
                session.end_time - session.start_time
            ).total_seconds()

        duration_hours = data.get("duration_hours")
        if duration_hours is not None:
            session.expected_duration_seconds = float(duration_hours) * 3600

        session.expected_interval = float(data.get("interval", 30.0))
        session.antenna_height = data.get("antenna_height")
        session.antenna_type = data.get("antenna_type", "")
        session.receiver_type = data.get("receiver_type", "")
        session.notes = data.get("notes", "")

        return session

    def _parse_yaml_time(self, time_str: Any) -> Optional[datetime]:
        """解析 YAML 中的时间格式"""
        if isinstance(time_str, datetime):
            return time_str

        if not isinstance(time_str, str):
            return None

        time_str = time_str.strip()

        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%Y%m%d %H%M%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%dT%H:%M",
        ]

        for fmt in formats:
            try:
                return datetime.strptime(time_str, fmt)
            except ValueError:
                continue

        return None

    def load_rinex_files(self, rinex_paths: List[str]) -> Dict[str, bool]:
        """加载多个 RINEX 文件"""
        results = {}
        for path in rinex_paths:
            parser = RinexParser(path)
            success = parser.parse()
            results[path] = success

            if success:
                station_name = parser.header.station_name if parser.header else None
                base_name = os.path.basename(path)

                if station_name and station_name.strip():
                    key = station_name.strip()
                else:
                    key = base_name

                if key in self.rinex_parsers:
                    key = f"{key}_{len(self.rinex_parsers)}"

                self.rinex_parsers[key] = parser
            else:
                self._add_issue(
                    station_name="UNKNOWN",
                    issue_type="parse_error",
                    severity="error",
                    message=f"无法解析 RINEX 文件: {path}",
                    rinex_file=path
                )

        return results

    def validate_all(self) -> List[ValidationIssue]:
        """执行所有验证"""
        self.issues = []

        for key, parser in self.rinex_parsers.items():
            actual_station_name = key
            if parser.header and parser.header.station_name:
                actual_station_name = parser.header.station_name.strip()

            self._validate_rinex_basic(actual_station_name, parser)
            self._validate_against_station_info(actual_station_name, parser)
            self._validate_against_session_plan(actual_station_name, parser)

        self._validate_missing_stations()

        return self.issues

    def _validate_rinex_basic(self, station_name: str, parser: RinexParser):
        """验证 RINEX 基本质量"""
        stats = parser.statistics
        header = parser.header

        if not stats:
            return

        rinex_file = stats.file_path

        for issue in stats.issues:
            self._add_issue(
                station_name=station_name,
                issue_type=issue["type"],
                severity=issue["severity"],
                message=issue["message"],
                rinex_file=rinex_file
            )

        if stats.observation_duration_seconds < 3600:
            self._add_issue(
                station_name=station_name,
                issue_type="short_duration",
                severity="warning",
                message=f"观测时长较短: {stats.observation_duration_seconds/60:.1f} 分钟",
                rinex_file=rinex_file,
                details={
                    "duration_seconds": stats.observation_duration_seconds,
                    "duration_minutes": stats.observation_duration_seconds / 60
                }
            )

        if stats.missing_epochs > 0:
            missing_rate = stats.missing_epochs / (stats.valid_epochs + stats.missing_epochs) * 100
            if missing_rate > 5:
                self._add_issue(
                    station_name=station_name,
                    issue_type="high_missing_rate",
                    severity="error" if missing_rate > 20 else "warning",
                    message=f"缺历元率较高: {missing_rate:.1f}%",
                    rinex_file=rinex_file,
                    details={
                        "missing_epochs": stats.missing_epochs,
                        "valid_epochs": stats.valid_epochs,
                        "missing_rate": missing_rate
                    }
                )

        if stats.cycle_slips:
            for slip in stats.cycle_slips[:10]:
                self._add_issue(
                    station_name=station_name,
                    issue_type="cycle_slip",
                    severity="warning",
                    message=f"卫星 {slip.prn} 在 {slip.time} 检测到周跳疑点 (间隔 {slip.gap_seconds:.0f}秒)",
                    rinex_file=rinex_file,
                    timestamp=slip.time,
                    details={
                        "prn": slip.prn,
                        "gap_seconds": slip.gap_seconds,
                        "indicator": slip.indicator
                    }
                )

            if len(stats.cycle_slips) > 10:
                self._add_issue(
                    station_name=station_name,
                    issue_type="cycle_slip_summary",
                    severity="warning",
                    message=f"另有 {len(stats.cycle_slips) - 10} 个周跳疑点未列出",
                    rinex_file=rinex_file
                )

    def _validate_against_station_info(self, station_name: str, parser: RinexParser):
        """与基站台账比对验证"""
        header = parser.header
        stats = parser.statistics

        if not header or not stats:
            return

        rinex_file = stats.file_path

        if station_name not in self.stations:
            similar = self._find_similar_station(station_name)
            if similar:
                self._add_issue(
                    station_name=station_name,
                    issue_type="station_name_mismatch",
                    severity="warning",
                    message=f"基站名 '{station_name}' 未在台账中找到，是否为 '{similar}'？",
                    rinex_file=rinex_file
                )
            else:
                self._add_issue(
                    station_name=station_name,
                    issue_type="station_not_found",
                    severity="warning",
                    message=f"基站名 '{station_name}' 未在台账中找到",
                    rinex_file=rinex_file
                )
            return

        station = self.stations[station_name]

        if header.approx_position != (0.0, 0.0, 0.0):
            x_rinex, y_rinex, z_rinex = header.approx_position
            x_station, y_station, z_station = station.x, station.y, station.z

            if x_station != 0.0 and y_station != 0.0 and z_station != 0.0:
                dx = x_rinex - x_station
                dy = y_rinex - y_station
                dz = z_rinex - z_station
                distance = (dx**2 + dy**2 + dz**2)**0.5

                if distance > 1.0:
                    self._add_issue(
                        station_name=station_name,
                        issue_type="coordinate_mismatch",
                        severity="error" if distance > 10.0 else "warning",
                        message=f"坐标与台账不一致，偏差 {distance:.3f} 米",
                        rinex_file=rinex_file,
                        details={
                            "rinex_xyz": [x_rinex, y_rinex, z_rinex],
                            "station_xyz": [x_station, y_station, z_station],
                            "delta_xyz": [dx, dy, dz],
                            "distance": distance
                        }
                    )

        if header.antenna_hen[0] != 0.0 and station.antenna_height != 0.0:
            ant_h_rinex = header.antenna_hen[0]
            ant_h_station = station.antenna_height
            diff = abs(ant_h_rinex - ant_h_station)

            if diff > 0.001:
                self._add_issue(
                    station_name=station_name,
                    issue_type="antenna_height_mismatch",
                    severity="error" if diff > 0.1 else "warning",
                    message=f"天线高与台账不一致，RINEX: {ant_h_rinex:.4f}m, 台账: {ant_h_station:.4f}m, 差值: {diff:.4f}m",
                    rinex_file=rinex_file,
                    details={
                        "rinex_antenna_height": ant_h_rinex,
                        "station_antenna_height": ant_h_station,
                        "difference": diff
                    }
                )

        if header.antenna_type and station.antenna_type:
            if header.antenna_type.strip() != station.antenna_type.strip():
                self._add_issue(
                    station_name=station_name,
                    issue_type="antenna_type_mismatch",
                    severity="warning",
                    message=f"天线类型不一致，RINEX: '{header.antenna_type}', 台账: '{station.antenna_type}'",
                    rinex_file=rinex_file
                )

        if header.receiver_type and station.receiver_type:
            if header.receiver_type.strip() != station.receiver_type.strip():
                self._add_issue(
                    station_name=station_name,
                    issue_type="receiver_type_mismatch",
                    severity="warning",
                    message=f"接收机类型不一致，RINEX: '{header.receiver_type}', 台账: '{station.receiver_type}'",
                    rinex_file=rinex_file
                )

    def _validate_against_session_plan(self, station_name: str, parser: RinexParser):
        """与测段计划比对验证"""
        stats = parser.statistics
        if not stats:
            return

        rinex_file = stats.file_path

        station_sessions = [s for s in self.sessions if s.station_name == station_name]

        if not station_sessions:
            return

        for session in station_sessions:
            session_match = False
            overlap_seconds = 0.0

            if session.start_time and session.end_time:
                if stats.first_epoch and stats.last_epoch:
                    latest_start = max(session.start_time, stats.first_epoch)
                    earliest_end = min(session.end_time, stats.last_epoch)

                    if latest_start <= earliest_end:
                        overlap_seconds = (earliest_end - latest_start).total_seconds()
                        session_match = True

            if session_match:
                expected_duration = session.expected_duration_seconds
                actual_duration = stats.observation_duration_seconds

                if expected_duration > 0:
                    shortfall = expected_duration - actual_duration
                    if shortfall > 60:
                        shortfall_ratio = shortfall / expected_duration * 100
                        self._add_issue(
                            station_name=station_name,
                            session_name=session.session_name,
                            issue_type="duration_shortfall",
                            severity="error" if shortfall_ratio > 20 else "warning",
                            message=f"观测时长不足，计划 {expected_duration/3600:.2f} 小时，实际 {actual_duration/3600:.2f} 小时，缺少 {shortfall/60:.1f} 分钟",
                            rinex_file=rinex_file,
                            details={
                                "expected_duration_hours": expected_duration / 3600,
                                "actual_duration_hours": actual_duration / 3600,
                                "shortfall_minutes": shortfall / 60,
                                "shortfall_ratio": shortfall_ratio
                            }
                        )

                if session.expected_interval > 0 and stats.nominal_interval:
                    expected = session.expected_interval
                    actual = stats.nominal_interval
                    if abs(expected - actual) > 0.1:
                        self._add_issue(
                            station_name=station_name,
                            session_name=session.session_name,
                            issue_type="interval_mismatch",
                            severity="warning",
                            message=f"采样间隔不一致，计划 {expected}s，实际 {actual}s",
                            rinex_file=rinex_file,
                            details={
                                "expected_interval": expected,
                                "actual_interval": actual
                            }
                        )

                if session.antenna_height is not None and stats.nominal_interval:
                    rinex_ant_h = 0.0
                    if parser.header and parser.header.antenna_hen:
                        rinex_ant_h = parser.header.antenna_hen[0]

                    if rinex_ant_h > 0:
                        diff = abs(rinex_ant_h - session.antenna_height)
                        if diff > 0.001:
                            self._add_issue(
                                station_name=station_name,
                                session_name=session.session_name,
                                issue_type="antenna_height_plan_mismatch",
                                severity="warning",
                                message=f"天线高与测段计划不一致，计划: {session.antenna_height:.4f}m, RINEX: {rinex_ant_h:.4f}m",
                                rinex_file=rinex_file
                            )

    def _validate_missing_stations(self):
        """验证是否有计划中但没有数据的基站"""
        planned_stations = set(s.station_name for s in self.sessions)
        
        available_stations = set()
        for parser in self.rinex_parsers.values():
            if parser.header and parser.header.station_name:
                station_name = parser.header.station_name.strip()
                if station_name:
                    available_stations.add(station_name)

        missing_stations = planned_stations - available_stations

        for station in missing_stations:
            station_sessions = [s for s in self.sessions if s.station_name == station]
            for session in station_sessions:
                self._add_issue(
                    station_name=station,
                    session_name=session.session_name,
                    issue_type="missing_data",
                    severity="error",
                    message=f"测段 '{session.session_name}' 缺少观测数据"
                )

    def _find_similar_station(self, station_name: str) -> Optional[str]:
        """查找相似的基站名"""
        if not station_name:
            return None

        station_name_upper = station_name.upper()

        for existing in self.stations.keys():
            existing_upper = existing.upper()
            if station_name_upper == existing_upper:
                return existing

            if len(station_name) >= 3 and len(existing) >= 3:
                if station_name_upper[:3] == existing_upper[:3]:
                    return existing

        return None

    def _add_issue(
        self,
        station_name: str,
        issue_type: str,
        severity: str,
        message: str,
        session_name: str = "",
        rinex_file: str = "",
        timestamp: Optional[datetime] = None,
        details: Dict[str, Any] = None
    ):
        """添加验证问题"""
        self.issue_counter += 1
        issue = ValidationIssue(
            issue_id=f"ISS{self.issue_counter:04d}",
            station_name=station_name,
            session_name=session_name,
            issue_type=issue_type,
            severity=severity,
            message=message,
            rinex_file=rinex_file,
            timestamp=timestamp,
            details=details or {}
        )
        self.issues.append(issue)

    def get_validation_summary(self) -> Dict[str, Any]:
        """获取验证摘要"""
        summary = {
            "total_stations": len(self.stations),
            "total_sessions": len(self.sessions),
            "total_rinex_files": len(self.rinex_parsers),
            "total_issues": len(self.issues),
            "issues_by_severity": defaultdict(int),
            "issues_by_type": defaultdict(int),
            "issues_by_station": defaultdict(int),
        }

        for issue in self.issues:
            summary["issues_by_severity"][issue.severity] += 1
            summary["issues_by_type"][issue.issue_type] += 1
            summary["issues_by_station"][issue.station_name] += 1

        return dict(summary)
