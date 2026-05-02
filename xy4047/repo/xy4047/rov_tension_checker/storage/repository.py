"""数据存储仓库"""

import json
import uuid
from datetime import datetime, date
from pathlib import Path
from typing import Any, Dict, List, Optional

from rov_tension_checker.storage.models import (
    AnalysisRecord,
    AnalysisSampleRecord,
    HistoryIndex,
    ScenarioRecord,
)


class AnalysisRepository:
    ANALYSIS_DIR = "analyses"
    SCENARIOS_DIR = "scenarios"
    INDEX_FILE = "history_index.json"
    
    def __init__(self, base_path: str):
        self.base_path = Path(base_path)
        self.analysis_path = self.base_path / self.ANALYSIS_DIR
        self.scenarios_path = self.base_path / self.SCENARIOS_DIR
        self.index_path = self.base_path / self.INDEX_FILE
        
        self._ensure_directories()
    
    def _ensure_directories(self) -> None:
        self.analysis_path.mkdir(parents=True, exist_ok=True)
        self.scenarios_path.mkdir(parents=True, exist_ok=True)
    
    def _load_index(self) -> HistoryIndex:
        if not self.index_path.exists():
            return HistoryIndex()
        
        try:
            with open(self.index_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            return HistoryIndex(
                version=data.get("version", "1.0"),
                analyses=data.get("analyses", [])
            )
        except Exception:
            return HistoryIndex()
    
    def _save_index(self, index: HistoryIndex) -> None:
        with open(self.index_path, 'w', encoding='utf-8') as f:
            json.dump(index.to_dict(), f, ensure_ascii=False, indent=2)
    
    def _generate_id(self) -> str:
        return uuid.uuid4().hex[:12]
    
    def save_analysis(self, record: AnalysisRecord) -> str:
        if not record.analysis_id:
            record.analysis_id = self._generate_id()
        
        filename = f"analysis_{record.analysis_id}.json"
        filepath = self.analysis_path / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(record.to_dict(), f, ensure_ascii=False, indent=2)
        
        self._update_index(record)
        
        return record.analysis_id
    
    def _update_index(self, record: AnalysisRecord) -> None:
        index = self._load_index()
        
        new_entry = {
            "analysis_id": record.analysis_id,
            "project_name": record.project_name,
            "pipeline_id": record.pipeline_id,
            "survey_date": record.survey_date.isoformat(),
            "created_at": record.created_at.isoformat(),
            "sample_count": record.sample_count,
            "critical_risk_count": record.critical_risk_count,
            "warning_risk_count": record.warning_risk_count,
            "filename": f"analysis_{record.analysis_id}.json"
        }
        
        existing_idx = None
        for i, entry in enumerate(index.analyses):
            if entry.get("analysis_id") == record.analysis_id:
                existing_idx = i
                break
        
        if existing_idx is not None:
            index.analyses[existing_idx] = new_entry
        else:
            index.analyses.append(new_entry)
        
        index.analyses.sort(
            key=lambda x: x.get("created_at", ""),
            reverse=True
        )
        
        self._save_index(index)
    
    def load_analysis(self, analysis_id: str) -> Optional[AnalysisRecord]:
        filename = f"analysis_{analysis_id}.json"
        filepath = self.analysis_path / filename
        
        if not filepath.exists():
            return None
        
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            return self._dict_to_analysis_record(data)
        except Exception:
            return None
    
    def _dict_to_analysis_record(self, data: Dict[str, Any]) -> AnalysisRecord:
        from rov_tension_checker.analysis.risk_engine import RiskEvent, RiskSeverity, RiskType
        
        samples: List[AnalysisSampleRecord] = []
        for sample_data in data.get("samples", []):
            risks: List[RiskEvent] = []
            for risk_data in sample_data.get("risks", []):
                try:
                    risk_type = RiskType(risk_data["risk_type"])
                    severity = RiskSeverity(risk_data["severity"])
                    ts = datetime.fromisoformat(risk_data["timestamp"])
                    
                    risks.append(RiskEvent(
                        risk_type=risk_type,
                        severity=severity,
                        timestamp=ts,
                        description=risk_data.get("description", ""),
                        details=risk_data.get("details", {}),
                        sample_index=risk_data.get("sample_index", 0)
                    ))
                except Exception:
                    continue
            
            samples.append(AnalysisSampleRecord(
                sample_index=sample_data.get("sample_index", 0),
                timestamp=datetime.fromisoformat(sample_data["timestamp"])
                if sample_data.get("timestamp") else datetime.now(),
                vessel_latitude=sample_data.get("vessel_latitude"),
                vessel_longitude=sample_data.get("vessel_longitude"),
                vessel_x=sample_data.get("vessel_x"),
                vessel_y=sample_data.get("vessel_y"),
                vessel_heading=sample_data.get("vessel_heading"),
                rov_depth=sample_data.get("rov_depth"),
                rov_cable_length=sample_data.get("rov_cable_length"),
                rov_thrust_forward=sample_data.get("rov_thrust_forward"),
                rov_thrust_vertical=sample_data.get("rov_thrust_vertical"),
                current_speed=sample_data.get("current_speed"),
                current_direction=sample_data.get("current_direction"),
                horizontal_offset=sample_data.get("horizontal_offset"),
                top_tension=sample_data.get("top_tension"),
                bottom_tension=sample_data.get("bottom_tension"),
                tension_ratio=sample_data.get("tension_ratio"),
                safety_margin=sample_data.get("safety_margin"),
                minimum_bending_radius=sample_data.get("minimum_bending_radius"),
                bending_radius_location=sample_data.get("bending_radius_location"),
                top_angle=sample_data.get("top_angle"),
                bottom_angle=sample_data.get("bottom_angle"),
                risks=risks
            ))
        
        return AnalysisRecord(
            analysis_id=data.get("analysis_id", ""),
            project_name=data.get("project_name", ""),
            pipeline_id=data.get("pipeline_id", ""),
            survey_date=datetime.fromisoformat(data["survey_date"])
            if data.get("survey_date") else datetime.now(),
            created_at=datetime.fromisoformat(data["created_at"])
            if data.get("created_at") else datetime.now(),
            sample_count=data.get("sample_count", 0),
            critical_risk_count=data.get("critical_risk_count", 0),
            warning_risk_count=data.get("warning_risk_count", 0),
            risk_summary=data.get("risk_summary", {}),
            max_top_tension=data.get("max_top_tension"),
            min_top_tension=data.get("min_top_tension"),
            avg_top_tension=data.get("avg_top_tension"),
            min_bending_radius=data.get("min_bending_radius"),
            min_bending_radius_location=data.get("min_bending_radius_location"),
            min_cable_length=data.get("min_cable_length"),
            max_cable_length=data.get("max_cable_length"),
            avg_cable_length=data.get("avg_cable_length"),
            max_depth=data.get("max_depth"),
            min_depth=data.get("min_depth"),
            avg_depth=data.get("avg_depth"),
            max_current_speed=data.get("max_current_speed"),
            avg_current_speed=data.get("avg_current_speed"),
            max_horizontal_offset=data.get("max_horizontal_offset"),
            avg_horizontal_offset=data.get("avg_horizontal_offset"),
            samples=samples,
            config_snapshot=data.get("config_snapshot", {})
        )
    
    def query_analyses(
        self,
        pipeline_id: Optional[str] = None,
        survey_date_start: Optional[date] = None,
        survey_date_end: Optional[date] = None,
        has_critical_risks: Optional[bool] = None
    ) -> List[Dict[str, Any]]:
        index = self._load_index()
        
        results: List[Dict[str, Any]] = []
        
        for entry in index.analyses:
            if pipeline_id and entry.get("pipeline_id") != pipeline_id:
                continue
            
            if survey_date_start or survey_date_end:
                try:
                    entry_date = date.fromisoformat(
                        entry["survey_date"].split("T")[0]
                    )
                    if survey_date_start and entry_date < survey_date_start:
                        continue
                    if survey_date_end and entry_date > survey_date_end:
                        continue
                except Exception:
                    continue
            
            if has_critical_risks is not None:
                critical_count = entry.get("critical_risk_count", 0)
                if has_critical_risks and critical_count == 0:
                    continue
                if not has_critical_risks and critical_count > 0:
                    continue
            
            results.append(entry)
        
        return results
    
    def get_latest_analysis(self) -> Optional[AnalysisRecord]:
        index = self._load_index()
        
        if not index.analyses:
            return None
        
        latest = index.analyses[0]
        analysis_id = latest.get("analysis_id")
        
        if analysis_id:
            return self.load_analysis(analysis_id)
        
        return None
    
    def save_scenario(self, record: ScenarioRecord) -> str:
        if not record.scenario_id:
            record.scenario_id = self._generate_id()
        
        filename = f"scenario_{record.scenario_id}_{record.analysis_id}.json"
        filepath = self.scenarios_path / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(record.to_dict(), f, ensure_ascii=False, indent=2)
        
        return record.scenario_id
    
    def load_scenario(self, scenario_id: str, analysis_id: Optional[str] = None) -> Optional[ScenarioRecord]:
        if analysis_id:
            filename = f"scenario_{scenario_id}_{analysis_id}.json"
            filepath = self.scenarios_path / filename
            
            if filepath.exists():
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        data = json.load(f)
                    return self._dict_to_scenario_record(data)
                except Exception:
                    pass
        
        for file in self.scenarios_path.glob(f"scenario_{scenario_id}_*.json"):
            try:
                with open(file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                return self._dict_to_scenario_record(data)
            except Exception:
                continue
        
        return None
    
    def _dict_to_scenario_record(self, data: Dict[str, Any]) -> ScenarioRecord:
        return ScenarioRecord(
            scenario_id=data.get("scenario_id", ""),
            analysis_id=data.get("analysis_id", ""),
            scenario_name=data.get("scenario_name", ""),
            created_at=datetime.fromisoformat(data["created_at"])
            if data.get("created_at") else datetime.now(),
            modifications=data.get("modifications", []),
            original_top_tension=data.get("original_top_tension"),
            scenario_top_tension=data.get("scenario_top_tension"),
            original_bending_radius=data.get("original_bending_radius"),
            scenario_bending_radius=data.get("scenario_bending_radius"),
            original_critical_count=data.get("original_critical_count", 0),
            scenario_critical_count=data.get("scenario_critical_count", 0),
            original_warning_count=data.get("original_warning_count", 0),
            scenario_warning_count=data.get("scenario_warning_count", 0),
            details=data.get("details", {})
        )
    
    def list_scenarios_for_analysis(self, analysis_id: str) -> List[Dict[str, Any]]:
        scenarios: List[Dict[str, Any]] = []
        
        for file in self.scenarios_path.glob(f"scenario_*_{analysis_id}.json"):
            try:
                with open(file, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                scenarios.append({
                    "scenario_id": data.get("scenario_id"),
                    "scenario_name": data.get("scenario_name"),
                    "created_at": data.get("created_at"),
                    "tension_change_percent": data.get("details", {}).get("tension_change_percent")
                })
            except Exception:
                continue
        
        return scenarios
    
    def get_analysis_file_path(self, analysis_id: str) -> Path:
        return self.analysis_path / f"analysis_{analysis_id}.json"
