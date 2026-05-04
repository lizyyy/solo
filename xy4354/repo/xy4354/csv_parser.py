import csv
from typing import List, Dict, Any, Optional
from datetime import time
import re

from .models import Volunteer, Course, TimeSlot, DayOfWeek, SkillTag


class CSVParser:
    def __init__(self):
        self.day_map = {
            "周一": DayOfWeek.MONDAY,
            "星期二": DayOfWeek.TUESDAY,
            "周二": DayOfWeek.TUESDAY,
            "周三": DayOfWeek.WEDNESDAY,
            "星期三": DayOfWeek.WEDNESDAY,
            "周四": DayOfWeek.THURSDAY,
            "星期四": DayOfWeek.THURSDAY,
            "周五": DayOfWeek.FRIDAY,
            "星期五": DayOfWeek.FRIDAY,
            "周六": DayOfWeek.SATURDAY,
            "星期六": DayOfWeek.SATURDAY,
            "周日": DayOfWeek.SUNDAY,
            "星期日": DayOfWeek.SUNDAY,
        }
        
        self.skill_map = {
            "教学": SkillTag.TEACHING,
            "讲课": SkillTag.TEACHING,
            "讲师": SkillTag.TEACHING,
            "助教": SkillTag.ASSISTANT,
            "助理": SkillTag.ASSISTANT,
            "辅助": SkillTag.ASSISTANT,
            "技术支持": SkillTag.TECHNICAL,
            "技术": SkillTag.TECHNICAL,
            "IT": SkillTag.TECHNICAL,
            "行政": SkillTag.ADMIN,
            "管理": SkillTag.ADMIN,
            "急救": SkillTag.FIRST_AID,
            "医护": SkillTag.FIRST_AID,
            "翻译": SkillTag.TRANSLATION,
            "外语": SkillTag.TRANSLATION,
        }

    def parse_volunteers(self, file_path: str) -> List[Volunteer]:
        volunteers = []
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                volunteer = self._parse_volunteer_row(row)
                if volunteer:
                    volunteers.append(volunteer)
        return volunteers

    def _parse_volunteer_row(self, row: Dict[str, str]) -> Optional[Volunteer]:
        name = self._get_field(row, ['姓名', '名字', '志愿者姓名', 'name', 'Name'])
        if not name:
            return None
        
        volunteer_id = self._get_field(row, ['ID', 'id', '编号', '志愿者ID', '志愿者编号']) or name
        
        phone = self._get_field(row, ['电话', '手机', '联系方式', '联系电话', 'phone', 'Phone', 'mobile'])
        email = self._get_field(row, ['邮箱', '电子邮件', 'email', 'Email'])
        max_hours_str = self._get_field(row, ['每周最大时长', '每周时长', 'max_hours'])
        max_hours = float(max_hours_str) if max_hours_str else 8.0
        
        skills = self._parse_skills(self._get_field(row, ['技能', '技能标签', 'skills', '技能特长']))
        available_slots = self._parse_time_slots(self._get_field(row, ['可用时间', '可排班时间', 'available_time', '时间']))
        notes = self._get_field(row, ['备注', 'notes', '备注信息'])
        
        return Volunteer(
            id=volunteer_id,
            name=name,
            phone=phone or "",
            email=email or "",
            skills=skills,
            available_slots=available_slots,
            max_hours_per_week=max_hours,
            notes=notes or ""
        )

    def parse_courses(self, file_path: str) -> List[Course]:
        courses = []
        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                course = self._parse_course_row(row)
                if course:
                    courses.append(course)
        return courses

    def _parse_course_row(self, row: Dict[str, str]) -> Optional[Course]:
        name = self._get_field(row, ['课程名称', '课程', 'course', 'Course', '课程名'])
        if not name:
            return None
        
        course_id = self._get_field(row, ['课程ID', '课程编号', 'ID', 'id']) or name
        
        description = self._get_field(row, ['课程描述', '描述', 'description', 'Description'])
        time_slot_str = self._get_field(row, ['课程时间', '时间', 'time', 'Time', '上课时间'])
        
        time_slot = None
        if time_slot_str:
            time_slots = self._parse_time_slots(time_slot_str)
            if time_slots:
                time_slot = time_slots[0]
        
        if not time_slot:
            time_slot = TimeSlot(
                day=DayOfWeek.MONDAY,
                start_time=time(9, 0),
                end_time=time(10, 0)
            )
        
        required_skills = self._parse_skills(self._get_field(row, ['需要技能', '所需技能', 'required_skills', '要求技能']))
        min_volunteers_str = self._get_field(row, ['最少志愿者', '最少人数', 'min_volunteers'])
        min_volunteers = int(min_volunteers_str) if min_volunteers_str else 1
        max_volunteers_str = self._get_field(row, ['最多志愿者', '最多人数', 'max_volunteers'])
        max_volunteers = int(max_volunteers_str) if max_volunteers_str else 3
        location = self._get_field(row, ['地点', '上课地点', 'location', 'Location'])
        teacher = self._get_field(row, ['老师', '授课老师', 'teacher', 'Teacher'])
        
        return Course(
            id=course_id,
            name=name,
            description=description or "",
            time_slot=time_slot,
            required_skills=required_skills,
            min_volunteers=min_volunteers,
            max_volunteers=max_volunteers,
            location=location or "",
            teacher=teacher or ""
        )

    def _get_field(self, row: Dict[str, str], possible_keys: List[str]) -> Optional[str]:
        for key in possible_keys:
            if key in row:
                value = row[key].strip()
                if value:
                    return value
        return None

    def _parse_skills(self, skill_str: Optional[str]) -> List[SkillTag]:
        if not skill_str:
            return []
        
        skills = []
        separators = [',', '，', ';', '；', '/', '、']
        for sep in separators:
            if sep in skill_str:
                skill_list = [s.strip() for s in skill_str.split(sep)]
                break
        else:
            skill_list = [skill_str.strip()]
        
        for skill in skill_list:
            if skill in self.skill_map:
                skills.append(self.skill_map[skill])
            else:
                matched = False
                for key, value in self.skill_map.items():
                    if key in skill or skill in key:
                        if value not in skills:
                            skills.append(value)
                        matched = True
                        break
                if not matched and skill:
                    pass
        
        return skills if skills else [SkillTag.ASSISTANT]

    def _parse_time_slots(self, time_str: Optional[str]) -> List[TimeSlot]:
        if not time_str:
            return []
        
        slots = []
        day_pattern = r'([周一二三四五六日][一二三四五六日]?)'
        time_pattern = r'(\d{1,2}[:：]?\d{0,2})'
        
        slot_strings = re.split(r'[，|；|;|,|\n]', time_str)
        
        for slot_str in slot_strings:
            slot_str = slot_str.strip()
            if not slot_str:
                continue
            
            day_match = re.search(day_pattern, slot_str)
            time_matches = re.findall(time_pattern, slot_str)
            
            if day_match and len(time_matches) >= 2:
                day_str = day_match.group(1)
                day = self.day_map.get(day_str)
                
                if day:
                    start_time_str = time_matches[0]
                    end_time_str = time_matches[1]
                    
                    start_time = self._parse_time(start_time_str)
                    end_time = self._parse_time(end_time_str)
                    
                    if start_time and end_time:
                        slots.append(TimeSlot(
                            day=day,
                            start_time=start_time,
                            end_time=end_time
                        ))
        
        return slots

    def _parse_time(self, time_str: str) -> Optional[time]:
        time_str = time_str.strip()
        
        if ':' in time_str or '：' in time_str:
            time_str = time_str.replace('：', ':')
            parts = time_str.split(':')
            hour = int(parts[0])
            minute = int(parts[1]) if len(parts) > 1 else 0
        else:
            match = re.match(r'(\d{1,2})(\d{2})?', time_str)
            if match:
                hour = int(match.group(1))
                minute = int(match.group(2)) if match.group(2) else 0
            else:
                return None
        
        if 0 <= hour <= 23 and 0 <= minute <= 59:
            return time(hour, minute)
        return None
