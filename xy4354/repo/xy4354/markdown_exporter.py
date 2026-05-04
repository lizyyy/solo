from typing import List, Dict, Any, Optional
from datetime import datetime
from collections import defaultdict

from .models import (
    ScheduleResult, ScheduleAssignment, Conflict, Gap,
    Volunteer, Course, LeaveRequest, SwapRequest,
    DayOfWeek
)


class MarkdownExporter:
    def __init__(self):
        self.day_order = [
            DayOfWeek.MONDAY,
            DayOfWeek.TUESDAY,
            DayOfWeek.WEDNESDAY,
            DayOfWeek.THURSDAY,
            DayOfWeek.FRIDAY,
            DayOfWeek.SATURDAY,
            DayOfWeek.SUNDAY
        ]

    def export_schedule(
        self,
        schedule_result: ScheduleResult,
        courses: List[Course] = None,
        volunteers: List[Volunteer] = None,
        title: str = None
    ) -> str:
        lines = []
        
        if title is None:
            title = "志愿者排班表"
        
        generated_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        lines.append(f"# {title}")
        lines.append("")
        lines.append(f"> 生成时间：{generated_time}")
        lines.append("")
        
        assignments_by_day = self._group_assignments_by_day(schedule_result.assignments)
        
        for day in self.day_order:
            day_value = day.value
            if day_value not in assignments_by_day:
                continue
            
            day_assignments = assignments_by_day[day_value]
            day_assignments.sort(key=lambda a: a.time_slot.start_time)
            
            lines.append(f"## {day_value}")
            lines.append("")
            
            lines.append("| 时间段 | 课程 | 志愿者 | 角色 | 备注 |")
            lines.append("|--------|------|--------|------|------|")
            
            for assignment in day_assignments:
                time_str = f"{assignment.time_slot.start_time.strftime('%H:%M')}-{assignment.time_slot.end_time.strftime('%H:%M')}"
                volunteer_name = assignment.volunteer_name
                role = assignment.assigned_skill.value
                notes = assignment.notes if assignment.notes else ""
                
                lines.append(f"| {time_str} | {assignment.course_name} | {volunteer_name} | {role} | {notes} |")
            
            lines.append("")
        
        if schedule_result.conflicts or schedule_result.gaps:
            lines.append("---")
            lines.append("")
            lines.append("## ⚠️ 异常提示")
            lines.append("")
            
            if schedule_result.conflicts:
                lines.append("### 冲突列表")
                lines.append("")
                
                for conflict in schedule_result.conflicts:
                    severity_icon = {
                        "高": "🔴",
                        "中": "🟡",
                        "低": "🟢"
                    }.get(conflict.severity, "⚠️")
                    
                    lines.append(f"- {severity_icon} **{conflict.conflict_type}**: {conflict.description}")
                    
                    if conflict.details:
                        lines.append(f"  - 详情：{conflict.details}")
                    
                    lines.append("")
            
            if schedule_result.gaps:
                lines.append("### 人员缺口")
                lines.append("")
                
                lines.append("| 课程 | 时间段 | 缺口类型 | 需要人数 | 当前人数 | 缺少技能 |")
                lines.append("|------|--------|----------|----------|----------|----------|")
                
                for gap in schedule_result.gaps:
                    time_str = f"{gap.time_slot.day.value} {gap.time_slot.start_time.strftime('%H:%M')}-{gap.time_slot.end_time.strftime('%H:%M')}"
                    missing_skills = "、".join([s.value for s in gap.missing_skills]) if gap.missing_skills else "无"
                    
                    lines.append(f"| {gap.course_name} | {time_str} | {gap.gap_type} | {gap.required} | {gap.current} | {missing_skills} |")
                
                lines.append("")
        
        if volunteers:
            lines.append("---")
            lines.append("")
            lines.append("## 📋 志愿者汇总")
            lines.append("")
            
            lines.append("| 姓名 | 技能 | 可用时段 | 每周最大时长 | 分配时段 |")
            lines.append("|------|------|----------|--------------|----------|")
            
            volunteer_assignments = self._group_assignments_by_volunteer(schedule_result.assignments)
            
            for volunteer in volunteers:
                skills = "、".join([s.value for s in volunteer.skills])
                available_slots = "；".join([str(s) for s in volunteer.available_slots]) if volunteer.available_slots else "无限制"
                
                assigned_slots = volunteer_assignments.get(volunteer.id, [])
                assigned_info = "；".join([
                    f"{a.course_name}({a.time_slot.day.value} {a.time_slot.start_time.strftime('%H:%M')})"
                    for a in assigned_slots
                ]) if assigned_slots else "无"
                
                lines.append(f"| {volunteer.name} | {skills} | {available_slots} | {volunteer.max_hours_per_week}小时 | {assigned_info} |")
            
            lines.append("")
        
        return "\n".join(lines)

    def export_anomaly_list(
        self,
        schedule_result: ScheduleResult,
        leave_requests: List[LeaveRequest] = None,
        swap_requests: List[SwapRequest] = None,
        title: str = None
    ) -> str:
        lines = []
        
        if title is None:
            title = "排班异常清单"
        
        generated_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        lines.append(f"# {title}")
        lines.append("")
        lines.append(f"> 生成时间：{generated_time}")
        lines.append("")
        
        has_conflicts = len(schedule_result.conflicts) > 0
        has_gaps = len(schedule_result.gaps) > 0
        has_leaves = leave_requests and len(leave_requests) > 0
        has_swaps = swap_requests and len(swap_requests) > 0
        
        if not any([has_conflicts, has_gaps, has_leaves, has_swaps]):
            lines.append("✅ **当前无异常情况**")
            lines.append("")
            return "\n".join(lines)
        
        if has_conflicts:
            lines.append("## 🔴 冲突问题")
            lines.append("")
            
            conflicts_by_severity = defaultdict(list)
            for conflict in schedule_result.conflicts:
                conflicts_by_severity[conflict.severity].append(conflict)
            
            for severity in ["高", "中", "低"]:
                if severity not in conflicts_by_severity:
                    continue
                
                conflicts = conflicts_by_severity[severity]
                severity_icon = {
                    "高": "🔴",
                    "中": "🟡",
                    "低": "🟢"
                }[severity]
                
                lines.append(f"### {severity_icon} 严重程度：{severity} ({len(conflicts)}项)")
                lines.append("")
                
                lines.append("| 冲突类型 | 描述 | 影响志愿者 | 影响课程 |")
                lines.append("|----------|------|------------|----------|")
                
                for conflict in conflicts:
                    volunteers = "、".join(conflict.affected_volunteers) if conflict.affected_volunteers else "无"
                    courses = "、".join(conflict.affected_courses) if conflict.affected_courses else "无"
                    
                    lines.append(f"| {conflict.conflict_type} | {conflict.description} | {volunteers} | {courses} |")
                
                lines.append("")
        
        if has_gaps:
            lines.append("## 🟠 人员缺口")
            lines.append("")
            
            gaps_by_type = defaultdict(list)
            for gap in schedule_result.gaps:
                gaps_by_type[gap.gap_type].append(gap)
            
            for gap_type, gaps in gaps_by_type.items():
                lines.append(f"### {gap_type} ({len(gaps)}项)")
                lines.append("")
                
                lines.append("| 课程 | 时间段 | 需要人数 | 当前人数 | 缺少人数 | 缺少技能 |")
                lines.append("|------|--------|----------|----------|----------|----------|")
                
                for gap in gaps:
                    time_str = f"{gap.time_slot.day.value} {gap.time_slot.start_time.strftime('%H:%M')}-{gap.time_slot.end_time.strftime('%H:%M')}"
                    missing_count = gap.required - gap.current
                    missing_skills = "、".join([s.value for s in gap.missing_skills]) if gap.missing_skills else "无"
                    
                    lines.append(f"| {gap.course_name} | {time_str} | {gap.required} | {gap.current} | {missing_count} | {missing_skills} |")
                
                lines.append("")
        
        if has_leaves:
            lines.append("## 📝 请假记录")
            lines.append("")
            
            lines.append("| 志愿者 | 请假类型 | 日期/时段 | 原因 | 状态 |")
            lines.append("|--------|----------|-----------|------|------|")
            
            for leave in leave_requests:
                status = "已批准" if leave.is_approved else "待审批"
                date_info = ""
                if leave.date:
                    date_info = leave.date.strftime("%Y-%m-%d")
                if leave.time_slot:
                    date_info = f"{date_info} {str(leave.time_slot)}" if date_info else str(leave.time_slot)
                
                lines.append(f"| {leave.volunteer_name} | {leave.leave_type.value} | {date_info} | {leave.reason} | {status} |")
            
            lines.append("")
        
        if has_swaps:
            lines.append("## 🔄 调班记录")
            lines.append("")
            
            lines.append("| 志愿者 | 原时段 | 目标时段 | 调班对象 | 原因 | 状态 |")
            lines.append("|--------|--------|----------|----------|------|------|")
            
            for swap in swap_requests:
                status = "已批准" if swap.is_approved else "待审批"
                original_slot = str(swap.original_slot)
                target_slot = str(swap.target_slot) if swap.target_slot else "待定"
                swap_with = swap.swap_with_volunteer_name if swap.swap_with_volunteer_name else "无"
                
                lines.append(f"| {swap.volunteer_name} | {original_slot} | {target_slot} | {swap_with} | {swap.reason} | {status} |")
            
            lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("## 📊 异常统计")
        lines.append("")
        
        total_conflicts = len(schedule_result.conflicts)
        total_gaps = len(schedule_result.gaps)
        total_leaves = len(leave_requests) if leave_requests else 0
        total_swaps = len(swap_requests) if swap_requests else 0
        
        lines.append("- **冲突问题**：{} 项".format(total_conflicts))
        lines.append("- **人员缺口**：{} 项".format(total_gaps))
        lines.append("- **请假记录**：{} 条".format(total_leaves))
        lines.append("- **调班记录**：{} 条".format(total_swaps))
        lines.append("")
        
        return "\n".join(lines)

    def export_volunteer_summary(
        self,
        volunteers: List[Volunteer],
        schedule_result: ScheduleResult = None,
        title: str = None
    ) -> str:
        lines = []
        
        if title is None:
            title = "志愿者信息汇总"
        
        generated_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        lines.append(f"# {title}")
        lines.append("")
        lines.append(f"> 生成时间：{generated_time}")
        lines.append("")
        
        lines.append(f"## 总览")
        lines.append("")
        lines.append(f"- **志愿者总数**：{len(volunteers)} 人")
        
        if schedule_result:
            assigned_volunteers = set(a.volunteer_id for a in schedule_result.assignments)
            lines.append(f"- **已分配志愿者**：{len(assigned_volunteers)} 人")
            lines.append(f"- **待分配志愿者**：{len(volunteers) - len(assigned_volunteers)} 人")
        
        lines.append("")
        
        lines.append("## 详细列表")
        lines.append("")
        
        lines.append("| 序号 | 姓名 | 电话 | 技能 | 可用时段 | 每周最大时长 | 备注 |")
        lines.append("|------|------|------|------|----------|--------------|------|")
        
        for idx, volunteer in enumerate(volunteers, 1):
            skills = "、".join([s.value for s in volunteer.skills])
            available_slots = "；".join([str(s) for s in volunteer.available_slots]) if volunteer.available_slots else "无限制"
            notes = volunteer.notes if volunteer.notes else ""
            
            phone_display = volunteer.phone if volunteer.phone else "未提供"
            
            lines.append(f"| {idx} | {volunteer.name} | {phone_display} | {skills} | {available_slots} | {volunteer.max_hours_per_week}小时 | {notes} |")
        
        lines.append("")
        
        if schedule_result:
            lines.append("## 分配统计")
            lines.append("")
            
            volunteer_assignments = self._group_assignments_by_volunteer(schedule_result.assignments)
            
            lines.append("| 姓名 | 分配课程数 | 分配时段 | 分配角色 |")
            lines.append("|------|------------|----------|----------|")
            
            for volunteer in volunteers:
                assignments = volunteer_assignments.get(volunteer.id, [])
                course_count = len(assignments)
                
                if assignments:
                    slots = "；".join([
                        f"{a.course_name}({a.time_slot.day.value} {a.time_slot.start_time.strftime('%H:%M')})"
                        for a in assignments
                    ])
                    roles = "、".join([a.assigned_skill.value for a in assignments])
                else:
                    slots = "无"
                    roles = "无"
                
                lines.append(f"| {volunteer.name} | {course_count} | {slots} | {roles} |")
            
            lines.append("")
        
        return "\n".join(lines)

    def export_course_summary(
        self,
        courses: List[Course],
        schedule_result: ScheduleResult = None,
        title: str = None
    ) -> str:
        lines = []
        
        if title is None:
            title = "课程信息汇总"
        
        generated_time = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        lines.append(f"# {title}")
        lines.append("")
        lines.append(f"> 生成时间：{generated_time}")
        lines.append("")
        
        lines.append(f"## 总览")
        lines.append("")
        lines.append(f"- **课程总数**：{len(courses)} 门")
        
        if schedule_result:
            lines.append(f"- **已排班课程**：{len(set(a.course_id for a in schedule_result.assignments))} 门")
        
        lines.append("")
        
        lines.append("## 课程列表")
        lines.append("")
        
        lines.append("| 课程名称 | 时间段 | 需要技能 | 最少人数 | 最多人数 | 授课老师 | 地点 |")
        lines.append("|----------|--------|----------|----------|----------|----------|------|")
        
        for course in courses:
            time_str = str(course.time_slot)
            required_skills = "、".join([s.value for s in course.required_skills]) if course.required_skills else "无特殊要求"
            teacher = course.teacher if course.teacher else "待定"
            location = course.location if course.location else "待定"
            
            lines.append(f"| {course.name} | {time_str} | {required_skills} | {course.min_volunteers} | {course.max_volunteers} | {teacher} | {location} |")
        
        lines.append("")
        
        if schedule_result:
            lines.append("## 排班状态")
            lines.append("")
            
            course_assignments = self._group_assignments_by_course(schedule_result.assignments)
            
            lines.append("| 课程名称 | 时间段 | 已分配人数 | 状态 | 分配志愿者 |")
            lines.append("|----------|--------|------------|------|------------|")
            
            for course in courses:
                assignments = course_assignments.get(course.id, [])
                assigned_count = len(assignments)
                
                if assigned_count >= course.min_volunteers:
                    if assigned_count >= course.max_volunteers:
                        status = "已满"
                    else:
                        status = "充足"
                else:
                    status = "不足"
                
                volunteers = "、".join([a.volunteer_name for a in assignments]) if assignments else "无"
                time_str = str(course.time_slot)
                
                status_icon = {
                    "已满": "✅",
                    "充足": "🟢",
                    "不足": "🔴"
                }.get(status, "⚪")
                
                lines.append(f"| {course.name} | {time_str} | {assigned_count}/{course.max_volunteers} | {status_icon} {status} | {volunteers} |")
            
            lines.append("")
        
        return "\n".join(lines)

    def _group_assignments_by_day(
        self, assignments: List[ScheduleAssignment]
    ) -> Dict[str, List[ScheduleAssignment]]:
        grouped = defaultdict(list)
        for assignment in assignments:
            day_value = assignment.time_slot.day.value
            grouped[day_value].append(assignment)
        return grouped

    def _group_assignments_by_volunteer(
        self, assignments: List[ScheduleAssignment]
    ) -> Dict[str, List[ScheduleAssignment]]:
        grouped = defaultdict(list)
        for assignment in assignments:
            grouped[assignment.volunteer_id].append(assignment)
        return grouped

    def _group_assignments_by_course(
        self, assignments: List[ScheduleAssignment]
    ) -> Dict[str, List[ScheduleAssignment]]:
        grouped = defaultdict(list)
        for assignment in assignments:
            grouped[assignment.course_id].append(assignment)
        return grouped

    def save_to_file(self, content: str, file_path: str) -> bool:
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(content)
            return True
        except Exception as e:
            print(f"保存文件失败: {e}")
            return False
