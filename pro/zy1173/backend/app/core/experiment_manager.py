from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime
from enum import Enum
import json
import uuid
from pathlib import Path
from app.config import settings


class ExperimentType(str, Enum):
    TOKENIZATION = "tokenization"
    INFERENCE = "inference"
    SAMPLING_COMPARISON = "sampling_comparison"
    KV_CACHE_TEST = "kv_cache_test"
    FINE_TUNE = "fine_tune"


@dataclass
class Experiment:
    id: str
    name: str
    type: ExperimentType
    created_at: datetime
    updated_at: datetime
    parameters: Dict[str, Any]
    results: Dict[str, Any]
    risks: List[str]
    input_data: Dict[str, Any]
    notes: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "name": self.name,
            "type": self.type.value if isinstance(self.type, Enum) else self.type,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "parameters": self.parameters,
            "results": self.results,
            "risks": self.risks,
            "input_data": self.input_data,
            "notes": self.notes
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "Experiment":
        return cls(
            id=data["id"],
            name=data["name"],
            type=ExperimentType(data["type"]) if isinstance(data["type"], str) else data["type"],
            created_at=datetime.fromisoformat(data["created_at"]),
            updated_at=datetime.fromisoformat(data["updated_at"]),
            parameters=data["parameters"],
            results=data["results"],
            risks=data.get("risks", []),
            input_data=data.get("input_data", {}),
            notes=data.get("notes", "")
        )


class ExperimentManager:
    def __init__(self, data_dir: Path):
        self.data_dir = data_dir
        self.data_dir.mkdir(parents=True, exist_ok=True)
        self._experiments: Dict[str, Experiment] = {}
        self._load_all_experiments()
    
    def _load_all_experiments(self):
        for json_file in self.data_dir.glob("*.json"):
            try:
                with open(json_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                    experiment = Experiment.from_dict(data)
                    self._experiments[experiment.id] = experiment
            except Exception:
                continue
    
    def create_experiment(self, name: str, exp_type: ExperimentType,
                          parameters: Dict[str, Any], results: Dict[str, Any],
                          risks: List[str] = None, input_data: Dict[str, Any] = None,
                          notes: str = "") -> Experiment:
        experiment_id = str(uuid.uuid4())
        now = datetime.now()
        
        experiment = Experiment(
            id=experiment_id,
            name=name,
            type=exp_type,
            created_at=now,
            updated_at=now,
            parameters=parameters,
            results=results,
            risks=risks or [],
            input_data=input_data or {},
            notes=notes
        )
        
        self._save_experiment(experiment)
        self._experiments[experiment_id] = experiment
        
        return experiment
    
    def _save_experiment(self, experiment: Experiment):
        file_path = self.data_dir / f"{experiment.id}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(experiment.to_dict(), f, ensure_ascii=False, indent=2)
    
    def get_experiment(self, experiment_id: str) -> Optional[Experiment]:
        return self._experiments.get(experiment_id)
    
    def list_experiments(self, exp_type: ExperimentType = None,
                         limit: int = 100, offset: int = 0) -> Dict[str, Any]:
        experiments = list(self._experiments.values())
        
        if exp_type:
            experiments = [e for e in experiments if e.type == exp_type]
        
        experiments.sort(key=lambda x: x.created_at, reverse=True)
        
        total = len(experiments)
        paginated = experiments[offset:offset + limit]
        
        return {
            "total": total,
            "limit": limit,
            "offset": offset,
            "experiments": [e.to_dict() for e in paginated]
        }
    
    def update_experiment(self, experiment_id: str,
                          name: str = None,
                          parameters: Dict[str, Any] = None,
                          results: Dict[str, Any] = None,
                          risks: List[str] = None,
                          input_data: Dict[str, Any] = None,
                          notes: str = None) -> Optional[Experiment]:
        experiment = self._experiments.get(experiment_id)
        if not experiment:
            return None
        
        if name is not None:
            experiment.name = name
        if parameters is not None:
            experiment.parameters = parameters
        if results is not None:
            experiment.results = results
        if risks is not None:
            experiment.risks = risks
        if input_data is not None:
            experiment.input_data = input_data
        if notes is not None:
            experiment.notes = notes
        
        experiment.updated_at = datetime.now()
        self._save_experiment(experiment)
        
        return experiment
    
    def delete_experiment(self, experiment_id: str) -> bool:
        experiment = self._experiments.get(experiment_id)
        if not experiment:
            return False
        
        file_path = self.data_dir / f"{experiment_id}.json"
        if file_path.exists():
            file_path.unlink()
        
        del self._experiments[experiment_id]
        return True
    
    def export_to_markdown(self, experiment_id: str) -> Optional[str]:
        experiment = self._experiments.get(experiment_id)
        if not experiment:
            return None
        
        md_lines = [
            f"# {experiment.name}",
            "",
            "## 基本信息",
            "",
            f"- **实验ID**: {experiment.id}",
            f"- **实验类型**: {experiment.type.value if isinstance(experiment.type, Enum) else experiment.type}",
            f"- **创建时间**: {experiment.created_at.strftime('%Y-%m-%d %H:%M:%S')}",
            f"- **更新时间**: {experiment.updated_at.strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "## 输入数据",
            "",
            "```json",
            json.dumps(experiment.input_data, ensure_ascii=False, indent=2),
            "```",
            "",
            "## 实验参数",
            "",
            "```json",
            json.dumps(experiment.parameters, ensure_ascii=False, indent=2),
            "```",
            "",
            "## 实验结果",
            "",
            "```json",
            json.dumps(experiment.results, ensure_ascii=False, indent=2),
            "```",
        ]
        
        if experiment.risks:
            md_lines.extend([
                "",
                "## ⚠️ 风险说明",
                "",
            ])
            for risk in experiment.risks:
                md_lines.append(f"- {risk}")
        
        if experiment.notes:
            md_lines.extend([
                "",
                "## 备注",
                "",
                experiment.notes
            ])
        
        return "\n".join(md_lines)
    
    def export_to_json(self, experiment_id: str, pretty: bool = True) -> Optional[str]:
        experiment = self._experiments.get(experiment_id)
        if not experiment:
            return None
        
        if pretty:
            return json.dumps(experiment.to_dict(), ensure_ascii=False, indent=2)
        else:
            return json.dumps(experiment.to_dict(), ensure_ascii=False)


experiment_manager = ExperimentManager(settings.EXPERIMENTS_DIR)
