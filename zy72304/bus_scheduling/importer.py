"""
抽样名单导入器模块

核心功能：
- 导入抽样名单（Excel/CSV）
- 防止重复导入导致数量翻倍
- 检测百分数和小数混合情况
"""

import os
import uuid
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

import pandas as pd

from .models import (
    SamplingRecord,
    MixedNumberIssue,
    NumberType,
    IssueStatus,
)
from .validator import BoundaryValidator
from .exceptions import (
    format_error,
    DuplicateImportError,
    DataFormatError,
)


class SamplingImporter:
    """
    抽样名单导入器

    防止重复导入同一批抽样名单时数量翻倍。
    每次导入都会生成唯一的批次ID和记录指纹。
    """

    REQUIRED_COLUMNS = [
        "线路编号",
        "线路名称",
        "客流量",
        "发车时间",
    ]

    COLUMN_MAPPING = {
        "线路编号": "route_code",
        "线路名称": "route_name",
        "客流量": "passenger_count",
        "发车时间": "departure_time",
        "备注": "remark",
    }

    def __init__(self, validator: BoundaryValidator):
        self.validator = validator
        self._imported_fingerprints: set = set()
        self._import_history: List[Dict[str, Any]] = []

    def _generate_fingerprint(self, row_data: Dict[str, Any]) -> str:
        """
        生成记录指纹，用于去重

        规则：
        - 使用线路编号、线路名称、发车时间、原始客流量生成唯一指纹
        - 确保同一批数据重复导入时能被识别

        Args:
            row_data: 行数据字典

        Returns:
            指纹字符串
        """
        fingerprint_parts = [
            str(row_data.get("线路编号", "")),
            str(row_data.get("线路名称", "")),
            str(row_data.get("发车时间", "")),
            str(row_data.get("passenger_count_original", "")),
        ]
        fingerprint_str = "|".join(fingerprint_parts)
        return hashlib.md5(fingerprint_str.encode("utf-8")).hexdigest()

    def _parse_row(
        self,
        row: pd.Series,
        source_file: str,
        batch_id: str,
    ) -> Tuple[Optional[SamplingRecord], List[MixedNumberIssue]]:
        """
        解析单行数据

        Args:
            row: pandas Series
            source_file: 源文件名
            batch_id: 批次ID

        Returns:
            (抽样记录, 问题列表)
        """
        record_id = f"rec_{uuid.uuid4().hex[:8]}"
        issues = []

        try:
            route_code = str(row.get("线路编号", "")).strip()
            route_name = str(row.get("线路名称", "")).strip()
            passenger_count_str = str(row.get("客流量", "")).strip()
            departure_time = str(row.get("发车时间", "")).strip()
            remark = str(row.get("备注", "")).strip() if "备注" in row else None

            if not route_code or not route_name or not passenger_count_str:
                return None, []

            num_type, converted_value = self.validator.detect_number_type(
                passenger_count_str
            )

            if num_type == NumberType.UNKNOWN:
                raise DataFormatError(
                    format_error(
                        "invalid_decimal",
                        field_name="客流量",
                        value=passenger_count_str,
                    )
                )

            # 记录该字段的类型，是否待复核由批次级别统一判定
            # 纯小数/纯百分数批次：默认 APPROVED，附自动通过理由
            # 混合批次：后续统一改为 PENDING_REVIEW
            if num_type in (NumberType.PERCENTAGE, NumberType.DECIMAL):
                auto_reason = (
                    "纯百分数格式，批次未检测到混用，自动通过"
                    if num_type == NumberType.PERCENTAGE
                    else "纯小数格式，批次未检测到混用，自动通过"
                )
                issue = MixedNumberIssue(
                    issue_id=f"issue_{uuid.uuid4().hex[:8]}",
                    record_id=record_id,
                    field_name="客流量",
                    original_value=passenger_count_str,
                    detected_type=num_type,
                    suggested_value=converted_value,
                    status=IssueStatus.APPROVED,
                    retain_reason=auto_reason,
                )
                issues.append(issue)

            original_data = {
                col: str(row.get(col, "")) for col in self.REQUIRED_COLUMNS
            }
            original_data["passenger_count_original"] = passenger_count_str

            record = SamplingRecord(
                record_id=record_id,
                route_code=route_code,
                route_name=route_name,
                passenger_count=converted_value if converted_value else 0.0,
                departure_time=departure_time,
                original_data=original_data,
                source_file=source_file,
                import_batch_id=batch_id,
                issues=issues,
                remark=remark,
            )

            return record, issues

        except Exception as e:
            raise DataFormatError(
                f"解析数据行失败：{str(e)}",
                {"row": row.to_dict(), "record_id": record_id},
            )

    def import_file(
        self,
        file_path: str,
        operator: str,
    ) -> Tuple[List[SamplingRecord], List[MixedNumberIssue], Dict[str, Any]]:
        """
        导入抽样名单文件

        边界规则：
        1. 检查文件是否已导入过
        2. 检查每条记录是否为重复记录
        3. 重复记录标记为is_duplicate=True，不参与计算
        4. 不会导致数量翻倍

        Args:
            file_path: 文件路径
            operator: 操作人

        Returns:
            (记录列表, 问题列表, 导入统计)
        """
        if not os.path.exists(file_path):
            raise DataFormatError(
                format_error("record_not_found"),
                {"file_path": file_path},
            )

        batch_id = f"batch_{uuid.uuid4().hex[:8]}"
        source_file = os.path.basename(file_path)

        try:
            if file_path.endswith(".csv"):
                df = pd.read_csv(file_path, dtype=str)
            elif file_path.endswith((".xlsx", ".xls")):
                df = pd.read_excel(file_path, dtype=str)
            else:
                raise DataFormatError(
                    "不支持的文件格式，请上传CSV或Excel文件",
                    {"file_path": file_path},
                )
        except Exception as e:
            raise DataFormatError(
                f"读取文件失败：{str(e)}",
                {"file_path": file_path},
            )

        for col in self.REQUIRED_COLUMNS:
            if col not in df.columns:
                raise DataFormatError(
                    format_error("missing_required_field", field_name=col),
                    {"columns": list(df.columns)},
                )

        records: List[SamplingRecord] = []
        all_issues: List[MixedNumberIssue] = []
        duplicate_count = 0
        new_count = 0

        # 先收集所有客流量值，检查批次内是否有混合
        all_passenger_values = df["客流量"].astype(str).tolist()
        batch_has_mixed = False
        batch_types = set()

        for val in all_passenger_values:
            num_type, _ = self.validator.detect_number_type(val)
            if num_type in (NumberType.PERCENTAGE, NumberType.DECIMAL):
                batch_types.add(num_type)

        batch_has_mixed = (
            NumberType.PERCENTAGE in batch_types and NumberType.DECIMAL in batch_types
        )

        for _, row in df.iterrows():
            record, issues = self._parse_row(row, source_file, batch_id)

            if record is None:
                continue

            fingerprint = self._generate_fingerprint(record.original_data)

            if fingerprint in self._imported_fingerprints:
                record.is_duplicate = True
                duplicate_count += 1
            else:
                self._imported_fingerprints.add(fingerprint)
                new_count += 1

            # 三种口径分清：
            # 1. 混合批次：所有 issue 改为 PENDING_REVIEW，清除自动通过理由
            # 2. 纯小数/纯百分数批次：保持 APPROVED，保留自动通过理由
            if batch_has_mixed:
                for issue in issues:
                    issue.status = IssueStatus.PENDING_REVIEW
                    issue.retain_reason = None
                    issue.reviewer = None
                    issue.review_time = None

            # 所有 issue 都加入列表（纯类型也有记录便于追溯）
            all_issues.extend(issues)

            records.append(record)

        # 统计待复核数量
        pending_review_count = sum(
            1 for i in all_issues if i.status == IssueStatus.PENDING_REVIEW
        )

        import_stat = {
            "batch_id": batch_id,
            "source_file": source_file,
            "total_records": len(records),
            "new_records": new_count,
            "duplicate_records": duplicate_count,
            "total_issues": len(all_issues),
            "pending_review_count": pending_review_count,
            "has_mixed_numbers": batch_has_mixed,
            "batch_type": (
                "混合" if batch_has_mixed
                else ("纯百分数" if NumberType.PERCENTAGE in batch_types
                      else ("纯小数" if NumberType.DECIMAL in batch_types
                            else "未知"))
            ),
            "operator": operator,
            "import_time": datetime.now().isoformat(),
        }

        self._import_history.append(import_stat)

        if duplicate_count > 0:
            # 不抛出异常，只返回提示信息
            import_stat["warning"] = format_error("duplicate_import")

        return records, all_issues, import_stat

    def check_duplicate(self, file_path: str) -> bool:
        """
        检查文件是否已导入过

        Args:
            file_path: 文件路径

        Returns:
            是否已导入过
        """
        if not os.path.exists(file_path):
            return False

        try:
            if file_path.endswith(".csv"):
                df = pd.read_csv(file_path, dtype=str)
            elif file_path.endswith((".xlsx", ".xls")):
                df = pd.read_excel(file_path, dtype=str)
            else:
                return False

            for _, row in df.iterrows():
                row_dict = {
                    "线路编号": str(row.get("线路编号", "")).strip(),
                    "线路名称": str(row.get("线路名称", "")).strip(),
                    "发车时间": str(row.get("发车时间", "")).strip(),
                    "passenger_count_original": str(row.get("客流量", "")).strip(),
                }
                fingerprint = self._generate_fingerprint(row_dict)
                if fingerprint in self._imported_fingerprints:
                    return True
        except Exception:
            return False

        return False

    def get_import_history(self) -> List[Dict[str, Any]]:
        """
        获取导入历史

        Returns:
            导入历史列表
        """
        return list(self._import_history)
