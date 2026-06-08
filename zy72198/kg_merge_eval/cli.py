import argparse
import json
import sys
from pathlib import Path
from datetime import datetime

from .loader import DataLoader
from .conflict import ConflictDetector, SampleStratifier
from .metrics import MetricCalculator
from .comparison import RunComparator
from .reporter import ReportGenerator


def run_evaluation(args):
    print("📊 开始知识图谱实体合并评测...")

    loader = DataLoader(args.data_dir)

    print(f"  加载数据...")
    records = loader.load_all(
        samples_file=args.samples,
        model_file=args.model_outputs,
        corrections_file=args.corrections,
        feedback_file=args.feedback,
    )

    if not records:
        print("❌ 没有加载到任何样本数据！")
        return 1

    print(f"  已加载 {len(records)} 条记录")

    print(f"  检测冲突与异常...")
    detector = ConflictDetector()
    records = detector.detect_all(records)
    conflict_summary = detector.get_conflict_summary()
    print(f"  发现 {conflict_summary['total_conflicts']} 个冲突")

    print(f"  样本分层...")
    stratifier = SampleStratifier()
    strata = stratifier.stratify(records)
    strata_summary = stratifier.get_strata_summary()

    print(f"  计算指标...")
    calculator = MetricCalculator()
    metrics = calculator.calculate(records, strata)
    print(f"  整体准确率: {metrics['overall']['accuracy']:.2%}")

    comparison_data = None
    if args.compare_with:
        print(f"  与上次运行对比...")
        old_data_path = Path(args.compare_with)
        if old_data_path.exists():
            with open(old_data_path, "r", encoding="utf-8") as f:
                old_data = json.load(f)

            comparator = RunComparator()
            old_records = _reconstruct_records_from_json(old_data.get("records", {}))
            record_comp = comparator.compare_records(old_records, records)
            metric_comp = comparator.compare_metrics(
                old_data.get("metrics", {}), metrics
            )

            comparison_data = {
                "record_comparison": record_comp,
                "metric_changes": metric_comp.get("metric_changes", {}),
                "interpretation": metric_comp.get("interpretation", []),
            }
            print(f"  发现 {record_comp['total_changes']} 条变化记录")

    print(f"  生成报告...")
    reporter = ReportGenerator(args.output_dir)
    files = reporter.generate_full_report(
        records,
        metrics,
        conflict_summary,
        strata_summary,
        run_name=args.run_name,
        comparison_data=comparison_data,
    )

    print("\n✅ 评测完成！")
    print("\n📁 生成的文件:")
    for name, path in files.items():
        print(f"  - {name}: {path}")

    worst_cases = calculator.get_worst_cases(records, top_n=5)
    if worst_cases:
        print(f"\n⚠️  Top 5 置信度最高的错误预测:")
        for case in worst_cases:
            print(
                f"  - {case['sample_id']}: GT={case['ground_truth']}, "
                f"Pred={case['predicted']}, conf={case['confidence']:.2f}"
            )

    human_analysis = calculator.get_human_correction_analysis(records)
    if human_analysis["total_corrected"] > 0:
        print(
            f"\n👤 人工修正分析: {human_analysis['total_corrected']} 条有修正, "
            f"{human_analysis['model_overruled_count']} 条推翻了模型决策 "
            f"({human_analysis['overrule_rate']:.1%})"
        )

    return 0


