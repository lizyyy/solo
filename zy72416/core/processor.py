import re
import uuid
from datetime import datetime
from typing import List, Tuple, Optional
from .models import (
    ScheduleRecord,
    RecordStatus,
    AbnormalType,
    ProcessStep,
    SourceLine,
    AuditLog,
)
from .single_source import SingleSourceOfTruth


class BoundaryRules:
    """
    边界规则引擎 - 所有判定逻辑集中在此
    规则说明：
    1. 请假课时被标记为已消耗 → 判定为异常，标记为 REVIEW_REQUIRED，不能自动归正常
    2. 多来源数据不一致 → 标记异常，需要人工核对
    3. 人工改动必须留痕，记录前后状态
    4. 回滚操作必须有记录，且可追溯到原始数据
    """

    @staticmethod
    def check_leave_counted_as_consumed(record: ScheduleRecord) -> Tuple[bool, str]:
        """
        边界规则：请假课时被算进已消耗
        判定条件：
        - 记录标记为 is_leave = True
        - 同时记录标记为 consumed = True
        处理结果：
        - 状态设为 REVIEW_REQUIRED
        - 异常类型设为 LEAVE_COUNTED_AS_CONSUMED
        - 不能自动归为正常，必须由巡演统筹复核
        """
        if record.is_leave and record.consumed:
            return True, "请假课时被计入已消耗，需巡演统筹复核"
        return False, ""

    @staticmethod
    def check_source_mismatch(record: ScheduleRecord) -> Tuple[bool, str]:
        """
        边界规则：多来源数据不一致
        判定条件：
        - 同一记录有多个来源
        - 不同来源的关键字段（日期、时间、时长）不一致
        - 只比对两个来源都存在的字段，某来源缺失的字段跳过
        """
        if len(record.sources) < 2:
            return False, ""
        key_fields = ["scheduled_date", "scheduled_time", "duration_minutes", "track_name"]
        first_source = record.sources[0].parsed_data
        for src in record.sources[1:]:
            for field in key_fields:
                src_val = src.parsed_data.get(field)
                first_val = first_source.get(field)
                if src_val is not None and first_val is not None and src_val != first_val:
                    return True, f"来源[{src.source_name}]与[{record.sources[0].source_name}]在字段[{field}]不一致"
        return False, ""

    @staticmethod
    def can_rollback(record: ScheduleRecord) -> Tuple[bool, str]:
        """
        边界规则：能否回滚
        判定条件：
        - 记录状态不是 PENDING
        - 存在至少一条审计日志
        - 回滚必须由有权限的人操作（此处不做权限，只做状态检查）
        """
        if record.status == RecordStatus.PENDING:
            return False, "待处理状态无需回滚"
        if not record.audit_logs:
            return False, "无历史记录，无法回滚"
        return True, "可以回滚"

    @staticmethod
    def can_approve_abnormal(record: ScheduleRecord) -> Tuple[bool, str]:
        """
        边界规则：能否复核通过异常
        判定条件：
        - 状态必须是 REVIEW_REQUIRED 或 ABNORMAL
        - 必须由巡演统筹操作（此处只做状态检查）
        """
        if record.status not in [RecordStatus.REVIEW_REQUIRED, RecordStatus.ABNORMAL]:
            return False, f"当前状态[{record.status}]无需复核"
        return True, "可以复核"


