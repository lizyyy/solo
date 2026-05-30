"""
批量处理模块
- 批量导入多个文件
- 重复运行校准流程
- 筛选条件导出保持一致
- 坏数据不崩溃，定位来源
"""
import os
import glob
import json
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Callable, Tuple
from datetime import datetime
import pandas as pd

from .exceptions import (
    DropCalibrationError,
    BatchProcessingError,
    DataImportError,
    create_error_location,
)
from .models import (
    DataSourceType,
    DataSource,
    CalibrationParams,
)
from .data_import import DataImporter, ImportResult
from .data_cleaning import DataCleaner, CleaningResult
from .probability_test import ProbabilityTester, TestResult
from .anomaly_detection import AnomalyDetector, AnomalyReport
from .config_comparison import ConfigComparator, ComparisonResult
from .report_export import ReportExporter, ExportConfig
from .utils import safe_json_dumps


@dataclass
class BatchFile:
    """批量处理的文件配置"""
    file_path: str
    source_type: DataSourceType
    sheet_name: Optional[str] = None
    version: str = "1.0"
    import_notes: str = ""
    activate: bool = True


@dataclass
class BatchResult:
    """批量处理结果"""
    batch_id: str
    start_time: datetime
    end_time: Optional[datetime] = None
    files_processed: int = 0
    files_failed: int = 0
    import_results: List[ImportResult] = field(default_factory=list)
    cleaning_result: Optional[CleaningResult] = None
    test_result: Optional[TestResult] = None
    anomaly_report: Optional[AnomalyReport] = None
    comparison_result: Optional[ComparisonResult] = None
    exported_files: Dict[str, str] = field(default_factory=dict)
    errors: List[DropCalibrationError] = field(default_factory=list)
    success: bool = False

    def to_dict(self) -> Dict[str, Any]:
        return {
            "batch_id": self.batch_id,
            "start_time": self.start_time.isoformat(),
            "end_time": self.end_time.isoformat() if self.end_time else None,
            "files_processed": self.files_processed,
            "files_failed": self.files_failed,
            "success": self.success,
            "exported_files": self.exported_files,
            "error_count": len(self.errors),
            "errors": [str(e) for e in self.errors],
        }


