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
    RatingWeightRecord, ImportBatch, RecordHistory, ReviewTask,
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
        两级去重策略，绝不简单翻倍数量：
          Level 1: 基于文件内容 SHA256 哈希 → 完全相同文件
          Level 2: 基于业务主键（岗位+原始行号）→ 内容不同但实际是同一份数据
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

        return self._smart_merge_import(
            df, file_path, file_hash, file_name, imported_by
        )

    def _smart_merge_import(
        self,
        df: pd.DataFrame,
        file_path: str,
        file_hash: str,
        file_name: str,
        imported_by: str
    ) -> Dict[str, Any]:
        """
        智能合并导入：按业务主键（岗位+原始行号）去重。
        - 新的业务主键 → 创建新记录（标记为 merged_from_new_file）
        - 已存在的业务主键 → 更新差异字段，保留历史对比
        绝不简单翻倍数量。
        """
        newly_created = []
        merged_updated = []
        unchanged_count = 0

        has_any_existing = False
        for idx, row in df.iterrows():
            original_row_number = idx + 2
            position_val = str(row.get("岗位", "")).strip() if pd.notna(row.get("岗位")) else ""
            existing = self.db.find_record_by_business_key(position_val, original_row_number)
            if existing is not None:
                has_any_existing = True
                break

        if has_any_existing:
            batch_id = self.db.get_latest_batch_id()
            if batch_id is None:
                batch = ImportBatch(
                    file_hash=file_hash,
                    file_name=file_name,
                    record_count=len(df),
                    imported_at=datetime.now(),
                    imported_by=imported_by,
                    is_deduplicated=True,
                    deduplication_note="业务主键级智能合并：哈希不同但按岗位+行号去重"
                )
                batch_id = self.db.create_import_batch(batch)
        else:
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

        for idx, row in df.iterrows():
            original_row_number = idx + 2
            position_val = str(row.get("岗位", "")).strip() if pd.notna(row.get("岗位")) else ""
            raw_data = row.to_dict()

            existing = self.db.find_record_by_business_key(position_val, original_row_number)

            if existing is None:
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
                        "raw_data": raw_data,
                        "note": "业务主键级智能合并：新记录"
                    },
                    changed_by=imported_by,
                    change_reason="智能合并导入：按岗位+行号判定为新数据",
                    changed_at=datetime.now()
                )
                self.db.add_history(history)
                newly_created.append(record)
            else:
                differences = self._compare_row_to_record(row, existing)
                if differences:
                    conflicts = self._update_record_from_diff(
                        existing, differences, imported_by, raw_data,
                        change_source_override=ChangeSource.RE_IMPORT
                    )
                    merged_updated.append({
                        "record_id": existing.id,
                        "original_row_number": original_row_number,
                        "position": existing.position,
                        "differences": differences,
                        "protected_conflicts": conflicts
                    })
                else:
                    unchanged_count += 1

        if not self.db.get_workflow(batch_id):
            self.db.init_workflow(batch_id)

        total_records_after = self.db.get_all_active_records()

        if not has_any_existing:
            self.boundary_engine.apply_boundary_detection(batch_id, imported_by)

        return {
            "action": "smart_merged_import",
            "batch_id": batch_id,
            "file_hash": file_hash,
            "record_count": len(total_records_after),
            "newly_created_count": len(newly_created),
            "merged_updated_count": len(merged_updated),
            "unchanged_count": unchanged_count,
            "total_count": len(total_records_after),
            "records": total_records_after,
            "newly_created_records": newly_created,
            "merged_updated_details": merged_updated,
            "is_duplicate": has_any_existing,
            "duplicate_level": "business_key" if has_any_existing else "none",
            "changes_detected": len(merged_updated),
            "change_details": merged_updated,
            "note": (
                f"业务主键级智能合并（岗位+行号）："
                f"新增 {len(newly_created)} 条，"
                f"更新 {len(merged_updated)} 条，"
                f"无变化 {unchanged_count} 条，"
                f"当前同一份数据总数 {len(total_records_after)} 条，"
                f"未翻倍"
            )
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
                conflicts = self._update_record_from_diff(
                    existing, differences, imported_by, row.to_dict()
                )
                changes_detected.append({
                    "record_id": existing.id,
                    "original_row_number": original_row_number,
                    "differences": differences,
                    "protected_conflicts": conflicts
                })

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

    PROTECTED_CHANGE_SOURCES = {ChangeSource.TA_REVIEW, ChangeSource.MANUAL_EDIT}

    def _get_field_last_source(self, record_id: int, field_name: str) -> Optional[ChangeSource]:
        """查询指定字段最后一次修改的来源，用于判断是否受保护"""
        histories = self.db.get_record_histories(record_id)
        for h in reversed(histories):
            if h.field_name == field_name and h.change_source in self.PROTECTED_CHANGE_SOURCES:
                return h.change_source
        return None

    def _update_record_from_diff(
        self,
        record: RatingWeightRecord,
        differences: Dict[str, Tuple[Any, Any]],
        operator: str,
        new_raw_data: Dict[str, Any],
        change_source_override: Optional[ChangeSource] = None
    ):
        """根据差异更新记录，并记录历史用于版本对比

        关键保护：已由学生助教或人工确认修正的字段，重复导入不能覆盖。
        如果重复导入的值与人工确认值冲突，保留人工确认值，生成新复核任务。
        """
        change_source = change_source_override or ChangeSource.RE_IMPORT
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
        protected_conflicts = []

        for field, (old_val, new_val) in differences.items():
            last_source = self._get_field_last_source(record.id, field)
            if last_source in self.PROTECTED_CHANGE_SOURCES:
                protected_conflicts.append({
                    "field": field,
                    "confirmed_value": old_val,
                    "import_value": new_val,
                    "confirmed_by": last_source.value,
                    "resolution": "保留人工确认值，不覆盖"
                })
            else:
                setattr(record, field, new_val)
                record.current_data[field] = new_val

        record.raw_data = new_raw_data

        record.updated_at = datetime.now()
        record.updated_by = operator

        new_boundary, _ = self.boundary_engine.analyze_record(record)
        if new_boundary != record.boundary_type:
            record.boundary_type = new_boundary

        needs_new_review = bool(protected_conflicts)
        if needs_new_review:
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
            "changed_fields": list(differences.keys()),
            "protected_conflicts": protected_conflicts
        }

        for field, (old_val, new_val) in differences.items():
            last_source = self._get_field_last_source(record.id, field)
            if last_source in self.PROTECTED_CHANGE_SOURCES:
                history = RecordHistory(
                    record_id=record.id,
                    change_source=change_source,
                    field_name=field,
                    old_value=str(old_val),
                    new_value=str(new_val),
                    old_status=old_status,
                    new_status=record.status,
                    snapshot_before=snapshot_before,
                    snapshot_after=snapshot_after,
                    changed_by=operator,
                    change_reason=(
                        f"重复导入检测到字段变更({field}: {old_val} → {new_val})，"
                        f"但该字段已由{last_source.value}确认修正为{old_val}，"
                        f"保留人工确认值不覆盖"
                    ),
                    changed_at=datetime.now()
                )
                self.db.add_history(history)
            else:
                history = RecordHistory(
                    record_id=record.id,
                    change_source=change_source,
                    field_name=field,
                    old_value=str(old_val),
                    new_value=str(new_val),
                    old_status=old_status,
                    new_status=record.status,
                    snapshot_before=snapshot_before,
                    snapshot_after=snapshot_after,
                    changed_by=operator,
                    change_reason=f"导入合并时检测到字段变更: {field}",
                    changed_at=datetime.now()
                )
                self.db.add_history(history)

        if needs_new_review:
            conflict_desc = "; ".join(
                f"{c['field']}: 人工确认为{c['confirmed_value']}，"
                f"导入值为{c['import_value']}"
                for c in protected_conflicts
            )
            task = ReviewTask(
                record_id=record.id,
                boundary_type=record.boundary_type,
                assigned_to="ta_conflict_resolver",
                review_note=(
                    f"【重复导入与人工确认冲突】\n"
                    f"岗位: {record.position}，原始行号: {record.original_row_number}\n"
                    f"冲突字段: {conflict_desc}\n"
                    f"处理建议: 人工确认值已保留，请判断导入值是否需要采纳\n"
                    f"如需采纳导入值，请手动修正该字段"
                ),
                created_at=datetime.now()
            )
            self.db.create_review_task(task)

        return protected_conflicts

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
