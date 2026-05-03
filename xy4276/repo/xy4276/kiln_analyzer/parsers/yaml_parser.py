from pathlib import Path
from typing import Any, List

import yaml

from kiln_analyzer.models import CurvePhase, PhaseType, TargetCurve
from kiln_analyzer.parsers.base import BaseParser


class TargetCurveYAMLParser(BaseParser[TargetCurve]):
    def parse(self, file_path: Path) -> TargetCurve:
        if not file_path.exists():
            raise FileNotFoundError(f"目标曲线YAML文件不存在: {file_path}")

        with open(file_path, "r", encoding="utf-8") as f:
            raw_data = yaml.safe_load(f)

        if not isinstance(raw_data, dict):
            raise ValueError(f"YAML文件格式错误，期望是一个对象: {file_path}")

        name = raw_data.get("name", "未命名烧成曲线")
        description = raw_data.get("description")
        raw_phases = raw_data.get("phases", [])

        if not raw_phases:
            raise ValueError(f"YAML文件中没有定义烧成阶段: {file_path}")

        phases: List[CurvePhase] = []
        current_time = 0.0

        for phase_data in raw_phases:
            phase_type = self._parse_phase_type(phase_data.get("type", "heating"))
            duration = phase_data.get("duration", 0)

            if isinstance(duration, str):
                duration = self._parse_duration_string(duration)

            phase = CurvePhase(
                name=phase_data.get("name", f"阶段{len(phases) + 1}"),
                phase_type=phase_type,
                start_temp=float(phase_data.get("start_temp", 0)),
                end_temp=float(phase_data.get("end_temp", 0)),
                start_time=current_time,
                duration=float(duration),
                target_rate=phase_data.get("rate"),
                notes=phase_data.get("notes"),
            )

            if phase.target_rate is None and phase.phase_type in [
                PhaseType.HEATING,
                PhaseType.COOLING,
            ]:
                temp_diff = abs(phase.end_temp - phase.start_temp)
                if duration > 0:
                    phase.target_rate = temp_diff / (duration / 60)

            phases.append(phase)
            current_time += duration

        total_duration = sum(p.duration for p in phases)
        max_temp = max(max(p.start_temp, p.end_temp) for p in phases) if phases else 0

        return TargetCurve(
            name=name,
            description=description,
            phases=phases,
            total_duration=total_duration,
            max_temp=max_temp,
        )

    def _parse_phase_type(self, type_str: str) -> PhaseType:
        type_map = {
            "heating": PhaseType.HEATING,
            "升温": PhaseType.HEATING,
            "holding": PhaseType.HOLDING,
            "保温": PhaseType.HOLDING,
            "soak": PhaseType.HOLDING,
            "cooling": PhaseType.COOLING,
            "冷却": PhaseType.COOLING,
        }
        return type_map.get(type_str.lower(), PhaseType.HEATING)

    def _parse_duration_string(self, duration_str: str) -> float:
        duration_str = duration_str.strip().lower()
        total_seconds = 0.0

        if "h" in duration_str or "小时" in duration_str:
            if "h" in duration_str:
                parts = duration_str.split("h")
                hours = float(parts[0].strip())
                total_seconds += hours * 3600
                if len(parts) > 1:
                    duration_str = parts[1]
            if "小时" in duration_str:
                parts = duration_str.split("小时")
                hours = float(parts[0].strip())
                total_seconds += hours * 3600
                if len(parts) > 1:
                    duration_str = parts[1]

        if "m" in duration_str or "分钟" in duration_str:
            if "m" in duration_str:
                parts = duration_str.split("m")
                minutes = float(parts[0].strip())
                total_seconds += minutes * 60
            if "分钟" in duration_str:
                parts = duration_str.split("分钟")
                minutes = float(parts[0].strip())
                total_seconds += minutes * 60
        elif duration_str.strip().replace(".", "", 1).isdigit():
            total_seconds = float(duration_str.strip())

        return total_seconds

    def validate(self, data: Any) -> bool:
        if not isinstance(data, TargetCurve):
            return False
        if not data.phases:
            return False
        return True
