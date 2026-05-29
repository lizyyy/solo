from typing import List, Dict, Any
from datetime import datetime
from ..models import PerformanceSheet, AuditLog, SettlementResult, Issue
import json
import hashlib
import os


class Auditor:
    def __init__(self, history_dir: str):
        self.history_dir = history_dir
        self._ensure_dirs()

    def _ensure_dirs(self):
        os.makedirs(self.history_dir, exist_ok=True)
        os.makedirs(os.path.join(self.history_dir, "inputs"), exist_ok=True)
        os.makedirs(os.path.join(self.history_dir, "outputs"), exist_ok=True)
        os.makedirs(os.path.join(self.history_dir, "audit_logs"), exist_ok=True)

    def record_input(self, sheet: PerformanceSheet) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"input_{sheet.id}_{timestamp}.json"
        filepath = os.path.join(self.history_dir, "inputs", filename)

        data = sheet.to_dict()
        data["_audit_hash"] = self._compute_hash(data)

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        sheet.add_audit_log(
            action="INPUT_RECORDED",
            operator=sheet.operator,
            details=f"输入数据已存档: {filename}",
            after={"file": filename, "hash": data["_audit_hash"]}
        )

        return filepath

    def record_output(self, result: SettlementResult) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"output_{result.performance_id}_{timestamp}.json"
        filepath = os.path.join(self.history_dir, "outputs", filename)

        data = result.to_dict()
        data["_audit_hash"] = self._compute_hash(data)

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return filepath

    def record_audit_trail(self, sheet: PerformanceSheet, result: SettlementResult,
                         issues: List[Issue]) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"audit_{sheet.id}_{timestamp}.json"
        filepath = os.path.join(self.history_dir, "audit_logs", filename)

        audit_data = {
            "performance_id": sheet.id,
            "performance_name": sheet.performance_name,
            "operator": sheet.operator,
            "generated_at": datetime.now().isoformat(),
            "input_hash": self._compute_hash(sheet.to_dict()),
            "output_hash": self._compute_hash(result.to_dict()),
            "audit_logs": [log.to_dict() for log in sheet.audit_logs],
            "issues": [issue.to_dict() for issue in issues],
            "processing_steps": [
                {
                    "step": "data_validation",
                    "status": "completed",
                    "errors": sheet.validate()
                },
                {
                    "step": "track_splitting",
                    "status": "completed"
                },
                {
                    "step": "ratio_validation",
                    "status": "completed"
                },
                {
                    "step": "fee_collection",
                    "status": "completed"
                },
                {
                    "step": "royalty_calculation",
                    "status": "completed"
                }
            ]
        }

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(audit_data, f, ensure_ascii=False, indent=2)

        return filepath

    def _compute_hash(self, data: Dict[str, Any]) -> str:
        data_str = json.dumps(data, sort_keys=True, ensure_ascii=False)
        return hashlib.sha256(data_str.encode("utf-8")).hexdigest()

    def list_history(self) -> List[Dict[str, Any]]:
        history = []
        inputs_dir = os.path.join(self.history_dir, "inputs")
        outputs_dir = os.path.join(self.history_dir, "outputs")

        for filename in sorted(os.listdir(inputs_dir)):
            if filename.endswith(".json"):
                parts = filename.replace(".json", "").split("_")
                if len(parts) >= 3:
                    perf_id = parts[1]
                    timestamp = parts[2]
                    history.append({
                        "type": "input",
                        "performance_id": perf_id,
                        "timestamp": timestamp,
                        "filename": filename,
                    })

        for filename in sorted(os.listdir(outputs_dir)):
            if filename.endswith(".json"):
                parts = filename.replace(".json", "").split("_")
                if len(parts) >= 3:
                    perf_id = parts[1]
                    timestamp = parts[2]
                    history.append({
                        "type": "output",
                        "performance_id": perf_id,
                        "timestamp": timestamp,
                        "filename": filename,
                    })

        return sorted(history, key=lambda x: x["timestamp"], reverse=True)
