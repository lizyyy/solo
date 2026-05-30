import json
import os
from dataclasses import dataclass, field, asdict
from typing import List, Optional, Dict, Any


@dataclass
class Provenance:
    source_file: str
    provider: str
    received_date: str
    notes: str = ""


@dataclass
class TempOperatingRange:
    outdoor_min_c: float
    outdoor_max_c: float
    water_outlet_min_c: float
    water_outlet_max_c: float


@dataclass
class RatedPoint:
    outdoor_temp_c: float
    water_outlet_temp_c: float
    heating_capacity_kw: float
    compressor_power_kw: float
    cop: float = 0.0

    def __post_init__(self):
        if self.cop == 0.0 and self.compressor_power_kw > 0:
            self.cop = round(self.heating_capacity_kw / self.compressor_power_kw, 4)
        if self.compressor_power_kw == 0.0 and self.cop > 0:
            self.compressor_power_kw = round(self.heating_capacity_kw / self.cop, 4)


@dataclass
class EquipmentParams:
    name: str
    model: str
    rated_points: List[RatedPoint]
    operating_range: TempOperatingRange
    carnot_fraction: Optional[float] = None
    provenance: Optional[Provenance] = None


@dataclass
class TempBin:
    outdoor_temp_c: float
    hours: float


@dataclass
class TempCurve:
    location: str
    season: str
    bins: List[TempBin]
    design_outdoor_temp_c: float
    provenance: Optional[Provenance] = None


@dataclass
class TimeOfUseRate:
    label: str
    price_per_kwh: float
    hours_per_year: float


@dataclass
class ElectricityData:
    name: str
    flat_rate_yuan_per_kwh: Optional[float] = None
    time_of_use: Optional[List[TimeOfUseRate]] = None
    provenance: Optional[Provenance] = None

    def effective_rate(self) -> float:
        if self.flat_rate_yuan_per_kwh is not None:
            return self.flat_rate_yuan_per_kwh
        if self.time_of_use:
            total_cost = sum(r.price_per_kwh * r.hours_per_year for r in self.time_of_use)
            total_hours = sum(r.hours_per_year for r in self.time_of_use)
            if total_hours > 0:
                return round(total_cost / total_hours, 6)
        return 0.0


@dataclass
class CompetingFuel:
    name: str
    price_per_unit: float
    unit: str
    energy_per_unit_kwh: float
    efficiency: float


@dataclass
class AuditEntry:
    step: str
    source: str
    input_values: Dict[str, Any]
    output_values: Dict[str, Any]
    formula: str = ""
    warnings: List[str] = field(default_factory=list)


@dataclass
class CalcResult:
    outdoor_temp_c: float
    water_outlet_temp_c: float
    t_hot_k: float
    t_cold_k: float
    delta_t_k: float
    carnot_cop: float
    carnot_fraction: float
    actual_cop: float
    heating_capacity_kw: float
    compressor_power_kw: float
    audit: List[AuditEntry] = field(default_factory=list)


@dataclass
class SliceResult:
    temp_band: str
    avg_outdoor_temp_c: float
    total_hours: float
    avg_cop: float
    total_heating_kwh: float
    total_electricity_kwh: float
    total_cost_yuan: float
    audit: List[AuditEntry] = field(default_factory=list)


@dataclass
class SchemeCost:
    scheme_name: str
    total_heating_kwh: float
    total_electricity_kwh: float
    total_cost_yuan: float
    avg_cop: float
    equivalent_fuel_cost_yuan: float
    annual_saving_yuan: float
    payback_years: Optional[float] = None
    audit: List[AuditEntry] = field(default_factory=list)


