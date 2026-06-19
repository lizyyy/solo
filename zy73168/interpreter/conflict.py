"""版本冲突检测：同题出现“学生草稿旧版”与“正式记录”且内容不一致时，标注冲突。

规则（对应需求“同一题被两个版本答案覆盖”）：
- 冲突时正式记录为基准，学生草稿旧版保留备查但不覆盖正式结论。
- 冲突明细逐项列出差异点（模型/单位/数据点），方便接手人核对。
"""

from typing import List, Tuple

from .models import RawRecord, SourceType, SOURCE_LABEL


def _diff_points(a: list, b: list) -> str:
    la, lb = len(a), len(b)
    if la != lb:
        return f"数据点数量不同（正式 {la} 个 / 草稿 {lb} 个）"
    diffs = [(i, tuple(a[i]), tuple(b[i])) for i in range(la) if a[i] != b[i]]
    if not diffs:
        return "数据点相同"
    sample = diffs[0]
    return f"数据点不一致，例如第 {sample[0] + 1} 个点：正式 {sample[1]} / 草稿 {sample[2]}（共 {len(diffs)} 处不同）"


def describe_conflict(canon: RawRecord, other: RawRecord) -> str:
    parts: List[str] = []
    if canon.model != other.model:
        parts.append(f"模型不同：正式「{canon.model or '(空)'}」/ 草稿「{other.model or '(空)'}」")
    if (canon.x_unit or "") != (other.x_unit or ""):
        parts.append(f"x轴单位不同：正式「{canon.x_unit or '(缺失)'}」/ 草稿「{other.x_unit or '(缺失)'}」")
    if (canon.y_unit or "") != (other.y_unit or ""):
        parts.append(f"y轴单位不同：正式「{canon.y_unit or '(缺失)'}」/ 草稿「{other.y_unit or '(缺失)'}」")
    parts.append(_diff_points(canon.points, other.points))
    meta = other.source_meta
    extra = meta.get("note", "")
    head = f"题 {canon.question_id} 存在版本冲突：{SOURCE_LABEL[other.source]}与正式记录不一致。"
    if extra:
        head += f" 草稿备注：{extra}"
    return head + "\n  - " + "\n  - ".join(parts)


def conflicting_drafts(canon: RawRecord, all_records: List[RawRecord]) -> List[RawRecord]:
    return [
        r for r in all_records
        if r is not canon and r.source == SourceType.STUDENT_DRAFT_OLD and _records_differ(canon, r)
    ]


def _records_differ(a: RawRecord, b: RawRecord) -> bool:
    if (a.model or "") != (b.model or ""):
        return True
    if (a.x_unit or "") != (b.x_unit or ""):
        return True
    if (a.y_unit or "") != (b.y_unit or ""):
        return True
    if _norm(a.points) != _norm(b.points):
        return True
    return False


def _norm(points):
    return [(round(float(x), 9), round(float(y), 9)) for x, y in points]


def summarize(canon: RawRecord, drafts: List[RawRecord]) -> Tuple[bool, str]:
    real_conflicts = [d for d in drafts if _records_differ(canon, d)]
    if not real_conflicts:
        return False, ""
    detail = "\n".join(describe_conflict(canon, d) for d in real_conflicts)
    detail += "\n处理：以正式记录为基准；草稿旧版保留备查，不覆盖正式结论。"
    return True, detail
