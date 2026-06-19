import csv
import os
from typing import List, Dict, Tuple


class HistoricalAnswer:
    """历史答案条目 —— 旧表与新备注可能混合在同一份文件里"""

    def __init__(self, row: Dict[str, str], line_no: int):
        self.line_no = line_no
        self.question_id = (row.get("题目编号") or row.get("question_id") or "").strip()
        self.item_name = (row.get("样本名称") or row.get("item_name") or "").strip()
        self.category = (row.get("分类") or row.get("category") or "").strip()
        self.boundary_value = (row.get("边界值") or row.get("boundary_value") or "").strip()
        self.unit = (row.get("单位") or row.get("unit") or "").strip()
        self.threshold = (row.get("阈值") or row.get("threshold") or "").strip()
        self.conclusion = (row.get("文件结论") or row.get("conclusion") or "").strip()
        self.remark = (row.get("备注") or row.get("remark") or "").strip()
        self.version = (row.get("版本") or row.get("version") or "旧版").strip()
        self.status = (row.get("状态") or row.get("status") or "待复核").strip()

        self.raw_row = row

    def to_dict(self) -> Dict[str, str]:
        return {
            "题目编号": self.question_id,
            "样本名称": self.item_name,
            "分类": self.category,
            "边界值": self.boundary_value,
            "单位": self.unit,
            "阈值": self.threshold,
            "文件结论": self.conclusion,
            "备注": self.remark,
            "版本": self.version,
            "状态": self.status,
            "原始行号": str(self.line_no),
        }


class AliasRecord:
    """别名记录 —— 同一对象换了称呼的映射"""

    def __init__(self, row: Dict[str, str], line_no: int):
        self.line_no = line_no
        self.primary_name = (row.get("标准名称") or row.get("primary_name") or "").strip()
        self.alias_name = (row.get("别名") or row.get("alias_name") or "").strip()
        self.question_id = (row.get("题目编号") or row.get("question_id") or "").strip()
        self.note = (row.get("说明") or row.get("note") or "").strip()

    def to_dict(self) -> Dict[str, str]:
        return {
            "标准名称": self.primary_name,
            "别名": self.alias_name,
            "题目编号": self.question_id,
            "说明": self.note,
            "原始行号": str(self.line_no),
        }


class SupplementaryNote:
    """后补说明 —— 后续补充的备注/解释材料"""

    def __init__(self, row: Dict[str, str], line_no: int):
        self.line_no = line_no
        self.question_id = (row.get("题目编号") or row.get("question_id") or "").strip()
        self.item_name = (row.get("样本名称") or row.get("item_name") or "").strip()
        self.title = (row.get("标题") or row.get("title") or "").strip()
        self.detail = (row.get("明细") or row.get("detail") or "").strip()
        self.update_conclusion = (row.get("更新结论") or row.get("update_conclusion") or "").strip()
        self.source = (row.get("来源") or row.get("source") or "后补").strip()

    def to_dict(self) -> Dict[str, str]:
        return {
            "题目编号": self.question_id,
            "样本名称": self.item_name,
            "标题": self.title,
            "明细": self.detail,
            "更新结论": self.update_conclusion,
            "来源": self.source,
            "原始行号": str(self.line_no),
        }


def load_csv(filepath: str) -> List[Dict[str, str]]:
    rows = []
    with open(filepath, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for i, row in enumerate(reader, start=2):
            rows.append({k: v for k, v in row.items()})
    return rows


def load_historical_answers(input_dir: str) -> List[HistoricalAnswer]:
    path = os.path.join(input_dir, "historical_answers.csv")
    if not os.path.exists(path):
        raise FileNotFoundError(f"缺少历史答案文件：{path}")
    rows = load_csv(path)
    return [HistoricalAnswer(row, i) for i, row in enumerate(rows, start=2)]


def load_alias_mapping(input_dir: str) -> List[AliasRecord]:
    path = os.path.join(input_dir, "alias_mapping.csv")
    if not os.path.exists(path):
        return []
    rows = load_csv(path)
    return [AliasRecord(row, i) for i, row in enumerate(rows, start=2)]


def load_supplementary_notes(input_dir: str) -> List[SupplementaryNote]:
    path = os.path.join(input_dir, "supplementary_notes.csv")
    if not os.path.exists(path):
        return []
    rows = load_csv(path)
    return [SupplementaryNote(row, i) for i, row in enumerate(rows, start=2)]


def build_alias_index(aliases: List[AliasRecord]) -> Dict[str, str]:
    index: Dict[str, str] = {}
    for a in aliases:
        if a.primary_name and a.alias_name:
            index[a.alias_name] = a.primary_name
            index[a.primary_name] = a.primary_name
    return index