def _reconstruct_records_from_json(records_json: dict):
    from .models import (
        MergedRecord,
        Sample,
        Entity,
        EntityType,
        MergeDecision,
        ModelOutput,
        HumanCorrection,
        FeedbackRecord,
        SourceInfo,
        ConflictAlert,
        ConflictType,
    )

    records = {}
    for sample_id, data in records_json.items():
        sample_data = data["sample"]
        entity_a_data = sample_data["entity_a"]
        entity_b_data = sample_data["entity_b"]

        entity_a = Entity(
            entity_id=entity_a_data["entity_id"],
            entity_type=EntityType(entity_a_data["entity_type"]),
            entity_value=entity_a_data["entity_value"],
            attributes=entity_a_data.get("attributes", {}),
        )

        entity_b = Entity(
            entity_id=entity_b_data["entity_id"],
            entity_type=EntityType(entity_b_data["entity_type"]),
            entity_value=entity_b_data["entity_value"],
            attributes=entity_b_data.get("attributes", {}),
        )

        sample = Sample(
            sample_id=sample_data["sample_id"],
            entity_a=entity_a,
            entity_b=entity_b,
            ground_truth=MergeDecision(sample_data["ground_truth"])
            if sample_data.get("ground_truth")
            else None,
            created_at=datetime.fromisoformat(sample_data["created_at"]),
            tags=sample_data.get("tags", []),
            is_boundary=sample_data.get("is_boundary", False),
        )

        model_output = None
        if data.get("model_output"):
            mo = data["model_output"]
            model_output = ModelOutput(
                sample_id=mo["sample_id"],
                decision=MergeDecision(mo["decision"]),
                confidence=mo["confidence"],
                model_version=mo.get("model_version", "unknown"),
                merge_reason=mo.get("merge_reason"),
                processed_at=datetime.fromisoformat(mo["processed_at"]),
            )

        human_correction = None
        if data.get("human_correction"):
            hc = data["human_correction"]
            human_correction = HumanCorrection(
                sample_id=hc["sample_id"],
                original_decision=MergeDecision(hc["original_decision"]),
                corrected_decision=MergeDecision(hc["corrected_decision"]),
                correction_reason=hc.get("correction_reason", ""),
                corrected_by=hc.get("corrected_by", "unknown"),
                corrected_at=datetime.fromisoformat(hc["corrected_at"]),
            )

        feedback = []
        for fb_data in data.get("feedback", []):
            feedback.append(
                FeedbackRecord(
                    sample_id=fb_data["sample_id"],
                    feedback_type=fb_data.get("feedback_type", ""),
                    feedback_content=fb_data.get("feedback_content", ""),
                    feedback_channel=fb_data.get("feedback_channel", ""),
                    feedback_at=datetime.fromisoformat(fb_data["feedback_at"]),
                    resolved=fb_data.get("resolved", False),
                )
            )

        conflicts = []
        for c_data in data.get("conflicts", []):
            conflicts.append(
                ConflictAlert(
                    conflict_type=ConflictType(c_data["conflict_type"]),
                    sample_id=c_data["sample_id"],
                    severity=c_data["severity"],
                    message=c_data["message"],
                    details=c_data.get("details", {}),
                )
            )

        final_decision = None
        if data.get("final_decision"):
            final_decision = MergeDecision(data["final_decision"])
        elif human_correction:
            final_decision = human_correction.corrected_decision
        elif model_output:
            final_decision = model_output.decision

        record = MergedRecord(
            sample=sample,
            model_output=model_output,
            human_correction=human_correction,
            feedback=feedback,
            conflicts=conflicts,
            final_decision=final_decision,
        )
        records[sample_id] = record

    return records


