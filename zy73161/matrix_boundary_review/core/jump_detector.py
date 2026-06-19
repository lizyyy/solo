from typing import List, Dict, Optional
from collections import defaultdict

from .loader import HistoricalAnswer, SupplementaryNote
from .dedup import NormalizedGroup


class JumpIssue:
    """结果跳变疑点"""

    def __init__(
        self,
        key: str,
        items: List[HistoricalAnswer],
        jump_type: str,
        detail: str,
        affected_groups: List[str] = None,
    ):
        self.key = key
        self.items = items
        self.jump_type = jump_type
        self.detail = detail
        self.affected_groups = affected_groups or []
        self.status = "跳变-待核查"

    def to_dict(self) -> Dict[str, str]:
        return {
            "疑点标识": self.key,
            "跳变类型": self.jump_type,
            "跳变详情": self.detail,
            "涉及条目数": str(len(self.items)),
            "涉及行号": ",".join(str(it.line_no) for it in self.items),
            "题目编号": self.items[0].question_id if self.items else "",
        }


def _parse_num(s: str) -> Optional[float]:
    if not s:
        return None
    try:
        return float(s)
    except ValueError:
        return None


def detect_threshold_jumps(groups: List[NormalizedGroup]) -> List[JumpIssue]:
    """检测阈值跳变 —— 同一对象不同版本的阈值差异超过50%"""

    issues: List[JumpIssue] = []

    for group in groups:
        if len(group.versions) < 2:
            continue

        by_version: Dict[str, List[HistoricalAnswer]] = defaultdict(list)
        for item in group.items:
            by_version[item.version].append(item)

        threshold_pairs = []
        for ver, items in sorted(by_version.items()):
            vals = []
            for it in items:
                val = _parse_num(it.threshold)
                if val is not None:
                    vals.append((it, val))
            if vals:
                threshold_pairs.append((ver, vals))

        if len(threshold_pairs) < 2:
            continue

        all_items = []
        for _, vals in threshold_pairs:
            for it, _ in vals:
                all_items.append(it)

        first_val = threshold_pairs[0][1][0][1]
        last_val = threshold_pairs[-1][1][0][1]

        if first_val > 0 and abs(last_val - first_val) / first_val > 0.5:
            ratio = abs(last_val - first_val) / first_val * 100
            first_ver = threshold_pairs[0][0]
            last_ver = threshold_pairs[-1][0]
            issues.append(JumpIssue(
                key=group.key,
                items=all_items,
                jump_type="阈值跳变",
                detail=f"从{first_ver}到{last_ver}，阈值由{first_val}变为{last_val}，变化{ratio:.1f}%，超过50%合理波动范围"
            ))

    return issues


def detect_unit_mismatches(groups: List[NormalizedGroup]) -> List[JumpIssue]:
    """检测单位不一致 —— 同一对象不同版本使用不同单位"""

    issues: List[JumpIssue] = []

    for group in groups:
        if len(group.versions) < 2:
            continue

        units = set()
        for item in group.items:
            if item.unit:
                units.add(item.unit)

        if len(units) > 1:
            issues.append(JumpIssue(
                key=group.key,
                items=group.items,
                jump_type="单位不一致",
                detail=f"同一对象出现多种单位：{' / '.join(sorted(units))}，需确认是否为同一量纲的换算关系"
            ))

    return issues


def detect_conclusion_jumps(groups: List[NormalizedGroup]) -> List[JumpIssue]:
    """检测结论跳变 —— 同一对象不同版本结论不一致"""

    issues: List[JumpIssue] = []

    for group in groups:
        if len(group.versions) < 2:
            continue

        by_version: Dict[str, List[HistoricalAnswer]] = defaultdict(list)
        for item in group.items:
            by_version[item.version].append(item)

        version_conclusions = {}
        for ver, items in sorted(by_version.items()):
            conclusions = set(it.conclusion for it in items if it.conclusion)
            if conclusions:
                version_conclusions[ver] = conclusions

        if len(version_conclusions) < 2:
            continue

        all_conclusions = set()
        for cs in version_conclusions.values():
            all_conclusions.update(cs)

        if len(all_conclusions) > 1:
            details = []
            for ver, cs in sorted(version_conclusions.items()):
                details.append(f"{ver}: {'/'.join(sorted(cs))}")
            issues.append(JumpIssue(
                key=group.key,
                items=group.items,
                jump_type="结论跳变",
                detail=f"不同版本结论不一致 —— {'；'.join(details)}"
            ))

    return issues


def detect_supplementary_mismatch(
    groups: List[NormalizedGroup],
    notes: List[SupplementaryNote]
) -> List[JumpIssue]:
    """检测后补说明与历史答案的标题/明细对不上的情况"""

    issues: List[JumpIssue] = []

    group_map: Dict[str, NormalizedGroup] = {}
    for g in groups:
        group_map[g.key] = g

    for note in notes:
        if not note.question_id:
            continue

        matched_groups = []
        for g in groups:
            if g.question_id == note.question_id:
                if note.item_name and (
                    note.item_name == g.canonical_name or
                    note.item_name in g.aliases_found
                ):
                    matched_groups.append(g)
                elif not note.item_name:
                    matched_groups.append(g)

        if not matched_groups:
            issues.append(JumpIssue(
                key=f"note-{note.line_no}",
                items=[],
                jump_type="标题明细对不上",
                detail=f"后补说明(行{note.line_no})：题目{note.question_id} / 样本『{note.item_name or '未指定'}』在历史答案中找不到匹配条目"
            ))
            continue

        for g in matched_groups:
            if note.update_conclusion:
                existing_conclusions = set(it.conclusion for it in g.items if it.conclusion)
                if note.update_conclusion not in existing_conclusions and existing_conclusions:
                    issues.append(JumpIssue(
                        key=f"{g.key}-supplement",
                        items=g.items,
                        jump_type="后补结论冲突",
                        detail=f"后补说明(行{note.line_no})更新结论为『{note.update_conclusion}』，但历史答案结论为{'/'.join(sorted(existing_conclusions))}，需确认是否放行"
                    ))

            if note.title:
                title_match = any(
                    note.title in it.remark or note.title in it.item_name
                    for it in g.items
                )
                if not title_match and g.aliases_found:
                    pass

    return issues


def detect_all_jumps(
    groups: List[NormalizedGroup],
    notes: List[SupplementaryNote],
) -> List[JumpIssue]:
    issues: List[JumpIssue] = []
    issues.extend(detect_threshold_jumps(groups))
    issues.extend(detect_unit_mismatches(groups))
    issues.extend(detect_conclusion_jumps(groups))
    issues.extend(detect_supplementary_mismatch(groups, notes))
    return issues
