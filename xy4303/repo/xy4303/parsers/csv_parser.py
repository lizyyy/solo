import csv
import re
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime, date
from pathlib import Path
from typing import List, Optional, Dict, Any, Union

from models.order import Order
from models.patient import Patient
from models.processing_status import ProcessingStatus, ReworkRecord
from models.enums import OrderStatus


@dataclass
class ParseResult:
    success: bool = True
    data: List[Any] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)


class BaseCSVParser(ABC):
    REQUIRED_COLUMNS: List[str] = []

    def __init__(self, encoding: str = "utf-8"):
        self.encoding = encoding

    @abstractmethod
    def parse_row(self, row: Dict[str, str], row_num: int) -> Optional[Any]:
        pass

    def parse(self, file_path: Union[str, Path]) -> ParseResult:
        file_path = Path(file_path)
        result = ParseResult()

        if not file_path.exists():
            result.success = False
            result.errors.append(f"文件不存在: {file_path}")
            return result

        try:
            with open(file_path, "r", encoding=self.encoding, newline="") as f:
                content = f.read()
                if content.startswith("\ufeff"):
                    content = content[1:]

            lines = content.splitlines()
            if not lines:
                result.success = False
                result.errors.append("文件为空")
                return result

            dialect = csv.Sniffer().sniff(lines[0]) if len(lines) > 0 else csv.excel
            reader = csv.DictReader(lines, dialect=dialect)

            if self.REQUIRED_COLUMNS:
                missing_cols = set(self.REQUIRED_COLUMNS) - set(reader.fieldnames or [])
                if missing_cols:
                    result.success = False
                    result.errors.append(f"缺少必需列: {', '.join(missing_cols)}")
                    return result

            for row_num, row in enumerate(reader, start=2):
                try:
                    item = self.parse_row(row, row_num)
                    if item:
                        result.data.append(item)
                except Exception as e:
                    result.warnings.append(f"第 {row_num} 行解析失败: {str(e)}")

        except UnicodeDecodeError:
            try:
                with open(file_path, "r", encoding="gbk", newline="") as f:
                    content = f.read()
                lines = content.splitlines()
                reader = csv.DictReader(lines)

                for row_num, row in enumerate(reader, start=2):
                    try:
                        item = self.parse_row(row, row_num)
                        if item:
                            result.data.append(item)
                    except Exception as e:
                        result.warnings.append(f"第 {row_num} 行解析失败: {str(e)}")

            except Exception as e:
                result.success = False
                result.errors.append(f"文件编码错误，请检查文件格式: {str(e)}")
        except Exception as e:
            result.success = False
            result.errors.append(f"解析失败: {str(e)}")

        return result

    def _parse_date(self, value: str) -> Optional[date]:
        if not value or not value.strip():
            return None

        value = value.strip()
        formats = [
            "%Y-%m-%d",
            "%Y/%m/%d",
            "%Y.%m.%d",
            "%Y年%m月%d日",
            "%m-%d-%Y",
            "%m/%d/%Y",
            "%d-%m-%Y",
            "%d/%m/%Y",
        ]

        for fmt in formats:
            try:
                return datetime.strptime(value, fmt).date()
            except ValueError:
                continue

        match = re.match(r"(\d{4})(\d{2})(\d{2})", value)
        if match:
            try:
                return date(int(match.group(1)), int(match.group(2)), int(match.group(3)))
            except ValueError:
                pass

        return None

    def _parse_datetime(self, value: str) -> Optional[datetime]:
        if not value or not value.strip():
            return None

        value = value.strip()
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y.%m.%d %H:%M:%S",
            "%Y.%m.%d %H:%M",
        ]

        for fmt in formats:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue

        d = self._parse_date(value)
        if d:
            return datetime.combine(d, datetime.min.time())

        return None

    def _parse_bool(self, value: str) -> bool:
        if not value:
            return False
        value = str(value).strip().lower()
        return value in ["是", "yes", "true", "1", "y", "对"]

    def _parse_list(self, value: str, separator: str = None) -> List[str]:
        if not value or not value.strip():
            return []

        value = value.strip()
        if separator:
            items = value.split(separator)
        else:
            for sep in [",", "，", "、", ";", "；", " "]:
                if sep in value:
                    items = value.split(sep)
                    break
            else:
                items = [value]

        return [item.strip() for item in items if item.strip()]


