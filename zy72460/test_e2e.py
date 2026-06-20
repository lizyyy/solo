import os
import sys
import json
import time
import shutil
import asyncio
from fastapi.testclient import TestClient

from api import app


SESSION_ID = "AUTO-VERIFY-001"
DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")

POINTS_DATA = [
    {
        "point_id": "P005",
        "name": "徐家汇公园雨水花园",
        "location": {
            "lat": 31.1987,
            "lng": 121.4382,
            "street": "徐家汇街道",
            "is_boundary": False,
        },
    },
    {
        "point_id": "P006",
        "name": "衡山路雨水花园",
        "location": {
            "lat": 31.2078,
            "lng": 121.4375,
            "street": "天平路街道",
            "is_boundary": True,
            "adjacent_streets": ["湖南路街道"],
        },
    },
]

RAMP_BATCH = [
    {
        "record_id": "R005",
        "point_id": "P005",
        "inspector": "孙工",
        "inspect_time": "2026-06-04T10:00:00",
        "has_waterlogging": False,
        "ramp_accessible": True,
        "ramp_note": "正常",
    },
    {
        "record_id": "R006",
        "point_id": "P006",
        "inspector": "孙工",
        "inspect_time": "2026-06-04T11:00:00",
        "has_waterlogging": False,
        "ramp_accessible": True,
        "ramp_note": "正常",
    },
]

NIGHT_BATCH = [
    {
        "record_id": "N005",
        "point_id": "P005",
        "inspector": "周工",
        "inspect_time": "2026-06-05T01:30:00",
        "has_waterlogging": True,
        "water_depth_cm": 6.0,
        "ramp_accessible": True,
        "remarks": "补录：夜间短时降雨，有积水但坡道仍可用",
        "is_supplementary": True,
    },
]

CRACK_BATCH = [
    {
        "crack_id": "C001",
        "point_id": "P006",
        "inspector": "小付",
        "inspect_time": "2026-06-06T15:00:00",
        "has_crack": True,
        "crack_description": "无障碍坡道边缘有一条横向裂缝",
        "crack_width_mm": 3.0,
        "missing_3d_coords": True,
        "remarks": "负责人补看时发现缺三维坐标，先记录待补",
    },
]


class bcolors:
    OKGREEN = '\033[92m'
    FAIL = '\033[91m'
    WARNING = '\033[93m'
    ENDC = '\033[0m'
    BOLD = '\033[1m'


def print_section(title):
    print(f"\n{'='*70}")
    print(f"  {title}")
    print(f"{'='*70}")


def assert_eq(actual, expected, msg):
    if actual == expected:
        print(f"  ✓ {msg}: {actual}")
        return True
    else:
        print(f"  {bcolors.FAIL}✗{bcolors.ENDC} {msg}: 期望 {expected}, 实际 {actual}")
        return False


def assert_exists(path, msg):
    if os.path.exists(path):
        print(f"  ✓ {msg}: {path}")
        return True
    else:
        print(f"  {bcolors.FAIL}✗{bcolors.ENDC} {msg}: 文件不存在 {path}")
        return False


def assert_contains(container, item, msg):
    if item in container:
        print(f"  ✓ {msg}: 包含 {item}")
        return True
    else:
        print(f"  {bcolors.FAIL}✗{bcolors.ENDC} {msg}: 缺少 {item}")
        return False
