import os
import json
import shutil
from datetime import datetime
from typing import List, Dict, Optional
from .models import (
    EvaluationReport, EvaluationRecord, ModelVersion,
    VerificationStatus
)


class ReportManager:
    def __init__(self, data_dir: str = "data"):
        self.data_dir = data_dir
        self.reports_dir = os.path.join(data_dir, "reports")
        self.model_versions_file = os.path.join(data_dir, "model_versions.json")
        self._ensure_directories()

    def _ensure_directories(self):
        os.makedirs(self.reports_dir, exist_ok=True)

    def register_model_version(self, version: str, description: str,
                               threshold_config: Optional[Dict[str, float]] = None,
                               caliber_note: Optional[str] = None) -> ModelVersion:
        model_version = ModelVersion(
            version=version,
            description=description,
            created_at=datetime.now(),
            is_active=True,
            threshold_config=threshold_config or {},
            caliber_note=caliber_note
        )

        versions = self.load_model_versions()
        versions[version] = model_version
        self._save_model_versions(versions)

        return model_version

    def load_model_versions(self) -> Dict[str, ModelVersion]:
        versions: Dict[str, ModelVersion] = {}

        if os.path.exists(self.model_versions_file):
            with open(self.model_versions_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
                for v in data:
                    versions[v['version']] = ModelVersion(**v)

        return versions

    def _save_model_versions(self, versions: Dict[str, ModelVersion]):
        data = [v.dict() for v in versions.values()]
        for d in data:
            d['created_at'] = d['created_at'].isoformat()
        with open(self.model_versions_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def get_model_version(self, version: str) -> Optional[ModelVersion]:
        versions = self.load_model_versions()
        return versions.get(version)

    def list_model_versions(self) -> List[ModelVersion]:
        versions = self.load_model_versions()
        return sorted(versions.values(), key=lambda v: v.created_at, reverse=True)

    def set_active_version(self, version: str) -> bool:
        versions = self.load_model_versions()
        if version not in versions:
            return False

        for v in versions.values():
            v.is_active = (v.version == version)

        self._save_model_versions(versions)
        return True

    def get_active_version(self) -> Optional[ModelVersion]:
        versions = self.load_model_versions()
        for v in versions.values():
            if v.is_active:
                return v
        return None

    def generate_report_id(self, model_version: str) -> str:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        return f"report_{model_version}_{timestamp}"

    def _get_report_path(self, report_id: str, create_dir: bool = True) -> str:
        report_dir = os.path.join(self.reports_dir, report_id)
        if create_dir:
            os.makedirs(report_dir, exist_ok=True)
        return report_dir

    def report_exists(self, model_version: str, check_timestamp: bool = True) -> bool:
        if not os.path.exists(self.reports_dir):
            return False

        for report_name in os.listdir(self.reports_dir):
            if report_name.startswith(f"report_{model_version}_"):
                return True
        return False

    def save_report(self, report: EvaluationReport, records: List[EvaluationRecord],
                    stratified_summary: Dict, overwrite: bool = False) -> str:
        if not overwrite and self.report_exists(report.model_version):
            existing_reports = [d for d in os.listdir(self.reports_dir)
                                if d.startswith(f"report_{report.model_version}_")]
            if existing_reports:
                raise FileExistsError(
                    f"模型版本 {report.model_version} 已有报告: {existing_reports[0]}\n"
                    f"如需覆盖请使用 --overwrite 参数，或使用新版本号生成新报告"
                )

        report_dir = self._get_report_path(report.report_id)
        report.file_path = report_dir

        report_data = report.dict()
        report_data['created_at'] = report_data['created_at'].isoformat()
        with open(os.path.join(report_dir, "report_meta.json"), 'w', encoding='utf-8') as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)

        records_data = []
        for r in records:
            r_dict = r.dict()
            r_dict['eval_timestamp'] = r_dict['eval_timestamp'].isoformat()
            records_data.append(r_dict)

        with open(os.path.join(report_dir, "records.json"), 'w', encoding='utf-8') as f:
            json.dump(records_data, f, ensure_ascii=False, indent=2)

        with open(os.path.join(report_dir, "stratified_summary.json"), 'w', encoding='utf-8') as f:
            json.dump(stratified_summary, f, ensure_ascii=False, indent=2)

        return report_dir

    def load_report(self, report_id: str) -> Optional[Dict]:
        report_dir = os.path.join(self.reports_dir, report_id)
        if not os.path.exists(report_dir):
            return None

        try:
            with open(os.path.join(report_dir, "report_meta.json"), 'r', encoding='utf-8') as f:
                report_meta = json.load(f)

            with open(os.path.join(report_dir, "records.json"), 'r', encoding='utf-8') as f:
                records_data = json.load(f)

            with open(os.path.join(report_dir, "stratified_summary.json"), 'r', encoding='utf-8') as f:
                stratified_summary = json.load(f)

            return {
                'meta': report_meta,
                'records': records_data,
                'stratified_summary': stratified_summary
            }
        except Exception as e:
            print(f"加载报告失败: {e}")
            return None

    def list_reports(self, model_version: Optional[str] = None) -> List[str]:
        if not os.path.exists(self.reports_dir):
            return []

        reports = []
        for report_name in os.listdir(self.reports_dir):
            if model_version:
                if not report_name.startswith(f"report_{model_version}_"):
                    continue
            if report_name.startswith("report_"):
                reports.append(report_name)

        return sorted(reports, reverse=True)

    def get_latest_report(self, model_version: str) -> Optional[str]:
        reports = self.list_reports(model_version)
        return reports[0] if reports else None

    def copy_report(self, source_report_id: str, new_model_version: str) -> Optional[str]:
        source_dir = os.path.join(self.reports_dir, source_report_id)
        if not os.path.exists(source_dir):
            return None

        new_report_id = self.generate_report_id(new_model_version)
        new_dir = os.path.join(self.reports_dir, new_report_id)

        shutil.copytree(source_dir, new_dir)

        meta_path = os.path.join(new_dir, "report_meta.json")
        with open(meta_path, 'r', encoding='utf-8') as f:
            meta = json.load(f)
        meta['report_id'] = new_report_id
        meta['model_version'] = new_model_version
        meta['created_at'] = datetime.now().isoformat()
        meta['file_path'] = new_dir

        with open(meta_path, 'w', encoding='utf-8') as f:
            json.dump(meta, f, ensure_ascii=False, indent=2)

        return new_report_id

    def generate_business_recommendations(self, report: EvaluationReport,
                                          records: List[EvaluationRecord]) -> List[str]:
        recommendations = []

        if report.missing_reference_records:
            count = len(report.missing_reference_records)
            recommendations.append(
                f"【重要提醒】有 {count} 条记录缺少标注材料引用，"
                f"请在标注表中补充这些记录的标注内容后再确认结论"
            )

        if report.conflict_records:
            count = len(report.conflict_records)
            recommendations.append(
                f"【重要提醒】有 {count} 条记录存在冲突案例，"
                f"请人工复核这些记录的判定结果"
            )

        if report.duplicate_records:
            count = len(report.duplicate_records)
            recommendations.append(
                f"【注意】检测到 {count} 条重复记录，"
                f"请核对并去重，保留其中一条作为有效记录"
            )

        if report.borderline_records:
            count = len(report.borderline_records)
            recommendations.append(
                f"【注意】有 {count} 条边界记录（置信度在阈值附近），"
                f"建议重点复核，可根据实际情况调整判定阈值"
            )

        need_manual = [r for r in records if r.verify_status == VerificationStatus.NEED_MANUAL_CHECK]
        if need_manual:
            count = len(need_manual)
            recommendations.append(
                f"【待处理】有 {count} 条记录需要人工确认，"
                f"请业务同事在3个工作日内完成审核"
            )

        old_caliber = [r for r in records if r.verify_status == VerificationStatus.OLD_CALIBER]
        if old_caliber:
            count = len(old_caliber)
            recommendations.append(
                f"【信息】有 {count} 条记录沿用旧口径，"
                f"如口径已更新，请考虑重新标注这些记录"
            )

        if not recommendations:
            recommendations.append("本次评测所有记录状态正常，可直接使用报告结论")

        return recommendations

    def archive_report(self, report_id: str) -> bool:
        report_dir = os.path.join(self.reports_dir, report_id)
        if not os.path.exists(report_dir):
            return False

        archive_dir = os.path.join(self.reports_dir, "_archive")
        os.makedirs(archive_dir, exist_ok=True)

        shutil.move(report_dir, os.path.join(archive_dir, report_id))
        return True
