import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any, Optional
from .models import (
    RunnerStatus, AidStationCheck, MedicalEventCheck, AuditPackage, RaceConfig
)


class ReviewStateManager:
    def __init__(self, state_dir: str = ".trail_checker"):
        self.state_dir = Path(state_dir)
        self.state_dir.mkdir(parents=True, exist_ok=True)
        self.runner_state_file = self.state_dir / "runner_review.json"
        self.aid_station_file = self.state_dir / "aid_station_review.json"
        self.medical_file = self.state_dir / "medical_review.json"

    def load_runner_states(self) -> Dict[str, Dict[str, Any]]:
        if not self.runner_state_file.exists():
            return {}
        with open(self.runner_state_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def save_runner_states(self, states: Dict[str, Dict[str, Any]]):
        with open(self.runner_state_file, "w", encoding="utf-8") as f:
            json.dump(states, f, ensure_ascii=False, indent=2, default=str)

    def update_runner(self, bib: str, status: str, notes: str = ""):
        states = self.load_runner_states()
        states[bib] = {
            "review_status": status,
            "review_notes": notes,
            "updated_at": datetime.now().isoformat(),
        }
        self.save_runner_states(states)

    def load_aid_station_states(self) -> Dict[str, Dict[str, Any]]:
        if not self.aid_station_file.exists():
            return {}
        with open(self.aid_station_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def save_aid_station_states(self, states: Dict[str, Dict[str, Any]]):
        with open(self.aid_station_file, "w", encoding="utf-8") as f:
            json.dump(states, f, ensure_ascii=False, indent=2, default=str)

    def update_aid_station(self, station_id: str, status: str, notes: str = ""):
        states = self.load_aid_station_states()
        states[station_id] = {
            "review_status": status,
            "review_notes": notes,
            "updated_at": datetime.now().isoformat(),
        }
        self.save_aid_station_states(states)

    def load_medical_states(self) -> Dict[str, Dict[str, Any]]:
        if not self.medical_file.exists():
            return {}
        with open(self.medical_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def save_medical_states(self, states: Dict[str, Dict[str, Any]]):
        with open(self.medical_file, "w", encoding="utf-8") as f:
            json.dump(states, f, ensure_ascii=False, indent=2, default=str)

    def update_medical(self, event_id: str, status: str, contacted: bool = False, notes: str = ""):
        states = self.load_medical_states()
        states[event_id] = {
            "review_status": status,
            "follow_up_contacted": contacted,
            "follow_up_notes": notes,
            "updated_at": datetime.now().isoformat(),
        }
        self.save_medical_states(states)

    def apply_saved_states(
        self,
        runners: List[RunnerStatus],
        aid_stations: List[AidStationCheck],
        medical_events: List[MedicalEventCheck]
    ):
        runner_states = self.load_runner_states()
        for runner in runners:
            if runner.bib in runner_states:
                state = runner_states[runner.bib]
                runner.review_status = state.get("review_status", "pending")
                runner.review_notes = state.get("review_notes", "")

        aid_states = self.load_aid_station_states()
        for station in aid_stations:
            if station.station_id in aid_states:
                state = aid_states[station.station_id]
                station.review_status = state.get("review_status", "pending")

        medical_states = self.load_medical_states()
        for event in medical_events:
            if event.event_id in medical_states:
                state = medical_states[event.event_id]
                event.review_status = state.get("review_status", "pending")
                event.follow_up_contacted = state.get("follow_up_contacted", False)
                event.follow_up_notes = state.get("follow_up_notes", "")
