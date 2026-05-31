"""文本分类争议审核工具 - 主入口"""
import os
import sys
import json
import argparse
from typing import Dict, List, Optional
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from src.models import DisputeStatus, DisputeType
from src.data_loader import DataLoader
from src.dispute_detector import DisputeDetector
from src.trace_manager import TraceManager
from src.exporter import EvaluationExporter


class TextClassificationDispute:
    """文本分类争议审核主类"""

    def __init__(self, label_mapping: Optional[Dict[str, str]] = None):
        self.label_mapping = label_mapping or {}
        self.data_loader = DataLoader(self.label_mapping)
        self.detector = DisputeDetector(self.label_mapping)
        self.trace_manager = TraceManager()
        self.exporter = EvaluationExporter(self.trace_manager)
        self.records = []
        self.disputes = []

    def load_materials(self, package_path: str) -> int:
        """加载材料包"""
        print(f"[加载] 正在读取材料包: {package_path}")
        self.records = self.data_loader.load_material_package(package_path)
        print(f"[加载] 共加载 {len(self.records)} 条记录")

        type_counts = {}
        for r in self.records:
            t = r.record_type.value
            type_counts[t] = type_counts.get(t, 0) + 1

        for t, cnt in type_counts.items():
            print(f"       - {t}: {cnt} 条")

        duplicates = self.data_loader.detect_duplicates()
        if duplicates:
            print(f"[提示] 检测到 {len(duplicates)} 组重复记录")

        return len(self.records)

    def detect_disputes(self) -> int:
        """检测争议"""
        print(f"[检测] 正在分析争议...")
        self.disputes = self.detector.detect_all(self.records)
        self.trace_manager.index_disputes(self.disputes)
        print(f"[检测] 共发现 {len(self.disputes)} 项争议")

        type_counts = {}
        for d in self.disputes:
            t = d.dispute_type.value
            type_counts[t] = type_counts.get(t, 0) + 1

        for t, cnt in type_counts.items():
            print(f"       - {t}: {cnt} 项")

        return len(self.disputes)

    def review_dispute(
        self,
        dispute_id: str,
        reviewer: str,
        conclusion: str,
        is_resolved: bool = True,
        metric_before: Optional[Dict] = None,
        metric_after: Optional[Dict] = None,
        reason_description: str = "",
        correct_label: str = ""
    ) -> bool:
        """复核单条争议"""
        dispute = next((d for d in self.disputes if d.dispute_id == dispute_id), None)
        if not dispute:
            print(f"[错误] 未找到争议: {dispute_id}")
            return False

        if dispute.dispute_type == DisputeType.METRIC_CHANGE:
            if metric_before and metric_after:
                self.trace_manager.generate_metric_change_reason(
                    dispute, reviewer, is_resolved, reason_description,
                    metric_before, metric_after
                )

        elif dispute.dispute_type == DisputeType.LABEL_MISSING:
            if correct_label:
                self.trace_manager.generate_label_missing_reason(
                    dispute, reviewer, correct_label, add_to_mapping=True
                )
                if correct_label not in self.label_mapping.values():
                    original_label = dispute.metadata.get("detected_label", "")
                    self.label_mapping[original_label] = correct_label

        elif reason_description:
            self.trace_manager.add_review_reason(
                dispute, reviewer, "manual_review", reason_description,
                metric_before, metric_after
            )

        status = DisputeStatus.RESOLVED if is_resolved else DisputeStatus.REJECTED
        self.trace_manager.resolve_dispute(dispute, reviewer, conclusion, status)

        print(f"[复核] 争议 {dispute_id} 已处理: {status.value}")
        return True

    def review_all_auto(self, reviewer: str) -> Dict:
        """自动复核所有争议（生成模板，需要人工确认）"""
        results = {"resolved": 0, "need_manual": 0}

        for dispute in self.disputes:
            if dispute.dispute_type == DisputeType.LABEL_MISSING:
                similar = dispute.metadata.get("similar_labels", [])
                if similar:
                    correct_label = similar[0]
                    self.trace_manager.generate_label_missing_reason(
                        dispute, reviewer, correct_label, add_to_mapping=True
                    )
                    self.trace_manager.resolve_dispute(
                        dispute, reviewer,
                        f"自动映射: {dispute.metadata.get('detected_label')} -> {correct_label}",
                        DisputeStatus.RESOLVED
                    )
                    results["resolved"] += 1
                else:
                    results["need_manual"] += 1

            elif dispute.dispute_type == DisputeType.CORRECTION_CONFLICT:
                self.trace_manager.add_review_reason(
                    dispute, reviewer, "auto_suggest",
                    "人工更正已标记，建议以更正后标签为准，需人工确认"
                )
                results["need_manual"] += 1

            elif dispute.dispute_type == DisputeType.LATE_ATTACHMENT_ISSUE:
                self.trace_manager.add_review_reason(
                    dispute, reviewer, "auto_suggest",
                    "晚到附件已标记，建议评估是否影响原有结论，需人工确认"
                )
                results["need_manual"] += 1

            else:
                results["need_manual"] += 1

        print(f"[自动复核] 已自动处理 {results['resolved']} 项, 待人工确认 {results['need_manual']} 项")
        return results

    def get_trace(self, dispute_id: str) -> Dict:
        """获取争议的完整追溯信息"""
        dispute = next((d for d in self.disputes if d.dispute_id == dispute_id), None)
        if not dispute:
            return {}

        return self.trace_manager.trace_conclusion_to_source(dispute, self.records)

    def export_all(
        self,
        output_dir: str,
        model_name: str = "",
        reviewer: str = ""
    ) -> Dict[str, str]:
        """导出所有评估文件"""
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        files = {}

        files["review_notes"] = self.exporter.export_review_notes(
            self.disputes, self.records,
            output_dir / f"评审说明_{timestamp}.txt",
            model_name, reviewer
        )

        files["summary_csv"] = self.exporter.export_summary_table(
            self.disputes,
            output_dir / f"争议汇总_{timestamp}.csv"
        )

        files["full_json"] = self.exporter.export_json(
            self.disputes, self.records,
            output_dir / f"完整数据_{timestamp}.json"
        )

        print(f"[导出] 已生成以下文件:")
        for name, path in files.items():
            print(f"       - {name}: {path}")

        return files

    def list_disputes(self, status_filter: Optional[str] = None) -> List[Dict]:
        """列出争议列表"""
        result = []
        for d in self.disputes:
            if status_filter and d.status.value != status_filter:
                continue
            result.append({
                "dispute_id": d.dispute_id,
                "type": d.dispute_type.value,
                "status": d.status.value,
                "title": d.title,
                "has_review": len(d.review_reasons) > 0,
                "has_conclusion": bool(d.conclusion)
            })
        return result


