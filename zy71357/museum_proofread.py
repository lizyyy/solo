#!/usr/bin/env python3
"""博物馆展签校对CLI — 校对年代、材质、译名和借展方"""

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field
from difflib import SequenceMatcher
from enum import Enum
from typing import Any, Optional


class Severity(Enum):
    ERROR = "错误"
    WARNING = "警告"
    INFO = "提示"


class CheckType(Enum):
    MISSING_INPUT = "缺项"
    ERA_FORMAT = "年代格式"
    TRANSLATION = "译名一致"
    MATERIAL = "材质比对"
    LENDER = "借展方"
    TEXT_DIFF = "文本差异"


@dataclass
class Issue:
    object_id: str
    object_name: str
    check_type: CheckType
    severity: Severity
    detail: str
    label_value: str = ""
    reference_value: str = ""

    def to_dict(self) -> dict:
        return {
            "对象编号": self.object_id,
            "对象名称": self.object_name,
            "检查类型": self.check_type.value,
            "严重程度": self.severity.value,
            "详情": self.detail,
            "展签值": self.label_value,
            "参考值": self.reference_value,
        }


@dataclass
class ProofreadResult:
    issues: list[Issue] = field(default_factory=list)
    confirmed_ignores: list[str] = field(default_factory=list)

    def has_errors(self) -> bool:
        return any(i.severity == Severity.ERROR for i in self.issues)

    def has_warnings(self) -> bool:
        return any(i.severity == Severity.WARNING for i in self.issues)

    def summary(self) -> dict:
        by_type: dict[str, list[Issue]] = {}
        for issue in self.issues:
            by_type.setdefault(issue.check_type.value, []).append(issue)
        return {
            "总问题数": len(self.issues),
            "错误数": sum(1 for i in self.issues if i.severity == Severity.ERROR),
            "警告数": sum(1 for i in self.issues if i.severity == Severity.WARNING),
            "提示数": sum(1 for i in self.issues if i.severity == Severity.INFO),
            "按类型": {k: len(v) for k, v in by_type.items()},
        }


ERA_PATTERNS = [
    re.compile(r"^(?P<dynasty>[\u4e00-\u9fff]+)（(?P<start>-?\d+)[—\-](?P<end>-?\d+)年）$"),
    re.compile(r"^(?P<dynasty>[\u4e00-\u9fff]+)\((?P<start>-?\d+)[—\-](?P<end>-?\d+)年\)$"),
    re.compile(r"^公元前(?P<start>\d+)年$"),
    re.compile(r"^公元(?P<start>\d+)年$"),
    re.compile(r"^[\u4e00-\u9fff]+（[\u4e00-\u9fff]+\d+年）$"),
    re.compile(r"^\d{4}年$"),
    re.compile(r"^\d{4}—\d{4}年$"),
    re.compile(r"^\d{4}－\d{4}年$"),
]

ERA_SHORT_DYNASTY = re.compile(r"^[\u4e00-\u9fff]{1,3}$")


def validate_era(era: str) -> tuple[bool, str]:
    if not era or not era.strip():
        return False, "年代为空"
    era_stripped = era.strip()
    for pat in ERA_PATTERNS:
        if pat.match(era_stripped):
            return True, ""
    if ERA_SHORT_DYNASTY.match(era_stripped):
        return True, "仅朝代名，建议补充具体年份范围"
    return False, f"年代格式不符合规范：'{era}'，期望格式如'唐代（618—907年）'或'公元前221年'"


def text_similarity(a: str, b: str) -> float:
    return SequenceMatcher(None, a, b).ratio()


def find_in_glossary(value: str, glossary: list[dict], match_key: str, alias_key: str) -> Optional[dict]:
    for entry in glossary:
        if entry.get(match_key) == value:
            return entry
        if value in entry.get(alias_key, []):
            return entry
    return None


def load_json(path: str) -> Any:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


INPUT_NAMES = {
    "labels": "展签文本",
    "archive": "文物档案",
    "terminology": "英文译名术语表",
    "material_spec": "材质规范",
    "lender_directory": "借展方目录",
}


def check_missing_inputs(args: argparse.Namespace) -> list[Issue]:
    issues = []
    for key, display_name in INPUT_NAMES.items():
        val = getattr(args, key, None)
        if not val:
            issues.append(Issue(
                object_id="—",
                object_name="—",
                check_type=CheckType.MISSING_INPUT,
                severity=Severity.ERROR,
                detail=f"缺少输入：{display_name}（--{key}）",
            ))
    return issues


