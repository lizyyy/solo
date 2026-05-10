from __future__ import annotations

import csv
import json
import os
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

from .models import RoastBatch, TemperaturePoint


class ImportError(Exception):
    """导入错误"""
    pass


class CurveImporter:
    """烘焙曲线导入器"""

    SUPPORTED_FORMATS = {".csv", ".json"}

    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def import_file(self, file_path: str) -> RoastBatch:
        """导入单个烘焙曲线文件"""
        self.errors = []
        self.warnings = []

        path = Path(file_path)
        if not path.exists():
            raise ImportError(f"文件不存在: {file_path}")

        suffix = path.suffix.lower()
        if suffix not in self.SUPPORTED_FORMATS:
            raise ImportError(
                f"不支持的文件格式: {suffix}。支持的格式: {self.SUPPORTED_FORMATS}"
            )

        try:
            if suffix == ".csv":
                return self._import_csv(path)
            else:
                return self._import_json(path)
        except ImportError:
            raise
        except Exception as e:
            raise ImportError(f"导入文件失败: {str(e)}") from e

    def import_directory(self, dir_path: str) -> List[RoastBatch]:
        """导入目录下的所有烘焙曲线文件"""
        self.errors = []
        self.warnings = []

        path = Path(dir_path)
        if not path.exists() or not path.is_dir():
            raise ImportError(f"目录不存在或不是目录: {dir_path}")

        batches: List[RoastBatch] = []
        for file_path in sorted(path.iterdir()):
            if file_path.suffix.lower() in self.SUPPORTED_FORMATS:
                try:
                    batch = self.import_file(str(file_path))
                    batches.append(batch)
                except ImportError as e:
                    self.errors.append(f"{file_path.name}: {str(e)}")

        if not batches:
            self.warnings.append(f"目录中没有找到有效的烘焙曲线文件: {dir_path}")

        return batches

    def _import_csv(self, path: Path) -> RoastBatch:
        """从 CSV 文件导入"""
        metadata, curve_data = self._parse_csv_file(path)
        return self._build_batch_from_data(path.stem, metadata, curve_data)

    def _import_json(self, path: Path) -> RoastBatch:
        """从 JSON 文件导入"""
        try:
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            raise ImportError(f"JSON 解析错误: {str(e)}") from e

        return self._parse_json_structure(path.stem, data)

    def _parse_csv_file(self, path: Path) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        """解析 CSV 文件，分离元数据和曲线数据"""
        metadata: Dict[str, Any] = {}
        curve_data: List[Dict[str, Any]] = []
        curve_started = False
        headers: List[str] = []

        with open(path, "r", encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            for row in reader:
                if not row or all(cell.strip() == "" for cell in row):
                    continue

                if not curve_started:
                    if self._is_curve_header(row):
                        headers = [h.strip().lower() for h in row]
                        curve_started = True
                        continue
                    else:
                        self._parse_metadata_row(row, metadata)
                else:
                    curve_point = self._parse_curve_row(headers, row)
                    if curve_point:
                        curve_data.append(curve_point)

        if not curve_data:
            raise ImportError("CSV 文件中没有找到有效的温度曲线数据")

        return metadata, curve_data

    def _is_curve_header(self, row: List[str]) -> bool:
        """判断一行是否是曲线数据的表头"""
        row_lower = [cell.strip().lower() for cell in row]
        time_keywords = {"time", "时间", "sec", "seconds", "minute", "min"}
        temp_keywords = {"temp", "温度", "bean", "豆温"}

        has_time = any(k in " ".join(row_lower) for k in time_keywords)
        has_temp = any(k in " ".join(row_lower) for k in temp_keywords)

        return has_time and has_temp

    def _parse_metadata_row(self, row: List[str], metadata: Dict[str, Any]):
        """解析元数据行"""
        if len(row) >= 2:
            key = row[0].strip().lower()
            value = row[1].strip()
            if key and value:
                metadata[key] = value

    def _parse_curve_row(self, headers: List[str], row: List[str]) -> Optional[Dict[str, Any]]:
        """解析曲线数据行"""
        if len(row) < len(headers):
            return None

        point: Dict[str, Any] = {}
        for header, value in zip(headers, row):
            value = value.strip()
            if not value:
                continue
            point[header] = value

        time_val = self._extract_time(point)
        bean_temp = self._extract_temperature(point, ["bean", "豆温", "温度", "temp"])

        if time_val is None or bean_temp is None:
            return None

        exhaust_temp = self._extract_temperature(point, ["exhaust", "排气", "air", "环境"])

        return {
            "time_seconds": time_val,
            "bean_temp": bean_temp,
            "exhaust_temp": exhaust_temp,
        }

    def _extract_time(self, point: Dict[str, Any]) -> Optional[float]:
        """从数据点提取时间（秒）"""
        for key, value in point.items():
            key_lower = key.lower()
            if "time" in key_lower or "时间" in key:
                return self._parse_time_value(value)
        return None

    def _parse_time_value(self, value: Any) -> Optional[float]:
        """解析时间值，支持秒数或 MM:SS 格式"""
        if isinstance(value, (int, float)):
            return float(value)

        value_str = str(value).strip()
        if ":" in value_str:
            parts = value_str.split(":")
            if len(parts) == 2:
                try:
                    minutes = float(parts[0])
                    seconds = float(parts[1])
                    return minutes * 60 + seconds
                except ValueError:
                    pass
            elif len(parts) == 3:
                try:
                    hours = float(parts[0])
                    minutes = float(parts[1])
                    seconds = float(parts[2])
                    return hours * 3600 + minutes * 60 + seconds
                except ValueError:
                    pass

        try:
            return float(value_str)
        except ValueError:
            return None

    def _extract_temperature(self, point: Dict[str, Any], keywords: List[str]) -> Optional[float]:
        """从数据点提取温度"""
        for key, value in point.items():
            key_lower = key.lower()
            if any(k.lower() in key_lower for k in keywords):
                try:
                    temp_str = str(value).strip()
                    if "°" in temp_str:
                        temp_str = temp_str.split("°")[0].strip()
                    if "c" in temp_str.lower():
                        temp_str = temp_str.lower().split("c")[0].strip()
                    return float(temp_str)
                except ValueError:
                    continue
        return None

    def _parse_json_structure(self, batch_id: str, data: Dict[str, Any]) -> RoastBatch:
        """解析 JSON 结构"""
        if "batch_id" in data:
            batch_id = data["batch_id"]

        coffee_name = data.get("coffee_name", data.get("name", batch_id))

        roast_date_str = data.get("roast_date")
        if roast_date_str:
            try:
                roast_date = datetime.fromisoformat(roast_date_str)
            except ValueError:
                roast_date = datetime.now()
                self.warnings.append(f"无法解析烘焙日期，使用当前时间: {roast_date_str}")
        else:
            roast_date = datetime.now()

        curve_data = data.get("curve_points", data.get("curve", []))
        curve_points = []
        for point in curve_data:
            if isinstance(point, dict):
                time_val = point.get("time_seconds", point.get("time"))
                bean_temp = point.get("bean_temp", point.get("temperature", point.get("temp")))

                if time_val is not None and bean_temp is not None:
                    curve_points.append(
                        TemperaturePoint(
                            time_seconds=float(time_val),
                            bean_temp=float(bean_temp),
                            exhaust_temp=point.get("exhaust_temp"),
                        )
                    )

        first_crack_data = data.get("first_crack")
        first_crack = None
        if first_crack_data:
            from .models import FirstCrackInfo, FirstCrackType

            crack_type_str = first_crack_data.get("crack_type", "normal")
            try:
                crack_type = FirstCrackType(crack_type_str)
            except ValueError:
                crack_type = FirstCrackType.NORMAL

            first_crack = FirstCrackInfo(
                start_time_seconds=first_crack_data.get("start_time_seconds", 0),
                start_temp=first_crack_data.get("start_temp", 190),
                end_time_seconds=first_crack_data.get("end_time_seconds"),
                end_temp=first_crack_data.get("end_temp"),
                intensity=first_crack_data.get("intensity", "medium"),
                crack_type=crack_type,
                notes=first_crack_data.get("notes"),
            )

        cup_score_data = data.get("cup_score")
        cup_score = None
        if cup_score_data:
            from .models import CupScore

            cup_score = CupScore(
                aroma=cup_score_data.get("aroma", 7.0),
                flavor=cup_score_data.get("flavor", 7.0),
                aftertaste=cup_score_data.get("aftertaste", 7.0),
                acidity=cup_score_data.get("acidity", 7.0),
                body=cup_score_data.get("body", 7.0),
                balance=cup_score_data.get("balance", 7.0),
                uniformity=cup_score_data.get("uniformity", 7.0),
                overall=cup_score_data.get("overall", 7.0),
                defects=cup_score_data.get("defects", 0),
            )

        return RoastBatch(
            batch_id=batch_id,
            coffee_name=coffee_name,
            origin=data.get("origin"),
            process_method=data.get("process_method"),
            green_weight_g=float(data.get("green_weight_g", 300)),
            roasted_weight_g=data.get("roasted_weight_g"),
            roast_date=roast_date,
            curve_points=curve_points,
            first_crack=first_crack,
            cup_score=cup_score,
            roast_notes=data.get("roast_notes"),
            metadata=data.get("metadata", {}),
        )

    def _build_batch_from_data(
        self,
        batch_id: str,
        metadata: Dict[str, Any],
        curve_data: List[Dict[str, Any]],
    ) -> RoastBatch:
        """从元数据和曲线数据构建烘焙批次"""
        curve_points = [
            TemperaturePoint(
                time_seconds=p["time_seconds"],
                bean_temp=p["bean_temp"],
                exhaust_temp=p.get("exhaust_temp"),
            )
            for p in curve_data
        ]

        coffee_name = str(metadata.get("coffee_name", metadata.get("coffee", batch_id)))
        origin = metadata.get("origin")
        process_method = metadata.get("process_method", metadata.get("process"))

        green_weight = self._parse_float(metadata.get("green_weight_g", metadata.get("green_weight", "300")))
        roasted_weight = self._parse_float(metadata.get("roasted_weight_g", metadata.get("roasted_weight")))

        roast_date_str = metadata.get("roast_date", metadata.get("date"))
        if roast_date_str:
            try:
                roast_date = datetime.fromisoformat(str(roast_date_str))
            except ValueError:
                roast_date = datetime.now()
        else:
            roast_date = datetime.now()

        return RoastBatch(
            batch_id=batch_id,
            coffee_name=coffee_name,
            origin=origin,
            process_method=process_method,
            green_weight_g=green_weight if green_weight is not None else 300.0,
            roasted_weight_g=roasted_weight,
            roast_date=roast_date,
            curve_points=curve_points,
            first_crack=None,
            cup_score=None,
            roast_notes=metadata.get("roast_notes", metadata.get("notes")),
            metadata={k: v for k, v in metadata.items() if k not in {
                "coffee_name", "coffee", "origin", "process_method", "process",
                "green_weight_g", "green_weight", "roasted_weight_g", "roasted_weight",
                "roast_date", "date", "roast_notes", "notes"
            }},
        )

    @staticmethod
    def _parse_float(value: Any) -> Optional[float]:
        """安全解析浮点数"""
        if value is None:
            return None
        try:
            return float(str(value).strip())
        except (ValueError, TypeError):
            return None
