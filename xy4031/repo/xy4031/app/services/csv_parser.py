import csv
import hashlib
import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from io import StringIO


class CSVParseError(Exception):
    def __init__(self, error_type: str, message: str, row_data: Dict[str, Any] = None, row_number: int = 0):
        self.error_type = error_type
        self.message = message
        self.row_data = row_data or {}
        self.row_number = row_number
        super().__init__(message)


class BaseCSVParser:
    REQUIRED_FIELDS: List[str] = []
    FIELD_MAPPINGS: Dict[str, List[str]] = {}
    
    @staticmethod
    def generate_import_hash(row_data: Dict[str, Any], source_type: str) -> str:
        sorted_items = sorted(row_data.items())
        hash_input = f"{source_type}:{str(sorted_items)}"
        return hashlib.sha256(hash_input.encode('utf-8')).hexdigest()
    
    @staticmethod
    def parse_datetime(value: str) -> Optional[datetime]:
        if not value or value.strip() == '':
            return None
        
        value = value.strip()
        
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d %H:%M",
            "%Y/%m/%d",
            "%d-%m-%Y %H:%M:%S",
            "%d/%m/%Y %H:%M:%S",
            "%Y%m%d_%H%M%S",
            "%Y%m%d",
        ]
        
        for fmt in formats:
            try:
                return datetime.strptime(value, fmt)
            except (ValueError, TypeError):
                continue
        
        return None
    
    @staticmethod
    def parse_float(value: str) -> Optional[float]:
        if not value or value.strip() == '':
            return None
        try:
            cleaned = value.strip().replace(',', '')
            return float(cleaned)
        except (ValueError, TypeError):
            return None
    
    @staticmethod
    def parse_int(value: str) -> Optional[int]:
        if not value or value.strip() == '':
            return None
        try:
            cleaned = value.strip().replace(',', '')
            return int(float(cleaned))
        except (ValueError, TypeError):
            return None
    
    @staticmethod
    def parse_bool(value: str) -> bool:
        if not value:
            return False
        value_lower = str(value).lower().strip()
        return value_lower in ['true', '1', 'yes', 'y', '是', '有', '存在']
    
    def _map_field(self, row: Dict[str, str], field_name: str) -> Optional[str]:
        possible_names = self.FIELD_MAPPINGS.get(field_name, [field_name])
        for name in possible_names:
            if name in row:
                return row[name]
            for key in row.keys():
                if key.lower() == name.lower() or name.lower() in key.lower():
                    return row[key]
        return None
    
    def validate_required_fields(self, row: Dict[str, str], row_number: int) -> None:
        missing_fields = []
        for field in self.REQUIRED_FIELDS:
            value = self._map_field(row, field)
            if value is None or value.strip() == '':
                missing_fields.append(field)
        
        if missing_fields:
            raise CSVParseError(
                error_type="missing_required_field",
                message=f"缺少必填字段: {', '.join(missing_fields)}",
                row_data=row,
                row_number=row_number
            )


class ChargerCSVParser(BaseCSVParser):
    REQUIRED_FIELDS = ['battery_id']
    
    FIELD_MAPPINGS = {
        'battery_id': ['battery_id', '电池编号', '电池ID', '编号', 'battery', 'pack_id'],
        'charge_start_time': ['charge_start_time', '开始时间', '充电开始', 'start_time', '时间'],
        'charge_end_time': ['charge_end_time', '结束时间', '充电结束', 'end_time'],
        'start_voltage': ['start_voltage', '起始电压', '开始电压', '初始电压', 'start_v'],
        'end_voltage': ['end_voltage', '结束电压', '终止电压', 'end_v'],
        'charge_current': ['charge_current', '充电电流', 'current', '电流'],
        'capacity_charged_mah': ['capacity_charged', '充电容量', '容量', 'capacity', 'mah'],
        'cycle_count': ['cycle_count', '循环次数', 'cycles', 'cycle', '循环'],
        'charger_id': ['charger_id', '充电器编号', 'charger', '充电器'],
    }
    
    def parse_row(self, row: Dict[str, str], row_number: int) -> Dict[str, Any]:
        self.validate_required_fields(row, row_number)
        
        battery_id = self._map_field(row, 'battery_id')
        if battery_id:
            battery_id = battery_id.strip().upper()
        
        result = {
            'battery_id': battery_id,
            'charge_start_time': self.parse_datetime(self._map_field(row, 'charge_start_time')),
            'charge_end_time': self.parse_datetime(self._map_field(row, 'charge_end_time')),
            'start_voltage': self.parse_float(self._map_field(row, 'start_voltage')),
            'end_voltage': self.parse_float(self._map_field(row, 'end_voltage')),
            'charge_current': self.parse_float(self._map_field(row, 'charge_current')),
            'capacity_charged_mah': self.parse_float(self._map_field(row, 'capacity_charged_mah')),
            'cycle_count': self.parse_int(self._map_field(row, 'cycle_count')),
            'charger_id': self._map_field(row, 'charger_id'),
            'raw_row': row,
        }
        
        return result
    
    def parse_file(self, file_content: str) -> Tuple[List[Dict[str, Any]], List[CSVParseError]]:
        parsed_rows = []
        errors = []
        
        try:
            reader = csv.DictReader(StringIO(file_content))
            
            for row_number, row in enumerate(reader, start=2):
                try:
                    parsed = self.parse_row(row, row_number)
                    parsed_rows.append(parsed)
                except CSVParseError as e:
                    errors.append(e)
                except Exception as e:
                    errors.append(CSVParseError(
                        error_type="parse_error",
                        message=str(e),
                        row_data=row,
                        row_number=row_number
                    ))
        
        except Exception as e:
            errors.append(CSVParseError(
                error_type="file_read_error",
                message=f"文件读取失败: {str(e)}",
                row_number=1
            ))
        
        return parsed_rows, errors


