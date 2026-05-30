from __future__ import annotations

import csv
import io
import sys
from datetime import date
from typing import TextIO

from .models import (
    ArrivalStatus,
    BadDataCategory,
    BadRecord,
    MatchResult,
    ProblemCategory,
)


def _fmt_date(d: date | None) -> str:
    return d.isoformat() if d else ""


def format_bad_record(r: BadRecord) -> str:
    return (
        f"[坏数据-{r.category.value}] {r.detail}\n"
        f"  来源: {r.source_file} 第 {r.source_line} 行\n"
        f"  原始内容: {r.raw_line}"
    )


def format_match_result(r: MatchResult) -> str:
    parts: list[str] = []
    dan = r.bujiao_dan
    parts.append(f"单号 {dan.dan_hao} | {dan.name} | 身份证 {dan.id_number} | 单位 {dan.unit_code}")
    parts.append(f"  补缴月份: {dan.bujiao_month} | 金额: {dan.amount}元 | 申报日期: {dan.declare_date}")
    parts.append(f"  来源: {dan.source_file} 第 {dan.source_line} 行")

    if r.problems:
        tags = "、".join(p.value for p in r.problems)
        parts.append(f"  ⚠ 问题标记: {tags}")

    parts.append(f"  人员匹配: {r.person_match_reason}")
    if r.matched_person:
        p = r.matched_person
        parts.append(f"    → 匹配到: {p.name} | 身份证 {p.id_number} | 单位 {p.unit_code} | 状态 {p.status}")
    else:
        parts.append(f"    → 未匹配到参保人")

    parts.append(f"  月份校验: {r.month_validation_reason}")

    parts.append(f"  到账状态: {r.arrival_status.value}")
    parts.append(f"    → {r.arrival_status_reason}")

    return "\n".join(parts)


def _group_by_problem(
    results: list[MatchResult],
) -> dict[ProblemCategory, list[MatchResult]]:
    grouped: dict[ProblemCategory, list[MatchResult]] = {}
    for r in results:
        for p in r.problems:
            grouped.setdefault(p, []).append(r)
    return grouped


def _categorize_results(
    results: list[MatchResult],
) -> tuple[list[MatchResult], list[MatchResult]]:
    normal: list[MatchResult] = []
    problematic: list[MatchResult] = []
    for r in results:
        if r.problems:
            problematic.append(r)
        else:
            normal.append(r)
    return normal, problematic


def print_report(
    results: list[MatchResult],
    bad_records: list[BadRecord],
    out: TextIO | None = None,
) -> None:
    if out is None:
        out = sys.stdout

    normal, problematic = _categorize_results(results)

    out.write("=" * 70 + "\n")
    out.write("养老金补缴到账匹配报告\n")
    out.write("=" * 70 + "\n\n")

    out.write(f"补缴单总数: {len(results)}\n")
    out.write(f"正常记录: {len(normal)} 条\n")
    out.write(f"问题记录: {len(problematic)} 条\n")
    out.write(f"坏数据: {len(bad_records)} 条\n")
    out.write("\n")

    if bad_records:
        out.write("-" * 70 + "\n")
        out.write("一、坏数据（无法解析，需人工核查原始材料）\n")
        out.write("-" * 70 + "\n\n")
        for i, r in enumerate(bad_records, 1):
            out.write(f"{i}. {format_bad_record(r)}\n\n")

    if normal:
        out.write("-" * 70 + "\n")
        out.write("二、正常记录（匹配无问题）\n")
        out.write("-" * 70 + "\n\n")
        for i, r in enumerate(normal, 1):
            out.write(f"{i}. {format_match_result(r)}\n\n")

    if problematic:
        grouped = _group_by_problem(problematic)

        out.write("-" * 70 + "\n")
        out.write("三、问题记录\n")
        out.write("-" * 70 + "\n\n")

        for cat in [ProblemCategory.LATE_ARRIVAL, ProblemCategory.DUPLICATE_NAME, ProblemCategory.DUPLICATE_MONTH]:
            items = grouped.get(cat, [])
            if not items:
                continue
            out.write(f"【{cat.value}】共 {len(items)} 条\n")
            out.write("~" * 50 + "\n")
            for i, r in enumerate(items, 1):
                out.write(f"{i}. {format_match_result(r)}\n\n")
            out.write("\n")

    out.write("=" * 70 + "\n")
    out.write("报告结束\n")
    out.write("=" * 70 + "\n")


def write_csv_normal(
    results: list[MatchResult], filepath: str
) -> None:
    normal, _ = _categorize_results(results)
    if not normal:
        return
    with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow([
            "单号", "姓名", "身份证号", "单位编号",
            "补缴月份", "补缴金额", "申报日期",
            "参保人匹配", "到账状态", "到账日期", "汇款金额",
        ])
        for r in normal:
            dan = r.bujiao_dan
            writer.writerow([
                dan.dan_hao, dan.name, dan.id_number, dan.unit_code,
                dan.bujiao_month, dan.amount, dan.declare_date,
                r.matched_person.name if r.matched_person else "未匹配",
                r.arrival_status.value,
                _fmt_date(r.matched_remittance.arrival_date) if r.matched_remittance else "",
                r.matched_remittance.amount if r.matched_remittance else "",
            ])


def write_csv_problems(
    results: list[MatchResult], filepath: str
) -> None:
    _, problematic = _categorize_results(results)
    if not problematic:
        return
    with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow([
            "单号", "姓名", "身份证号", "单位编号",
            "补缴月份", "补缴金额", "申报日期",
            "问题类型", "人员匹配说明", "月份校验说明", "到账状态说明",
            "来源文件", "来源行号",
        ])
        for r in problematic:
            dan = r.bujiao_dan
            writer.writerow([
                dan.dan_hao, dan.name, dan.id_number, dan.unit_code,
                dan.bujiao_month, dan.amount, dan.declare_date,
                "、".join(p.value for p in r.problems),
                r.person_match_reason,
                r.month_validation_reason,
                r.arrival_status_reason,
                dan.source_file,
                dan.source_line,
            ])


def write_csv_bad(
    bad_records: list[BadRecord], filepath: str
) -> None:
    if not bad_records:
        return
    with open(filepath, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["错误类型", "详情", "来源文件", "来源行号", "原始内容"])
        for r in bad_records:
            writer.writerow([
                r.category.value, r.detail, r.source_file, r.source_line, r.raw_line,
            ])
