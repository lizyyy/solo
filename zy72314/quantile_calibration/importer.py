"""评分权重表导入器 - 含去重机制和版本对比

去重规则（写死在代码中）：
1. 基于文件内容 SHA256 哈希判断是否完全相同的文件
2. 同一文件重复导入：不创建新记录，仅标记为已去重
3. 同文件但部分行有修改（如仅改备注）：更新现有记录，保留历史对比
4. 绝不简单翻倍数量
"""

import pandas as pd
import os
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime
import logging

from .models import (
    RatingWeightRecord, ImportBatch, RecordHistory,
    ProcessingStatus, BoundaryType, ChangeSource
)
from .database import Database
from .boundary_engine import BoundaryRuleEngine

logger = logging.getLogger(__name__)


class RatingWeightImporter:
    """评分权重表导入器"""

    REQUIRED_COLUMNS = ["岗位", "P10", "P25", "P50", "P75", "P90", "样本量"]

    COLUMN_MAPPING = {
        "岗位": "position",
        "P10": "weight_p10",
        "P25": "weight_p25",
        "P50": "weight_p50",
        "P75": "weight_p75",
        "P90": "weight_p90",
        "样本量": "sample_count",
        "备注": "remark"
    }

    def __init__(self, db: Database, boundary_engine: BoundaryRuleEngine):
        self.db = db
        self.boundary_engine = boundary_engine

    def import_file(
        self,
        file_path: str,
        imported_by: str = "operator"
    ) -> Dict[str, Any]:
        """
        导入评分权重表 Excel/CSV 文件。
        自动去重：同一文件重复导入不会翻倍数量。
        """
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")

        with open(file_path, "rb") as f:
            file_content = f.read()
        file_hash = self.db.compute_file_hash(file_content)
        file_name = os.path.basename(file_path)

        existing_batch = self.db.find_existing_batch(file_hash)

        if existing_batch:
            return self._handle_duplicate_import(
                existing_batch, file_path, file_hash, file_name, imported_by
            )

        df = self._read_file(file_path)
        self._validate_columns(df)

        batch = ImportBatch(
            file_hash=file_hash,
            file_name=file_name,
            record_count=len(df),
            imported_at=datetime.now(),
            imported_by=imported_by,
            is_deduplicated=False,
            deduplication_note=""
        )
        batch_id = self.db.create_import_batch(batch)

        imported_records = []
        for idx, row in df.iterrows():
            original_row_number = idx + 2
            raw_data = row.to_dict()
            record = self._row_to_record(row, batch_id, original_row_number, raw_data)
            record_id = self.db.create_rating_record(record)
            record.id = record_id

            history = RecordHistory(
                record_id=record_id,
                change_source=ChangeSource.INITIAL_IMPORT,
                field_name="initial_import",
                old_value=None,
                new_value=str(raw_data),
                old_status=None,
                new_status=ProcessingStatus.IMPORTED,
                snapshot_before={},
                snapshot_after={
                    "position": record.position,
                    "weight_p10": record.weight_p10,
                    "weight_p25": record.weight_p25,
                    "weight_p50": record.weight_p50,
                    "weight_p75": record.weight_p75,
                    "weight_p90": record.weight_p90,
                    "sample_count": record.sample_count,
                    "remark": record.remark,
                    "original_row_number": original_row_number,
                    "raw_data": raw_data
                },
                changed_by=imported_by,
                change_reason="首次导入评分权重表",
                changed_at=datetime.now()
            )
            self.db.add_history(history)
            imported_records.append(record)

        self.db.init_workflow(batch_id)

        return {
            "action": "new_import",
            "batch_id": batch_id,
            "file_hash": file_hash,
            "record_count": len(imported_records),
            "records": imported_records,
            "is_duplicate": False,
            "note": "新导入批次，未发现重复"
        }

    def _handle_duplicate_import(
        self,
        existing_batch: ImportBatch,
        file_path: str,
        file_hash: str,
        file_name: str,
        imported_by: str
    ) -> Dict[str, Any]:
        """
        处理重复导入。
        关键：绝不简单翻倍数量。检测到变化时仅更新差异字段。
        """
        df = self._read_file(file_path)
        existing_records = self.db.get_records_by_batch(existing_batch.id)

        changes_detected = []
        for idx, row in df.iterrows():
            original_row_number = idx + 2
            existing = next(
                (r for r in existing_records if r.original_row_number == original_row_number),
                None
            )

            if not existing:
                continue

            differences = self._compare_row_to_record(row, existing)
            if differences:
                changes_detected.append({
                    "record_id": existing.id,
                    "original_row_number": original_row_number,
                    "differences": differences
                })
                self._update_record_from_diff(existing, differences, imported_by, row.to_dict())

        if existing_batch.is_deduplicated:
            note = "文件已多次导入，本次为重复导入，数据未变更"
        else:
            existing_batch.is_deduplicated = True
            existing_batch.deduplication_note = (
                f"检测到重复导入，文件哈希 {file_hash[:16]}..."
                f"，发现 {len(changes_detected)} 处字段变更"
            )
            note = f"首次检测到重复导入，已去重处理，发现 {len(changes_detected)} 处变更"

        return {
            "action": "deduplicated_import",
            "batch_id": existing_batch.id,
            "file_hash": file_hash,
            "record_count": existing_batch.record_count,
            "original_count": existing_batch.record_count,
            "new_count": 0,
            "is_duplicate": True,
            "changes_detected": len(changes_detected),
            "change_details": changes_detected,
            "note": note
        }

    def _compare_row_to_record(
        self,
        row: pd.Series,
        record: RatingWeightRecord
    ) -> Dict[str, Tuple[Any, Any]]:
        """比较新行与现有记录，返回差异字段"""
        differences = {}

        for excel_col, model_field in self.COLUMN_MAPPING.items():
            if excel_col in row:
                new_val = self._parse_value(row[excel_col], model_field)
                old_val = getattr(record, model_field)

                if model_field in ["weight_p10", "weight_p25", "weight_p50", "weight_p75", "weight_p90"]:
                    if new_val is not None and old_val is not None:
                        if abs(new_val - old_val) > 1e-9:
                            differences[model_field] = (old_val, new_val)
                    elif new_val != old_val:
                        differences[model_field] = (old_val, new_val)
                elif new_val != old_val:
                    differences[model_field] = (old_val, new_val)

        return differences

    def _update_record_from_diff(
        self,
        record: RatingWeightRecord,
        differences: Dict[str, Tuple[Any, Any]],
        operator: str,
        new_raw_data: Dict[str, Any]
    ):
        """根据差异更新记录，并记录历史用于版本对比"""
        snapshot_before = {
            "position": record.position,
            "weight_p10": record.weight_p10,
            "weight_p25": record.weight_p25,
            "weight_p50": record.weight_p50,
            "weight_p75": record.weight_p75,
            "weight_p90": record.weight_p90,
            "sample_count": record.sample_count,
            "remark": record.remark,
            "boundary_type": record.boundary_type.value,
            "status": record.status.value,
            "raw_data": dict(record.raw_data),
            "current_data": dict(record.current_data)
        }

        old_status = record.status

        for field, (old_val, new_val) in differences.items():
            setattr(record, field, new_val)
            record.current_data[field] = new_val

        record.raw_data = new_raw_data
        record.updated_at = datetime.now()
        record.updated_by = operator

        new_boundary, _ = self.boundary_engine.analyze_record(record)
        if new_boundary != record.boundary_type:
            record.boundary_type = new_boundary
            if new_boundary in (BoundaryType.NEGATIVE_TREATED_AS_MISSING,
                               BoundaryType.NEGATIVE_VALUE,
                               BoundaryType.MISSING_VALUE):
                record.status = ProcessingStatus.PENDING_REVIEW

        self.db.update_rating_record(record)

        snapshot_after = {
            "position": record.position,
            "weight_p10": record.weight_p10,
            "weight_p25": record.weight_p25,
            "weight_p50": record.weight_p50,
            "weight_p75": record.weight_p75,
            "weight_p90": record.weight_p90,
            "sample_count": record.sample_count,
            "remark": record.remark,
            "boundary_type": record.boundary_type.value,
            "status": record.status.value,
            "raw_data": new_raw_data,
            "current_data": dict(record.current_data),
            "changed_fields": list(differences.keys())
        }

        for field, (old_val, new_val) in differences.items():
            history = RecordHistory(
                record_id=record.id,
                change_source=ChangeSource.RE_IMPORT,
                field_name=field,
                old_value=str(old_val),
                new_value=str(new_val),
                old_status=old_status,
                new_status=record.status,
                snapshot_before=snapshot_before,
                snapshot_after=snapshot_after,
                changed_by=operator,
                change_reason=f"重复导入时检测到字段变更: {field}",
                changed_at=datetime.now()
            )
            self.db.add_history(history)

    def _read_file(self, file_path: str) -> pd.DataFrame:
        """读取 Excel 或 CSV 文件"""
        ext = os.path.splitext(file_path)[1].lower()
        if ext in (".xlsx", ".xls"):
            df = pd.read_excel(file_path, dtype=str)
        elif ext == ".csv":
            df = pd.read_csv(file_path, dtype=str)
        else:
            raise ValueError(f"不支持的文件格式: {ext}")

        df.columns = df.columns.str.strip()
        return df

    def _validate_columns(self, df: pd.DataFrame):
        """验证必要列是否存在"""
        missing = [col for col in self.REQUIRED_COLUMNS if col not in df.columns]
        if missing:
            raise ValueError(f"缺少必要列: {missing}")

    def _parse_value(self, value: Any, field: str) -> Any:
        """解析单元格值到对应类型"""
        if pd.isna(value) or value is None or str(value).strip() == "":
            return None

        if field in ["weight_p10", "weight_p25", "weight_p50", "weight_p75", "weight_p90", "sample_count"]:
            try:
                s = str(value).strip()
                if s.startswith("-") and len(s) > 1:
                    try:
                        return float(s)
                    except ValueError:
                        return None
                return float(s)
            except (ValueError, TypeError):
                return None

        return str(value).strip()

    def _row_to_record(
        self,
        row: pd.Series,
        batch_id: int,
        original_row_number: int,
        raw_data: Dict[str, Any]
    ) -> RatingWeightRecord:
        """将 DataFrame 行转换为记录对象"""
        record = RatingWeightRecord(
            import_batch_id=batch_id,
            original_row_number=original_row_number,
            raw_data=raw_data,
            current_data={},
            created_at=datetime.now(),
            updated_at=datetime.now()
        )

        for excel_col, model_field in self.COLUMN_MAPPING.items():
            if excel_col in row:
                value = self._parse_value(row[excel_col], model_field)
                setattr(record, model_field, value)
                record.current_data[model_field] = value

        boundary_type, _ = self.boundary_engine.analyze_record(record)
        record.boundary_type = boundary_type

        if boundary_type in (BoundaryType.NEGATIVE_TREATED_AS_MISSING,
                             BoundaryType.NEGATIVE_VALUE,
                             BoundaryType.MISSING_VALUE):
            record.status = ProcessingStatus.PENDING_REVIEW

        return record

    def get_version_diff(self, record_id: int) -> List[Dict[str, Any]]:
        """
        获取记录的所有版本对比，用于展示改前改后差别。
        学生助教追问时可以回到证据。
        """
        histories = self.db.get_record_histories(record_id)
        if len(histories) < 2:
            return []

        diffs = []
        for i in range(1, len(histories)):
            prev = histories[i - 1]
            curr = histories[i]
            comparison = self.db.compare_versions(record_id, prev.id, curr.id)
            if comparison.get("differences"):
                diffs.append({
                    "from_version": prev.id,
                    "to_version": curr.id,
                    "change_source": curr.change_source.value,
                    "changed_by": curr.changed_by,
                    "change_reason": curr.change_reason,
                    "changed_at": curr.changed_at.isoformat(),
                    "differences": comparison["differences"],
                    "status_before": comparison["status_before"],
                    "status_after": comparison["status_after"]
                })
        return diffs
