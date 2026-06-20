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
        
        safety_conflicts = state.get("safety_conflicts", [])
        safety_conflicts_map = {}
        for c in safety_conflicts:
            safety_conflicts_map[c["record_id"]] = c
        
        for record in model_output.get("records", []):
            rec_id = record["record_id"]
            judgment = manual_judgments.get(rec_id)
            conflict = safety_conflicts_map.get(rec_id)
            
            rec_report = {
                "record_id": rec_id,
                "question_id": record["question_id"],
                "model_score": record["model_score"],
                "model_judgment": record["model_judgment"],
                "has_manual_judgment": judgment is not None,
                "has_overwritten_manual_judgment": conflict is not None
            }
            
            if conflict:
                ov = conflict["original_manual_judgment"]
                rec_report["overwritten_manual_judgment"] = {
                    "manual_score": ov["manual_score"],
                    "manual_judgment": ov["manual_judgment"],
                    "agree_with_model_before": ov["agree_with_model"],
                    "judgment_status_before": ov["status"],
                    "manual_comment_before": ov.get("manual_comment", "")
                }
                new_model = conflict.get("new_model_output") or record
                rec_report["overwritten_score_diff"] = ov["manual_score"] - new_model["model_score"]
            
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
        
        overwrite_context = None
        original_batch_id = state.get("overwrites_original")
        if original_batch_id:
            overwrite_context = {
                "overwrites_original_batch": original_batch_id,
                "overwrite_details": state.get("overwrites", []),
                "safety_conflicts_count": len(safety_conflicts),
                "original_status_before_overwrite": None
            }
            if original_batch_id in self.current_state:
                orig = self.current_state[original_batch_id]
                overwrite_context["original_status_before_overwrite"] = orig.get("status")
                overwrite_context["original_manual_judgments_count"] = len(orig.get("manual_judgments", {}))
        
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
                "has_overwrites": (len(state.get("overwrites", [])) > 0) or (state.get("overwrites_original") is not None),
                "has_supplements": len(state.get("supplements", [])) > 0,
                "needs_safety_review": state.get("status") == "pending_safety_review",
                "overwrites_original_batch": state.get("overwrites_original"),
                "records_with_overwritten_manual_judgment": len(safety_conflicts_map)
            },
            "overwrite_context": overwrite_context,
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

    @staticmethod
    def check_alignment(report_file: str, history_file: str) -> Dict[str, Any]:
        report_path = REPORTS_DIR / report_file
        history_path = HISTORY_DIR / history_file
        
        if not report_path.exists():
            return {"pass": False, "error": f"报告文件不存在: {report_file}"}
        if not history_path.exists():
            return {"pass": False, "error": f"历史文件不存在: {history_file}"}
        
        with open(report_path, 'r', encoding='utf-8') as f:
            report = json.load(f)
        with open(history_path, 'r', encoding='utf-8') as f:
            history_data = json.load(f)
        
        results = {
            "pass": True,
            "checks": [],
            "details": {}
        }
        
        history_actions = history_data.get("actions", [])
        report_history = report.get("history_snapshot", [])
        
        check_name = "步骤1: 模型输出片段第一次导入"
        import_in_report = any(a["action"] == "IMPORT_MODEL_OUTPUT" for a in report_history)
        import_in_history = any(a["action"] == "IMPORT_MODEL_OUTPUT" for a in history_actions)
        passed = import_in_report and import_in_history
        results["checks"].append({"name": check_name, "pass": passed, "detail": f"报告中有:{import_in_report} 历史中有:{import_in_history}"})
        if not passed: results["pass"] = False
        
        check_name = "步骤2: 小孟补看人工改判表"
        judge_in_report = any(a["action"] in ("APPLY_MANUAL_JUDGMENT", "APPLY_SUPPLEMENT") for a in report_history)
        judge_in_history = any(a["action"] in ("APPLY_MANUAL_JUDGMENT", "APPLY_SUPPLEMENT") for a in history_actions)
        passed = judge_in_report and judge_in_history
        results["checks"].append({"name": check_name, "pass": passed, "detail": f"报告中有(含补录):{judge_in_report} 历史中有(含补录):{judge_in_history}"})
        if not passed: results["pass"] = False
        
        check_name = "步骤3: 评测报告更新"
        gen_in_history = any(a["action"] == "GENERATE_REPORT" for a in history_actions)
        report_has_snapshot = len(report_history) > 0
        passed = gen_in_history and report_has_snapshot
        results["checks"].append({"name": check_name, "pass": passed, "detail": f"独立历史有GENERATE_REPORT:{gen_in_history} 报告内嵌history_snapshot有记录:{report_has_snapshot}(注：快照在生成报告前拍摄，不含GENERATE_REPORT自身)"})
        if not passed: results["pass"] = False
        
        overwrite_in_history = any(a["action"] == "BATCH_OVERWRITE_DETECTED" for a in history_actions)
        overwrite_in_report_ctx = report.get("overwrite_context") is not None
        summary_overwrite = report.get("summary", {}).get("overwrites_original_batch") is not None
        needs_safety = report.get("summary", {}).get("needs_safety_review", False)
        
        if overwrite_in_history:
            summary_has_overwrites = report.get("summary", {}).get("has_overwrites", False)
            check_name = "覆盖场景: 覆盖检测在报告与历史一致"
            passed = overwrite_in_report_ctx and summary_overwrite and summary_has_overwrites
            results["checks"].append({"name": check_name, "pass": passed, "detail": f"历史有覆盖记录:{overwrite_in_history} 报告有overwrite_context:{overwrite_in_report_ctx} summary.overwrites_original_batch:{summary_overwrite} summary.has_overwrites:{summary_has_overwrites}"})
            if not passed: results["pass"] = False
            
            check_name = "覆盖场景: 被覆盖的人工改判痕迹在报告中可见"
            overwritten_in_records = any(
                r.get("has_overwritten_manual_judgment") for r in report.get("records", [])
            )
            passed = overwritten_in_records
            results["checks"].append({"name": check_name, "pass": passed, "detail": f"记录中带overwritten痕迹:{overwritten_in_records}"})
            if not passed: results["pass"] = False
            
            check_name = "覆盖场景: 状态=待安全审核（不归正常）"
            passed = needs_safety and report.get("batch_status") == "pending_safety_review"
            results["checks"].append({"name": check_name, "pass": passed, "detail": f"summary.needs_safety_review:{needs_safety} batch_status:{report.get('batch_status')}"})
            if not passed: results["pass"] = False
        
        supplement_in_history = any(a["action"] == "APPLY_SUPPLEMENT" for a in history_actions)
        if supplement_in_history:
            check_name = "补录场景: 补录标记在报告中可见"
            supplement_record = any(r.get("is_supplement") for r in report.get("records", []))
            has_supp = report.get("summary", {}).get("has_supplements", False)
            passed = supplement_record and has_supp
            results["checks"].append({"name": check_name, "pass": passed, "detail": f"记录中带supplement:{supplement_record} summary.has_supplements:{has_supp}"})
            if not passed: results["pass"] = False
        
        results["details"] = {
            "report_id": report.get("report_id"),
            "history_scenario": history_data.get("scenario"),
            "action_count_report": len(report_history),
            "action_count_history": len(history_actions),
            "history_actions": [a["action"] for a in history_actions],
            "report_actions_in_snapshot": [a["action"] for a in report_history]
        }
        
        return results
