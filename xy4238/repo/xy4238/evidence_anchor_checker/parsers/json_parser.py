"""
JSON解析器 - 解析证据目录JSON文件
"""

import json
from typing import List, Dict, Any, Tuple, Optional
from pathlib import Path

from ..rules.validation_rules import (
    EvidenceCatalogEntry,
    ValidationError,
    ErrorType,
    ValidationRules
)


class EvidenceJSONParser:
    REQUIRED_FIELDS = ["证据编号", "证据名称", "页数", "提交方", "证据类型"]
    OPTIONAL_FIELDS = ["备注"]

    @classmethod
    def parse(cls, file_path: str) -> Tuple[List[EvidenceCatalogEntry], List[ValidationError]]:
        entries = []
        errors = []
        path = Path(file_path)

        if not path.exists():
            errors.append(ValidationError(
                error_type=ErrorType.FIELD_MISSING,
                message=f"文件不存在: {file_path}",
                location="文件系统",
                suggestion="请检查文件路径是否正确"
            ))
            return entries, errors

        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
        except json.JSONDecodeError as e:
            errors.append(ValidationError(
                error_type=ErrorType.FORMAT_ERROR,
                message=f"JSON格式错误: {str(e)}",
                location="JSON文件",
                suggestion="请检查JSON格式是否正确"
            ))
            return entries, errors

        if isinstance(data, dict):
            if "证据目录" in data:
                data = data["证据目录"]
            else:
                data = [data]
        elif not isinstance(data, list):
            errors.append(ValidationError(
                error_type=ErrorType.FORMAT_ERROR,
                message="JSON应为数组或包含'证据目录'字段的对象",
                location="JSON结构",
                suggestion="请确保JSON格式为 [{'证据编号': '...', ...}, ...]"
            ))
            return entries, errors

        for idx, item in enumerate(data):
            item_num = idx + 1

            missing_fields = [field for field in cls.REQUIRED_FIELDS if field not in item]
            if missing_fields:
                errors.append(ValidationError(
                    error_type=ErrorType.FIELD_MISSING,
                    message=f"第{item_num}项缺少必需字段: {', '.join(missing_fields)}",
                    location=f"JSON第{item_num}项",
                    suggestion=f"请确保每一项包含: {', '.join(cls.REQUIRED_FIELDS)}"
                ))
                continue

            evidence_number = str(item.get("证据编号", "")).strip()
            evidence_name = str(item.get("证据名称", "")).strip()
            page_count = item.get("页数", 0)
            submission_party = str(item.get("提交方", "")).strip()
            category = str(item.get("证据类型", "")).strip()
            remarks = str(item.get("备注", "")) if "备注" in item else None

            if not evidence_number:
                errors.append(ValidationError(
                    error_type=ErrorType.FIELD_MISSING,
                    message=f"第{item_num}项证据编号为空",
                    location=f"JSON第{item_num}项",
                    suggestion="请为每项证据填写证据编号"
                ))
                continue

            valid, msg = ValidationRules.validate_evidence_number(evidence_number)
            if not valid:
                errors.append(ValidationError(
                    error_type=ErrorType.EVIDENCE_NUMBER_INVALID,
                    message=f"第{item_num}项 {msg}",
                    location=f"JSON第{item_num}项",
                    suggestion="证据编号格式应为 证1 或 1 或 1-1"
                ))

            try:
                page_count_int = int(page_count)
                if page_count_int < 0:
                    raise ValueError("页数不能为负数")
            except (ValueError, TypeError):
                page_count_int = 0
                errors.append(ValidationError(
                    error_type=ErrorType.FORMAT_ERROR,
                    message=f"第{item_num}项页数格式无效: {page_count}",
                    location=f"JSON第{item_num}项",
                    suggestion="页数应为正整数"
                ))

            entry = EvidenceCatalogEntry(
                evidence_number=evidence_number,
                evidence_name=evidence_name,
                page_count=page_count_int,
                submission_party=submission_party,
                category=category,
                remarks=remarks
            )
            entries.append(entry)

        return entries, errors

    @classmethod
    def export(cls, entries: List[EvidenceCatalogEntry], file_path: str, with_root: bool = True) -> None:
        path = Path(file_path)
        path.parent.mkdir(parents=True, exist_ok=True)

        data = []
        for entry in entries:
            item = {
                "证据编号": entry.evidence_number,
                "证据名称": entry.evidence_name,
                "页数": entry.page_count,
                "提交方": entry.submission_party,
                "证据类型": entry.category
            }
            if entry.remarks:
                item["备注"] = entry.remarks
            data.append(item)

        output = {"证据目录": data} if with_root else data

        with open(path, 'w', encoding='utf-8') as f:
            json.dump(output, f, ensure_ascii=False, indent=2)
