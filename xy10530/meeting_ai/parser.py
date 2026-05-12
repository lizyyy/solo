import re
from dataclasses import dataclass, field
from datetime import datetime, date
from typing import List, Optional, Set, Tuple
from pathlib import Path


@dataclass
class ParsedActionItem:
    description: str
    assignees: List[str]
    due_date: Optional[date]
    dependencies_text: List[str] = field(default_factory=list)
    raw_line: str = ""


@dataclass
class ParsedMeeting:
    title: str
    meeting_date: Optional[date]
    attendees: List[str]
    action_items: List[ParsedActionItem]
    raw_content: str


DATE_PATTERNS = [
    r'(\d{4}-\d{2}-\d{2})',
    r'(\d{4}/\d{2}/\d{2})',
    r'(\d{2}-\d{2}-\d{2})',
    r'(\d{2}/\d{2}/\d{2})',
]

ACTION_KEYWORDS = [
    'action item', 'action items', 'todo', 'todos', 'task', 'tasks',
    '待办', '行动项', '任务', '需要', '必须', '请', '负责', '完成',
]

ASSIGNEE_PATTERNS = [
    r'@([\w\u4e00-\u9fff]+)',
    r'@\{([^}]+)\}',
    r'([\w\u4e00-\u9fff]+(?:[、,，及和\s]+[\w\u4e00-\u9fff]+)*)\s*负责',
    r'负责人[:：]\s*([\w\u4e00-\u9fff、,，\s]+)',
    r'assigned to[:：]\s*([\w\u4e00-\u9fff、,，\s]+)',
]

DEPS_PATTERNS = [
    r'依赖[：:]\s*([^\n]+)',
    r'blocks[：:]\s*([^\n]+)',
    r'blocked by[：:]\s*([^\n]+)',
    r'等待[：:]\s*([^\n]+)',
    r'需要等待[：:]\s*([^\n]+)',
]

DUE_PATTERNS = [
    r'截止[：:]\s*([^\n]+?)(?:\s*\n|\s*$)',
    r'due[：:]\s*([^\n]+?)(?:\s*\n|\s*$)',
    r'deadline[：:]\s*([^\n]+?)(?:\s*\n|\s*$)',
    r'\(([^)]*\d[^)]*)\)',
]


def parse_date_string(date_str: str) -> Optional[date]:
    date_str = date_str.strip()
    today = date.today()
    
    if date_str in ['今天', '今日', 'today']:
        return today
    
    if date_str in ['明天', '明日', 'tomorrow']:
        from datetime import timedelta
        return today + timedelta(days=1)
    
    if date_str in ['后天', 'day after tomorrow']:
        from datetime import timedelta
        return today + timedelta(days=2)
    
    week_map = {
        '周一': 0, '星期二': 1, '周二': 1, '星期三': 2, '周三': 2,
        '星期四': 3, '周四': 3, '星期五': 4, '周五': 4,
        '星期六': 5, '周六': 5, '星期日': 6, '周日': 6,
    }
    for w, delta in week_map.items():
        if w in date_str:
            from datetime import timedelta
            current_wd = today.weekday()
            offset = (delta - current_wd) % 7
            if offset == 0:
                offset = 7
            return today + timedelta(days=offset)
    
    try:
        return datetime.strptime(date_str, '%Y-%m-%d').date()
    except:
        pass
    
    try:
        return datetime.strptime(date_str, '%Y/%m/%d').date()
    except:
        pass
    
    try:
        return datetime.strptime(date_str, '%y-%m-%d').date()
    except:
        pass
    
    try:
        return datetime.strptime(date_str, '%y/%m/%d').date()
    except:
        pass
    
    try:
        return datetime.strptime(date_str, '%m-%d').date().replace(year=today.year)
    except:
        pass
    
    try:
        return datetime.strptime(date_str, '%m/%d').date().replace(year=today.year)
    except:
        pass
    
    return None


def extract_attendees(content: str) -> List[str]:
    attendees = set()
    
    attendee_sections = [
        r'参会人[：:]\s*([^\n]+)',
        r'attendees[：:]\s*([^\n]+)',
        r'参与人[：:]\s*([^\n]+)',
        r'参加人[：:]\s*([^\n]+)',
    ]
    
    for pattern in attendee_sections:
        matches = re.findall(pattern, content, re.IGNORECASE)
        for match in matches:
            parts = re.split(r'[、,，\s]+', match.strip())
            for part in parts:
                part = part.strip()
                if part:
                    attendees.add(part)
    
    return sorted(list(attendees))


def extract_meeting_title(content: str) -> str:
    first_line = content.strip().split('\n')[0] if content.strip() else ""
    first_line = first_line.replace('#', '').replace('*', '').strip()
    return first_line or "未命名会议"


