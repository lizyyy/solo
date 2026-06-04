from __future__ import annotations
from datetime import datetime
from json import dumps, loads
from pathlib import Path

from .models import (
    EvidenceSource,
    MaintenanceScreenshot,
    NameplateData,
    OverrideFlag,
    ParameterEntry,
    Provenance,
    WaterHammerInput,
    WaterHammerResult,
)
from .engine import run_calculation


class DataStore:
    def __init__(self, data_dir: str = "./wh_data"):
        self.data_dir = Path(data_dir)
        self._nameplates_dir = self.data_dir / "nameplates"
        self._screenshots_dir = self.data_dir / "screenshots"
        self._calculations_dir = self.data_dir / "calculations"
        for d in (self._nameplates_dir, self._screenshots_dir, self._calculations_dir):
            d.mkdir(parents=True, exist_ok=True)

    def _json_serialize(self, obj) -> dict:
        return obj.model_dump(mode="json")

    def _json_deserialize(self, data, model_class):
        return model_class.model_validate(data)

    def save_nameplate(self, data: NameplateData) -> Path:
        path = self._nameplates_dir / f"{data.equipment_id}.json"
        path.write_text(dumps(self._json_serialize(data), ensure_ascii=False, indent=2), encoding="utf-8")
        return path

    def load_nameplate(self, equipment_id: str) -> NameplateData | None:
        path = self._nameplates_dir / f"{equipment_id}.json"
        if not path.exists():
            return None
        raw = loads(path.read_text(encoding="utf-8"))
        return self._json_deserialize(raw, NameplateData)

    def list_nameplates(self) -> list[str]:
        return [p.stem for p in self._nameplates_dir.glob("*.json")]

    def save_screenshot(self, data: MaintenanceScreenshot) -> Path:
        path = self._screenshots_dir / f"{data.screenshot_id}.json"
        path.write_text(dumps(self._json_serialize(data), ensure_ascii=False, indent=2), encoding="utf-8")
        return path

    def load_screenshot(self, screenshot_id: str) -> MaintenanceScreenshot | None:
        path = self._screenshots_dir / f"{screenshot_id}.json"
        if not path.exists():
            return None
        raw = loads(path.read_text(encoding="utf-8"))
        return self._json_deserialize(raw, MaintenanceScreenshot)

    def list_screenshots(self) -> list[str]:
        return [p.stem for p in self._screenshots_dir.glob("*.json")]

    def save_calculation(self, calc_id: str, input_data: WaterHammerInput, result: WaterHammerResult) -> Path:
        path = self._calculations_dir / f"{calc_id}.json"
        payload = {
            "calc_id": calc_id,
            "input": self._json_serialize(input_data),
            "result": self._json_serialize(result),
        }
        path.write_text(dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        return path

    def load_calculation(self, calc_id: str) -> tuple[WaterHammerInput, WaterHammerResult] | None:
        path = self._calculations_dir / f"{calc_id}.json"
        if not path.exists():
            return None
        raw = loads(path.read_text(encoding="utf-8"))
        input_data = self._json_deserialize(raw["input"], WaterHammerInput)
        result = self._json_deserialize(raw["result"], WaterHammerResult)
        return (input_data, result)

    def list_calculations(self) -> list[str]:
        return [p.stem for p in self._calculations_dir.glob("*.json")]

    def get_override_flags(self, calc_id: str) -> list[OverrideFlag]:
        loaded = self.load_calculation(calc_id)
        if loaded is None:
            return []
        _, result = loaded
        return result.override_flags

    def link_screenshot_to_parameters(self, screenshot_id: str, calc_id: str) -> WaterHammerInput | None:
        loaded = self.load_calculation(calc_id)
        if loaded is None:
            return None
        input_data, result = loaded
        screenshot = self.load_screenshot(screenshot_id)
        if screenshot is None:
            return None
        now = datetime.now()
        for entry in input_data.parameter_entries:
            if entry.name in screenshot.related_parameter_names:
                new_provenance = Provenance(
                    source=EvidenceSource.MAINTENANCE_SCREENSHOT,
                    detail=f"维修群截图 {screenshot.description}",
                    timestamp=now,
                )
                entry.provenance = new_provenance
        self.save_calculation(calc_id, input_data, result)
        return input_data

    def add_override_reason(self, calc_id: str, param_name: str, reason: str) -> WaterHammerResult | None:
        loaded = self.load_calculation(calc_id)
        if loaded is None:
            return None
        input_data, result = loaded
        found = False
        for flag in result.override_flags:
            if flag.parameter_name == param_name:
                flag.reason = reason
                flag.needs_review = False
                found = True
                break
        if not found:
            return None
        for entry in input_data.parameter_entries:
            if entry.name == param_name:
                entry.is_manually_modified = True
                entry.modification_reason = reason
        updated_result = run_calculation(input_data)
        self.save_calculation(calc_id, input_data, updated_result)
        return updated_result
