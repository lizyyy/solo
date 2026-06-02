"""命令行接口：朴素实用，信息完整，冲突不隐藏"""
import argparse
import sys
import os
import json
from typing import Dict, Any

# 确保能找到src模块
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.version_manager import VersionManager
from src.conflict_detector import ConflictDetector
from src.traceability import Traceability
from src.exporter import Exporter


class CLI:
    def __init__(self):
        self.base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        self.version_manager = VersionManager(self.base_dir)
        self.conflict_detector = ConflictDetector(self.base_dir)
        self.traceability = Traceability(self.base_dir)
        self.exporter = Exporter(self.base_dir)

    def run(self):
        parser = argparse.ArgumentParser(
            description="大模型提示词版本仓库 - 风控算法运营工具",
            formatter_class=argparse.RawDescriptionHelpFormatter,
            epilog="""
示例用法:
  python -m src.cli list                           # 列出所有版本
  python -m src.cli show v1.2.0                    # 查看版本详情
  python -m src.cli check v1.2.0                   # 检测版本所有冲突
  python -m src.cli check v1.2.0 --type label      # 只看标签冲突
  python -m src.cli trace v1.2.0 CASE002           # 追溯CASE002的来源
  python -m src.cli reviews v1.2.0                 # 查看人工改判记录
  python -m src.cli diff v1.1.0 v1.2.0             # 对比两个版本
  python -m src.cli export v1.2.0                  # 导出版本完整信息
  python -m src.cli export-conflicts v1.2.0        # 导出冲突清单
  python -m src.cli export-reviews v1.2.0          # 导出人工改判记录
  python -m src.cli export-trace v1.2.0 CASE002    # 导出单案例追溯
            """
        )

        subparsers = parser.add_subparsers(dest="command", help="可用命令")

        p_list = subparsers.add_parser("list", help="列出所有版本")

        p_show = subparsers.add_parser("show", help="查看版本详情")
        p_show.add_argument("version", help="版本号，如v1.2.0")
        p_show.add_argument("--full", action="store_true", help="显示完整内容")

        p_check = subparsers.add_parser("check", help="检测版本冲突")
        p_check.add_argument("version", help="版本号")
        p_check.add_argument("--type",
                           choices=["all", "label", "sample_leak", "version", "empty", "duplicate", "boundary"],
                           default="all",
                           help="冲突类型，默认all")

        p_trace = subparsers.add_parser("trace", help="追溯案例来源")
        p_trace.add_argument("version", help="版本号")
        p_trace.add_argument("case_id", help="案例ID")

        p_reviews = subparsers.add_parser("reviews", help="查看人工改判记录")
        p_reviews.add_argument("version", help="版本号")

        p_diff = subparsers.add_parser("diff", help="对比两个版本")
        p_diff.add_argument("version1", help="旧版本号")
        p_diff.add_argument("version2", help="新版本号")

        p_export = subparsers.add_parser("export", help="导出版本信息")
        p_export.add_argument("version", help="版本号")
        p_export.add_argument("--format", choices=["json", "csv"], default="json", help="导出格式")

        p_export_conflicts = subparsers.add_parser("export-conflicts", help="导出冲突清单")
        p_export_conflicts.add_argument("version", help="版本号")
        p_export_conflicts.add_argument("--type", default="all", help="冲突类型")

        p_export_reviews = subparsers.add_parser("export-reviews", help="导出人工改判记录")
        p_export_reviews.add_argument("version", help="版本号")

        p_export_trace = subparsers.add_parser("export-trace", help="导出单案例追溯")
        p_export_trace.add_argument("version", help="版本号")
        p_export_trace.add_argument("case_id", help="案例ID")

        args = parser.parse_args()

        if not args.command:
            parser.print_help()
            return

        try:
            self._dispatch(args)
        except Exception as e:
            print(f"\n❌ 错误: {e}")
            sys.exit(1)

    def _dispatch(self, args):
        if args.command == "list":
            self._cmd_list()
        elif args.command == "show":
            self._cmd_show(args.version, args.full)
        elif args.command == "check":
            self._cmd_check(args.version, args.type)
        elif args.command == "trace":
            self._cmd_trace(args.version, args.case_id)
        elif args.command == "reviews":
            self._cmd_reviews(args.version)
        elif args.command == "diff":
            self._cmd_diff(args.version1, args.version2)
        elif args.command == "export":
            self._cmd_export(args.version, args.format)
        elif args.command == "export-conflicts":
            self._cmd_export_conflicts(args.version, args.type)
        elif args.command == "export-reviews":
            self._cmd_export_reviews(args.version)
        elif args.command == "export-trace":
            self._cmd_export_trace(args.version, args.case_id)

    def _print_header(self, title: str):
        print("\n" + "=" * 60)
        print(f"  {title}")
        print("=" * 60)

    def _print_section(self, title: str):
        print(f"\n--- {title} ---")

    def _print_warning(self, text: str):
        print(f"  ⚠️  {text}")

    def _print_error(self, text: str):
        print(f"  ❌ {text}")

    def _print_success(self, text: str):
        print(f"  ✅ {text}")

    def _cmd_list(self):
        self._print_header("版本列表")
        versions = self.version_manager.list_versions()

        if not versions:
            print("  暂无版本记录")
            return

        print(f"{'版本号':<10} {'发布日期':<12} {'发布人':<8} {'状态':<10} {'精确率':<8} {'改判数':<6}")
        print("-" * 70)
        for v in versions:
            metrics = v.get("metrics", {})
            precision = metrics.get("actual_precision", "-")
            print(f"{v['version_id']:<10} {v['release_date']:<12} {v['release_by']:<8} "
                  f"{v['status']:<10} {str(precision):<8} {v['manual_review_count']:<6}")

        print(f"\n共 {len(versions)} 个版本")

    def _cmd_show(self, version_id: str, full: bool):
        self._print_header(f"版本详情 - {version_id}")

        version = self.version_manager.get_version(version_id)
        if not version:
            print(f"  版本 {version_id} 不存在")
            return

        print(f"  版本号:    {version['version_id']}")
        print(f"  发布日期:  {version['release_date']}")
        print(f"  发布人:    {version['release_by']}")
        print(f"  状态:      {version['status']}")

        self._print_section("阈值配置")
        thresholds = version.get("thresholds", {})
        print(f"  高风险 ≥ {thresholds.get('high_risk_min', '-')}")
        print(f"  中风险 ≥ {thresholds.get('medium_risk_min', '-')} 且 < {thresholds.get('high_risk_min', '-')}")
        print(f"  低风险 < {thresholds.get('low_risk_max', '-')}")

        self._print_section("版本指标")
        metrics = version.get("metrics", {})
        print(f"  发布记录宣称 - 精确率: {metrics.get('claimed_precision', '-')}, 召回率: {metrics.get('claimed_recall', '-')}")
        print(f"  实际评测数据 - 精确率: {metrics.get('actual_precision', '-')}, 召回率: {metrics.get('actual_recall', '-')}, F1: {metrics.get('actual_f1', '-')}")

        if metrics.get("claimed_precision") != metrics.get("actual_precision"):
            self._print_warning("指标不一致！发布记录宣称与实际评测数据有差异，请使用 check 命令查看详情")

        self._print_section("关联来源")
        sources = version.get("sources", [])
        for s in sources:
            print(f"  [{s['type']}] {s['file']} - {s['description']}")

        self._print_section("人工改判记录")
        reviews = version.get("manual_reviews", [])
        if not reviews:
            print("  暂无人工改判记录")
        else:
            print(f"  共 {len(reviews)} 条人工改判记录")
            for r in reviews:
                print(f"    {r['case_id']}: {r['original_label']} -> {r['reviewed_label']} "
                      f"(改判人: {r['reviewer']}, 日期: {r['review_date']})")
                print(f"      理由: {r['review_reason']}")

        self._print_section("数据质量标记")
        dq = version.get("data_quality", {})
        if dq.get("empty_values"):
            self._print_warning(f"空值: {dq['empty_values']}")
        if dq.get("duplicate_records"):
            self._print_warning(f"重复项: {dq['duplicate_records']}")
        if dq.get("boundary_cases"):
            self._print_warning(f"边界记录: {dq['boundary_cases']}")
        if dq.get("note"):
            print(f"  备注: {dq['note']}")

        if full:
            self._print_section("提示词内容")
            print(version.get("prompt_content", ""))

            self._print_section("发布说明")
            print(version.get("release_notes", ""))

        # 检测冲突数量，提示用户
        conflicts = self.conflict_detector.detect_all(version_id)
        if "error" not in conflicts:
            summary = conflicts.get("summary", {})
            total = summary.get("total_conflicts", 0)
            if total > 0:
                print(f"\n⚠️  检测到 {total} 个问题，建议使用 'check {version_id}' 查看详情")

    def _cmd_check(self, version_id: str, conflict_type: str):
        self._print_header(f"冲突检测 - {version_id}")

        type_map = {
            "all": "全部类型",
            "label": "标签冲突",
            "sample_leak": "样本泄漏",
            "version": "版本冲突",
            "empty": "空值",
            "duplicate": "重复项",
            "boundary": "边界记录"
        }

        print(f"  检测类型: {type_map.get(conflict_type, conflict_type)}")

        if conflict_type == "all":
            result = self.conflict_detector.detect_all(version_id)
            if "error" in result:
                print(f"  错误: {result['error']}")
                return

            summary = result["summary"]
            self._print_section("冲突摘要")
            print(f"  问题总数: {summary['total_conflicts']}")
            print(f"  需要人工决策: {summary['decision_required_count']}")
            print(f"  严重程度: ", end="")
            for sev, count in summary["severity_breakdown"].items():
                if count > 0:
                    print(f"{sev}:{count} ", end="")
            print()

            breakdown = summary["breakdown"]
            for k, v in breakdown.items():
                if v > 0:
                    print(f"    {k}: {v}个")

            if summary["total_conflicts"] == 0:
                self._print_success("未检测到任何冲突问题")
                return

            conflicts = result["conflicts"]

        else:
            detect_map = {
                "label": self.conflict_detector.detect_label_conflicts,
                "sample_leak": self.conflict_detector.detect_sample_leaks,
                "version": self.conflict_detector.detect_version_conflicts,
                "empty": self.conflict_detector.detect_empty_values,
                "duplicate": self.conflict_detector.detect_duplicate_records,
                "boundary": self.conflict_detector.detect_boundary_cases
            }
            conflicts = {conflict_type: detect_map[conflict_type](version_id)}

        for ctype, items in conflicts.items():
            if not items:
                continue

            self._print_section(f"{type_map.get(ctype, ctype)} ({len(items)}个)")

            for idx, item in enumerate(items, 1):
                severity = item.get("severity", "medium")
                severity_icon = {"critical": "🔴", "high": "🟠", "medium": "🟡", "low": "🟢"}.get(severity, "⚪")

                print(f"\n  {severity_icon} [{idx}] {item.get('conflict_type', ctype)}")
                print(f"      案例ID: {item.get('case_id', item.get('conflict_id', '-'))}")

                if "case_text" in item:
                    print(f"      案例文本: {item['case_text']}")

                if ctype == "label_conflicts":
                    print(f"      预测标签: {item['pred_label']} (分数: {item['pred_score']})")
                    print(f"      标注标签: {item['true_label']} (标注人: {item['annotator']})")
                    print(f"      预测来源: {item['pred_source']}")
                    print(f"      标注来源: {item['annotation_source']}")

                elif ctype == "version_conflicts":
                    print(f"      冲突类型: {item['conflict_type']}")
                    self._print_warning("以下为两边证据对比，系统不自动判定，请人工核实：")
                    print(f"\n      [发布记录宣称] 来源: {item['release_claim']['source']}")
                    if "claimed_precision" in item["release_claim"]:
                        print(f"        精确率: {item['release_claim']['claimed_precision']}")
                        print(f"        召回率: {item['release_claim']['claimed_recall']}")
                    if "claimed_label" in item["release_claim"]:
                        print(f"        CASE{item.get('case_id', '?')} 判定为: {item['release_claim']['claimed_label']}")

                    print(f"\n      [实际数据] 来源: {item['actual_data'].get('source', item['actual_data'].get('review_source', '-'))}")
                    if "actual_precision" in item["actual_data"]:
                        print(f"        精确率: {item['actual_data']['actual_precision']}")
                        print(f"        召回率: {item['actual_data']['actual_recall']}")
                        print(f"        F1分数: {item['actual_data']['actual_f1']}")
                        print(f"        差异: 精确率{item['difference']['precision_delta']:+.2f}, 召回率{item['difference']['recall_delta']:+.2f}")
                    if "actual_manual_review_label" in item["actual_data"]:
                        print(f"        版本文件改判记录: {item['actual_data']['actual_pred_label']} -> {item['actual_data']['actual_manual_review_label']}")
                        print(f"        标注表记录: {item['actual_data']['actual_annotation_label']}")
                        print(f"        改判理由: {item['actual_data']['review_reason']}")

                    if "evidence_comparison" in item:
                        print(f"\n      [证据对比]")
                        for k, v in item["evidence_comparison"].items():
                            print(f"        {k}: {v}")

                    if item.get("decision_required"):
                        self._print_error(item.get("note", "需要人工决策"))

                elif ctype == "sample_leaks":
                    print(f"      描述: {item['description']}")
                    print(f"      涉及数据集: {', '.join(item['evidence']['data_sets_involved'])}")
                    print(f"      来源: {item['source']}")

                elif ctype == "empty_values":
                    print(f"      空字段: {', '.join(item['empty_fields'])}")
                    print(f"      行号: {item['annotation_line']}")
                    print(f"      来源: {item['source']}")

                elif ctype == "duplicate_records":
                    print(f"      重复次数: {item['duplicate_count']}")
                    print(f"      涉及行号: {', '.join(map(str, item['lines']))}")
                    print(f"      来源: {item['source']}")
                    for ann in item["annotations"]:
                        print(f"        第{ann['line']}行: {ann['true_label']} ({ann['annotator']}, {ann['annotation_date']}) - {ann['conflict_note']}")

                elif ctype == "boundary_cases":
                    print(f"      预测分数: {item['pred_score']}")
                    print(f"      边界类型: {item['boundary_type']}")
                    if item.get("boundary_threshold"):
                        print(f"      边界阈值: {item['boundary_threshold']}")
                    print(f"      来源: {item['source']}")

                print(f"\n      建议动作:")
                for action in item.get("suggested_actions", []):
                    print(f"        → {action}")

        self._print_section("下一步建议")
        print(f"  1. 使用 'python -m src.cli export-conflicts {version_id}' 导出完整冲突清单")
        print(f"  2. 使用 'python -m src.cli trace {version_id} <case_id>' 追溯具体案例")
        print(f"  3. 使用 'python -m src.cli export {version_id}' 导出完整版本信息（含所有证据）")

    def _cmd_trace(self, version_id: str, case_id: str):
        self._print_header(f"案例追溯 - {version_id} / {case_id}")

        result = self.traceability.trace_case(version_id, case_id)
        if "error" in result:
            print(f"  错误: {result['error']}")
            return

        self._print_section("证据链")
        for idx, evidence in enumerate(result["evidence_chain"], 1):
            print(f"\n  [{idx}] {evidence['source_type']}")
            print(f"      文件: {evidence['file']}")
            if "line" in evidence:
                print(f"      行号: {evidence['line']}")
            print(f"      追溯路径: {evidence['trace_path']}")
            print(f"      内容: {json.dumps(evidence['content'], ensure_ascii=False, indent=8)}")

        self._print_section("人工改判历史")
        if not result["review_history"]:
            print("  暂无改判记录")
        else:
            for idx, review in enumerate(result["review_history"], 1):
                print(f"\n  [{idx}] 版本: {review['version']}")
                print(f"      改判人: {review['reviewer']} ({review['review_date']})")
                print(f"      {review['original_label']} -> {review['reviewed_label']}")
                print(f"      理由: {review['reason']}")
                if review.get("source_evidence"):
                    print(f"      证据来源: {review['source_evidence']}")

        self._print_section("阈值上下文")
        tc = result["threshold_context"]
        if tc:
            print(f"  高风险 ≥ {tc['thresholds'].get('high_risk_min')}")
            print(f"  中风险 ≥ {tc['thresholds'].get('medium_risk_min')}")
            if tc.get("case_score") is not None:
                print(f"  本案例分数: {tc['case_score']}")
                score = tc["case_score"]
                high = tc["thresholds"].get("high_risk_min", 1)
                medium = tc["thresholds"].get("medium_risk_min", 0)
                if score >= high:
                    self._print_warning("分数落在高风险区间")
                elif score >= medium:
                    self._print_warning("分数落在中风险区间（人工审核）")
                else:
                    self._print_success("分数落在低风险区间")

    def _cmd_reviews(self, version_id: str):
        self._print_header(f"人工改判记录 - {version_id}")

        reviews = self.version_manager.get_manual_reviews(version_id)
        if not reviews:
            print("  暂无人工改判记录")
            return

        version = self.version_manager.get_version(version_id)
        thresholds = version.get("thresholds", {})

        print(f"  阈值配置: 高≥{thresholds.get('high_risk_min')}, 中≥{thresholds.get('medium_risk_min')}")
        print(f"  共 {len(reviews)} 条改判记录\n")

        for idx, r in enumerate(reviews, 1):
            print(f"  [{idx}] {r['case_id']}")
            print(f"      原判定: {r['original_label']} (分数: {r['pred_score']})")
            print(f"      改判为: {r['reviewed_label']}")
            print(f"      改判人: {r['reviewer']} ({r['review_date']})")
            print(f"      理由: {r['review_reason']}")
            print(f"      证据: {r['source_evidence']}\n")

    def _cmd_diff(self, v1: str, v2: str):
        self._print_header(f"版本对比 - {v1} → {v2}")

        diff = self.version_manager.compare_versions(v1, v2)
        if "error" in diff:
            print(f"  错误: {diff['error']}")
            return

        self._print_section("阈值变更")
        td = diff["threshold_diff"]
        if not td:
            print("  无变化")
        else:
            for k, v in td.items():
                print(f"    {k}: {v['old']} → {v['new']} (Δ{v['new']-v['old']:+.2f})")

        self._print_section("指标变更")
        md = diff["metrics_diff"]
        if not md:
            print("  无变化")
        else:
            for k, v in md.items():
                arrow = "↑" if v["delta"] > 0 else "↓" if v["delta"] < 0 else "="
                print(f"    {k}: {v['old']} → {v['new']} {arrow}{abs(v['delta']):.2f}")

        self._print_section("人工改判变更")
        rd = diff["manual_review_diff"]
        print(f"    数量变化: {rd['count_change']:+d}")
        if rd["only_in_v1"]:
            print(f"    仅在{v1}: {', '.join(rd['only_in_v1'])}")
        if rd["only_in_v2"]:
            print(f"    仅在{v2}: {', '.join(rd['only_in_v2'])}")

        self._print_section("提示词变更")
        pd = diff["prompt_diff"]
        if not pd["changed"]:
            print("  无变化")
        else:
            if pd["only_in_v1"]:
                print(f"    仅在{v1}的行:")
                for line in pd["only_in_v1"][:5]:
                    print(f"      - {line[:60]}...")
            if pd["only_in_v2"]:
                print(f"    仅在{v2}的行:")
                for line in pd["only_in_v2"][:5]:
                    print(f"      + {line[:60]}...")

    def _cmd_export(self, version_id: str, fmt: str):
        self._print_header(f"导出版本 - {version_id}")

        filepath = self.exporter.export_version(version_id, fmt)
        self._print_success(f"导出成功: {filepath}")

        # 显示导出原因（核心要求：导出时也要带着原因）
        with open(filepath, "r", encoding="utf-8") as f:
            if fmt == "json":
                data = json.load(f)
                reason = data.get("export_metadata", {}).get("export_reason", "")
            else:
                # CSV的导出原因在第一部分
                import csv
                reader = csv.reader(f)
                rows = list(reader)
                reason = rows[3][1] if len(rows) > 3 and len(rows[3]) > 1 else ""

        print(f"\n  导出原因: {reason}")
        print(f"  文件大小: {os.path.getsize(filepath)} 字节")

    def _cmd_export_conflicts(self, version_id: str, ctype: str):
        self._print_header(f"导出冲突清单 - {version_id}")

        filepath = self.exporter.export_conflicts(version_id, ctype)
        self._print_success(f"导出成功: {filepath}")

        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            reason = data.get("export_reason", "")
            decision_count = len(data.get("decision_required_items", []))

        print(f"\n  导出原因: {reason}")
        if decision_count > 0:
            self._print_warning(f"包含 {decision_count} 项需要人工决策的问题")
        print(f"  文件大小: {os.path.getsize(filepath)} 字节")

    def _cmd_export_reviews(self, version_id: str):
        self._print_header(f"导出人工改判 - {version_id}")

        filepath = self.exporter.export_manual_reviews(version_id)
        self._print_success(f"导出成功: {filepath}")

        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            reason = data.get("export_reason", "")
            count = data.get("export_metadata", {}).get("total_reviews", 0)

        print(f"\n  导出原因: {reason}")
        print(f"  改判记录数: {count}")
        print(f"  文件大小: {os.path.getsize(filepath)} 字节")

    def _cmd_export_trace(self, version_id: str, case_id: str):
        self._print_header(f"导出案例追溯 - {version_id}/{case_id}")

        filepath = self.exporter.export_trace(version_id, case_id)
        self._print_success(f"导出成功: {filepath}")

        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
            reason = data.get("export_reason", "")

        print(f"\n  导出原因: {reason}")
        print(f"  文件大小: {os.path.getsize(filepath)} 字节")


def main():
    cli = CLI()
    cli.run()


if __name__ == "__main__":
    main()
