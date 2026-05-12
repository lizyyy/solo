import csv
import json
from datetime import datetime
from pathlib import Path
from typing import List, Tuple, Any, Dict
from dateutil import parser as date_parser

from .models import (
    Sample,
    Box,
    HandoverRecord,
    TemperatureRecord,
    TemperatureUnit,
)


class BaseImporter:
    @staticmethod
    def parse_datetime(value: Any) -> datetime:
        if isinstance(value, datetime):
            return value
        if isinstance(value, str):
            return date_parser.parse(value)
        raise ValueError(f"无法解析日期时间: {value}")

    @staticmethod
    def detect_format(file_path: Path) -> str:
        ext = file_path.suffix.lower()
        if ext == ".json":
            return "json"
        if ext == ".csv":
            return "csv"
        raise ValueError(f"不支持的文件格式: {ext}")


class SampleImporter(BaseImporter):
    @staticmethod
    def import_file(file_path: Path, source_file_name: str) -> Tuple[List[Sample], List[str]]:
        samples: List[Sample] = []
        errors: List[str] = []
        fmt = SampleImporter.detect_format(file_path)

        if fmt == "json":
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            items = data if isinstance(data, list) else data.get("samples", [])
        else:
            items = []
            with open(file_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    items.append(row)

        for idx, item in enumerate(items, start=1):
            try:
                sample_id = item.get("sample_id") or item.get("样本编号")
                box_id = item.get("box_id") or item.get("箱号")
                sample_type = item.get("sample_type") or item.get("样本类型", "未知")
                collection_time_str = item.get("collection_time") or item.get("采集时间")

                if not sample_id:
                    errors.append(f"第 {idx} 行缺少样本编号")
                    continue
                if not box_id:
                    errors.append(f"样本 {sample_id} 缺少箱号")
                    continue
                if not collection_time_str:
                    errors.append(f"样本 {sample_id} 缺少采集时间")
                    continue

                collection_time = SampleImporter.parse_datetime(collection_time_str)

                min_temp = float(item.get("min_temp", -20.0) or item.get("最低温度", -20.0))
                max_temp = float(item.get("max_temp", 8.0) or item.get("最高温度", 8.0))

                sample = Sample(
                    sample_id=str(sample_id),
                    box_id=str(box_id),
                    sample_type=str(sample_type),
                    collection_time=collection_time,
                    expected_temperature_min=min_temp,
                    expected_temperature_max=max_temp,
                )
                samples.append(sample)
            except Exception as e:
                errors.append(f"解析第 {idx} 行失败: {str(e)}")

        return samples, errors


class BoxImporter(BaseImporter):
    @staticmethod
    def import_file(file_path: Path) -> Tuple[List[Box], List[str]]:
        boxes: List[Box] = []
        errors: List[str] = []
        fmt = BoxImporter.detect_format(file_path)

        if fmt == "json":
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            items = data if isinstance(data, list) else data.get("boxes", [])
        else:
            items = []
            with open(file_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    items.append(row)

        for idx, item in enumerate(items, start=1):
            try:
                box_id = item.get("box_id") or item.get("箱号")
                box_type = item.get("box_type") or item.get("箱型", "冷链箱")

                if not box_id:
                    errors.append(f"第 {idx} 行缺少箱号")
                    continue

                box = Box(
                    box_id=str(box_id),
                    box_type=str(box_type),
                )
                boxes.append(box)
            except Exception as e:
                errors.append(f"解析第 {idx} 行失败: {str(e)}")

        return boxes, errors


class HandoverImporter(BaseImporter):
    @staticmethod
    def import_file(file_path: Path) -> Tuple[List[HandoverRecord], List[str]]:
        records: List[HandoverRecord] = []
        errors: List[str] = []
        fmt = HandoverImporter.detect_format(file_path)

        if fmt == "json":
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            items = data if isinstance(data, list) else data.get("handovers", [])
        else:
            items = []
            with open(file_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    items.append(row)

        for idx, item in enumerate(items, start=1):
            try:
                box_id = item.get("box_id") or item.get("箱号")
                from_person = item.get("from_person") or item.get("交出人")
                to_person = item.get("to_person") or item.get("接收人")
                handover_time_str = item.get("handover_time") or item.get("交接时间")
                location = item.get("location") or item.get("地点", "未知")
                signed_str = item.get("signed") or item.get("已签字", "false")

                if not box_id:
                    errors.append(f"第 {idx} 行缺少箱号")
                    continue
                if not from_person:
                    errors.append(f"第 {idx} 行缺少交出人")
                    continue
                if not to_person:
                    errors.append(f"第 {idx} 行缺少接收人")
                    continue
                if not handover_time_str:
                    errors.append(f"第 {idx} 行缺少交接时间")
                    continue

                handover_time = HandoverImporter.parse_datetime(handover_time_str)
                signed = str(signed_str).lower() in ("true", "1", "是", "yes", "y")

                record = HandoverRecord(
                    box_id=str(box_id),
                    from_person=str(from_person),
                    to_person=str(to_person),
                    handover_time=handover_time,
                    location=str(location),
                    signed=signed,
                )
                records.append(record)
            except Exception as e:
                errors.append(f"解析第 {idx} 行失败: {str(e)}")

        return records, errors


class TemperatureImporter(BaseImporter):
    @staticmethod
    def import_file(file_path: Path) -> Tuple[List[TemperatureRecord], List[str]]:
        records: List[TemperatureRecord] = []
        errors: List[str] = []
        fmt = TemperatureImporter.detect_format(file_path)

        if fmt == "json":
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            items = data if isinstance(data, list) else data.get("temperatures", [])
        else:
            items = []
            with open(file_path, "r", encoding="utf-8-sig") as f:
                reader = csv.DictReader(f)
                for row in reader:
                    items.append(row)

        for idx, item in enumerate(items, start=1):
            try:
                box_id = item.get("box_id") or item.get("箱号")
                timestamp_str = item.get("timestamp") or item.get("时间")
                temperature_str = item.get("temperature") or item.get("温度")
                unit_str = item.get("unit") or item.get("单位", "C")
                device_id = item.get("device_id") or item.get("设备ID")

                if not box_id:
                    errors.append(f"第 {idx} 行缺少箱号")
                    continue
                if not timestamp_str:
                    errors.append(f"第 {idx} 行缺少时间")
                    continue
                if not temperature_str:
                    errors.append(f"第 {idx} 行缺少温度")
                    continue

                timestamp = TemperatureImporter.parse_datetime(timestamp_str)
                temperature = float(temperature_str)

                unit_str_clean = str(unit_str).strip().upper()
                if unit_str_clean in ("C", "CELSIUS", "摄氏度"):
                    unit = TemperatureUnit.CELSIUS
                elif unit_str_clean in ("F", "FAHRENHEIT", "华氏度"):
                    unit = TemperatureUnit.FAHRENHEIT
                else:
                    errors.append(f"第 {idx} 行单位不识别: {unit_str}，默认使用摄氏度")
                    unit = TemperatureUnit.CELSIUS

                record = TemperatureRecord(
                    box_id=str(box_id),
                    timestamp=timestamp,
                    temperature=temperature,
                    unit=unit,
                    device_id=str(device_id) if device_id else None,
                    source_file=str(file_path.name),
                )
                records.append(record)
            except Exception as e:
                errors.append(f"解析第 {idx} 行失败: {str(e)}")

        return records, errors
