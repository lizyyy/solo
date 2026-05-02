import csv
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Union
from datetime import datetime

import numpy as np

from ..models import (
    Speaker,
    MeasurementPoint,
    Point3D,
    ImpulseResponse,
    ClimateData,
    UnitSystem,
)


class CSVParseError(Exception):
    def __init__(self, file_path: str, line: int, message: str):
        self.file_path = file_path
        self.line = line
        self.message = message
        super().__init__(f"{file_path}:{line}: {message}")


def parse_speakers_csv(file_path: Path) -> List[Speaker]:
    speakers = []
    required_cols = {"id", "name", "x", "y", "z"}

    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = {h.lower() for h in reader.fieldnames or []}

        if not required_cols.issubset(headers):
            missing = required_cols - headers
            raise CSVParseError(
                str(file_path), 0,
                f"缺少必要列: {', '.join(missing)}。需要: id, name, x, y, z"
            )

        header_map = {h.lower(): h for h in reader.fieldnames or []}

        for row_num, row in enumerate(reader, start=2):
            try:
                speaker = Speaker(
                    id=row[header_map["id"]].strip(),
                    name=row[header_map["name"]].strip(),
                    position=Point3D(
                        x=float(row[header_map["x"]]),
                        y=float(row[header_map["y"]]),
                        z=float(row[header_map["z"]]),
                    ),
                    group=row.get(header_map.get("group", "group"), "").strip() or None,
                    channel=(
                        int(row[header_map["channel"]])
                        if header_map.get("channel") and row[header_map["channel"]]
                        else None
                    ),
                )
                speakers.append(speaker)
            except (ValueError, KeyError) as e:
                raise CSVParseError(str(file_path), row_num, f"解析行失败: {e}")

    return speakers


def parse_points_csv(file_path: Path) -> List[MeasurementPoint]:
    points = []
    required_cols = {"id", "name", "x", "y", "z"}

    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = {h.lower() for h in reader.fieldnames or []}

        if not required_cols.issubset(headers):
            missing = required_cols - headers
            raise CSVParseError(
                str(file_path), 0,
                f"缺少必要列: {', '.join(missing)}。需要: id, name, x, y, z"
            )

        header_map = {h.lower(): h for h in reader.fieldnames or []}

        for row_num, row in enumerate(reader, start=2):
            try:
                point = MeasurementPoint(
                    id=row[header_map["id"]].strip(),
                    name=row[header_map["name"]].strip(),
                    position=Point3D(
                        x=float(row[header_map["x"]]),
                        y=float(row[header_map["y"]]),
                        z=float(row[header_map["z"]]),
                    ),
                    note=row.get(header_map.get("note", "note"), "").strip() or None,
                )
                points.append(point)
            except (ValueError, KeyError) as e:
                raise CSVParseError(str(file_path), row_num, f"解析行失败: {e}")

    return points


def parse_climate_csv(file_path: Path) -> List[ClimateData]:
    climate_data = []
    required_cols = {"temperature", "humidity"}

    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        headers = {h.lower() for h in reader.fieldnames or []}

        if not required_cols.issubset(headers):
            missing = required_cols - headers
            raise CSVParseError(
                str(file_path), 0,
                f"缺少必要列: {', '.join(missing)}。需要: temperature, humidity"
            )

        header_map = {h.lower(): h for h in reader.fieldnames or []}

        for row_num, row in enumerate(reader, start=2):
            try:
                timestamp_str = row.get(header_map.get("timestamp", "timestamp"), "")
                if timestamp_str:
                    try:
                        timestamp = datetime.fromisoformat(timestamp_str)
                    except ValueError:
                        timestamp = datetime.now()
                else:
                    timestamp = datetime.now()

                temp_str = row[header_map["temperature"]].strip()
                if "c" in temp_str.lower() or "°" in temp_str:
                    temp_str = temp_str.lower().replace("c", "").replace("°", "").strip()
                temperature = float(temp_str)

                humid_str = row[header_map["humidity"]].strip()
                if "%" in humid_str:
                    humid_str = humid_str.replace("%", "").strip()
                humidity = float(humid_str)

                pressure = None
                if header_map.get("pressure"):
                    press_str = row[header_map["pressure"]].strip()
                    if "kpa" in press_str.lower():
                        press_str = press_str.lower().replace("kpa", "").strip()
                    pressure = float(press_str)

                data = ClimateData(
                    timestamp=timestamp,
                    temperature_c=temperature,
                    humidity_pct=humidity,
                    pressure_kpa=pressure,
                    note=row.get(header_map.get("note", "note"), "").strip() or None,
                )
                climate_data.append(data)
            except (ValueError, KeyError) as e:
                raise CSVParseError(str(file_path), row_num, f"解析行失败: {e}")

    return climate_data


