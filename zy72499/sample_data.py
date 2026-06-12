import json
import os
from typing import List, Dict, Optional


SAMPLE_RECORDS_NORMAL: List[Dict] = [
    {
        "house_number": "光明村12号",
        "address": "光明村正街12号",
        "complaint_id": "TS-2026-001",
        "is_temporary_detour": False,
        "is_old_standard": False,
        "remark": "居民反映门牌缺失，已现场核实",
    },
]

SAMPLE_RECORDS_DETOUR: List[Dict] = [
    {
        "house_number": "光明村23号",
        "address": "光明村后街23号",
        "complaint_id": "TS-2026-002",
        "is_temporary_detour": True,
        "is_old_standard": False,
        "remark": "因道路施工临时改道，地图尚未更新",
    },
]

SAMPLE_RECORDS_SUPPLEMENTARY: List[Dict] = [
    {
        "house_number": "旧光明村5号",
        "address": "光明村旧区5号",
        "complaint_id": "TS-2026-003",
        "is_temporary_detour": False,
        "is_old_standard": True,
        "remark": "历史遗留旧门牌，路口照片新发现",
    },
]

SAMPLE_COMPLAINTS_ALL: List[Dict] = SAMPLE_RECORDS_NORMAL + SAMPLE_RECORDS_DETOUR + SAMPLE_RECORDS_SUPPLEMENTARY

PHOTO_MAPPINGS_ALL: List[Dict] = [
    {
        "record_id": "R-001",
        "photo_id": "PHOTO-2026-0607-001",
        "mark_detour": False,
        "mark_old_standard": False,
    },
    {
        "record_id": "R-002",
        "photo_id": "PHOTO-2026-0607-002",
        "mark_detour": True,
        "mark_old_standard": False,
    },
    {
        "record_id": "R-003",
        "photo_id": "PHOTO-2026-0607-003",
        "mark_detour": False,
        "mark_old_standard": True,
    },
]

SAMPLE_PHOTO_NORMAL: List[Dict] = [PHOTO_MAPPINGS_ALL[0]]
SAMPLE_PHOTO_DETOUR: List[Dict] = [PHOTO_MAPPINGS_ALL[1]]
SAMPLE_PHOTO_SUPPLEMENTARY: List[Dict] = [PHOTO_MAPPINGS_ALL[2]]


_COMPLAINT_PRESETS = {
    "normal": SAMPLE_RECORDS_NORMAL,
    "detour": SAMPLE_RECORDS_DETOUR,
    "supplementary": SAMPLE_RECORDS_SUPPLEMENTARY,
    "all": SAMPLE_COMPLAINTS_ALL,
}

_PHOTO_PRESETS = {
    "normal": SAMPLE_PHOTO_NORMAL,
    "detour": SAMPLE_PHOTO_DETOUR,
    "supplementary": SAMPLE_PHOTO_SUPPLEMENTARY,
    "all": PHOTO_MAPPINGS_ALL,
}


def load_complaints(source: str) -> List[Dict]:
    if source in _COMPLAINT_PRESETS:
        return list(_COMPLAINT_PRESETS[source])
    if os.path.exists(source):
        with open(source, "r", encoding="utf-8") as f:
            return json.load(f)
    raise ValueError(f"无法加载投诉数据: {source} (既不是预设名也不是JSON文件路径)")


def load_photo_mappings(source: str) -> List[Dict]:
    if source in _PHOTO_PRESETS:
        return list(_PHOTO_PRESETS[source])
    if os.path.exists(source):
        with open(source, "r", encoding="utf-8") as f:
            return json.load(f)
    raise ValueError(f"无法加载照片映射数据: {source} (既不是预设名也不是JSON文件路径)")


def list_presets() -> Dict[str, List[str]]:
    return {
        "complaint_presets": list(_COMPLAINT_PRESETS.keys()),
        "photo_presets": list(_PHOTO_PRESETS.keys()),
    }

