from typing import Dict, Any, List, Optional, Tuple
import pandas as pd

from .models import FIELD_ALIASES, FormulaScreenshot, BatchImport, RecordStatus


STATUS_LABEL = {
    "pending": "待处理",
    "reviewing": "复核中",
    "approved": "已通过",
    "rejected": "已驳回",
    "rollbacked": "已回滚",
    "abnormal": "异常待复核",
}

ABNORMAL_TYPE_LABEL = {
    "zero_denominator": "分母为0",
    "empty_string": "结果空字符串",
    "null_value": "空值",
    "inconsistent": "数据不一致",
    "outlier": "异常值",
    "zero_denominator_empty_result": "分母为0且结果为空",
}


def detect_columns(df_columns: List[str]) -> Dict[str, str]:
    mapping: Dict[str, str] = {}
    lower_map = {str(c).strip(): c for c in df_columns}

    for canonical, aliases in FIELD_ALIASES.items():
        for alias in aliases:
            if alias in lower_map:
                mapping[canonical] = lower_map[alias]
                break
            for col_name in df_columns:
                if alias.lower() == str(col_name).strip().lower():
                    mapping[canonical] = col_name
                    break
            if canonical in mapping:
                break

    return mapping


def normalize_row(row: pd.Series, col_mapping: Dict[str, str]) -> Dict[str, Any]:
    data: Dict[str, Any] = {}
    for canonical, actual_col in col_mapping.items():
        value = row.get(actual_col)
        if canonical == "denominator_value" or canonical == "numerator_value":
            if pd.isna(value):
                value = 0.0
            else:
                try:
                    value = float(value)
                except (ValueError, TypeError):
                    value = 0.0
        elif canonical == "result_value":
            if pd.isna(value):
                value = ""
            else:
                value = str(value).strip()
        else:
            if pd.isna(value):
                value = ""
            else:
                value = str(value)
        data[canonical] = value

    for key in FIELD_ALIASES.keys():
        if key not in data:
            if key in ("denominator_value", "numerator_value"):
                data[key] = 0.0
            else:
                data[key] = ""

    return data


def record_to_dict(record: FormulaScreenshot) -> Dict[str, Any]:
    return {
        "id": record.id,
        "batch_id": record.batch_id,
        "original_row_number": record.original_row_number,
        "source_file": record.source_file,
        "source_format": record.source_format,
        "import_time": record.import_time.isoformat() if record.import_time else None,
        "imported_by": record.imported_by,
        "sku_code": record.sku_code,
        "product_name": record.product_name,
        "formula_expression": record.formula_expression,
        "denominator_value": record.denominator_value,
        "numerator_value": record.numerator_value,
        "result_value": record.result_value,
        "original_result": record.original_result,
        "status": record.status,
        "status_label": STATUS_LABEL.get(record.status, record.status),
        "abnormal_type": record.abnormal_type,
        "abnormal_type_label": ABNORMAL_TYPE_LABEL.get(record.abnormal_type, record.abnormal_type),
        "abnormal_note": record.abnormal_note,
        "boundary_rules_triggered": record.boundary_rules_triggered,
        "original_statement": record.original_statement,
        "corrected_value": record.corrected_value,
        "review_reason": record.review_reason,
        "next_handler": record.next_handler,
        "reviewed_by": record.reviewed_by,
        "reviewed_at": record.reviewed_at.isoformat() if record.reviewed_at else None,
        "review_decision": record.review_decision,
        "review_decision_detail": record.review_decision_detail,
        "current_version": record.current_version,
        "is_latest": record.is_latest,
    }


def record_summary(record: FormulaScreenshot) -> Dict[str, Any]:
    return {
        "id": record.id,
        "sku_code": record.sku_code,
        "product_name": record.product_name,
        "status": record.status,
        "status_label": STATUS_LABEL.get(record.status, record.status),
        "abnormal_type": record.abnormal_type,
        "abnormal_type_label": ABNORMAL_TYPE_LABEL.get(record.abnormal_type, record.abnormal_type),
        "denominator_value": record.denominator_value,
        "numerator_value": record.numerator_value,
        "result_value": record.result_value,
        "original_result": record.original_result,
        "original_row_number": record.original_row_number,
        "current_version": record.current_version,
        "original_statement": record.original_statement,
        "corrected_value": record.corrected_value,
        "review_reason": record.review_reason,
        "next_handler": record.next_handler,
        "abnormal_note": record.abnormal_note,
    }


def record_detail(record: FormulaScreenshot) -> Dict[str, Any]:
    detail = record_to_dict(record)
    detail["history"] = [
        {
            "version": h.version,
            "change_type": h.change_type,
            "change_time": h.change_time.isoformat() if h.change_time else None,
            "changed_by": h.changed_by,
            "change_reason": h.change_reason,
            "diff_fields": h.diff_fields,
            "before_data": h.before_data,
            "after_data": h.after_data,
        }
        for h in record.history
    ]
    detail["reviews"] = [
        {
            "reviewer": r.reviewer,
            "review_time": r.review_time.isoformat() if r.review_time else None,
            "review_comment": r.review_comment,
            "review_decision": r.review_decision,
            "original_statement": r.original_statement,
            "corrected_value": r.corrected_value,
            "review_reason": r.review_reason,
            "next_handler": r.next_handler,
        }
        for r in record.reviews
    ]
    return detail


def batch_summary(batch: BatchImport) -> Dict[str, Any]:
    return {
        "batch_id": batch.batch_id,
        "source_file": batch.source_file,
        "source_format": batch.source_format,
        "import_time": batch.import_time.isoformat() if batch.import_time else None,
        "imported_by": batch.imported_by,
        "total_records": batch.total_records,
        "success_count": batch.success_count,
        "abnormal_count": batch.abnormal_count,
        "pending_count": batch.pending_count,
        "reviewing_count": batch.reviewing_count,
        "approved_count": batch.approved_count,
        "rejected_count": batch.rejected_count,
        "rollbacked_count": batch.rollbacked_count,
        "is_rollbacked": batch.is_rollbacked,
        "rollback_time": batch.rollback_time.isoformat() if batch.rollback_time else None,
        "rollback_note": batch.rollback_note,
    }


def record_export_row(record: FormulaScreenshot) -> Dict[str, Any]:
    return {
        "记录ID": record.id,
        "批次ID": record.batch_id,
        "原始行号": record.original_row_number,
        "源文件": record.source_file,
        "导入时间": record.import_time.strftime("%Y-%m-%d %H:%M:%S") if record.import_time else "",
        "导入人": record.imported_by,
        "SKU编码": record.sku_code,
        "商品名称": record.product_name,
        "公式表达式": record.formula_expression,
        "分子": record.numerator_value,
        "分母": record.denominator_value,
        "原始结果": record.original_result,
        "当前结果": record.result_value,
        "处理状态": STATUS_LABEL.get(record.status, record.status),
        "异常类型": ABNORMAL_TYPE_LABEL.get(record.abnormal_type, ""),
        "异常说明": record.abnormal_note or "",
        "原始说法": record.original_statement or "",
        "修正值": record.corrected_value or "",
        "处理原因": record.review_reason or "",
        "下一步处理人": record.next_handler or "",
        "复核人": record.reviewed_by or "",
        "复核时间": record.reviewed_at.strftime("%Y-%m-%d %H:%M:%S") if record.reviewed_at else "",
        "复核结论": record.review_decision_detail or "",
        "当前版本": record.current_version,
        "是否最新": "是" if record.is_latest else "否",
    }
