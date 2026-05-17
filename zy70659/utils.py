import re
import csv
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict
from datetime import datetime


@dataclass
class Lead:
    id: str
    phone: str = ""
    email: str = ""
    company: str = ""
    source: str = ""
    name: str = ""
    created_at: str = ""
    extra: Dict[str, Any] = None

    def __post_init__(self):
        if self.extra is None:
            self.extra = {}


SOURCE_PRIORITY = {
    "展会": 1,
    "电话": 2,
    "表单": 3,
}


def normalize_phone(phone: str) -> str:
    if not phone:
        return ""
    cleaned = re.sub(r'\D', '', str(phone))
    if len(cleaned) == 11 and cleaned.startswith('1'):
        return cleaned
    if len(cleaned) > 11:
        return cleaned[-11:]
    return cleaned


def normalize_email(email: str) -> str:
    if not email:
        return ""
    return str(email).strip().lower()


def normalize_company(company: str) -> str:
    if not company:
        return ""
    company = str(company).strip()
    company = re.sub(r'[（(][^)）]*[)）]', '', company)
    company = re.sub(r'股份|有限|责任|公司|集团|科技|有限责任|有限公司|集团有限公司', '', company)
    company = re.sub(r'\s+', '', company)
    return company.lower()


def calculate_similarity(str1: str, str2: str) -> float:
    if not str1 or not str2:
        return 0.0
    s1, s2 = str1.lower(), str2.lower()
    if s1 in s2 or s2 in s1:
        return 0.9
    set1, set2 = set(s1), set(s2)
    intersection = len(set1 & set2)
    union = len(set1 | set2)
    return intersection / union if union > 0 else 0.0


def read_leads_from_csv(file_path: str) -> List[Lead]:
    leads = []
    with open(file_path, 'r', encoding='utf-8-sig') as f:
        reader = csv.DictReader(f)
        for idx, row in enumerate(reader):
            lead = Lead(
                id=str(idx),
                phone=row.get('手机号', ''),
                email=row.get('邮箱', ''),
                company=row.get('公司名', ''),
                source=row.get('来源渠道', ''),
                name=row.get('姓名', ''),
                created_at=row.get('创建时间', datetime.now().isoformat()),
                extra={k: v for k, v in row.items() if k not in ['手机号', '邮箱', '公司名', '来源渠道', '姓名', '创建时间']}
            )
            leads.append(lead)
    return leads


def write_leads_to_csv(leads: List[Lead], file_path: str, fieldnames: List[str] = None):
    if not leads:
        with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(['ID', '手机号', '邮箱', '公司名', '来源渠道', '姓名', '创建时间'])
        return
    
    default_fields = ['ID', '手机号', '邮箱', '公司名', '来源渠道', '姓名', '创建时间']
    all_extra_keys = set()
    for lead in leads:
        all_extra_keys.update(lead.extra.keys())
    
    fieldnames = default_fields + sorted(all_extra_keys)
    
    with open(file_path, 'w', encoding='utf-8-sig', newline='') as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for lead in leads:
            row = {
                'ID': lead.id,
                '手机号': lead.phone,
                '邮箱': lead.email,
                '公司名': lead.company,
                '来源渠道': lead.source,
                '姓名': lead.name,
                '创建时间': lead.created_at,
            }
            row.update(lead.extra)
            writer.writerow(row)