def parse_impulse_response_csv(
    file_path: Path,
    speaker_id: Optional[str] = None,
    point_id: Optional[str] = None,
) -> ImpulseResponse:
    time_samples: List[float] = []
    amplitude: List[float] = []
    sample_rate: float = 48000.0
    metadata: Dict[str, Any] = {}

    with open(file_path, "r", encoding="utf-8-sig") as f:
        content = f.read()

    lines = content.strip().split("\n")
    data_start_idx = 0

    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue

        if line.startswith((";", "#", "//")):
            if "sample" in line.lower() and "rate" in line.lower():
                import re
                match = re.search(r"(\d+(?:\.\d+)?)\s*(?:hz|kHz|k)?", line.lower())
                if match:
                    sr = float(match.group(1))
                    if "k" in line.lower() and "khz" not in line.lower():
                        sr *= 1000
                    sample_rate = sr
            metadata[f"comment_{i}"] = line[1:].strip()
            data_start_idx = i + 1
        elif "," in line or "\t" in line:
            headers = line.lower()
            if "time" in headers or "amplitude" in headers or "sample" in headers:
                data_start_idx = i + 1
                break
            else:
                break
        else:
            try:
                float(line.split()[0] if " " in line else line)
                data_start_idx = i
                break
            except ValueError:
                data_start_idx = i + 1

    data_lines = lines[data_start_idx:]

    use_tab = False
    use_comma = False
    for line in data_lines[:5]:
        if "\t" in line:
            use_tab = True
            break
        if "," in line:
            use_comma = True
            break

    for row_num, line in enumerate(data_lines, start=data_start_idx + 1):
        line = line.strip()
        if not line or line.startswith((";", "#", "//")):
            continue

        try:
            if use_tab:
                parts = line.split("\t")
            elif use_comma:
                parts = line.split(",")
            else:
                parts = line.split()

            if len(parts) < 2:
                raise ValueError(f"需要至少2列，实际: {len(parts)}")

            time_val = float(parts[0].strip())
            amp_val = float(parts[1].strip())

            if time_val < 0:
                metadata["has_negative_time"] = True

            time_samples.append(time_val)
            amplitude.append(amp_val)

        except ValueError as e:
            raise CSVParseError(str(file_path), row_num, f"解析采样数据失败: {e}")

    if not time_samples or not amplitude:
        raise CSVParseError(str(file_path), 0, "未找到有效的脉冲响应数据")

    if len(time_samples) >= 2:
        dt = np.mean(np.diff(time_samples))
        if dt > 0:
            detected_sr = 1.0 / dt
            if abs(detected_sr - sample_rate) > sample_rate * 0.1:
                metadata["sample_rate_mismatch"] = {
                    "header_value": sample_rate,
                    "detected_value": detected_sr,
                }
                if sample_rate == 48000.0:
                    sample_rate = detected_sr

    if speaker_id is None:
        stem = file_path.stem.lower()
        import re
        spk_match = re.search(r"(?:spk|speaker|s)[_\s-]?(\w+)", stem)
        if spk_match:
            speaker_id = spk_match.group(1)
        else:
            speaker_id = file_path.stem.split("_")[0] if "_" in file_path.stem else file_path.stem

    if point_id is None:
        stem = file_path.stem.lower()
        import re
        pt_match = re.search(r"(?:pt|point|p)[_\s-]?(\w+)", stem)
        if pt_match:
            point_id = pt_match.group(1)
        elif "_" in file_path.stem:
            parts = file_path.stem.split("_")
            if len(parts) >= 2:
                point_id = parts[-1]

    return ImpulseResponse(
        speaker_id=speaker_id,
        point_id=point_id or "unknown",
        sample_rate=sample_rate,
        time_samples=time_samples,
        amplitude=amplitude,
        metadata=metadata,
    )


def parse_csv(
    file_path: Path,
    file_type: Optional[str] = None,
    **kwargs: Any,
) -> Any:
    if not file_path.exists():
        raise FileNotFoundError(f"文件不存在: {file_path}")

    if file_type is None:
        stem = file_path.stem.lower()
        if "speaker" in stem:
            file_type = "speakers"
        elif "point" in stem or "mic" in stem:
            file_type = "points"
        elif "climate" in stem or "temp" in stem or "humidity" in stem:
            file_type = "climate"
        elif "ir" in stem or "impulse" in stem or "response" in stem:
            file_type = "impulse_response"
        else:
            with open(file_path, "r", encoding="utf-8-sig") as f:
                first_line = f.readline().lower()
                if "x" in first_line and "y" in first_line and "z" in first_line:
                    if "speaker" in first_line:
                        file_type = "speakers"
                    elif "point" in first_line:
                        file_type = "points"
                    else:
                        raise ValueError(
                            f"无法自动识别文件类型: {file_path}。"
                            f"请指定 file_type 参数: speakers, points, climate, impulse_response"
                        )
                elif "temperature" in first_line or "humidity" in first_line:
                    file_type = "climate"
                else:
                    file_type = "impulse_response"

    if file_type == "speakers":
        return parse_speakers_csv(file_path)
    elif file_type == "points":
        return parse_points_csv(file_path)
    elif file_type == "climate":
        return parse_climate_csv(file_path)
    elif file_type == "impulse_response":
        return parse_impulse_response_csv(
            file_path,
            speaker_id=kwargs.get("speaker_id"),
            point_id=kwargs.get("point_id"),
        )
    else:
        raise ValueError(
            f"未知文件类型: {file_type}。"
            f"支持的类型: speakers, points, climate, impulse_response"
        )