class DataStore:
    def __init__(self):
        self.equipments: Dict[str, EquipmentParams] = {}
        self.temp_curves: Dict[str, TempCurve] = {}
        self.electricity: Dict[str, ElectricityData] = {}
        self.competing_fuels: Dict[str, CompetingFuel] = {}
        self._import_log: List[Dict[str, str]] = []

    def import_equipment(self, filepath: str) -> EquipmentParams:
        with open(filepath, "r", encoding="utf-8") as f:
            raw = json.load(f)
        prov = Provenance(
            source_file=os.path.basename(filepath),
            provider=raw.get("provenance", {}).get("provider", "未知"),
            received_date=raw.get("provenance", {}).get("received_date", "未知"),
            notes=raw.get("provenance", {}).get("notes", ""),
        )
        op_range = TempOperatingRange(**raw["operating_range"])
        rated_points = [RatedPoint(**rp) for rp in raw["rated_points"]]
        eq = EquipmentParams(
            name=raw["name"],
            model=raw["model"],
            rated_points=rated_points,
            operating_range=op_range,
            carnot_fraction=raw.get("carnot_fraction"),
            provenance=prov,
        )
        self.equipments[eq.name] = eq
        self._import_log.append({"type": "equipment", "name": eq.name, "file": prov.source_file, "provider": prov.provider, "date": prov.received_date})
        return eq

    def import_temp_curve(self, filepath: str) -> TempCurve:
        with open(filepath, "r", encoding="utf-8") as f:
            raw = json.load(f)
        prov = Provenance(
            source_file=os.path.basename(filepath),
            provider=raw.get("provenance", {}).get("provider", "未知"),
            received_date=raw.get("provenance", {}).get("received_date", "未知"),
            notes=raw.get("provenance", {}).get("notes", ""),
        )
        bins = [TempBin(**b) for b in raw["bins"]]
        tc = TempCurve(
            location=raw["location"],
            season=raw["season"],
            bins=bins,
            design_outdoor_temp_c=raw["design_outdoor_temp_c"],
            provenance=prov,
        )
        key = f"{tc.location}_{tc.season}"
        self.temp_curves[key] = tc
        self._import_log.append({"type": "temp_curve", "name": key, "file": prov.source_file, "provider": prov.provider, "date": prov.received_date})
        return tc

    def import_electricity(self, filepath: str) -> ElectricityData:
        with open(filepath, "r", encoding="utf-8") as f:
            raw = json.load(f)
        prov = Provenance(
            source_file=os.path.basename(filepath),
            provider=raw.get("provenance", {}).get("provider", "未知"),
            received_date=raw.get("provenance", {}).get("received_date", "未知"),
            notes=raw.get("provenance", {}).get("notes", ""),
        )
        tou = None
        if "time_of_use" in raw and raw["time_of_use"]:
            tou = [TimeOfUseRate(**r) for r in raw["time_of_use"]]
        ed = ElectricityData(
            name=raw["name"],
            flat_rate_yuan_per_kwh=raw.get("flat_rate_yuan_per_kwh"),
            time_of_use=tou,
            provenance=prov,
        )
        self.electricity[ed.name] = ed
        self._import_log.append({"type": "electricity", "name": ed.name, "file": prov.source_file, "provider": prov.provider, "date": prov.received_date})
        return ed

    def import_competing_fuel(self, filepath: str) -> CompetingFuel:
        with open(filepath, "r", encoding="utf-8") as f:
            raw = json.load(f)
        cf = CompetingFuel(**raw)
        self.competing_fuels[cf.name] = cf
        return cf

    def import_log(self) -> List[Dict[str, str]]:
        return list(self._import_log)

    def summary(self) -> str:
        lines = ["=" * 60, "已导入数据总览", "=" * 60]
        for entry in self._import_log:
            lines.append(f"  [{entry['type']}] {entry['name']}  ← {entry['file']}  提供方={entry['provider']}  日期={entry['date']}")
        lines.append(f"\n  设备: {len(self.equipments)}  温度曲线: {len(self.temp_curves)}  电价: {len(self.electricity)}  替代燃料: {len(self.competing_fuels)}")
        return "\n".join(lines)
