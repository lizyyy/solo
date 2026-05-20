import pandas as pd
import json
import uuid
from datetime import datetime
from typing import List, Dict, Any, Tuple
from io import StringIO, BytesIO
from sqlalchemy.orm import Session

from app.models import (
    VesselSchedule,
    Berth,
    TideRecord,
    ReconciliationBatch,
)
from app.schemas import VesselScheduleCreate, BerthCreate, TideRecordCreate


class ImportService:
    def __init__(self, db: Session):
        self.db = db

    def generate_batch_id(self) -> str:
        return f"BATCH_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:8]}"

    def import_vessel_schedule_csv(
        self, file_content: bytes, filename: str, batch_id: str = None
    ) -> Tuple[List[VesselSchedule], str]:
        if batch_id is None:
            batch_id = self.generate_batch_id()

        content = file_content.decode("utf-8")
        df = pd.read_csv(StringIO(content))

        vessels = []
        for _, row in df.iterrows():
            vessel_data = self._parse_vessel_row(row)
            vessel_data["source_file"] = filename
            vessel_data["batch_id"] = batch_id

            vessel = VesselSchedule(**vessel_data)
            self.db.add(vessel)
            vessels.append(vessel)

        self.db.commit()
        return vessels, batch_id

    def _parse_vessel_row(self, row: pd.Series) -> Dict[str, Any]:
        data = {
            "vessel_name": str(row.get("vessel_name", row.get("船名", ""))).strip(),
            "vessel_imo": str(row.get("vessel_imo", row.get("IMO", ""))).strip(),
            "voyage_number": str(row.get("voyage_number", row.get("航次", ""))).strip(),
            "draft": float(row.get("draft", row.get("吃水", 0))),
            "deadweight": float(row.get("deadweight", row.get("载重吨", 0) or 0)),
            "eta": self._parse_datetime(row.get("eta", row.get("预计到港时间"))),
            "etd": self._parse_datetime(row.get("etd", row.get("预计离港时间"))),
            "etb": self._parse_datetime(row.get("etb", row.get("预计靠泊时间"))),
            "ets": self._parse_datetime(row.get("ets", row.get("预计离泊时间"))),
            "service_type": str(row.get("service_type", row.get("服务类型", ""))).strip(),
            "terminal": str(row.get("terminal", row.get("码头", ""))).strip(),
            "berth_number": str(row.get("berth_number", row.get("泊位", ""))).strip(),
            "cargo_type": str(row.get("cargo_type", row.get("货物类型", ""))).strip(),
            "cargo_quantity": float(row.get("cargo_quantity", row.get("货物数量", 0) or 0)),
            "is_cut_in": bool(row.get("is_cut_in", row.get("是否插队", False))),
            "cut_in_reason": str(row.get("cut_in_reason", row.get("插队原因", ""))).strip(),
            "notes": str(row.get("notes", row.get("备注", ""))).strip(),
            "status": "scheduled",
        }
        return {k: v for k, v in data.items() if v is not None}

    def import_berth_json(
        self, file_content: bytes, filename: str, batch_id: str = None
    ) -> Tuple[List[Berth], str]:
        if batch_id is None:
            batch_id = self.generate_batch_id()

        data = json.loads(file_content.decode("utf-8"))
        berth_list = data if isinstance(data, list) else data.get("berths", [])

        berths = []
        for item in berth_list:
            berth_data = self._parse_berth_item(item)
            berth_data["source_file"] = filename
            berth_data["batch_id"] = batch_id

            existing = (
                self.db.query(Berth).filter(Berth.berth_number == berth_data["berth_number"]).first()
            )
            if existing:
                for key, value in berth_data.items():
                    setattr(existing, key, value)
                berths.append(existing)
            else:
                berth = Berth(**berth_data)
                self.db.add(berth)
                berths.append(berth)

        self.db.commit()
        return berths, batch_id

    def _parse_berth_item(self, item: Dict[str, Any]) -> Dict[str, Any]:
        return {
            "berth_number": str(item.get("berth_number", item.get("泊位号", ""))).strip(),
            "terminal": str(item.get("terminal", item.get("码头", ""))).strip(),
            "description": str(item.get("description", item.get("描述", ""))).strip(),
            "depth_at_mllw": float(item.get("depth_at_mllw", item.get("基准水深", 0))),
            "max_draft": float(item.get("max_draft", item.get("最大吃水", 0) or 0)),
            "min_depth": float(item.get("min_depth", item.get("最小水深", 0) or 0)),
            "length": float(item.get("length", item.get("长度", 0) or 0)),
            "max_vessel_length": float(item.get("max_vessel_length", item.get("最大船长", 0) or 0)),
            "is_available": bool(item.get("is_available", item.get("是否可用", True))),
            "unavailable_reason": str(item.get("unavailable_reason", item.get("不可用原因", ""))).strip(),
            "unavailable_from": self._parse_datetime(item.get("unavailable_from")),
            "unavailable_to": self._parse_datetime(item.get("unavailable_to")),
            "allowed_vessel_types": str(item.get("allowed_vessel_types", item.get("允许船型", ""))).strip(),
            "allowed_cargo_types": str(item.get("allowed_cargo_types", item.get("允许货类", ""))).strip(),
            "priority": int(item.get("priority", item.get("优先级", 0))),
            "notes": str(item.get("notes", item.get("备注", ""))).strip(),
        }

    def import_tide_csv(
        self, file_content: bytes, filename: str, batch_id: str = None
    ) -> Tuple[List[TideRecord], str]:
        if batch_id is None:
            batch_id = self.generate_batch_id()

        content = file_content.decode("utf-8")
        df = pd.read_csv(StringIO(content))

        tides = []
        for _, row in df.iterrows():
            tide_data = self._parse_tide_row(row)
            tide_data["source_file"] = filename
            tide_data["batch_id"] = batch_id

            tide = TideRecord(**tide_data)
            self.db.add(tide)
            tides.append(tide)

        self.db.commit()
        return tides, batch_id

    def _parse_tide_row(self, row: pd.Series) -> Dict[str, Any]:
        return {
            "record_date": self._parse_datetime(row.get("record_date", row.get("时间"))),
            "tide_type": str(row.get("tide_type", row.get("潮型", "HIGH"))).strip().upper(),
            "height": float(row.get("height", row.get("潮高", 0))),
            "timezone": str(row.get("timezone", "Asia/Shanghai")).strip(),
        }

    def _parse_datetime(self, value) -> datetime:
        if value is None or pd.isna(value) or str(value).strip() == "":
            return None
        if isinstance(value, datetime):
            return value
        try:
            return pd.to_datetime(value).to_pydatetime()
        except:
            return None

    def create_reconciliation_batch(
        self,
        name: str,
        vessel_batch_id: str,
        berth_batch_id: str,
        tide_batch_id: str,
        vessel_file: str,
        berth_file: str,
        tide_file: str,
        created_by: str = None,
    ) -> ReconciliationBatch:
        batch_id = self.generate_batch_id()
        batch = ReconciliationBatch(
            batch_id=batch_id,
            name=name,
            vessel_schedule_file=vessel_file,
            berth_file=berth_file,
            tide_file=tide_file,
            vessel_batch_id=vessel_batch_id,
            berth_batch_id=berth_batch_id,
            tide_batch_id=tide_batch_id,
            status="pending",
            created_by=created_by,
        )
        self.db.add(batch)
        self.db.commit()
        self.db.refresh(batch)
        return batch
