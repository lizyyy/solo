#!/usr/bin/env python3
# -*- coding: utf-8 -*-

from typing import Optional, Dict, Any
from datetime import datetime


class FairnessError(Exception):
    def __init__(
        self,
        user_message: str,
        error_type: str = "general_error",
        suggestion: Optional[str] = None,
        responsible_person: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        self.user_message = user_message
        self.error_type = error_type
        self.suggestion = suggestion
        self.responsible_person = responsible_person
        self.details = details or {}
        self.timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        super().__init__(self.user_message)

    def to_dict(self) -> Dict[str, Any]:
        return {
            "error_type": self.error_type,
            "user_message": self.user_message,
            "suggestion": self.suggestion,
            "responsible_person": self.responsible_person,
            "details": self.details,
            "timestamp": self.timestamp
        }

    def __str__(self) -> str:
        msg = f"[{self.timestamp}] {self.user_message}"
        if self.suggestion:
            msg += f"\n💡 建议: {self.suggestion}"
        if self.responsible_person:
            msg += f"\n👤 对接人: {self.responsible_person}"
        return msg


class DataImportError(FairnessError):
    def __init__(
        self,
        user_message: str,
        suggestion: Optional[str] = None,
        responsible_person: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        super().__init__(
            user_message=user_message,
            error_type="data_import_error",
            suggestion=suggestion,
            responsible_person=responsible_person,
            details=details
        )


class UnitMismatchError(FairnessError):
    def __init__(
        self,
        column_name: str,
        found_unit: str,
        expected_unit: str,
        source_type: str,
        suggestion: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        source_text = "实验数据采集" if source_type == "experiment_data" else "约束条件说明"
        responsible = "数据采集组 (小李)" if source_type == "experiment_data" else "规则制定组 (王教练)"
        
        user_message = (
            f"在列 '{column_name}' 中发现单位不匹配：\n"
            f"  当前使用: {found_unit}\n"
            f"  标准单位: {expected_unit}\n"
            f"  数据来源: {source_text}"
        )
        
        full_suggestion = suggestion or (
            f"请确认是统一单位后重新导入，还是在修正环节进行单位换算"
        )
        
        super().__init__(
            user_message=user_message,
            error_type="unit_mismatch_error",
            suggestion=full_suggestion,
            responsible_person=responsible,
            details={
                "column_name": column_name,
                "found_unit": found_unit,
                "expected_unit": expected_unit,
                "source_type": source_type,
                **(details or {})
            }
        )


class ParameterValidationError(FairnessError):
    def __init__(
        self,
        param_name: str,
        param_value: Any,
        constraint_desc: str,
        suggestion: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        user_message = (
            f"参数 '{param_name}' 的值 '{param_value}' 不符合要求\n"
            f"  约束条件: {constraint_desc}"
        )
        
        super().__init__(
            user_message=user_message,
            error_type="parameter_validation_error",
            suggestion=suggestion or "请检查参数取值后重试",
            responsible_person="主教练 (张指导)",
            details={
                "param_name": param_name,
                "param_value": param_value,
                "constraint_desc": constraint_desc,
                **(details or {})
            }
        )


class MissingColumnError(FairnessError):
    def __init__(
        self,
        missing_columns: list,
        file_name: str,
        suggestion: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        cols_str = "', '".join(missing_columns)
        user_message = (
            f"文件 '{file_name}' 中缺少必要的列：\n"
            f"  缺失列: '{cols_str}'"
        )
        
        super().__init__(
            user_message=user_message,
            error_type="missing_column_error",
            suggestion=suggestion or "请补充缺失数据后重新导入",
            responsible_person="数据采集组 (小李)",
            details={
                "missing_columns": missing_columns,
                "file_name": file_name,
                **(details or {})
            }
        )


class FileFormatError(FairnessError):
    def __init__(
        self,
        file_name: str,
        file_ext: str,
        allowed_exts: list,
        suggestion: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        exts_str = "、".join(allowed_exts)
        user_message = (
            f"文件 '{file_name}' 格式不支持\n"
            f"  当前格式: {file_ext}\n"
            f"  支持格式: {exts_str}"
        )
        
        super().__init__(
            user_message=user_message,
            error_type="file_format_error",
            suggestion=suggestion or "请将文件另存为支持的格式后重试",
            responsible_person="数据采集组 (小李)",
            details={
                "file_name": file_name,
                "file_ext": file_ext,
                "allowed_exts": allowed_exts,
                **(details or {})
            }
        )


class EmptyDataError(FairnessError):
    def __init__(
        self,
        file_name: str,
        sheet_name: Optional[str] = None,
        suggestion: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        location = f"工作表 '{sheet_name}'" if sheet_name else "文件"
        user_message = f"{location} '{file_name}' 中没有找到有效数据"
        
        super().__init__(
            user_message=user_message,
            error_type="empty_data_error",
            suggestion=suggestion or "请检查数据是否被正确填写，确认后重新导入",
            responsible_person="数据采集组 (小李)",
            details={
                "file_name": file_name,
                "sheet_name": sheet_name,
                **(details or {})
            }
        )


def format_error_for_display(error: FairnessError) -> Dict[str, str]:
    return {
        "icon": "❌",
        "title": _get_error_title(error.error_type),
        "message": error.user_message,
        "suggestion": error.suggestion or "",
        "responsible": error.responsible_person or "",
        "timestamp": error.timestamp
    }


def _get_error_title(error_type: str) -> str:
    titles = {
        "data_import_error": "数据导入失败",
        "unit_mismatch_error": "单位不匹配提醒",
        "parameter_validation_error": "参数设置有误",
        "missing_column_error": "数据列缺失",
        "file_format_error": "文件格式不对",
        "empty_data_error": "数据为空"
    }
    return titles.get(error_type, "发生错误")
