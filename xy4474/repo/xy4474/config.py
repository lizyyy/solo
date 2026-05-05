# -*- coding: utf-8 -*-
"""
证件照影楼交付前复核工具 - 配置文件
"""

import os
from datetime import timedelta

# 项目根目录
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# 数据目录配置
DATA_DIR = os.path.join(BASE_DIR, "data")
EXPORT_DIR = os.path.join(BASE_DIR, "exports")
OUTPUT_DIR = os.path.join(BASE_DIR, "output")

# 确保目录存在
for dir_path in [DATA_DIR, EXPORT_DIR, OUTPUT_DIR]:
    if not os.path.exists(dir_path):
        os.makedirs(dir_path)

# 证件照标准配置
STANDARD_SIZES = {
    "一寸": {"width": 295, "height": 413, "dpi": 300},
    "二寸": {"width": 413, "height": 579, "dpi": 300},
    "小一寸": {"width": 260, "height": 378, "dpi": 300},
    "小二寸": {"width": 390, "height": 567, "dpi": 300},
    "大一寸": {"width": 390, "height": 567, "dpi": 300},
    "五寸": {"width": 1205, "height": 840, "dpi": 300},
    "六寸": {"width": 1440, "height": 960, "dpi": 300},
    "身份证": {"width": 358, "height": 441, "dpi": 300},
    "驾驶证": {"width": 358, "height": 441, "dpi": 300},
    "护照": {"width": 390, "height": 567, "dpi": 300},
    "社保": {"width": 358, "height": 441, "dpi": 300},
    "医保": {"width": 358, "height": 441, "dpi": 300},
}

# 标准背景色配置
STANDARD_BACKGROUNDS = {
    "白色": {"hex": "#FFFFFF", "rgb": (255, 255, 255), "tolerance": 30},
    "蓝色": {"hex": "#438EDB", "rgb": (67, 142, 219), "tolerance": 30},
    "红色": {"hex": "#FF0000", "rgb": (255, 0, 0), "tolerance": 30},
    "浅蓝": {"hex": "#87CEEB", "rgb": (135, 206, 235), "tolerance": 30},
    "浅灰": {"hex": "#E0E0E0", "rgb": (224, 224, 224), "tolerance": 30},
}

# 加急单配置
URGENT_CONFIG = {
    "time_limit_hours": 2,  # 加急单限时2小时
    "priority_levels": ["普通", "加急", "特急"],
    "urgent_keywords": ["加急", "特急", "紧急", "urgent", "URGENT"],
}

# 修图状态配置
RETOUCH_STATUS = {
    "pending": "待修图",
    "in_progress": "修图中",
    "completed": "已完成",
    "reviewing": "审核中",
    "approved": "已审核",
    "rejected": "已驳回",
}

# 文件命名规则配置
NAMING_RULES = {
    "pattern": r"^(\d{8,12})_([\u4e00-\u9fa5a-zA-Z]+)_([\u4e00-\u9fa5a-zA-Z0-9]+)_([\u4e00-\u9fa5a-zA-Z0-9]+)\.(jpg|jpeg|png|bmp)$",
    "groups": {
        "order_id": 1,
        "customer_name": 2,
        "size": 3,
        "background": 4,
        "extension": 5,
    },
    "description": "订单号_客户姓名_尺寸_背景色.扩展名",
}

# 问题类型配置
ISSUE_TYPES = {
    "missing_size": {
        "name": "漏尺寸",
        "severity": "high",
        "description": "订单要求的尺寸在导出文件夹中缺失",
    },
    "background_mismatch": {
        "name": "背景色不符",
        "severity": "high",
        "description": "实际背景色与订单要求不符",
    },
    "naming_conflict": {
        "name": "文件命名撞单",
        "severity": "medium",
        "description": "同一订单号对应多个不同客户或规格",
    },
    "unfinished_in_print": {
        "name": "未修完进打印",
        "severity": "high",
        "description": "修图未完成的订单进入了打印队列",
    },
    "urgent_overtime": {
        "name": "加急单超时",
        "severity": "critical",
        "description": "加急单超出规定时间限制",
    },
    "missing_file": {
        "name": "文件缺失",
        "severity": "high",
        "description": "订单记录存在但对应文件不存在",
    },
    "extra_file": {
        "name": "多余文件",
        "severity": "low",
        "description": "导出文件夹中有未在订单中记录的文件",
    },
    "size_mismatch": {
        "name": "尺寸不符",
        "severity": "high",
        "description": "实际像素尺寸与标准规格不符",
    },
}

# 导出配置
EXPORT_CONFIG = {
    "markdown": {
        "encoding": "utf-8",
        "extension": ".md",
        "include_summary": True,
        "include_details": True,
        "include_statistics": True,
    },
    "json": {
        "encoding": "utf-8",
        "ensure_ascii": False,
        "indent": 2,
        "extension": ".json",
    },
}

# 日志配置
LOG_CONFIG = {
    "level": "INFO",
    "format": "%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    "file": os.path.join(BASE_DIR, "review_tool.log"),
    "max_size": 10 * 1024 * 1024,  # 10MB
    "backup_count": 5,
}

# 数据库配置
DATABASE_CONFIG = {
    "path": os.path.join(BASE_DIR, "review_data.db"),
    "echo": False,
}
