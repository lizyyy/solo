"""
解析校验模块 - 负责解析样本数据并进行完整性校验
"""

import csv
import hashlib
import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple, Set

from .models import (
    GeoSample,
    PackageInfo,
    ValidationResult,
    ValidationStatus,
    ConflictType,
    ConflictRecord,
)


class SampleValidator:
    REQUIRED_FIELDS = {"sample_id", "latitude", "longitude", "sample_time", "collector"}
    
    LATITUDE_RANGE = (-90.0, 90.0)
    LONGITUDE_RANGE = (-180.0, 180.0)

    def __init__(self, strict_mode: bool = True):
        self.strict_mode = strict_mode
        self.validation_results: Dict[str, ValidationResult] = {}
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def parse_package(self, package: PackageInfo) -> List[GeoSample]:
        samples = []
        path = Path(package.path)

        if package.format == "directory":
            samples = self._parse_directory_package(path, package.name)
        else:
            samples = self._parse_single_file(path, package.name)

        for sample in samples:
            sample.package_name = package.name

        return samples

    def _parse_directory_package(self, dir_path: Path, package_name: str) -> List[GeoSample]:
        samples = []

        data_files = []
        for suffix in [".csv", ".json", ".jsonl"]:
            data_files.extend(dir_path.glob(f"*{suffix}"))

        for file_path in data_files:
            try:
                file_samples = self._parse_file(file_path, package_name)
                samples.extend(file_samples)
            except Exception as e:
                self.errors.append(f"解析文件 {file_path} 失败: {str(e)}")

        return samples

    def _parse_single_file(self, file_path: Path, package_name: str) -> List[GeoSample]:
        try:
            return self._parse_file(file_path, package_name)
        except Exception as e:
            self.errors.append(f"解析文件 {file_path} 失败: {str(e)}")
            return []

    def _parse_file(self, file_path: Path, package_name: str) -> List[GeoSample]:
        suffix = file_path.suffix.lower()

        if suffix == ".csv":
            return self._parse_csv(file_path, package_name)
        elif suffix == ".json":
            return self._parse_json(file_path, package_name)
        elif suffix == ".jsonl":
            return self._parse_jsonl(file_path, package_name)
        else:
            raise ValueError(f"不支持的文件格式: {suffix}")

    def _parse_csv(self, file_path: Path, package_name: str) -> List[GeoSample]:
        samples = []

        with open(file_path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                try:
                    sample = self._dict_to_sample(row, package_name)
                    sample.hash_value = self._calculate_sample_hash(sample)
                    samples.append(sample)
                except Exception as e:
                    self.errors.append(f"CSV 第 {row_num} 行解析失败: {str(e)}")

        return samples

    def _parse_json(self, file_path: Path, package_name: str) -> List[GeoSample]:
        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        samples = []

        if isinstance(data, list):
            for i, item in enumerate(data):
                try:
                    sample = self._dict_to_sample(item, package_name)
                    sample.hash_value = self._calculate_sample_hash(sample)
                    samples.append(sample)
                except Exception as e:
                    self.errors.append(f"JSON 第 {i} 项解析失败: {str(e)}")

        elif isinstance(data, dict):
            sample_list = data.get("samples", data.get("records", [data]))
            for i, item in enumerate(sample_list):
                try:
                    sample = self._dict_to_sample(item, package_name)
                    sample.hash_value = self._calculate_sample_hash(sample)
                    samples.append(sample)
                except Exception as e:
                    self.errors.append(f"JSON 第 {i} 项解析失败: {str(e)}")

        return samples

    def _parse_jsonl(self, file_path: Path, package_name: str) -> List[GeoSample]:
        samples = []

        with open(file_path, "r", encoding="utf-8") as f:
            for line_num, line in enumerate(f, start=1):
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    sample = self._dict_to_sample(data, package_name)
                    sample.hash_value = self._calculate_sample_hash(sample)
                    samples.append(sample)
                except Exception as e:
                    self.errors.append(f"JSONL 第 {line_num} 行解析失败: {str(e)}")

        return samples

    def _dict_to_sample(self, data: Dict[str, Any], package_name: str) -> GeoSample:
        for field in self.REQUIRED_FIELDS:
            if field not in data and self.strict_mode:
                raise ValueError(f"缺少必需字段: {field}")

        sample_time = data.get("sample_time")
        if isinstance(sample_time, str):
            try:
                sample_time = datetime.fromisoformat(sample_time)
            except ValueError:
                if self.strict_mode:
                    raise ValueError(f"无效的时间格式: {sample_time}")
                sample_time = None

        create_time = data.get("create_time")
        if isinstance(create_time, str):
            try:
                create_time = datetime.fromisoformat(create_time)
            except ValueError:
                create_time = None

        modify_time = data.get("modify_time")
        if isinstance(modify_time, str):
            try:
                modify_time = datetime.fromisoformat(modify_time)
            except ValueError:
                modify_time = None

        photo_paths = data.get("photo_paths", [])
        if isinstance(photo_paths, str):
            photo_paths = [p.strip() for p in photo_paths.split(",") if p.strip()]

        latitude = data.get("latitude")
        longitude = data.get("longitude")

        try:
            latitude = float(latitude) if latitude is not None else None
        except (TypeError, ValueError):
            if self.strict_mode:
                raise ValueError(f"无效的纬度值: {latitude}")
            latitude = None

        try:
            longitude = float(longitude) if longitude is not None else None
        except (TypeError, ValueError):
            if self.strict_mode:
                raise ValueError(f"无效的经度值: {longitude}")
            longitude = None

        depth = data.get("depth")
        if depth is not None:
            try:
                depth = float(depth)
            except (TypeError, ValueError):
                depth = None

        custom_fields = {}
        for key, value in data.items():
            if key not in self.REQUIRED_FIELDS and key not in {
                "photo_paths", "rock_type", "description", "depth",
                "hash_value", "package_name", "create_time", "modify_time"
            }:
                custom_fields[key] = value

        return GeoSample(
            sample_id=str(data.get("sample_id", "")),
            latitude=latitude or 0.0,
            longitude=longitude or 0.0,
            sample_time=sample_time,
            collector=str(data.get("collector", "")),
            photo_paths=photo_paths,
            rock_type=data.get("rock_type"),
            description=data.get("description"),
            depth=depth,
            hash_value="",
            package_name=package_name,
            create_time=create_time,
            modify_time=modify_time,
            custom_fields=custom_fields,
        )

    def validate_sample(self, sample: GeoSample) -> ValidationResult:
        errors = []
        warnings = []

        if not sample.sample_id.strip():
            errors.append("样本编号不能为空")

        if sample.latitude is None or sample.latitude < self.LATITUDE_RANGE[0] or sample.latitude > self.LATITUDE_RANGE[1]:
            errors.append(f"纬度值 {sample.latitude} 超出有效范围 {self.LATITUDE_RANGE}")

        if sample.longitude is None or sample.longitude < self.LONGITUDE_RANGE[0] or sample.longitude > self.LONGITUDE_RANGE[1]:
            errors.append(f"经度值 {sample.longitude} 超出有效范围 {self.LONGITUDE_RANGE}")

        if not sample.collector.strip():
            warnings.append("采集者信息为空")

        if sample.sample_time is None:
            errors.append("采样时间不能为空")
        elif sample.sample_time > datetime.now():
            warnings.append("采样时间晚于当前时间，可能存在问题")

        if not sample.photo_paths:
            warnings.append("该样本没有关联的照片")

        if errors:
            status = ValidationStatus.INVALID
        elif warnings:
            status = ValidationStatus.WARNING
        else:
            status = ValidationStatus.VALID

        result = ValidationResult(
            sample_id=sample.sample_id,
            status=status,
            errors=errors,
            warnings=warnings,
        )

        self.validation_results[sample.sample_id] = result
        return result

    def validate_all_samples(self, samples: List[GeoSample]) -> Tuple[List[GeoSample], List[str], List[str]]:
        valid_samples = []
        all_errors = []
        all_warnings = []

        for sample in samples:
            result = self.validate_sample(sample)
            
            if result.status == ValidationStatus.INVALID:
                all_errors.extend([f"[{sample.sample_id}] {err}" for err in result.errors])
            else:
                valid_samples.append(sample)
            
            all_warnings.extend([f"[{sample.sample_id}] {warn}" for warn in result.warnings])

        self.errors = all_errors
        self.warnings = all_warnings

        return valid_samples, all_errors, all_warnings

    def _calculate_sample_hash(self, sample: GeoSample) -> str:
        hash_data = {
            "sample_id": sample.sample_id,
            "latitude": sample.latitude,
            "longitude": sample.longitude,
            "sample_time": sample.sample_time.isoformat() if sample.sample_time else None,
            "collector": sample.collector,
            "rock_type": sample.rock_type,
            "description": sample.description,
            "depth": sample.depth,
        }
        hash_str = json.dumps(hash_data, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(hash_str.encode("utf-8")).hexdigest()

    def verify_sample_hash(self, sample: GeoSample, expected_hash: str) -> bool:
        actual_hash = self._calculate_sample_hash(sample)
        return actual_hash == expected_hash

    def get_validation_results(self) -> Dict[str, ValidationResult]:
        return self.validation_results

    def get_errors(self) -> List[str]:
        return self.errors

    def get_warnings(self) -> List[str]:
        return self.warnings
