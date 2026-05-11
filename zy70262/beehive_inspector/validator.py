"""数据验证工具类"""
from datetime import datetime
from typing import List, Dict, Any, Tuple
import re


class DataValidator:
    REQUIRED_INSPECTION_FIELDS = [
        "beehive_id",
        "inspection_date",
        "queen_status",
        "honey_level",
        "diseases",
    ]

    VALID_QUEEN_STATUS = ["活跃", "待观察", "失踪", "更换", "新王"]
    VALID_HONEY_LEVELS = ["低", "中", "高", "充足"]

    @staticmethod
    def validate_inspection_record(record: Dict[str, Any], row_num: int) -> List[Dict[str, Any]]:
        errors = []
        warnings = []

        for field in DataValidator.REQUIRED_INSPECTION_FIELDS:
            if field not in record or record[field] is None or str(record[field]).strip() == "":
                errors.append({
                    "row": row_num,
                    "type": "missing_field",
                    "field": field,
                    "message": f"缺少必填字段: {field}",
                })

        if "queen_status" in record and record["queen_status"]:
            if record["queen_status"] not in DataValidator.VALID_QUEEN_STATUS:
                warnings.append({
                    "row": row_num,
                    "type": "invalid_queen_status",
                    "field": "queen_status",
                    "value": record["queen_status"],
                    "message": f"蜂王状态异常: {record['queen_status']}，有效值: {DataValidator.VALID_QUEEN_STATUS}",
                })

        if "honey_level" in record and record["honey_level"]:
            if str(record["honey_level"]) not in DataValidator.VALID_HONEY_LEVELS:
                try:
                    honey_val = float(record["honey_level"])
                    if honey_val < 0 or honey_val > 100:
                        warnings.append({
                            "row": row_num,
                            "type": "invalid_honey_level",
                            "field": "honey_level",
                            "value": record["honey_level"],
                            "message": f"蜜量值异常: {record['honey_level']}，应在 0-100 之间",
                        })
                except (ValueError, TypeError):
                    warnings.append({
                        "row": row_num,
                        "type": "invalid_honey_level",
                        "field": "honey_level",
                        "value": record["honey_level"],
                        "message": f"蜜量格式异常: {record['honey_level']}",
                    })

        if "inspection_date" in record and record["inspection_date"]:
            try:
                datetime.strptime(str(record["inspection_date"]), "%Y-%m-%d")
            except ValueError:
                try:
                    datetime.strptime(str(record["inspection_date"]), "%Y/%m/%d")
                except ValueError:
                    errors.append({
                        "row": row_num,
                        "type": "invalid_date",
                        "field": "inspection_date",
                        "value": record["inspection_date"],
                        "message": f"日期格式异常: {record['inspection_date']}，应为 YYYY-MM-DD",
                    })

        return errors, warnings

    @staticmethod
    def check_duplicates(records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        duplicates = []
        seen = {}

        for idx, record in enumerate(records):
            row_num = idx + 2
            key_parts = [
                str(record.get("beehive_id", "")),
                str(record.get("inspection_date", "")),
            ]
            key = "|".join(key_parts)

            if key in seen:
                duplicates.append({
                    "row": row_num,
                    "duplicate_of_row": seen[key]["row_num"],
                    "beehive_id": record.get("beehive_id"),
                    "inspection_date": record.get("inspection_date"),
                    "message": f"发现重复记录: 蜂箱 {record.get('beehive_id')} 在 {record.get('inspection_date')} 的巡检已存在",
                })
            else:
                seen[key] = {"row_num": row_num, "record": record}

        return duplicates

    @staticmethod
    def validate_swap_record(record: Dict[str, Any], row_num: int) -> List[Dict[str, Any]]:
        errors = []
        warnings = []

        required_fields = ["from_beehive_id", "to_beehive_id", "swap_date", "reason"]
        for field in required_fields:
            if field not in record or record[field] is None or str(record[field]).strip() == "":
                errors.append({
                    "row": row_num,
                    "type": "missing_field",
                    "field": field,
                    "message": f"换箱记录缺少必填字段: {field}",
                })

        if "from_beehive_id" in record and "to_beehive_id" in record:
            if record["from_beehive_id"] == record["to_beehive_id"]:
                errors.append({
                    "row": row_num,
                    "type": "same_hive_swap",
                    "message": "换箱记录的源蜂箱和目标蜂箱不能相同",
                })

        return errors, warnings