def check_era_format(labels: list[dict]) -> list[Issue]:
    issues = []
    for label in labels:
        era = label.get("era", "")
        ok, msg = validate_era(era)
        if not ok:
            issues.append(Issue(
                object_id=label.get("id", "?"),
                object_name=label.get("name", "?"),
                check_type=CheckType.ERA_FORMAT,
                severity=Severity.ERROR,
                detail=msg,
                label_value=era,
            ))
        elif msg:
            issues.append(Issue(
                object_id=label.get("id", "?"),
                object_name=label.get("name", "?"),
                check_type=CheckType.ERA_FORMAT,
                severity=Severity.INFO,
                detail=msg,
                label_value=era,
            ))
    return issues


def check_translation(labels: list[dict], terminology: list[dict]) -> list[Issue]:
    issues = []
    term_map = {t["id"]: t for t in terminology if "id" in t}
    for label in labels:
        obj_id = label.get("id", "?")
        en_name = label.get("en_name", "")
        if not en_name:
            issues.append(Issue(
                object_id=obj_id,
                object_name=label.get("name", "?"),
                check_type=CheckType.TRANSLATION,
                severity=Severity.ERROR,
                detail="展签缺少英文译名",
                label_value="",
            ))
            continue
        if obj_id not in term_map:
            issues.append(Issue(
                object_id=obj_id,
                object_name=label.get("name", "?"),
                check_type=CheckType.TRANSLATION,
                severity=Severity.WARNING,
                detail=f"术语表中未找到编号 {obj_id} 的标准译名",
                label_value=en_name,
            ))
            continue
        term = term_map[obj_id]
        standard = term.get("standard_en_name", "")
        aliases = term.get("aliases", [])
        if en_name == standard:
            continue
        if en_name in aliases:
            issues.append(Issue(
                object_id=obj_id,
                object_name=label.get("name", "?"),
                check_type=CheckType.TRANSLATION,
                severity=Severity.WARNING,
                detail=f"译名与标准名不一致，但是已知别名（标准名：{standard}）",
                label_value=en_name,
                reference_value=standard,
            ))
        else:
            sim = text_similarity(en_name.lower(), standard.lower())
            if sim > 0.8:
                issues.append(Issue(
                    object_id=obj_id,
                    object_name=label.get("name", "?"),
                    check_type=CheckType.TRANSLATION,
                    severity=Severity.WARNING,
                    detail=f"译名与标准名高度相似但不同（相似度{sim:.0%}，标准名：{standard}）",
                    label_value=en_name,
                    reference_value=standard,
                ))
            else:
                issues.append(Issue(
                    object_id=obj_id,
                    object_name=label.get("name", "?"),
                    check_type=CheckType.TRANSLATION,
                    severity=Severity.ERROR,
                    detail=f"译名与标准名不一致且差异较大（标准名：{standard}）",
                    label_value=en_name,
                    reference_value=standard,
                ))
    return issues


def check_material(labels: list[dict], material_spec: list[dict]) -> list[Issue]:
    issues = []
    for label in labels:
        obj_id = label.get("id", "?")
        mat = label.get("material", "")
        if not mat:
            issues.append(Issue(
                object_id=obj_id,
                object_name=label.get("name", "?"),
                check_type=CheckType.MATERIAL,
                severity=Severity.ERROR,
                detail="展签缺少材质信息",
                label_value="",
            ))
            continue
        found = find_in_glossary(mat, material_spec, "standard_name", "aliases")
        if found:
            if mat != found["standard_name"]:
                issues.append(Issue(
                    object_id=obj_id,
                    object_name=label.get("name", "?"),
                    check_type=CheckType.MATERIAL,
                    severity=Severity.WARNING,
                    detail=f"材质用词非标准名（标准名：{found['standard_name']}）",
                    label_value=mat,
                    reference_value=found["standard_name"],
                ))
        else:
            best_match = None
            best_sim = 0.0
            for spec in material_spec:
                sim = text_similarity(mat, spec["standard_name"])
                if sim > best_sim:
                    best_sim = sim
                    best_match = spec
            if best_match and best_sim > 0.6:
                issues.append(Issue(
                    object_id=obj_id,
                    object_name=label.get("name", "?"),
                    check_type=CheckType.MATERIAL,
                    severity=Severity.WARNING,
                    detail=f"材质可能与'{best_match['standard_name']}'相关（相似度{best_sim:.0%}），但不在规范术语中",
                    label_value=mat,
                    reference_value=best_match["standard_name"],
                ))
            else:
                issues.append(Issue(
                    object_id=obj_id,
                    object_name=label.get("name", "?"),
                    check_type=CheckType.MATERIAL,
                    severity=Severity.ERROR,
                    detail=f"材质'{mat}'不在材质规范术语表中",
                    label_value=mat,
                ))
    return issues


