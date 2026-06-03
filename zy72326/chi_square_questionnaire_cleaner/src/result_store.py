import json
import csv
import copy
from typing import Any, Optional


class ResultStore:
    _instance: Optional["ResultStore"] = None

    def __new__(cls) -> "ResultStore":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._cleaned_rows: list[dict] = []
        self._anomaly_rows: list[dict] = []
        self._chi_square_result: Optional[dict] = None
        self._summary: dict = {}
        self._export_cache: Optional[str] = None
        self._dirty: bool = True

    @classmethod
    def reset(cls):
        cls._instance = None

    def set_cleaned_rows(self, rows: list[dict]):
        self._cleaned_rows = copy.deepcopy(rows)
        self._mark_dirty()

    def set_anomaly_rows(self, rows: list[dict]):
        self._anomaly_rows = copy.deepcopy(rows)
        self._mark_dirty()

    def set_chi_square_result(self, result: dict):
        self._chi_square_result = copy.deepcopy(result)
        self._mark_dirty()

    def set_summary(self, summary: dict):
        self._summary = copy.deepcopy(summary)
        self._mark_dirty()

    def get_cleaned_rows(self) -> list[dict]:
        return copy.deepcopy(self._cleaned_rows)

    def get_anomaly_rows(self) -> list[dict]:
        return copy.deepcopy(self._anomaly_rows)

    def get_chi_square_result(self) -> Optional[dict]:
        return copy.deepcopy(self._chi_square_result)

    def get_summary(self) -> dict:
        return copy.deepcopy(self._summary)

    def get_display_data(self) -> dict:
        return self._build_response()

    def get_api_response(self) -> dict:
        return self._build_response()

    def get_export_data(self) -> dict:
        return self._build_response()

    def _build_response(self) -> dict:
        return {
            "cleaned_rows": self.get_cleaned_rows(),
            "anomaly_rows": self.get_anomaly_rows(),
            "chi_square_result": self.get_chi_square_result(),
            "summary": self.get_summary(),
        }

    def export_csv(self, filepath: str):
        if not self._cleaned_rows:
            return
        fieldnames = list(self._cleaned_rows[0].keys())
        with open(filepath, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(self._cleaned_rows)

    def export_anomaly_csv(self, filepath: str):
        if not self._anomaly_rows:
            return
        fieldnames = list(self._anomaly_rows[0].keys())
        with open(filepath, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(self._anomaly_rows)

    def export_json(self, filepath: str):
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(self._build_response(), f, ensure_ascii=False, indent=2)

    def _mark_dirty(self):
        self._dirty = True

    def is_dirty(self) -> bool:
        return self._dirty
