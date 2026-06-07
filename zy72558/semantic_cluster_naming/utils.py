import hashlib
import json
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional
import numpy as np


def generate_id(prefix: str = "") -> str:
    return f"{prefix}{uuid.uuid4().hex[:16]}"


def compute_content_hash(data: Any) -> str:
    if isinstance(data, np.ndarray):
        data = data.tolist()
    serialized = json.dumps(data, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(serialized.encode("utf-8")).hexdigest()


def compute_dataframe_hash(df) -> str:
    data_str = df.to_csv(index=False).encode("utf-8")
    return hashlib.sha256(data_str).hexdigest()


def now_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"


def safe_json_dumps(obj: Any) -> str:
    try:
        return json.dumps(obj, ensure_ascii=False, sort_keys=True)
    except (TypeError, ValueError):
        return str(obj)


def parse_vector(vector_data: Any) -> Optional[np.ndarray]:
    if vector_data is None:
        return None
    if isinstance(vector_data, np.ndarray):
        return vector_data
    if isinstance(vector_data, list):
        return np.array(vector_data, dtype=np.float64)
    if isinstance(vector_data, str):
        try:
            parsed = json.loads(vector_data)
            return np.array(parsed, dtype=np.float64)
        except (json.JSONDecodeError, ValueError):
            return None
    return None


def format_cluster_name(cluster_id: int, sample_texts: List[str], max_len: int = 30) -> str:
    if not sample_texts:
        return f"簇_{cluster_id}"
    keywords = []
    for text in sample_texts[:3]:
        clean = text.strip()[:10]
        if clean and clean not in keywords:
            keywords.append(clean)
    keyword_str = "_".join(keywords)
    if len(keyword_str) > max_len:
        keyword_str = keyword_str[:max_len] + "..."
    return f"簇{cluster_id}_{keyword_str}"


class TrainingLogBuffer:
    def __init__(self):
        self._lines: List[str] = []
    
    def log(self, message: str) -> None:
        timestamp = datetime.utcnow().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]
        self._lines.append(f"[{timestamp}] {message}")
    
    def get_log(self) -> str:
        return "\n".join(self._lines)
    
    def clear(self) -> None:
        self._lines = []
