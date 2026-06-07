import json
import csv
from pathlib import Path
from typing import List, Dict, Any


def load_json(file_path: str) -> Any:
    path = Path(file_path)
    if not path.exists():
        return None
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def save_json(data: Any, file_path: str, indent: int = 2) -> None:
    path = Path(file_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=indent)


def load_csv(file_path: str) -> List[Dict[str, str]]:
    path = Path(file_path)
    if not path.exists():
        return []
    with open(path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        return list(reader)


def save_csv(rows: List[Dict[str, Any]], file_path: str, fieldnames: List[str] = None) -> None:
    path = Path(file_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    if not fieldnames and rows:
        fieldnames = list(rows[0].keys())
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)