def check_lender(labels: list[dict], lender_directory: list[dict]) -> list[Issue]:
    issues = []
    for label in labels:
        obj_id = label.get("id", "?")
        lender = label.get("lender", "")
        if not lender:
            issues.append(Issue(
                object_id=obj_id,
                object_name=label.get("name", "?"),
                check_type=CheckType.LENDER,
                severity=Severity.ERROR,
                detail="借展方为空，展签必须标明借展方",
                label_value="",
            ))
            continue
        found = find_in_glossary(lender, lender_directory, "name", "aliases")
        if not found:
            best_match = None
            best_sim = 0.0
            for entry in lender_directory:
                sim = text_similarity(lender, entry["name"])
                if sim > best_sim:
                    best_sim = sim
                    best_match = entry
            if best_match and best_sim > 0.7:
                issues.append(Issue(
                    object_id=obj_id,
                    object_name=label.get("name", "?"),
                    check_type=CheckType.LENDER,
                    severity=Severity.WARNING,
                    detail=f"借展方'{lender}'与目录中'{best_match['name']}'相似（{best_sim:.0%}），可能是笔误",
                    label_value=lender,
                    reference_value=best_match["name"],
                ))
            else:
                issues.append(Issue(
                    object_id=obj_id,
                    object_name=label.get("name", "?"),
                    check_type=CheckType.LENDER,
                    severity=Severity.ERROR,
                    detail=f"借展方'{lender}'不在借展方目录中",
                    label_value=lender,
                ))
    return issues


def check_text_diff(labels: list[dict], archive: list[dict]) -> list[Issue]:
    issues = []
    archive_map = {a["id"]: a for a in archive if "id" in a}
    compare_fields = ["name", "era", "material", "lender"]
    for label in labels:
        obj_id = label.get("id", "?")
        if obj_id not in archive_map:
            issues.append(Issue(
                object_id=obj_id,
                object_name=label.get("name", "?"),
                check_type=CheckType.TEXT_DIFF,
                severity=Severity.WARNING,
                detail=f"档案中未找到编号 {obj_id} 的记录，无法进行文本比对",
            ))
            continue
        arch = archive_map[obj_id]
        for fld in compare_fields:
            lv = label.get(fld, "")
            av = arch.get(fld, "")
            if lv != av:
                sim = text_similarity(lv, av) if lv and av else 0.0
                if sim >= 0.9:
                    level = Severity.INFO
                elif sim >= 0.6:
                    level = Severity.WARNING
                else:
                    level = Severity.ERROR
                field_display = {"name": "名称", "era": "年代", "material": "材质", "lender": "借展方"}.get(fld, fld)
                issues.append(Issue(
                    object_id=obj_id,
                    object_name=label.get("name", "?"),
                    check_type=CheckType.TEXT_DIFF,
                    severity=level,
                    detail=f"展签与档案{field_display}不一致（相似度{sim:.0%}）",
                    label_value=lv,
                    reference_value=av,
                ))
    return issues


SEVERITY_STYLES = {
    Severity.ERROR: "\033[91m",
    Severity.WARNING: "\033[93m",
    Severity.INFO: "\033[96m",
}
RESET = "\033[0m"
BOLD = "\033[1m"


def print_issue(idx: int, issue: Issue) -> None:
    style = SEVERITY_STYLES.get(issue.severity, "")
    print(f"  {idx}. {style}[{issue.severity.value}]{RESET} "
          f"{BOLD}{issue.check_type.value}{RESET} — {issue.detail}")
    if issue.label_value or issue.reference_value:
        print(f"     展签值: {issue.label_value}")
        print(f"     参考值: {issue.reference_value}")


def print_summary(result: ProofreadResult) -> None:
    s = result.summary()
    print(f"\n{'='*60}")
    print(f"  校对结果摘要")
    print(f"{'='*60}")
    print(f"  总问题数: {s['总问题数']}")
    print(f"  错误: {s['错误数']}  警告: {s['警告数']}  提示: {s['提示数']}")
    for t, cnt in s["按类型"].items():
        print(f"    - {t}: {cnt}")
    print(f"{'='*60}")


def interactive_confirm(result: ProofreadResult) -> ProofreadResult:
    if not result.issues:
        print("\n✅ 所有检查通过，未发现问题。")
        return result
    error_issues = [i for i in result.issues if i.severity == Severity.ERROR]
    if error_issues:
        print(f"\n⚠️  发现 {len(error_issues)} 个错误，以下问题必须处理：\n")
        for idx, issue in enumerate(result.issues, 1):
            if issue.severity == Severity.ERROR:
                print_issue(idx, issue)

    warn_issues = [i for i in result.issues if i.severity == Severity.WARNING]
    if warn_issues:
        print(f"\n⚡ 发现 {len(warn_issues)} 个警告，可逐条确认是否忽略：\n")
        for issue in warn_issues:
            idx = result.issues.index(issue) + 1
            print_issue(idx, issue)
            ans = input(f"     忽略此警告？(y/N) ").strip().lower()
            if ans == "y":
                result.confirmed_ignores.append(
                    f"{issue.object_id}|{issue.check_type.value}|{issue.detail}"
                )
                print(f"     → 已标记忽略\n")
            else:
                print(f"     → 保留\n")
    return result


