from typing import List, Dict, Any
from collections import defaultdict

from .loader import (
    load_historical_answers,
    load_alias_mapping,
    load_supplementary_notes,
    HistoricalAnswer,
    AliasRecord,
    SupplementaryNote,
)
from .dedup import (
    normalize_and_group,
    detect_true_duplicates,
    DuplicateIssue,
    NormalizedGroup,
)
from .jump_detector import detect_all_jumps, JumpIssue


class ReviewedItem:
    """复核后的条目 —— 状态、备注、文件结论三一致"""

    def __init__(self, answer: HistoricalAnswer):
        self.original = answer
        self.status = "复核通过"
        self.remark = ""
        self.conclusion = answer.conclusion
        self.issues: List[str] = []
        self.is_blocked = False
        self.canonical_name = answer.item_name
        self.group_key = ""

    def add_issue(self, issue_type: str, detail: str):
        self.issues.append(f"[{issue_type}] {detail}")

    def finalize(self):
        if self.is_blocked:
            self.status = "卡点-暂不放行"
            self.remark = "重复样本待人工确认，结果暂不放行。"
            self.conclusion = "暂不放行"
            if self.issues:
                self.remark += "；".join(self.issues)
        elif self.issues:
            self.status = "待核查"
            self.remark = "；".join(self.issues)
            self.conclusion = "待核查确认"
        else:
            self.status = "复核通过"
            self.remark = ""

    def to_dict(self) -> Dict[str, str]:
        d = self.original.to_dict()
        d["标准名称(归一化后)"] = self.canonical_name
        d["复核状态"] = self.status
        d["复核备注"] = self.remark
        d["复核结论"] = self.conclusion
        d["三一致校验"] = "通过" if self._check_triple_consistency() else "不一致"
        return d

    def _check_triple_consistency(self) -> bool:
        if self.status == "卡点-暂不放行":
            return (
                "暂不放行" in self.remark
                and self.conclusion == "暂不放行"
            )
        if self.status == "待核查":
            return (
                bool(self.remark)
                and self.conclusion == "待核查确认"
                and any(
                    k in self.remark
                    for k in ["阈值", "单位", "结论", "跳变", "对不上", "重复样本"]
                )
            )
        if self.status == "复核通过":
            return (
                self.remark == ""
                and self.conclusion == self.original.conclusion
                and bool(self.conclusion)
            )
        return False


def _build_reviewed_items(
    groups: List[NormalizedGroup],
    dup_issues: List[DuplicateIssue],
    jump_issues: List[JumpIssue],
) -> List[ReviewedItem]:

    reviewed_map: Dict[int, ReviewedItem] = {}
    all_answers = [item for g in groups for item in g.items]

    for g in groups:
        for ans in g.items:
            item = ReviewedItem(ans)
            item.canonical_name = g.canonical_name
            item.group_key = g.key
            reviewed_map[ans.line_no] = item

    blocked_lines = set()
    for issue in dup_issues:
        for ans in issue.items:
            if ans.line_no in reviewed_map:
                item = reviewed_map[ans.line_no]
                item.is_blocked = True
                item.add_issue("重复样本", issue.reason)
                blocked_lines.add(ans.line_no)

    for issue in jump_issues:
        for ans in issue.items:
            if ans.line_no in reviewed_map:
                item = reviewed_map[ans.line_no]
                if not item.is_blocked:
                    item.add_issue(issue.jump_type, issue.detail)

    for item in reviewed_map.values():
        item.finalize()

    return list(reviewed_map.values())


def run_review(input_dir: str, strict_mode: bool = False) -> Dict[str, Any]:
    print(f"[1/6] 加载历史答案...")
    answers = load_historical_answers(input_dir)
    print(f"      共加载 {len(answers)} 条历史答案")

    print(f"[2/6] 加载别名映射...")
    aliases = load_alias_mapping(input_dir)
    print(f"      共加载 {len(aliases)} 条别名记录")

    print(f"[3/6] 加载后补说明...")
    notes = load_supplementary_notes(input_dir)
    print(f"      共加载 {len(notes)} 条后补说明")

    print(f"[4/6] 归一化分组（同一对象不同称呼合并）...")
    groups = normalize_and_group(answers, aliases)
    multi_ver = sum(1 for g in groups if len(g.versions) > 1)
    alias_merged = sum(1 for g in groups if g.aliases_found)
    print(f"      归一化后共 {len(groups)} 组，其中 {multi_ver} 组跨多版本，{alias_merged} 组合并了别名")

    print(f"[5/6] 检测重复样本（卡点）...")
    dup_issues = detect_true_duplicates(groups)
    print(f"      发现 {len(dup_issues)} 处重复样本疑点（卡点）")
    for iss in dup_issues:
        print(f"        - [{iss.block_type}] {iss.key}: {iss.reason}")

    if dup_issues and strict_mode:
        print()
        print("[严格模式] 检测到重复样本卡点，复核已终止。")
        print("  请先处理卡点后重新运行，或不加 --strict 参数继续。")
        return {
            "answers": answers,
            "aliases": aliases,
            "notes": notes,
            "groups": groups,
            "dup_issues": dup_issues,
            "jump_issues": [],
            "reviewed_items": [],
            "blocked_items": dup_issues,
            "strict_stopped": True,
            "stats": {
                "total_answers": len(answers),
                "total_groups": len(groups),
                "dup_issues": len(dup_issues),
                "jump_issues": 0,
                "passed": 0,
                "blocked": sum(len(iss.items) for iss in dup_issues),
                "needs_review": 0,
            }
        }

    print(f"[6/6] 检测结果跳变...")
    jump_issues = detect_all_jumps(groups, notes)
    jump_by_type = defaultdict(int)
    for iss in jump_issues:
        jump_by_type[iss.jump_type] += 1
    print(f"      发现 {len(jump_issues)} 处跳变疑点")
    for jtype, cnt in jump_by_type.items():
        print(f"        - {jtype}: {cnt}处")

    reviewed = _build_reviewed_items(groups, dup_issues, jump_issues)

    passed = sum(1 for r in reviewed if r.status == "复核通过")
    blocked = sum(1 for r in reviewed if r.status == "卡点-暂不放行")
    needs_review = sum(1 for r in reviewed if r.status == "待核查")

    stats = {
        "total_answers": len(answers),
        "total_groups": len(groups),
        "dup_issues": len(dup_issues),
        "jump_issues": len(jump_issues),
        "passed": passed,
        "blocked": blocked,
        "needs_review": needs_review,
    }

    print()
    print("--- 终端摘要 ---")
    print(f"  总条目数：{len(answers)}  →  归一化后 {len(groups)} 组")
    print(f"  复核通过：{passed} 条")
    print(f"  卡点待确认：{blocked} 条（重复样本）")
    print(f"  待核查跳变：{needs_review} 条")
    print()
    print("  明细数据请查看 CSV 文件，本摘要仅展示关键指标。")

    return {
        "answers": answers,
        "aliases": aliases,
        "notes": notes,
        "groups": groups,
        "dup_issues": dup_issues,
        "jump_issues": jump_issues,
        "reviewed_items": reviewed,
        "blocked_items": dup_issues,
        "strict_stopped": False,
        "stats": stats,
    }