class BatchProcessor:
    """
    批量处理器
    支持批量导入、重复运行、筛选导出一致性
    """

    def __init__(self, fail_fast: bool = False):
        self.fail_fast = fail_fast
        self.importer = DataImporter(fail_fast=fail_fast)
        self.cleaner = DataCleaner(fail_fast=fail_fast)
        self.tester = ProbabilityTester(fail_fast=fail_fast)
        self.detector = AnomalyDetector(fail_fast=fail_fast)
        self.comparator = ConfigComparator(fail_fast=fail_fast)
        self.exporter = ReportExporter(fail_fast=fail_fast)

    def run_full_pipeline(
        self,
        batch_files: List[BatchFile],
        params: CalibrationParams,
        export_config: Optional[ExportConfig] = None,
    ) -> BatchResult:
        """
        运行完整的校准流程
        """
        batch_id = f"BATCH_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        result = BatchResult(
            batch_id=batch_id,
            start_time=datetime.now(),
        )

        try:
            import_results = self.import_files(batch_files)
            result.import_results = import_results
            result.files_processed = len(import_results)
            result.files_failed = sum(
                1 for r in import_results if r.errors
            )

            for import_result in import_results:
                result.errors.extend(import_result.errors)

            drop_configs = self.importer.get_all_records(DataSourceType.DROP_CONFIG)
            player_logs = self.importer.get_all_records(DataSourceType.PLAYER_LOG)
            item_pools = self.importer.get_all_records(DataSourceType.ITEM_POOL)
            activity_periods = self.importer.get_all_records(DataSourceType.ACTIVITY_PERIOD)
            complaint_records = self.importer.get_all_records(DataSourceType.COMPLAINT_RECORD)
            data_sources = self.importer.get_import_history()

            if not player_logs:
                raise DataImportError(
                    "没有有效的玩家日志数据，请检查文件导入是否成功",
                    location=create_error_location(
                        extra_info={"batch_files": [f.file_path for f in batch_files]}
                    )
                )

            if not drop_configs:
                raise DataImportError(
                    "没有有效的掉落配置数据，请检查文件导入是否成功",
                    location=create_error_location()
                )

            result.cleaning_result = self.cleaner.clean_data(
                player_logs=player_logs,
                drop_configs=drop_configs,
                activity_periods=activity_periods,
                item_pools=item_pools,
                params=params,
            )
            result.errors.extend(result.cleaning_result.errors)

            result.test_result = self.tester.run_test(
                player_logs=result.cleaning_result.cleaned_logs,
                drop_configs=result.cleaning_result.cleaned_configs,
                params=params,
            )
            result.errors.extend(result.test_result.errors)

            pool_names = {p.pool_id: p.pool_name for p in item_pools}
            result.comparison_result = self.comparator.compare(
                drop_configs=result.cleaning_result.cleaned_configs,
                test_result=result.test_result,
                activity_periods=activity_periods,
                data_sources=data_sources,
                pool_names=pool_names,
            )

            result.anomaly_report = self.detector.detect_all(
                player_logs=result.cleaning_result.cleaned_logs,
                drop_configs=result.cleaning_result.cleaned_configs,
                activity_periods=activity_periods,
                complaint_records=complaint_records,
                cleaning_result=result.cleaning_result,
                test_result=result.test_result,
                params=params,
                data_sources=data_sources,
            )

            if export_config is not None:
                result.exported_files = self.exporter.export(
                    comparison_result=result.comparison_result,
                    test_result=result.test_result,
                    cleaning_result=result.cleaning_result,
                    anomaly_report=result.anomaly_report,
                    data_sources=data_sources,
                    export_config=export_config,
                )

            result.success = True

        except DropCalibrationError as e:
            result.errors.append(e)
            if self.fail_fast:
                raise
        except Exception as e:
            error = DropCalibrationError(
                f"批量处理失败: {str(e)}"
            )
            result.errors.append(error)
            if self.fail_fast:
                raise error

        result.end_time = datetime.now()
        return result

    def import_files(
        self,
        batch_files: List[BatchFile],
    ) -> List[ImportResult]:
        """
        批量导入文件
        """
        results: List[ImportResult] = []

        for batch_file in batch_files:
            try:
                result = self.importer.import_file(
                    file_path=batch_file.file_path,
                    source_type=batch_file.source_type,
                    sheet_name=batch_file.sheet_name,
                    version=batch_file.version,
                    import_notes=batch_file.import_notes,
                    activate=batch_file.activate,
                )
                results.append(result)
            except DropCalibrationError as e:
                if self.fail_fast:
                    raise
                results.append(
                    ImportResult(
                        data_source=DataSource(
                            source_type=batch_file.source_type,
                            file_path=batch_file.file_path,
                            file_name=os.path.basename(batch_file.file_path),
                            sheet_name=batch_file.sheet_name,
                            version=batch_file.version,
                            import_notes=batch_file.import_notes,
                            is_active=False,
                        ),
                        records=[],
                        errors=[e],
                        skipped_rows=[],
                    )
                )
            except Exception as e:
                error = DataImportError(
                    f"导入文件失败: {str(e)}",
                    location=create_error_location(
                        file_path=batch_file.file_path,
                        sheet_name=batch_file.sheet_name,
                    )
                )
                if self.fail_fast:
                    raise error
                results.append(
                    ImportResult(
                        data_source=DataSource(
                            source_type=batch_file.source_type,
                            file_path=batch_file.file_path,
                            file_name=os.path.basename(batch_file.file_path),
                            sheet_name=batch_file.sheet_name,
                            version=batch_file.version,
                            import_notes=batch_file.import_notes,
                            is_active=False,
                        ),
                        records=[],
                        errors=[error],
                        skipped_rows=[],
                    )
                )

        return results

    def scan_directory(
        self,
        directory: str,
        file_patterns: Optional[Dict[DataSourceType, str]] = None,
    ) -> List[BatchFile]:
        """
        扫描目录自动发现文件
        """
        if file_patterns is None:
            file_patterns = {
                DataSourceType.DROP_CONFIG: "*config*",
                DataSourceType.PLAYER_LOG: "*log*",
                DataSourceType.ITEM_POOL: "*pool*",
                DataSourceType.ACTIVITY_PERIOD: "*activity*",
                DataSourceType.COMPLAINT_RECORD: "*complaint*",
            }

        batch_files: List[BatchFile] = []

        for source_type, pattern in file_patterns.items():
            search_path = os.path.join(directory, pattern)
            for file_path in glob.glob(search_path):
                if os.path.isfile(file_path):
                    ext = os.path.splitext(file_path)[1].lower()
                    if ext in [".csv", ".xlsx", ".xls", ".json", ".yaml", ".yml"]:
                        batch_files.append(
                            BatchFile(
                                file_path=file_path,
                                source_type=source_type,
                                version="auto",
                                import_notes=f"自动扫描于 {datetime.now().isoformat()}",
                            )
                        )

        return batch_files

    def run_with_params_file(
        self,
        batch_files: List[BatchFile],
        params_file: str,
        export_config: Optional[ExportConfig] = None,
    ) -> BatchResult:
        """
        使用参数文件运行校准
        """
        params = self.exporter.load_params(params_file)
        if params is None:
            raise DropCalibrationError(
                f"无法加载参数文件: {params_file}",
                location=create_error_location(file_path=params_file)
            )

        return self.run_full_pipeline(batch_files, params, export_config)

    def repeat_run(
        self,
        previous_result: BatchResult,
        new_params: Optional[CalibrationParams] = None,
    ) -> BatchResult:
        """
        重复运行之前的校准
        使用相同的数据源和（可选的）新参数
        """
        if new_params is None and previous_result.test_result is not None:
            new_params = previous_result.test_result.params

        if new_params is None:
            raise DropCalibrationError(
                "无法重复运行：没有可用的参数",
                location=create_error_location()
            )

        batch_files: List[BatchFile] = []
        for import_result in previous_result.import_results:
            ds = import_result.data_source
            batch_files.append(
                BatchFile(
                    file_path=ds.file_path,
                    source_type=ds.source_type,
                    sheet_name=ds.sheet_name,
                    version=ds.version,
                    import_notes=ds.import_notes,
                    activate=ds.is_active,
                )
            )

        new_importer = DataImporter(fail_fast=self.fail_fast)
        self.importer = new_importer

        output_dir = (
            os.path.dirname(list(previous_result.exported_files.values())[0])
            if previous_result.exported_files
            else "./reports"
        )
        return self.run_full_pipeline(
            batch_files=batch_files,
            params=new_params,
            export_config=ExportConfig(
                output_dir=output_dir,
                report_name=f"repeat_{previous_result.batch_id}",
            ),
        )

    def export_batch_summary(
        self,
        batch_results: List[BatchResult],
        output_path: str,
    ) -> str:
        """
        导出多个批次的汇总报告
        """
        rows = []
        for result in batch_results:
            summary = result.comparison_result.overall_summary if result.comparison_result else {}
            rows.append({
                "batch_id": result.batch_id,
                "start_time": result.start_time.isoformat(),
                "end_time": result.end_time.isoformat() if result.end_time else None,
                "success": result.success,
                "files_processed": result.files_processed,
                "files_failed": result.files_failed,
                "error_count": len(result.errors),
                "total_pools": summary.get("total_pools", 0),
                "total_items": summary.get("total_items", 0),
                "total_attempts": summary.get("total_attempts", 0),
                "critical_items": summary.get("critical_items", 0),
                "warning_items": summary.get("warning_items", 0),
                "significant_items": summary.get("significant_items", 0),
                "average_abs_deviation_percent": summary.get("average_abs_deviation_percent", 0),
                "filter_hash": result.test_result.filter_hash if result.test_result else None,
                "exported_files": safe_json_dumps(result.exported_files, ensure_ascii=False),
            })

        df = pd.DataFrame(rows)
        os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
        df.to_excel(output_path, index=False)

        return output_path


