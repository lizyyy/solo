import csv
import json
from datetime import datetime
from typing import List, Dict, Tuple, Any
from models import InspectionRecord, ErrorRecord, ProcessingHistory
from mask_utils import mask_sensitive_data, setup_masked_logger

logger = setup_masked_logger(__name__)


class DataValidator:
    REQUIRED_FIELDS = ["pump_room_id", "inspection_time", "inspector_name"]
    VALID_PUMP_STATUSES = ["正常", "运行", "停止", "故障", "维修"]
    VALID_VIBRATION_LEVELS = ["正常", "轻微", "严重", "异常"]

    @classmethod
    def validate_record(cls, data: Dict, row_number: int) -> Tuple[bool, List[str], List[str]]:
        errors = []
        suggestions = []

        for field in cls.REQUIRED_FIELDS:
            if field not in data or not data[field]:
                errors.append(f"缺少必填字段: {field}")
                suggestions.append(f"请在第{row_number}行补充 '{field}' 字段的值")

        if "water_pressure" in data and data["water_pressure"]:
            try:
                pressure = float(data["water_pressure"])
                if pressure < 0 or pressure > 10:
                    errors.append(f"水压值超出合理范围: {pressure} MPa")
                    suggestions.append(f"水压值应在 0-10 MPa 范围内，当前值: {pressure}")
            except (ValueError, TypeError):
                errors.append(f"水压值格式错误: {data['water_pressure']}")
                suggestions.append(f"水压值应为数字，例如: 0.35")

        if "water_level" in data and data["water_level"]:
            try:
                level = float(data["water_level"])
                if level < -5 or level > 10:
                    errors.append(f"水位值超出合理范围: {level} m")
                    suggestions.append(f"水位值应在 -5-10 m 范围内，当前值: {level}")
            except (ValueError, TypeError):
                errors.append(f"水位值格式错误: {data['water_level']}")
                suggestions.append(f"水位值应为数字，例如: 2.5")

        if "pump_status" in data and data["pump_status"]:
            if data["pump_status"] not in cls.VALID_PUMP_STATUSES:
                errors.append(f"水泵状态值无效: {data['pump_status']}")
                suggestions.append(f"有效状态值为: {', '.join(cls.VALID_PUMP_STATUSES)}")

        if "vibration_level" in data and data["vibration_level"]:
            if data["vibration_level"] not in cls.VALID_VIBRATION_LEVELS:
                errors.append(f"振动等级无效: {data['vibration_level']}")
                suggestions.append(f"有效等级为: {', '.join(cls.VALID_VIBRATION_LEVELS)}")

        if "inspection_time" in data and data["inspection_time"]:
            try:
                if isinstance(data["inspection_time"], str):
                    datetime.fromisoformat(data["inspection_time"].replace('Z', '+00:00'))
            except ValueError:
                errors.append(f"巡检时间格式错误: {data['inspection_time']}")
                suggestions.append(f"时间格式应为 ISO 格式，例如: 2024-01-15T08:30:00")

        if "temperature" in data and data["temperature"]:
            try:
                temp = float(data["temperature"])
                if temp < -20 or temp > 80:
                    errors.append(f"温度值超出合理范围: {temp} °C")
                    suggestions.append(f"温度值应在 -20-80 °C 范围内，当前值: {temp}")
            except (ValueError, TypeError):
                errors.append(f"温度值格式错误: {data['temperature']}")
                suggestions.append(f"温度值应为数字，例如: 25.5")

        return len(errors) == 0, errors, suggestions


def parse_inspection_time(time_str: Any) -> datetime:
    if isinstance(time_str, datetime):
        return time_str
    if not time_str:
        return None
    try:
        return datetime.fromisoformat(str(time_str).replace('Z', '+00:00'))
    except ValueError:
        formats = ["%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S", "%Y-%m-%d", "%Y/%m/%d"]
        for fmt in formats:
            try:
                return datetime.strptime(str(time_str), fmt)
            except ValueError:
                continue
        return None