def generate_sample_data(args):
    print("📦 生成示例数据...")

    samples = [
        {
            "sample_id": "S001",
            "entity_a_entity_id": "E001",
            "entity_a_entity_type": "company",
            "entity_a_entity_value": "阿里巴巴集团控股有限公司",
            "entity_b_entity_id": "E002",
            "entity_b_entity_type": "company",
            "entity_b_entity_value": "阿里巴巴集团",
            "ground_truth": "merge",
            "tags": ["high_confidence", "verified"],
            "source": {
                "source_system": "risk_control_db",
                "source_batch": "batch_2024_01",
                "source_id": "RC_001",
                "processed_by": "auto_importer",
            },
        },
        {
            "sample_id": "S002",
            "entity_a_entity_id": "E003",
            "entity_a_entity_type": "company",
            "entity_a_entity_value": "腾讯科技(深圳)有限公司",
            "entity_b_entity_id": "E004",
            "entity_b_entity_type": "company",
            "entity_b_entity_value": "阿里巴巴集团",
            "ground_truth": "not_merge",
            "tags": ["easy_case"],
            "source": {
                "source_system": "risk_control_db",
                "source_batch": "batch_2024_01",
                "source_id": "RC_002",
                "processed_by": "auto_importer",
            },
        },
        {
            "sample_id": "S003",
            "entity_a_entity_id": "E005",
            "entity_a_entity_type": "company",
            "entity_a_entity_value": "北京字节跳动科技有限公司",
            "entity_b_entity_id": "E006",
            "entity_b_entity_type": "company",
            "entity_b_entity_value": "字节跳动有限公司",
            "ground_truth": "merge",
            "tags": ["label_conflict_candidate"],
            "is_boundary": True,
            "source": {
                "source_system": "manual_review",
                "source_batch": "batch_2024_01",
                "source_id": "MR_001",
                "processed_by": "laotang",
            },
        },
        {
            "sample_id": "S004",
            "entity_a_entity_id": "E007",
            "entity_a_entity_type": "person",
            "entity_a_entity_value": "张三",
            "entity_b_entity_id": "E008",
            "entity_b_entity_type": "person",
            "entity_b_entity_value": "张三",
            "ground_truth": "merge",
            "tags": ["duplicate_test"],
            "source": {
                "source_system": "customer_service",
                "source_batch": "batch_2024_01",
                "source_id": "CS_001",
                "processed_by": "auto_importer",
            },
        },
        {
            "sample_id": "S005",
            "entity_a_entity_id": "E009",
            "entity_a_entity_type": "company",
            "entity_a_entity_value": "",
            "entity_b_entity_id": "E010",
            "entity_b_entity_type": "company",
            "entity_b_entity_value": "美团点评",
            "ground_truth": "not_merge",
            "tags": ["missing_value_test"],
            "source": {
                "source_system": "api_import",
                "source_batch": "batch_2024_01",
                "source_id": "API_001",
                "processed_by": "api_connector",
            },
        },
        {
            "sample_id": "S006",
            "entity_a_entity_id": "E011",
            "entity_a_entity_type": "company",
            "entity_a_entity_value": "京东商城",
            "entity_b_entity_id": "E012",
            "entity_b_entity_type": "company",
            "entity_b_entity_value": "京东集团",
            "ground_truth": "merge",
            "tags": ["boundary_case"],
            "is_boundary": True,
            "source": {
                "source_system": "risk_control_db",
                "source_batch": "batch_2024_01",
                "source_id": "RC_003",
                "processed_by": "laotang",
            },
        },
        {
            "sample_id": "S007",
            "entity_a_entity_id": "E013",
            "entity_a_entity_type": "company",
            "entity_a_entity_value": "小米科技有限责任公司",
            "entity_b_entity_id": "E014",
            "entity_b_entity_type": "company",
            "entity_b_entity_value": "小米公司",
            "ground_truth": "merge",
            "tags": ["feedback_case"],
            "source": {
                "source_system": "online_feedback",
                "source_batch": "batch_2024_01",
                "source_id": "FB_001",
                "processed_by": "feedback_system",
            },
        },
        {
            "sample_id": "S008",
            "entity_a_entity_id": "E015",
            "entity_a_entity_type": "company",
            "entity_a_entity_value": "网易公司",
            "entity_b_entity_id": "E016",
            "entity_b_entity_type": "company",
            "entity_b_entity_value": "网易游戏",
            "ground_truth": "not_merge",
            "tags": ["subsidiary_case"],
            "source": {
                "source_system": "risk_control_db",
                "source_batch": "batch_2024_01",
                "source_id": "RC_004",
                "processed_by": "auto_importer",
            },
        },
    ]

    model_outputs = [
        {
            "sample_id": "S001",
            "decision": "merge",
            "confidence": 0.95,
            "model_version": "v2.3.1",
            "merge_reason": "名称高度相似，同属科技行业",
        },
        {
            "sample_id": "S002",
            "decision": "not_merge",
            "confidence": 0.98,
            "model_version": "v2.3.1",
            "merge_reason": "公司名称完全不同",
        },
        {
            "sample_id": "S003",
            "decision": "not_merge",
            "confidence": 0.52,
            "model_version": "v2.3.1",
            "merge_reason": "名称相似度中等，需要人工确认",
        },
        {
            "sample_id": "S004",
            "decision": "merge",
            "confidence": 1.0,
            "model_version": "v2.3.1",
            "merge_reason": "实体完全相同",
        },
        {
            "sample_id": "S005",
            "decision": "review",
            "confidence": 0.3,
            "model_version": "v2.3.1",
            "merge_reason": "数据不完整，无法判断",
        },
        {
            "sample_id": "S006",
            "decision": "merge",
            "confidence": 0.48,
            "model_version": "v2.3.1",
            "merge_reason": "名称有相似性，但置信度较低",
        },
        {
            "sample_id": "S007",
            "decision": "merge",
            "confidence": 0.85,
            "model_version": "v2.3.1",
            "merge_reason": "简称匹配",
        },
        {
            "sample_id": "S008",
            "decision": "merge",
            "confidence": 0.72,
            "model_version": "v2.3.1",
            "merge_reason": "名称前缀相同",
        },
    ]

    human_corrections = [
        {
            "sample_id": "S003",
            "original_decision": "not_merge",
            "corrected_decision": "merge",
            "correction_reason": "北京字节跳动就是字节跳动的全称，应该合并",
            "corrected_by": "laotang",
        },
        {
            "sample_id": "S006",
            "original_decision": "merge",
            "corrected_decision": "review",
            "correction_reason": "京东商城和京东集团关系需要进一步确认",
            "corrected_by": "laotang",
        },
        {
            "sample_id": "S008",
            "original_decision": "merge",
            "corrected_decision": "not_merge",
            "correction_reason": "网易游戏是网易的子公司，但实体合并层面应该分开",
            "corrected_by": "zhangsan",
        },
    ]

    feedback = [
        {
            "sample_id": "S007",
            "feedback_type": "wrong_merge",
            "feedback_content": "小米科技和小米公司可能不是同一个实体",
            "feedback_channel": "customer_service",
            "feedback_by": "customer_001",
            "resolved": False,
        },
        {
            "sample_id": "S003",
            "feedback_type": "correct",
            "feedback_content": "合并正确，确认是同一家公司",
            "feedback_channel": "internal_review",
            "feedback_by": "reviewer_001",
            "resolved": True,
        },
    ]

    data_dir = Path(args.data_dir)
    data_dir.mkdir(parents=True, exist_ok=True)

    with open(data_dir / "samples.json", "w", encoding="utf-8") as f:
        json.dump(samples, f, indent=2, ensure_ascii=False)

    with open(data_dir / "model_outputs.json", "w", encoding="utf-8") as f:
        json.dump(model_outputs, f, indent=2, ensure_ascii=False)

    with open(data_dir / "human_corrections.json", "w", encoding="utf-8") as f:
        json.dump(human_corrections, f, indent=2, ensure_ascii=False)

    with open(data_dir / "feedback.json", "w", encoding="utf-8") as f:
        json.dump(feedback, f, indent=2, ensure_ascii=False)

    print(f"✅ 示例数据已生成到: {data_dir}")
    print(f"  - samples.json ({len(samples)} 条样本)")
    print(f"  - model_outputs.json ({len(model_outputs)} 条模型输出)")
    print(f"  - human_corrections.json ({len(human_corrections)} 条人工修正)")
    print(f"  - feedback.json ({len(feedback)} 条线上反馈)")
    print("\n💡 接下来运行: python -m kg_merge_eval run")
    return 0


