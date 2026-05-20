from datetime import datetime, timedelta
from typing import List, Dict, Any, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import and_

from app.models.models import (
    CheckInRecord, LeaveRecord, LocationSummary, ProcessingResult,
    ProcessingStatus, RecordType
)
from app.schemas.schemas import ProcessingResultItem


class RuleResult:
    def __init__(self, status: ProcessingStatus, rule_code: str, rule_name: str,
                 suggestion: str, detail: str = None):
        self.status = status
        self.rule_code = rule_code
        self.rule_name = rule_name
        self.suggestion = suggestion
        self.detail = detail


class CheckInRules:
    @staticmethod
    def check_timeout(checkin_time: datetime, scheduled_time: datetime,
                      timeout_minutes: int = 30) -> RuleResult:
        if not checkin_time or not scheduled_time:
            return RuleResult(
                ProcessingStatus.PENDING_CONFIRM,
                "CHECKIN_TIME_MISSING",
                "签到时间缺失",
                "请核实该人员的签到时间信息，联系上报源确认",
                "签到时间或应到时间为空"
            )
        
        delay = (checkin_time - scheduled_time).total_seconds() / 60
        
        if delay > timeout_minutes * 2:
            return RuleResult(
                ProcessingStatus.FAILED,
                "CHECKIN_TIMEOUT_SEVERE",
                "严重超时未签",
                f"签到超时{int(delay)}分钟，超过{timeout_minutes * 2}分钟阈值。需立即联系该人员核实情况，必要时进行实地走访",
                f"应到时间：{scheduled_time}，实到时间：{checkin_time}，延迟：{int(delay)}分钟"
            )
        elif delay > timeout_minutes:
            return RuleResult(
                ProcessingStatus.PENDING_CONFIRM,
                "CHECKIN_TIMEOUT",
                "超时未签",
                f"签到超时{int(delay)}分钟。需联系该人员核实原因，记录超时说明",
                f"应到时间：{scheduled_time}，实到时间：{checkin_time}，延迟：{int(delay)}分钟"
            )
        
        return RuleResult(
            ProcessingStatus.NORMAL,
            "CHECKIN_NORMAL",
            "签到正常",
            "签到时间正常，无需处理"
        )

    @staticmethod
    def check_leave_coverage(db: Session, person_id: str, checkin_time: datetime) -> RuleResult:
        if not checkin_time:
            return None
        
        leaves = db.query(LeaveRecord).filter(
            and_(
                LeaveRecord.person_id == person_id,
                LeaveRecord.status == "approved",
                LeaveRecord.start_time <= checkin_time,
                LeaveRecord.end_time >= checkin_time
            )
        ).all()
        
        if leaves:
            leave_info = [f"{l.start_time.strftime('%m-%d')}至{l.end_time.strftime('%m-%d')}: {l.reason}" for l in leaves]
            return RuleResult(
                ProcessingStatus.NORMAL,
                "LEAVE_COVERAGE",
                "请假覆盖",
                "该时间段处于请假期间，无需签到，记录正常",
                f"有效请假：{'; '.join(leave_info)}"
            )
        
        return None


