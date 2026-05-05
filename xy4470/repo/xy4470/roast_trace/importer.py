"""数据导入模块 - 支持CSV和JSON格式"""
import csv
import json
from pathlib import Path
from typing import Any, Callable, TypeVar

from pydantic import BaseModel

from roast_trace.models import (
    CuppingRecord,
    GreenBeanBatch,
    PackagingLabel,
    RoastLog,
    ShipmentRecord,
)

T = TypeVar("T", bound=BaseModel)


class ImportResult:
    def __init__(self):
        self.success: list[Any] = []
        self.errors: list[tuple[int, str, str]] = []
        self.warnings: list[tuple[int, str]] = []

    @property
    def has_errors(self) -> bool:
        return len(self.errors) > 0

    @property
    def total(self) -> int:
        return len(self.success) + len(self.errors)


def parse_csv_value(value: str, field_type: type) -> Any:
    value = value.strip()
    if not value:
        return None
    if field_type == bool:
        return value.lower() in ("true", "1", "yes")
    if field_type == int:
        return int(value)
    if field_type == float:
        return float(value)
    if field_type == list:
        if value.startswith("[") and value.endswith("]"):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                pass
        return [item.strip() for item in value.split(",") if item.strip()]
    if field_type == dict:
        if value.startswith("{") and value.endswith("}"):
            try:
                return json.loads(value)
            except json.JSONDecodeError:
                pass
        return {}
    return value


def import_from_csv(file_path: Path, model_cls: type[T]) -> ImportResult:
    result = ImportResult()
    model_fields = model_cls.model_fields

    with open(file_path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row_num, row in enumerate(reader, start=2):
            try:
                parsed_data: dict[str, Any] = {}
                for field_name, field_info in model_fields.items():
                    csv_field_name = field_name
                    if csv_field_name in row:
                        value = row[csv_field_name]
                        field_type = field_info.annotation
                        if hasattr(field_type, "__name__") and field_type.__name__ == "Optional":
                            args = getattr(field_type, "__args__", None)
                            if args:
                                field_type = args[0]
                        parsed_value = parse_csv_value(value, field_type)
                        if parsed_value is not None:
                            parsed_data[field_name] = parsed_value
                instance = model_cls(**parsed_data)
                result.success.append(instance)
            except Exception as e:
                result.errors.append((row_num, str(e), json.dumps(row, ensure_ascii=False)))
    return result


def import_from_json(file_path: Path, model_cls: type[T]) -> ImportResult:
    result = ImportResult()
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, list):
        for idx, item in enumerate(data):
            try:
                instance = model_cls(**item)
                result.success.append(instance)
            except Exception as e:
                result.errors.append((idx + 1, str(e), json.dumps(item, ensure_ascii=False)))
    else:
        try:
            instance = model_cls(**data)
            result.success.append(instance)
        except Exception as e:
            result.errors.append((1, str(e), json.dumps(data, ensure_ascii=False)))

    return result


def auto_import(file_path: Path, model_cls: type[T]) -> ImportResult:
    ext = file_path.suffix.lower()
    if ext == ".csv":
        return import_from_csv(file_path, model_cls)
    elif ext == ".json":
        return import_from_json(file_path, model_cls)
    else:
        raise ValueError(f"不支持的文件格式: {ext}")


def import_green_batches(file_path: Path) -> ImportResult:
    return auto_import(file_path, GreenBeanBatch)


def import_roast_logs(file_path: Path) -> ImportResult:
    return auto_import(file_path, RoastLog)


def import_cupping_records(file_path: Path) -> ImportResult:
    return auto_import(file_path, CuppingRecord)


def import_packaging_labels(file_path: Path) -> ImportResult:
    return auto_import(file_path, PackagingLabel)


def import_shipment_records(file_path: Path) -> ImportResult:
    return auto_import(file_path, ShipmentRecord)


IMPORT_DISPATCH: dict[str, Callable[[Path], ImportResult]] = {
    "green_batch": import_green_batches,
    "roast_log": import_roast_logs,
    "cupping": import_cupping_records,
    "label": import_packaging_labels,
    "shipment": import_shipment_records,
}