def list_records(args):
    loader = DataLoader(args.data_dir)
    records = loader.load_all()

    if not records:
        print("没有找到记录")
        return 0

    print(f"共 {len(records)} 条记录:\n")
    for sample_id, record in records.items():
        status = []
        if record.model_output:
            status.append(f"模型={record.model_output.decision.value}")
        if record.human_correction:
            status.append("有人工修正")
        if record.conflicts:
            status.append(f"有{len(record.conflicts)}个冲突")

        print(
            f"{sample_id}: {record.sample.entity_a.entity_value[:20]} vs "
            f"{record.sample.entity_b.entity_value[:20]} | {' | '.join(status)}"
        )

    return 0


def main():
    parser = argparse.ArgumentParser(
        description="知识图谱实体合并评测工具",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
示例用法:
  # 生成示例数据
  python -m kg_merge_eval sample

  # 运行评测
  python -m kg_merge_eval run

  # 运行评测并与上次结果对比
  python -m kg_merge_eval run --compare-with outputs/old_run_full_data.json

  # 查看记录列表
  python -m kg_merge_eval list
        """,
    )

    parser.add_argument(
        "--data-dir",
        default="./data",
        help="数据目录 (默认: ./data)",
    )
    parser.add_argument(
        "--output-dir",
        default="./outputs",
        help="输出目录 (默认: ./outputs)",
    )

    subparsers = parser.add_subparsers(dest="command", help="可用命令")

    sample_parser = subparsers.add_parser("sample", help="生成示例数据")

    run_parser = subparsers.add_parser("run", help="运行评测")
    run_parser.add_argument("--samples", help="样本文件路径")
    run_parser.add_argument("--model-outputs", help="模型输出文件路径")
    run_parser.add_argument("--corrections", help="人工修正文件路径")
    run_parser.add_argument("--feedback", help="反馈文件路径")
    run_parser.add_argument("--run-name", default="kg_merge_eval", help="运行名称")
    run_parser.add_argument("--compare-with", help="对比之前的运行结果(JSON文件)")

    list_parser = subparsers.add_parser("list", help="列出所有记录")

    args = parser.parse_args()

    if args.command == "sample":
        sys.exit(generate_sample_data(args))
    elif args.command == "run":
        sys.exit(run_evaluation(args))
    elif args.command == "list":
        sys.exit(list_records(args))
    else:
        parser.print_help()
        sys.exit(1)


if __name__ == "__main__":
    main()
