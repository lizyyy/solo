from datetime import datetime
from pathlib import Path
from typing import List, Optional
import logging
import zipfile

from eeg_aligner.models import ProjectData
from eeg_aligner.export import MarkdownExporter, CSVExporter, JSONExporter

logger = logging.getLogger(__name__)


class ReportExporter:
    def __init__(self):
        self.markdown_exporter = MarkdownExporter()
        self.csv_exporter = CSVExporter()
        self.json_exporter = JSONExporter()

    def export_audit_package(
        self,
        project_data: ProjectData,
        output_dir: Path,
        package_name: Optional[str] = None,
    ) -> Path:
        logger.info(f"Exporting audit package to {output_dir}")
        
        output_dir.mkdir(parents=True, exist_ok=True)
        
        if package_name is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            package_name = f"eeg_audit_{timestamp}"
        
        package_dir = output_dir / package_name
        package_dir.mkdir(parents=True, exist_ok=True)
        
        subdirs = ["events", "stages", "reports", "raw"]
        for subdir in subdirs:
            (package_dir / subdir).mkdir(parents=True, exist_ok=True)
        
        self._export_events(project_data, package_dir)
        self._export_stages(project_data, package_dir)
        self._export_reports(project_data, package_dir)
        self._export_raw(project_data, package_dir)
        
        self._create_readme(project_data, package_dir)
        
        zip_path = output_dir / f"{package_name}.zip"
        self._create_zip_package(package_dir, zip_path)
        
        logger.info(f"Audit package created: {zip_path}")
        return zip_path

    def _export_events(self, project_data: ProjectData, package_dir: Path):
        if project_data.events:
            events_csv = package_dir / "events" / "aligned_events.csv"
            self.csv_exporter.export_events(project_data.events, events_csv, include_aligned=True)
            
            events_jsonl = package_dir / "events" / "events.jsonl"
            self.json_exporter.export_events(project_data.events, events_jsonl)

    def _export_stages(self, project_data: ProjectData, package_dir: Path):
        if project_data.sleep_stages:
            stages_csv = package_dir / "stages" / "sleep_stages.csv"
            self.csv_exporter.export_stages(project_data.sleep_stages, stages_csv)

    def _export_reports(self, project_data: ProjectData, package_dir: Path):
        reports_dir = package_dir / "reports"
        
        markdown_path = reports_dir / "audit_report.md"
        self.markdown_exporter.export(project_data, markdown_path)
        
        summary_csv = reports_dir / "summary.csv"
        self.csv_exporter.export_summary(project_data, summary_csv)
        
        if project_data.check_result:
            issues_csv = reports_dir / "issues.csv"
            self.csv_exporter.export_issues(project_data.check_result, issues_csv)
        
        full_json = reports_dir / "full_data.json"
        self.json_exporter.export_project(project_data, full_json)

    def _export_raw(self, project_data: ProjectData, package_dir: Path):
        raw_dir = package_dir / "raw"
        
        if project_data.clock_calibrations:
            calib_json = raw_dir / "clock_calibrations.json"
            with open(calib_json, "w", encoding="utf-8") as f:
                calib_data = []
                for calib in project_data.clock_calibrations:
                    calib_data.append({
                        "calibration_id": calib.calibration_id,
                        "calibration_time": calib.calibration_time.isoformat() if calib.calibration_time else None,
                        "eeg_clock_time": calib.eeg_clock_time.isoformat() if calib.eeg_clock_time else None,
                        "stimulus_clock_time": calib.stimulus_clock_time.isoformat() if calib.stimulus_clock_time else None,
                        "drift_ms": calib.drift_ms,
                    })
                import json
                json.dump(calib_data, f, indent=2)
        
        if project_data.eeg_summaries:
            eeg_json = raw_dir / "eeg_summaries.json"
            with open(eeg_json, "w", encoding="utf-8") as f:
                summary_data = []
                for summary in project_data.eeg_summaries:
                    summary_data.append({
                        "channel_name": summary.channel_name,
                        "sampling_rate": summary.sampling_rate,
                        "start_time": summary.start_time.isoformat() if summary.start_time else None,
                        "end_time": summary.end_time.isoformat() if summary.end_time else None,
                        "artifact_percentage": summary.artifact_percentage,
                    })
                import json
                json.dump(summary_data, f, indent=2)

    def _create_readme(self, project_data: ProjectData, package_dir: Path):
        readme_path = package_dir / "README.txt"
        
        check = project_data.check_result
        
        lines = [
            "=" * 60,
            "脑电事件码对齐审计报告包",
            "=" * 60,
            "",
            f"项目ID: {project_data.project_id}",
            f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "-" * 60,
            "目录结构说明",
            "-" * 60,
            "",
            "events/",
            "  aligned_events.csv  - 对齐后的事件列表 (CSV格式)",
            "  events.jsonl       - 原始事件数据 (JSONL格式)",
            "",
            "stages/",
            "  sleep_stages.csv   - 睡眠分期数据 (CSV格式)",
            "",
            "reports/",
            "  audit_report.md    - 审计报告 (Markdown格式)",
            "  summary.csv        - 数据摘要 (CSV格式)",
            "  issues.csv         - 问题列表 (CSV格式, 如有问题)",
            "  full_data.json     - 完整数据导出 (JSON格式)",
            "",
            "raw/",
            "  clock_calibrations.json - 时钟校准数据",
            "  eeg_summaries.json     - EEG通道摘要",
            "",
            "-" * 60,
            "问题汇总",
            "-" * 60,
            "",
        ]
        
        if check:
            lines.extend([
                f"严重问题 (Critical): {check.critical_issue_count}",
                f"警告问题 (Warning):  {check.warning_issue_count}",
                f"信息提示 (Info):     {check.info_issue_count}",
                "",
            ])
            
            if check.critical_issue_count > 0:
                lines.append("⚠️  注意: 存在严重问题，需要立即处理!")
                lines.append("")
        else:
            lines.extend([
                "未执行数据检查。请运行 'eeg-aligner check' 命令。",
                "",
            ])
        
        lines.extend([
            "-" * 60,
            "使用说明",
            "-" * 60,
            "",
            "1. 查看 audit_report.md 获取完整的审计报告",
            "2. 查看 issues.csv 获取详细的问题列表",
            "3. aligned_events.csv 包含所有对齐后的事件时间戳",
            "4. full_data.json 包含所有数据的完整导出",
            "",
            "-" * 60,
            "技术支持",
            "-" * 60,
            "",
            "本报告由「脑电事件码对齐员」生成",
            "命令: eeg-aligner report --output <输出目录>",
            "",
        ])
        
        with open(readme_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

    def _create_zip_package(self, source_dir: Path, zip_path: Path):
        logger.info(f"Creating zip package: {zip_path}")
        
        with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for file_path in source_dir.rglob("*"):
                if file_path.is_file():
                    arcname = file_path.relative_to(source_dir)
                    zf.write(file_path, arcname)
        
        logger.info(f"Zip package created: {zip_path} ({zip_path.stat().st_size / 1024:.1f} KB)")