class LocationRules:
    @staticmethod
    def check_trajectory_gap(gap_count: int, max_gap_minutes: float,
                             gap_threshold: int = 3, max_gap_threshold: float = 120) -> RuleResult:
        if max_gap_minutes > max_gap_threshold:
            return RuleResult(
                ProcessingStatus.FAILED,
                "TRAJECTORY_GAP_SEVERE",
                "轨迹严重缺失",
                f"最大定位间隔{int(max_gap_minutes)}分钟，超过{max_gap_threshold}分钟阈值。需立即核实该人员当日活动轨迹，确认是否脱管",
                f"当日缺口数：{gap_count}，最大缺口：{int(max_gap_minutes)}分钟"
            )
        elif gap_count > gap_threshold:
            return RuleResult(
                ProcessingStatus.PENDING_CONFIRM,
                "TRAJECTORY_GAP",
                "轨迹缺口",
                f"当日定位缺口{gap_count}处，超过{gap_threshold}处阈值。需联系该人员核实定位异常原因",
                f"当日缺口数：{gap_count}，最大缺口：{int(max_gap_minutes)}分钟"
            )
        elif max_gap_minutes > max_gap_threshold * 0.5:
            return RuleResult(
                ProcessingStatus.PENDING_CONFIRM,
                "TRAJECTORY_GAP_LONG",
                "轨迹长时缺失",
                f"最大定位间隔{int(max_gap_minutes)}分钟，需确认是否正常情况",
                f"最大缺口：{int(max_gap_minutes)}分钟"
            )
        
        return RuleResult(
            ProcessingStatus.NORMAL,
            "LOCATION_NORMAL",
            "定位正常",
            "定位轨迹正常，无明显异常"
        )

    @staticmethod
    def check_out_of_bounds(out_of_bounds: bool) -> RuleResult:
        if out_of_bounds:
            return RuleResult(
                ProcessingStatus.FAILED,
                "OUT_OF_BOUNDS",
                "越界警告",
                "该人员出现越界行为，需立即核实并采取相应措施",
                "系统检测到超出活动范围"
            )
        return None


class RulesEngine:
    def __init__(self, db: Session):
        self.db = db

    def process_checkin_record(self, record: CheckInRecord) -> ProcessingResultItem:
        original_data = record.raw_data
        results = []
        
        leave_result = CheckInRules.check_leave_coverage(self.db, record.person_id, record.checkin_time)
        if leave_result:
            return ProcessingResultItem(
                person_id=record.person_id,
                person_name=record.person_name,
                status=leave_result.status,
                rule_code=leave_result.rule_code,
                rule_name=leave_result.rule_name,
                suggestion=leave_result.suggestion,
                original_data=original_data,
                detail=leave_result.detail
            )
        
        timeout_result = CheckInRules.check_timeout(record.checkin_time, record.scheduled_time)
        results.append(timeout_result)
        
        final_result = max(results, key=lambda r: self._status_priority(r.status))
        
        return ProcessingResultItem(
            person_id=record.person_id,
            person_name=record.person_name,
            status=final_result.status,
            rule_code=final_result.rule_code,
            rule_name=final_result.rule_name,
            suggestion=final_result.suggestion,
            original_data=original_data,
            detail=final_result.detail
        )

    def process_location_record(self, record: LocationSummary) -> ProcessingResultItem:
        original_data = record.raw_data
        results = []
        
        bounds_result = LocationRules.check_out_of_bounds(record.out_of_bounds)
        if bounds_result:
            results.append(bounds_result)
        
        gap_result = LocationRules.check_trajectory_gap(
            record.gap_count, record.max_gap_minutes
        )
        results.append(gap_result)
        
        final_result = max(results, key=lambda r: self._status_priority(r.status))
        
        return ProcessingResultItem(
            person_id=record.person_id,
            person_name=record.person_name,
            status=final_result.status,
            rule_code=final_result.rule_code,
            rule_name=final_result.rule_name,
            suggestion=final_result.suggestion,
            original_data=original_data,
            detail=final_result.detail
        )

    def _status_priority(self, status: ProcessingStatus) -> int:
        priority = {
            ProcessingStatus.FAILED: 3,
            ProcessingStatus.PENDING_CONFIRM: 2,
            ProcessingStatus.NORMAL: 1
        }
        return priority.get(status, 0)

    def save_processing_results(self, batch_id: int, record_type: RecordType,
                                results: List[ProcessingResultItem]) -> None:
        for result in results:
            db_result = ProcessingResult(
                batch_id=batch_id,
                record_type=record_type,
                person_id=result.person_id,
                person_name=result.person_name,
                status=result.status,
                rule_code=result.rule_code,
                rule_name=result.rule_name,
                suggestion=result.suggestion,
                original_data=str(result.original_data) if result.original_data else None,
                detail=result.detail
            )
            self.db.add(db_result)
        self.db.commit()
