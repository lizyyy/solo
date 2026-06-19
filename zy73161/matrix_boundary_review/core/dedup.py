from typing import List, Dict
from collections import defaultdict

from .loader import HistoricalAnswer, AliasRecord, build_alias_index


class NormalizedGroup:
    """归一化后的分组 —— 同一题目下同一对象的所有记录（可能跨版本）"""

    def __init__(self, question_id: str, canonical_name: str):
        self.question_id = question_id
        self.canonical_name = canonical_name
        self.items: List[HistoricalAnswer] = []
        self.aliases_found: List[str] = []

    @property
    def versions(self) -> List[str]:
        return sorted(set(it.version for it in self.items))

    @property
    def key(self) -> str:
        return f"{self.question_id}::{self.canonical_name}"


class DuplicateIssue:
    """重复样本疑点 —— 真正的卡点"""

    def __init__(self, key: str, items: List[HistoricalAnswer], reason: str, block_type: str):
        self.key = key
        self.items = items
        self.reason = reason
        self.block_type = block_type
        self.status = "卡点-待人工确认"

    def to_dict(self) -> Dict[str, str]:
        return {
            "疑点标识": self.key,
            "卡点类型": self.block_type,
            "卡点状态": self.status,
            "涉及条目数": str(len(self.items)),
            "卡点说明": self.reason,
            "涉及行号": ",".join(str(it.line_no) for it in self.items),
            "涉及样本名": ",".join(it.item_name for it in self.items),
            "题目编号": self.items[0].question_id if self.items else "",
        }


def normalize_and_group(
    answers: List[HistoricalAnswer],
    aliases: List[AliasRecord]
) -> List[NormalizedGroup]:
    """第一步：用别名映射归一化，按题目+标准名称分组

    同一对象不同称呼的记录会被归到同一组，方便后续跨版本比对。
    别名合并不等于重复 —— 只是称呼不同。
    """

    alias_index = build_alias_index(aliases)
    groups: Dict[str, NormalizedGroup] = {}

    for ans in answers:
        canonical = alias_index.get(ans.item_name, ans.item_name)
        key = f"{ans.question_id}::{canonical}"

        if key not in groups:
            groups[key] = NormalizedGroup(ans.question_id, canonical)

        groups[key].items.append(ans)
        if ans.item_name != canonical and ans.item_name not in groups[key].aliases_found:
            groups[key].aliases_found.append(ans.item_name)

    return list(groups.values())


def detect_true_duplicates(groups: List[NormalizedGroup]) -> List[DuplicateIssue]:
    """第二步：检测真正的重复样本（卡点）

    判定逻辑：
    1. 同一版本内同名(原始名)+同边界值+同单位+同阈值 → 真正重复录入 → 卡点
    2. 不同组但同边界值+同单位+同分类+同阈值，且不在别名映射中 → 疑似同物异名未登记 → 卡点
    """

    issues: List[DuplicateIssue] = []

    for group in groups:
        by_version_name: Dict[str, List[HistoricalAnswer]] = defaultdict(list)
        for item in group.items:
            key = f"{item.version}::{item.item_name}::{item.boundary_value}::{item.unit}::{item.threshold}"
            by_version_name[key].append(item)

        for key, items in by_version_name.items():
            if len(items) > 1:
                first = items[0]
                issues.append(DuplicateIssue(
                    key=f"{group.key}-{first.version}-dup-{first.boundary_value}",
                    items=items,
                    reason=f"同一版本({first.version})内同名({first.item_name})且边界值相同({first.boundary_value}{first.unit})，共{len(items)}条，疑似重复录入",
                    block_type="同版本重复录入"
                ))

    value_groups: Dict[str, List[HistoricalAnswer]] = defaultdict(list)
    all_items = [item for g in groups for item in g.items]
    for ans in all_items:
        if ans.boundary_value and ans.unit and ans.category and ans.threshold and ans.question_id:
            key = f"{ans.question_id}::{ans.category}::{ans.boundary_value}::{ans.unit}::{ans.threshold}"
            value_groups[key].append(ans)

    seen = set()
    for key, items in value_groups.items():
        if len(items) > 1:
            names = set(it.item_name for it in items)
            if len(names) > 1:
                canonical_names = set()
                for g in groups:
                    for it in g.items:
                        if it in items:
                            canonical_names.add(g.canonical_name)
                            break
                if len(canonical_names) > 1:
                    first = items[0]
                    issue_key = f"{first.question_id}-suspect-alias-{first.boundary_value}"
                    if issue_key not in seen:
                        seen.add(issue_key)
                        issues.append(DuplicateIssue(
                            key=issue_key,
                            items=items,
                            reason=f"边界值均为{first.boundary_value}{first.unit}、阈值均为{first.threshold}，但样本名称不同({'/'.join(sorted(names))})，疑似同一对象未登记别名",
                            block_type="疑似同物异名未登记"
                        ))

    return issues
