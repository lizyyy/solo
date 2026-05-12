from datetime import datetime, timedelta
from typing import List, Dict, Any


def get_sample_personnel() -> List[Dict[str, Any]]:
    return [
        {
            "name": "张三",
            "employee_id": "E001",
            "department": "生产部",
            "phone": "13800138001",
            "email": "zhangsan@company.com",
        },
        {
            "name": "李四",
            "employee_id": "E002",
            "department": "研发部",
            "phone": "13800138002",
            "email": "lisi@company.com",
        },
        {
            "name": "王五",
            "employee_id": "E003",
            "department": "行政部",
            "phone": "13800138003",
            "email": "wangwu@company.com",
        },
        {
            "name": "赵六",
            "employee_id": "E004",
            "department": "生产部",
            "phone": "13800138004",
            "email": "zhaoliu@company.com",
        },
        {
            "name": "钱七",
            "employee_id": "E005",
            "department": "销售部",
            "phone": "13800138005",
            "email": "qianqi@company.com",
        },
    ]


def get_sample_certificates(personnel_ids: List[str]) -> List[Dict[str, Any]]:
    today = datetime.now().date()

    return [
        {
            "personnel_id": personnel_ids[0],
            "personnel_name": "张三",
            "certificate_type": "急救员初级证书",
            "certificate_number": "FA2024001",
            "issue_date": (today - timedelta(days=365)).strftime("%Y-%m-%d"),
            "expiry_date": (today + timedelta(days=365)).strftime("%Y-%m-%d"),
            "issuer": "急救培训中心",
        },
        {
            "personnel_id": personnel_ids[1],
            "personnel_name": "李四",
            "certificate_type": "急救员初级证书",
            "certificate_number": "FA2022001",
            "issue_date": (today - timedelta(days=730)).strftime("%Y-%m-%d"),
            "expiry_date": (today - timedelta(days=30)).strftime("%Y-%m-%d"),
            "issuer": "急救培训中心",
        },
        {
            "personnel_id": personnel_ids[2],
            "personnel_name": "王五",
            "certificate_type": "急救员高级证书",
            "certificate_number": "FA2024002",
            "issue_date": (today - timedelta(days=180)).strftime("%Y-%m-%d"),
            "expiry_date": (today + timedelta(days=15)).strftime("%Y-%m-%d"),
            "issuer": "急救培训中心",
        },
        {
            "personnel_id": personnel_ids[3],
            "personnel_name": "赵六",
            "certificate_type": "急救员初级证书",
            "certificate_number": "FA2023005",
            "issue_date": (today - timedelta(days=500)).strftime("%Y-%m-%d"),
            "expiry_date": (today + timedelta(days=230)).strftime("%Y-%m-%d"),
            "issuer": "急救培训中心",
        },
    ]


def get_sample_retraining(
    personnel_ids: List[str], certificate_ids: List[str]
) -> List[Dict[str, Any]]:
    today = datetime.now().date()

    return [
        {
            "certificate_id": certificate_ids[0],
            "personnel_id": personnel_ids[0],
            "personnel_name": "张三",
            "planned_date": (today + timedelta(days=300)).strftime("%Y-%m-%d"),
            "trainer": "王讲师",
            "notes": "复训时间已协调",
        },
        {
            "certificate_id": certificate_ids[1],
            "personnel_id": personnel_ids[1],
            "personnel_name": "李四",
            "planned_date": (today - timedelta(days=15)).strftime("%Y-%m-%d"),
            "trainer": None,
            "notes": "未完成复训，已过期",
        },
        {
            "certificate_id": certificate_ids[2],
            "personnel_id": personnel_ids[2],
            "personnel_name": "王五",
            "planned_date": (today + timedelta(days=7)).strftime("%Y-%m-%d"),
            "trainer": "李讲师",
            "notes": "即将到期，需紧急复训",
        },
        {
            "certificate_id": certificate_ids[3],
            "personnel_id": personnel_ids[3],
            "personnel_name": "赵六",
            "planned_date": (today + timedelta(days=180)).strftime("%Y-%m-%d"),
            "trainer": None,
            "notes": "尚未安排",
        },
    ]
