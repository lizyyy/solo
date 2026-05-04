import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

DATA_DIR = BASE_DIR / "data"
DB_DIR = DATA_DIR / "db"
SAMPLES_DIR = DATA_DIR / "samples"
EXPORTS_DIR = BASE_DIR / "exports"

for dir_path in [DATA_DIR, DB_DIR, SAMPLES_DIR, EXPORTS_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

DATABASE_URL = f"sqlite:///{DB_DIR / 'risk_reviewer.db'}"

RISK_LEVELS = {
    "green": {"name": "低风险", "color": "#28a745", "score_min": 0, "score_max": 30},
    "yellow": {"name": "中风险", "color": "#ffc107", "score_min": 31, "score_max": 60},
    "orange": {"name": "高风险", "color": "#fd7e14", "score_min": 61, "score_max": 80},
    "red": {"name": "极高风险", "color": "#dc3545", "score_min": 81, "score_max": 100},
}

RISK_FLAGS = {
    "self_harm": {"name": "自伤风险", "weight": 40},
    "suicide_ideation": {"name": "自杀意念", "weight": 50},
    "suicide_plan": {"name": "自杀计划", "weight": 70},
    "suicide_attempt": {"name": "自杀企图", "weight": 90},
    "repeat_caller": {"name": "重复来电", "weight": 15},
    "escalation": {"name": "风险升级", "weight": 25},
    "missed_followup": {"name": "漏回访", "weight": 30},
    "referral_timeout": {"name": "转介超时", "weight": 20},
}

FOLLOWUP_REQUIRED_HOURS = {
    "red": 24,
    "orange": 48,
    "yellow": 72,
    "green": 168,
}

REFERRAL_TIMEOUT_HOURS = 72

KEYWORDS = {
    "self_harm": [
        "割腕", "割手", "割伤", "自残", "自伤", "自我伤害", "撞头", "撞墙",
        "吃药", "服药过量", "吞药", " overdose ", "self-harm", "self harm",
    ],
    "suicide_ideation": [
        "不想活", "不想活了", "活着没意思", "活着没意义", "想死", "不想活",
        "结束生命", "了结生命", "离开这个世界", "走了", "自杀", "想自杀",
        "suicide", "kill myself", "want to die", "结束自己",
    ],
    "suicide_plan": [
        "有办法", "有方法", "准备好了", "计划好了", "已经决定", "想好",
        "什么时候", "哪天", "地点", "时间", "准备", "计划", "决定",
        "how to", "when to", "where to", "have a plan",
    ],
    "suicide_attempt": [
        "试过", "试过了", "尝试过", "已经做了", "差点", "差一点", "刚刚",
        "tried", "attempted", "almost", "just now",
    ],
}
