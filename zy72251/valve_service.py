import uuid
from datetime import datetime
from typing import List, Optional, Tuple
from models import (
    ValvePositioningRecord, FloorSketch, PointCloudLog, 
    SafetyDistanceReport, SafetyDistanceIssue, ChangeRecord,
    ValveStatus, Role, NextAction
)


class ValvePositioningService:
    def __init__(self):
        self.records: dict = {}
        self.change_records: List[ChangeRecord] = []

    def _generate_id(self) -> str:
        return str(uuid.uuid4())[:8]

    def _record_change(self, who: str, what_changed: str, why_changed: str, 
                       affected_results: List[str], old_value=None, new_value=None) -> ChangeRecord:
        change = ChangeRecord(
            change_id=self._generate_id(),
            timestamp=datetime.now(),
            who=who,
            what_changed=what_changed,
            why_changed=why_changed,
            affected_results=affected_results,
            old_value=old_value,
            new_value=new_value
        )
        self.change_records.append(change)
        return change

    def import_floor_sketch(self, file_name: str, floor_level: str, 
                            uploaded_by: str, valve_positions: List[dict],
                            has_mobile_screenshot: bool = False) -> ValvePositioningRecord:
        sketch = FloorSketch(
            sketch_id=self._generate_id(),
            import_time=datetime.now(),
            file_name=file_name,
            floor_level=floor_level,
            uploaded_by=uploaded_by,
            marked_valve_positions=valve_positions,
            has_mobile_screenshot=has_mobile_screenshot
        )
        
        record = ValvePositioningRecord(
            record_id=self._generate_id(),
            created_at=datetime.now(),
            floor_sketch=sketch,
            status="草图已导入，待计算安全距离"
        )
        
        self.records[record.record_id] = record
        self._record_change(
            who=uploaded_by,
            what_changed=f"导入楼层剖面草图: {file_name}",
            why_changed="开始阀门定位流程",
            affected_results=[f"记录ID: {record.record_id}"]
        )
        
        return record

    def add_point_cloud_log(self, record_id: str, operator: str, raw_remark: str,
                            thinning_ratio: Optional[float] = None,
                            confidence_level: Optional[float] = None,
                            issues_found: List[str] = None,
                            original_coordinates: dict = None) -> Optional[PointCloudLog]:
        if record_id not in self.records:
            return None
        
        record = self.records[record_id]
        log = PointCloudLog(
            log_id=self._generate_id(),
            timestamp=datetime.now(),
            operator=operator,
            raw_remark=raw_remark,
            thinning_ratio=thinning_ratio,
            confidence_level=confidence_level,
            issues_found=issues_found or [],
            original_coordinates=original_coordinates
        )
        
        old_log_count = len(record.point_cloud_logs)
        record.point_cloud_logs.append(log)
        
        self._record_change(
            who=operator,
            what_changed=f"添加点云抽稀日志: {log.log_id}",
            why_changed=raw_remark,
            affected_results=[f"记录ID: {record_id}", f"安全距离报告待更新"],
            old_value=f"日志数量: {old_log_count}",
            new_value=f"日志数量: {len(record.point_cloud_logs)}"
        )
        record.change_history.append(self.change_records[-1])
        
        return log

    def _detect_screenshot_blocking(self, valve_position: dict) -> Tuple[bool, str]:
        if valve_position.get('has_screenshot_overlay', False):
            return True, "移动端截图覆盖在告警标签区域，标签内容不可见"
        if valve_position.get('label_visibility', 100) < 30:
            return True, f"标签可见度仅{valve_position.get('label_visibility')}%，疑似被截图遮挡"
        return False, ""

    def calculate_safety_distance(self, record_id: str, generated_by: str) -> Optional[SafetyDistanceReport]:
        if record_id not in self.records:
            return None
        
        record = self.records[record_id]
        issues: List[SafetyDistanceIssue] = []
        
        for idx, valve_pos in enumerate(record.floor_sketch.marked_valve_positions):
            valve_id = valve_pos.get('valve_id', f'V-{idx+1:03d}')
            valve_label = valve_pos.get('label', f'阀门-{idx+1}')
            detected_distance = valve_pos.get('distance_to_obstacle', 1.5)
            required_distance = valve_pos.get('required_distance', 2.0)
            
            is_blocked, block_reason = self._detect_screenshot_blocking(valve_pos)
            
            if is_blocked:
                issue = SafetyDistanceIssue(
                    issue_id=self._generate_id(),
                    valve_id=valve_id,
                    valve_label=valve_label,
                    detected_distance=detected_distance,
                    required_distance=required_distance,
                    status=ValveStatus.BLOCKED,
                    why_kept=f"移动端截图挡住了告警标签: {block_reason}。不归为正常，留给施工经理复核。",
                    missing_materials=["清晰的告警标签照片", "无遮挡的现场图片"],
                    next_action=NextAction.CONTACT_CONSTRUCTION_MANAGER,
                    next_action_person=Role.CONSTRUCTION_MANAGER,
                    evidence_photos=valve_pos.get('photos', []),
                    point_cloud_logs_ref=[log.log_id for log in record.point_cloud_logs],
                    is_blocked_by_screenshot=True
                )
            elif detected_distance < required_distance:
                has_logs = len(record.point_cloud_logs) > 0
                if has_logs:
                    latest_log = record.point_cloud_logs[-1]
                    why_kept = f"检测距离{detected_distance}m小于要求{required_distance}m。"
                    why_kept += f"点云抽稀日志备注: {latest_log.raw_remark}"
                    missing_materials = []
                    next_action = NextAction.REVIEW_ON_SITE
                    next_person = Role.PARK_OPERATOR
                else:
                    why_kept = f"检测距离{detected_distance}m小于要求{required_distance}m。暂留待补充点云抽稀日志后确认。"
                    missing_materials = ["点云抽稀日志", "现场复核记录"]
                    next_action = NextAction.SUPPLEMENT_LOGS
                    next_person = Role.PARK_OPERATOR
                
                issue = SafetyDistanceIssue(
                    issue_id=self._generate_id(),
                    valve_id=valve_id,
                    valve_label=valve_label,
                    detected_distance=detected_distance,
                    required_distance=required_distance,
                    status=ValveStatus.NEEDS_MORE_INFO if not has_logs else ValveStatus.ABNORMAL,
                    why_kept=why_kept,
                    missing_materials=missing_materials,
                    next_action=next_action,
                    next_action_person=next_person,
                    evidence_photos=valve_pos.get('photos', []),
                    point_cloud_logs_ref=[log.log_id for log in record.point_cloud_logs]
                )
            else:
                issue = SafetyDistanceIssue(
                    issue_id=self._generate_id(),
                    valve_id=valve_id,
                    valve_label=valve_label,
                    detected_distance=detected_distance,
                    required_distance=required_distance,
                    status=ValveStatus.NORMAL,
                    why_kept=f"检测距离{detected_distance}m符合要求{required_distance}m。",
                    missing_materials=[],
                    next_action=NextAction.ARCHIVE,
                    next_action_person=Role.SYSTEM,
                    evidence_photos=valve_pos.get('photos', []),
                    point_cloud_logs_ref=[log.log_id for log in record.point_cloud_logs]
                )
            
            issues.append(issue)
        
        blocked_count = sum(1 for i in issues if i.is_blocked_by_screenshot)
        abnormal_count = sum(1 for i in issues if i.status == ValveStatus.ABNORMAL)
        normal_count = sum(1 for i in issues if i.status == ValveStatus.NORMAL)
        
        report = SafetyDistanceReport(
            report_id=self._generate_id(),
            generated_at=datetime.now(),
            generated_by=generated_by,
            issues=issues,
            summary={
                "total_valves": len(issues),
                "normal_count": normal_count,
                "abnormal_count": abnormal_count,
                "blocked_count": blocked_count,
                "needs_attention": blocked_count + abnormal_count,
                "has_point_cloud_logs": len(record.point_cloud_logs) > 0
            },
            change_history=list(record.change_history)
        )
        
        old_report = record.safety_report
        record.safety_report = report
        record.status = "安全距离报告已生成"
        record.run_count += 1
        
        self._record_change(
            who=generated_by,
            what_changed=f"生成/更新安全距离报告: {report.report_id}",
            why_changed="计算完成或点云日志更新后重跑",
            affected_results=[f"发现{blocked_count}个截图遮挡", f"发现{abnormal_count}个距离异常", f"报告ID: {report.report_id}"],
            old_value=f"旧报告ID: {old_report.report_id if old_report else '无'}",
            new_value=f"新报告ID: {report.report_id}"
        )
        record.change_history.append(self.change_records[-1])
        
        return report

    def manual_correct_issue(self, record_id: str, issue_id: str, corrected_by: str,
                             correction_reason: str, new_status: ValveStatus,
                             new_next_action: Optional[NextAction] = None) -> bool:
        if record_id not in self.records:
            return False
        
        record = self.records[record_id]
        if not record.safety_report:
            return False
        
        for issue in record.safety_report.issues:
            if issue.issue_id == issue_id:
                old_status = issue.status
                old_next = issue.next_action
                
                issue.status = new_status
                issue.why_kept += f" | 人工修正: {correction_reason} (by {corrected_by})"
                if new_next_action:
                    issue.next_action = new_next_action
                
                self._record_change(
                    who=corrected_by,
                    what_changed=f"人工修正问题: {issue_id}",
                    why_changed=correction_reason,
                    affected_results=[f"阀门: {issue.valve_label}", f"状态: {old_status} -> {new_status}"],
                    old_value={"status": old_status, "next_action": old_next},
                    new_value={"status": new_status, "next_action": issue.next_action}
                )
                record.change_history.append(self.change_records[-1])
                
                return True
        
        return False

    def get_all_changes(self) -> List[ChangeRecord]:
        return sorted(self.change_records, key=lambda x: x.timestamp, reverse=True)

    def get_record(self, record_id: str) -> Optional[ValvePositioningRecord]:
        return self.records.get(record_id)