def main():
    parser = argparse.ArgumentParser(description="文本分类争议审核工具")
    parser.add_argument("package", help="材料包目录路径")
    parser.add_argument("--output", "-o", default="./output", help="输出目录")
    parser.add_argument("--model", default="", help="模型名称")
    parser.add_argument("--reviewer", default="auto", help="复核人")
    parser.add_argument("--label-mapping", default=None, help="标签映射JSON文件")
    parser.add_argument("--auto-review", action="store_true", help="执行自动复核")

    args = parser.parse_args()

    label_mapping = {}
    if args.label_mapping and Path(args.label_mapping).exists():
        with open(args.label_mapping, "r", encoding="utf-8") as f:
            label_mapping = json.load(f)

    tool = TextClassificationDispute(label_mapping)

    tool.load_materials(args.package)
    tool.detect_disputes()

    if args.auto_review:
        tool.review_all_auto(args.reviewer)

    tool.export_all(args.output, args.model, args.reviewer)

    open_count = len([d for d in tool.disputes if d.status == DisputeStatus.OPEN])
    if open_count > 0:
        print(f"\n[提醒] 仍有 {open_count} 项争议待人工处理")
        for d in tool.disputes:
            if d.status == DisputeStatus.OPEN:
                print(f"       - {d.dispute_id}: {d.title}")


if __name__ == "__main__":
    main()
