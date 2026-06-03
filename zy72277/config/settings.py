from datetime import datetime

MODEL_VERSION = "v1.2.0"
MODEL_TRAIN_DATE = "2026-05-15"

DISTANCE_THRESHOLD_METERS = 3.0
NAME_SIMILARITY_THRESHOLD = 0.6
OBSTACLE_RADIUS_METERS = 1.5

PARAMS_JUSTIFICATION = {
    "DISTANCE_THRESHOLD_METERS": "基于农机平均作业宽度3米，取一半作为障碍物归属判定阈值，v1.1.0版本由2.5米上调，覆盖更多边缘情况",
    "NAME_SIMILARITY_THRESHOLD": "使用编辑距离算法，0.6可有效区分'电线杆/电杆'但不合并'电线杆/树'，v1.0.0沿用至今",
    "OBSTACLE_RADIUS_METERS": "参照国家标准《农业机械 安全》GB 10395.1-2009，障碍物安全半径取1.5米"
}

OPERATORS = {
    "laoliang": {"name": "梁建军", "role": "培训教官", "employee_id": "TR-2023-045"},
    "xueyuan01": {"name": "张学员", "role": "培训学员", "employee_id": "ST-2026-012"}
}
