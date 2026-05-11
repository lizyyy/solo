import os

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./lab_cylinders.db")
SECRET_KEY = os.getenv("SECRET_KEY", "lab-cylinders-secret-key")
API_PREFIX = "/api/v1"

WARNING_THRESHOLDS = {
    "LOW": 30,
    "CRITICAL": 10,
    "EMERGENCY": 5
}

DANGER_CATEGORIES = {
    "NON_HAZARDOUS": {
        "name": "非危险气体",
        "color": "green",
        "warning_multiplier": 1.0,
        "requires_special_approval": False
    },
    "FLAMMABLE": {
        "name": "易燃气体",
        "color": "red",
        "warning_multiplier": 1.5,
        "requires_special_approval": True
    },
    "TOXIC": {
        "name": "有毒气体",
        "color": "yellow",
        "warning_multiplier": 2.0,
        "requires_special_approval": True
    },
    "OXIDIZING": {
        "name": "氧化性气体",
        "color": "orange",
        "warning_multiplier": 1.8,
        "requires_special_approval": True
    },
    "INERT": {
        "name": "惰性气体",
        "color": "blue",
        "warning_multiplier": 1.2,
        "requires_special_approval": False
    }
}

CYLINDER_STATUS = {
    "IN_STORAGE": "在库",
    "IN_USE": "使用中",
    "LOW_WARNING": "余量预警",
    "CRITICAL_WARNING": "严重预警",
    "EMERGENCY_WARNING": "紧急预警",
    "EXCHANGING": "换瓶中",
    "DECOMMISSIONED": "报废"
}

BORROW_STATUS = {
    "ACTIVE": "使用中",
    "RETURNED": "已归还",
    "OVERDUE": "超期"
}

EXCHANGE_STATUS = {
    "PENDING": "待审批",
    "APPROVED": "已批准",
    "IN_PROGRESS": "进行中",
    "COMPLETED": "已完成",
    "REJECTED": "已拒绝"
}
