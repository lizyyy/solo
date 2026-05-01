from typing import Dict, List, Any
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent.parent

MEAL_TYPES: List[str] = ["早餐", "午餐", "晚餐"]

CHRONIC_DISEASES: Dict[str, List[str]] = {
    "糖尿病": ["需控糖", "低糖饮食"],
    "高血压": ["需限钠", "低盐饮食"],
    "高血脂": ["需低脂", "低油饮食"],
    "痛风": ["需低嘌呤", "限海鲜肉类"],
    "肾病": ["需优质低蛋白", "限蛋白摄入"],
    "普通": ["无特殊要求"]
}

NUTRITION_ITEMS: Dict[str, Dict[str, Any]] = {
    "能量": {"unit": "kcal", "per_100g": True, "daily_ref": 1800},
    "蛋白质": {"unit": "g", "per_100g": True, "daily_ref": 60},
    "脂肪": {"unit": "g", "per_100g": True, "daily_ref": 60},
    "碳水化合物": {"unit": "g", "per_100g": True, "daily_ref": 250},
    "钠": {"unit": "mg", "per_100g": True, "daily_ref": 2000},
    "膳食纤维": {"unit": "g", "per_100g": True, "daily_ref": 25}
}

VALIDATION_RULES: Dict[str, Dict[str, Any]] = {
    "elderly_id": {
        "pattern": r'^E\d{5}$',
        "description": "老人编号必须以E开头，后跟5位数字",
        "example": "E00001"
    },
    "meal_type": {
        "allowed_values": MEAL_TYPES,
        "description": "餐次必须是早餐、午餐或晚餐"
    },
    "weight": {
        "min": 0,
        "max": 5000,
        "description": "克重必须在0-5000克之间"
    },
    "dish_code": {
        "pattern": r'^D\d{4}$',
        "description": "菜品编码必须以D开头，后跟4位数字",
        "example": "D0001"
    },
    "date": {
        "format": "%Y-%m-%d",
        "description": "日期格式必须为YYYY-MM-DD"
    }
}

STORAGE_CONFIG: Dict[str, Any] = {
    "data_dir": BASE_DIR / "data" / "uploads",
    "archive_dir": BASE_DIR / "data" / "archive",
    "max_versions": 10,
    "file_format": "parquet"
}

EXPORT_CONFIG: Dict[str, Any] = {
    "markdown_template": """
# 配餐偏差复盘报告

## 报告信息
- **生成时间**: {generate_time}
- **分析周期**: {start_date} 至 {end_date}
- **数据来源**: {data_source}

## 一、总体概况

### 1.1 基本统计
{overall_stats}

### 1.2 营养摄入概况
{nutrition_overview}

## 二、菜品浪费分析

### 2.1 浪费率排行
{waste_ranking}

### 2.2 长期少打菜品分析
{under_served_analysis}

## 三、慢病标签人群分析

### 3.1 各慢病标签营养摄入
{chronic_nutrition}

### 3.2 营养超标预警
{nutrition_alerts}

## 四、改进建议
{recommendations}

---
*报告由配餐偏差复盘台自动生成*
""",
    "allowed_formats": ["csv", "md", "xlsx"]
}

SAMPLE_DATA_CONFIG: Dict[str, Any] = {
    "num_elderly": 50,
    "num_dishes": 30,
    "date_range": 7,
    "default_date": "2024-01-15"
}
