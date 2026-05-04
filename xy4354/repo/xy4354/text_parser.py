import re
from typing import List, Optional, Tuple, Dict, Any
from datetime import datetime, time

from .models import (
    LeaveRequest, SwapRequest, TimeSlot, DayOfWeek, 
    LeaveType, Volunteer
)


class TextParser:
    def __init__(self):
        self.day_map = {
            "周一": DayOfWeek.MONDAY,
            "周二": DayOfWeek.TUESDAY,
            "周三": DayOfWeek.WEDNESDAY,
            "周四": DayOfWeek.THURSDAY,
            "周五": DayOfWeek.FRIDAY,
            "周六": DayOfWeek.SATURDAY,
            "周日": DayOfWeek.SUNDAY,
            "下周一": DayOfWeek.MONDAY,
            "下周二": DayOfWeek.TUESDAY,
            "下周三": DayOfWeek.WEDNESDAY,
            "下周四": DayOfWeek.THURSDAY,
            "下周五": DayOfWeek.FRIDAY,
            "下周六": DayOfWeek.SATURDAY,
            "下周日": DayOfWeek.SUNDAY,
        }
        
        self.leave_type_map = {
            "病假": LeaveType.SICK,
            "生病": LeaveType.SICK,
            "身体不适": LeaveType.SICK,
            "发烧": LeaveType.SICK,
            "感冒": LeaveType.SICK,
            "事假": LeaveType.PERSONAL,
            "有事": LeaveType.PERSONAL,
            "家里有事": LeaveType.PERSONAL,
            "个人原因": LeaveType.PERSONAL,
            "年假": LeaveType.ANNUAL,
            "休假": LeaveType.ANNUAL,
            "放假": LeaveType.ANNUAL,
        }

    def parse_leave_requests(self, text: str, volunteers: List[Volunteer] = None) -> List[LeaveRequest]:
        requests = []
        lines = text.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            request = self._parse_single_leave(line, volunteers)
            if request:
                requests.append(request)
        
        return requests

    def _parse_single_leave(self, line: str, volunteers: List[Volunteer] = None) -> Optional[LeaveRequest]:
        name = self._extract_name(line, volunteers)
        if not name:
            return None
        
        volunteer_id = self._find_volunteer_id(name, volunteers)
        
        leave_type = self._extract_leave_type(line)
        
        date = self._extract_date(line)
        
        time_slot = self._extract_time_slot(line)
        
        reason = self._extract_reason(line)
        
        return LeaveRequest(
            volunteer_id=volunteer_id or name,
            volunteer_name=name,
            date=date,
            time_slot=time_slot,
            leave_type=leave_type,
            reason=reason,
            is_approved=True
        )

    def parse_swap_requests(self, text: str, volunteers: List[Volunteer] = None) -> List[SwapRequest]:
        requests = []
        lines = text.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            request = self._parse_single_swap(line, volunteers)
            if request:
                requests.append(request)
        
        return requests

    def _parse_single_swap(self, line: str, volunteers: List[Volunteer] = None) -> Optional[SwapRequest]:
        name = self._extract_name(line, volunteers)
        if not name:
            return None
        
        volunteer_id = self._find_volunteer_id(name, volunteers)
        
        original_slot, target_slot = self._extract_swap_slots(line)
        
        if not original_slot:
            return None
        
        swap_with_name = self._extract_swap_with_name(line, name)
        swap_with_id = self._find_volunteer_id(swap_with_name, volunteers) if swap_with_name else None
        
        reason = self._extract_swap_reason(line)
        
        return SwapRequest(
            volunteer_id=volunteer_id or name,
            volunteer_name=name,
            original_slot=original_slot,
            target_slot=target_slot,
            swap_with_volunteer_id=swap_with_id,
            swap_with_volunteer_name=swap_with_name,
            reason=reason,
            is_approved=False
        )

    def _extract_name(self, line: str, volunteers: List[Volunteer] = None) -> Optional[str]:
        if volunteers:
            for v in volunteers:
                if v.name in line:
                    return v.name
        
        patterns = [
            r'(\S{2,4})请假',
            r'(\S{2,4})要请假',
            r'(\S{2,4})申请请假',
            r'(\S{2,4})本周',
            r'(\S{2,4})下周',
            r'(\S{2,4})调班',
            r'(\S{2,4})要调班',
            r'(\S{2,4})换班',
            r'请假：(\S{2,4})',
            r'请假:(\S{2,4})',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, line)
            if match:
                name = match.group(1)
                if len(name) >= 2 and len(name) <= 4:
                    return name
        
        words = line.split()
        for word in words:
            if 2 <= len(word) <= 4 and not re.search(r'[\d，。！？、；：""''（）]', word):
                return word
        
        return None

    def _find_volunteer_id(self, name: str, volunteers: List[Volunteer] = None) -> Optional[str]:
        if volunteers:
            for v in volunteers:
                if v.name == name:
                    return v.id
        return None

    def _extract_leave_type(self, line: str) -> LeaveType:
        for keyword, leave_type in self.leave_type_map.items():
            if keyword in line:
                return leave_type
        return LeaveType.OTHER

    def _extract_date(self, line: str) -> Optional[datetime]:
        patterns = [
            r'(\d{4})[年/-](\d{1,2})[月/-](\d{1,2})',
            r'(\d{1,2})月(\d{1,2})日',
            r'(\d{1,2})/(\d{1,2})',
            r'(\d{1,2})-(\d{1,2})',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, line)
            if match:
                try:
                    if len(match.groups()) == 3:
                        return datetime(int(match.group(1)), int(match.group(2)), int(match.group(3)))
                    else:
                        now = datetime.now()
                        return datetime(now.year, int(match.group(1)), int(match.group(2)))
                except (ValueError, IndexError):
                    continue
        
        return None

    def _extract_time_slot(self, line: str) -> Optional[TimeSlot]:
        day = None
        for keyword, day_val in self.day_map.items():
            if keyword in line:
                day = day_val
                break
        
        time_pattern = r'(\d{1,2})[:：]?(\d{0,2})'
        time_matches = re.findall(time_pattern, line)
        
        if len(time_matches) >= 2 and day:
            try:
                start_hour = int(time_matches[0][0])
                start_minute = int(time_matches[0][1]) if time_matches[0][1] else 0
                end_hour = int(time_matches[1][0])
                end_minute = int(time_matches[1][1]) if time_matches[1][1] else 0
                
                if 0 <= start_hour <= 23 and 0 <= end_hour <= 23:
                    return TimeSlot(
                        day=day,
                        start_time=time(start_hour, start_minute),
                        end_time=time(end_hour, end_minute)
                    )
            except (ValueError, IndexError):
                pass
        
        if day:
            return TimeSlot(
                day=day,
                start_time=time(9, 0),
                end_time=time(18, 0)
            )
        
        return None

    def _extract_swap_slots(self, line: str) -> Tuple[Optional[TimeSlot], Optional[TimeSlot]]:
        slots = []
        original_slot = None
        target_slot = None
        
        from_patterns = [
            r'(?:从|原来|原本|之前)[的\s]*([周一二三四五六日][一二三四五六日]?\s*[\d点时：:]*\s*[-~到至]?\s*[\d点时：:]*)',
            r'(?:本周六|本周日|下周一|下周二|下周三|下周四|下周五|下周六|下周日|周一|周二|周三|周四|周五|周六|周日)[的\s]*([\d点时：:]*\s*[-~到至]?\s*[\d点时：:]*)',
        ]
        
        to_patterns = [
            r'(?:到|换成|改到|调到)[的\s]*([周一二三四五六日][一二三四五六日]?\s*[\d点时：:]*\s*[-~到至]?\s*[\d点时：:]*)',
            r'(?:改为|改成|换到)[的\s]*([周一二三四五六日][一二三四五六日]?\s*[\d点时：:]*\s*[-~到至]?\s*[\d点时：:]*)',
        ]
        
        from_match = None
        for pattern in from_patterns:
            from_match = re.search(pattern, line)
            if from_match:
                break
        
        to_match = None
        for pattern in to_patterns:
            to_match = re.search(pattern, line)
            if to_match:
                break
        
        if from_match:
            original_slot = self._parse_slot_from_text(from_match.group(1))
        
        if to_match:
            target_slot = self._parse_slot_from_text(to_match.group(1))
        
        if not original_slot:
            slot = self._extract_time_slot(line)
            if slot:
                original_slot = slot
        
        return original_slot, target_slot

    def _parse_slot_from_text(self, text: str) -> Optional[TimeSlot]:
        if not text:
            return None
        
        day = None
        for keyword, day_val in self.day_map.items():
            if keyword in text:
                day = day_val
                break
        
        time_pattern = r'(\d{1,2})[:：]?(\d{0,2})'
        time_matches = re.findall(time_pattern, text)
        
        if len(time_matches) >= 2 and day:
            try:
                start_hour = int(time_matches[0][0])
                start_minute = int(time_matches[0][1]) if time_matches[0][1] else 0
                end_hour = int(time_matches[1][0])
                end_minute = int(time_matches[1][1]) if time_matches[1][1] else 0
                
                if 0 <= start_hour <= 23 and 0 <= end_hour <= 23:
                    return TimeSlot(
                        day=day,
                        start_time=time(start_hour, start_minute),
                        end_time=time(end_hour, end_minute)
                    )
            except (ValueError, IndexError):
                pass
        
        if day:
            return TimeSlot(
                day=day,
                start_time=time(9, 0),
                end_time=time(18, 0)
            )
        
        return None

    def _extract_swap_with_name(self, line: str, current_name: str) -> Optional[str]:
        patterns = [
            r'(?:和|跟|与)(\S{2,4})(?:换|调)',
            r'(?:换给|调到)(\S{2,4})',
            r'(?:请|麻烦)(\S{2,4})(?:帮忙|替)',
        ]
        
        for pattern in patterns:
            match = re.search(pattern, line)
            if match:
                name = match.group(1)
                if name != current_name and 2 <= len(name) <= 4:
                    return name
        
        return None

    def _extract_reason(self, line: str) -> str:
        reason_keywords = ['因为', '由于', '原因是', '原因：', '原因:', '所以', '因此']
        
        for keyword in reason_keywords:
            if keyword in line:
                idx = line.find(keyword) + len(keyword)
                reason = line[idx:].strip()
                if reason:
                    return reason
        
        leave_keywords = ['请假', '调班', '换班', '不来', '不能来', '没法来', '无法参加']
        for keyword in leave_keywords:
            if keyword in line:
                idx = line.find(keyword) + len(keyword)
                reason = line[idx:].strip()
                if reason:
                    return reason
        
        return ""

    def _extract_swap_reason(self, line: str) -> str:
        return self._extract_reason(line)

    def parse_wechat_jielong(self, text: str, volunteers: List[Volunteer] = None) -> Tuple[List[Volunteer], List[LeaveRequest], List[SwapRequest]]:
        new_volunteers = []
        leave_requests = []
        swap_requests = []
        
        lines = text.strip().split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            if '请假' in line or '不来' in line or '不能来' in line:
                leave = self._parse_single_leave(line, volunteers)
                if leave:
                    leave_requests.append(leave)
            elif '调班' in line or '换班' in line or '换成' in line or '改到' in line:
                swap = self._parse_single_swap(line, volunteers)
                if swap:
                    swap_requests.append(swap)
            else:
                volunteer = self._parse_jielong_volunteer(line)
                if volunteer:
                    new_volunteers.append(volunteer)
        
        return new_volunteers, leave_requests, swap_requests

    def _parse_jielong_volunteer(self, line: str) -> Optional[Volunteer]:
        phone_match = re.search(r'1[3-9]\d{9}', line)
        name_match = re.match(r'^(\S{2,4})', line)
        
        name = None
        if name_match:
            name = name_match.group(1)
        
        if not name:
            return None
        
        phone = phone_match.group(0) if phone_match else ""
        
        skills = []
        skill_keywords = ['教学', '助教', '技术', '行政', '急救', '翻译']
        for keyword in skill_keywords:
            if keyword in line:
                if keyword == '教学':
                    skills.append(SkillTag.TEACHING)
                elif keyword == '助教':
                    skills.append(SkillTag.ASSISTANT)
                elif keyword == '技术':
                    skills.append(SkillTag.TECHNICAL)
                elif keyword == '行政':
                    skills.append(SkillTag.ADMIN)
                elif keyword == '急救':
                    skills.append(SkillTag.FIRST_AID)
                elif keyword == '翻译':
                    skills.append(SkillTag.TRANSLATION)
        
        if not skills:
            skills = [SkillTag.ASSISTANT]
        
        return Volunteer(
            id=name,
            name=name,
            phone=phone,
            skills=skills,
            available_slots=[],
            max_hours_per_week=8.0,
            notes=line
        )
