from pathlib import Path
from datetime import datetime
import json
import hashlib
import shutil
from typing import Dict, List, Any, Optional
from .config import CANDIDATE_DIR, FAILURE_DIR, DATA_DIR


class CandidateManager:
    def __init__(self):
        self.candidates: List[Dict[str, Any]] = []
        self.manual_notes: Dict[str, str] = {}
        self.failure_manager = FailureManager()

    def execute_action(self, candidate_id: str, selected_indices: List[int] = None) -> Dict[str, Any]:
        candidate_data = self.load_candidate_list(candidate_id)
        if not candidate_data:
            return {"success": False, "error": "候选清单不存在"}

        action_type = candidate_data["action_type"]
        results = {
            "success": True,
            "candidate_id": candidate_id,
            "action_type": action_type,
            "processed": [],
            "failed": [],
            "skipped": []
        }

        backup_dir = DATA_DIR / "backup"
        backup_dir.mkdir(exist_ok=True)

        for i, candidate in enumerate(candidate_data["candidates"]):
            if selected_indices is not None and i not in selected_indices:
                results["skipped"].append(candidate)
                continue

            file_path = Path(candidate["file_path"])
            try:
                if action_type == "cleanup":
                    self._execute_cleanup(file_path, candidate, backup_dir)
                elif action_type == "fix_encoding":
                    self._execute_fix_encoding(file_path, candidate)
                elif action_type == "rollback":
                    self._execute_rollback(file_path, candidate, backup_dir)
                else:
                    raise ValueError(f"不支持的操作类型: {action_type}")

                candidate["executed_at"] = datetime.now().isoformat()
                candidate["status"] = "success"
                results["processed"].append(candidate)

            except Exception as e:
                error_msg = str(e)
                candidate["status"] = "failed"
                candidate["error"] = error_msg
                candidate["failed_at"] = datetime.now().isoformat()

                failure_id = self.failure_manager.record_failure(
                    operation=f"{action_type}:{candidate['file_name']}",
                    item=candidate,
                    error=error_msg,
                    context={"candidate_id": candidate_id, "index": i}
                )
                candidate["failure_id"] = failure_id
                results["failed"].append(candidate)

        candidate_data["execution_results"] = results
        candidate_data["executed_at"] = datetime.now().isoformat()
        self._save_candidate_list(candidate_data)

        results["success"] = len(results["failed"]) == 0
        return results

    def _execute_cleanup(self, file_path: Path, candidate: Dict[str, Any], backup_dir: Path):
        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        backup_path = backup_dir / f"{file_path.name}.{datetime.now().strftime('%Y%m%d_%H%M%S')}.bak"
        shutil.copy2(file_path, backup_path)
        candidate["backup_path"] = str(backup_path)

        file_path.unlink()

    def _execute_fix_encoding(self, file_path: Path, candidate: Dict[str, Any]):
        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        with open(file_path, "rb") as f:
            raw_data = f.read()

        encodings_to_try = ["utf-8", "gbk", "gb2312", "gb18030", "latin1"]
        decoded_content = None

        for encoding in encodings_to_try:
            try:
                decoded_content = raw_data.decode(encoding)
                candidate["source_encoding"] = encoding
                break
            except UnicodeDecodeError:
                continue

        if decoded_content is None:
            raise ValueError("无法用任何支持的编码解码文件")

        with open(file_path, "w", encoding="utf-8") as f:
            f.write(decoded_content)

        candidate["target_encoding"] = "utf-8"

    def _execute_rollback(self, file_path: Path, candidate: Dict[str, Any], backup_dir: Path):
        if "backup_path" not in candidate:
            raise ValueError("没有找到备份文件，无法回滚")

        backup_path = Path(candidate["backup_path"])
        if not backup_path.exists():
            raise FileNotFoundError(f"备份文件不存在: {backup_path}")

        shutil.copy2(backup_path, file_path)
        candidate["rolled_back_at"] = datetime.now().isoformat()

    def generate_candidates(self, scan_results: List[Dict[str, Any]], action: str = "cleanup") -> Dict[str, Any]:
        candidate_id = hashlib.md5(
            f"{action}_{datetime.now().isoformat()}".encode()
        ).hexdigest()[:12]

        candidates = []
        for result in scan_results:
            if not result.get("is_valid", True) or result.get("error"):
                candidate = {
                    "file_path": result["file_path"],
                    "file_name": result["file_name"],
                    "detected_encoding": result.get("encoding"),
                    "confidence": result.get("confidence", 0),
                    "reason": self._get_candidate_reason(result),
                    "risk_level": self._assess_risk(result),
                    "suggested_action": action,
                    "confirmed": False,
                    "manual_note": None
                }
                candidates.append(candidate)

        candidate_data = {
            "candidate_id": candidate_id,
            "generated_at": datetime.now().isoformat(),
            "action_type": action,
            "total_count": len(candidates),
            "risk_summary": self._summarize_risks(candidates),
            "candidates": candidates
        }

        self._save_candidate_list(candidate_data)
        self.candidates = candidates
        return candidate_data

    def _get_candidate_reason(self, result: Dict[str, Any]) -> str:
        if result.get("error") == "empty_file":
            return "文件为空"
        elif result.get("confidence", 0) < 0.7:
            return f"编码置信度过低 ({result.get('confidence', 0):.2f})"
        elif not result.get("encoding"):
            return "无法识别编码"
        elif result.get("has_bom"):
            return "包含BOM标记"
        else:
            return "编码异常或不支持"

    def _assess_risk(self, result: Dict[str, Any]) -> str:
        confidence = result.get("confidence", 0)
        if result.get("error") or confidence < 0.3:
            return "high"
        elif confidence < 0.6:
            return "medium"
        else:
            return "low"

    def _summarize_risks(self, candidates: List[Dict[str, Any]]) -> Dict[str, int]:
        summary = {"high": 0, "medium": 0, "low": 0}
        for c in candidates:
            summary[c["risk_level"]] += 1
        return summary

    def _save_candidate_list(self, candidate_data: Dict[str, Any]):
        file_path = CANDIDATE_DIR / f"candidate_{candidate_data['candidate_id']}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(candidate_data, f, ensure_ascii=False, indent=2)

    def load_candidate_list(self, candidate_id: str) -> Optional[Dict[str, Any]]:
        file_path = CANDIDATE_DIR / f"candidate_{candidate_id}.json"
        if file_path.exists():
            with open(file_path, "r", encoding="utf-8") as f:
                return json.load(f)
        return None

    def add_manual_note(self, candidate_id: str, file_path: str, note: str) -> bool:
        candidate_data = self.load_candidate_list(candidate_id)
        if not candidate_data:
            return False

        for candidate in candidate_data["candidates"]:
            if candidate["file_path"] == file_path:
                candidate["manual_note"] = note
                candidate["note_added_at"] = datetime.now().isoformat()
                self._save_candidate_list(candidate_data)
                return True
        return False

    def confirm_candidates(self, candidate_id: str, selected_indices: List[int] = None) -> Dict[str, Any]:
        candidate_data = self.load_candidate_list(candidate_id)
        if not candidate_data:
            return {"success": False, "error": "候选清单不存在"}

        confirmed = []
        skipped = []

        for i, candidate in enumerate(candidate_data["candidates"]):
            if selected_indices is None or i in selected_indices:
                candidate["confirmed"] = True
                candidate["confirmed_at"] = datetime.now().isoformat()
                confirmed.append(candidate)
            else:
                skipped.append(candidate)

        candidate_data["confirmed_count"] = len(confirmed)
        candidate_data["skipped_count"] = len(skipped)
        candidate_data["status"] = "confirmed"

        self._save_candidate_list(candidate_data)

        return {
            "success": True,
            "candidate_id": candidate_id,
            "confirmed": confirmed,
            "skipped": skipped
        }

    def list_candidates(self) -> List[Dict[str, Any]]:
        candidate_files = sorted(CANDIDATE_DIR.glob("candidate_*.json"), reverse=True)
        result = []

        for file_path in candidate_files:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)
                result.append({
                    "candidate_id": data["candidate_id"],
                    "generated_at": data["generated_at"],
                    "action_type": data["action_type"],
                    "total_count": data["total_count"],
                    "status": data.get("status", "pending")
                })

        return result


