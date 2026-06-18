from dataclasses import dataclass
from typing import List, Dict, Tuple, Optional


STANDARD_NAMES = {
    '舟山岱山双合潮汐能站': ['舟山岱山双合潮汐能站', '岱山双合潮汐站', '双合站', '双合潮汐站', 'DH-SH', 'SH-01'],
    '温州小门岛潮汐能站': ['温州小门岛潮汐能站', '小门岛站', '小门岛潮汐站', '温州小门岛', 'XM-D'],
    '宁波梅山潮汐能站': ['宁波梅山潮汐能站', '梅山站', '梅山潮汐站', '宁波梅山', 'MS-02'],
    '台州温岭江厦潮汐能站': ['台州温岭江厦潮汐能站', '江厦站', '江厦潮汐试验站', '温岭江厦', 'JX-01'],
    '福州平潭幸福洋潮汐能站': ['福州平潭幸福洋潮汐能站', '幸福洋站', '平潭幸福洋', 'XFY-01'],
}


@dataclass
class NameIssue:
    row: int
    raw_name: str
    standard: Optional[str]
    confidence: str
    note: str


def build_reverse_index() -> Dict[str, str]:
    idx = {}
    for std, aliases in STANDARD_NAMES.items():
        for a in aliases:
            idx[a] = std
            idx[a.lower()] = std
    return idx


def normalize_station_names(records: List[dict], field: str = '站点名称') -> Tuple[List[dict], List[NameIssue]]:
    idx = build_reverse_index()
    issues = []
    out = []
    for i, rec in enumerate(records):
        raw = str(rec.get(field, '')).strip()
        new_rec = dict(rec)
        if not raw:
            issues.append(NameIssue(i + 2, raw, None, 'NONE', '站点名称为空'))
            out.append(new_rec)
            continue
        if raw in STANDARD_NAMES:
            issues.append(NameIssue(i + 2, raw, raw, 'EXACT', '已标准化'))
            out.append(new_rec)
            continue
        if raw in idx:
            std = idx[raw]
            new_rec[field] = std
            issues.append(NameIssue(i + 2, raw, std, 'ALIAS', f'别名匹配，已替换为标准名'))
            out.append(new_rec)
            continue
        matched = None
        for std, aliases in STANDARD_NAMES.items():
            for a in aliases:
                if raw in a or a in raw:
                    matched = std
                    break
            if matched:
                break
        if matched:
            new_rec[field] = matched
            issues.append(NameIssue(i + 2, raw, matched, 'FUZZY', '模糊匹配，请人工确认'))
        else:
            issues.append(NameIssue(i + 2, raw, None, 'UNKNOWN', '未知站点，请核对现场记录表'))
        out.append(new_rec)
    return out, issues


def list_standard_names() -> List[str]:
    return list(STANDARD_NAMES.keys())
