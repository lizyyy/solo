import json
from datetime import datetime
from pathlib import Path
from typing import Any, List

from kiln_analyzer.models import DefectRecord, KilnLayer, KilnLoad, PhaseType
from kiln_analyzer.parsers.base import BaseParser


class KilnLoadJSONParser(BaseParser[KilnLoad]):
    def parse(self, file_path: Path) -> KilnLoad:
        if not file_path.exists():
            raise FileNotFoundError(f"窑车装载JSON文件不存在: {file_path}")

        with open(file_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)

        batch_id = raw_data.get("batch_id", "UNKNOWN")
        load_date_str = raw_data.get("load_date")

        if load_date_str:
            try:
                load_date = datetime.fromisoformat(load_date_str)
            except ValueError:
                load_date = datetime.now()
        else:
            load_date = datetime.now()

        kiln_model = raw_data.get("kiln_model", "未知窑炉")
        raw_layers = raw_data.get("layers", [])
        layers: List[KilnLayer] = []

        for layer_data in raw_layers:
            layer = KilnLayer(
                layer_name=layer_data.get("layer_name", f"层{len(layers) + 1}"),
                position=layer_data.get("position", "middle"),
                load_type=layer_data.get("load_type", "未知"),
                piece_count=layer_data.get("piece_count", 0),
                expected_temp_offset=layer_data.get("expected_temp_offset", 0.0),
                thermocouple=layer_data.get("thermocouple"),
            )
            layers.append(layer)

        total_pieces = raw_data.get("total_pieces", sum(l.piece_count for l in layers))
        notes = raw_data.get("notes")

        return KilnLoad(
            batch_id=batch_id,
            load_date=load_date,
            kiln_model=kiln_model,
            layers=layers,
            total_pieces=total_pieces,
            notes=notes,
        )

    def validate(self, data: Any) -> bool:
        if not isinstance(data, KilnLoad):
            return False
        if not data.batch_id:
            return False
        if not data.layers:
            return False
        return True


class DefectJSONParser(BaseParser[List[DefectRecord]]):
    def parse(self, file_path: Path) -> List[DefectRecord]:
        if not file_path.exists():
            return []

        with open(file_path, "r", encoding="utf-8") as f:
            raw_data = json.load(f)

        if not isinstance(raw_data, list):
            raw_data = [raw_data]

        defects: List[DefectRecord] = []

        for item in raw_data:
            suspect_phase = item.get("suspect_phase")
            if suspect_phase:
                suspect_phase = self._parse_phase_type(suspect_phase)

            defect = DefectRecord(
                batch_id=item.get("batch_id", "UNKNOWN"),
                piece_id=item.get("piece_id", ""),
                layer_name=item.get("layer_name", ""),
                defect_type=item.get("defect_type", "其他"),
                severity=item.get("severity", "中等"),
                description=item.get("description"),
                suspect_phase=suspect_phase,
                location_x=item.get("location_x"),
                location_y=item.get("location_y"),
            )
            defects.append(defect)

        return defects

    def _parse_phase_type(self, phase_str: str) -> PhaseType:
        type_map = {
            "heating": PhaseType.HEATING,
            "升温": PhaseType.HEATING,
            "holding": PhaseType.HOLDING,
            "保温": PhaseType.HOLDING,
            "cooling": PhaseType.COOLING,
            "冷却": PhaseType.COOLING,
        }
        return type_map.get(phase_str.lower(), PhaseType.HEATING)

    def validate(self, data: Any) -> bool:
        if not isinstance(data, list):
            return False
        return all(isinstance(item, DefectRecord) for item in data)
