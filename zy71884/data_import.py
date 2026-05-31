import json
import csv
import os
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

from storage import create_batch, add_sensor_log, batch_exists, get_batch


REQUIRED_COLUMNS = ["timestamp", "position", "amplitude", "phase"]


def parse_csv(file_path: str) -> List[Dict[str, Any]]:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"文件不存在: {file_path}")

    data = []
    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)

        if reader.fieldnames:
            actual_cols = [c.strip().lower() for c in reader.fieldnames]
            for req in REQUIRED_COLUMNS:
                if req not in actual_cols:
                    raise ValueError(
                        f"CSV缺少必需列: {req}。现有列: {reader.fieldnames}"
                    )

        for row_num, row in enumerate(reader, start=2):
            parsed = {}
            try:
                parsed["timestamp"] = float(row["timestamp"])
                parsed["position"] = float(row["position"])
                parsed["amplitude"] = float(row["amplitude"])
                parsed["phase"] = float(row["phase"])
            except (KeyError, ValueError) as e:
                raise ValueError(f"CSV第{row_num}行解析失败: {e}")

            for extra_col in row:
                if extra_col.lower() not in REQUIRED_COLUMNS:
                    parsed[extra_col] = row[extra_col]

            data.append(parsed)

    return data


def parse_json(file_path: str) -> List[Dict[str, Any]]:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"文件不存在: {file_path}")

    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, dict) and "data" in data:
        data = data["data"]

    if not isinstance(data, list):
        raise ValueError("JSON数据格式错误，应为列表形式")

    for i, item in enumerate(data):
        for req in REQUIRED_COLUMNS:
            if req not in item:
                raise ValueError(f"JSON第{i}项缺少必需字段: {req}")

    return data


def import_sensor_data(
    file_path: str,
    batch_id: str,
    material_name: str,
    student_name: str,
    student_id: str,
    experiment_date: str,
    overwrite: bool = False
) -> Tuple[str, int, bool]:
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"文件不存在: {file_path}")

    ext = os.path.splitext(file_path)[1].lower()
    if ext == ".csv":
        raw_data = parse_csv(file_path)
    elif ext in (".json", ".js"):
        raw_data = parse_json(file_path)
    else:
        raise ValueError(f"不支持的文件格式: {ext}。请使用CSV或JSON。")

    filename = os.path.basename(file_path)

    if not batch_exists(batch_id):
        create_batch(
            batch_id=batch_id,
            material_name=material_name,
            student_name=student_name,
            student_id=student_id,
            experiment_date=experiment_date
        )
        is_new_batch = True
    else:
        is_new_batch = False
        if overwrite:
            pass

    batch, version, is_new_version = add_sensor_log(
        batch_id=batch_id,
        raw_data=raw_data,
        filename=filename
    )

    return filename, version, is_new_version


def generate_sample_data(
    batch_id: str,
    output_dir: str = "sample_data",
    has_unit_error: bool = False,
    has_sampling_gap: bool = False,
    has_zero_drift: bool = False
) -> str:
    os.makedirs(output_dir, exist_ok=True)

    frequency = 40000.0
    theoretical_velocity = 343.0
    wavelength = theoretical_velocity / frequency

    data = []
    timestamp = 0.0
    dt = 0.1

    for i in range(12):
        position = (i * wavelength / 2) * 1000

        if has_unit_error and i >= 3:
            position = position / 1000

        if has_zero_drift:
            position += 0.5 * 1000

        amplitude = 5.0 * abs((i % 2) - 0.5) * 2 + 0.5
        phase = (i * 180) % 360

        if has_sampling_gap and i == 5:
            timestamp += dt * 5

        data.append({
            "timestamp": round(timestamp, 2),
            "position": round(position, 4),
            "amplitude": round(amplitude, 4),
            "phase": round(phase, 2)
        })
        timestamp += dt

    filename = os.path.join(output_dir, f"{batch_id}_v1.csv")
    with open(filename, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["timestamp", "position", "amplitude", "phase"])
        writer.writeheader()
        writer.writerows(data)

    return filename
