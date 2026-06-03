import math
import hashlib
import json
from difflib import SequenceMatcher


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    R = 6371000.0
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    a = math.sin(delta_phi / 2.0) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c


def name_similarity(name1: str, name2: str) -> float:
    return SequenceMatcher(None, name1, name2).ratio()


def calculate_record_hash(record_data: dict) -> str:
    keys = ["obstacle_name", "latitude", "longitude", "distance", "angle", "raw_conclusion"]
    hash_input = {k: record_data.get(k) for k in keys}
    return hashlib.md5(json.dumps(hash_input, sort_keys=True).encode("utf-8")).hexdigest()


def calculate_result_hash(result_data: dict) -> str:
    return hashlib.sha256(json.dumps(result_data, sort_keys=True, default=str).encode("utf-8")).hexdigest()
