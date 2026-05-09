from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional, Any
import json
import csv
import yaml

from .models import Batch, Sample, RecheckRecord, SamplingRule
from .data_cleaner import DataCleaner


class IOHandler:
    def __init__(self, cleaner: Optional[DataCleaner] = None):
        self.cleaner = cleaner or DataCleaner()

    def load_yaml(self, path: Path) -> Any:
        with open(path, "r", encoding="utf-8") as f:
            return yaml.safe_load(f)

    def load_json(self, path: Path) -> Any:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def load_csv(self, path: Path) -> List[Dict[str, Any]]:
        with open(path, "r", encoding="utf-8-sig") as f:
            reader = csv.DictReader(f)
            return list(reader)

    def load_file(self, path: Path) -> Any:
        ext = path.suffix.lower()
        if ext in {".yaml", ".yml"}:
            return self.load_yaml(path)
        elif ext == ".json":
            return self.load_json(path)
        elif ext == ".csv":
            return self.load_csv(path)
        else:
            raise ValueError(f"不支持的文件格式: {ext}")

    def load_sampling_rules(self, path: Path) -> List[SamplingRule]:
        data = self.load_file(path)
        
        if isinstance(data, dict) and "rules" in data:
            raw_rules = data["rules"]
        elif isinstance(data, list):
            raw_rules = data
        else:
            raise ValueError(f"无法解析抽样规则文件: {path}")
        
        rules = []
        for i, raw in enumerate(raw_rules):
            rule = self.cleaner.clean_sampling_rule(raw, i)
            if rule:
                rules.append(rule)
        
        return rules

    def load_batches(self, batches_path: Path, samples_path: Optional[Path] = None,
                     rechecks_path: Optional[Path] = None) -> List[Batch]:
        batches_data = self.load_file(batches_path)
        
        raw_batches = []
        if isinstance(batches_data, dict) and "batches" in batches_data:
            raw_batches = batches_data["batches"]
        elif isinstance(batches_data, list):
            raw_batches = batches_data
        else:
            raise ValueError(f"无法解析批次文件: {batches_path}")
        
        samples_by_batch: Dict[str, List[Dict]] = {}
        if samples_path:
            samples_data = self.load_file(samples_path)
            if isinstance(samples_data, dict) and "samples" in samples_data:
                samples_data = samples_data["samples"]
            for s in samples_data:
                bid = s.get("batch_id") or s.get("批次号")
                if bid:
                    samples_by_batch.setdefault(str(bid), []).append(s)
        
        rechecks_by_batch: Dict[str, List[Dict]] = {}
        if rechecks_path:
            rechecks_data = self.load_file(rechecks_path)
            if isinstance(rechecks_data, dict) and "rechecks" in rechecks_data:
                rechecks_data = rechecks_data["rechecks"]
            for r in rechecks_data:
                bid = r.get("batch_id") or r.get("批次号")
                if bid:
                    rechecks_by_batch.setdefault(str(bid), []).append(r)
        
        batches = []
        for raw in raw_batches:
            bid = str(raw.get("batch_id") or raw.get("批次号", ""))
            
            if bid in samples_by_batch:
                raw_samples = samples_by_batch[bid]
            elif "samples" in raw:
                raw_samples = raw["samples"]
            else:
                raw_samples = []
            
            if bid in rechecks_by_batch:
                raw_rechecks = rechecks_by_batch[bid]
            elif "rechecks" in raw:
                raw_rechecks = raw["rechecks"]
            else:
                raw_rechecks = []
            
            batch = self.cleaner.clean_batch(raw, raw_samples, raw_rechecks)
            if batch:
                batches.append(batch)
        
        return batches

    def save_json(self, data: Any, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)

    def save_text(self, text: str, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            f.write(text)

    def save_csv(self, content: str, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8-sig", newline="") as f:
            f.write(content)


class HistoryManager:
    def __init__(self, history_dir: Path):
        self.history_dir = history_dir
        self.history_dir.mkdir(parents=True, exist_ok=True)
        self.index_file = history_dir / "index.json"
        self._ensure_index()

    def _ensure_index(self) -> None:
        if not self.index_file.exists():
            self.save_json({"runs": []}, self.index_file)

    @staticmethod
    def save_json(data: Any, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False, default=str)

    @staticmethod
    def load_json(path: Path) -> Any:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)

    def record_run(self, run_id: str, command: str, input_files: List[str],
                   output_files: List[str], summary: Dict) -> None:
        index = self.load_json(self.index_file)
        index["runs"].append({
            "run_id": run_id,
            "timestamp": datetime.now().isoformat(),
            "command": command,
            "input_files": input_files,
            "output_files": output_files,
            "summary": summary,
        })
        self.save_json(index, self.index_file)

    def list_runs(self, limit: int = 20) -> List[Dict]:
        index = self.load_json(self.index_file)
        runs = index.get("runs", [])
        return runs[-limit:]

    def get_run(self, run_id: str) -> Optional[Dict]:
        index = self.load_json(self.index_file)
        for run in index.get("runs", []):
            if run["run_id"] == run_id:
                return run
        return None

    def get_run_path(self, run_id: str) -> Path:
        return self.history_dir / run_id

    def save_run_data(self, run_id: str, name: str, data: Any) -> None:
        run_path = self.get_run_path(run_id)
        run_path.mkdir(parents=True, exist_ok=True)
        self.save_json(data, run_path / f"{name}.json")

    def load_run_data(self, run_id: str, name: str) -> Optional[Any]:
        path = self.get_run_path(run_id) / f"{name}.json"
        if path.exists():
            return self.load_json(path)
        return None
