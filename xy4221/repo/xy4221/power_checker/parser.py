import csv
import hashlib
from datetime import datetime
from typing import Dict, List, Optional, Tuple, Any
from pathlib import Path

from .config import ProjectConfig
from .models import (
    LogRecord,
    PlanRecord,
    PowerUnit,
    RecordStatus,
    Risk,
    RiskType,
    RiskSeverity,
)


class LogParser:
    DEFAULT_REQUIRED_FIELDS = ["timestamp", "circuit_id", "current"]

    def __init__(self, config: ProjectConfig):
        self.config = config
        self.valid_circuits = {c.id for c in config.circuits}
        self.valid_units = {"A", "kW", "W"}
        self.seen_hashes: Dict[str, int] = {}

    def parse_file(self, file_path: str) -> Tuple[List[LogRecord], List[LogRecord], List[Risk]]:
        valid_records = []
        quarantined_records = []
        all_risks = []
        file_path = Path(file_path)

        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                record, risks = self._parse_row(row, row_num)
                all_risks.extend(risks)
                
                if record.status == RecordStatus.QUARANTINED:
                    quarantined_records.append(record)
                else:
                    valid_records.append(record)

        return valid_records, quarantined_records, all_risks

    def _parse_row(self, row: Dict[str, str], row_num: int) -> Tuple[LogRecord, List[Risk]]:
        risks = []
        raw_data = dict(row)
        
        row = {k.strip(): v.strip() for k, v in row.items()}
        
        missing_fields = []
        for field in self.DEFAULT_REQUIRED_FIELDS:
            if field not in row or not row[field]:
                missing_fields.append(field)
        
        if missing_fields:
            record = LogRecord(
                id="",
                timestamp=datetime.now(),
                circuit_id=row.get("circuit_id", ""),
                current=0.0,
                unit=PowerUnit.AMPERE,
                raw_data=raw_data,
                status=RecordStatus.QUARANTINED,
                quarantine_reason=f"缺少必填字段: {', '.join(missing_fields)}",
            )
            risk = Risk(
                id="",
                risk_type=RiskType.MISSING_FIELD,
                severity=RiskSeverity.HIGH,
                message=f"第{row_num}行缺少必填字段: {', '.join(missing_fields)}",
                timestamp=datetime.now(),
                circuit_id=row.get("circuit_id"),
                details={"row_num": row_num, "missing_fields": missing_fields},
            )
            return record, [risk]

        timestamp = self._parse_timestamp(row.get("timestamp", ""), row_num, risks)
        if timestamp is None:
            record = LogRecord(
                id="",
                timestamp=datetime.now(),
                circuit_id=row.get("circuit_id", ""),
                current=0.0,
                unit=PowerUnit.AMPERE,
                raw_data=raw_data,
                status=RecordStatus.QUARANTINED,
                quarantine_reason=f"时间格式无效: {row.get('timestamp', '')}",
            )
            return record, risks

        circuit_id = row.get("circuit_id", "").strip()
        if circuit_id not in self.valid_circuits:
            risks.append(Risk(
                id="",
                risk_type=RiskType.INVALID_CIRCUIT,
                severity=RiskSeverity.HIGH,
                message=f"第{row_num}行回路编号无效: {circuit_id}",
                timestamp=timestamp,
                circuit_id=circuit_id,
                details={"row_num": row_num, "valid_circuits": list(self.valid_circuits)},
            ))
            record = LogRecord(
                id="",
                timestamp=timestamp,
                circuit_id=circuit_id,
                current=0.0,
                unit=PowerUnit.AMPERE,
                raw_data=raw_data,
                status=RecordStatus.QUARANTINED,
                quarantine_reason=f"回路编号无效: {circuit_id}",
            )
            return record, risks

        try:
            current = float(row.get("current", "0").strip())
        except ValueError:
            risks.append(Risk(
                id="",
                risk_type=RiskType.INVALID_UNIT,
                severity=RiskSeverity.HIGH,
                message=f"第{row_num}行电流值无效: {row.get('current', '')}",
                timestamp=timestamp,
                circuit_id=circuit_id,
                details={"row_num": row_num},
            ))
            record = LogRecord(
                id="",
                timestamp=timestamp,
                circuit_id=circuit_id,
                current=0.0,
                unit=PowerUnit.AMPERE,
                raw_data=raw_data,
                status=RecordStatus.QUARANTINED,
                quarantine_reason=f"电流值无效: {row.get('current', '')}",
            )
            return record, risks

        unit_str = row.get("unit", "A").strip().upper()
        if unit_str not in self.valid_units:
            risks.append(Risk(
                id="",
                risk_type=RiskType.INVALID_UNIT,
                severity=RiskSeverity.MEDIUM,
                message=f"第{row_num}行单位无效: {unit_str}，默认使用A",
                timestamp=timestamp,
                circuit_id=circuit_id,
                details={"row_num": row_num},
            ))
            unit = PowerUnit.AMPERE
        else:
            if unit_str == "KW":
                unit = PowerUnit.KILOWATT
            elif unit_str == "W":
                unit = PowerUnit.WATT
            else:
                unit = PowerUnit.AMPERE

        record_hash = self._calculate_record_hash(
            timestamp, circuit_id, current, unit
        )
        if record_hash in self.seen_hashes:
            original_row = self.seen_hashes[record_hash]
            risks.append(Risk(
                id="",
                risk_type=RiskType.DUPLICATE_RECORD,
                severity=RiskSeverity.MEDIUM,
                message=f"第{row_num}行与第{original_row}行重复",
                timestamp=timestamp,
                circuit_id=circuit_id,
                details={"row_num": row_num, "original_row": original_row},
            ))
            record = LogRecord(
                id="",
                timestamp=timestamp,
                circuit_id=circuit_id,
                current=current,
                unit=unit,
                raw_data=raw_data,
                status=RecordStatus.QUARANTINED,
                quarantine_reason=f"与第{original_row}行重复",
            )
            return record, risks
        
        self.seen_hashes[record_hash] = row_num

        phase = row.get("phase", "").strip() or None
        try:
            voltage = float(row.get("voltage", "").strip()) if row.get("voltage") else None
        except ValueError:
            voltage = None
        try:
            power_factor = float(row.get("power_factor", "").strip()) if row.get("power_factor") else None
        except ValueError:
            power_factor = None

        record = LogRecord(
            id="",
            timestamp=timestamp,
            circuit_id=circuit_id,
            current=current,
            unit=unit,
            phase=phase,
            voltage=voltage,
            power_factor=power_factor,
            raw_data=raw_data,
        )

        return record, risks

    def _parse_timestamp(self, timestamp_str: str, row_num: int, risks: List[Risk]) -> Optional[datetime]:
        if not timestamp_str:
            risks.append(Risk(
                id="",
                risk_type=RiskType.INVALID_TIME,
                severity=RiskSeverity.HIGH,
                message=f"第{row_num}行时间戳为空",
                timestamp=datetime.now(),
                details={"row_num": row_num},
            ))
            return None

        formats_to_try = [
            self.config.log_date_format,
            "%Y-%m-%d %H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M",
            "%d/%m/%Y %H:%M:%S",
            "%m/%d/%Y %H:%M:%S",
        ]

        for fmt in formats_to_try:
            try:
                return datetime.strptime(timestamp_str.strip(), fmt)
            except (ValueError, TypeError):
                continue

        risks.append(Risk(
            id="",
            risk_type=RiskType.INVALID_TIME,
            severity=RiskSeverity.HIGH,
            message=f"第{row_num}行时间格式无法解析: {timestamp_str}",
            timestamp=datetime.now(),
            details={"row_num": row_num, "timestamp_str": timestamp_str},
        ))
        return None

    def _calculate_record_hash(self, timestamp: datetime, circuit_id: str, current: float, unit: PowerUnit) -> str:
        data = f"{timestamp.isoformat()}|{circuit_id}|{current}|{unit.value}"
        return hashlib.md5(data.encode()).hexdigest()


