from typing import List, Dict, Optional, Tuple
from datetime import datetime
from collections import defaultdict
import hashlib
import json
import os
from .models import WeightRecord, WeightCurveSnapshot, ProcessingStatus
from .field_mapper import FieldMapper
from .unit_normalizer import UnitNormalizer


class WeightCurveManager:
    def __init__(self, config_path: str = None):
        self.field_mapper = FieldMapper()
        self.unit_normalizer = UnitNormalizer(config_path)
        self.records: List[WeightRecord] = []
        self.records_by_pet: Dict[str, List[WeightRecord]] = defaultdict(list)
        base = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        sys_cfg = os.path.join(base, "config", "system_config.json")
        with open(sys_cfg, "r", encoding="utf-8") as f:
            self.sys_cfg = json.load(f)

    def _parse_date(self, raw_value) -> Optional[datetime]:
        if raw_value is None or raw_value == "":
            return None
        if isinstance(raw_value, datetime):
            return raw_value
        formats = ["%Y-%m-%d", "%Y/%m/%d", "%Y.%m.%d",
                   "%Y-%m-%d %H:%M:%S", "%Y/%m/%d %H:%M:%S",
                   "%Y%m%d", "%d/%m/%Y", "%m/%d/%Y"]
        for fmt in formats:
            try:
                return datetime.strptime(str(raw_value).strip(), fmt)
            except:
                continue
        try:
            return datetime.fromisoformat(str(raw_value).strip())
        except:
            return None

    def import_row(self, row: Dict, source_file: str = "", row_num: int = 1) -> Tuple[WeightRecord, Dict]:
        mapped = self.field_mapper.map_row(row)
        trace = mapped.get("__source_trace__", {})
        rec = WeightRecord(
            pet_id=str(mapped.get("pet_id", "")).strip(),
            pet_name=str(mapped.get("pet_name", "")).strip(),
            measure_date=self._parse_date(mapped.get("measure_date")),
            raw_weight_value=str(mapped.get("weight_kg", "")).strip() if mapped.get("weight_kg") is not None else "",
            raw_unit_value=str(mapped.get("weight_unit", "")).strip() if mapped.get("weight_unit") is not None else "",
            data_source=str(mapped.get("data_source", "")).strip(),
            source_file=source_file,
            source_row=row_num,
            remark=str(mapped.get("remark", "")).strip(),
            raw_fields={k: v for k, v in row.items()},
        )
        if not rec.pet_id:
            rec.pet_id = f"__unnamed_{row_num}"
        rec.ensure_stable_id()
        norm = self.unit_normalizer.full_normalize(rec.raw_weight_value, rec.raw_unit_value)
        rec.weight_kg = norm["weight_kg"]
        rec.weight_unit = norm["std_unit"] or ""
        rec.processing_status = norm["status"]
        rec.unit_normalized = norm["unit_normalized"]
        extra = {k: v for k, v in norm.items() if k not in {"weight_kg", "std_unit", "unit_normalized", "status"}}
        extra["field_trace"] = trace
        return rec, extra

    def add_record(self, record: WeightRecord):
        self.records.append(record)
        if record.pet_id:
            self.records_by_pet[record.pet_id].append(record)

    def build_curve(self, pet_id: str) -> WeightCurveSnapshot:
        pet_records = [r for r in self.records_by_pet.get(pet_id, [])
                       if r.weight_kg is not None and r.measure_date]
        pet_records.sort(key=lambda r: r.measure_date)
        pet_name = pet_records[0].pet_name if pet_records else ""
        points = []
        weights = []
        for r in pet_records:
            p = {
                "record_id": r.record_id,
                "date": r.measure_date.isoformat(),
                "weight_kg": r.weight_kg,
                "source": r.data_source or r.source_file,
                "source_file": r.source_file,
                "source_row": r.source_row,
                "status": r.processing_status.value,
                "remark": r.remark,
            }
            points.append(p)
            weights.append(r.weight_kg)
        baseline = weights[0] if weights else None
        last = weights[-1] if weights else None
        trend = "stable"
        calc_note = f"共{len(points)}个有效点"
        if baseline and last and len(weights) >= self.sys_cfg["anomaly_threshold"]["min_records_for_trend"]:
            delta_ratio = (last - baseline) / baseline
            if delta_ratio > 0.1:
                trend = "上升"
            elif delta_ratio < -0.1:
                trend = "下降"
            calc_note += f"；起始={baseline}kg，最新={last}kg，变动率={round(delta_ratio*100,2)}%"
        else:
            calc_note += "（点不足，趋势未计算）"
        return WeightCurveSnapshot(
            pet_id=pet_id,
            pet_name=pet_name,
            points=points,
            trend=trend,
            baseline_weight_kg=baseline,
            last_weight_kg=last,
            calc_note=calc_note,
        )

    def build_all_curves(self) -> Dict[str, WeightCurveSnapshot]:
        return {pid: self.build_curve(pid) for pid in self.records_by_pet.keys()}

    def save_curves_json(self, out_path: str):
        data = {pid: snap.to_dict() for pid, snap in self.build_all_curves().items()}
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return out_path
