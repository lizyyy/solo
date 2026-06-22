"""输入解析器 - 处理缺字段、旧说法、空集合"""

import json
import os
from typing import List, Tuple

from .models import (
    CaseRecord,
    CaseStatus,
    Variable,
    EvidenceStatus,
    AnomalyRecord,
    AnomalyType,
    SeverityLevel,
)
from .formulas import resolve_formula_name


REQUIRED_VARIABLE_FIELDS = ["name", "symbol", "value", "uncertainty", "unit"]
REQUIRED_CASE_FIELDS = ["case_id", "formula", "variables"]


class ParseResult:
    """单个文件的解析结果"""
    def __init__(self):
        self.case: CaseRecord = None
        self.anomalies: List[AnomalyRecord] = []
        self.success: bool = False
        self.error_message: str = None


class CaseParser:
    """题目解析器"""

    def parse_directory(self, input_dir: str) -> Tuple[List[CaseRecord], List[AnomalyRecord], int]:
        """解析输入目录下的所有 JSON 文件

        Returns:
            (cases, anomalies, total_files)
        """
        cases: List[CaseRecord] = []
        all_anomalies: List[AnomalyRecord] = []
        total_files = 0

        if not os.path.isdir(input_dir):
            return cases, all_anomalies, total_files

        json_files = sorted(
            f for f in os.listdir(input_dir)
            if f.endswith(".json")
        )
        total_files = len(json_files)

        if total_files == 0:
            all_anomalies.append(AnomalyRecord(
                anomaly_type=AnomalyType.EMPTY_INPUT,
                severity=SeverityLevel.CRITICAL,
                message=f"输入目录 {input_dir} 中没有找到 JSON 文件",
                resolution_hint="请在输入目录中放置至少一个 .json 格式的题目文件",
            ))
            return cases, all_anomalies, total_files

        for filename in json_files:
            filepath = os.path.join(input_dir, filename)
            result = self.parse_file(filepath, filename)
            all_anomalies.extend(result.anomalies)
            if result.case:
                cases.append(result.case)

        return cases, all_anomalies, total_files

    def parse_file(self, filepath: str, filename: str) -> ParseResult:
        """解析单个 JSON 文件"""
        result = ParseResult()

        try:
            with open(filepath, "r", encoding="utf-8") as f:
                raw = json.load(f)
        except json.JSONDecodeError as e:
            result.error_message = f"JSON 格式错误: {e}"
            result.anomalies.append(AnomalyRecord(
                anomaly_type=AnomalyType.PARSE_ERROR,
                severity=SeverityLevel.ERROR,
                message=f"文件 {filename} JSON 解析失败: {e}",
                file_name=filename,
                resolution_hint="请检查文件是否为合法的 JSON 格式",
            ))
            result.case = self._make_failed_case(
                filename, filepath, "JSON_ERROR",
                f"JSON 格式错误: {e}", raw_dict=None,
            )
            return result
        except Exception as e:
            result.error_message = f"文件读取失败: {e}"
            result.anomalies.append(AnomalyRecord(
                anomaly_type=AnomalyType.PARSE_ERROR,
                severity=SeverityLevel.ERROR,
                message=f"文件 {filename} 读取失败: {e}",
                file_name=filename,
            ))
            result.case = self._make_failed_case(
                filename, filepath, "READ_ERROR",
                f"文件读取失败: {e}", raw_dict=None,
            )
            return result

        for field_name in REQUIRED_CASE_FIELDS:
            if field_name not in raw:
                result.anomalies.append(AnomalyRecord(
                    anomaly_type=AnomalyType.MISSING_FIELD,
                    severity=SeverityLevel.ERROR,
                    message=f"文件 {filename} 缺少必需字段: '{field_name}'",
                    file_name=filename,
                    details={"missing_field": field_name},
                    resolution_hint=f"请在文件中添加 '{field_name}' 字段",
                ))
                result.error_message = f"缺少必需字段: {field_name}"
                result.case = self._make_failed_case(
                    filename, filepath, raw.get("case_id", "UNKNOWN"),
                    f"缺少必需字段: {field_name}", raw_dict=raw,
                )
                return result

        case_id = raw["case_id"]
        raw_formula = raw["formula"]
        title = raw.get("title", case_id)
        description = raw.get("description", "")

        found, resolved_name, is_alias = resolve_formula_name(raw_formula)

        if not found:
            result.anomalies.append(AnomalyRecord(
                anomaly_type=AnomalyType.UNKNOWN_FORMULA,
                severity=SeverityLevel.ERROR,
                message=f"文件 {filename} (题目 {case_id}) 使用了未知公式名称: '{raw_formula}'",
                case_id=case_id,
                file_name=filename,
                details={"raw_formula": raw_formula},
                resolution_hint="请检查公式名称是否正确，或查看可用公式列表",
            ))
            result.error_message = f"未知公式名称: {raw_formula}"
            result.case = self._make_failed_case(
                filename, filepath, case_id,
                f"未知公式名称: {raw_formula}", raw_dict=raw,
                formula_name=raw_formula,
            )
            return result

        variables = raw.get("variables", [])

        if not isinstance(variables, list) or len(variables) == 0:
            result.anomalies.append(AnomalyRecord(
                anomaly_type=AnomalyType.EMPTY_INPUT,
                severity=SeverityLevel.ERROR,
                message=f"文件 {filename} (题目 {case_id}) 的变量列表为空，无法计算",
                case_id=case_id,
                file_name=filename,
                resolution_hint="空集合不能作为正常输入，请至少提供一个测量变量",
            ))
            result.error_message = "变量列表为空"
            result.case = self._make_failed_case(
                filename, filepath, case_id,
                "变量列表为空", raw_dict=raw,
                formula_name=raw_formula, resolved_name=resolved_name,
            )
            return result

        parsed_vars: List[Variable] = []
        var_errors = []

        for idx, vraw in enumerate(variables):
            v_err = self._validate_variable(vraw, idx, filename)
            if v_err:
                var_errors.append(v_err)
                result.anomalies.append(v_err)
                continue

            try:
                ev_status = EvidenceStatus(vraw.get("evidence_status", "confirmed"))
            except ValueError:
                ev_status = EvidenceStatus.CONFIRMED

            var = Variable(
                name=vraw["name"],
                symbol=vraw["symbol"],
                value=float(vraw["value"]),
                uncertainty=float(vraw["uncertainty"]),
                unit=vraw["unit"],
                evidence_source=vraw.get("evidence_source"),
                evidence_status=ev_status,
                evidence_notes=vraw.get("evidence_notes"),
            )
            parsed_vars.append(var)

        if var_errors:
            result.error_message = f"变量解析错误: {len(var_errors)} 个字段缺失或无效"
            result.case = self._make_failed_case(
                filename, filepath, case_id,
                result.error_message, raw_dict=raw,
                formula_name=raw_formula, resolved_name=resolved_name,
                partial_vars=parsed_vars,
            )
            return result

        case = CaseRecord(
            case_id=case_id,
            title=title,
            formula_name=raw_formula,
            formula_name_resolved=resolved_name,
            description=description,
            variables=parsed_vars,
            file_name=filename,
            file_path=filepath,
            raw_formula_name=raw_formula,
        )

        if is_alias:
            case.warnings.append(
                f"公式名称 '{raw_formula}' 为旧说法，已自动映射为 '{resolved_name}'"
            )

        formula_def = None
        from .formulas import get_formula
        formula_def = get_formula(raw_formula)
        if formula_def:
            var_symbols = {v.symbol for v in parsed_vars}
            missing = set(formula_def.required_vars) - var_symbols
            if missing:
                result.anomalies.append(AnomalyRecord(
                    anomaly_type=AnomalyType.MISSING_FIELD,
                    severity=SeverityLevel.ERROR,
                    message=f"题目 {case_id} 缺少公式所需的变量: {', '.join(missing)}",
                    case_id=case_id,
                    file_name=filename,
                    details={"required": formula_def.required_vars, "provided": list(var_symbols)},
                    resolution_hint=f"公式 '{resolved_name}' 需要变量: {', '.join(formula_def.required_vars)}",
                ))
                result.error_message = f"缺少所需变量: {missing}"
                case.status = CaseStatus.FAILED
                case.error_message = result.error_message
                return result

        result.case = case
        result.success = True
        return result

    def _validate_variable(self, vraw: dict, idx: int, filename: str) -> AnomalyRecord:
        """验证单个变量字段"""
        for field in REQUIRED_VARIABLE_FIELDS:
            if field not in vraw:
                return AnomalyRecord(
                    anomaly_type=AnomalyType.MISSING_FIELD,
                    severity=SeverityLevel.ERROR,
                    message=f"文件 {filename} 第 {idx + 1} 个变量缺少字段: '{field}'",
                    file_name=filename,
                    details={"variable_index": idx, "missing_field": field},
                    resolution_hint=f"请为该变量添加 '{field}' 字段",
                )

        try:
            float(vraw["value"])
        except (ValueError, TypeError):
            return AnomalyRecord(
                anomaly_type=AnomalyType.MISSING_FIELD,
                severity=SeverityLevel.ERROR,
                message=f"文件 {filename} 第 {idx + 1} 个变量的 value 不是有效数字: {vraw['value']}",
                file_name=filename,
            )

        try:
            u = float(vraw["uncertainty"])
            if u < 0:
                return AnomalyRecord(
                    anomaly_type=AnomalyType.MISSING_FIELD,
                    severity=SeverityLevel.ERROR,
                    message=f"文件 {filename} 第 {idx + 1} 个变量的 uncertainty 不能为负数: {u}",
                    file_name=filename,
                )
        except (ValueError, TypeError):
            return AnomalyRecord(
                anomaly_type=AnomalyType.MISSING_FIELD,
                severity=SeverityLevel.ERROR,
                message=f"文件 {filename} 第 {idx + 1} 个变量的 uncertainty 不是有效数字: {vraw['uncertainty']}",
                file_name=filename,
            )

        return None

    def _make_failed_case(
        self,
        filename: str,
        filepath: str,
        case_id: str,
        error_message: str,
        raw_dict: dict = None,
        formula_name: str = "",
        resolved_name: str = None,
        partial_vars: List[Variable] = None,
    ) -> CaseRecord:
        """为解析失败的文件创建 CaseRecord"""
        title = case_id
        description = ""
        if raw_dict:
            title = raw_dict.get("title", case_id)
            description = raw_dict.get("description", "")
            if not formula_name:
                formula_name = raw_dict.get("formula", "")

        return CaseRecord(
            case_id=case_id,
            title=title,
            formula_name=formula_name,
            formula_name_resolved=resolved_name,
            description=description,
            variables=partial_vars or [],
            file_name=filename,
            file_path=filepath,
            raw_formula_name=formula_name,
            status=CaseStatus.FAILED,
            error_message=error_message,
        )
