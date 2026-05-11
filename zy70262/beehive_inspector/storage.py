"""文件存储工具类"""
import json
import os
import csv
from datetime import datetime
from typing import List, Dict, Any, Optional
import pandas as pd


class FileStorage:
    def __init__(self, base_dir: str = "./data"):
        self.base_dir = base_dir
        self.beehives_file = os.path.join(base_dir, "beehives.json")
        self.inspections_file = os.path.join(base_dir, "inspections.csv")
        self.swaps_file = os.path.join(base_dir, "swaps.json")
        self.reports_dir = os.path.join(base_dir, "reports")
        self._ensure_dirs()

    def _ensure_dirs(self):
        os.makedirs(self.base_dir, exist_ok=True)
        os.makedirs(self.reports_dir, exist_ok=True)

    def load_beehives(self) -> List[Dict[str, Any]]:
        if not os.path.exists(self.beehives_file):
            return []
        with open(self.beehives_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def save_beehives(self, beehives: List[Dict[str, Any]]):
        with open(self.beehives_file, "w", encoding="utf-8") as f:
            json.dump(beehives, f, ensure_ascii=False, indent=2)

    def load_inspections(self) -> List[Dict[str, Any]]:
        if not os.path.exists(self.inspections_file):
            return []
        df = pd.read_csv(self.inspections_file, encoding="utf-8")
        return df.to_dict("records")

    def save_inspections(self, inspections: List[Dict[str, Any]]):
        if inspections:
            df = pd.DataFrame(inspections)
            df.to_csv(self.inspections_file, index=False, encoding="utf-8")
        elif os.path.exists(self.inspections_file):
            os.remove(self.inspections_file)

    def append_inspections(self, inspections: List[Dict[str, Any]]):
        if not inspections:
            return
        df = pd.DataFrame(inspections)
        if os.path.exists(self.inspections_file):
            existing = pd.read_csv(self.inspections_file, encoding="utf-8")
            df = pd.concat([existing, df], ignore_index=True)
        df.to_csv(self.inspections_file, index=False, encoding="utf-8")

    def load_swaps(self) -> List[Dict[str, Any]]:
        if not os.path.exists(self.swaps_file):
            return []
        with open(self.swaps_file, "r", encoding="utf-8") as f:
            return json.load(f)

    def save_swaps(self, swaps: List[Dict[str, Any]]):
        with open(self.swaps_file, "w", encoding="utf-8") as f:
            json.dump(swaps, f, ensure_ascii=False, indent=2)

    def save_report(self, report_name: str, content: str, suffix: Optional[str] = None) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        if suffix:
            filename = f"{report_name}_{timestamp}_{suffix}.txt"
        else:
            filename = f"{report_name}_{timestamp}.txt"
        filepath = os.path.join(self.reports_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            f.write(content)
        return filepath

    def save_json_report(self, report_name: str, data: Dict[str, Any], suffix: Optional[str] = None) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        if suffix:
            filename = f"{report_name}_{timestamp}_{suffix}.json"
        else:
            filename = f"{report_name}_{timestamp}.json"
        filepath = os.path.join(self.reports_dir, filename)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return filepath
