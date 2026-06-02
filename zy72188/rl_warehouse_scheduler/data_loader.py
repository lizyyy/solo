import json
import csv
from pathlib import Path
from typing import List, Dict, Any

from .models import (
    EvaluationRecord,
    SchedulingDecision,
    DataSource,
    RecordStatus,
)


class DataLoader:
    @staticmethod
    def load_from_json(file_path: str) -> List[EvaluationRecord]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        records = []
        with open(path, "r", encoding="utf-8") as f:
            data = json.load(f)
            for item in data:
                record = DataLoader._parse_record(item)
                records.append(record)
        return records

    @staticmethod
    def load_from_jsonl(file_path: str) -> List[EvaluationRecord]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        records = []
        with open(path, "r", encoding="utf-8") as f:
            for line in f:
                item = json.loads(line.strip())
                record = DataLoader._parse_record(item)
                records.append(record)
        return records

    @staticmethod
    def load_from_csv(file_path: str) -> List[EvaluationRecord]:
        path = Path(file_path)
        if not path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        records = []
        with open(path, "r", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                item = DataLoader._csv_row_to_dict(row)
                record = DataLoader._parse_record(item)
                records.append(record)
        return records

    @staticmethod
    def _csv_row_to_dict(row: Dict[str, str]) -> Dict[str, Any]:
        result = {
            "record_id": row.get("record_id", ""),
            "source": row.get("source", "annotation"),
            "scheduling_decision": {
                "warehouse_id": row.get("warehouse_id", ""),
                "priority": int(row.get("priority", 0)),
                "estimated_cost": float(row.get("estimated_cost", 0)),
                "model_reasoning": row.get("model_reasoning", ""),
            },
        }

        if row.get("gt_warehouse_id"):
            result["ground_truth"] = {
                "warehouse_id": row.get("gt_warehouse_id", ""),
                "priority": int(row.get("gt_priority", 0)) if row.get("gt_priority") else 0,
                "estimated_cost": float(row.get("gt_estimated_cost", 0)) if row.get("gt_estimated_cost") else 0,
            }

        if row.get("metadata"):
            try:
                result["metadata"] = json.loads(row["metadata"])
            except (json.JSONDecodeError, TypeError):
                result["metadata"] = {"raw": row["metadata"]}

        return result

    @staticmethod
    def _parse_record(item: Dict[str, Any]) -> EvaluationRecord:
        scheduling_decision = SchedulingDecision(**item["scheduling_decision"])
        
        ground_truth = None
        if "ground_truth" in item and item["ground_truth"]:
            ground_truth = SchedulingDecision(**item["ground_truth"])

        source = DataSource(item.get("source", "annotation"))

        return EvaluationRecord(
            record_id=item["record_id"],
            source=source,
            scheduling_decision=scheduling_decision,
            ground_truth=ground_truth,
            status=RecordStatus.SUCCESS,
            metadata=item.get("metadata", {}),
        )

    @staticmethod
    def load_samples(samples_dir: str) -> List[EvaluationRecord]:
        path = Path(samples_dir)
        all_records = []

        loaders = {
            ".json": DataLoader.load_from_json,
            ".jsonl": DataLoader.load_from_jsonl,
            ".csv": DataLoader.load_from_csv,
        }

        for file_path in path.iterdir():
            if file_path.is_file():
                loader = loaders.get(file_path.suffix.lower())
                if loader:
                    try:
                        records = loader(str(file_path))
                        all_records.extend(records)
                    except Exception as e:
                        print(f"警告: 加载文件 {file_path.name} 失败: {e}")

        return all_records
