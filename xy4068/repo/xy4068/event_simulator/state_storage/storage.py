import json
import shutil
import tempfile
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from event_simulator.models.event import Event


@dataclass
class ReplayCheckpoint:
    checkpoint_id: str
    scenario_id: str
    created_at: datetime
    current_index: int = 0
    total_events: int = 0
    processed_events: int = 0
    elapsed_seconds: float = 0.0
    speed: float = 1.0
    last_event_time: Optional[datetime] = None
    scenario_start_time: Optional[datetime] = None
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        if self.created_at:
            data["created_at"] = self.created_at.isoformat()
        if self.last_event_time:
            data["last_event_time"] = self.last_event_time.isoformat()
        if self.scenario_start_time:
            data["scenario_start_time"] = self.scenario_start_time.isoformat()
        return data
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "ReplayCheckpoint":
        if "created_at" in data and isinstance(data["created_at"], str):
            data["created_at"] = datetime.fromisoformat(data["created_at"])
        if "last_event_time" in data and isinstance(data["last_event_time"], str):
            data["last_event_time"] = datetime.fromisoformat(data["last_event_time"])
        if "scenario_start_time" in data and isinstance(data["scenario_start_time"], str):
            data["scenario_start_time"] = datetime.fromisoformat(data["scenario_start_time"])
        return cls(**data)


class StateStorage:
    def __init__(self, base_dir: Path):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)
        
        self._checkpoints_dir = self.base_dir / "checkpoints"
        self._checkpoints_dir.mkdir(parents=True, exist_ok=True)
        
        self._events_log_dir = self.base_dir / "events_log"
        self._events_log_dir.mkdir(parents=True, exist_ok=True)
        
        self._temp_dir = self.base_dir / "temp"
        self._temp_dir.mkdir(parents=True, exist_ok=True)
    
    def save_checkpoint(self, checkpoint: ReplayCheckpoint) -> Path:
        checkpoint_path = self._checkpoints_dir / f"{checkpoint.checkpoint_id}.json"
        
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".json",
            dir=self._temp_dir,
            delete=False,
            encoding="utf-8",
        ) as f:
            json.dump(checkpoint.to_dict(), f, indent=2, ensure_ascii=False)
            temp_path = Path(f.name)
        
        shutil.move(str(temp_path), str(checkpoint_path))
        
        latest_link = self._checkpoints_dir / "latest.json"
        if latest_link.exists() or latest_link.is_symlink():
            latest_link.unlink()
        latest_link.symlink_to(checkpoint_path.name)
        
        return checkpoint_path
    
    def load_checkpoint(self, checkpoint_id: Optional[str] = None) -> Optional[ReplayCheckpoint]:
        if checkpoint_id:
            checkpoint_path = self._checkpoints_dir / f"{checkpoint_id}.json"
        else:
            latest_link = self._checkpoints_dir / "latest.json"
            if not latest_link.exists():
                return None
            checkpoint_path = latest_link
        
        if not checkpoint_path.exists():
            return None
        
        try:
            with open(checkpoint_path, "r", encoding="utf-8") as f:
                data = json.load(f)
            return ReplayCheckpoint.from_dict(data)
        except Exception:
            return None
    
    def list_checkpoints(self, scenario_id: Optional[str] = None) -> List[Dict[str, Any]]:
        checkpoints = []
        
        for checkpoint_file in self._checkpoints_dir.glob("*.json"):
            if checkpoint_file.name == "latest.json":
                continue
            
            try:
                with open(checkpoint_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                
                if scenario_id and data.get("scenario_id") != scenario_id:
                    continue
                
                checkpoints.append({
                    "checkpoint_id": data.get("checkpoint_id"),
                    "scenario_id": data.get("scenario_id"),
                    "created_at": data.get("created_at"),
                    "current_index": data.get("current_index"),
                    "total_events": data.get("total_events"),
                    "progress": (data.get("current_index", 0) / data.get("total_events", 1)) * 100
                    if data.get("total_events", 0) > 0 else 0,
                })
            except Exception:
                continue
        
        checkpoints.sort(key=lambda x: x["created_at"] or "", reverse=True)
        return checkpoints
    
    def delete_checkpoint(self, checkpoint_id: str) -> bool:
        checkpoint_path = self._checkpoints_dir / f"{checkpoint_id}.json"
        if checkpoint_path.exists():
            checkpoint_path.unlink()
            
            latest_link = self._checkpoints_dir / "latest.json"
            if latest_link.is_symlink():
                try:
                    target = latest_link.readlink()
                    if str(target) == f"{checkpoint_id}.json":
                        latest_link.unlink()
                except Exception:
                    pass
            
            return True
        return False
    
    def log_event(self, event: Event, log_id: str = "default") -> Path:
        log_file = self._events_log_dir / f"{log_id}.jsonl"
        
        event_data = event.to_dict()
        line = json.dumps(event_data, ensure_ascii=False)
        
        with open(log_file, "a", encoding="utf-8") as f:
            f.write(line + "\n")
        
        return log_file
    
    def load_event_log(self, log_id: str = "default") -> List[Dict[str, Any]]:
        log_file = self._events_log_dir / f"{log_id}.jsonl"
        if not log_file.exists():
            return []
        
        events = []
        with open(log_file, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line:
                    try:
                        events.append(json.loads(line))
                    except Exception:
                        continue
        
        return events
    
    def clear_event_log(self, log_id: str = "default") -> bool:
        log_file = self._events_log_dir / f"{log_id}.jsonl"
        if log_file.exists():
            log_file.unlink()
            return True
        return False
    
    def save_state(self, key: str, data: Dict[str, Any]) -> Path:
        state_file = self.base_dir / f"{key}.json"
        
        with tempfile.NamedTemporaryFile(
            mode="w",
            suffix=".json",
            dir=self._temp_dir,
            delete=False,
            encoding="utf-8",
        ) as f:
            json.dump(data, f, indent=2, ensure_ascii=False)
            temp_path = Path(f.name)
        
        shutil.move(str(temp_path), str(state_file))
        return state_file
    
    def load_state(self, key: str) -> Optional[Dict[str, Any]]:
        state_file = self.base_dir / f"{key}.json"
        if not state_file.exists():
            return None
        
        try:
            with open(state_file, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return None
    
    def clear_all(self) -> None:
        if self._checkpoints_dir.exists():
            for f in self._checkpoints_dir.glob("*"):
                if f.is_file():
                    f.unlink()
        
        if self._events_log_dir.exists():
            for f in self._events_log_dir.glob("*"):
                if f.is_file():
                    f.unlink()
        
        if self._temp_dir.exists():
            for f in self._temp_dir.glob("*"):
                if f.is_file():
                    f.unlink()
