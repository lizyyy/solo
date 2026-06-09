from __future__ import annotations
from datetime import datetime
from json import dumps, loads
from pathlib import Path
import uuid

from .models import (
    CalcStatus,
    ChangeRecord,
    ChangeType,
    EvidenceSource,
    MaintenanceScreenshot,
    NameplateData,
    OverrideFlag,
    ParameterEntry,
    Provenance,
    ReportExport,
    WaterHammerInput,
    WaterHammerResult,
)
from .engine import run_calculation, build_report_export


STATUS_ORDER = {
    CalcStatus.DRAFT: 0,
    CalcStatus.NEEDS_REVIEW: 1,
    CalcStatus.REVIEWED_BY_TRAINER: 2,
    CalcStatus.APPROVED: 3,
    CalcStatus.REJECTED: 4,
    CalcStatus.FINALIZED: 5,
}


class DataStore:
    def __init__(self, data_dir: str = "./wh_data"):
        self.data_dir = Path(data_dir)
        self._nameplates_dir = self.data_dir / "nameplates"
        self._screenshots_dir = self.data_dir / "screenshots"
        self._calculations_dir = self.data_dir / "calculations"
        self._reports_dir = self.data_dir / "reports"
        for d in (
            self._nameplates_dir,
            self._screenshots_dir,
            self._calculations_dir,
            self._reports_dir,
        ):
            d.mkdir(parents=True, exist_ok=True)

    def _make_change_id(self) -> str:
        return uuid.uuid4().hex[:8]

    def _json_serialize(self, obj) -> dict:
        return obj.model_dump(mode="json")

    def _json_deserialize(self, data, model_class):
        return model_class.model_validate(data)

    def _append_change(self, calc_id: str, record: ChangeRecord):
        loaded = self.load_calculation(calc_id)
        if loaded is None:
            return
        input_data, result = loaded
        result.change_history.append(record)
        self.save_calculation(calc_id, input_data, result)

    def save_nameplate(self, data: NameplateData) -> Path:
        path = self._nameplates_dir / f"{data.equipment_id}.json"
        path.write_text(
            dumps(self._json_serialize(data), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
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
        path.write_text(
            dumps(self._json_serialize(data), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return path

    def load_screenshot(self, screenshot_id: str) -> MaintenanceScreenshot | None:
        path = self._screenshots_dir / f"{screenshot_id}.json"
        if not path.exists():
            return None
        raw = loads(path.read_text(encoding="utf-8"))
        return self._json_deserialize(raw, MaintenanceScreenshot)

    def list_screenshots(self) -> list[str]:
        return [p.stem for p in self._screenshots_dir.glob("*.json")]

    def save_calculation(
        self, calc_id: str, input_data: WaterHammerInput, result: WaterHammerResult
    ) -> Path:
        result.calc_id = calc_id
        path = self._calculations_dir / f"{calc_id}.json"
        payload = {
            "calc_id": calc_id,
            "input": self._json_serialize(input_data),
            "result": self._json_serialize(result),
        }
        path.write_text(
            dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        return path

    def load_calculation(
        self, calc_id: str,
    ) -> tuple[WaterHammerInput, WaterHammerResult] | None:
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

    def get_change_history(self, calc_id: str) -> list[ChangeRecord]:
        loaded = self.load_calculation(calc_id)
        if loaded is None:
            return []
        _, result = loaded
        return result.change_history

    def link_screenshot_to_parameters(
        self, screenshot_id: str, calc_id: str,
    ) -> WaterHammerResult | None:
        loaded = self.load_calculation(calc_id)
        if loaded is None:
            return None
        input_data, _ = loaded
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
        new_result = run_calculation(input_data)
        change_record = ChangeRecord(
            change_id=self._make_change_id(),
            change_type=ChangeType.SCREENSHOT_LINK,
            timestamp=now,
            operator="训练教练老唐",
            reason=screenshot.description,
            related_screenshot_id=screenshot_id,
        )
        new_result.change_history.append(change_record)
        self.save_calculation(calc_id, input_data, new_result)
        return new_result

    def add_override_reason(
        self, calc_id: str, param_name: str, reason: str, reviewer: Optional[str] = None,
    ) -> WaterHammerResult | None:
        loaded = self.load_calculation(calc_id)
        if loaded is None:
            return None
        input_data, result = loaded
        found = False
        for flag in result.override_flags:
            if flag.parameter_name == param_name:
                flag.reason = reason
                flag.needs_review = False
                if reviewer:
                    flag.reviewer = reviewer
                found = True
                break
        if not found:
            return None
        for entry in input_data.parameter_entries:
            if entry.name == param_name:
                entry.is_manually_modified = True
                entry.modification_reason = reason
        preserved_flags = list(result.override_flags)
        updated_result = run_calculation(input_data)
        updated_result.override_flags = preserved_flags
        all_resolved = all(
            not f.needs_review or f.reason is not None
            for f in updated_result.override_flags
        )
        if all_resolved and updated_result.pressure_rise <= 10e6:
            if STATUS_ORDER.get(updated_result.status, 0) < STATUS_ORDER.get(
                CalcStatus.REVIEWED_BY_TRAINER, 0
            ):
                updated_result.status = CalcStatus.REVIEWED_BY_TRAINER
        change_record = ChangeRecord(
            change_id=self._make_change_id(),
            change_type=ChangeType.OVERRIDE_REASON,
            timestamp=datetime.now(),
            operator=reviewer if reviewer else "设备工程师",
            reason=reason,
            parameter_name=param_name,
            reviewer=reviewer,
        )
        updated_result.change_history.extend(result.change_history)
        updated_result.change_history.append(change_record)
        updated_result.reviewed_by_engineer = result.reviewed_by_engineer
        updated_result.reviewed_by_trainer = result.reviewed_by_trainer
        updated_result.engineer_name = result.engineer_name
        updated_result.trainer_name = result.trainer_name
        self.save_calculation(calc_id, input_data, updated_result)
        return updated_result

    def review_by_engineer(
        self, calc_id: str, approve: bool, reviewer: str, comments: str,
    ) -> WaterHammerResult | None:
        loaded = self.load_calculation(calc_id)
        if loaded is None:
            return None
        input_data, result = loaded
        if approve:
            for flag in result.override_flags:
                flag.needs_review = False
                flag.reviewer = reviewer
                if flag.reason is None:
                    flag.reason = comments
        if approve:
            result.status = CalcStatus.APPROVED
        else:
            result.status = CalcStatus.REJECTED
        result.reviewed_by_engineer = True
        result.engineer_name = reviewer
        change_record = ChangeRecord(
            change_id=self._make_change_id(),
            change_type=ChangeType.ENGINEER_REVIEW,
            timestamp=datetime.now(),
            operator=reviewer,
            reason=comments,
            reviewer=reviewer,
            comments=comments,
        )
        result.change_history.append(change_record)
        preserved_history = list(result.change_history)
        preserved_status = result.status
        preserved_reviewed_by_engineer = result.reviewed_by_engineer
        preserved_reviewed_by_trainer = result.reviewed_by_trainer
        preserved_engineer_name = result.engineer_name
        preserved_trainer_name = result.trainer_name
        preserved_calc_id = result.calc_id
        preserved_flags = list(result.override_flags)
        rerun_result = run_calculation(input_data)
        rerun_result.change_history = preserved_history
        rerun_result.status = preserved_status
        rerun_result.reviewed_by_engineer = preserved_reviewed_by_engineer
        rerun_result.reviewed_by_trainer = preserved_reviewed_by_trainer
        rerun_result.engineer_name = preserved_engineer_name
        rerun_result.trainer_name = preserved_trainer_name
        rerun_result.calc_id = preserved_calc_id
        rerun_result.override_flags = preserved_flags
        self.save_calculation(calc_id, input_data, rerun_result)
        return rerun_result

    def review_by_trainer(
        self, calc_id: str, reviewer: str, comments: str,
    ) -> WaterHammerResult | None:
        loaded = self.load_calculation(calc_id)
        if loaded is None:
            return None
        input_data, result = loaded
        result.reviewed_by_trainer = True
        result.trainer_name = reviewer
        current_order = STATUS_ORDER.get(result.status, 0)
        trainer_order = STATUS_ORDER.get(CalcStatus.REVIEWED_BY_TRAINER, 0)
        if current_order < trainer_order:
            result.status = CalcStatus.REVIEWED_BY_TRAINER
        change_record = ChangeRecord(
            change_id=self._make_change_id(),
            change_type=ChangeType.TRAINER_REVIEW,
            timestamp=datetime.now(),
            operator=reviewer,
            reason=comments,
            reviewer=reviewer,
            comments=comments,
        )
        result.change_history.append(change_record)
        self.save_calculation(calc_id, input_data, result)
        return result

    def finalize_calc(self, calc_id: str) -> WaterHammerResult | None:
        loaded = self.load_calculation(calc_id)
        if loaded is None:
            return None
        input_data, result = loaded
        status_before = result.status.value
        result.status = CalcStatus.FINALIZED
        change_record = ChangeRecord(
            change_id=self._make_change_id(),
            change_type=ChangeType.STATUS_CHANGE,
            timestamp=datetime.now(),
            operator="系统",
            reason="归档计算结果",
            status_before=status_before,
            status_after=CalcStatus.FINALIZED.value,
        )
        result.change_history.append(change_record)
        self.save_calculation(calc_id, input_data, result)
        return result

    def export_report(self, calc_id: str) -> tuple[ReportExport, str] | None:
        loaded = self.load_calculation(calc_id)
        if loaded is None:
            return None
        input_data, result = loaded
        report = build_report_export(calc_id, input_data, result)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        path = self._reports_dir / f"{calc_id}_{timestamp}.json"
        path.write_text(
            dumps(self._json_serialize(report), ensure_ascii=False, indent=2),
            encoding="utf-8",
        )
        return report, str(path)
