"""会话存储模块 - 保存和加载复盘会话"""

import json
import os
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import uuid

from ..models import (
    CropZone, LightThreshold,
    LEDSpectrum, SpectrumChannel,
    SensorData, SensorReading,
    ElectricityPrice, PriceTier,
    LightPlan, SupplementInterval, PriorityLevel,
    CalculationResult, ZoneResult,
    ValidationResult, ValidationIssue, IssueSeverity, IssueCategory
)


class SessionData:
    
    def __init__(self):
        self.session_id: str = str(uuid.uuid4())
        self.session_name: str = ""
        self.created_at: str = datetime.now().isoformat()
        self.last_modified_at: str = self.created_at
        self.base_date: str = ""
        self.budget_limit: Optional[float] = None
        
        self.zones: List[CropZone] = []
        self.spectra: List[LEDSpectrum] = []
        self.sensors: List[SensorData] = []
        self.electricity_prices: List[ElectricityPrice] = []
        
        self.light_plan: Optional[LightPlan] = None
        self.calculation_result: Optional[CalculationResult] = None
        self.validation_result: Optional[ValidationResult] = None
        
        self.notes: str = ""
        self.tags: List[str] = []
        self.custom_metadata: Dict[str, Any] = {}
    
    def to_dict(self) -> Dict[str, Any]:
        
        def obj_to_dict(obj: Any) -> Any:
            if hasattr(obj, 'to_dict'):
                return obj.to_dict()
            elif isinstance(obj, list):
                return [obj_to_dict(item) for item in obj]
            elif isinstance(obj, dict):
                return {k: obj_to_dict(v) for k, v in obj.items()}
            else:
                return obj
        
        return {
            "session_id": self.session_id,
            "session_name": self.session_name,
            "created_at": self.created_at,
            "last_modified_at": self.last_modified_at,
            "base_date": self.base_date,
            "budget_limit": self.budget_limit,
            
            "zones": [z.to_dict() for z in self.zones],
            "spectra": [s.to_dict() for s in self.spectra],
            "sensors": [s.to_dict() for s in self.sensors],
            "electricity_prices": [p.to_dict() for p in self.electricity_prices],
            
            "light_plan": self.light_plan.to_dict() if self.light_plan else None,
            "calculation_result": self.calculation_result.to_dict() if self.calculation_result else None,
            "validation_result": self.validation_result.to_dict() if self.validation_result else None,
            
            "notes": self.notes,
            "tags": self.tags,
            "custom_metadata": obj_to_dict(self.custom_metadata)
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "SessionData":
        
        session = cls()
        session.session_id = data.get("session_id", str(uuid.uuid4()))
        session.session_name = data.get("session_name", "")
        session.created_at = data.get("created_at", datetime.now().isoformat())
        session.last_modified_at = data.get("last_modified_at", session.created_at)
        session.base_date = data.get("base_date", "")
        session.budget_limit = data.get("budget_limit")
        
        zones_data = data.get("zones", [])
        session.zones = [CropZone.from_dict(z) for z in zones_data]
        
        spectra_data = data.get("spectra", [])
        session.spectra = [LEDSpectrum.from_dict(s) for s in spectra_data]
        
        sensors_data = data.get("sensors", [])
        session.sensors = [SensorData.from_dict(s) for s in sensors_data]
        
        prices_data = data.get("electricity_prices", [])
        session.electricity_prices = [ElectricityPrice.from_dict(p) for p in prices_data]
        
        light_plan_data = data.get("light_plan")
        if light_plan_data:
            session.light_plan = LightPlan.from_dict(light_plan_data)
        
        calc_result_data = data.get("calculation_result")
        if calc_result_data:
            session.calculation_result = CalculationResult.from_dict(calc_result_data)
        
        validation_data = data.get("validation_result")
        if validation_data:
            session.validation_result = ValidationResult.from_dict(validation_data)
        
        session.notes = data.get("notes", "")
        session.tags = data.get("tags", [])
        session.custom_metadata = data.get("custom_metadata", {})
        
        return session


class SessionManager:
    
    SESSION_EXTENSION = ".lps.json"
    
    def __init__(self, sessions_dir: Optional[str] = None):
        
        if sessions_dir is None:
            sessions_dir = os.path.join(
                os.path.expanduser("~"),
                ".lighting_previewer",
                "sessions"
            )
        
        self.sessions_dir = Path(sessions_dir)
        self.sessions_dir.mkdir(parents=True, exist_ok=True)
    
    def save_session(
        self,
        session: SessionData,
        filename: Optional[str] = None
    ) -> Path:
        
        session.last_modified_at = datetime.now().isoformat()
        
        if filename is None:
            safe_name = "".join(
                c for c in session.session_name
                if c.isalnum() or c in "._- "
            ).strip()
            if not safe_name:
                safe_name = "untitled"
            
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            filename = f"{safe_name}_{session.session_id[:8]}_{timestamp}{self.SESSION_EXTENSION}"
        
        filepath = self.sessions_dir / filename
        
        with open(filepath, 'w', encoding='utf-8') as f:
            json.dump(session.to_dict(), f, ensure_ascii=False, indent=2)
        
        return filepath
    
    def load_session(self, filepath: str) -> SessionData:
        
        path = Path(filepath)
        if not path.exists():
            path = self.sessions_dir / filepath
            if not path.exists():
                raise FileNotFoundError(f"会话文件不存在: {filepath}")
        
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        return SessionData.from_dict(data)
    
    def list_sessions(self) -> List[Dict[str, Any]]:
        
        sessions = []
        
        for filepath in self.sessions_dir.glob(f"*{self.SESSION_EXTENSION}"):
            try:
                with open(filepath, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                session_info = {
                    "filepath": str(filepath),
                    "session_id": data.get("session_id", ""),
                    "session_name": data.get("session_name", ""),
                    "created_at": data.get("created_at", ""),
                    "last_modified_at": data.get("last_modified_at", ""),
                    "base_date": data.get("base_date", ""),
                    "zone_count": len(data.get("zones", [])),
                    "has_plan": data.get("light_plan") is not None,
                    "has_result": data.get("calculation_result") is not None,
                    "file_size_bytes": filepath.stat().st_size
                }
                sessions.append(session_info)
            except Exception as e:
                continue
        
        sessions.sort(
            key=lambda x: x.get("last_modified_at", ""),
            reverse=True
        )
        
        return sessions
    
    def delete_session(self, filepath: str) -> bool:
        
        path = Path(filepath)
        if not path.exists():
            path = self.sessions_dir / filepath
            if not path.exists():
                return False
        
        try:
            path.unlink()
            return True
        except Exception:
            return False
    
    def create_session_from_files(
        self,
        zones_csv: str,
        spectra_csv: str,
        sensor_csv: str,
        price_csv: str,
        session_name: str = "",
        base_date: str = "",
        budget_limit: Optional[float] = None
    ) -> SessionData:
        
        from ..validators import CSVParser
        
        parser = CSVParser()
        
        session = SessionData()
        session.session_name = session_name
        session.base_date = base_date
        session.budget_limit = budget_limit
        
        zones = parser.parse_crop_zones(zones_csv)
        if parser.get_last_errors():
            raise ValueError(f"解析作物分区失败: {parser.get_last_errors()}")
        session.zones = zones
        
        spectra = parser.parse_led_spectra(spectra_csv)
        if parser.get_last_errors():
            raise ValueError(f"解析灯谱数据失败: {parser.get_last_errors()}")
        session.spectra = spectra
        
        sensors = parser.parse_sensor_data(sensor_csv)
        if parser.get_last_errors():
            raise ValueError(f"解析传感器数据失败: {parser.get_last_errors()}")
        session.sensors = sensors
        
        prices = parser.parse_electricity_price(price_csv)
        if parser.get_last_errors():
            raise ValueError(f"解析电价数据失败: {parser.get_last_errors()}")
        session.electricity_prices = prices
        
        return session
    
    def export_session_to_zip(
        self,
        session: SessionData,
        output_path: str
    ) -> Path:
        
        import zipfile
        import tempfile
        
        temp_dir = tempfile.mkdtemp()
        temp_path = Path(temp_dir)
        
        json_path = temp_path / "session.json"
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(session.to_dict(), f, ensure_ascii=False, indent=2)
        
        if session.light_plan:
            light_plan_path = temp_path / "light_plan.json"
            with open(light_plan_path, 'w', encoding='utf-8') as f:
                json.dump(session.light_plan.to_dict(), f, ensure_ascii=False, indent=2)
        
        if session.calculation_result:
            calc_path = temp_path / "calculation_result.json"
            with open(calc_path, 'w', encoding='utf-8') as f:
                json.dump(session.calculation_result.to_dict(), f, ensure_ascii=False, indent=2)
        
        if session.validation_result:
            val_path = temp_path / "validation_result.json"
            with open(val_path, 'w', encoding='utf-8') as f:
                json.dump(session.validation_result.to_dict(), f, ensure_ascii=False, indent=2)
        
        output = Path(output_path)
        if not output.suffix:
            output = output.with_suffix(".zip")
        
        with zipfile.ZipFile(output, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for file_path in temp_path.iterdir():
                zipf.write(file_path, file_path.name)
        
        import shutil
        shutil.rmtree(temp_dir)
        
        return output
    
    def import_session_from_zip(
        self,
        zip_path: str
    ) -> SessionData:
        
        import zipfile
        import tempfile
        
        temp_dir = tempfile.mkdtemp()
        temp_path = Path(temp_dir)
        
        with zipfile.ZipFile(zip_path, 'r') as zipf:
            zipf.extractall(temp_path)
        
        session_json = temp_path / "session.json"
        if session_json.exists():
            with open(session_json, 'r', encoding='utf-8') as f:
                data = json.load(f)
            session = SessionData.from_dict(data)
        else:
            session = SessionData()
        
        import shutil
        shutil.rmtree(temp_dir)
        
        return session
