import csv
import yaml
from pathlib import Path

from semantic_dedup.models import (
    RecallCandidate,
    ThresholdParams,
    SampleStatus,
    NextAction,
)
from semantic_dedup.core import (
    run_threshold_trial,
    apply_manual_correction,
    rerun_with_new_params,
    save_params_to_yaml,
)
from semantic_dedup.report import export_report_to_markdown, export_report_to_json


DEMO_CANDIDATES = [
    {
        "sample_id": "S001",
        "content": "如何使用Python进行数据分析？",
        "semantic_score": 0.92,
        "category": "编程开发",
        "is_minority": False,
    },
    {
        "sample_id": "S002",
        "content": "机器学习入门教程推荐",
        "semantic_score": 0.88,
        "category": "人工智能",
        "is_minority": False,
    },
    {
        "sample_id": "S003",
        "content": "量子计算在密码学中的应用",
        "semantic_score": 0.72,
        "category": "量子计算",
        "is_minority": True,
    },
    {
        "sample_id": "S004",
        "content": "前端框架Vue和React对比",
        "semantic_score": 0.86,
        "category": "前端开发",
        "is_minority": False,
    },
    {
        "sample_id": "S005",
        "content": "生物信息学中的序列比对算法",
        "semantic_score": 0.70,
        "category": "生物信息",
        "is_minority": True,
    },
    {
        "sample_id": "S006",
        "content": "数据库索引优化最佳实践",
        "semantic_score": 0.90,
        "category": "数据库",
        "is_minority": False,
    },
]


INITIAL_PARAMS = {
    "dedup_threshold": 0.85,
    "minority_weight": 1.2,
    "overall_metric_weight": 1.0,
    "minority_boost_enabled": True,
    "min_minority_ratio": 0.40,
}


UPDATED_PARAMS = {
    "dedup_threshold": 0.82,
    "minority_weight": 1.3,
    "overall_metric_weight": 1.0,
    "minority_boost_enabled": True,
    "min_minority_ratio": 0.30,
}


def generate_demo_data_files(output_dir: str):
    out = Path(output_dir)
    out.mkdir(exist_ok=True)
    
    csv_path = out / "recall_candidates.csv"
    with open(csv_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["sample_id", "content", "semantic_score", "category", "is_minority"])
        writer.writeheader()
        writer.writerows(DEMO_CANDIDATES)
    
    initial_params = ThresholdParams(**INITIAL_PARAMS)
    save_params_to_yaml(initial_params, str(out / "params_initial.yaml"))
    
    updated_params = ThresholdParams(**UPDATED_PARAMS)
    save_params_to_yaml(updated_params, str(out / "params_updated.yaml"))
    
    return {
        "csv_path": str(csv_path),
        "initial_params_path": str(out / "params_initial.yaml"),
        "updated_params_path": str(out / "params_updated.yaml"),
    }


def generate_demo_data(output_dir: str):
    files = generate_demo_data_files(output_dir)
    out = Path(output_dir)
    
    candidates = [RecallCandidate(**c) for c in DEMO_CANDIDATES]
    initial_params = ThresholdParams(**INITIAL_PARAMS)
    updated_params = ThresholdParams(**UPDATED_PARAMS)
    
    step1_run = run_threshold_trial(
        candidates=candidates,
        params=initial_params,
        operator="system",
        reason="第一步：首次导入召回候选表，运行阈值试算",
    )
    
    from semantic_dedup.core import generate_playback_report
    step1_report = generate_playback_report(step1_run)
    export_report_to_markdown(step1_report, str(out / "step1_initial_report.md"))
    export_report_to_json(step1_report, str(out / "step1_initial_report.json"))
    
    step2_run = apply_manual_correction(
        trial_run=step1_run,
        sample_id="S003",
        operator="评测运营小孟",
        reason="S003是稀有领域样本，业务上有较高价值，虽原始分低但建议保留，标记为待算法工程师最终确认",
        new_status=SampleStatus.NEED_ALGO_REVIEW,
        new_next_action=NextAction.ALGO_ENGINEER,
        custom_why_kept="评测运营小孟人工复核：该样本属于量子计算稀有领域，虽然语义得分0.72低于阈值，但业务上该类内容稀缺，建议保留并由算法工程师最终确认加权策略",
    )
    
    step2_report = generate_playback_report(step2_run)
    export_report_to_markdown(step2_report, str(out / "step2_corrected_report.md"))
    export_report_to_json(step2_report, str(out / "step2_corrected_report.json"))
    
    step3_run = rerun_with_new_params(
        trial_run=step2_run,
        new_params=updated_params,
        operator="算法工程师",
        reason="算法工程师调整参数：去重阈值从0.85降至0.82，少数类加权从1.2提升到1.3，最小少数类占比从30%降至20%",
    )
    
    step3_report = generate_playback_report(step3_run)
    export_report_to_markdown(step3_report, str(out / "step3_rerun_report.md"))
    export_report_to_json(step3_report, str(out / "step3_rerun_report.json"))
    
    return {
        "files": files,
        "step1_run": step1_run,
        "step2_run": step2_run,
        "step3_run": step3_run,
    }
