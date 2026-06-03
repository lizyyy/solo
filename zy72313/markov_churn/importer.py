import os
import hashlib
import pandas as pd
from typing import List, Dict, Tuple, Optional
from datetime import datetime
from pathlib import Path
import json

from .core import MarkovChurnModel, CustomerState
from .exceptions import DuplicateImportError, MultipleAnswersError


class DataImporter:
    def __init__(self, import_dir: str, history_manager=None):
        self.import_dir = Path(import_dir)
        self.import_dir.mkdir(parents=True, exist_ok=True)
        self.import_history_file = self.import_dir / ".import_history.json"
        self.import_history = self._load_import_history()
        self.history_manager = history_manager

    def _load_import_history(self) -> Dict:
        if self.import_history_file.exists():
            with open(self.import_history_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return {"imports": [], "file_hashes": {}}

    def _save_import_history(self) -> None:
        with open(self.import_history_file, 'w', encoding='utf-8') as f:
            json.dump(self.import_history, f, ensure_ascii=False, indent=2)

    def _calculate_file_hash(self, file_path: Path) -> str:
        hasher = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                hasher.update(chunk)
        return hasher.hexdigest()

    def _is_duplicate_import(self, file_hash: str) -> Tuple[bool, Optional[Dict]]:
        if file_hash in self.import_history["file_hashes"]:
            import_record = self.import_history["file_hashes"][file_hash]
            return True, import_record
        return False, None

    def import_csv(self, file_path: str, model: MarkovChurnModel, 
                   skip_duplicates: bool = True, 
                   check_multiple_answers: bool = True) -> Dict:
        file_path = Path(file_path)
        if not file_path.exists():
            raise FileNotFoundError(f"文件不存在: {file_path}")

        file_hash = self._calculate_file_hash(file_path)
        is_dup, dup_record = self._is_duplicate_import(file_hash)

        if is_dup:
            if skip_duplicates:
                return {
                    "status": "skipped",
                    "reason": "duplicate_file",
                    "previous_import": dup_record,
                    "file_hash": file_hash
                }
            else:
                raise DuplicateImportError(
                    file_hash=file_hash,
                    message=f"文件已在 {dup_record['timestamp']} 导入过"
                )

        df = pd.read_csv(file_path)
        import_result = self._import_dataframe(df, model, file_path.name, check_multiple_answers)
        import_result["file_hash"] = file_hash
        import_result["source_file"] = file_path.name

        self._record_import(file_path.name, file_hash, import_result)

        if self.history_manager:
            self.history_manager.record_import(
                source_file=file_path.name,
                file_hash=file_hash,
                record_count=import_result["imported_count"],
                metadata=import_result
            )

        return import_result

    def _import_dataframe(self, df: pd.DataFrame, model: MarkovChurnModel,
                          source_file: str, check_multiple_answers: bool) -> Dict:
        imported_count = 0
        skipped_count = 0
        multiple_answer_students = []
        warnings = []

        required_columns = ["customer_id", "state", "timestamp"]
        missing_cols = [col for col in required_columns if col not in df.columns]
        if missing_cols:
            raise ValueError(f"缺少必需列: {missing_cols}")

        for _, row in df.iterrows():
            state = CustomerState(
                customer_id=str(row["customer_id"]),
                state=str(row["state"]),
                timestamp=pd.to_datetime(row["timestamp"]).to_pydatetime(),
                student_id=str(row.get("student_id", "")),
                answer_version=int(row.get("answer_version", 1)),
                error_notes=str(row.get("error_notes", "")),
                source_file=source_file,
                annotations=json.loads(row.get("annotations", "{}")) if pd.notna(row.get("annotations")) else {}
            )

            if check_multiple_answers and state.student_id:
                has_multiple, _ = model.check_multiple_answers(state.student_id)
                if has_multiple:
                    if state.student_id not in multiple_answer_students:
                        multiple_answer_students.append(state.student_id)
                        warnings.append(f"学生 {state.student_id} 存在多版答案，需复核")

            model.add_customer_state(state)
            imported_count += 1

        result = {
            "status": "success",
            "imported_count": imported_count,
            "skipped_count": skipped_count,
            "multiple_answer_students": multiple_answer_students,
            "warnings": warnings,
            "timestamp": datetime.now().isoformat()
        }

        if multiple_answer_students and check_multiple_answers:
            result["requires_review"] = True
            result["review_type"] = "multiple_answers"

        return result

    def _record_import(self, filename: str, file_hash: str, result: Dict) -> None:
        import_record = {
            "filename": filename,
            "file_hash": file_hash,
            "timestamp": result.get("timestamp", datetime.now().isoformat()),
            "imported_count": result.get("imported_count", 0),
            "status": result.get("status", "success")
        }
        self.import_history["imports"].append(import_record)
        self.import_history["file_hashes"][file_hash] = import_record
        self._save_import_history()

    def get_import_history(self) -> List[Dict]:
        return self.import_history["imports"]

    def rollback_import(self, file_hash: str, model: MarkovChurnModel) -> Dict:
        if file_hash not in self.import_history["file_hashes"]:
            return {"status": "error", "message": "未找到该导入记录"}

        record = self.import_history["file_hashes"][file_hash]
        filename = record["filename"]

        removed_count = 0
        for customer_id in list(model.customers.keys()):
            states = model.customers[customer_id]
            original_count = len(states)
            model.customers[customer_id] = [s for s in states if s.source_file != filename]
            removed_count += (original_count - len(model.customers[customer_id]))
            if not model.customers[customer_id]:
                del model.customers[customer_id]

        for student_id in list(model.student_answers.keys()):
            answers = model.student_answers[student_id]
            model.student_answers[student_id] = [a for a in answers if a.source_file != filename]
            if not model.student_answers[student_id]:
                del model.student_answers[student_id]

        return {
            "status": "success",
            "removed_count": removed_count,
            "rolled_back_file": filename
        }
