import json
import os
from pathlib import Path
from typing import Dict, List, Optional, Set
from datetime import datetime

from .models import (
    AlertInfo,
    ApiContract,
    ApiDiff,
    CallerImpact,
    CallerInfo,
    ChangeAnalysis,
    ConfirmationStatus,
    ManualNote,
    parse_contract,
    parse_caller,
)


class StorageManager:
    def __init__(self, base_dir: str = ".api-impact"):
        self.base_dir = Path(base_dir)
        self.contracts_dir = self.base_dir / "contracts"
        self.callers_dir = self.base_dir / "callers"
        self.analysis_dir = self.base_dir / "analysis"
        self.confirmations_dir = self.base_dir / "confirmations"
        self.alerts_file = self.base_dir / "alerts.json"
        self.notes_file = self.base_dir / "notes.json"
        self._ensure_dirs()

    def _ensure_dirs(self):
        for d in [
            self.base_dir,
            self.contracts_dir,
            self.callers_dir,
            self.analysis_dir,
            self.confirmations_dir,
        ]:
            d.mkdir(parents=True, exist_ok=True)

    def load_contract(self, path: str) -> ApiContract:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return parse_contract(data)

    def save_contract(self, contract: ApiContract, filename: str) -> str:
        path = self.contracts_dir / filename
        with open(path, "w", encoding="utf-8") as f:
            json.dump(contract.model_dump(mode="json"), f, indent=2, ensure_ascii=False)
        return str(path)

    def load_callers(self, path: str) -> List[CallerInfo]:
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        if isinstance(data, list):
            return [parse_caller(item) for item in data]
        return [parse_caller(data)]

    def save_callers(self, callers: List[CallerInfo], filename: str) -> str:
        path = self.callers_dir / filename
        with open(path, "w", encoding="utf-8") as f:
            json.dump(
                [c.model_dump(mode="json") for c in callers],
                f,
                indent=2,
                ensure_ascii=False,
            )
        return str(path)

    def load_alerts(self) -> List[AlertInfo]:
        if not self.alerts_file.exists():
            return []
        with open(self.alerts_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        return [AlertInfo(**item) for item in data]

    def save_alerts(self, alerts: List[AlertInfo]):
        with open(self.alerts_file, "w", encoding="utf-8") as f:
            json.dump(
                [a.model_dump(mode="json") for a in alerts],
                f,
                indent=2,
                ensure_ascii=False,
            )

    def load_notes(self) -> List[ManualNote]:
        if not self.notes_file.exists():
            return []
        with open(self.notes_file, "r", encoding="utf-8") as f:
            data = json.load(f)
        return [ManualNote(**item) for item in data]

    def save_notes(self, notes: List[ManualNote]):
        with open(self.notes_file, "w", encoding="utf-8") as f:
            json.dump(
                [n.model_dump(mode="json") for n in notes],
                f,
                indent=2,
                ensure_ascii=False,
            )

    def save_analysis(self, analysis: ChangeAnalysis) -> str:
        filename = f"{analysis.diff_id}.json"
        path = self.analysis_dir / filename
        existing = self._load_analysis_raw(path)
        if existing:
            merged = self._merge_analysis(existing, analysis)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(merged.model_dump(mode="json"), f, indent=2, ensure_ascii=False)
        else:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(analysis.model_dump(mode="json"), f, indent=2, ensure_ascii=False)
        return str(path)

    def load_analysis(self, diff_id: str) -> Optional[ChangeAnalysis]:
        path = self.analysis_dir / f"{diff_id}.json"
        if not path.exists():
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return ChangeAnalysis(**data)

    def list_analyses(self) -> List[Dict]:
        if not self.analysis_dir.exists():
            return []
        analyses = []
        for p in self.analysis_dir.glob("*.json"):
            with open(p, "r", encoding="utf-8") as f:
                data = json.load(f)
            analyses.append({
                "diff_id": data["diff_id"],
                "api_name": data["api_diff"]["api_name"],
                "old_version": data["api_diff"]["old_version"],
                "new_version": data["api_diff"]["new_version"],
                "generated_at": data["generated_at"],
                "affected_callers": len(data.get("caller_impacts", [])),
            })
        return sorted(analyses, key=lambda x: x["generated_at"], reverse=True)

    def _load_analysis_raw(self, path: Path) -> Optional[ChangeAnalysis]:
        if not path.exists():
            return None
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
        return ChangeAnalysis(**data)

    def _merge_analysis(
        self,
        existing: ChangeAnalysis,
        new: ChangeAnalysis,
    ) -> ChangeAnalysis:
        existing_statuses = {}
        for impact in existing.caller_impacts:
            key = f"{existing.diff_id}:{impact.service_name}"
            existing_statuses[key] = impact.confirmation_status

        merged_impacts = []
        for impact in new.caller_impacts:
            key = f"{new.diff_id}:{impact.service_name}"
            status = existing_statuses.get(key, impact.confirmation_status)
            impact_data = impact.model_dump()
            impact_data["confirmation_status"] = status
            merged_impacts.append(CallerImpact(**impact_data))

        analysis_data = new.model_dump()
        analysis_data["caller_impacts"] = merged_impacts
        analysis_data["generated_at"] = datetime.now()
        return ChangeAnalysis(**analysis_data)

    def update_confirmation(
        self,
        diff_id: str,
        service_name: str,
        status: ConfirmationStatus,
    ) -> bool:
        path = self.analysis_dir / f"{diff_id}.json"
        if not path.exists():
            return False

        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)

        updated = False
        for impact in data.get("caller_impacts", []):
            if impact["service_name"] == service_name:
                impact["confirmation_status"] = status.value
                updated = True

        if updated:
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, indent=2, ensure_ascii=False)
        return updated

    def get_all_confirmations(self) -> Dict[str, ConfirmationStatus]:
        result = {}
        for path in self.analysis_dir.glob("*.json"):
            with open(path, "r", encoding="utf-8") as f:
                data = json.load(f)
            diff_id = data["diff_id"]
            for impact in data.get("caller_impacts", []):
                key = f"{diff_id}:{impact['service_name']}"
                status = impact.get("confirmation_status", "unconfirmed")
                result[key] = ConfirmationStatus(status)
        return result

    def get_callers_without_owner(self, callers: List[CallerInfo]) -> List[str]:
        return [
            c.service_name
            for c in callers
            if not c.owner
        ]
