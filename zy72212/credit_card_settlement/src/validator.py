import pandas as pd
from typing import Dict, List, Tuple
from .models import RecordStatus


STANDARD_SHORT_NAMES = {
    "招商银行": "招商银行股份有限公司",
    "工商银行": "中国工商银行股份有限公司",
    "建设银行": "中国建设银行股份有限公司",
    "农业银行": "中国农业银行股份有限公司",
    "中国银行": "中国银行股份有限公司",
    "交通银行": "交通银行股份有限公司",
    "浦发银行": "上海浦东发展银行股份有限公司",
    "中信银行": "中信银行股份有限公司",
    "兴业银行": "兴业银行股份有限公司",
}

ORG_ALIASES = {
    "招行": "招商银行",
    "招商银行信用卡中心": "招商银行",
    "工行": "工商银行",
    "建行": "建设银行",
    "农行": "农业银行",
    "中行": "中国银行",
    "交行": "交通银行",
}

STANDARD_ORG_NAMES = {}
STANDARD_ORG_NAMES.update(STANDARD_SHORT_NAMES)
for alias, standard in ORG_ALIASES.items():
    STANDARD_ORG_NAMES[alias] = STANDARD_SHORT_NAMES[standard]


def get_standard_org_name(org_name: str) -> str:
    return STANDARD_ORG_NAMES.get(org_name.strip(), org_name.strip())


def check_org_name_consistency(org_name: str, card_no: str) -> Tuple[bool, str, str]:
    org_name = org_name.strip()

    if org_name in STANDARD_SHORT_NAMES:
        return True, org_name, STANDARD_SHORT_NAMES[org_name]

    if org_name in ORG_ALIASES:
        expected_org = ORG_ALIASES[org_name]
        expected_std = STANDARD_SHORT_NAMES[expected_org]
        return False, expected_org, expected_std

    expected_std = get_standard_org_name(org_name)
    return False, expected_std, expected_std


def validate_batch(df: pd.DataFrame) -> List[Dict]:
    issues = []
    for idx, row in df.iterrows():
        org_name = str(row.get("机构简称", "")).strip()
        card_no = str(row.get("卡号", "")).strip()
        serial_no = str(row.get("流水号", "")).strip()

        consistent, expected_org, std_name = check_org_name_consistency(org_name, card_no)

        if not consistent:
            issues.append({
                "row_index": idx,
                "serial_no": serial_no,
                "org_name": org_name,
                "expected_org": expected_org,
                "standard_name": std_name,
                "issue": f"机构简称'{org_name}'与标准库不一致，期望应为'{expected_org}'",
            })
    return issues
