"""命令行接口 - 终端摘要只显示总数/成功/挂起/失败/路径/提醒"""

import argparse
import sys
import os
from typing import Tuple, List

from .models import (
    CaseRecord,
    CaseStatus,
    ProcessingSummary,
    AnomalyRecord,
    EvidenceStatus,
)
from .parser import CaseParser
from .duplicate_handler import DuplicateHandler
from .engine import PropagationEngine
from .reporter import Reporter
from .formulas import list_formulas, list_aliases


def build_summary(
    cases: List[CaseRecord],
    anomalies: List[AnomalyRecord],
    total_files: int,
) -> ProcessingSummary:
    """构建处理汇总"""
    summary = ProcessingSummary()
    summary.total_files = total_files
    summary.total_cases = len(cases)
    summary.total_anomalies = len(anomalies)

    duplicate_group_ids = set()
    confirmed = 0
    pending = 0
    missing = 0

    for case in cases:
        if case.status == CaseStatus.SUCCESS:
            summary.success_count += 1
        elif case.status == CaseStatus.SUSPENDED:
            summary.suspended_count += 1
        elif case.status == CaseStatus.FAILED:
            summary.failed_count += 1
        elif case.status == CaseStatus.MERGED:
            summary.merged_count += 1

        if case.is_boundary:
            summary.boundary_count += 1
        if case.duplicate_group_id:
            duplicate_group_ids.add(case.duplicate_group_id)

        if case.status != CaseStatus.MERGED:
            for var in case.variables:
                if var.evidence_status == EvidenceStatus.CONFIRMED:
                    confirmed += 1
                elif var.evidence_status == EvidenceStatus.PENDING:
                    pending += 1
                else:
                    missing += 1

    summary.duplicate_groups = len(duplicate_group_ids)
    summary.confirmed_evidence_count = confirmed
    summary.pending_evidence_count = pending
    summary.missing_evidence_count = missing

    key_findings = []

    success_cases = [c for c in cases if c.status == CaseStatus.SUCCESS and c.result]
    for case in success_cases:
        r = case.result
        key_findings.append(
            f"题目 {case.case_id} 计算完成: 结果 = {r.result_value:.4f} ± {r.result_uncertainty:.4f} {r.result_unit}"
        )

    suspended_cases = [c for c in cases if c.status == CaseStatus.SUSPENDED]
    if suspended_cases:
        suspended_ids = [c.case_id for c in suspended_cases]
        unique_suspended = list(set(suspended_ids))
        key_findings.append(
            f"⚠️ {len(unique_suspended)} 组重复样本因数值不一致已挂起: {', '.join(unique_suspended)}"
        )

    failed_cases = [c for c in cases if c.status == CaseStatus.FAILED]
    if failed_cases:
        key_findings.append(
            f"❌ {len(failed_cases)} 道题目解析失败，请检查输入文件格式"
        )

    merged_cases = [c for c in cases if c.status == CaseStatus.MERGED]
    if merged_cases:
        merged_groups = set(c.duplicate_group_id for c in merged_cases if c.duplicate_group_id)
        key_findings.append(
            f"🔀 {len(merged_cases)} 条重复记录内容一致已合并到 {len(merged_groups)} 组主记录"
        )

    boundary_cases = [c for c in cases if c.is_boundary]
    if boundary_cases:
        boundary_ids = [c.case_id for c in boundary_cases]
        key_findings.append(
            f"⚠️ {len(boundary_cases)} 个题目包含边界样本（相对不确定度 > 50%）: {', '.join(set(boundary_ids))}"
        )

    if missing > 0:
        key_findings.append(
            f"❓ {missing} 条证据缺失，需要补充测量记录或校准证书"
        )

    if pending > 0:
        key_findings.append(
            f"⏳ {pending} 条证据待确认，请相关责任人核实"
        )

    summary.key_findings = key_findings
    return summary


