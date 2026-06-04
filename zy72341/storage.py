import json
from typing import List, Any
from dataclasses import asdict
from datetime import datetime
import pandas as pd

from config import Config
from core import StudentAnswer, WeightTable, ErrorLog


class DataStore:
    def __init__(self):
        Config.ensure_data_dir()
        self._answers: List[StudentAnswer] = []
        self._weights: List[WeightTable] = []
        self._error_logs: List[ErrorLog] = []
        self._load_all()

    def _load_json(self, filepath: str, default: Any = None) -> Any:
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
        except FileNotFoundError:
            return default or []
        except json.JSONDecodeError:
            return default or []

    def _save_json(self, filepath: str, data: Any) -> None:
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _load_all(self) -> None:
        answers_data = self._load_json(Config.ANSWERS_FILE)
        self._answers = [StudentAnswer(**d) for d in answers_data]

        weights_data = self._load_json(Config.WEIGHTS_FILE)
        self._weights = [WeightTable(**d) for d in weights_data]

        error_data = self._load_json(Config.ERROR_LOGS_FILE)
        self._error_logs = [ErrorLog(**d) for d in error_data]

    def _save_all(self) -> None:
        self._save_json(
            Config.ANSWERS_FILE,
            [asdict(ans) for ans in self._answers]
        )
        self._save_json(
            Config.WEIGHTS_FILE,
            [asdict(w) for w in self._weights]
        )
        self._save_json(
            Config.ERROR_LOGS_FILE,
            [asdict(e) for e in self._error_logs]
        )

    def import_answers_from_excel(
        self,
        excel_path: str,
        batch_id: str
    ) -> List[StudentAnswer]:
        df = pd.read_excel(excel_path)
        new_answers = []

        for _, row in df.iterrows():
            answer = StudentAnswer(
                answer_id=str(row.get("answer_id", "")),
                student_id=str(row.get("student_id", "")),
                student_name=str(row.get("student_name", "")),
                question_id=str(row.get("question_id", "")),
                answer_content=str(row.get("answer_content", "")),
                score=float(row.get("score", 0)),
                submitted_at=str(row.get("submitted_at", "")),
                import_batch=batch_id,
                notes=str(row.get("notes", "")),
            )
            new_answers.append(answer)

        self._answers.extend(new_answers)
        self._save_all()
        return new_answers

    def import_weights_from_excel(
        self,
        excel_path: str
    ) -> List[WeightTable]:
        df = pd.read_excel(excel_path)
        new_weights = []

        for _, row in df.iterrows():
            weight = WeightTable(
                weight_id=str(row.get("weight_id", "")),
                question_id=str(row.get("question_id", "")),
                dimension=str(row.get("dimension", "")),
                weight=float(row.get("weight", 1.0)),
                standard_version=str(row.get("standard_version", "")),
                effective_date=str(row.get("effective_date", "")),
                remarks=str(row.get("remarks", "")),
            )
            new_weights.append(weight)

        self._weights.extend(new_weights)
        self._save_all()
        return new_weights

    def get_all_answers(self) -> List[StudentAnswer]:
        return self._answers

    def get_answer_by_id(self, answer_id: str) -> StudentAnswer:
        return next((a for a in self._answers if a.id == answer_id), None)

    def get_all_weights(self) -> List[WeightTable]:
        return self._weights

    def get_all_error_logs(self) -> List[ErrorLog]:
        return self._error_logs

    def add_error_logs(self, error_logs: List[ErrorLog]) -> None:
        self._error_logs.extend(error_logs)
        self._save_all()

    def update_answer(self, answer_id: str, **kwargs) -> bool:
        answer = self.get_answer_by_id(answer_id)
        if answer:
            for key, value in kwargs.items():
                if hasattr(answer, key):
                    setattr(answer, key, value)
            self._save_all()
            return True
        return False

    def review_duplicate(
        self,
        answer_id: str,
        reviewer: str,
        keep: bool = True
    ) -> bool:
        answer = self.get_answer_by_id(answer_id)
        if answer and answer.status == "DUPLICATE_PENDING":
            answer.status = "REVIEWED" if keep else "NORMAL"
            answer.reviewed_by = reviewer
            answer.reviewed_at = datetime.now().isoformat()
            answer.notes = f"业务运营{reviewer}复核通过，确认保留此版答案" if keep else "已复核确认"
            self._save_all()
            return True
        return False

    def get_duplicates_pending(self) -> List[StudentAnswer]:
        return [a for a in self._answers if a.status == "DUPLICATE_PENDING"]

    def get_old_standard_answers(self) -> List[StudentAnswer]:
        return [a for a in self._answers if a.status == "OLD_STANDARD"]

    def clear_all(self) -> None:
        self._answers = []
        self._weights = []
        self._error_logs = []
        self._save_all()
