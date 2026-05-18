import pandas as pd
import math
from typing import List, Tuple, Dict, Any
from datetime import datetime
from .models import InspectionRecord, DefectType, RiskLevel


class InspectionParser:
    REQUIRED_COLUMNS = ["日期", "设备编号", "检查项", "班组", "缺项类型", "是否完成"]

    def __init__(self):
        self.errors: List[str] = []
        self.warnings: List[str] = []

    def _safe_str(self, value) -> str:
        if pd.isna(value) or value is None:
            return ""
        if isinstance(value, float) and math.isnan(value):
            return ""
        return str(value).strip()

    def parse_excel(self, file_path: str) -> Tuple[List[InspectionRecord], List[str]]:
        self.errors = []
        self.warnings = []
        records = []

        try:
            df = pd.read_excel(file_path)
        except Exception as e:
            self.errors.append(f"读取Excel文件失败: {str(e)}")
            return [], self.errors

        missing_columns = [col for col in self.REQUIRED_COLUMNS if col not in df.columns]
        if missing_columns:
            self.errors.append(f"缺少必填列: {', '.join(missing_columns)}")
            return [], self.errors

        for idx, row in df.iterrows():
            row_num = idx + 2
            try:
                record = self._parse_row(row, row_num)
                if record:
                    validation_errors = record.validate()
                    if validation_errors:
                        for err in validation_errors:
                            self.errors.append(f"第{row_num}行: {err}")
                    else:
                        records.append(record)
            except Exception as e:
                self.errors.append(f"第{row_num}行解析失败: {str(e)}")

        return records, self.errors

    def _parse_row(self, row: pd.Series, row_num: int) -> InspectionRecord:
        date = self._parse_date(row.get("日期"))
        device_id = self._safe_str(row.get("设备编号"))
        check_item = self._safe_str(row.get("检查项"))
        team = self._safe_str(row.get("班组"))
        defect_type = self._parse_defect_type(row.get("缺项类型"))
        is_completed = self._parse_boolean(row.get("是否完成"))
        inspector = self._safe_str(row.get("巡检人")) or None
        remark = self._safe_str(row.get("备注")) or None

        risk_level = self._calculate_risk_level(defect_type, check_item)
        rectification_deadline = self._calculate_deadline(date, risk_level)
        rectification_person = self._safe_str(row.get("整改负责人")) or None
        is_rectified = self._parse_boolean(row.get("是否整改"), default=False)

        return InspectionRecord(
            date=date,
            device_id=device_id,
            check_item=check_item,
            team=team,
            defect_type=defect_type,
            is_completed=is_completed,
            inspector=inspector,
            remark=remark,
            risk_level=risk_level,
            rectification_deadline=rectification_deadline,
            rectification_person=rectification_person,
            is_rectified=is_rectified,
        )

    def _parse_date(self, value) -> str:
        if pd.isna(value):
            return ""
        if isinstance(value, datetime):
            return value.strftime("%Y-%m-%d")
        value_str = str(value).strip()
        try:
            if "/" in value_str:
                return datetime.strptime(value_str, "%Y/%m/%d").strftime("%Y-%m-%d")
            return datetime.strptime(value_str, "%Y-%m-%d").strftime("%Y-%m-%d")
        except ValueError:
            return value_str

    def _parse_defect_type(self, value) -> DefectType:
        if pd.isna(value):
            self.warnings.append(f"缺项类型为空，默认为保养项")
            return DefectType.MAINTENANCE
        value_str = str(value).strip()
        type_mapping = {
            "安全": DefectType.SAFETY,
            "安全项": DefectType.SAFETY,
            "保养": DefectType.MAINTENANCE,
            "保养项": DefectType.MAINTENANCE,
            "环境": DefectType.ENVIRONMENT,
            "环境项": DefectType.ENVIRONMENT,
            "操作": DefectType.OPERATION,
            "操作项": DefectType.OPERATION,
        }
        return type_mapping.get(value_str, DefectType.MAINTENANCE)

    def _parse_boolean(self, value, default: bool = True) -> bool:
        if pd.isna(value):
            return default
        value_str = str(value).strip().lower()
        return value_str in ["是", "yes", "true", "1", "完成", "已完成"]

    def _calculate_risk_level(self, defect_type: DefectType, check_item: str) -> RiskLevel:
        high_risk_keywords = ["高压", "高空", "动火", "有毒", "爆炸", "消防", "电气安全", "漏电", "瓦斯"]
        medium_risk_keywords = ["机械", "防护", "防护栏", "防护罩", "警示"]

        if defect_type == DefectType.SAFETY:
            if any(keyword in check_item for keyword in high_risk_keywords):
                return RiskLevel.HIGH
            if any(keyword in check_item for keyword in medium_risk_keywords):
                return RiskLevel.MEDIUM
            return RiskLevel.MEDIUM

        if defect_type == DefectType.MAINTENANCE:
            return RiskLevel.LOW

        return RiskLevel.LOW

    def _calculate_deadline(self, date_str: str, risk_level: RiskLevel) -> str:
        if not date_str:
            return ""
        try:
            date = datetime.strptime(date_str, "%Y-%m-%d")
            days_map = {RiskLevel.HIGH: 1, RiskLevel.MEDIUM: 3, RiskLevel.LOW: 7}
            deadline = date + pd.Timedelta(days=days_map[risk_level])
            return deadline.strftime("%Y-%m-%d")
        except Exception:
            return ""