class OrderCSVParser(BaseCSVParser):
    REQUIRED_COLUMNS = ["订单编号", "模型编号", "医生姓名", "患者姓名"]

    ORDER_STATUS_MAP = {
        "待接收": OrderStatus.PENDING_RECEIVE,
        "已接收": OrderStatus.RECEIVED,
        "加工中": OrderStatus.PROCESSING,
        "待检验": OrderStatus.PENDING_INSPECTION,
        "待返工": OrderStatus.PENDING_REWORK,
        "返工中": OrderStatus.REWORKING,
        "已完成": OrderStatus.COMPLETED,
    }

    def parse_row(self, row: Dict[str, str], row_num: int) -> Optional[Order]:
        order_id = row.get("订单编号", "").strip()
        model_id = row.get("模型编号", "").strip()
        doctor_name = row.get("医生姓名", "").strip()
        patient_name = row.get("患者姓名", "").strip()

        if not model_id:
            raise ValueError(f"模型编号为空")

        if not order_id:
            order_id = model_id

        tooth_positions = self._parse_list(row.get("牙位", ""))
        is_urgent = self._parse_bool(row.get("是否加急", "否"))

        order = Order(
            order_id=order_id,
            model_id=model_id,
            doctor_name=doctor_name,
            clinic_name=row.get("诊所名称", "").strip(),
            patient_name=patient_name,
            patient_id=row.get("患者编号", "").strip() or None,
            order_date=self._parse_datetime(row.get("订单日期", "")),
            delivery_date=self._parse_date(row.get("交付日期", "")),
            tooth_positions=tooth_positions,
            restoration_type=row.get("修复类型", "").strip(),
            material=row.get("材料", "").strip(),
            shade=row.get("比色", "").strip(),
            is_urgent=is_urgent,
            special_instructions=row.get("特殊要求", "").strip(),
            notes=row.get("备注", "").strip(),
        )

        return order


class StatusCSVParser(BaseCSVParser):
    REQUIRED_COLUMNS = ["模型编号"]

    ORDER_STATUS_MAP = {
        "待接收": OrderStatus.PENDING_RECEIVE,
        "已接收": OrderStatus.RECEIVED,
        "加工中": OrderStatus.PROCESSING,
        "待检验": OrderStatus.PENDING_INSPECTION,
        "待返工": OrderStatus.PENDING_REWORK,
        "返工中": OrderStatus.REWORKING,
        "已完成": OrderStatus.COMPLETED,
    }

    def parse_row(self, row: Dict[str, str], row_num: int) -> Optional[ProcessingStatus]:
        model_id = row.get("模型编号", "").strip()

        if not model_id:
            raise ValueError(f"模型编号为空")

        status_str = row.get("当前状态", "待接收").strip()
        current_status = self.ORDER_STATUS_MAP.get(status_str, OrderStatus.PENDING_RECEIVE)

        rework_records = []
        rework_count_str = row.get("返工次数", "0")
        try:
            rework_count = int(rework_count_str)
        except ValueError:
            rework_count = 0

        if rework_count > 0:
            for i in range(1, rework_count + 1):
                reason_key = f"返工原因{i}" if f"返工原因{i}" in row else "返工原因"
                reason = row.get(reason_key, "").strip()
                if reason:
                    record = ReworkRecord(
                        rework_id=f"{model_id}_RW{i:02d}",
                        rework_count=i,
                        rework_reason=reason,
                        rework_date=self._parse_datetime(row.get(f"返工日期{i}", row.get("返工日期", ""))),
                        responsible_person=row.get(f"负责人{i}", row.get("负责人", "")).strip() or None,
                        is_resolved=self._parse_bool(row.get(f"返工是否解决{i}", row.get("返工是否解决", "否"))),
                    )
                    if record.is_resolved:
                        record.resolved_at = self._parse_datetime(row.get(f"解决日期{i}", row.get("解决日期", "")))
                    rework_records.append(record)

        status = ProcessingStatus(
            model_id=model_id,
            current_status=current_status,
            received_date=self._parse_datetime(row.get("接收日期", "")),
            expected_delivery_date=self._parse_datetime(row.get("预计交付日期", "")),
            actual_delivery_date=self._parse_datetime(row.get("实际交付日期", "")),
            rework_records=rework_records,
            responsible_technician=row.get("负责技师", "").strip() or None,
            last_updated=self._parse_datetime(row.get("最后更新时间", "")),
            notes=row.get("备注", "").strip(),
        )

        return status