def scan_directory(
    directory: str,
    file_patterns: Optional[Dict[DataSourceType, str]] = None,
) -> List[BatchFile]:
    """
    扫描目录自动发现文件 - 模块级函数

    根据文件名模式自动识别数据类型，创建BatchFile列表。
    支持的文件类型：csv, xlsx, xls, json, yaml, yml

    Args:
        directory: 要扫描的目录路径
        file_patterns: 自定义文件模式映射，key为DataSourceType，value为glob模式
                       默认：config -> 配置文件, log -> 日志, pool -> 道具池,
                             activity -> 活动, complaint -> 投诉

    Returns:
        BatchFile列表

    示例:
        >>> files = scan_directory("./data")
        >>> for f in files:
        ...     print(f"{f.source_type}: {f.file_path}")
    """
    if file_patterns is None:
        file_patterns = {
            DataSourceType.DROP_CONFIG: "*config*",
            DataSourceType.PLAYER_LOG: "*log*",
            DataSourceType.ITEM_POOL: "*pool*",
            DataSourceType.ACTIVITY_PERIOD: "*activity*",
            DataSourceType.COMPLAINT_RECORD: "*complaint*",
        }

    batch_files: List[BatchFile] = []

    for source_type, pattern in file_patterns.items():
        search_path = os.path.join(directory, pattern)
        for file_path in glob.glob(search_path):
            if os.path.isfile(file_path):
                ext = os.path.splitext(file_path)[1].lower()
                if ext in [".csv", ".xlsx", ".xls", ".json", ".yaml", ".yml"]:
                    batch_files.append(
                        BatchFile(
                            file_path=file_path,
                            source_type=source_type,
                            version="auto",
                            import_notes=f"自动扫描于 {datetime.now().isoformat()}",
                        )
                    )

    return batch_files