class FlightLogCSVParser(BaseCSVParser):
    REQUIRED_FIELDS = ['battery_id']
    
    FIELD_MAPPINGS = {
        'battery_id': ['battery_id', '电池编号', '电池ID', '编号', 'battery', 'pack_id'],
        'flight_date': ['flight_date', '飞行日期', '日期', 'date', '时间'],
        'flight_duration_min': ['flight_duration', '飞行时长', '时长', 'duration', '分钟'],
        'start_voltage': ['start_voltage', '起始电压', '起飞电压', 'start_v', '电压'],
        'end_voltage': ['end_voltage', '结束电压', '降落电压', 'end_v'],
        'min_voltage': ['min_voltage', '最低电压', '最小电压', 'min_v'],
        'avg_current': ['avg_current', '平均电流', 'avg_i', '电流'],
        'max_current': ['max_current', '最大电流', 'max_i', '峰值电流'],
        'temperature_c': ['temperature', '温度', 'temp', '环境温度'],
        'cycle_count': ['cycle_count', '循环次数', 'cycles', 'cycle', '循环'],
        'has_low_voltage_alert': ['low_voltage_alert', '低压告警', '告警', '报警', 'alert'],
        'low_voltage_alert_time': ['alert_time', '告警时间', '报警时间'],
        'low_voltage_alert_value': ['alert_value', '告警电压', '报警电压'],
        'drone_id': ['drone_id', '无人机编号', 'drone', '飞机编号'],
        'mission_name': ['mission_name', '任务名称', '任务', 'mission'],
    }
    
    def parse_row(self, row: Dict[str, str], row_number: int) -> Dict[str, Any]:
        self.validate_required_fields(row, row_number)
        
        battery_id = self._map_field(row, 'battery_id')
        if battery_id:
            battery_id = battery_id.strip().upper()
        
        has_alert = self.parse_bool(self._map_field(row, 'has_low_voltage_alert'))
        
        result = {
            'battery_id': battery_id,
            'flight_date': self.parse_datetime(self._map_field(row, 'flight_date')),
            'flight_duration_min': self.parse_float(self._map_field(row, 'flight_duration_min')),
            'start_voltage': self.parse_float(self._map_field(row, 'start_voltage')),
            'end_voltage': self.parse_float(self._map_field(row, 'end_voltage')),
            'min_voltage': self.parse_float(self._map_field(row, 'min_voltage')),
            'avg_current': self.parse_float(self._map_field(row, 'avg_current')),
            'max_current': self.parse_float(self._map_field(row, 'max_current')),
            'temperature_c': self.parse_float(self._map_field(row, 'temperature_c')),
            'cycle_count': self.parse_int(self._map_field(row, 'cycle_count')),
            'has_low_voltage_alert': has_alert,
            'low_voltage_alert_time': self.parse_datetime(self._map_field(row, 'low_voltage_alert_time')),
            'low_voltage_alert_value': self.parse_float(self._map_field(row, 'low_voltage_alert_value')),
            'drone_id': self._map_field(row, 'drone_id'),
            'mission_name': self._map_field(row, 'mission_name'),
            'raw_row': row,
        }
        
        return result
    
    def parse_file(self, file_content: str) -> Tuple[List[Dict[str, Any]], List[CSVParseError]]:
        parsed_rows = []
        errors = []
        
        try:
            reader = csv.DictReader(StringIO(file_content))
            
            for row_number, row in enumerate(reader, start=2):
                try:
                    parsed = self.parse_row(row, row_number)
                    parsed_rows.append(parsed)
                except CSVParseError as e:
                    errors.append(e)
                except Exception as e:
                    errors.append(CSVParseError(
                        error_type="parse_error",
                        message=str(e),
                        row_data=row,
                        row_number=row_number
                    ))
        
        except Exception as e:
            errors.append(CSVParseError(
                error_type="file_read_error",
                message=f"文件读取失败: {str(e)}",
                row_number=1
            ))
        
        return parsed_rows, errors