class PlanParser:
    DEFAULT_REQUIRED_FIELDS = ["circuit_id", "device_name", "device_id"]

    def __init__(self, config: ProjectConfig):
        self.config = config
        self.valid_circuits = {c.id for c in config.circuits}
        self.seen_hashes: Dict[str, int] = {}

    def parse_file(self, file_path: str) -> Tuple[List[PlanRecord], List[PlanRecord], List[Risk]]:
        valid_records = []
        quarantined_records = []
        all_risks = []
        file_path = Path(file_path)

        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        with open(file_path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            for row_num, row in enumerate(reader, start=2):
                record, risks = self._parse_row(row, row_num)
                all_risks.extend(risks)
                
                if record.status == RecordStatus.QUARANTINED:
                    quarantined_records.append(record)
                else:
                    valid_records.append(record)

        return valid_records, quarantined_records, all_risks

    def _parse_row(self, row: Dict[str, str], row_num: int) -> Tuple[PlanRecord, List[Risk]]:
        risks = []
        raw_data = dict(row)
        
        row = {k.strip(): v.strip() for k, v in row.items()}
        
        missing_fields = []
        for field in self.DEFAULT_REQUIRED_FIELDS:
            if field not in row or not row[field]:
                missing_fields.append(field)
        
        if missing_fields:
            record = PlanRecord(
                id="",
                circuit_id=row.get("circuit_id", ""),
                device_name=row.get("device_name", ""),
                device_id=row.get("device_id", ""),
                raw_data=raw_data,
                status=RecordStatus.QUARANTINED,
                quarantine_reason=f"缺少必填字段: {', '.join(missing_fields)}",
            )
            risk = Risk(
                id="",
                risk_type=RiskType.MISSING_FIELD,
                severity=RiskSeverity.HIGH,
                message=f"第{row_num}行缺少必填字段: {', '.join(missing_fields)}",
                timestamp=datetime.now(),
                circuit_id=row.get("circuit_id"),
                details={"row_num": row_num, "missing_fields": missing_fields},
            )
            return record, [risk]

        circuit_id = row.get("circuit_id", "").strip()
        if circuit_id not in self.valid_circuits:
            risks.append(Risk(
                id="",
                risk_type=RiskType.INVALID_CIRCUIT,
                severity=RiskSeverity.HIGH,
                message=f"第{row_num}行回路编号无效: {circuit_id}",
                timestamp=datetime.now(),
                circuit_id=circuit_id,
                details={"row_num": row_num, "valid_circuits": list(self.valid_circuits)},
            ))
            record = PlanRecord(
                id="",
                circuit_id=circuit_id,
                device_name=row.get("device_name", ""),
                device_id=row.get("device_id", ""),
                raw_data=raw_data,
                status=RecordStatus.QUARANTINED,
                quarantine_reason=f"回路编号无效: {circuit_id}",
            )
            return record, risks

        device_name = row.get("device_name", "").strip()
        device_id = row.get("device_id", "").strip()

        power_on_time = self._parse_optional_timestamp(row.get("power_on_time", ""), "上电时间", row_num, risks)
        power_off_time = self._parse_optional_timestamp(row.get("power_off_time", ""), "下电时间", row_num, risks)

        expected_current = None
        if row.get("expected_current"):
            try:
                expected_current = float(row.get("expected_current", "0").strip())
            except ValueError:
                risks.append(Risk(
                    id="",
                    risk_type=RiskType.INVALID_UNIT,
                    severity=RiskSeverity.MEDIUM,
                    message=f"第{row_num}行预期电流值无效: {row.get('expected_current', '')}",
                    timestamp=datetime.now(),
                    circuit_id=circuit_id,
                    details={"row_num": row_num},
                ))

        unit_str = row.get("unit", "A").strip().upper()
        unit = None
        if unit_str in ["A", "KW", "W"]:
            if unit_str == "KW":
                unit = PowerUnit.KILOWATT
            elif unit_str == "W":
                unit = PowerUnit.WATT
            else:
                unit = PowerUnit.AMPERE

        record_hash = self._calculate_record_hash(device_id, circuit_id, power_on_time)
        if record_hash in self.seen_hashes:
            original_row = self.seen_hashes[record_hash]
            risks.append(Risk(
                id="",
                risk_type=RiskType.DUPLICATE_RECORD,
                severity=RiskSeverity.MEDIUM,
                message=f"第{row_num}行与第{original_row}行重复",
                timestamp=datetime.now(),
                circuit_id=circuit_id,
                details={"row_num": row_num, "original_row": original_row},
            ))
            record = PlanRecord(
                id="",
                circuit_id=circuit_id,
                device_name=device_name,
                device_id=device_id,
                power_on_time=power_on_time,
                power_off_time=power_off_time,
                expected_current=expected_current,
                unit=unit,
                raw_data=raw_data,
                status=RecordStatus.QUARANTINED,
                quarantine_reason=f"与第{original_row}行重复",
            )
            return record, risks
        
        self.seen_hashes[record_hash] = row_num

        record = PlanRecord(
            id="",
            circuit_id=circuit_id,
            device_name=device_name,
            device_id=device_id,
            power_on_time=power_on_time,
            power_off_time=power_off_time,
            expected_current=expected_current,
            unit=unit,
            raw_data=raw_data,
        )

        return record, risks

    def _parse_optional_timestamp(self, timestamp_str: str, field_name: str, row_num: int, risks: List[Risk]) -> Optional[datetime]:
        if not timestamp_str:
            return None

        formats_to_try = [
            self.config.plan_date_format,
            "%Y-%m-%d %H:%M:%S",
            "%Y/%m/%d %H:%M:%S",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y/%m/%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d",
        ]

        for fmt in formats_to_try:
            try:
                return datetime.strptime(timestamp_str.strip(), fmt)
            except (ValueError, TypeError):
                continue

        risks.append(Risk(
            id="",
            risk_type=RiskType.INVALID_TIME,
            severity=RiskSeverity.MEDIUM,
            message=f"第{row_num}行{field_name}格式无法解析: {timestamp_str}",
            timestamp=datetime.now(),
            details={"row_num": row_num, "timestamp_str": timestamp_str, "field": field_name},
        ))
        return None

    def _calculate_record_hash(self, device_id: str, circuit_id: str, power_on_time: Optional[datetime]) -> str:
        time_str = power_on_time.isoformat() if power_on_time else ""
        data = f"{device_id}|{circuit_id}|{time_str}"
        return hashlib.md5(data.encode()).hexdigest()
