import csv
import json
from datetime import datetime
from typing import List, Optional
import pandas as pd
import uuid

from models import SensorRecord, DevicePlate, ExperimentSession, SensorStatus


class DataImporter:
    def import_from_csv(self, file_path: str) -> List[SensorRecord]:
        records = []
        df = pd.read_csv(file_path)

        required_columns = ["timestamp", "sensor_id", "sensor_number", "wind_speed", "drag_force"]
        for col in required_columns:
            if col not in df.columns:
                raise ValueError(f"缺少必需列: {col}")

        for _, row in df.iterrows():
            record = SensorRecord(
                id=str(uuid.uuid4()),
                timestamp=datetime.fromisoformat(str(row["timestamp"])),
                sensor_id=str(row["sensor_id"]),
                sensor_number=int(row["sensor_number"]),
                wind_speed=float(row["wind_speed"]),
                drag_force=float(row["drag_force"]),
                temperature=float(row["temperature"]) if "temperature" in row and pd.notna(row["temperature"]) else None,
                pressure=float(row["pressure"]) if "pressure" in row and pd.notna(row["pressure"]) else None,
                status=SensorStatus.NORMAL,
            )
            records.append(record)

        return records

    def import_device_plate(self, data: dict) -> DevicePlate:
        return DevicePlate(
            device_id=data["device_id"],
            device_name=data["device_name"],
            model=data["model"],
            manufacturer=data["manufacturer"],
            purchase_date=data["purchase_date"],
            calibration_date=data["calibration_date"],
            next_calibration_date=data["next_calibration_date"],
            sensor_count=int(data["sensor_count"]),
            remarks=data.get("remarks"),
        )

    def create_session(
        self,
        name: str,
        date: str,
        sensor_records: List[SensorRecord],
        device_plate: Optional[DevicePlate] = None,
    ) -> ExperimentSession:
        session = ExperimentSession(
            id=str(uuid.uuid4()),
            name=name,
            date=date,
            device_plate=device_plate,
            sensor_records=sensor_records,
        )
        return session


importer = DataImporter()
