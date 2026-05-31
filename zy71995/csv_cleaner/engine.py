"""CSV清洗引擎 - 核心业务逻辑"""
import os
import hashlib
import csv
from datetime import datetime
from typing import List, Tuple, Dict, Any, Optional, Callable
from pathlib import Path
import pandas as pd
from dateutil import parser as date_parser

from .models import (
    CSVRecord, RecordStatus, OperationType, LedgerEntry, CleaningContext
)
from .errors import (
    translate_error, DuplicateBatchError, PathSpaceWarning,
    LedgerConsistencyError, EmptyFilterResult, CSVCleanerError
)


def generate_batch_id(file_paths: List[str]) -> str:
    """生成批次ID，用于幂等性检查"""
    file_info = []
    for fp in sorted(file_paths):
        path = Path(fp)
        if path.exists():
            stat = path.stat()
            file_info.append(f"{fp}|{stat.st_size}|{stat.st_mtime}")
    content = "|".join(file_info)
    return hashlib.sha256(content.encode("utf-8")).hexdigest()


class CSVCleaningEngine:
    """CSV脏数据清洗引擎"""
    
    def __init__(self, context: CleaningContext):
        self.context = context
        self.warnings: List[CSVCleanerError] = []
        self.processed_batches: Dict[str, int] = {}

    def load_csv_files(self, file_paths: List[str], force: bool = False) -> Tuple[int, List[str]]:
        """
        批量加载CSV文件
        返回：(成功加载条数, 警告信息列表)
        """
        batch_id = generate_batch_id(file_paths)
        
        if batch_id in self.processed_batches and not force:
            raise DuplicateBatchError(batch_id, self.processed_batches[batch_id])

        total_loaded = 0
        warning_msgs = []
        all_record_ids = []

        for file_path in file_paths:
            try:
                loaded, record_ids, warns = self._load_single_file(file_path)
                total_loaded += loaded
                all_record_ids.extend(record_ids)
                warning_msgs.extend([str(w) for w in warns])
            except Exception as e:
                user_err = translate_error(e, file_path=file_path)
                warning_msgs.append(str(user_err))
                continue

        self.processed_batches[batch_id] = total_loaded
        
        self.context.add_ledger_entry(LedgerEntry(
            timestamp=datetime.now(),
            operation=OperationType.IMPORT,
            operator=self.context.operator,
            record_ids=all_record_ids,
            details={
                "batch_id": batch_id,
                "files": file_paths,
                "force_reload": force
            },
            affected_count=total_loaded
        ))

        return total_loaded, warning_msgs

    def _load_single_file(self, file_path: str) -> Tuple[int, List[str], List[CSVCleanerError]]:
        """加载单个CSV文件"""
        loaded = 0
        record_ids = []
        warnings = []

        encodings_to_try = ["utf-8", "gbk", "utf-8-sig", "latin1"]
        df = None
        
        for encoding in encodings_to_try:
            try:
                df = pd.read_csv(file_path, encoding=encoding, dtype=str, keep_default_na=False)
                break
            except UnicodeDecodeError:
                continue
            except Exception as e:
                if encoding == encodings_to_try[-1]:
                    raise translate_error(e, file_path=file_path)

        if df is None:
            raise CSVCleanerError(
                f"文件「{file_path}」编码不支持",
                "请用记事本打开，另存为UTF-8格式"
            )

        for idx, row in df.iterrows():
            row_num = idx + 2
            data = row.to_dict()
            
            record = CSVRecord(
                row_id=f"{os.path.basename(file_path)}_{row_num}_{datetime.now().timestamp()}",
                source_file=file_path,
                source_row_number=row_num,
                data=data
            )

            if record.has_path_space:
                warning = PathSpaceWarning(
                    record.original_path, record.normalized_path, row_num
                )
                warnings.append(warning)
                record.notes = f"路径空格已修正：{record.original_path} → {record.normalized_path}"

            if self._detect_manual_correction(record):
                record.is_manual_correction = True
                record.status = RecordStatus.MANUAL_CORRECTION
            elif self._detect_late_arrival(record):
                record.is_late_arrival = True
                record.status = RecordStatus.LATE_ARRIVAL
            else:
                record.status = RecordStatus.NORMAL

            added = self.context.add_record(record)
            loaded += 1
            record_ids.append(record.row_id)
            
            if not added:
                duplicate_rec = self._find_existing_record(record.record_hash, exclude_row_id=record.row_id)
                if duplicate_rec:
                    record.status = RecordStatus.DUPLICATE
                    record.duplicate_of = duplicate_rec.row_id
                    record.notes = f"与第{duplicate_rec.source_row_number}行内容重复"

        return loaded, record_ids, warnings

    def _find_existing_record(self, record_hash: str, exclude_row_id: Optional[str] = None) -> Optional[CSVRecord]:
        """根据哈希查找已存在的记录"""
        for rec in self.context.records.values():
            if rec.row_id == exclude_row_id:
                continue
            if rec.record_hash == record_hash:
                return rec
        return None

    def _detect_manual_correction(self, record: CSVRecord) -> bool:
        """检测是否为人工更正记录"""
        data = record.data
        correction_keywords = ["更正", "修正", "修改", "correction", "fix", "update"]
        
        for key, value in data.items():
            value_str = str(value).lower()
            if any(kw.lower() in value_str for kw in correction_keywords):
                return True
        
        if "is_correction" in data and str(data["is_correction"]).lower() in ["1", "true", "是"]:
            return True
        
        if "original_id" in data and data["original_id"]:
            return True
            
        return False

    def _detect_late_arrival(self, record: CSVRecord) -> bool:
        """检测是否为晚到附件"""
        data = record.data
        
        if "is_late" in data and str(data["is_late"]).lower() in ["1", "true", "是"]:
            return True
        
        if "late_note" in data and data["late_note"]:
            return True
            
        for key, value in data.items():
            value_str = str(value).lower()
            if "晚到" in value_str or "补发" in value_str or "late" in value_str:
                return True
        
        return False

    def remove_duplicates(self) -> Tuple[int, List[str]]:
        """
        去除重复记录
        返回：(移除数量, 被移除的记录ID列表)
        """
        before_count = len(self.context.records)
        removed_ids = []
        kept_records: Dict[str, CSVRecord] = {}

        for rec_id, record in self.context.records.items():
            if record.record_hash not in kept_records:
                kept_records[record.record_hash] = record
            else:
                existing = kept_records[record.record_hash]
                record.status = RecordStatus.DUPLICATE
                record.duplicate_of = existing.row_id
                record.notes = f"与第{existing.source_row_number}行内容完全相同，已自动去重"
                removed_ids.append(rec_id)

        self.context.records = {
            rec.row_id: rec for rec in kept_records.values()
        }
        
        after_count = len(self.context.records)
        removed_count = before_count - after_count

        if removed_count != len(removed_ids):
            raise LedgerConsistencyError(len(removed_ids), removed_count, "去重")

        self.context.add_ledger_entry(LedgerEntry(
            timestamp=datetime.now(),
            operation=OperationType.DEDUP,
            operator=self.context.operator,
            record_ids=removed_ids,
            details={
                "before_count": before_count,
                "after_count": after_count,
                "removed_count": removed_count
            },
            affected_count=removed_count
        ))

        return removed_count, removed_ids

    def merge_late_arrivals(self) -> Tuple[int, List[str]]:
        """
        合并晚到附件到对应主记录
        返回：(合并数量, 合并的记录ID列表)
        """
        merged_ids = []
        late_records = [
            rec for rec in self.context.records.values()
            if rec.status == RecordStatus.LATE_ARRIVAL
        ]

        for late_rec in late_records:
            matched = self._find_matching_main_record(late_rec)
            if matched:
                late_rec.late_for_record_id = matched.row_id
                late_rec.notes = f"晚到附件，已合并到第{matched.source_row_number}行"
                late_rec.processed_at = datetime.now()
                matched.data.setdefault("attachments", [])
                if isinstance(matched.data["attachments"], list):
                    matched.data["attachments"].append(late_rec.data)
                merged_ids.append(late_rec.row_id)

        self.context.add_ledger_entry(LedgerEntry(
            timestamp=datetime.now(),
            operation=OperationType.LATE_MERGE,
            operator=self.context.operator,
            record_ids=merged_ids,
            details={
                "late_count": len(late_records),
                "merged_count": len(merged_ids)
            },
            affected_count=len(merged_ids)
        ))

        return len(merged_ids), merged_ids

    def _find_matching_main_record(self, late_rec: CSVRecord) -> Optional[CSVRecord]:
        """查找晚到附件对应的主记录"""
        data = late_rec.data
        
        match_key = None
        for key in ["ticket_id", "order_id", "工单号", "订单号", "关联单号"]:
            if key in data and data[key]:
                match_key = key
                break

        if not match_key:
            return None

        match_value = str(data[match_key])
        for rec in self.context.records.values():
            if rec.status == RecordStatus.LATE_ARRIVAL:
                continue
            if match_key in rec.data and str(rec.data[match_key]) == match_value:
                return rec

        return None

    def apply_manual_corrections(self) -> Tuple[int, List[str]]:
        """
        应用人工更正
        返回：(应用数量, 更正的记录ID列表)
        """
        applied_ids = []
        correction_records = [
            rec for rec in self.context.records.values()
            if rec.status == RecordStatus.MANUAL_CORRECTION
        ]

        for corr_rec in correction_records:
            target = self._find_correction_target(corr_rec)
            if target:
                before_data = dict(target.data)
                corr_rec.corrects_record_id = target.row_id
                
                for key, value in corr_rec.data.items():
                    if key in ["is_correction", "original_id", "correction_note"]:
                        continue
                    if value and str(value).strip():
                        target.data[key] = value
                
                corr_rec.notes = f"已应用更正到第{target.source_row_number}行"
                corr_rec.processed_at = datetime.now()
                target.notes = f"已应用人工更正（来自第{corr_rec.source_row_number}行）"
                target.processed_at = datetime.now()
                applied_ids.append(corr_rec.row_id)

        self.context.add_ledger_entry(LedgerEntry(
            timestamp=datetime.now(),
            operation=OperationType.MANUAL_APPLY,
            operator=self.context.operator,
            record_ids=applied_ids,
            details={
                "correction_count": len(correction_records),
                "applied_count": len(applied_ids)
            },
            affected_count=len(applied_ids)
        ))

        return len(applied_ids), applied_ids

    def _find_correction_target(self, corr_rec: CSVRecord) -> Optional[CSVRecord]:
        """查找更正记录对应的目标记录"""
        data = corr_rec.data
        
        if "original_id" in data and data["original_id"]:
            orig_id = str(data["original_id"])
            for rec in self.context.records.values():
                if rec.row_id == orig_id or str(rec.source_row_number) == orig_id:
                    return rec

        for key in ["ticket_id", "order_id", "工单号", "订单号"]:
            if key in data and data[key]:
                value = str(data[key])
                for rec in self.context.records.values():
                    if rec.status == RecordStatus.MANUAL_CORRECTION:
                        continue
                    if key in rec.data and str(rec.data[key]) == value:
                        return rec

        return None

    def fix_path_spaces(self) -> Tuple[int, List[str]]:
        """
        修复路径中的空格问题
        返回：(修复数量, 修复的记录ID列表)
        """
        fixed_ids = []
        records_with_space = [
            rec for rec in self.context.records.values()
            if rec.has_path_space
        ]

        for rec in records_with_space:
            if "file_path" in rec.data:
                rec.data["file_path"] = rec.normalized_path
                rec.notes = f"路径空格已修复：{rec.original_path} → {rec.normalized_path}"
                rec.processed_at = datetime.now()
                fixed_ids.append(rec.row_id)

        self.context.add_ledger_entry(LedgerEntry(
            timestamp=datetime.now(),
            operation=OperationType.PATH_FIX,
            operator=self.context.operator,
            record_ids=fixed_ids,
            details={
                "total_with_space": len(records_with_space),
                "fixed_count": len(fixed_ids)
            },
            affected_count=len(fixed_ids)
        ))

        return len(fixed_ids), fixed_ids

    def run_full_cleaning(self) -> Dict[str, Any]:
        """
        执行完整的清洗流程
        返回清洗结果统计
        """
        results = {
            "去重": self.remove_duplicates(),
            "修复路径空格": self.fix_path_spaces(),
            "合并晚到附件": self.merge_late_arrivals(),
            "应用人工更正": self.apply_manual_corrections()
        }
        return results

    def refresh_screen(self) -> List[CSVRecord]:
        """刷新屏幕，记录当前屏幕范围到账本"""
        records = self.context.get_visible_records()
        
        if not records and self.context.current_filter:
            filter_desc = str(self.context.current_filter)
            raise EmptyFilterResult(filter_desc)

        self.context.add_ledger_entry(LedgerEntry(
            timestamp=datetime.now(),
            operation=OperationType.SCREEN_REFRESH,
            operator=self.context.operator,
            record_ids=[r.row_id for r in records],
            details={
                "page": self.context.current_page,
                "page_size": self.context.page_size,
                "total_filtered": len(self.context._apply_filter(list(self.context.records.values())))
            },
            affected_count=len(records)
        ))

        return records

    def change_filter(self, **filter_kwargs) -> List[CSVRecord]:
        """变更筛选条件"""
        old_filter = dict(self.context.current_filter)
        self.context.set_filter(**filter_kwargs)
        records = self.context.get_visible_records()

        if not records and filter_kwargs:
            filter_desc = str(filter_kwargs)
            self.context.current_filter = old_filter
            raise EmptyFilterResult(filter_desc)

        self.context.add_ledger_entry(LedgerEntry(
            timestamp=datetime.now(),
            operation=OperationType.FILTER_CHANGE,
            operator=self.context.operator,
            record_ids=[r.row_id for r in records],
            details={
                "old_filter": old_filter,
                "new_filter": filter_kwargs,
                "total_filtered": len(records)
            },
            affected_count=len(records)
        ))

        return records

    def export_cleaned_data(self, output_path: str) -> str:
        """导出清洗后的数据（仅限当前筛选和屏幕范围）"""
        visible_records = self.context.get_visible_records()
        ledger_records = [
            entry for entry in self.context.ledger
            if entry.operation != OperationType.SCREEN_REFRESH
        ]

        output_dir = os.path.dirname(os.path.abspath(output_path))
        os.makedirs(output_dir, exist_ok=True)
        base_name = os.path.splitext(os.path.basename(output_path))[0]

        data_file = os.path.join(output_dir, f"{base_name}_cleaned.csv")
        ledger_file = os.path.join(output_dir, f"{base_name}_运行账本.csv")

        if visible_records:
            data_rows = []
            for rec in visible_records:
                row = {
                    "记录ID": rec.row_id,
                    "来源文件": os.path.basename(rec.source_file),
                    "来源行号": rec.source_row_number,
                    "状态": rec.status.value,
                    **rec.data,
                    "是否有路径空格": "是" if rec.has_path_space else "否",
                    "原始路径": rec.original_path,
                    "标准化路径": rec.normalized_path,
                    "导入时间": rec.imported_at.strftime("%Y-%m-%d %H:%M:%S"),
                    "处理时间": rec.processed_at.strftime("%Y-%m-%d %H:%M:%S") if rec.processed_at else "",
                    "备注": rec.notes
                }
                data_rows.append(row)
            
            df = pd.DataFrame(data_rows)
            df.to_csv(data_file, index=False, encoding="utf-8-sig")

        ledger_rows = [entry.to_dict() for entry in ledger_records]
        if ledger_rows:
            df_ledger = pd.DataFrame(ledger_rows)
            df_ledger.to_csv(ledger_file, index=False, encoding="utf-8-sig")

        self.context.add_ledger_entry(LedgerEntry(
            timestamp=datetime.now(),
            operation=OperationType.EXPORT,
            operator=self.context.operator,
            record_ids=[r.row_id for r in visible_records],
            details={
                "data_file": data_file,
                "ledger_file": ledger_file,
                "exported_count": len(visible_records),
                "ledger_entries": len(ledger_rows)
            },
            affected_count=len(visible_records)
        ))

        return data_file, ledger_file

    def get_statistics(self) -> Dict[str, Any]:
        """获取当前统计信息"""
        records = list(self.context.records.values())
        status_counts = {}
        for rec in records:
            status = rec.status.value
            status_counts[status] = status_counts.get(status, 0) + 1

        return {
            "总记录数": len(records),
            "状态分布": status_counts,
            "含路径空格": sum(1 for r in records if r.has_path_space),
            "重复项": sum(1 for r in records if r.status == RecordStatus.DUPLICATE),
            "晚到附件": sum(1 for r in records if r.status == RecordStatus.LATE_ARRIVAL),
            "人工更正": sum(1 for r in records if r.status == RecordStatus.MANUAL_CORRECTION),
            "当前页码": self.context.current_page,
            "每页条数": self.context.page_size,
            "筛选条件": self.context.current_filter,
            "账本条目数": len(self.context.ledger)
        }