def print_terminal_summary(
    summary: ProcessingSummary,
    input_dir: str,
    output_dir: str,
    file_paths: dict,
):
    """打印终端摘要 - 只显示总数/成功/挂起/失败/路径/提醒"""
    print()
    print("=" * 70)
    print("  误差传播图表解释 - 运行摘要")
    print("=" * 70)
    print(f"  输入目录: {input_dir}")
    print(f"  输出目录: {output_dir}")
    print()
    print("  📊 统计:")
    print(f"    总文件数:     {summary.total_files}")
    print(f"    解析题目:     {summary.total_cases}")
    print(f"    ✅ 成功:      {summary.success_count}")
    print(f"    ⏸️ 挂起:      {summary.suspended_count}")
    print(f"    ❌ 失败:      {summary.failed_count}")
    print(f"    🔀 合并重复:  {summary.merged_count} 条")
    print()
    print("  📁 输出文件:")
    for label, path in file_paths.items():
        short_path = os.path.relpath(path, os.getcwd()) if os.path.isabs(path) else path
        print(f"    {label}: {short_path}")
    print()
    print("  ⚠️ 关键提醒:")
    if summary.key_findings:
        for finding in summary.key_findings:
            print(f"    • {finding}")
    else:
        print("    • 所有题目处理完成，无异常")
    print()
    print("  💡 异常详情请查看「异常队列.txt」，不与本摘要混在一起。")
    print("=" * 70)
    print()


def run(input_dir: str, output_dir: str) -> int:
    """执行完整处理流程"""
    if not os.path.isdir(input_dir):
        print()
        print("=" * 70)
        print("  ❌ 输入目录不存在")
        print(f"  输入目录: {input_dir}")
        print("  请指定一个有效的输入目录。")
        print("=" * 70)
        return 1

    parser = CaseParser()
    cases, anomalies, total_files = parser.parse_directory(input_dir)

    if total_files == 0:
        print()
        print("=" * 70)
        print("  ❌ 输入目录中没有 JSON 文件")
        print(f"  输入目录: {input_dir}")
        print("  空集合不能作为正常输入。请在目录中放置题目文件。")
        print("=" * 70)
        return 1

    handler = DuplicateHandler()
    cases, anomalies = handler.process(cases, anomalies)

    engine = PropagationEngine()
    cases, anomalies = engine.process_cases(cases, anomalies)

    cases.sort(key=lambda c: (c.case_id, c.file_name))

    summary = build_summary(cases, anomalies, total_files)

    reporter = Reporter(output_dir)
    file_paths = reporter.generate_all(cases, anomalies, summary, total_files)

    file_path_labels = {
        "明细(JSON)": file_paths.get("details_json", ""),
        "明细(TXT)": file_paths.get("details_txt", ""),
        "汇总(JSON)": file_paths.get("summary_json", ""),
        "汇总(TXT)": file_paths.get("summary_txt", ""),
        "解释报告": file_paths.get("explanation", ""),
        "异常队列(JSON)": file_paths.get("anomalies_json", ""),
        "异常队列(TXT)": file_paths.get("anomalies_txt", ""),
    }

    print_terminal_summary(summary, input_dir, output_dir, file_path_labels)

    return 0


def main(argv=None) -> int:
    """CLI 主入口"""
    parser = argparse.ArgumentParser(
        prog="error_propagation_explainer",
        description="误差传播图表解释 - 分析测量误差如何传播到计算结果",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 运行完整分析
  python -m error_propagation_explainer --input examples/messy_cases --output out/demo

  # 列出可用公式
  python -m error_propagation_explainer --list-formulas
        """,
    )

    parser.add_argument(
        "--input", "-i",
        required=True,
        help="输入目录（包含 JSON 题目文件）",
    )
    parser.add_argument(
        "--output", "-o",
        required=True,
        help="输出目录（生成明细、汇总、解释报告、异常队列）",
    )
    parser.add_argument(
        "--list-formulas",
        action="store_true",
        help="列出所有可用公式和旧名别名",
    )

    args = parser.parse_args(argv)

    if args.list_formulas:
        print("📐 可用公式:")
        for name in list_formulas():
            print(f"  • {name}")
        print()
        print("🔄 旧名别名（会自动映射并警告）:")
        aliases = list_aliases()
        for old, new in aliases.items():
            print(f"  • {old} → {new}")
        return 0

    return run(args.input, args.output)
