from dataclasses import dataclass, field, asdict
from typing import List, Dict, Optional, Any
from datetime import datetime
import json
import os

DATA_DIR = os.path.join(os.path.dirname(__file__), "data_store")


def _ensure_dir():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)


@dataclass
class QuestionItem:
    qid: str
    title: str
    original_text: str
    version: str
    source_file: str
    difficulty: str = "中"
    tags: List[str] = field(default_factory=list)


@dataclass
class Material:
    mid: str
    current_name: str
    previous_names: List[str] = field(default_factory=list)
    renamed_by: str = ""
    rename_time: str = ""
    content: str = ""
    source_type: str = "answer"
    linked_qids: List[str] = field(default_factory=list)
    is_temporary_rename: bool = False


@dataclass
class AnswerVersion:
    aid: str
    qid: str
    material_mid: str
    version: str
    answer_text: str
    processed_result: str
    unit_conversion: str = ""
    params: Dict[str, Any] = field(default_factory=dict)


@dataclass
class Note:
    nid: str
    target_type: str
    target_id: str
    content: str
    note_type: str = "verbal"
    author: str = "小岑"
    timestamp: str = ""
    attachments: List[Dict] = field(default_factory=list)


@dataclass
class SequencePoint:
    index: int
    value: float
    raw_value: float
    source_qid: str
    source_aid: str
    is_anomaly: bool = False
    anomaly_type: str = ""
    anomaly_detail: str = ""
    calc_trace: List[Dict] = field(default_factory=list)
    unit: str = ""


@dataclass
class ParamSet:
    pid: str
    name: str
    params: Dict[str, Any] = field(default_factory=dict)
    unit_config: Dict[str, str] = field(default_factory=dict)
    sequence: List[SequencePoint] = field(default_factory=list)


class Store:
    @staticmethod
    def _path(name):
        _ensure_dir()
        return os.path.join(DATA_DIR, f"{name}.json")

    @staticmethod
    def save(name, data):
        with open(Store._path(name), "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2, default=str)

    @staticmethod
    def load(name, default=None):
        if default is None:
            default = []
        p = Store._path(name)
        if not os.path.exists(p):
            return default
        try:
            with open(p, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return default
