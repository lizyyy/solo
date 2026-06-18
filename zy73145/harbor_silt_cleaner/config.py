import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data_store")

DRIFT_THRESHOLD = 0.35
OUTLIER_STD_THRESHOLD = 2.5

DATA_SOURCES = [
    "sensor_a",
    "sensor_b",
    "lab_result",
    "lab_result_old",
    "manual_override",
    "verbal_note",
]

SOURCE_LABELS = {
    "sensor_a": "A号传感器",
    "sensor_b": "B号传感器",
    "lab_result": "实验室结果表",
    "lab_result_old": "实验室结果表旧版",
    "manual_override": "人工改判",
    "verbal_note": "口头备注",
}
