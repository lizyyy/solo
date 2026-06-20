import json
import csv
import os
from typing import List, Dict, Any, Optional
from pathlib import Path

from .models import (
    FormulaDef,
    HistoryAnswer,
    UnitConversion,
    SourceType,
)


def load_json(filepath: str) -> Any:
    with open(filepath, "r", encoding="utf-8") as f:
        return json.load(f)


def load_csv(filepath: str) -> List[Dict[str, Any]]:
    rows = []
    with open(filepath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            rows.append(row)
    return rows


def load_formulas(formula_dir: str) -> List[FormulaDef]:
    formulas = []
    formula_path = Path(formula_dir)
    if not formula_path.exists():
        return formulas

    for f in sorted(formula_path.glob("*.json")):
        data = load_json(str(f))
        if isinstance(data, list):
            for item in data:
                formulas.append(FormulaDef(**item))
        else:
            formulas.append(FormulaDef(**data))
    return formulas


def load_unit_conversions(filepath: str) -> List[UnitConversion]:
    if not os.path.exists(filepath):
        return []
    data = load_json(filepath)
    return [UnitConversion(**item) for item in data]


def load_history_answers(history_dir: str) -> List[HistoryAnswer]:
    answers = []
    hist_path = Path(history_dir)
    if not hist_path.exists():
        return answers

    for f in sorted(hist_path.glob("*.json")):
        data = load_json(str(f))
        if isinstance(data, list):
            for item in data:
                item["source"] = SourceType(item["source"])
                answers.append(HistoryAnswer(**item))
        else:
            data["source"] = SourceType(data["source"])
            answers.append(HistoryAnswer(**data))
    return answers


def load_input_rows(filepath: str) -> List[Dict[str, Any]]:
    ext = os.path.splitext(filepath)[1].lower()
    if ext == ".json":
        data = load_json(filepath)
        return data if isinstance(data, list) else [data]
    elif ext == ".csv":
        return load_csv(filepath)
    else:
        raise ValueError(f"不支持的文件格式: {ext}")


def load_attachments(attach_dir: str) -> Dict[str, Any]:
    attachments = {}
    att_path = Path(attach_dir)
    if not att_path.exists():
        return attachments

    for f in sorted(att_path.glob("*")):
        if f.suffix == ".json":
            attachments[f.name] = load_json(str(f))
        elif f.suffix == ".csv":
            attachments[f.name] = load_csv(str(f))
    return attachments


def load_notes(notes_dir: str) -> List[str]:
    notes = []
    notes_path = Path(notes_dir)
    if not notes_path.exists():
        return notes

    for f in sorted(notes_path.glob("*.txt")):
        with open(str(f), "r", encoding="utf-8") as fh:
            notes.append(fh.read().strip())
    return notes
