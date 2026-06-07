#!/usr/bin/env python3
import json
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, List, Optional

BASE_DIR = Path(__file__).parent.parent
DATA_DIR = BASE_DIR / "data"
REPORTS_DIR = BASE_DIR / "reports"
HISTORY_DIR = BASE_DIR / "history"


class ReviewEngine:
    def __init__(self):
        self.history: List[Dict[str, Any]] = []
        self.current_state: Dict[str, Any] = {}

    def _log_action(self, action: str, details: Dict[str, Any]) -> None:
        log_entry = {
            "timestamp": datetime.now().isoformat(),
            "action": action,
            "details": details
        }
        self.history.append(log_entry)

    def load_model_output(self, file_path: str) -> Dict[str, Any]:
        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        batch_id = data.get("batch_id", "unknown")
        self.current_state[batch_id] = {
            "model_output": data,
            "manual_judgments": {},
            "status": "imported",
            "overwrites": [],
            "supplements": []
        }
        self._log_action("IMPORT_MODEL_OUTPUT", {
            "batch_id": batch_id,
            "file": os.path.basename(file_path),
            "record_count": len(data.get("records", []))
        })
        return data

    def apply_manual_judgment(self, batch_id: str, judgment_file: str) -> Dict[str, Any]:
        with open(judgment_file, 'r', encoding='utf-8') as f:
            judgments_data = json.load(f)
        
        if batch_id not in self.current_state:
            raise ValueError(f"Batch {batch_id} not found")
        
        state = self.current_state[batch_id]
        judgments = judgments_data.get("judgments", [])
        
        has_modified = False
        for j in judgments:
            rec_id = j["record_id"]
            state["manual_judgments"][rec_id] = j
            
            if j.get("status") == "modified":
                has_modified = True
        
        if has_modified:
            state["status"] = "has_manual_modifications"
        elif len(judgments) > 0:
            state["status"] = "reviewed"
        
        self._log_action("APPLY_MANUAL_JUDGMENT", {
            "batch_id": batch_id,
            "judgment_file": os.path.basename(judgment_file),
            "judgment_count": len(judgments),
            "reviewed_by": judgments_data.get("reviewed_by")
        })
        return judgments_data

    def apply_second_batch(self, original_batch_id: str, second_batch_file: str) -> Dict[str, Any]:
        with open(second_batch_file, 'r', encoding='utf-8') as f:
            second_batch = json.load(f)
        
        new_batch_id = second_batch.get("batch_id")
        
        if original_batch_id not in self.current_state:
            raise ValueError(f"Original batch {original_batch_id} not found")
        
        original_state = self.current_state[original_batch_id]
        
        was_modified = original_state.get("status") == "has_manual_modifications"
        had_judgments = len(original_state.get("manual_judgments", {})) > 0
        
        original_state["overwrites"].append({
            "new_batch_id": new_batch_id,
            "timestamp": datetime.now().isoformat(),
            "note": "Second batch run overwrote previous state"
        })
        
        self.current_state[new_batch_id] = {
            "model_output": second_batch,
            "manual_judgments": {},
            "status": "imported",
            "overwrites": [],
            "supplements": [],
            "overwrites_original": original_batch_id
        }
        
        conflict_records = []
        if was_modified:
            for rec_id, judgment in original_state["manual_judgments"].items():
                if judgment.get("status") == "modified":
                    conflict_records.append({
                        "record_id": rec_id,
                        "original_manual_judgment": judgment,
                        "new_model_output": next(
                            (r for r in second_batch.get("records", []) if r["record_id"] == rec_id),
                            None
                        )
                    })
        
        self._log_action("BATCH_OVERWRITE_DETECTED", {
            "original_batch_id": original_batch_id,
            "new_batch_id": new_batch_id,
            "had_manual_modifications": was_modified,
            "conflict_records_count": len(conflict_records),
            "conflict_records": conflict_records,
            "needs_safety_review": was_modified and len(conflict_records) > 0
        })
        
        if was_modified and len(conflict_records) > 0:
            self.current_state[new_batch_id]["status"] = "pending_safety_review"
            self.current_state[new_batch_id]["safety_conflicts"] = conflict_records
        
        return {
            "new_batch_id": new_batch_id,
            "conflicts_detected": len(conflict_records) > 0,
            "conflict_records": conflict_records,
            "needs_safety_review": was_modified and len(conflict_records) > 0
        }

    def apply_supplement(self, batch_id: str, supplement_file: str) -> Dict[str, Any]:
        with open(supplement_file, 'r', encoding='utf-8') as f:
            supplement_data = json.load(f)
        
        if batch_id not in self.current_state:
            raise ValueError(f"Batch {batch_id} not found")
        
        state = self.current_state[batch_id]
        judgments = supplement_data.get("judgments", [])
        
        for j in judgments:
            rec_id = j["record_id"]
            state["manual_judgments"][rec_id] = j
        
        state["supplements"].append({
            "supplement_id": supplement_data.get("supplement_id"),
            "timestamp": datetime.now().isoformat(),
            "note": supplement_data.get("note", "")
        })
        
        state["status"] = "supplemented"
        
        self._log_action("APPLY_SUPPLEMENT", {
            "batch_id": batch_id,
            "supplement_file": os.path.basename(supplement_file),
            "supplement_id": supplement_data.get("supplement_id"),
            "judgment_count": len(judgments),
            "note": supplement_data.get("note")
        })
        return supplement_data

    def generate_report(self, batch_id: str, output_file: Optional[str] = None) -> Dict[str, Any]:
        if batch_id not in self.current_state:
            raise ValueError(f"Batch {batch_id} not found")
        
        state = self.current_state[batch_id]
        model_output = state["model_output"]
        manual_judgments = state["manual_judgments"]
        
        records_report = []
        total_score_diff = 0
        modified_count = 0
        confirmed_count = 0
        
        for record in model_output.get("records", []):
            rec_id = record["record_id"]
            judgment = manual_judgments.get(rec_id)
            
            rec_report = {
                "record_id": rec_id,
                "question_id": record["question_id"],
                "model_score": record["model_score"],
                "model_judgment": record["model_judgment"],
                "has_manual_judgment": judgment is not None
            }
            
            if judgment:
                rec_report.update({
                    "manual_score": judgment["manual_score"],
                    "manual_judgment": judgment["manual_judgment"],
                    "agree_with_model": judgment["agree_with_model"],
                    "judgment_status": judgment["status"],
                    "manual_comment": judgment.get("manual_comment", ""),
                    "is_supplement": judgment.get("is_supplement", False)
                })
                
                score_diff = judgment["manual_score"] - record["model_score"]
                rec_report["score_diff"] = score_diff
                total_score_diff += abs(score_diff)
                
                if judgment.get("status") == "modified":
                    modified_count += 1
                elif judgment.get("status") == "confirmed":
                    confirmed_count += 1
            
            records_report.append(rec_report)
        
        report = {
            "report_id": f"REPORT_{batch_id}_{datetime.now().strftime('%Y%m%d%H%M%S')}",
            "generated_at": datetime.now().isoformat(),
            "batch_id": batch_id,
            "model_version": model_output.get("model_version"),
            "batch_status": state.get("status", "unknown"),
            "summary": {
                "total_records": len(model_output.get("records", [])),
                "records_with_manual_judgment": len(manual_judgments),
                "confirmed_count": confirmed_count,
                "modified_count": modified_count,
                "total_abs_score_diff": total_score_diff,
                "has_overwrites": len(state.get("overwrites", [])) > 0,
                "has_supplements": len(state.get("supplements", [])) > 0,
                "needs_safety_review": state.get("status") == "pending_safety_review"
            },
            "records": records_report,
            "history_snapshot": self.history.copy()
        }
        
        if output_file:
            output_path = REPORTS_DIR / output_file
            with open(output_path, 'w', encoding='utf-8') as f:
                json.dump(report, f, ensure_ascii=False, indent=2)
            self._log_action("GENERATE_REPORT", {
                "batch_id": batch_id,
                "output_file": output_file
            })
        
        return report

    def save_history(self, scenario_name: str) -> str:
        history_file = f"history_{scenario_name}_{datetime.now().strftime('%Y%m%d%H%M%S')}.json"
        history_path = HISTORY_DIR / history_file
        with open(history_path, 'w', encoding='utf-8') as f:
            json.dump({
                "scenario": scenario_name,
                "saved_at": datetime.now().isoformat(),
                "actions": self.history
            }, f, ensure_ascii=False, indent=2)
        return str(history_path)

    def get_state(self) -> Dict[str, Any]:
        return self.current_state
