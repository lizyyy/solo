"""
主工作流引擎 - 协调各个模块完成完整分析流程
"""
import os
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Tuple

from .mode_calculator import ModeCalculator
from .risk_analyzer import RiskAnalyzer
from .data_handler import FileHandler, RoomConfig, DataIssue
from .report_generator import (
    ReportGenerator, HistoryManager, DiffAnalyzer,
    AnalysisResult, DiffResult
)


@dataclass
class WorkflowResult:
    valid_results: Dict[str, AnalysisResult] = field(default_factory=dict)
    dirty_data: Dict[str, Tuple[Optional[RoomConfig], List[DataIssue]]] = field(default_factory=dict)
    reports: Dict[str, Dict] = field(default_factory=dict)
    diff_reports: Dict[str, DiffResult] = field(default_factory=dict)

    def summary(self) -> Dict:
        return {
            'valid_count': len(self.valid_results),
            'dirty_count': len(self.dirty_data),
            'processed_files': list(self.valid_results.keys()) + list(self.dirty_data.keys()),
            'diff_count': len(self.diff_reports)
        }


class AcousticWorkflow:
    def __init__(
        self,
        output_dir: str = 'output',
        history_dir: str = 'history',
        input_dir: str = 'input'
    ):
        self.mode_calculator = ModeCalculator()
        self.risk_analyzer = RiskAnalyzer()
        self.file_handler = FileHandler()
        self.report_generator = ReportGenerator(output_dir)
        self.history_manager = HistoryManager(history_dir)
        self.diff_analyzer = DiffAnalyzer()
        self.input_dir = input_dir
        self.output_dir = output_dir

        os.makedirs(input_dir, exist_ok=True)

    def process_single_config(
        self,
        config: RoomConfig,
        project_id: Optional[str] = None
    ) -> AnalysisResult:
        if project_id is None:
            project_id = config.project_id

        self.mode_calculator.sound_speed = config.sound_speed

        modes = self.mode_calculator.calculate_all_modes(
            room=config.room_dimensions,
            min_freq=config.min_frequency,
            max_freq=config.max_frequency
        )

        frequency_gaps = self.risk_analyzer.analyze_frequency_gaps(modes)
        mode_clusters = self.risk_analyzer.find_mode_clusters(modes)

        lp_analyses = []
        for lp in config.listening_points:
            lpa = self.risk_analyzer.analyze_listening_point(
                point=lp,
                room=config.room_dimensions,
                modes=modes
            )
            lp_analyses.append(lpa)

        duplicate_modes = self.mode_calculator.find_duplicate_modes(modes)

        result = AnalysisResult(
            project_id=project_id,
            config=config,
            modes=modes,
            frequency_gaps=frequency_gaps,
            mode_clusters=mode_clusters,
            listening_point_analyses=lp_analyses,
            duplicate_modes=duplicate_modes
        )

        return result

    def process_batch(
        self,
        directory: Optional[str] = None,
        generate_reports: bool = True,
        save_history: bool = True,
        compare_history: bool = True
    ) -> WorkflowResult:
        if directory is None:
            directory = self.input_dir

        workflow_result = WorkflowResult()

        all_results = self.file_handler.load_batch_files(directory)
        valid_configs, dirty_data = self.file_handler.separate_valid_dirty(all_results)

        workflow_result.dirty_data = dirty_data

        for filename, config in valid_configs.items():
            result = self.process_single_config(config)
            workflow_result.valid_results[filename] = result

            if save_history:
                self.history_manager.save_result(result)

            if generate_reports:
                reports = self.report_generator.generate_all_reports(result)
                workflow_result.reports[filename] = reports

            if compare_history:
                old_result = self.history_manager.get_latest_result(config.project_id)
                if old_result and old_result.generated_at != result.generated_at:
                    diff = self.diff_analyzer.compare_results(old_result, result)
                    workflow_result.diff_reports[filename] = diff
                    self.diff_analyzer.generate_diff_report(diff, self.output_dir)

        return workflow_result

    def process_file(
        self,
        filepath: str,
        generate_reports: bool = True,
        save_history: bool = True,
        compare_history: bool = True
    ) -> Tuple[Optional[AnalysisResult], List[DataIssue]]:
        ext = os.path.splitext(filepath)[1].lower()

        if ext == '.json':
            data, issues = self.file_handler.load_json(filepath)
        elif ext in ['.yaml', '.yml']:
            data, issues = self.file_handler.load_yaml(filepath)
        else:
            issues = [DataIssue(
                issue_type='format_error',
                field='__file__',
                message=f"不支持的文件格式: {ext}",
                severity="error"
            )]
            return None, issues

        if data is None:
            return None, issues

        config = self.file_handler.parse_config(data)

        if not config.is_valid:
            return None, config.issues

        result = self.process_single_config(config)

        if save_history:
            self.history_manager.save_result(result)

        if generate_reports:
            self.report_generator.generate_all_reports(result)

        if compare_history:
            old_result = self.history_manager.get_latest_result(config.project_id)
            if old_result and old_result.generated_at != result.generated_at:
                diff = self.diff_analyzer.compare_results(old_result, result)
                self.diff_analyzer.generate_diff_report(diff, self.output_dir)

        return result, issues

    def export_dirty_data_report(
        self,
        dirty_data: Dict[str, Tuple[Optional[RoomConfig], List[DataIssue]]],
        filename: str = 'dirty_data_report.txt'
    ) -> str:
        filepath = os.path.join(self.output_dir, filename)

        lines = []
        lines.append("=" * 60)
        lines.append("脏数据/问题数据报告")
        lines.append("=" * 60)
        lines.append("")

        for file_key, (config, issues) in dirty_data.items():
            lines.append(f"【{file_key}】")
            if config:
                lines.append(f"  项目ID: {config.project_id}")
                lines.append(f"  有效配置: {'是' if config.is_valid else '否'}")
            for issue in issues:
                lines.append(f"  [{issue.severity}] {issue.field}: {issue.message}")
                if issue.original_value:
                    lines.append(f"    原始值: {issue.original_value}")
                if issue.suggested_value:
                    lines.append(f"    建议值: {issue.suggested_value}")
            lines.append("")

        with open(filepath, 'w', encoding='utf-8') as f:
            f.write('\n'.join(lines))

        return filepath
