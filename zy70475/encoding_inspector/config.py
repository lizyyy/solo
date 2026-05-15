import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.parent

DATA_DIR = BASE_DIR / "data"
OUTPUT_DIR = BASE_DIR / "output"
CANDIDATE_DIR = BASE_DIR / "candidates"
FAILURE_DIR = BASE_DIR / "failures"
ANOMALY_DIR = BASE_DIR / "anomalies"
VERSION_HISTORY_DIR = BASE_DIR / "version_history"

for dir_path in [DATA_DIR, OUTPUT_DIR, CANDIDATE_DIR, FAILURE_DIR, ANOMALY_DIR, VERSION_HISTORY_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

SUPPORTED_ENCODINGS = ["utf-8", "gbk", "gb2312", "gb18030", "big5", "shift_jis", "euc-jp"]
MIN_CONFIDENCE = 0.7
