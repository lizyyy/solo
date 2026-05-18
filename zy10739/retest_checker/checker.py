import pandas as pd
import re
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
from .config import get_config
from .reader import DataReader, FileType, ValidationError


class CoverageStatus(Enum):
    SUCCESS = "success"
    FAIL = "fail"
    PENDING = "pending"
    INSTRUMENT_FAIL = "instrument_fail"


@dataclass
class CoverageResult:
    sample_id: str
    test_item: str
    original_result: Optional[str]
    original_time: Optional[str]
    retest_time: Optional[str]
    retest_reason: Optional[str]
    instrument_status: Optional[str]
    coverage_check: str
    coverage_status: CoverageStatus
    notes: str
    failure_type: Optional[str] = None
    failure_detail: Optional[str] = None
    original_location: Optional[str] = None


class CoverageChecker:
    def __init__(self, config_dir: Optional[str] = None):
        self.config = get_config(config_dir)
        self.rules = self.config.rules
        self.reader = DataReader(config_dir)
        self.results: List[CoverageResult] = []
        self.errors: List[ValidationError] = []
        self.warnings: List[str] = []

    def process_directory(self, directory: str) -> Dict[str, Any]:
        read_results = self.reader.read_directory(directory)
        
        self.errors.extend(self.reader.errors)
        self.warnings.extend(self.reader.warnings)
        
        sample_results, sr_errors, sr_warnings = self.reader.merge_data(
            read_results[FileType.SAMPLE_RESULT]
        )
        retest_orders, ro_errors, ro_warnings = self.reader.merge_data(
            read_results[FileType.RETEST_ORDER]
        )
        instrument_logs, il_errors, il_warnings = self.reader.merge_data(
            read_results[FileType.INSTRUMENT_LOG]
        )
        
        self.errors.extend(sr_errors + ro_errors + il_errors)
        self.warnings.extend(sr_warnings + ro_warnings + il_warnings)
        
        if sample_results.empty and retest_orders.empty:
            self.warnings.append("没有找到有效的样本结果或重测单数据")
            return self._build_output()
        
        self._run_coverage_check(sample_results, retest_orders, instrument_logs)
        
        return self._build_output()

    def _run_coverage_check(
        self,
        sample_results: pd.DataFrame,
        retest_orders: pd.DataFrame,
        instrument_logs: pd.DataFrame
    ):
        sample_id_col = self.config.get_match_field("sample_id", list(sample_results.columns) if not sample_results.empty else [])
        test_item_col = self.config.get_match_field("test_item", list(sample_results.columns) if not sample_results.empty else [])
        retest_reason_col = self.config.get_match_field("retest_reason", list(retest_orders.columns) if not retest_orders.empty else [])
        
        all_sample_items = set()
        
        if not sample_results.empty and sample_id_col and test_item_col:
            for _, row in sample_results.iterrows():
                sample_id = str(row.get(sample_id_col, ""))
                test_item = str(row.get(test_item_col, ""))
                if sample_id and test_item and sample_id != "nan" and test_item != "nan":
                    all_sample_items.add((sample_id, test_item))
        
        if not retest_orders.empty and sample_id_col and test_item_col:
            for _, row in retest_orders.iterrows():
                sample_id = str(row.get(sample_id_col, ""))
                test_item = str(row.get(test_item_col, ""))
                if sample_id and test_item and sample_id != "nan" and test_item != "nan":
                    all_sample_items.add((sample_id, test_item))
        
        for sample_id, test_item in sorted(all_sample_items):
            result = self._check_single_item(
                sample_id, test_item,
                sample_results, retest_orders, instrument_logs,
                sample_id_col, test_item_col, retest_reason_col
            )
            self.results.append(result)

    def _check_single_item(
        self,
        sample_id: str,
        test_item: str,
        sample_results: pd.DataFrame,
        retest_orders: pd.DataFrame,
        instrument_logs: pd.DataFrame,
        sample_id_col: Optional[str],
        test_item_col: Optional[str],
        retest_reason_col: Optional[str]
    ) -> CoverageResult:
        original_result = None
        original_time = None
        retest_time = None
        retest_reason = None
        instrument_status = "正常"
        notes = []
        failure_type = None
        failure_detail = None
        
        sample_row = None
        if not sample_results.empty and sample_id_col and test_item_col:
            matches = sample_results[
                (sample_results[sample_id_col].astype(str) == sample_id) &
                (sample_results[test_item_col].astype(str) == test_item)
            ]
            if not matches.empty:
                sample_row = matches.iloc[0]
                original_result = str(sample_row.get("结果值", ""))
                original_time = str(sample_row.get("检测时间", ""))
                
                if self.rules["coverage_rules"]["original_result_retain"]["enabled"]:
                    audit_status = str(sample_row.get("审核状态", ""))
                    if audit_status == "已审核":
                        notes.append("原结果已审核，需保留")
        
        retest_row = None
        if not retest_orders.empty and sample_id_col and test_item_col:
            matches = retest_orders[
                (retest_orders[sample_id_col].astype(str) == sample_id) &
                (retest_orders[test_item_col].astype(str) == test_item)
            ]
            if not matches.empty:
                retest_row = matches.iloc[0]
                retest_time = str(retest_row.get("申请时间", ""))
                if retest_reason_col:
                    retest_reason = str(retest_row.get(retest_reason_col, ""))
        
        instrument_fail = False
        if not instrument_logs.empty and sample_id_col and test_item_col:
            matches = instrument_logs[
                (instrument_logs[sample_id_col].astype(str) == sample_id) &
                (instrument_logs[test_item_col].astype(str) == test_item)
            ]
            if not matches.empty:
                log_row = matches.iloc[0]
                status = str(log_row.get("状态", ""))
                error_code = str(log_row.get("错误代码", ""))
                
                if self.rules["coverage_rules"]["instrument_failure"]["enabled"]:
                    if status == "失败" or (error_code and error_code != "nan"):
                        instrument_fail = True
                        instrument_status = "失败"
                        failure_type = "仪器失败"
                        failure_detail = f"错误代码: {error_code}, 状态: {status}"
                        notes.append("仪器检测失败，需人工确认")
        
        is_split_sample = False
        if self.rules["coverage_rules"]["sample_split"]["enabled"]:
            if re.search(r'-\d+$', sample_id):
                is_split_sample = True
                notes.append("拆分样本，独立对照")
        
        coverage_status = CoverageStatus.PENDING
        coverage_check = self.rules["output"]["pending_value"]
        
        if sample_row is not None and retest_row is not None:
            if instrument_fail:
                coverage_status = CoverageStatus.INSTRUMENT_FAIL
                coverage_check = self.rules["output"]["fail_value"]
            else:
                coverage_status = CoverageStatus.SUCCESS
                coverage_check = self.rules["output"]["success_value"]
        elif sample_row is not None and retest_row is None:
            coverage_status = CoverageStatus.FAIL
            coverage_check = self.rules["output"]["fail_value"]
            failure_type = "缺少重测申请"
            failure_detail = f"样本 {sample_id} 的 {test_item} 有结果但无重测申请"
        elif sample_row is None and retest_row is not None:
            coverage_status = CoverageStatus.FAIL
            coverage_check = self.rules["output"]["fail_value"]
            failure_type = "缺少原始结果"
            failure_detail = f"样本 {sample_id} 的 {test_item} 有重测申请但无原始结果"
        
        return CoverageResult(
            sample_id=sample_id,
            test_item=test_item,
            original_result=original_result if original_result != "nan" else None,
            original_time=original_time if original_time != "nan" else None,
            retest_time=retest_time if retest_time != "nan" else None,
            retest_reason=retest_reason if retest_reason != "nan" else None,
            instrument_status=instrument_status,
            coverage_check=coverage_check,
            coverage_status=coverage_status,
            notes="; ".join(notes) if notes else "",
            failure_type=failure_type,
            failure_detail=failure_detail,
            original_location=None
        )

    def _build_output(self) -> Dict[str, Any]:
        output_columns = self.rules["output"]["columns"]
        rows = []
        
        for result in self.results:
            row = {
                "样本编号": result.sample_id,
                "检测项目": result.test_item,
                "原始结果": result.original_result,
                "原始结果时间": result.original_time,
                "重测申请时间": result.retest_time,
                "重测原因": result.retest_reason,
                "仪器状态": result.instrument_status,
                "覆盖性检查": result.coverage_check,
                "覆盖结果": result.coverage_status.value,
                "备注": result.notes,
            }
            rows.append(row)
        
        df = pd.DataFrame(rows, columns=output_columns)
        
        failure_rows = []
        if self.rules["failure_visible"]["enabled"]:
            for result in self.results:
                if result.failure_type or result.coverage_status != CoverageStatus.SUCCESS:
                    failure_row = {
                        "样本编号": result.sample_id,
                        "检测项目": result.test_item,
                        "失败类型": result.failure_type or "覆盖异常",
                        "失败详情": result.failure_detail or "覆盖性检查未通过",
                        "原始数据位置": result.original_location or "",
                    }
                    failure_rows.append(failure_row)
        
        failures_df = pd.DataFrame(failure_rows, columns=self.rules["failure_visible"]["output_columns"])
        
        return {
            "coverage_table": df,
            "failures_table": failures_df,
            "errors": self.errors,
            "warnings": self.warnings,
            "summary": {
                "total": len(self.results),
                "success": len([r for r in self.results if r.coverage_status == CoverageStatus.SUCCESS]),
                "fail": len([r for r in self.results if r.coverage_status == CoverageStatus.FAIL]),
                "instrument_fail": len([r for r in self.results if r.coverage_status == CoverageStatus.INSTRUMENT_FAIL]),
                "pending": len([r for r in self.results if r.coverage_status == CoverageStatus.PENDING]),
            }
        }
