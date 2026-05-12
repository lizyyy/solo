"""数据导出模块 - 支持 Excel、JSON 导出"""

from dataclasses import dataclass
from pathlib import Path
from typing import Dict, Any, Optional, List
from datetime import datetime
import json
import numpy as np
import pandas as pd


def _safe_json(obj: Any) -> Any:
    """numpy 类型安全的 JSON 序列化"""
    if isinstance(obj, (np.integer,)):
        return int(obj)
    elif isinstance(obj, (np.floating,)):
        return float(obj)
    elif isinstance(obj, np.ndarray):
        return obj.tolist()
    elif isinstance(obj, dict):
        return {k: _safe_json(v) for k, v in obj.items()}
    elif isinstance(obj, (list, tuple)):
        return [_safe_json(x) for x in obj]
    else:
        return obj


def _safe_json_dumps(data: Any, **kwargs) -> str:
    """numpy 类型安全的 json.dumps"""
    return json.dumps(_safe_json(data), **kwargs)


@dataclass
class ExportResult:
    """导出结果"""
    file_path: str
    success: bool
    message: str
    file_size_kb: float = 0


class Exporter:
    """导出器"""

    def export_to_excel(
        self,
        output_path: str,
        qc_result,
        load_result=None,
        preprocess_result=None,
    ) -> ExportResult:
        """导出到 Excel (多工作表)"""
        try:
            path = Path(output_path)
            path.parent.mkdir(parents=True, exist_ok=True)

            with pd.ExcelWriter(path, engine="openpyxl") as writer:
                self._write_summary_sheet(writer, qc_result)
                self._write_valid_samples_sheet(writer, qc_result)
                self._write_invalid_samples_sheet(writer, qc_result)
                self._write_failures_sheet(writer, qc_result)
                self._write_config_sheet(writer, qc_result)

                if load_result:
                    self._write_load_issues_sheet(writer, load_result)
                if preprocess_result:
                    self._write_preprocess_sheet(writer, preprocess_result)

            size_kb = path.stat().st_size / 1024

            return ExportResult(
                file_path=str(path),
                success=True,
                message=f"Excel 报告已导出: {path}",
                file_size_kb=size_kb,
            )

        except Exception as e:
            return ExportResult(
                file_path=output_path,
                success=False,
                message=f"Excel 导出失败: {str(e)}",
            )

    def export_to_json(
        self,
        output_path: str,
        qc_result,
        load_result=None,
        preprocess_result=None,
    ) -> ExportResult:
        """导出到 JSON (完整数据，可复算)"""
        try:
            path = Path(output_path)
            path.parent.mkdir(parents=True, exist_ok=True)

            data = {
                "export_time": datetime.now().isoformat(),
                "version": "1.0.0",
                "qc_summary": qc_result.to_summary_dict(),
                "qc_checks": [
                    {
                        "rule_name": c.rule_name,
                        "sample_type": c.sample_type,
                        "parameter": c.parameter,
                        "passed": c.passed,
                        "failure_count": len(c.failures),
                        "calculation_log": c.calculation_log,
                    }
                    for c in qc_result.checks
                ],
                "failures": [f.to_dict() for f in qc_result.failures],
                "statistics": qc_result.statistics,
                "config_used": qc_result.config_used,
                "valid_samples": self._df_to_records(qc_result.valid_samples),
                "invalid_samples": self._df_to_records(qc_result.invalid_samples),
                "execution_time_seconds": qc_result.execution_time,
            }

            if load_result:
                data["load_result"] = {
                    "success": load_result.success,
                    "file_path": load_result.file_path,
                    "file_type": load_result.file_type,
                    "row_count": load_result.row_count,
                    "column_count": load_result.column_count,
                    "issues": [
                        {
                            "type": i.type,
                            "message": i.message,
                            "location": i.location,
                            "details": i.details,
                        }
                        for i in load_result.issues
                    ],
                }

            if preprocess_result:
                data["preprocess_result"] = preprocess_result.to_summary()
                data["preprocess_issues"] = [
                    {
                        "type": i.type,
                        "severity": i.severity,
                        "message": i.message,
                        "affected_rows": i.affected_rows,
                        "affected_columns": i.affected_columns,
                        "details": i.details,
                    }
                    for i in preprocess_result.issues
                ]
                data["preprocess_actions"] = preprocess_result.actions

            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2, default=str)

            size_kb = path.stat().st_size / 1024

            return ExportResult(
                file_path=str(path),
                success=True,
                message=f"JSON 数据已导出: {path}",
                file_size_kb=size_kb,
            )

        except Exception as e:
            return ExportResult(
                file_path=output_path,
                success=False,
                message=f"JSON 导出失败: {str(e)}",
            )

    def export_to_csv(
        self,
        output_path: str,
        qc_result,
        data_type: str = "valid",
    ) -> ExportResult:
        """导出 CSV"""
        try:
            path = Path(output_path)
            path.parent.mkdir(parents=True, exist_ok=True)

            if data_type == "valid":
                df = qc_result.valid_samples
            elif data_type == "invalid":
                df = qc_result.invalid_samples
            elif data_type == "failures":
                df = pd.DataFrame([f.to_dict() for f in qc_result.failures])
            else:
                return ExportResult(
                    file_path=output_path,
                    success=False,
                    message=f"未知的数据类型: {data_type}",
                )

            if df.empty:
                df.to_csv(path, index=False, encoding="utf-8-sig")
            else:
                df.to_csv(path, index=False, encoding="utf-8-sig")

            size_kb = path.stat().st_size / 1024

            return ExportResult(
                file_path=str(path),
                success=True,
                message=f"CSV 已导出: {path}",
                file_size_kb=size_kb,
            )

        except Exception as e:
            return ExportResult(
                file_path=output_path,
                success=False,
                message=f"CSV 导出失败: {str(e)}",
            )

    def _write_summary_sheet(self, writer, qc_result):
        """摘要工作表"""
        summary = qc_result.to_summary_dict()

        rows = []
        rows.append(["质控摘要", ""])
        rows.append(["全部通过", "是" if summary["all_passed"] else "否"])
        rows.append(["总检查数", summary["total_checks"]])
        rows.append(["通过检查数", summary["passed_checks"]])
        rows.append(["失败检查数", summary["failed_checks"]])
        rows.append(["总失败样本数", summary["total_failures"]])
        rows.append(["", ""])
        rows.append(["执行耗时(秒)", round(qc_result.execution_time, 4)])
        rows.append(["", ""])
        rows.append(["失败类型分布", ""])
        for ftype, count in summary["failures_by_type"].items():
            rows.append([ftype, count])

        df = pd.DataFrame(rows, columns=["项目", "值"])
        df.to_excel(writer, sheet_name="摘要", index=False, header=False)

        if "check_details" in summary["qc_summary"]:
            check_rows = [["检查名称", "样品类型", "是否通过", "失败数量"]]
            for c in summary["qc_summary"]["check_details"]:
                check_rows.append([
                    c["rule_name"],
                    c["sample_type"],
                    "是" if c["passed"] else "否",
                    c["failure_count"],
                ])
            df_checks = pd.DataFrame(check_rows[1:], columns=check_rows[0])
            df_checks.to_excel(writer, sheet_name="质控检查", index=False)

    def _write_valid_samples_sheet(self, writer, qc_result):
        """有效样本工作表"""
        if not qc_result.valid_samples.empty:
            qc_result.valid_samples.to_excel(writer, sheet_name="有效样本", index=False)
        else:
            pd.DataFrame({"提示": ["无有效样本数据"]}).to_excel(
                writer, sheet_name="有效样本", index=False
            )

    def _write_invalid_samples_sheet(self, writer, qc_result):
        """无效样本工作表"""
        if not qc_result.invalid_samples.empty:
            qc_result.invalid_samples.to_excel(writer, sheet_name="无效样本", index=False)
        else:
            pd.DataFrame({"提示": ["无无效样本数据"]}).to_excel(
                writer, sheet_name="无效样本", index=False
            )

    def _write_failures_sheet(self, writer, qc_result):
        """失败样本详情工作表"""
        if qc_result.failures:
            failures_data = []
            for f in qc_result.failures:
                failures_data.append({
                    "样本编号": f.sample_id,
                    "检测项目": f.parameter,
                    "样品类型": f.sample_type,
                    "失败类型": f.failure_type,
                    "规则名称": f.rule_name,
                    "消息": f.message,
                    "检测值": f.value,
                    "计算值": f.calculated_value,
                    "阈值": f.threshold,
                    "期望范围": str(f.expected_range) if f.expected_range else "",
                    "影响行号": str(f.affected_indices),
                    "时间": f.timestamp,
                    "原始数据": _safe_json_dumps(f.raw_data, ensure_ascii=False),
                })
            df = pd.DataFrame(failures_data)
            df.to_excel(writer, sheet_name="失败详情", index=False)
        else:
            pd.DataFrame({"提示": ["无失败样本"]}).to_excel(
                writer, sheet_name="失败详情", index=False
            )

    def _write_config_sheet(self, writer, qc_result):
        """配置工作表"""
        config = qc_result.config_used
        rows = []
        for key, value in config.items():
            if isinstance(value, (dict, list)):
                value_str = _safe_json_dumps(value, ensure_ascii=False, indent=2)
            else:
                value_str = str(value)
            rows.append([key, value_str])
        df = pd.DataFrame(rows, columns=["配置项", "值"])
        df.to_excel(writer, sheet_name="配置(可复算)", index=False)

    def _write_load_issues_sheet(self, writer, load_result):
        """加载问题工作表"""
        if load_result.issues:
            data = []
            for issue in load_result.issues:
                data.append({
                    "类型": issue.type,
                    "消息": issue.message,
                    "位置": issue.location,
                    "详情": _safe_json_dumps(issue.details, ensure_ascii=False) if issue.details else "",
                })
            df = pd.DataFrame(data)
            df.to_excel(writer, sheet_name="加载问题", index=False)

    def _write_preprocess_sheet(self, writer, preprocess_result):
        """预处理工作表"""
        summary = preprocess_result.to_summary()
        rows = []
        rows.append(["预处理摘要", ""])
        for key, value in summary.items():
            if isinstance(value, dict):
                rows.append([key, _safe_json_dumps(value, ensure_ascii=False)])
            else:
                rows.append([key, value])
        df_summary = pd.DataFrame(rows, columns=["项目", "值"])
        df_summary.to_excel(writer, sheet_name="预处理摘要", index=False, header=False)

        if preprocess_result.issues:
            data = []
            for issue in preprocess_result.issues:
                data.append({
                    "类型": issue.type,
                    "严重程度": issue.severity,
                    "消息": issue.message,
                    "影响行": str(issue.affected_rows),
                    "影响列": str(issue.affected_columns),
                    "详情": _safe_json_dumps(issue.details, ensure_ascii=False) if issue.details else "",
                })
            df = pd.DataFrame(data)
            df.to_excel(writer, sheet_name="预处理问题", index=False)

        if preprocess_result.actions:
            data = []
            for action in preprocess_result.actions:
                data.append({k: str(v) for k, v in action.items()})
            df = pd.DataFrame(data)
            df.to_excel(writer, sheet_name="预处理操作", index=False)

    def _df_to_records(self, df: pd.DataFrame) -> list:
        """DataFrame 转可序列化记录"""
        if df.empty:
            return []
        return json.loads(df.to_json(orient="records", date_format="iso"))
