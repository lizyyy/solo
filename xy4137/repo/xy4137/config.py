import os
from pathlib import Path

BASE_DIR = Path(__file__).parent.absolute()

DATA_DIR = BASE_DIR / "data"
MODELS_DIR = BASE_DIR / "models"
OUTPUT_DIR = BASE_DIR / "output"
EXAMPLES_DIR = BASE_DIR / "examples"
TESTS_DIR = BASE_DIR / "tests"

for dir_path in [DATA_DIR, MODELS_DIR, OUTPUT_DIR, EXAMPLES_DIR, TESTS_DIR]:
    dir_path.mkdir(parents=True, exist_ok=True)

RISK_LEVELS = {
    "低风险": {"level": 1, "color": "green"},
    "中风险": {"level": 2, "color": "yellow"},
    "高风险": {"level": 3, "color": "orange"},
    "极高风险": {"level": 4, "color": "red"}
}

HIGH_RISK_KEYWORDS = [
    "自杀", "轻生", "不想活", "活着没意思", "结束生命",
    "割腕", "跳楼", "上吊", "服药", "烧炭",
    "绝望", "无助", "痛苦", "煎熬", "生不如死",
    "告别", "遗书", "遗嘱", "最后一次", "安排后事"
]

MEDIUM_RISK_KEYWORDS = [
    "抑郁", "焦虑", "失眠", "压力大", "崩溃",
    "孤独", "寂寞", "没人理解", "没人关心",
    "想死", "不想活了", "活的太累",
    "家暴", "虐待", "欺凌", "霸凌",
    "离婚", "分手", "失恋", "背叛"
]

TEMPLATE_PHRASES = [
    "请您理解", "请您配合", "按照规定", "根据制度",
    "我们的流程是", "请您耐心等待", "请您谅解",
    "这是规定", "没办法", "不行", "不可以"
]

MODEL_CONFIG = {
    "vectorizer": {
        "max_features": 5000,
        "ngram_range": (1, 2)
    },
    "classifier": {
        "max_iter": 1000,
        "random_state": 42
    }
}

FILE_TYPES = {
    "transcript": {
        "description": "通话转写TXT",
        "extensions": [".txt"]
    },
    "risk_tags": {
        "description": "风险标签CSV",
        "extensions": [".csv"]
    },
    "callback": {
        "description": "回访安排表CSV",
        "extensions": [".csv"]
    }
}
