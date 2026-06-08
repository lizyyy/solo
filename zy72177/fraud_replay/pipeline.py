import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, Optional
import os

from .config import Config, DEFAULT_CONFIG
from .sample_processor import SampleProcessor
from .model_output import ModelOutputProcessor
from .review import ReviewProcessor
from .metrics import MetricCalculator
from .reporter import ReportGenerator


class ReplayPipeline:
    def __init__(self, config: Config = DEFAULT_CONFIG):
        self.config = config
        self.sample_processor = SampleProcessor(config)
        self.model_processor = ModelOutputProcessor(config)
        self.review_processor = ReviewProcessor(config)
        self.metric_calculator = MetricCalculator(config)
        self.reporter = ReportGenerator(config)
        
        self.results = {}
        self.processed_df = None
        self.previous_run_df = None

    def run(self, 
            model_output_path: Optional[str] = None,
            review_data_path: Optional[str] = None,
            feedback_data_path: Optional[str] = None,
            df: Optional[pd.DataFrame] = None,
            output_dir: str = "./output",
            run_name: str = "default") -> Dict:
        print("\n" + "="*60)
        print("🚀 开始信贷欺诈样本回放流程")
        print("="*60 + "\n")
        
        os.makedirs(output_dir, exist_ok=True)
        
        if df is not None:
            raw_df = df.copy()
            source_name = "direct_input"
        elif model_output_path:
            source_name = os.path.basename(model_output_path)
            raw_df = self.sample_processor.load_data(model_output_path, source_name)
        else:
            raise ValueError("必须提供 df 或 model_output_path")
        
        processed_df, sample_summary = self.sample_processor.process_samples(raw_df)
        
        processed_df, model_summary = self.model_processor.process_model_output(processed_df)
        
        review_df = None
        feedback_df = None
        
        if review_data_path and os.path.exists(review_data_path):
            review_df = pd.read_csv(review_data_path) if review_data_path.endswith('.csv') else pd.read_excel(review_data_path)
        
        if feedback_data_path and os.path.exists(feedback_data_path):
            feedback_df = pd.read_csv(feedback_data_path) if feedback_data_path.endswith('.csv') else pd.read_excel(feedback_data_path)
        
        if review_df is not None or feedback_df is not None:
            processed_df = self.review_processor.merge_review_feedback(
                processed_df, review_df, feedback_df
            )
        
        processed_df, review_summary = self.review_processor.process_review_data(processed_df)
        
        metrics = self.metric_calculator.calculate_metrics(processed_df)
        errors = self.metric_calculator.analyze_errors(processed_df)
        
        run_comparison = None
        if self.previous_run_df is not None:
            previous_metrics = self.metric_calculator.calculate_metrics(self.previous_run_df, group_name="previous")
            run_comparison = self.metric_calculator.compare_metrics(previous_metrics, metrics)
        
        report = self.reporter.generate_report(
            processed_df, sample_summary, model_summary,
            review_summary, metrics, errors, run_comparison
        )
        
        report_path = f"{output_dir}/fraud_replay_report_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        self.reporter.save_report(report, report_path)
        
        self.reporter.export_error_samples(errors, output_dir)
        
        result_path = f"{output_dir}/processed_data.csv"
        processed_df.to_csv(result_path, index=False, encoding="utf-8-sig")
        print(f"\n📁 处理后的数据已保存至: {result_path}")
        
        self.processed_df = processed_df
        self.results = {
            "run_name": run_name,
            "run_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "sample_summary": sample_summary,
            "model_summary": model_summary,
            "review_summary": review_summary,
            "metrics": metrics,
            "errors": {
                "fp_count": errors["fp_count"],
                "fn_count": errors["fn_count"]
            },
            "report_path": report_path,
            "data_path": result_path
        }
        
        print("\n" + "="*60)
        print("✅ 信贷欺诈样本回放完成！")
        print(f"📄 报告位置: {report_path}")
        print("="*60 + "\n")
        
        return self.results

    def set_previous_run(self, df: pd.DataFrame):
        print(f"处理前次运行数据 (共 {len(df)} 条)...")
        prev_df = df.copy()
        
        if "source" not in prev_df.columns:
            prev_df["source"] = "前次运行"
        if "process_time" not in prev_df.columns:
            prev_df["process_time"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        if "sample_id" not in prev_df.columns:
            prev_df["sample_id"] = prev_df.apply(
                lambda row: "|".join([str(row.get(c, "")) for c in self.config.duplicate_detection_cols if pd.notna(row.get(c, ""))]),
                axis=1
            )
        
        prev_sample_processor = SampleProcessor(self.config)
        prev_model_processor = ModelOutputProcessor(self.config)
        prev_review_processor = ReviewProcessor(self.config)
        
        prev_df, _ = prev_sample_processor.process_samples(prev_df)
        prev_df, _ = prev_model_processor.process_model_output(prev_df)
        prev_df, _ = prev_review_processor.process_review_data(prev_df)
        
        self.previous_run_df = prev_df
        print(f"前次运行数据处理完成，有效记录 {len(prev_df)} 条")

    def get_results(self) -> Dict:
        return self.results

    def get_processed_data(self) -> pd.DataFrame:
        return self.processed_df

    def update_label(self, sample_id: str, new_label: int, note: str = ""):
        if self.processed_df is not None:
            self.processed_df = self.review_processor.update_label_for_sample(
                self.processed_df, sample_id, new_label, "manual", note
            )
            print(f"已更新样本 {sample_id} 的标签为 {new_label}")

    def rerun_metrics(self, output_dir: str = "./output") -> Dict:
        if self.processed_df is None:
            raise ValueError("没有处理好的数据，请先运行 run()")
        
        print("\n🔄 重新计算指标...")
        
        metrics = self.metric_calculator.calculate_metrics(self.processed_df)
        errors = self.metric_calculator.analyze_errors(self.processed_df)
        
        sample_summary = self.sample_processor._get_processing_summary(self.processed_df)
        model_summary = self.model_processor._get_model_summary(self.processed_df)
        review_summary = self.review_processor._get_review_summary(self.processed_df)
        
        report = self.reporter.generate_report(
            self.processed_df, sample_summary, model_summary,
            review_summary, metrics, errors
        )
        
        report_path = f"{output_dir}/fraud_replay_report_updated_{datetime.now().strftime('%Y%m%d_%H%M%S')}.txt"
        self.reporter.save_report(report, report_path)
        
        self.results.update({
            "metrics": metrics,
            "errors": {
                "fp_count": errors["fp_count"],
                "fn_count": errors["fn_count"]
            },
            "report_path": report_path
        })
        
        return self.results
