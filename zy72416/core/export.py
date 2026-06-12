import csv
import json
import os
from typing import List
from datetime import datetime
from .single_source import SingleSourceOfTruth
from .models import ExportMeta, RecordStatus, AbnormalType


class ExportService:
    """
    导出服务 - 必须从单一数据源读取，导出元数据必须写回单一数据源
    关键修复：
    1. 导出的明细、页面展示、接口返回读取同一份结果
    2. 导出元数据（谁导出的、什么时候导出的、导出结论）写入单一数据源
    3. 重启/重载后导出状态不丢失
    4. 回滚时导出状态同步更新
    """

    def __init__(self, source_of_truth: SingleSourceOfTruth):
        self.source = source_of_truth

    def export_to_csv(self, output_path: str, operator: str, note: str = "") -> str:
        """
        导出为CSV格式
        关键：导出完成后必须更新每条记录的 export_meta
        确保页面/接口能立即读到导出状态
        """
        records = self.source.get_for_export()
        if not records:
            raise ValueError("无数据可导出")

        fieldnames = list(records[0].keys())
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(records)

        self._update_export_meta(
            operator=operator,
            export_format="csv",
            file_path=output_path,
            note=note,
            conclusion=f"成功导出 {len(records)} 条记录到 CSV",
        )

        return output_path

    def export_to_json(self, output_path: str, operator: str, note: str = "") -> str:
        """
        导出为JSON格式
        关键：导出完成后必须更新每条记录的 export_meta
        """
        records = self.source.get_for_export()
        if not records:
            raise ValueError("无数据可导出")

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(records, f, ensure_ascii=False, indent=2)

        self._update_export_meta(
            operator=operator,
            export_format="json",
            file_path=output_path,
            note=note,
            conclusion=f"成功导出 {len(records)} 条记录到 JSON",
        )

        return output_path

    def export_abnormal_only(self, output_path: str, operator: str, format: str = "csv", note: str = "") -> str:
        """
        仅导出异常记录
        关键：导出的明细必须包含异常类型、异常说明、处理状态、复核结论
        """
        all_records = self.source.get_for_export()
        abnormal = [r for r in all_records if r.get("是否异常") == "是"]

        if not abnormal:
            raise ValueError("无异常记录可导出")

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        if format == "csv":
            fieldnames = list(abnormal[0].keys())
            with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(abnormal)
        else:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(abnormal, f, ensure_ascii=False, indent=2)

        self._update_export_meta(
            operator=operator,
            export_format=f"{format}_abnormal",
            file_path=output_path,
            note=note,
            conclusion=f"成功导出 {len(abnormal)} 条异常记录",
            include_audit_logs=True,
        )

        return output_path

    def export_leave_consumed_abnormal(self, output_path: str, operator: str, format: str = "csv", note: str = "") -> str:
        """
        专门导出「请假课时被算进已消耗」的异常记录
        这是现场最常见的补录返工场景
        """
        all_records = self.source.get_for_export()
        leave_abnormal = [
            r for r in all_records
            if r.get("异常类型") == AbnormalType.LEAVE_COUNTED_AS_CONSUMED.value
        ]

        if not leave_abnormal:
            raise ValueError("无请假课时被算进已消耗的异常记录")

        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        if format == "csv":
            fieldnames = list(leave_abnormal[0].keys())
            with open(output_path, "w", newline="", encoding="utf-8-sig") as f:
                writer = csv.DictWriter(f, fieldnames=fieldnames)
                writer.writeheader()
                writer.writerows(leave_abnormal)
        else:
            with open(output_path, "w", encoding="utf-8") as f:
                json.dump(leave_abnormal, f, ensure_ascii=False, indent=2)

        self._update_export_meta(
            operator=operator,
            export_format=f"{format}_leave_consumed",
            file_path=output_path,
            note=note,
            conclusion=f"成功导出 {len(leave_abnormal)} 条请假课时被算进已消耗的异常记录",
            include_audit_logs=True,
        )

        return output_path

    def _update_export_meta(self, operator: str, export_format: str, file_path: str,
                           note: str, conclusion: str, include_sources: bool = True,
                           include_audit_logs: bool = False):
        """
        更新所有记录的导出元数据 - 写入单一数据源
        关键：确保页面/接口/导出都能读到同一份导出状态
        """
        all_records = self.source.get_all_records()
        export_time = datetime.now()

        for record in all_records:
            export_meta = ExportMeta(
                exported=True,
                export_time=export_time,
                export_operator=operator,
                export_format=export_format,
                export_file_path=file_path,
                export_note=note,
                export_conclusion=conclusion,
                include_sources=include_sources,
                include_audit_logs=include_audit_logs,
            )
            self.source.update_export_meta(
                record_id=record.id,
                export_meta=export_meta,
                operator=operator,
                note=note,
            )

    def get_export_status_summary(self) -> dict:
        """获取导出状态汇总 - 从单一数据源读取"""
        records = self.source.get_all_records()
        exported = sum(1 for r in records if r.export_meta.exported)
        not_exported = len(records) - exported
        last_export_time = None
        last_export_operator = None

        for r in records:
            if r.export_meta.export_time:
                if last_export_time is None or r.export_meta.export_time > last_export_time:
                    last_export_time = r.export_meta.export_time
                    last_export_operator = r.export_meta.export_operator

        return {
            "total_records": len(records),
            "exported_count": exported,
            "not_exported_count": not_exported,
            "all_exported": exported == len(records) and len(records) > 0,
            "last_export_time": last_export_time.isoformat() if last_export_time else None,
            "last_export_operator": last_export_operator,
        }
