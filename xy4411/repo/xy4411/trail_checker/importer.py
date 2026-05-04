import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional, Tuple
from .models import (
    RaceConfig, Registration, TimingRecord, AidStationConsumption, MedicalEvent
)


class DataImporter:
    def __init__(self, data_dir: str):
        self.data_dir = Path(data_dir)
        self.seen_ids: Dict[str, set] = {
            "registrations": set(),
            "timing_records": set(),
            "aid_station_consumptions": set(),
            "medical_events": set(),
        }

    def _load_json_file(self, file_path: Path) -> Any:
        with open(file_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def import_race_config(self) -> Optional[RaceConfig]:
        config_file = self.data_dir / "race_config.json"
        if not config_file.exists():
            return None
        
        data = self._load_json_file(config_file)
        return RaceConfig.model_validate(data)

    def import_registrations(self) -> Tuple[List[Registration], int]:
        registrations: List[Registration] = []
        duplicates_removed = 0
        
        reg_files = list(self.data_dir.glob("*registration*.json"))
        if not reg_files:
            reg_files = list(self.data_dir.glob("registrations.json"))
        
        for file_path in reg_files:
            data = self._load_json_file(file_path)
            if not isinstance(data, list):
                data = [data]
            
            for item in data:
                bib = item.get("bib", "")
                if bib in self.seen_ids["registrations"]:
                    duplicates_removed += 1
                    continue
                
                self.seen_ids["registrations"].add(bib)
                registrations.append(Registration.model_validate(item))
        
        return registrations, duplicates_removed

    def import_timing_records(self) -> Tuple[List[TimingRecord], int]:
        records: List[TimingRecord] = []
        duplicates_removed = 0
        
        timing_files = list(self.data_dir.glob("*timing*.json"))
        if not timing_files:
            timing_files = list(self.data_dir.glob("timing_records.json"))
        
        for file_path in timing_files:
            data = self._load_json_file(file_path)
            if not isinstance(data, list):
                data = [data]
            
            for item in data:
                record_id = item.get("record_id", "")
                if record_id in self.seen_ids["timing_records"]:
                    duplicates_removed += 1
                    continue
                
                self.seen_ids["timing_records"].add(record_id)
                records.append(TimingRecord.model_validate(item))
        
        return records, duplicates_removed

    def import_aid_station_consumptions(self) -> Tuple[List[AidStationConsumption], int]:
        consumptions: List[AidStationConsumption] = []
        duplicates_removed = 0
        
        aid_files = list(self.data_dir.glob("*aid*.json"))
        if not aid_files:
            aid_files = list(self.data_dir.glob("*consumption*.json"))
            if not aid_files:
                aid_files = list(self.data_dir.glob("aid_station_consumptions.json"))
        
        for file_path in aid_files:
            data = self._load_json_file(file_path)
            if not isinstance(data, list):
                data = [data]
            
            for item in data:
                consumption_id = item.get("consumption_id", "")
                if consumption_id in self.seen_ids["aid_station_consumptions"]:
                    duplicates_removed += 1
                    continue
                
                self.seen_ids["aid_station_consumptions"].add(consumption_id)
                consumptions.append(AidStationConsumption.model_validate(item))
        
        return consumptions, duplicates_removed

    def import_medical_events(self) -> Tuple[List[MedicalEvent], int]:
        events: List[MedicalEvent] = []
        duplicates_removed = 0
        
        medical_files = list(self.data_dir.glob("*medical*.json"))
        if not medical_files:
            medical_files = list(self.data_dir.glob("medical_events.json"))
        
        for file_path in medical_files:
            data = self._load_json_file(file_path)
            if not isinstance(data, list):
                data = [data]
            
            for item in data:
                event_id = item.get("event_id", "")
                if event_id in self.seen_ids["medical_events"]:
                    duplicates_removed += 1
                    continue
                
                self.seen_ids["medical_events"].add(event_id)
                events.append(MedicalEvent.model_validate(item))
        
        return events, duplicates_removed

    def import_all(self) -> Dict[str, Any]:
        race_config = self.import_race_config()
        registrations, reg_dupes = self.import_registrations()
        timing_records, timing_dupes = self.import_timing_records()
        aid_consumptions, aid_dupes = self.import_aid_station_consumptions()
        medical_events, medical_dupes = self.import_medical_events()

        return {
            "race_config": race_config,
            "registrations": registrations,
            "timing_records": timing_records,
            "aid_station_consumptions": aid_consumptions,
            "medical_events": medical_events,
            "duplicates_removed": {
                "registrations": reg_dupes,
                "timing_records": timing_dupes,
                "aid_station_consumptions": aid_dupes,
                "medical_events": medical_dupes,
                "total": reg_dupes + timing_dupes + aid_dupes + medical_dupes,
            },
        }
