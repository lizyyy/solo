"""数据导入模块"""
import csv
import json
import os
from typing import Dict, List, Optional, Type, TypeVar

from .models import (
    Exhibition,
    ImportResult,
    RareBook,
    Restorer,
    ValidationIssue,
)
from .validator import (
    validate_book_data,
    validate_exhibition_data,
    validate_restorer_data,
)


T = TypeVar("T")


def detect_format(file_path: str) -> str:
    """检测文件格式"""
    ext = os.path.splitext(file_path)[1].lower()
    if ext in [".csv"]:
        return "csv"
    elif ext in [".json"]:
        return "json"
    raise ValueError(f"不支持的文件格式: {ext}")


def read_csv_file(file_path: str) -> List[Dict]:
    """读取CSV文件"""
    rows = []
    with open(file_path, "r", encoding="utf-8-sig") as f:
        reader = csv.DictReader(f)
        for row_num, row in enumerate(reader, start=2):
            row["_line_number"] = row_num
            rows.append(row)
    return rows


def read_json_file(file_path: str) -> List[Dict]:
    """读取JSON文件"""
    with open(file_path, "r", encoding="utf-8") as f:
        data = json.load(f)
    
    if isinstance(data, list):
        for i, item in enumerate(data, start=1):
            item["_line_number"] = i
        return data
    elif isinstance(data, dict) and "items" in data:
        items = data["items"]
        for i, item in enumerate(items, start=1):
            item["_line_number"] = i
        return items
    else:
        raise ValueError("JSON文件格式不正确，应为列表或包含 'items' 字段的对象")


def import_books(file_path: str) -> ImportResult:
    """导入善本数据"""
    fmt = detect_format(file_path)
    result = ImportResult(source=file_path)
    
    try:
        if fmt == "csv":
            rows = read_csv_file(file_path)
        else:
            rows = read_json_file(file_path)
    except Exception as e:
        result.issues.append(ValidationIssue(
            issue_type="file_error",
            source=file_path,
            line_number=0,
            field_name=None,
            raw_value=None,
            message=f"读取文件失败: {str(e)}",
        ))
        return result
    
    result.total_rows = len(rows)
    
    seen_ids = set()
    for row in rows:
        line_num = row.get("_line_number", 0)
        row_copy = {k: v for k, v in row.items() if k != "_line_number"}
        
        book_id = row.get("book_id", "").strip()
        if book_id in seen_ids:
            result.issues.append(ValidationIssue(
                issue_type="duplicate_id",
                source=file_path,
                line_number=line_num,
                field_name="book_id",
                raw_value=book_id,
                message=f"重复的善本ID: {book_id}",
            ))
            result.invalid_rows += 1
            continue
        if book_id:
            seen_ids.add(book_id)
        
        book, issues = validate_book_data(row_copy, file_path, line_num)
        result.issues.extend(issues)
        
        if book:
            has_critical_issue = any(
                i.issue_type in ["missing_field", "invalid_value"] and not i.requires_manual_review
                for i in issues
            )
            if not has_critical_issue:
                result.records.append(book)
                result.valid_rows += 1
            else:
                result.invalid_rows += 1
        else:
            result.invalid_rows += 1
    
    return result


def import_restorers(file_path: str) -> ImportResult:
    """导入修复师数据"""
    fmt = detect_format(file_path)
    result = ImportResult(source=file_path)
    
    try:
        if fmt == "csv":
            rows = read_csv_file(file_path)
        else:
            rows = read_json_file(file_path)
    except Exception as e:
        result.issues.append(ValidationIssue(
            issue_type="file_error",
            source=file_path,
            line_number=0,
            field_name=None,
            raw_value=None,
            message=f"读取文件失败: {str(e)}",
        ))
        return result
    
    result.total_rows = len(rows)
    
    seen_ids = set()
    for row in rows:
        line_num = row.get("_line_number", 0)
        row_copy = {k: v for k, v in row.items() if k != "_line_number"}
        
        restorer_id = row.get("restorer_id", "").strip()
        if restorer_id in seen_ids:
            result.issues.append(ValidationIssue(
                issue_type="duplicate_id",
                source=file_path,
                line_number=line_num,
                field_name="restorer_id",
                raw_value=restorer_id,
                message=f"重复的修复师ID: {restorer_id}",
            ))
            result.invalid_rows += 1
            continue
        if restorer_id:
            seen_ids.add(restorer_id)
        
        restorer, issues = validate_restorer_data(row_copy, file_path, line_num)
        result.issues.extend(issues)
        
        if restorer:
            has_critical_issue = any(
                i.issue_type in ["missing_field", "invalid_value"] and not i.requires_manual_review
                for i in issues
            )
            if not has_critical_issue:
                result.records.append(restorer)
                result.valid_rows += 1
            else:
                result.invalid_rows += 1
        else:
            result.invalid_rows += 1
    
    return result


def import_exhibitions(file_path: str) -> ImportResult:
    """导入展览借调数据"""
    fmt = detect_format(file_path)
    result = ImportResult(source=file_path)
    
    try:
        if fmt == "csv":
            rows = read_csv_file(file_path)
        else:
            rows = read_json_file(file_path)
    except Exception as e:
        result.issues.append(ValidationIssue(
            issue_type="file_error",
            source=file_path,
            line_number=0,
            field_name=None,
            raw_value=None,
            message=f"读取文件失败: {str(e)}",
        ))
        return result
    
    result.total_rows = len(rows)
    
    seen_ids = set()
    for row in rows:
        line_num = row.get("_line_number", 0)
        row_copy = {k: v for k, v in row.items() if k != "_line_number"}
        
        exhibition_id = row.get("exhibition_id", "").strip()
        if exhibition_id in seen_ids:
            result.issues.append(ValidationIssue(
                issue_type="duplicate_id",
                source=file_path,
                line_number=line_num,
                field_name="exhibition_id",
                raw_value=exhibition_id,
                message=f"重复的展览ID: {exhibition_id}",
            ))
            result.invalid_rows += 1
            continue
        if exhibition_id:
            seen_ids.add(exhibition_id)
        
        exhibition, issues = validate_exhibition_data(row_copy, file_path, line_num)
        result.issues.extend(issues)
        
        if exhibition:
            has_critical_issue = any(
                i.issue_type in ["missing_field", "invalid_value"]
                for i in issues
            )
            if not has_critical_issue:
                result.records.append(exhibition)
                result.valid_rows += 1
            else:
                result.invalid_rows += 1
        else:
            result.invalid_rows += 1
    
    return result