def extract_meeting_date(content: str) -> Optional[date]:
    date_sections = [
        r'会议时间[：:]\s*([^\n]+)',
        r'meeting date[：:]\s*([^\n]+)',
        r'date[：:]\s*([^\n]+)',
        r'时间[：:]\s*([^\n]+)',
    ]
    
    for pattern in date_sections:
        matches = re.findall(pattern, content, re.IGNORECASE)
        for match in matches:
            parsed = parse_date_string(match.strip())
            if parsed:
                return parsed
    
    for pattern in DATE_PATTERNS:
        matches = re.findall(pattern, content)
        for match in matches:
            parsed = parse_date_string(match.strip())
            if parsed:
                return parsed
    
    return None


def extract_assignees(line: str) -> List[str]:
    assignees = set()
    
    for pattern in ASSIGNEE_PATTERNS:
        matches = re.findall(pattern, line, re.IGNORECASE)
        for match in matches:
            if isinstance(match, tuple):
                match = match[0] if match else ""
            parts = re.split(r'[、,，\s]+', match.strip())
            for part in parts:
                part = part.strip()
                if part and part not in ['', '和', '及', '与', 'and', '&']:
                    assignees.add(part)
    
    return sorted(list(assignees))


def extract_due_date(line: str) -> Optional[date]:
    for pattern in DUE_PATTERNS:
        matches = re.findall(pattern, line, re.IGNORECASE)
        for match in matches:
            if isinstance(match, tuple):
                match = match[0] if match else ""
            parsed = parse_date_string(match.strip())
            if parsed:
                return parsed
    
    return None


def extract_dependencies(line: str) -> List[str]:
    deps = []
    for pattern in DEPS_PATTERNS:
        matches = re.findall(pattern, line, re.IGNORECASE)
        for match in matches:
            if isinstance(match, tuple):
                match = match[0] if match else ""
            parts = re.split(r'[、,，\s]+', match.strip())
            for part in parts:
                part = part.strip()
                if part:
                    deps.append(part)
    return deps


def is_action_item_line(line: str) -> bool:
    line_lower = line.lower()
    
    if re.match(r'^\s*[\-\*\+]\s+', line):
        return True
    
    if re.match(r'^\s*\d+\.\s+', line):
        return True
    
    for kw in ACTION_KEYWORDS:
        if kw in line_lower:
            return True
    
    if re.search(r'@[\w\u4e00-\u9fff]+', line):
        return True
    
    if '负责人' in line or '截止' in line:
        return True
    
    return False


def parse_meeting_content(content: str, source_path: Optional[str] = None) -> ParsedMeeting:
    lines = content.split('\n')
    
    title = extract_meeting_title(content)
    meeting_date = extract_meeting_date(content)
    attendees = extract_attendees(content)
    
    action_items = []
    
    for i, line in enumerate(lines):
        line = line.strip()
        if not line:
            continue
        
        if is_action_item_line(line):
            assignees = extract_assignees(line)
            due_date = extract_due_date(line)
            deps = extract_dependencies(line)
            
            clean_line = line
            clean_line = re.sub(r'^[\-\*\+]\s*', '', clean_line)
            clean_line = re.sub(r'^\d+\.\s*', '', clean_line)
            clean_line = re.sub(r'\[x?\]\s*', '', clean_line)
            clean_line = re.sub(r'@[\w\u4e00-\u9fff\{][^\s\}]*\}?', '', clean_line)
            clean_line = re.sub(r'负责人[:：]\s*[\w\u4e00-\u9fff、,，\s]+', '', clean_line)
            clean_line = re.sub(r'截止[:：]\s*[^\n]*', '', clean_line)
            clean_line = re.sub(r'due[:：]\s*[^\n]*', '', clean_line, flags=re.IGNORECASE)
            clean_line = re.sub(r'\([^)]*\)', '', clean_line)
            clean_line = re.sub(r'依赖[:：][^\n]*', '', clean_line)
            clean_line = re.sub(r'等待[:：][^\n]*', '', clean_line)
            clean_line = re.sub(r'\s{2,}', ' ', clean_line).strip()
            
            if clean_line and (assignees or due_date or deps):
                action_items.append(ParsedActionItem(
                    description=clean_line,
                    assignees=assignees,
                    due_date=due_date,
                    dependencies_text=deps,
                    raw_line=line
                ))
    
    return ParsedMeeting(
        title=title,
        meeting_date=meeting_date,
        attendees=attendees,
        action_items=action_items,
        raw_content=content
    )


def parse_file(file_path: str) -> ParsedMeeting:
    path = Path(file_path)
    content = path.read_text(encoding='utf-8')
    return parse_meeting_content(content, source_path=str(path))
