"""完整演示流程：从材料包导入 → 争议检测 → 人工复核 → 导出评估说明"""
import sys
import json
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))

from src.main import TextClassificationDispute
from src.models import DisputeStatus


def main():
    print("=" * 60)
    print("文本分类争议审核工具 - 完整演示流程")
    print("=" * 60)
    print()

    with open("test_materials/label_mapping.json", "r", encoding="utf-8") as f:
        label_mapping = json.load(f)

    tool = TextClassificationDispute(label_mapping)

    print("[步骤1] 加载材料包...")
    tool.load_materials("test_materials")
    print()

    print("[步骤2] 检测争议...")
    tool.detect_disputes()
    print()

    print("[步骤3] 人工复核争议...")
    print()

    disputes = tool.list_disputes()

    for d in disputes:
        if d["type"] == "label_missing":
            print(f"  -> 处理标签漏映射: {d['title']}")
            label = d["title"].replace("标签漏映射: ", "").strip()
            if label == "军事":
                correct = "technology"
                tool.label_mapping[label] = correct
            elif label == "游戏":
                correct = "entertainment"
                tool.label_mapping[label] = correct
            elif label == "旅游":
                correct = "other"
                tool.label_mapping[label] = correct

            tool.review_dispute(
                dispute_id=d["dispute_id"],
                reviewer="算法工程师A",
                conclusion=f"新增标签映射: {label} -> {correct}",
                is_resolved=True,
                correct_label=correct
            )

        elif d["type"] == "metric_change" and "v1.1" in d["title"]:
            print(f"  -> 处理指标口径变更: {d['title']}")
            metric_key = d["title"].split()[-1]
            tool.review_dispute(
                dispute_id=d["dispute_id"],
                reviewer="算法工程师A",
                conclusion=f"确认v1.1版本{metric_key}指标口径变更，已重新计算",
                is_resolved=True,
                metric_before={"precision": 0.85, "recall": 0.82, "f1": 0.83, "accuracy": 0.84},
                metric_after={"precision": 0.92, "recall": 0.90, "f1": 0.91, "accuracy": 0.91},
                reason_description="2026-05-22起评估口径调整，排除了置信度<0.5的样本"
            )

        elif d["type"] == "label_mismatch":
            print(f"  -> 处理标签不一致: {d['title']}")
            trace = tool.get_trace(d["dispute_id"])
            labels = set()
            for rec in trace["related_records"]:
                if rec.get("annotation"):
                    labels.add(rec["annotation"]["label"])

            correct_label = "体育" if "世界杯" in d["title"] else "财经"
            tool.review_dispute(
                dispute_id=d["dispute_id"],
                reviewer="算法工程师A",
                conclusion=f"确认正确标签为: {correct_label}, 已排除错误标注",
                is_resolved=True,
                reason_description=f"经核对原始材料，正确标签为{correct_label}。错误标注已标记作废。"
            )

        elif d["type"] == "duplicate_conflict":
            print(f"  -> 处理重复项冲突: {d['title']}")
            tool.review_dispute(
                dispute_id=d["dispute_id"],
                reviewer="算法工程师A",
                conclusion="重复记录已合并，保留置信度高的版本",
                is_resolved=True,
                reason_description="去重策略：保留最新标注时间、置信度最高的记录，其余标记为重复"
            )

        elif d["type"] == "late_attachment_issue":
            print(f"  -> 处理晚到附件: {d['title']}")
            tool.review_dispute(
                dispute_id=d["dispute_id"],
                reviewer="算法工程师A",
                conclusion="晚到附件已纳入评估，不影响原有结论",
                is_resolved=True,
                reason_description="晚到附件内容与已有标注一致，无需调整评估结果"
            )

        print()

    print("[步骤4] 导出评估说明...")
    files = tool.export_all(
        output_dir="./output_demo",
        model_name="文本分类模型v1.0",
        reviewer="算法工程师A"
    )
    print()

    print("[步骤5] 复核结果统计...")
    resolved = len([d for d in tool.disputes if d.status == DisputeStatus.RESOLVED])
    print(f"  争议总数: {len(tool.disputes)}")
    print(f"  已解决: {resolved}")
    print(f"  待处理: {len(tool.disputes) - resolved}")
    print()

    print("=" * 60)
    print("演示完成！下一班同事可以直接查看以下文件：")
    print(f"  1. 评审说明 (TXT): {files['review_notes']}")
    print(f"  2. 争议汇总 (CSV): {files['summary_csv']}")
    print(f"  3. 完整数据 (JSON): {files['full_json']}")
    print("=" * 60)
    print()
    print("文件说明：")
    print("  - 评审说明.txt：纯文本，逐条列出争议、复核原因、结论、关联记录的完整证据链")
    print("  - 争议汇总.csv：表格概览，快速了解整体情况")
    print("  - 完整数据.json：结构化数据，可用于程序进一步处理")
    print()
    print("追溯功能：")
    print("  每条结论都关联了：")
    print("  - 原始标注样本ID、来源文件、行号、标注人、标注时间")
    print("  - 评估记录ID、来源文件、行号、评估人、评估时间、模型版本")
    print("  - 完整的复核原因和指标变更前后对比")
    print("  接手的同事无需再翻聊天记录，所有依据都在文件中！")


if __name__ == "__main__":
    main()