class CellVoltageCSVParser(BaseCSVParser):
    REQUIRED_FIELDS = ['battery_id']
    
    FIELD_MAPPINGS = {
        'battery_id': ['battery_id', '电池编号', '电池ID', '编号', 'battery', 'pack_id'],
        'reading_time': ['reading_time', '读取时间', '时间', 'date', 'time'],
        'total_voltage': ['total_voltage', '总电压', '电压', 'total_v'],
        'cell_1_voltage': ['cell_1', 'cell1', '电芯1', '单体1', 'v1'],
        'cell_2_voltage': ['cell_2', 'cell2', '电芯2', '单体2', 'v2'],
        'cell_3_voltage': ['cell_3', 'cell3', '电芯3', '单体3', 'v3'],
        'cell_4_voltage': ['cell_4', 'cell4', '电芯4', '单体4', 'v4'],
        'cell_5_voltage': ['cell_5', 'cell5', '电芯5', '单体5', 'v5'],
        'cell_6_voltage': ['cell_6', 'cell6', '电芯6', '单体6', 'v6'],
        'cell_7_voltage': ['cell_7', 'cell7', '电芯7', '单体7', 'v7'],
        'cell_8_voltage': ['cell_8', 'cell8', '电芯8', '单体8', 'v8'],
        'cell_9_voltage': ['cell_9', 'cell9', '电芯9', '单体9', 'v9'],
        'cell_10_voltage': ['cell_10', 'cell10', '电芯10', '单体10', 'v10'],
        'cell_11_voltage': ['cell_11', 'cell11', '电芯11', '单体11', 'v11'],
        'cell_12_voltage': ['cell_12', 'cell12', '电芯12', '单体12', 'v12'],
        'reading_source': ['reading_source', '来源', 'source', '设备'],
    }
    
    def parse_row(self, row: Dict[str, str], row_number: int) -> Dict[str, Any]:
        self.validate_required_fields(row, row_number)
        
        battery_id = self._map_field(row, 'battery_id')
        if battery_id:
            battery_id = battery_id.strip().upper()
        
        cell_voltages = {}
        for i in range(1, 13):
            key = f'cell_{i}_voltage'
            cell_voltages[key] = self.parse_float(self._map_field(row, key))
        
        voltages = [v for v in cell_voltages.values() if v is not None]
        max_cell = max(voltages) if voltages else None
        min_cell = min(voltages) if voltages else None
        voltage_diff = (max_cell - min_cell) if max_cell and min_cell else None
        
        result = {
            'battery_id': battery_id,
            'reading_time': self.parse_datetime(self._map_field(row, 'reading_time')),
            'total_voltage': self.parse_float(self._map_field(row, 'total_voltage')),
            **cell_voltages,
            'max_cell_voltage': max_cell,
            'min_cell_voltage': min_cell,
            'voltage_diff': voltage_diff,
            'reading_source': self._map_field(row, 'reading_source'),
            'raw_row': row,
        }
        
        return result
    
    def parse_file(self, file_content: str) -> Tuple[List[Dict[str, Any]], List[CSVParseError]]:
        parsed_rows = []
        errors = []
        
        try:
            reader = csv.DictReader(StringIO(file_content))
            
            for row_number, row in enumerate(reader, start=2):
                try:
                    parsed = self.parse_row(row, row_number)
                    parsed_rows.append(parsed)
                except CSVParseError as e:
                    errors.append(e)
                except Exception as e:
                    errors.append(CSVParseError(
                        error_type="parse_error",
                        message=str(e),
                        row_data=row,
                        row_number=row_number
                    ))
        
        except Exception as e:
            errors.append(CSVParseError(
                error_type="file_read_error",
                message=f"文件读取失败: {str(e)}",
                row_number=1
            ))
        
        return parsed_rows, errors


def get_parser_for_type(source_type: str) -> BaseCSVParser:
    parsers = {
        'charger': ChargerCSVParser(),
        'flight': FlightLogCSVParser(),
        'voltage': CellVoltageCSVParser(),
    }
    return parsers.get(source_type.lower())
