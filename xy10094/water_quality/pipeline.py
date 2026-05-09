"""质控管道 - 整合所有模块的完整流程"""

from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional
from pathlib import Path
from datetime import datetime
import pandas as pd

from .config import QCConfig, DEFAULT_CONFIG
from .data_loader import DataLoader, LoadResult
from .preprocessor import DataPreprocessor, PreprocessResult
from .qc_engine import QCEngine, QCResult, SampleFailure
from .reporter import ReportGenerator, ReportResult
from .exporter import Exporter, ExportResult


@dataclass
class PipelineExecutionRecord:
    """管道执行记录 - 用于复算"""
    start_time: str
    end_time: str = ""
    total_duration: float = 0.0
    config_snapshot: Dict[str, Any] = field(default_factory=dict)
    steps: List[Dict[str, Any]] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)


@dataclass
class PipelineResult:
    """管道完整结果"""
    success: bool
    load_result: Optional[LoadResult] = None
    preprocess_result: Optional[PreprocessResult] = None
    qc_result: Optional[QCResult] = None
    html_report: Optional[ReportResult] = None
    excel_report: Optional[ExportResult] = None
    json_export: Optional[ExportResult] = None
    execution_record: Optional[PipelineExecutionRecord] = None
    message: str = ""


class QCPipeline:
    """质控管道 - 整合所有模块"""

    def __init__(
        self,
        config: Optional[QCConfig] = None,
        output_dir: str = "./output",
    ):
        self.config = config or DEFAULT_CONFIG
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

        self.loader = DataLoader()
        self.preprocessor = DataPreprocessor(self.config)
        self.qc_engine = QCEngine(self.config)
        self.reporter = ReportGenerator()
        self.exporter = Exporter()

    def run(
        self,
        input_path: str,
        report_title: str = "水质检测质控报告",
        generate_html: bool = True,
        generate_excel: bool = True,
        generate_json: bool = True,
    ) -> PipelineResult:
        """运行完整质控流程"""
        start_time = datetime.now()

        record = PipelineExecutionRecord(
            start_time=start_time.isoformat(),
            config_snapshot=self.config.to_dict(),
        )

        result = PipelineResult(success=True, execution_record=record)

        try:
            load_result = self._step_load(input_path, record)
            result.load_result = load_result

            if not load_result.success:
                result.success = False
                result.message = "数据加载失败"
                return result

            if load_result.data is None or load_result.data.empty:
                result.success = False
                result.message = "加载的数据为空"
                return result

            preprocess_result = self._step_preprocess(load_result.data, record)
            result.preprocess_result = preprocess_result

            if preprocess_result.data.empty:
                result.success = False
                result.message = "预处理后数据为空"
                return result

            qc_result = self._step_qc(preprocess_result.data, record)
            result.qc_result = qc_result

            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

            if generate_html:
                html_result = self._step_html_report(
                    preprocess_result.data,
                    load_result,
                    preprocess_result,
                    qc_result,
                    timestamp,
                    report_title,
                    record,
                )
                result.html_report = html_result

            if generate_excel:
                excel_result = self._step_export_excel(
                    qc_result, load_result, preprocess_result, timestamp, record
                )
                result.excel_report = excel_result

            if generate_json:
                json_result = self._step_export_json(
                    qc_result, load_result, preprocess_result, timestamp, record
                )
                result.json_export = json_result

            end_time = datetime.now()
            record.end_time = end_time.isoformat()
            record.total_duration = (end_time - start_time).total_seconds()

            self._save_execution_record(record)

            result.message = "质控流程完成"
            result.success = True

        except Exception as e:
            result.success = False
            result.message = f"流程执行异常: {str(e)}"
            record.errors.append(str(e))
            record.end_time = datetime.now().isoformat()
            self._save_execution_record(record)

        return result

    def rerun_from_json(self, json_export_path: str) -> PipelineResult:
        """从 JSON 导出文件复算"""
        import json

        with open(json_export_path, "r", encoding="utf-8") as f:
            saved_data = json.load(f)

        if "config_used" in saved_data:
            new_config = QCConfig.from_dict(saved_data["config_used"])
            self.config = new_config
            self.preprocessor = DataPreprocessor(self.config)
            self.qc_engine = QCEngine(self.config)

        if "valid_samples" in saved_data and saved_data["valid_samples"]:
            df = pd.DataFrame(saved_data["valid_samples"])
            if "invalid_samples" in saved_data and saved_data["invalid_samples"]:
                invalid_df = pd.DataFrame(saved_data["invalid_samples"])
                df = pd.concat([df, invalid_df], ignore_index=True)
        else:
            return PipelineResult(success=False, message="JSON 中没有可复算的数据")

        return self._run_from_dataframe(df, "复算报告")

    def _run_from_dataframe(self, df: pd.DataFrame, title: str) -> PipelineResult:
        """从 DataFrame 直接运行"""
        from .data_loader import LoadIssue

        fake_load_result = LoadResult(
            data=df,
            success=True,
            file_path="in_memory",
            file_type="dataframe",
            row_count=len(df),
            column_count=len(df.columns),
        )

        preprocess_result = self.preprocessor.preprocess(df)
        qc_result = self.qc_engine.run_qc(preprocess_result.data)

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        html_result = self.reporter.generate(
            output_path=str(self.output_dir / f"qc_report_{timestamp}.html"),
            data=preprocess_result.data,
            load_result=fake_load_result,
            preprocess_result=preprocess_result,
            qc_result=qc_result,
            config_used=self.config.to_dict(),
            title=title,
        )

        excel_result = self.exporter.export_to_excel(
            str(self.output_dir / f"qc_report_{timestamp}.xlsx"),
            qc_result,
            fake_load_result,
            preprocess_result,
        )

        json_result = self.exporter.export_to_json(
            str(self.output_dir / f"qc_report_{timestamp}.json"),
            qc_result,
            fake_load_result,
            preprocess_result,
        )

        return PipelineResult(
            success=True,
            load_result=fake_load_result,
            preprocess_result=preprocess_result,
            qc_result=qc_result,
            html_report=html_result,
            excel_report=excel_result,
            json_export=json_result,
            message="复算完成",
        )

    def _step_load(self, input_path: str, record: PipelineExecutionRecord) -> LoadResult:
        """加载数据"""
        step_start = datetime.now()
        result = self.loader.load(input_path)
        step_end = datetime.now()

        record.steps.append({
            "step": "load",
            "start": step_start.isoformat(),
            "end": step_end.isoformat(),
            "duration": (step_end - step_start).total_seconds(),
            "input_path": input_path,
            "success": result.success,
            "row_count": result.row_count,
            "issue_count": len(result.issues),
        })

        return result

    def _step_preprocess(self, data: pd.DataFrame, record: PipelineExecutionRecord) -> PreprocessResult:
        """预处理"""
        step_start = datetime.now()
        result = self.preprocessor.preprocess(data)
        step_end = datetime.now()

        record.steps.append({
            "step": "preprocess",
            "start": step_start.isoformat(),
            "end": step_end.isoformat(),
            "duration": (step_end - step_start).total_seconds(),
            "original_rows": result.original_rows,
            "cleaned_rows": result.cleaned_rows,
            "issue_count": len(result.issues),
            "action_count": len(result.actions),
        })

        return result

    def _step_qc(self, data: pd.DataFrame, record: PipelineExecutionRecord) -> QCResult:
        """质控检查"""
        step_start = datetime.now()
        result = self.qc_engine.run_qc(data)
        step_end = datetime.now()

        record.steps.append({
            "step": "qc",
            "start": step_start.isoformat(),
            "end": step_end.isoformat(),
            "duration": (step_end - step_start).total_seconds(),
            "total_checks": len(result.checks),
            "passed_checks": sum(1 for c in result.checks if c.passed),
            "total_failures": len(result.failures),
        })

        return result

    def _step_html_report(
        self,
        data: pd.DataFrame,
        load_result,
        preprocess_result,
        qc_result,
        timestamp: str,
        title: str,
        record: PipelineExecutionRecord,
    ) -> ReportResult:
        """生成 HTML 报告"""
        step_start = datetime.now()
        output_path = str(self.output_dir / f"qc_report_{timestamp}.html")
        result = self.reporter.generate(
            output_path=output_path,
            data=data,
            load_result=load_result,
            preprocess_result=preprocess_result,
            qc_result=qc_result,
            config_used=self.config.to_dict(),
            title=title,
        )
        step_end = datetime.now()

        record.steps.append({
            "step": "html_report",
            "start": step_start.isoformat(),
            "end": step_end.isoformat(),
            "duration": (step_end - step_start).total_seconds(),
            "output_path": output_path,
            "success": result.success,
            "size_kb": result.report_size_kb,
        })

        return result

    def _step_export_excel(
        self,
        qc_result,
        load_result,
        preprocess_result,
        timestamp: str,
        record: PipelineExecutionRecord,
    ) -> ExportResult:
        """导出 Excel"""
        step_start = datetime.now()
        output_path = str(self.output_dir / f"qc_data_{timestamp}.xlsx")
        result = self.exporter.export_to_excel(
            output_path, qc_result, load_result, preprocess_result
        )
        step_end = datetime.now()

        record.steps.append({
            "step": "export_excel",
            "start": step_start.isoformat(),
            "end": step_end.isoformat(),
            "duration": (step_end - step_start).total_seconds(),
            "output_path": output_path,
            "success": result.success,
            "size_kb": result.file_size_kb,
        })

        return result

    def _step_export_json(
        self,
        qc_result,
        load_result,
        preprocess_result,
        timestamp: str,
        record: PipelineExecutionRecord,
    ) -> ExportResult:
        """导出 JSON"""
        step_start = datetime.now()
        output_path = str(self.output_dir / f"qc_data_{timestamp}.json")
        result = self.exporter.export_to_json(
            output_path, qc_result, load_result, preprocess_result
        )
        step_end = datetime.now()

        record.steps.append({
            "step": "export_json",
            "start": step_start.isoformat(),
            "end": step_end.isoformat(),
            "duration": (step_end - step_start).total_seconds(),
            "output_path": output_path,
            "success": result.success,
            "size_kb": result.file_size_kb,
        })

        return result

    def _save_execution_record(self, record: PipelineExecutionRecord):
        """保存执行记录"""
        import json

        record_path = self.output_dir / "execution_history.jsonl"
        with open(record_path, "a", encoding="utf-8") as f:
            data = {
                "start_time": record.start_time,
                "end_time": record.end_time,
                "total_duration": record.total_duration,
                "config": record.config_snapshot,
                "steps": record.steps,
                "errors": record.errors,
            }
            f.write(json.dumps(data, ensure_ascii=False) + "\n")
