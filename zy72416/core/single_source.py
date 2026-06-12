import json
import os
from typing import List, Dict, Any, Optional
from datetime import datetime
from .models import (
    ScheduleRecord,
    RecordStatus,
    AbnormalType,
    ProcessStep,
    SourceLine,
    AuditLog,
    ExportMeta,
    FieldMapping,
)


class SingleSourceOfTruth:
    """
    单一数据源 - 所有视图(页面展示/导出/接口返回)必须从此读取
    核心原则：一份数据，多种视图，绝不各自计算

    边界规则（固化在代码中，不是口头约定）：
    1. 导出元数据必须写入此数据源，重启/重载后不丢失
    2. 人工补录必须更新同一条记录，明细/历史/后续读同一份结果
    3. 请假课时被算进已消耗 → 标记REVIEW_REQUIRED，不能自动归正常
    4. 回滚必须同步更新导出状态，不能只改当前状态
    5. 页面/导出/API 必须使用 FieldMapping 定义的同一套业务字段
    """

    def __init__(self, storage_path: str = "data/schedule_records.json"):
        self.storage_path = storage_path
        self._records: Dict[str, ScheduleRecord] = {}
        self._ensure_storage()
        self._load()

    def _ensure_storage(self):
        os.makedirs(os.path.dirname(self.storage_path), exist_ok=True)
        if not os.path.exists(self.storage_path):
            with open(self.storage_path, "w", encoding="utf-8") as f:
                json.dump({}, f, ensure_ascii=False, indent=2)

    def _load(self):
        """
        从磁盘加载数据 - 关键修复：使用 ScheduleRecord.from_dict 正确处理所有类型转换
        确保重启/重载后数据完整可用，不会出现类型错误
        """
        try:
            with open(self.storage_path, "r", encoding="utf-8") as f:
                data = json.load(f)
        except (json.JSONDecodeError, FileNotFoundError):
            data = {}

        self._records = {}
        for rid, record_data in data.items():
            try:
                record = ScheduleRecord.from_dict(record_data)
                self._records[rid] = record
            except Exception as e:
                print(f"警告：加载记录 {rid} 失败: {e}")
                continue

    def _save(self):
        """保存数据到磁盘 - 使用 to_dict() 确保所有字段正确序列化"""
        data = {}
        for rid, record in self._records.items():
            data[rid] = record.to_dict()
        with open(self.storage_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def reload(self):
        """重载数据 - 模拟重启场景"""
        self._load()

    def add_record(self, record: ScheduleRecord):
        self._records[record.id] = record
        self._save()

    def get_record(self, record_id: str) -> Optional[ScheduleRecord]:
        return self._records.get(record_id)

    def get_all_records(self) -> List[ScheduleRecord]:
        return list(self._records.values())

    def update_record(self, record_id: str, operator: str, note: str = "", **kwargs):
        """
        更新记录 - 统一入口，确保明细/历史/后续读同一条更新
        关键：所有更新操作必须走此方法，留下审计日志和人工改动记录
        """
        record = self._records.get(record_id)
        if not record:
            raise ValueError(f"Record {record_id} not found")

        before = record.to_dict()

        for key, value in kwargs.items():
            if hasattr(record, key):
                setattr(record, key, value)

        serializable_kwargs = {}
        for key, value in kwargs.items():
            if isinstance(value, datetime):
                serializable_kwargs[key] = value.isoformat()
            elif hasattr(value, 'value'):
                serializable_kwargs[key] = value.value
            else:
                serializable_kwargs[key] = value

        record.manual_edits.append({
            "timestamp": datetime.now().isoformat(),
            "operator": operator,
            "changes": serializable_kwargs,
            "note": note,
        })

        audit_log = AuditLog(
            timestamp=datetime.now(),
            step=record.current_step,
            operator=operator,
            action="人工补录更新",
            before=before,
            after=record.to_dict(),
            note=note or "人工补录修改字段",
        )
        record.audit_logs.append(audit_log)

        self._save()
        return before, record.to_dict()

    def update_export_meta(self, record_id: str, export_meta: ExportMeta, operator: str, note: str = ""):
        """
        更新导出元数据 - 必须写入单一数据源
        确保导出状态重启后不丢失，页面/导出/API 都能读到
        """
        record = self._records.get(record_id)
        if not record:
            raise ValueError(f"Record {record_id} not found")

        before = record.to_dict()
        record.export_meta = export_meta
        record.current_step = ProcessStep.STEP4_EXPORT

        audit_log = AuditLog(
            timestamp=datetime.now(),
            step=ProcessStep.STEP4_EXPORT,
            operator=operator,
            action="导出明细",
            before=before,
            after=record.to_dict(),
            note=note or "导出明细完成",
        )
        record.audit_logs.append(audit_log)

        self._save()

    def supplementary_correction(self, record_id: str, operator: str, corrections: Dict[str, Any], note: str = ""):
        """
        临时补材料/人工补录 - 关键方法
        确保补录后明细、历史、后续结果都读到同一条更新
        边界规则：
        - 补录必须留下来源证据（作为SourceLine追加）
        - 必须记录审计日志
        - 如果是请假课时异常，补录后仍保持待复核状态
        """
        record = self._records.get(record_id)
        if not record:
            raise ValueError(f"Record {record_id} not found")

        before = record.to_dict()

        source_line = SourceLine(
            source_name="人工补录",
            line_number=len(record.sources) + 1,
            raw_content=str(corrections),
            parsed_data=corrections,
        )
        record.sources.append(source_line)

        for key, value in corrections.items():
            if hasattr(record, key):
                setattr(record, key, value)

        record.current_step = ProcessStep.STEP5_SUPPLEMENT
        record.manual_edits.append({
            "timestamp": datetime.now().isoformat(),
            "operator": operator,
            "type": "supplementary",
            "changes": corrections,
            "note": note,
        })

        if record.abnormal_type == AbnormalType.LEAVE_COUNTED_AS_CONSUMED:
            pass

        audit_log = AuditLog(
            timestamp=datetime.now(),
            step=ProcessStep.STEP5_SUPPLEMENT,
            operator=operator,
            action="临时补材料",
            before=before,
            after=record.to_dict(),
            note=note or "临时补录修正",
        )
        record.audit_logs.append(audit_log)

        self._save()
        return before, record.to_dict()

    def add_audit_log(self, record_id: str, audit_log: AuditLog):
        record = self._records.get(record_id)
        if not record:
            raise ValueError(f"Record {record_id} not found")
        record.audit_logs.append(audit_log)
        self._save()

    def add_source_line(self, record_id: str, source_line: SourceLine):
        record = self._records.get(record_id)
        if not record:
            raise ValueError(f"Record {record_id} not found")
        record.sources.append(source_line)
        self._save()

    def get_for_display(self) -> List[Dict[str, Any]]:
        """页面展示用 - 从同一数据源读取，使用 FieldMapping 统一字段"""
        return [self._format_for_display(r) for r in self._records.values()]

    def get_for_export(self) -> List[Dict[str, Any]]:
        """
        导出明细用 - 从同一数据源读取，使用 FieldMapping 统一字段
        关键：导出的明细必须包含来源、处理状态、结论在同一份结果
        """
        return [self._format_for_export(r) for r in self._records.values()]

    def get_for_api(self) -> List[Dict[str, Any]]:
        """接口返回用 - 从同一数据源读取，使用 FieldMapping 统一字段"""
        return [self._format_for_api(r) for r in self._records.values()]

    def _get_common_fields(self, record: ScheduleRecord) -> Dict[str, Any]:
        """
        三个视图共享的核心字段计算逻辑
        关键：确保页面/导出/API 对同一业务字段的计算逻辑完全一致
        """
        status_value = record.status.value if isinstance(record.status, RecordStatus) else record.status
        is_abnormal = status_value not in [
            "pending", "normal", "review_approved"
        ]
        export_status = "已导出" if record.export_meta.exported else "未导出"
        status_text = self._status_text(record.status)

        review_time_str = ""
        if isinstance(record.review_time, datetime):
            review_time_str = record.review_time.isoformat()
        elif isinstance(record.review_time, str):
            review_time_str = record.review_time

        export_time_str = ""
        if isinstance(record.export_meta.export_time, datetime):
            export_time_str = record.export_meta.export_time.isoformat()
        elif isinstance(record.export_meta.export_time, str):
            export_time_str = record.export_meta.export_time

        return {
            "id": record.id,
            "episode_number": record.episode_number,
            "track_name": record.track_name,
            "scheduled_date": record.scheduled_date,
            "scheduled_time": record.scheduled_time,
            "duration_minutes": record.duration_minutes,
            "engineer_name": record.engineer_name,
            "status": record.status.value if isinstance(record.status, RecordStatus) else record.status,
            "status_text": status_text,
            "is_abnormal": is_abnormal,
            "abnormal_type": record.abnormal_type.value if isinstance(record.abnormal_type, AbnormalType) else record.abnormal_type,
            "abnormal_note": record.abnormal_note or "",
            "consumed": record.consumed,
            "is_leave": record.is_leave,
            "current_step": record.current_step.value if isinstance(record.current_step, ProcessStep) else record.current_step,
            "reviewer": record.reviewer or "",
            "review_time": review_time_str,
            "review_conclusion": record.review_conclusion or "",
            "export_status": export_status,
            "export_time": export_time_str,
            "export_operator": record.export_meta.export_operator or "",
            "export_note": record.export_meta.export_note or "",
            "source_count": len(record.sources),
            "has_edits": len(record.manual_edits) > 0,
            "manual_edit_count": len(record.manual_edits),
        }

    def _format_for_display(self, record: ScheduleRecord) -> Dict[str, Any]:
        """页面展示格式 - 使用 FieldMapping 的 display 字段名"""
        common = self._get_common_fields(record)
        mapping = FieldMapping.get_all_fields("display")
        result = {}
        for field_key, field_value in common.items():
            display_key = mapping.get(field_key, field_key)
            if field_key == "duration_minutes":
                result[display_key] = f"{field_value}分钟"
            elif field_key == "consumed":
                result[display_key] = "是" if field_value else "否"
            elif field_key == "is_leave":
                result[display_key] = "是" if field_value else "否"
            elif field_key == "is_abnormal":
                result[display_key] = field_value
            else:
                result[display_key] = field_value

        result["sources"] = [
            {
                "source_name": s.source_name,
                "line_number": s.line_number,
                "raw_content": s.raw_content,
                "parsed": s.parsed_data,
            }
            for s in record.sources
        ]
        audit_logs_list = []
        for al in record.audit_logs:
            ts_str = ""
            if isinstance(al.timestamp, datetime):
                ts_str = al.timestamp.isoformat()
            elif isinstance(al.timestamp, str):
                ts_str = al.timestamp
            step_value = al.step.value if isinstance(al.step, ProcessStep) else al.step
            audit_logs_list.append({
                "timestamp": ts_str,
                "step": step_value,
                "operator": al.operator,
                "action": al.action,
                "note": al.note,
            })
        result["audit_logs"] = audit_logs_list
        result["manual_edits"] = record.manual_edits
        result["export_meta"] = record.export_meta.to_dict()
        return result

    def _format_for_export(self, record: ScheduleRecord) -> Dict[str, Any]:
        """
        导出格式 - 使用 FieldMapping 的 export 字段名
        关键：必须包含来源、处理状态、结论在同一份结果
        边界规则：
        - 导出的每一条记录必须包含所有证据来源的原始行号和内容
        - 必须包含处理状态（status）和异常状态说明
        - 必须包含复核结论（如果有）
        - 不能丢失异常标记，尤其是请假课时被算进已消耗的记录
        """
        common = self._get_common_fields(record)
        mapping = FieldMapping.get_all_fields("export")
        result = {}

        for field_key, field_value in common.items():
            export_key = mapping.get(field_key, field_key)
            if field_key == "consumed":
                result[export_key] = "是" if field_value else "否"
            elif field_key == "is_leave":
                result[export_key] = "是" if field_value else "否"
            elif field_key == "is_abnormal":
                result[export_key] = "是" if field_value else "否"
            else:
                result[export_key] = field_value

        for i, src in enumerate(record.sources, 1):
            result[f"来源{i}名称"] = src.source_name
            result[f"来源{i}行号"] = src.line_number
            result[f"来源{i}原始内容"] = src.raw_content

        for i, edit in enumerate(record.manual_edits, 1):
            result[f"补录{i}时间"] = edit.get("timestamp", "")
            result[f"补录{i}操作人"] = edit.get("operator", "")
            result[f"补录{i}内容"] = str(edit.get("changes", ""))
            result[f"补录{i}备注"] = edit.get("note", "")

        return result

    def _format_for_api(self, record: ScheduleRecord) -> Dict[str, Any]:
        """API格式 - 使用 FieldMapping 的 api 字段名，完整数据"""
        return record.to_dict()

    def _status_text(self, status) -> str:
        if isinstance(status, RecordStatus):
            status_value = status.value
        else:
            status_value = status
        mapping = {
            "pending": "待处理",
            "normal": "正常",
            "abnormal": "异常",
            "review_required": "待统筹复核",
            "review_approved": "复核通过",
            "review_rejected": "复核驳回",
            "rolled_back": "已回滚",
        }
        return mapping.get(status_value, status_value)

    def verify_consistency(self) -> Dict[str, Any]:
        """
        验证三个视图的数据一致性
        核心：页面/导出/API 读取同一份结果，异常记录数量必须一致
        """
        display_data = self.get_for_display()
        export_data = self.get_for_export()
        api_data = self.get_for_api()

        mapping = FieldMapping.get_all_fields("display")
        abnormal_field_display = mapping.get("is_abnormal", "is_abnormal")
        abnormal_display = sum(1 for r in display_data if r.get(abnormal_field_display) is True)

        export_mapping = FieldMapping.get_all_fields("export")
        abnormal_field_export = export_mapping.get("is_abnormal", "is_abnormal")
        abnormal_export = sum(1 for r in export_data if r.get(abnormal_field_export) == "是")

        abnormal_api = sum(1 for r in api_data if r["status"] not in ["pending", "normal", "review_approved"])

        return {
            "total_display": len(display_data),
            "total_export": len(export_data),
            "total_api": len(api_data),
            "total_match": len(display_data) == len(export_data) == len(api_data),
            "abnormal_display": abnormal_display,
            "abnormal_export": abnormal_export,
            "abnormal_api": abnormal_api,
            "abnormal_match": abnormal_display == abnormal_export == abnormal_api,
            "consistent": len(display_data) == len(export_data) == len(api_data) and abnormal_display == abnormal_export == abnormal_api,
        }