def safe_float(value: Any) -> float:
    if value is None or value == "":
        return None
    try:
        return float(value)
    except (ValueError, TypeError):
        return None


class DataProcessor:
    def __init__(self, db_session):
        self.db = db_session
        self.validator = DataValidator()

    def process_csv(self, file_path: str, filename: str) -> Dict:
        valid_records = []
        error_records = []
        row_number = 0

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                for row in reader:
                    row_number += 1
                    is_valid, errors, suggestions = self.validator.validate_record(row, row_number)

                    if is_valid:
                        record = self._create_inspection_record(row, filename, row_number, "csv")
                        valid_records.append(record)
                        logger.info(f"第{row_number}行记录验证通过")
                    else:
                        error_record = self._create_error_record(
                            row, filename, row_number,
                            error_type="数据验证失败",
                            error_message="; ".join(errors),
                            suggestion="\n".join(suggestions)
                        )
                        error_records.append(error_record)
                        logger.warning(f"第{row_number}行记录验证失败: {'; '.join(errors)}")

        except Exception as e:
            logger.error(f"处理CSV文件时出错: {str(e)}")
            raise

        return self._save_records(valid_records, error_records, filename, "csv")

    def process_json(self, file_path: str, filename: str) -> Dict:
        valid_records = []
        error_records = []
        row_number = 0

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            records = data if isinstance(data, list) else data.get("records", [data])

            for row in records:
                row_number += 1
                is_valid, errors, suggestions = self.validator.validate_record(row, row_number)

                if is_valid:
                    record = self._create_inspection_record(row, filename, row_number, "json")
                    valid_records.append(record)
                    logger.info(f"第{row_number}条记录验证通过")
                else:
                    error_record = self._create_error_record(
                        row, filename, row_number,
                        error_type="数据验证失败",
                        error_message="; ".join(errors),
                        suggestion="\n".join(suggestions)
                    )
                    error_records.append(error_record)
                    logger.warning(f"第{row_number}条记录验证失败: {'; '.join(errors)}")

        except Exception as e:
            logger.error(f"处理JSON文件时出错: {str(e)}")
            raise

        return self._save_records(valid_records, error_records, filename, "json")

    def _create_inspection_record(self, row: Dict, filename: str, row_number: int, record_type: str) -> InspectionRecord:
        return InspectionRecord(
            record_type=record_type,
            source_file=filename,
            row_number=row_number,
            pump_room_id=row.get("pump_room_id"),
            inspection_time=parse_inspection_time(row.get("inspection_time")),
            inspector_name=row.get("inspector_name"),
            inspector_phone=row.get("inspector_phone"),
            water_pressure=safe_float(row.get("water_pressure")),
            water_level=safe_float(row.get("water_level")),
            pump_status=row.get("pump_status"),
            temperature=safe_float(row.get("temperature")),
            vibration_level=row.get("vibration_level"),
            remarks=row.get("remarks"),
            is_valid=True,
            raw_data=row
        )

    def _create_error_record(self, row: Dict, filename: str, row_number: int,
                             error_type: str, error_message: str, suggestion: str) -> ErrorRecord:
        return ErrorRecord(
            source_file=filename,
            row_number=row_number,
            error_type=error_type,
            error_message=error_message,
            suggestion=suggestion,
            raw_data=row
        )

    def _save_records(self, valid_records: List[InspectionRecord], error_records: List[ErrorRecord],
                      filename: str, file_type: str) -> Dict:
        for record in valid_records:
            self.db.add(record)

        for error in error_records:
            self.db.add(error)

        history = ProcessingHistory(
            file_name=filename,
            file_type=file_type,
            total_records=len(valid_records) + len(error_records),
            valid_records=len(valid_records),
            invalid_records=len(error_records),
            status="completed"
        )
        self.db.add(history)
        self.db.commit()

        return {
            "total_records": len(valid_records) + len(error_records),
            "valid_records": len(valid_records),
            "invalid_records": len(error_records),
            "history_id": history.id
        }
