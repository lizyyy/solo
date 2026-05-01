import os
from typing import Optional
from enum import Enum


class CaseStatus(str, Enum):
    DRAFT = "草稿"
    PENDING_REVIEW = "待督导"
    NEEDS_SUPPLEMENT = "需补充"
    REVIEWED = "已督导"
    CRISIS_HANDLING = "危机处理中"
    ARCHIVED = "已归档"


class RiskLevel(str, Enum):
    LOW = "低风险"
    MEDIUM = "中风险"
    HIGH = "高风险"
    CRISIS = "危机"


class Settings:
    APP_NAME: str = "匿名案例督导流转站"
    APP_VERSION: str = "1.0.0"
    DATABASE_URL: str = "sqlite:///./counseling_cases.db"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "your-secret-key-here-change-in-production")
    API_PREFIX: str = "/api/v1"
    DEBUG: bool = True
    
    SENSITIVE_FIELDS: list = [
        "姓名", "电话", "手机号", "地址", "学校", "单位",
        "身份证", "email", "邮箱", "微信", "QQ"
    ]
    
    STATUS_TRANSITIONS: dict = {
        CaseStatus.DRAFT: [CaseStatus.PENDING_REVIEW, CaseStatus.ARCHIVED],
        CaseStatus.PENDING_REVIEW: [CaseStatus.NEEDS_SUPPLEMENT, CaseStatus.REVIEWED, CaseStatus.CRISIS_HANDLING, CaseStatus.ARCHIVED],
        CaseStatus.NEEDS_SUPPLEMENT: [CaseStatus.PENDING_REVIEW, CaseStatus.ARCHIVED],
        CaseStatus.REVIEWED: [CaseStatus.ARCHIVED],
        CaseStatus.CRISIS_HANDLING: [CaseStatus.REVIEWED, CaseStatus.ARCHIVED],
        CaseStatus.ARCHIVED: []
    }
    
    VALID_SCALE_RANGES: dict = {
        "SDS": (0, 100),
        "SAS": (0, 100),
        "SCL90": (0, 270),
        "GAD7": (0, 21),
        "PHQ9": (0, 27)
    }
    
    RISK_TRIGGERS: dict = {
        RiskLevel.LOW: ["一般心理问题", "适应障碍", "轻度焦虑"],
        RiskLevel.MEDIUM: ["中度抑郁", "中度焦虑", "睡眠障碍", "人际关系严重冲突"],
        RiskLevel.HIGH: ["重度抑郁", "重度焦虑", "自杀意念", "自伤行为"],
        RiskLevel.CRISIS: ["自杀计划", "自杀准备", "近期自伤史", "急性危机", "暴力风险"]
    }

settings = Settings()