class FailureManager:
    def __init__(self):
        self.failures: List[Dict[str, Any]] = []

    def record_failure(self, operation: str, item: Dict[str, Any], error: str, context: Dict[str, Any] = None):
        failure_id = hashlib.md5(
            f"{operation}_{datetime.now().isoformat()}".encode()
        ).hexdigest()[:12]

        failure = {
            "failure_id": failure_id,
            "operation": operation,
            "failed_at": datetime.now().isoformat(),
            "item": item,
            "error": error,
            "context": context or {},
            "handled": False,
            "handler_note": None
        }

        self._save_failure(failure)
        self.failures.append(failure)
        return failure_id

    def _save_failure(self, failure: Dict[str, Any]):
        file_path = FAILURE_DIR / f"failure_{failure['failure_id']}.json"
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(failure, f, ensure_ascii=False, indent=2)

    def get_failures(self, operation: str = None, unhandled_only: bool = False) -> List[Dict[str, Any]]:
        failure_files = sorted(FAILURE_DIR.glob("failure_*.json"), reverse=True)
        result = []

        for file_path in failure_files:
            with open(file_path, "r", encoding="utf-8") as f:
                data = json.load(f)

                if operation and data["operation"] != operation:
                    continue
                if unhandled_only and data.get("handled"):
                    continue

                result.append(data)

        return result

    def mark_handled(self, failure_id: str, handler_note: str) -> bool:
        file_path = FAILURE_DIR / f"failure_{failure_id}.json"
        if not file_path.exists():
            return False

        with open(file_path, "r", encoding="utf-8") as f:
            data = json.load(f)

        data["handled"] = True
        data["handled_at"] = datetime.now().isoformat()
        data["handler_note"] = handler_note

        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

        return True
