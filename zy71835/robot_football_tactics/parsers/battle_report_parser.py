from dataclasses import dataclass
from typing import Optional, List, Dict, Any, Tuple
import json
import re
from datetime import datetime
from ..models.battle_report import BattleReport, BattleEvent
from ..models.base import VersionInfo
from ..errors.friendly_errors import ParseError, error_context


@dataclass
class ParseWarning:
    field_path: str
    message: str
    suggestion: str = ""


class BattleReportParser:
    """战报解析器，支持文本、JSON格式"""

    EVENT_TYPE_PATTERNS = {
        "射门": [r"射门", r"打门", r"攻门"],
        "传球": [r"传球", r"传中", r"横传", r"直塞"],
        "抢断": [r"抢断", r"断球", r"拦截"],
        "犯规": [r"犯规", r"铲球", r"推人"],
        "进球": [r"进球", r"得分", r"破门"],
        "扑救": [r"扑救", r"挡出", r"没收"],
        "越位": [r"越位"],
        "开球": [r"开球", r"开始比赛"],
    }

    RESULT_PATTERNS = {
        "成功": [r"成功", r"有效", r"进球", r"得分", r"完成"],
        "失败": [r"失败", r"无效", r"被挡", r"偏出", r"高出", r"扑出"],
    }

    UNIT_PATTERN = r"(?:球员|机器人|单位|ID[:：]?)\s*([A-Za-z0-9_]+)"
    TIME_PATTERN = r"(\d+(?:\.\d+)?)\s*(?:分钟|min|')"

    def __init__(self):
        self.warnings: List[ParseWarning] = []

    def parse(self, content: str, file_type: str, version: VersionInfo) -> Tuple[BattleReport, List[ParseWarning]]:
        self.warnings = []
        raw_content = content

        try:
            if file_type == "json":
                events, match_name, match_time = self._parse_json(content)
            elif file_type == "txt":
                events, match_name, match_time = self._parse_text(content)
            else:
                raise ParseError(
                    message=f"不支持的战报格式：{file_type}",
                    suggestion="请使用 JSON 或纯文本格式的战报",
                    field_path="file_type",
                    raw_value=file_type
                )

            manual_modified = self._detect_manual_modification(content)

            report = BattleReport(
                report_id=f"report_{version.version_id}",
                version=version,
                match_name=match_name or f"比赛_{version.version_id}",
                match_time=match_time or datetime.now(),
                events=events,
                raw_content=raw_content,
                manual_modified=manual_modified
            )

            return report, self.warnings

        except ParseError:
            raise
        except Exception as e:
            raise ParseError(
                message=f"解析战报时出错：{str(e)}",
                suggestion="请检查战报内容格式是否正确",
                field_path="battle_report.content",
                raw_value=content[:200] + "..." if len(content) > 200 else content
            ) from e

    def _detect_manual_modification(self, content: str) -> bool:
        """检测是否有手工改动的痕迹"""
        markers = [
            "手动修改",
            "手工调整",
            "修正：",
            "改：",
            "备注：",
            "[修正]",
            "[改动]",
        ]
        return any(marker in content for marker in markers)

    def _parse_json(self, content: str) -> Tuple[List[BattleEvent], str, datetime]:
        with error_context("战报JSON解析"):
            data = json.loads(content)
            match_name = data.get("match_name", data.get("name", ""))
            match_time_str = data.get("match_time", "")

            try:
                match_time = datetime.fromisoformat(match_time_str) if match_time_str else None
            except ValueError:
                match_time = None
                self.warnings.append(ParseWarning(
                    field_path="match_time",
                    message=f"比赛时间格式不正确：{match_time_str}",
                    suggestion="请使用 ISO 格式时间（如 2024-01-15T14:30:00）"
                ))

            events_data = data.get("events", [])
            events = self._build_events(events_data)

            return events, match_name, match_time

    def _parse_text(self, content: str) -> Tuple[List[BattleEvent], str, datetime]:
        with error_context("战报文本解析"):
            lines = content.strip().splitlines()
            events_data = []
            match_name = ""
            match_time = None

            for line_num, line in enumerate(lines, start=1):
                line = line.strip()
                if not line:
                    continue

                if line.startswith("#") or line.startswith("比赛"):
                    if "vs" in line.lower() or "对阵" in line:
                        match_name = line.lstrip("#").strip()
                    continue

                if line.startswith("时间：") or line.startswith("时间:"):
                    time_str = line.split("：", 1)[1].strip() if "：" in line else line.split(":", 1)[1].strip()
                    try:
                        match_time = datetime.fromisoformat(time_str)
                    except ValueError:
                        self.warnings.append(ParseWarning(
                            field_path=f"line_{line_num}",
                            message=f"第{line_num}行：时间格式不正确：{time_str}",
                            suggestion="请使用 ISO 格式时间"
                        ))
                    continue

                event = self._parse_event_line(line, line_num)
                if event:
                    events_data.append(event)

            events = self._build_events(events_data)
            return events, match_name, match_time

    def _parse_event_line(self, line: str, line_num: int) -> Optional[Dict[str, Any]]:
        """解析单行事件文本"""
        event = {}
        found_event = False

        time_match = re.search(self.TIME_PATTERN, line)
        if time_match:
            event["timestamp"] = float(time_match.group(1))

        for event_type, patterns in self.EVENT_TYPE_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, line):
                    event["event_type"] = event_type
                    found_event = True
                    break
            if found_event:
                break

        if not found_event:
            return None

        units = re.findall(self.UNIT_PATTERN, line)
        if units:
            event["actor_unit_id"] = units[0]
            if len(units) > 1:
                event["target_unit_id"] = units[1]

        for result, patterns in self.RESULT_PATTERNS.items():
            for pattern in patterns:
                if re.search(pattern, line):
                    event["result"] = result
                    break
            if "result" in event:
                break

        if "result" not in event:
            event["result"] = "进行中"

        terrain_match = re.search(r"(?:在|位于|处于)\s*(\S+?)(?:区|地形|区域)", line)
        if terrain_match:
            event["terrain_id"] = terrain_match.group(1)

        event["raw_text"] = line
        return event

    def _build_events(self, events_data: List[Dict[str, Any]]) -> List[BattleEvent]:
        events: List[BattleEvent] = []

        for idx, data in enumerate(events_data):
            if "event_type" not in data:
                self.warnings.append(ParseWarning(
                    field_path=f"events[{idx}].event_type",
                    message=f"第{idx+1}个事件缺少事件类型，已跳过",
                    suggestion="请确保每个事件都有明确的事件类型"
                ))
                continue

            if "actor_unit_id" not in data:
                self.warnings.append(ParseWarning(
                    field_path=f"events[{idx}].actor_unit_id",
                    message=f"事件'{data.get('event_type', '未知')}'缺少执行者",
                    suggestion="请确保每个事件都指定执行者（球员/机器人ID）"
                ))

            events.append(BattleEvent(
                timestamp=float(data.get("timestamp", 0)),
                event_type=data["event_type"],
                actor_unit_id=data.get("actor_unit_id", "UNKNOWN"),
                target_unit_id=data.get("target_unit_id"),
                terrain_id=data.get("terrain_id"),
                result=data.get("result", ""),
                details=data.get("details", {}),
                raw_text=data.get("raw_text", "")
            ))

        events.sort(key=lambda e: e.timestamp)
        return events
