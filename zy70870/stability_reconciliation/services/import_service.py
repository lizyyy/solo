import pandas as pd
import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from stability_reconciliation.models.database import (
    TestProtocol, Sample, ChamberRecord, get_db
)
from io import StringIO, BytesIO


class DataImportService:
    def __init__(self, db: Session):
        self.db = db

    def import_test_protocol_json(self, json_content: str) -> Tuple[TestProtocol, List[Sample]]:
        protocol_data = json.loads(json_content)
        
        protocol_id = f"PROTO-{uuid.uuid4().hex[:8].upper()}"
        
        protocol = TestProtocol(
            id=protocol_id,
            protocol_name=protocol_data.get("protocol_name", ""),
            product_name=protocol_data.get("product_name", ""),
            batch_number=protocol_data.get("batch_number", ""),
            conditions=protocol_data.get("conditions", {}),
            sampling_points=protocol_data.get("sampling_points", []),
            status="active"
        )
        
        self.db.add(protocol)
        
        samples = []
        for sp in protocol_data.get("sampling_points", []):
            sample_id = f"SAMP-{uuid.uuid4().hex[:8].upper()}"
            planned_date = datetime.fromisoformat(sp.get("planned_date")) if sp.get("planned_date") else None
            
            sample = Sample(
                id=sample_id,
                protocol_id=protocol_id,
                sample_id=sp.get("sample_id", ""),
                sampling_point=sp.get("point_name", ""),
                planned_sampling_date=planned_date,
                condition=sp.get("condition", ""),
                storage_location=sp.get("storage_location", ""),
                status="pending"
            )
            samples.append(sample)
            self.db.add(sample)
        
        self.db.commit()
        return protocol, samples

    def import_samples_csv(self, csv_content: str, protocol_id: str) -> List[Sample]:
        df = pd.read_csv(StringIO(csv_content))
        
        samples = []
        for _, row in df.iterrows():
            sample_id = f"SAMP-{uuid.uuid4().hex[:8].upper()}"
            
            planned_date = self._parse_date(row.get("planned_sampling_date"))
            actual_date = self._parse_date(row.get("actual_sampling_date"))
            
            sample = Sample(
                id=sample_id,
                protocol_id=protocol_id,
                sample_id=str(row.get("sample_id", "")),
                sampling_point=str(row.get("sampling_point", "")),
                planned_sampling_date=planned_date,
                actual_sampling_date=actual_date,
                condition=str(row.get("condition", "")),
                storage_location=str(row.get("storage_location", "")),
                test_results=self._parse_test_results(row),
                status="imported"
            )
            samples.append(sample)
            self.db.add(sample)
        
        self.db.commit()
        return samples

    def import_chamber_records_csv(self, csv_content: str) -> List[ChamberRecord]:
        df = pd.read_csv(StringIO(csv_content))
        
        records = []
        for _, row in df.iterrows():
            record_id = f"CHAM-{uuid.uuid4().hex[:8].upper()}"
            
            record_time = self._parse_date(row.get("record_time"))
            temp = float(row.get("temperature", 0))
            humidity = float(row.get("humidity", 0))
            target_temp = float(row.get("target_temperature", 25))
            target_humidity = float(row.get("target_humidity", 60))
            
            is_alert, alert_type = self._check_chamber_alert(
                temp, humidity, target_temp, target_humidity
            )
            
            record = ChamberRecord(
                id=record_id,
                chamber_id=str(row.get("chamber_id", "")),
                chamber_name=str(row.get("chamber_name", "")),
                record_time=record_time,
                temperature=temp,
                humidity=humidity,
                target_temperature=target_temp,
                target_humidity=target_humidity,
                is_alert=is_alert,
                alert_type=alert_type
            )
            records.append(record)
            self.db.add(record)
        
        self.db.commit()
        return records

    def _parse_date(self, date_str: Any) -> datetime:
        if pd.isna(date_str) or not date_str:
            return None
        if isinstance(date_str, datetime):
            return date_str
        try:
            return datetime.fromisoformat(str(date_str))
        except:
            try:
                return pd.to_datetime(date_str).to_pydatetime()
            except:
                return None

    def _parse_test_results(self, row: pd.Series) -> Dict[str, Any]:
        results = {}
        test_columns = [col for col in row.index if col.startswith("test_") or "_result" in col.lower()]
        for col in test_columns:
            if not pd.isna(row[col]):
                results[col] = row[col]
        return results

    def _check_chamber_alert(self, temp: float, humidity: float, 
                             target_temp: float, target_humidity: float) -> Tuple[bool, str]:
        temp_tolerance = 2.0
        humidity_tolerance = 5.0
        
        temp_deviation = abs(temp - target_temp)
        humidity_deviation = abs(humidity - target_humidity)
        
        alerts = []
        if temp_deviation > temp_tolerance:
            alerts.append(f"温度超差: {temp}°C (目标: {target_temp}°C)")
        if humidity_deviation > humidity_tolerance:
            alerts.append(f"湿度超差: {humidity}% (目标: {target_humidity}%)")
        
        if alerts:
            return True, "; ".join(alerts)
        return False, None

    def get_import_template(self, template_type: str) -> str:
        if template_type == "samples":
            return self._get_samples_template()
        elif template_type == "chamber":
            return self._get_chamber_template()
        elif template_type == "protocol":
            return self._get_protocol_template()
        return ""

    def _get_samples_template(self) -> str:
        data = {
            "sample_id": ["S001", "S002", "S003"],
            "sampling_point": ["0月", "3月", "6月"],
            "planned_sampling_date": ["2024-01-01", "2024-04-01", "2024-07-01"],
            "actual_sampling_date": ["2024-01-02", "2024-04-01", ""],
            "condition": ["25°C/60%RH", "25°C/60%RH", "40°C/75%RH"],
            "storage_location": ["箱体A", "箱体A", "箱体B"],
            "test_purity_result": [99.5, 99.3, 99.1],
            "test_content_result": [100.2, 99.8, 99.5]
        }
        return pd.DataFrame(data).to_csv(index=False)

    def _get_chamber_template(self) -> str:
        data = {
            "chamber_id": ["CH001", "CH001", "CH001"],
            "chamber_name": ["箱体A", "箱体A", "箱体A"],
            "record_time": ["2024-01-01 00:00:00", "2024-01-01 01:00:00", "2024-01-01 02:00:00"],
            "temperature": [25.0, 25.1, 27.5],
            "humidity": [60.0, 59.8, 62.0],
            "target_temperature": [25.0, 25.0, 25.0],
            "target_humidity": [60.0, 60.0, 60.0]
        }
        return pd.DataFrame(data).to_csv(index=False)

    def _get_protocol_template(self) -> str:
        template = {
            "protocol_name": "稳定性试验方案-2024",
            "product_name": "XX注射液",
            "batch_number": "B2024001",
            "conditions": {
                "长期": {"温度": 25, "湿度": 60, "单位": "°C/%RH"},
                "加速": {"温度": 40, "湿度": 75, "单位": "°C/%RH"}
            },
            "sampling_points": [
                {
                    "point_name": "0月",
                    "sample_id": "S001",
                    "planned_date": "2024-01-01T00:00:00",
                    "condition": "长期",
                    "storage_location": "箱体A"
                },
                {
                    "point_name": "3月",
                    "sample_id": "S002",
                    "planned_date": "2024-04-01T00:00:00",
                    "condition": "长期",
                    "storage_location": "箱体A"
                }
            ]
        }
        return json.dumps(template, indent=2, ensure_ascii=False)
