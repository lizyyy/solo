import os
import json
import shutil
from datetime import datetime
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, asdict, field
from benchmark_runner import BenchmarkResult, BenchmarkConfig

@dataclass
class Experiment:
    id: str
    name: str
    description: str
    config: Dict[str, Any]
    result: Optional[Dict[str, Any]] = None
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    updated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    tags: List[str] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Experiment':
        return cls(**data)

@dataclass
class Comparison:
    id: str
    name: str
    experiment_ids: List[str]
    metrics: List[str]
    created_at: str = field(default_factory=lambda: datetime.now().isoformat())
    notes: str = ""
    
    def to_dict(self) -> Dict[str, Any]:
        return asdict(self)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Comparison':
        return cls(**data)

class DataManager:
    def __init__(self, data_dir: str = None):
        if data_dir is None:
            base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
            data_dir = os.path.join(base_dir, "data")
        
        self.data_dir = data_dir
        self.experiments_dir = os.path.join(data_dir, "experiments")
        self.comparisons_dir = os.path.join(data_dir, "comparisons")
        self.exports_dir = os.path.join(data_dir, "exports")
        self.workloads_dir = os.path.join(data_dir, "workloads")
        
        self._ensure_directories()
    
    def _ensure_directories(self):
        for d in [self.data_dir, self.experiments_dir, self.comparisons_dir, 
                  self.exports_dir, self.workloads_dir]:
            os.makedirs(d, exist_ok=True)
    
    def create_experiment(self, name: str, description: str, config: Dict[str, Any], 
                          tags: List[str] = None) -> Experiment:
        exp_id = f"exp_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
        
        experiment = Experiment(
            id=exp_id,
            name=name,
            description=description,
            config=config,
            tags=tags or []
        )
        
        self._save_experiment(experiment)
        return experiment
    
    def _save_experiment(self, experiment: Experiment):
        experiment.updated_at = datetime.now().isoformat()
        file_path = os.path.join(self.experiments_dir, f"{experiment.id}.json")
        with open(file_path, 'w') as f:
            json.dump(experiment.to_dict(), f, indent=2)
    
    def get_experiment(self, exp_id: str) -> Optional[Experiment]:
        file_path = os.path.join(self.experiments_dir, f"{exp_id}.json")
        if not os.path.exists(file_path):
            return None
        
        with open(file_path, 'r') as f:
            data = json.load(f)
            return Experiment.from_dict(data)
    
    def update_experiment_result(self, exp_id: str, result: Dict[str, Any]) -> bool:
        experiment = self.get_experiment(exp_id)
        if experiment is None:
            return False
        
        experiment.result = result
        self._save_experiment(experiment)
        return True
    
    def list_experiments(self, limit: int = 100, offset: int = 0) -> List[Dict[str, Any]]:
        experiments = []
        files = sorted(
            [f for f in os.listdir(self.experiments_dir) if f.endswith('.json')],
            reverse=True
        )
        
        for f in files[offset:offset+limit]:
            file_path = os.path.join(self.experiments_dir, f)
            with open(file_path, 'r') as fp:
                data = json.load(fp)
                experiments.append({
                    "id": data["id"],
                    "name": data["name"],
                    "description": data["description"],
                    "created_at": data["created_at"],
                    "updated_at": data["updated_at"],
                    "has_result": data["result"] is not None,
                    "test_name": data["config"].get("test_name", "unknown") if data["config"] else "unknown",
                    "tags": data.get("tags", [])
                })
        
        return experiments
    
    def delete_experiment(self, exp_id: str) -> bool:
        file_path = os.path.join(self.experiments_dir, f"{exp_id}.json")
        if os.path.exists(file_path):
            os.unlink(file_path)
            return True
        return False
    
    def create_comparison(self, name: str, experiment_ids: List[str], 
                          metrics: List[str] = None, notes: str = "") -> Comparison:
        comp_id = f"comp_{datetime.now().strftime('%Y%m%d_%H%M%S_%f')}"
        
        comparison = Comparison(
            id=comp_id,
            name=name,
            experiment_ids=experiment_ids,
            metrics=metrics or ["total_time_ms", "throughput_mbs", "avg_latency_ns", "cache_hits", "cache_misses"],
            notes=notes
        )
        
        self._save_comparison(comparison)
        return comparison
    
    def _save_comparison(self, comparison: Comparison):
        file_path = os.path.join(self.comparisons_dir, f"{comparison.id}.json")
        with open(file_path, 'w') as f:
            json.dump(comparison.to_dict(), f, indent=2)
    
    def get_comparison(self, comp_id: str) -> Optional[Comparison]:
        file_path = os.path.join(self.comparisons_dir, f"{comp_id}.json")
        if not os.path.exists(file_path):
            return None
        
        with open(file_path, 'r') as f:
            data = json.load(f)
            return Comparison.from_dict(data)
    
    def list_comparisons(self) -> List[Dict[str, Any]]:
        comparisons = []
        files = sorted(
            [f for f in os.listdir(self.comparisons_dir) if f.endswith('.json')],
            reverse=True
        )
        
        for f in files:
            file_path = os.path.join(self.comparisons_dir, f)
            with open(file_path, 'r') as fp:
                data = json.load(fp)
                comparisons.append({
                    "id": data["id"],
                    "name": data["name"],
                    "experiment_count": len(data["experiment_ids"]),
                    "created_at": data["created_at"],
                    "notes": data.get("notes", "")
                })
        
        return comparisons
    
    def run_comparison_analysis(self, comp_id: str) -> Dict[str, Any]:
        comparison = self.get_comparison(comp_id)
        if comparison is None:
            return {"error": "Comparison not found"}
        
        experiments = []
        for exp_id in comparison.experiment_ids:
            exp = self.get_experiment(exp_id)
            if exp and exp.result:
                experiments.append({
                    "id": exp.id,
                    "name": exp.name,
                    "config": exp.config,
                    "result": exp.result
                })
        
        if len(experiments) < 2:
            return {"error": "Need at least 2 experiments with results to compare"}
        
        baseline_idx = 0
        baseline = experiments[baseline_idx]["result"]
        
        analysis = {
            "comparison_id": comp_id,
            "name": comparison.name,
            "experiments": experiments,
            "metrics": comparison.metrics,
            "baseline_index": baseline_idx,
            "comparisons": []
        }
        
        for metric in comparison.metrics:
            metric_comparison = {
                "metric": metric,
                "baseline_value": baseline.get(metric, 0),
                "values": []
            }
            
            for i, exp in enumerate(experiments):
                value = exp["result"].get(metric, 0)
                if baseline.get(metric, 0) != 0:
                    relative_change = (value - baseline[metric]) / baseline[metric] * 100
                else:
                    relative_change = 0
                
                metric_comparison["values"].append({
                    "experiment_id": exp["id"],
                    "experiment_name": exp["name"],
                    "value": value,
                    "relative_change_pct": relative_change
                })
            
            analysis["comparisons"].append(metric_comparison)
        
        return analysis
    
    def import_workload(self, file_path: str) -> Dict[str, Any]:
        if not os.path.exists(file_path):
            return {"error": "File not found"}
        
        with open(file_path, 'r') as f:
            data = json.load(f)
        
        if "experiments" in data:
            for exp_data in data["experiments"]:
                exp = Experiment.from_dict(exp_data)
                self._save_experiment(exp)
            return {"imported": len(data["experiments"]), "type": "experiments"}
        
        if "comparisons" in data:
            for comp_data in data["comparisons"]:
                comp = Comparison.from_dict(comp_data)
                self._save_comparison(comp)
            return {"imported": len(data["comparisons"]), "type": "comparisons"}
        
        if "test_name" in data or "array_size" in data:
            exp = self.create_experiment(
                name=data.get("name", "Imported Workload"),
                description=data.get("description", ""),
                config=data
            )
            return {"imported": 1, "experiment_id": exp.id, "type": "workload"}
        
        return {"error": "Unknown workload format"}
    
    def export_to_json(self, exp_id: str) -> Optional[str]:
        experiment = self.get_experiment(exp_id)
        if experiment is None:
            return None
        
        file_path = os.path.join(self.exports_dir, f"{exp_id}.json")
        with open(file_path, 'w') as f:
            json.dump(experiment.to_dict(), f, indent=2)
        
        return file_path
    
    def export_all_to_json(self) -> str:
        all_data = {
            "exported_at": datetime.now().isoformat(),
            "experiments": [],
            "comparisons": []
        }
        
        for f in os.listdir(self.experiments_dir):
            if f.endswith('.json'):
                with open(os.path.join(self.experiments_dir, f), 'r') as fp:
                    all_data["experiments"].append(json.load(fp))
        
        for f in os.listdir(self.comparisons_dir):
            if f.endswith('.json'):
                with open(os.path.join(self.comparisons_dir, f), 'r') as fp:
                    all_data["comparisons"].append(json.load(fp))
        
        file_path = os.path.join(self.exports_dir, f"export_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json")
        with open(file_path, 'w') as f:
            json.dump(all_data, f, indent=2)
        
        return file_path
