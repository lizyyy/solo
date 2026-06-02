import os
from datetime import datetime
from typing import Optional
from .log_loader import LogLoader
from .annotation_manager import AnnotationManager
from .evaluation_engine import EvaluationEngine
from .report_manager import ReportManager
from .report_exporter import ReportExporter
from .models import EvaluationReport


class EvaluationPipeline:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.log_loader = LogLoader(data_dir)
        self.annotation_manager = AnnotationManager(data_dir)
        self.evaluation_engine = EvaluationEngine(data_dir)
        self.report_manager = ReportManager(data_dir)
        self.report_exporter = ReportExporter(data_dir)

    def run_full_evaluation(self, model_version: str,
                            old_caliber_version: Optional[str] = None,
                            overwrite: bool = False,
                            log_file: Optional[str] = None) -> dict:
        print(f"开始评测流程 - 模型版本: {model_version}")

        print("1. 加载评测日志...")
        records = self.log_loader.load_eval_logs(model_version, log_file)
        print(f"   加载到 {len(records)} 条记录")

        print("2. 应用标注表材料引用...")
        records = self.annotation_manager.apply_threshold_notes(records)
        records, missing_ref_ids = self.annotation_manager.check_missing_references(records)
        print(f"   发现 {len(missing_ref_ids)} 条引用缺失记录")

        print("3. 标记冲突案例...")
        records, conflict_ids = self.annotation_manager.mark_conflict_records(records)
        print(f"   发现 {len(conflict_ids)} 条冲突记录")

        if old_caliber_version:
            print(f"4. 应用旧口径 {old_caliber_version}...")
            records = self.annotation_manager.apply_old_caliber(records, old_caliber_version)
            old_caliber_count = sum(1 for r in records if r.old_caliber_note)
            print(f"   应用了 {old_caliber_count} 条旧口径记录")

        print("5. 执行重复评测...")
        records = self.evaluation_engine.re_evaluate(records, model_version)
        print("   重复评测完成")

        print("6. 样本分层...")
        stratified = self.evaluation_engine.stratify_records(records)
        stratified_summary = self.evaluation_engine.get_stratification_summary(stratified)
        print(f"   生成 {len(stratified)} 个分层")

        print("7. 生成评测报告...")
        report_id = self.report_manager.generate_report_id(model_version)

        duplicate_ids = [r.record_id for r in records if r.is_duplicate]
        borderline_ids = [r.record_id for r in records
                          if r.verify_status.value == "边界记录"]

        report = EvaluationReport(
            report_id=report_id,
            model_version=model_version,
            created_at=datetime.now(),
            total_records=len(records),
            stratified_summary=stratified_summary,
            conflict_records=conflict_ids,
            missing_reference_records=missing_ref_ids,
            duplicate_records=duplicate_ids,
            borderline_records=borderline_ids,
            recommendations=[]
        )

        report.recommendations = self.report_manager.generate_business_recommendations(
            report, records
        )

        report_dir = self.report_manager.save_report(
            report, records, stratified_summary, overwrite
        )
        print(f"   报告已保存: {report_dir}")

        print("8. 导出Excel报告...")
        excel_file = self.report_exporter.export_to_excel(report, records)
        print(f"   Excel报告: {excel_file}")

        print("9. 导出文本报告...")
        text_file = self.report_exporter.export_to_text(report, records)
        print(f"   文本报告: {text_file}")

        print("10. 导出冲突清单...")
        conflict_file = self.report_exporter.export_conflict_list(report, records)
        print(f"   冲突清单: {conflict_file}")

        print("\n评测流程完成!")
        print(f"报告ID: {report_id}")

        return {
            'report_id': report_id,
            'report_dir': report_dir,
            'total_records': len(records),
            'stratified_summary': stratified_summary,
            'excel_file': excel_file,
            'text_file': text_file,
            'conflict_file': conflict_file,
            'recommendations': report.recommendations
        }

    def list_model_versions(self):
        versions = self.report_manager.list_model_versions()
        return versions

    def register_model_version(self, version: str, description: str,
                               threshold_config: dict = None,
                               caliber_note: str = None):
        return self.report_manager.register_model_version(
            version, description, threshold_config, caliber_note
        )

    def set_active_version(self, version: str):
        return self.report_manager.set_active_version(version)

    def get_active_version(self):
        return self.report_manager.get_active_version()

    def list_reports(self, model_version: str = None):
        return self.report_manager.list_reports(model_version)

    def load_report(self, report_id: str):
        return self.report_manager.load_report(report_id)

    def view_report_summary(self, report_id: str):
        report_data = self.report_manager.load_report(report_id)
        if not report_data:
            return None

        meta = report_data['meta']
        summary = report_data['stratified_summary']

        output = []
        output.append(f"报告ID: {meta['report_id']}")
        output.append(f"模型版本: {meta['model_version']}")
        output.append(f"生成时间: {meta['created_at']}")
        output.append(f"总记录数: {meta['total_records']}")
        output.append("")
        output.append("分层统计:")
        for stratum, stats in summary.items():
            output.append(f"  {stratum}: {stats['总数']} 条")

        output.append("")
        output.append("处理建议:")
        for i, rec in enumerate(meta['recommendations'], 1):
            output.append(f"  {i}. {rec}")

        return '\n'.join(output)

    def view_conflict_list(self, report_id: str):
        report_data = self.report_manager.load_report(report_id)
        if not report_data:
            return None

        meta = report_data['meta']
        records = report_data['records']
        conflict_ids = set(meta['conflict_records'])

        output = []
        output.append(f"冲突记录清单 - 报告: {report_id}")
        output.append("-" * 60)

        if not conflict_ids:
            output.append("无冲突记录")
            return '\n'.join(output)

        conflict_records = [r for r in records if r['record_id'] in conflict_ids]
        output.append(f"共 {len(conflict_records)} 条冲突记录:")
        output.append("")

        for r in conflict_records:
            output.append(f"记录ID: {r['record_id']}")
            output.append(f"  城市: {r['city']}")
            output.append(f"  区域: {r['district']}")
            output.append(f"  网格: {r['grid_id']}")
            output.append(f"  变化类型: {r['change_type']}")
            output.append(f"  当前状态: {r['verify_status']}")
            output.append(f"  冲突说明: {r.get('conflict_note', '存在冲突案例')}")
            output.append("")

        return '\n'.join(output)
