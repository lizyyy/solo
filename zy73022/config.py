import os

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "data")
EXPORT_DIR = os.path.join(BASE_DIR, "exports")
SAMPLE_DIR = os.path.join(BASE_DIR, "samples")
DB_PATH = os.path.join(DATA_DIR, "pet_weight.db")
SESSION_DB_PATH = os.path.join(DATA_DIR, "session_state.db")

os.makedirs(DATA_DIR, exist_ok=True)
os.makedirs(EXPORT_DIR, exist_ok=True)
os.makedirs(SAMPLE_DIR, exist_ok=True)

PET_NAME_ALIASES = {
    "大橘": ["橘猫", "大橘猫", "橘子", "桔子", "橘胖"],
    "小黑": ["黑猫", "黑炭", "煤球", "小墨"],
    "旺财": ["阿旺", "财财", "汪财", "小狗旺财"],
    "布丁": ["小布", "丁丁", "奶油"],
    "雪球": ["小雪", "球球", "白团子"],
    "豆豆": ["小豆", "豆包", "毛豆"],
}

WEIGHT_UNITS = ["kg", "千克", "g", "克", "斤", "磅", "lb", "lbs"]

UNIT_TO_KG = {
    "kg": 1.0,
    "千克": 1.0,
    "g": 0.001,
    "克": 0.001,
    "斤": 0.5,
    "磅": 0.453592,
    "lb": 0.453592,
    "lbs": 0.453592,
}

EXPORT_FIELDS = [
    "对账批次号",
    "宠物ID",
    "宠物名称",
    "手写单名称",
    "名称匹配状态",
    "原始体重",
    "体重单位",
    "标准体重(kg)",
    "体重单位状态",
    "目标体重(kg)",
    "减重差(kg)",
    "计划日期",
    "手写单日期",
    "用药提醒",
    "病历摘要",
    "复核状态",
    "复核原因",
    "人工备注",
    "备注来源",
    "处理状态",
    "导出时间戳",
]
