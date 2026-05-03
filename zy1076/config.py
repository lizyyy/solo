"""
全局配置模块
"""
import os
from pathlib import Path

# 项目根目录
PROJECT_ROOT = Path(__file__).parent.absolute()

# 数据目录
DATA_DIR = PROJECT_ROOT / "data"
RESUMES_DIR = DATA_DIR / "resumes"
JOBS_DIR = DATA_DIR / "jobs"
MODELS_DIR = DATA_DIR / "models"
REPORTS_DIR = DATA_DIR / "reports"

# 技能词典文件
SKILLS_DICT_PATH = DATA_DIR / "skills_dictionary.json"
TRAINING_DATA_PATH = DATA_DIR / "training_data.json"

# 模型配置
DEFAULT_MODEL_CONFIG = {
    "tfidf_max_features": 5000,
    "tfidf_ngram_range": (1, 3),
    "skill_weight": 0.6,
    "tfidf_weight": 0.4,
    "min_match_score": 0.3,
    "evidence_threshold": 0.5,
}

# 支持的文件格式
SUPPORTED_FORMATS = {
    "resumes": [".txt", ".md", ".csv"],
    "jobs": [".txt", ".md", ".csv"],
}

# CSV 字段映射
CSV_FIELD_MAPPING = {
    "resumes": {
        "required": ["name"],
        "optional": ["title", "skills", "experience", "projects", "education", "summary"],
        "text_fields": ["skills", "experience", "projects", "education", "summary"],
    },
    "jobs": {
        "required": ["title"],
        "optional": ["company", "location", "requirements", "responsibilities", "skills", "description"],
        "text_fields": ["requirements", "responsibilities", "skills", "description"],
    },
}

# 报告模板
HTML_TEMPLATE_PATH = PROJECT_ROOT / "resume_matcher" / "templates" / "report.html"
MARKDOWN_TEMPLATE_PATH = PROJECT_ROOT / "resume_matcher" / "templates" / "report.md"

# 确保目录存在
def ensure_directories():
    """确保所有必要的目录存在"""
    for directory in [RESUMES_DIR, JOBS_DIR, MODELS_DIR, REPORTS_DIR]:
        directory.mkdir(parents=True, exist_ok=True)