class ScheduleProcessor:
    """排期流程处理器 - 实现三步核心流程"""

    def __init__(self, source_of_truth: SingleSourceOfTruth):
        self.source = source_of_truth
        self.rules = BoundaryRules()

    def step1_import_engineer_messages(self, messages: List[str], operator: str) -> List[ScheduleRecord]:
        """
        第一步：导入调音师留言
        输入：调音师留言的原始文本行列表
        输出：创建的排期记录列表
        行为：
        - 解析每一行留言
        - 记录原始行号和内容作为证据
        - 初始状态 PENDING
        """
        records = []
        for line_num, raw_line in enumerate(messages, 1):
            parsed = self._parse_engineer_message(raw_line)
            if not parsed:
                continue

            record_id = str(uuid.uuid4())[:8]
            record = ScheduleRecord(
                id=record_id,
                episode_number=parsed["episode_number"],
                track_name=parsed["track_name"],
                scheduled_date=parsed["scheduled_date"],
                scheduled_time=parsed["scheduled_time"],
                duration_minutes=parsed["duration_minutes"],
                engineer_name=parsed["engineer_name"],
                consumed=parsed.get("consumed", False),
                is_leave=parsed.get("is_leave", False),
                current_step=ProcessStep.STEP1_IMPORT,
            )

            source_line = SourceLine(
                source_name="调音师留言",
                line_number=line_num,
                raw_content=raw_line,
                parsed_data=parsed,
            )
            record.sources.append(source_line)

            audit_log = AuditLog(
                timestamp=datetime.now(),
                step=ProcessStep.STEP1_IMPORT,
                operator=operator,
                action="导入调音师留言",
                after=record.to_dict(),
                note=f"从调音师留言第{line_num}行导入",
            )
            record.audit_logs.append(audit_log)

            self.source.add_record(record)
            records.append(record)

        return records

    def step2_check_group_signup(self, record_id: str, group_signup_text: str, operator: str) -> ScheduleRecord:
        """
        第二步：录音师小段补看排练群接龙
        输入：记录ID + 群接龙原始文本
        行为：
        - 解析群接龙信息
        - 与已有记录比对
        - 发现请假课时被算进已消耗时，标记为待统筹复核，不自动归正常
        - 记录接龙信息作为第二个证据来源
        """
        record = self.source.get_record(record_id)
        if not record:
            raise ValueError(f"记录 {record_id} 不存在")

        parsed = self._parse_group_signup(group_signup_text)
        before = record.to_dict()

        source_line = SourceLine(
            source_name="排练群接龙",
            line_number=1,
            raw_content=group_signup_text,
            parsed_data=parsed,
        )
        record.sources.append(source_line)

        if parsed.get("is_leave"):
            record.is_leave = True

        record.current_step = ProcessStep.STEP2_CHECK_GROUP

        is_abnormal, note = self.rules.check_leave_counted_as_consumed(record)
        if is_abnormal:
            record.status = RecordStatus.REVIEW_REQUIRED
            record.abnormal_type = AbnormalType.LEAVE_COUNTED_AS_CONSUMED
            record.abnormal_note = note
        else:
            is_mismatch, mismatch_note = self.rules.check_source_mismatch(record)
            if is_mismatch:
                record.status = RecordStatus.ABNORMAL
                record.abnormal_type = AbnormalType.MISMATCH_BETWEEN_SOURCES
                record.abnormal_note = mismatch_note
            else:
                record.status = RecordStatus.PENDING

        audit_log = AuditLog(
            timestamp=datetime.now(),
            step=ProcessStep.STEP2_CHECK_GROUP,
            operator=operator,
            action="核对排练群接龙",
            before=before,
            after=record.to_dict(),
            note=f"核对结果: {'异常-待复核' if is_abnormal else '正常' if record.status == RecordStatus.PENDING else '异常'}",
        )
        record.audit_logs.append(audit_log)

        self.source._save()
        return record

    def step3_update_tracklist(self, record_id: str, track_info: dict, operator: str) -> ScheduleRecord:
        """
        第三步：曲目核对表更新
        输入：记录ID + 曲目核对信息
        行为：
        - 更新曲目信息
        - 如果是待复核状态，保持不变，不能自动归正常
        - 只有正常状态的记录才推进为 NORMAL
        """
        record = self.source.get_record(record_id)
        if not record:
            raise ValueError(f"记录 {record_id} 不存在")

        before = record.to_dict()

        source_line = SourceLine(
            source_name="曲目核对表",
            line_number=1,
            raw_content=str(track_info),
            parsed_data=track_info,
        )
        record.sources.append(source_line)

        if track_info.get("track_name"):
            record.track_name = track_info["track_name"]
        if track_info.get("duration_minutes"):
            record.duration_minutes = track_info["duration_minutes"]

        record.current_step = ProcessStep.STEP3_UPDATE_TRACKLIST

        if record.status == RecordStatus.PENDING:
            record.status = RecordStatus.NORMAL
        elif record.status == RecordStatus.REVIEW_REQUIRED:
            pass

        audit_log = AuditLog(
            timestamp=datetime.now(),
            step=ProcessStep.STEP3_UPDATE_TRACKLIST,
            operator=operator,
            action="更新曲目核对表",
            before=before,
            after=record.to_dict(),
        )
        record.audit_logs.append(audit_log)

        self.source._save()
        return record

    def coordinator_review(self, record_id: str, approved: bool, reviewer: str, note: str = "") -> ScheduleRecord:
        """
        巡演统筹复核
        approved=True → 复核通过，状态变为 REVIEW_APPROVED
        approved=False → 复核驳回，状态变为 REVIEW_REJECTED，同时取消 consumed 标记
        """
        record = self.source.get_record(record_id)
        if not record:
            raise ValueError(f"记录 {record_id} 不存在")

        can_review, reason = self.rules.can_approve_abnormal(record)
        if not can_review:
            raise ValueError(reason)

        before = record.to_dict()

        if approved:
            record.status = RecordStatus.REVIEW_APPROVED
            record.reviewer = reviewer
            record.review_time = datetime.now()
        else:
            record.status = RecordStatus.REVIEW_REJECTED
            record.consumed = False
            record.reviewer = reviewer
            record.review_time = datetime.now()

        audit_log = AuditLog(
            timestamp=datetime.now(),
            step=record.current_step,
            operator=reviewer,
            action="统筹复核" + ("通过" if approved else "驳回"),
            before=before,
            after=record.to_dict(),
            note=note,
        )
        record.audit_logs.append(audit_log)

        self.source._save()
        return record

    def rollback(self, record_id: str, operator: str, reason: str) -> ScheduleRecord:
        """
        回滚记录到上一个状态
        边界：必须有历史记录才能回滚
        """
        record = self.source.get_record(record_id)
        if not record:
            raise ValueError(f"记录 {record_id} 不存在")

        can_rollback, reason_check = self.rules.can_rollback(record)
        if not can_rollback:
            raise ValueError(reason_check)

        before = record.to_dict()

        if len(record.audit_logs) >= 2:
            prev_state = record.audit_logs[-2].after
        else:
            prev_state = record.audit_logs[0].before

        if prev_state:
            for key, value in prev_state.items():
                if key in ["id", "sources", "audit_logs", "manual_edits"]:
                    continue
                if hasattr(record, key):
                    setattr(record, key, value)

        record.status = RecordStatus.ROLLED_BACK

        audit_log = AuditLog(
            timestamp=datetime.now(),
            step=record.current_step,
            operator=operator,
            action="回滚",
            before=before,
            after=record.to_dict(),
            note=reason,
        )
        record.audit_logs.append(audit_log)

        self.source._save()
        return record

    def _parse_engineer_message(self, line: str) -> Optional[dict]:
        """解析调音师留言行，格式示例：EP01|片头音乐|2026-06-06|14:00|30|张工|已消耗"""
        parts = [p.strip() for p in line.split("|")]
        if len(parts) < 6:
            return None
        result = {
            "episode_number": parts[0],
            "track_name": parts[1],
            "scheduled_date": parts[2],
            "scheduled_time": parts[3],
            "duration_minutes": int(parts[4]),
            "engineer_name": parts[5],
            "consumed": len(parts) > 6 and "已消耗" in parts[6],
            "is_leave": False,
        }
        return result

    def _parse_group_signup(self, text: str) -> dict:
        """解析群接龙文本，检查是否有请假标记"""
        is_leave = "请假" in text or "有事" in text or "不来" in text
        return {
            "raw_text": text,
            "is_leave": is_leave,
        }
