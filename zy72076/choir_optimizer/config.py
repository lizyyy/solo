"""系统配置和常量定义"""
import os
from pathlib import Path

BASE_DIR = Path(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

DATA_DIR = BASE_DIR / "data"
RAW_DATA_DIR = DATA_DIR / "raw"
PROCESSED_DATA_DIR = DATA_DIR / "processed"
EXPORTS_DIR = DATA_DIR / "exports"

OUTPUT_DIR = BASE_DIR / "output"
CHARTS_DIR = OUTPUT_DIR / "charts"
REPORTS_DIR = OUTPUT_DIR / "reports"

PARAMS_DIR = BASE_DIR / "params"
DB_PATH = DATA_DIR / "choir_optimizer.db"

EXAMPLES_DIR = BASE_DIR / "examples"

AUDIT_LOG_TABLE = "audit_log"
PARAMS_TABLE = "params"
PARAM_VERSIONS_TABLE = "param_versions"
DATA_SOURCES_TABLE = "data_sources"
RAW_RECORDS_TABLE = "raw_records"
CALCULATIONS_TABLE = "calculations"
CALC_STEPS_TABLE = "calc_steps"
ANOMALIES_TABLE = "anomalies"
CONFLICTS_TABLE = "conflicts"
SUPPLEMENTS_TABLE = "supplements"
CHARTS_TABLE = "charts"

for d in [DATA_DIR, RAW_DATA_DIR, PROCESSED_DATA_DIR, EXPORTS_DIR,
          OUTPUT_DIR, CHARTS_DIR, REPORTS_DIR, PARAMS_DIR, EXAMPLES_DIR]:
    d.mkdir(parents=True, exist_ok=True)

FIELD_MAPPING = {
    "声部": ["声部", "声部名称", "section", "voice_part", "part"],
    "人员": ["人员", "姓名", "成员", "name", "member", "person"],
    "排练日期": ["排练日期", "日期", "date", "rehearsal_date"],
    "出勤状态": ["出勤状态", "出勤", "状态", "attendance", "status"],
    "音准得分": ["音准得分", "音准", "pitch", "pitch_score", "音准分"],
    "节奏得分": ["节奏得分", "节奏", "rhythm", "rhythm_score", "节奏分"],
    "合声得分": ["合声得分", "合声", "harmony", "harmony_score", "合声分"],
    "音量平衡": ["音量平衡", "音量", "volume", "balance", "volume_balance"],
    "情感表达": ["情感表达", "情感", "expression", "emotion", "情感分"],
    "排练时长": ["排练时长", "时长", "duration", "rehearsal_duration"],
    "声部人数": ["声部人数", "人数", "headcount", "member_count"],
    "指挥备注": ["指挥备注", "备注", "comment", "note", "指挥意见"],
    "曲目": ["曲目", "曲目名称", "song", "piece", "repertoire"],
    "小节范围": ["小节范围", "小节", "bars", "measures", "section_range"]
}

CALC_RULES = {
    "个人综合分": lambda row: (
        row["音准得分"] * 0.3 +
        row["节奏得分"] * 0.25 +
        row["合声得分"] * 0.25 +
        row["音量平衡"] * 0.1 +
        row["情感表达"] * 0.1
    ),
    "声部平均分": lambda group: group["个人综合分"].mean(),
    "声部达标率": lambda group: (group["个人综合分"] >= 80).mean() * 100,
    "声部推荐优先级": lambda row: (
        "优先排练" if row["声部达标率"] < 70
        else "正常排练" if row["声部达标率"] < 85
        else "保持状态"
    )
}

DEFAULT_PARAMS = {
    "weights": {
        "音准得分": 0.3,
        "节奏得分": 0.25,
        "合声得分": 0.25,
        "音量平衡": 0.1,
        "情感表达": 0.1
    },
    "thresholds": {
        "excellent": 90,
        "good": 80,
        "pass": 70,
        "anomaly_std": 2.0
    },
    "attendance_weights": {
        "出勤": 1.0,
        "迟到": 0.8,
        "请假": 0.0,
        "缺勤": 0.0
    }
}

ANOMALY_TYPES = {
    "low_score": "个人综合分过低",
    "high_std": "声部内标准差过大",
    "missing_data": "数据缺失",
    "attendance_issue": "出勤率异常",
    "score_drop": "得分环比下降超过10%",
    "boundary_sample": "边界样本（接近阈值）"
}
