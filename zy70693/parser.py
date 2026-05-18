import csv
import os
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from enum import Enum


class DataSourceType(Enum):
    MEMBER = "member"
    RENTAL = "rental"
    EQUIPMENT = "equipment"
    RETURN_CHECK = "return_check"
    DEPOSIT = "deposit"


@dataclass
class DataRow:
    source_type: DataSourceType
    file_path: str
    line_number: int
    raw_data: Dict[str, str]
    is_valid: bool = True
    error_message: Optional[str] = None
    parsed_data: Dict[str, Any] = field(default_factory=dict)


class DataParser:
    def __init__(self):
        self.rows: List[DataRow] = []
        self.file_encoding = 'utf-8-sig'

    def parse_csv(self, file_path: str, source_type: DataSourceType) -> List[DataRow]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")

        file_rows = []
        with open(file_path, 'r', encoding=self.file_encoding) as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                data_row = DataRow(
                    source_type=source_type,
                    file_path=os.path.abspath(file_path),
                    line_number=line_num,
                    raw_data=row.copy()
                )
                try:
                    data_row.parsed_data = self._parse_row_by_type(row, source_type)
                except Exception as e:
                    data_row.is_valid = False
                    data_row.error_message = str(e)
                file_rows.append(data_row)
        
        self.rows.extend(file_rows)
        return file_rows

    def _parse_row_by_type(self, row: Dict[str, str], source_type: DataSourceType) -> Dict[str, Any]:
        parsers = {
            DataSourceType.MEMBER: self._parse_member,
            DataSourceType.RENTAL: self._parse_rental,
            DataSourceType.EQUIPMENT: self._parse_equipment,
            DataSourceType.RETURN_CHECK: self._parse_return_check,
            DataSourceType.DEPOSIT: self._parse_deposit
        }
        return parsers[source_type](row)

    def _parse_member(self, row: Dict[str, str]) -> Dict[str, Any]:
        return {
            'member_id': str(row.get('会员ID', '')).strip(),
            'member_name': str(row.get('会员姓名', '')).strip(),
            'phone': str(row.get('手机号', '')).strip(),
            'current_points': int(self._safe_float(row.get('当前积分', 0))),
            'member_level': str(row.get('会员等级', '普通')).strip()
        }

    def _parse_rental(self, row: Dict[str, str]) -> Dict[str, Any]:
        return {
            'rental_id': str(row.get('租借单号', '')).strip(),
            'member_id': str(row.get('会员ID', '')).strip(),
            'rental_date': str(row.get('租借日期', '')).strip(),
            'equipment_ids': self._split_list(row.get('渔具ID列表', '')),
            'deposit_amount': self._safe_float(row.get('押金金额', 0))
        }

    def _parse_equipment(self, row: Dict[str, str]) -> Dict[str, Any]:
        return {
            'equipment_id': str(row.get('渔具ID', '')).strip(),
            'equipment_name': str(row.get('渔具名称', '')).strip(),
            'type': str(row.get('类型', '')).strip(),
            'hook_included': self._parse_bool(row.get('包含鱼钩', '否')),
            'line_included': self._parse_bool(row.get('包含鱼线', '否')),
            'net_included': self._parse_bool(row.get('包含鱼护', '否')),
            'daily_price': self._safe_float(row.get('日租金', 0)),
            'hook_price': self._safe_float(row.get('鱼钩单价', 5)),
            'line_price': self._safe_float(row.get('鱼线单价', 10)),
            'net_price': self._safe_float(row.get('鱼护单价', 30))
        }

    def _parse_return_check(self, row: Dict[str, str]) -> Dict[str, Any]:
        return {
            'rental_id': str(row.get('租借单号', '')).strip(),
            'return_date': str(row.get('归还日期', '')).strip(),
            'equipment_id': str(row.get('渔具ID', '')).strip(),
            'hook_returned': self._parse_bool(row.get('鱼钩归还', '是')),
            'line_returned': self._parse_bool(row.get('鱼线归还', '是')),
            'net_returned': self._parse_bool(row.get('鱼护归还', '是')),
            'damage_note': str(row.get('损坏备注', '')).strip(),
            'checker': str(row.get('检查人', '')).strip()
        }

    def _parse_deposit(self, row: Dict[str, str]) -> Dict[str, Any]:
        return {
            'rental_id': str(row.get('租借单号', '')).strip(),
            'original_deposit': self._safe_float(row.get('原始押金', 0)),
            'deduction_amount': self._safe_float(row.get('已扣金额', 0)),
            'refund_amount': self._safe_float(row.get('已退金额', 0)),
            'status': str(row.get('押金状态', '待处理')).strip(),
            'points_compensated': int(self._safe_float(row.get('已补偿积分', 0)))
        }

    def _safe_float(self, value, default: float = 0.0) -> float:
        if value is None or value == '':
            return default
        try:
            return float(str(value).replace(',', '').strip())
        except (ValueError, TypeError):
            return default

    def _parse_bool(self, value: str) -> bool:
        if value is None:
            return False
        value = str(value).strip()
        return value in ['是', 'true', 'True', '1', 'yes', '有']

    def _split_list(self, value: str, separator: str = ',') -> List[str]:
        if not value:
            return []
        return [str(item).strip() for item in str(value).split(separator) if item.strip()]

    def get_invalid_rows(self) -> List[DataRow]:
        return [row for row in self.rows if not row.is_valid]

    def get_rows_by_type(self, source_type: DataSourceType) -> List[DataRow]:
        return [row for row in self.rows if row.source_type == source_type and row.is_valid]