def export_report(result: ProofreadResult, output_path: str) -> None:
    report = {
        "summary": result.summary(),
        "confirmed_ignores": result.confirmed_ignores,
        "issues": [i.to_dict() for i in result.issues],
    }
    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"\n📄 校对报告已导出: {output_path}")


def run_proofread(args: argparse.Namespace) -> None:
    print(f"\n{'='*60}")
    print(f"  博物馆展签校对")
    print(f"{'='*60}\n")

    missing_issues = check_missing_inputs(args)
    if missing_issues:
        print("❌ 输入检查未通过，以下输入缺失：\n")
        for i, issue in enumerate(missing_issues, 1):
            print(f"  {i}. {issue.detail}")
        print(f"\n请使用以下参数指定输入文件：")
        for key, name in INPUT_NAMES.items():
            print(f"  --{key} <路径>  {name}")
        sys.exit(1)

    labels = load_json(args.labels)
    archive = load_json(args.archive)
    terminology = load_json(args.terminology)
    material_spec = load_json(args.material_spec)
    lender_directory = load_json(args.lender_directory)

    print(f"📂 已加载输入：")
    print(f"   展签: {len(labels)} 条  |  档案: {len(archive)} 条")
    print(f"   术语表: {len(terminology)} 条  |  材质规范: {len(material_spec)} 条  |  借展方目录: {len(lender_directory)} 条\n")

    result = ProofreadResult()

    print("🔍 第1步：文本比对（展签 vs 档案）")
    result.issues.extend(check_text_diff(labels, archive))
    print(f"   → 发现 {sum(1 for i in result.issues if i.check_type == CheckType.TEXT_DIFF)} 项差异\n")

    print("🔍 第2步：术语表核查（译名一致性）")
    result.issues.extend(check_translation(labels, terminology))
    print(f"   → 发现 {sum(1 for i in result.issues if i.check_type == CheckType.TRANSLATION)} 项问题\n")

    print("🔍 第3步：差异定位（年代格式、材质、借展方）")
    result.issues.extend(check_era_format(labels))
    result.issues.extend(check_material(labels, material_spec))
    result.issues.extend(check_lender(labels, lender_directory))
    detail_count = sum(1 for i in result.issues if i.check_type in (
        CheckType.ERA_FORMAT, CheckType.MATERIAL, CheckType.LENDER))
    print(f"   → 发现 {detail_count} 项问题\n")

    print_summary(result)

    print("\n📋 详细问题列表：\n")
    for idx, issue in enumerate(result.issues, 1):
        print_issue(idx, issue)

    if not args.non_interactive:
        print(f"\n{'='*60}")
        print("  第4步：人工确认")
        print(f"{'='*60}")
        result = interactive_confirm(result)

    output_path = args.output or "proofread_report.json"
    export_report(result, output_path)

    if result.has_errors():
        unconfirmed_errors = [
            i for i in result.issues
            if i.severity == Severity.ERROR
            and f"{i.object_id}|{i.check_type.value}|{i.detail}" not in result.confirmed_ignores
        ]
        if unconfirmed_errors:
            print(f"\n🚫 存在 {len(unconfirmed_errors)} 个未解决的错误，请处理后重新校对。")
            sys.exit(1)

    print(f"\n✅ 校对流程完成。")


def main() -> None:
    parser = argparse.ArgumentParser(
        description="博物馆展签校对CLI — 校对年代、材质、译名和借展方",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例：
  python museum_proofread.py \\
    --labels demo/labels_ok.json \\
    --archive demo/archive_ok.json \\
    --terminology demo/terminology_ok.json \\
    --material_spec demo/material_spec.json \\
    --lender_directory demo/lender_directory.json \\
    --output report.json

  python museum_proofread.py \\
    --labels demo/labels_fail.json \\
    --archive demo/archive_fail.json \\
    --terminology demo/terminology_fail.json \\
    --material_spec demo/material_spec.json \\
    --lender_directory demo/lender_directory.json \\
    --non_interactive
""",
    )
    parser.add_argument("--labels", help="展签文本 JSON 文件路径")
    parser.add_argument("--archive", help="文物档案 JSON 文件路径")
    parser.add_argument("--terminology", help="英文译名术语表 JSON 文件路径")
    parser.add_argument("--material_spec", help="材质规范 JSON 文件路径")
    parser.add_argument("--lender_directory", help="借展方目录 JSON 文件路径")
    parser.add_argument("--output", help="校对报告输出路径（默认 proofread_report.json）")
    parser.add_argument("--non_interactive", action="store_true", help="跳过人工确认步骤")
    args = parser.parse_args()
    run_proofread(args)


if __name__ == "__main__":
    main()
