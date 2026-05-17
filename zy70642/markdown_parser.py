import re
from datetime import date, datetime
from typing import List, Tuple, Optional
from dateutil import parser as date_parser
from schemas import ActionItemCreate
from database import ActionStatus
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class MarkdownParser:
    def __init__(self):
        self.status_keywords = {
            "待处理": ActionStatus.PENDING,
            "待办": ActionStatus.PENDING,
            "未开始": ActionStatus.PENDING,
            "进行中": ActionStatus.IN_PROGRESS,
            "处理中": ActionStatus.IN_PROGRESS,
            "已完成": ActionStatus.COMPLETED,
            "完成": ActionStatus.COMPLETED,
            "已延期": ActionStatus.DELAYED,
            "延期": ActionStatus.DELAYED,
            "延后": ActionStatus.DELAYED,
            "取消": ActionStatus.CANCELLED,
            "已取消": ActionStatus.CANCELLED,
        }
        
        self.delay_keywords = ["延期", "延后", "推迟", "延迟", "无法完成", "未能完成", "延后至"]
        self.assignee_patterns = [
            r"@([\u4e00-\u9fa5a-zA-Z0-9_]+)",
            r"负责人[：:]\s*([^\s,，、]+)",
            r"责任人[：:]\s*([^\s,，、]+)",
            r"由([^\s,，、]+)负责",
            r"([^\s,，、]+)负责",
        ]
        
        self.date_patterns = [
            r"(\d{4})[年\-/](\d{1,2})[月\-/](\d{1,2})[日号]?",
            r"(\d{1,2})[月\-/](\d{1,2})[日号]?",
            r"截止[：:]\s*([^\s,，、]+)",
            r"日期[：:]\s*([^\s,，、]+)",
            r"到([^\s,，、]+)完成",
        ]

    def extract_action_items(self, markdown_content: str) -> Tuple[List[ActionItemCreate], int]:
        action_items = []
        needs_review_count = 0
        
        lines = markdown_content.split('\n')
        current_section = ""
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            if line.startswith('#'):
                current_section = line.lstrip('#').strip()
                continue
            
            is_action_item = False
            has_checkbox = False
            checkbox_checked = False
            
            checkbox_match = re.match(r'^[-*+]\s*\[([ xX])\]\s*', line)
            if checkbox_match:
                is_action_item = True
                has_checkbox = True
                checkbox_checked = checkbox_match.group(1).lower() == 'x'
            elif re.match(r'^[-*+]\s*', line):
                is_action_item = True
            
            if not is_action_item and any(keyword in line for keyword in ["待办", "行动项", "任务", "负责人", "截止日期"]):
                is_action_item = True
            
            if not is_action_item:
                continue
            
            content = re.sub(r'^[-*+]\s*\[?[ xX]?\]?\s*', '', line).strip()
            
            assignee, raw_assignee = self.extract_assignee(content)
            due_date, raw_due_date = self.extract_date(content)
            status = self.extract_status(content, has_checkbox, checkbox_checked)
            delay_reason = self.extract_delay_reason(content)
            
            needs_review = False
            review_notes = []
            
            if due_date is None and raw_due_date:
                needs_review = True
                review_notes.append("无法识别截止日期")
            
            if delay_reason and status != ActionStatus.DELAYED:
                status = ActionStatus.DELAYED
            
            if needs_review:
                needs_review_count += 1
            
            action_item = ActionItemCreate(
                content=content,
                raw_assignee=raw_assignee,
                raw_due_date=raw_due_date,
                due_date=due_date,
                status=status,
                delay_reason=delay_reason,
                needs_review=needs_review,
                review_notes="; ".join(review_notes) if review_notes else None
            )
            
            action_items.append(action_item)
        
        return action_items, needs_review_count

    def extract_assignee(self, content: str) -> Tuple[Optional[int], Optional[str]]:
        raw_assignee = None
        
        for pattern in self.assignee_patterns:
            match = re.search(pattern, content)
            if match:
                raw_assignee = match.group(1)
                break
        
        if not raw_assignee:
            match = re.search(r'([\u4e00-\u9fa5]{2,4})\s*', content)
            if match and len(match.group(1)) >= 2:
                pass
        
        return None, raw_assignee

    def extract_date(self, content: str) -> Tuple[Optional[date], Optional[str]]:
        raw_due_date = None
        parsed_date = None
        
        for pattern in self.date_patterns:
            match = re.search(pattern, content)
            if match:
                if len(match.groups()) == 3:
                    year, month, day = match.groups()
                    try:
                        parsed_date = date(int(year), int(month), int(day))
                        raw_due_date = match.group(0)
                        break
                    except ValueError:
                        continue
                elif len(match.groups()) == 2:
                    month, day = match.groups()
                    try:
                        current_year = datetime.now().year
                        parsed_date = date(current_year, int(month), int(day))
                        raw_due_date = match.group(0)
                        break
                    except ValueError:
                        continue
                else:
                    raw_due_date = match.group(1)
                    try:
                        parsed_date = date_parser.parse(raw_due_date, fuzzy=True).date()
                        break
                    except (ValueError, TypeError):
                        continue
        
        if not parsed_date and raw_due_date:
            try:
                parsed_date = date_parser.parse(raw_due_date, fuzzy=True).date()
            except (ValueError, TypeError):
                pass
        
        return parsed_date, raw_due_date

    def extract_status(self, content: str, has_checkbox: bool = False, checkbox_checked: bool = False) -> ActionStatus:
        status = ActionStatus.PENDING
        
        if has_checkbox and checkbox_checked:
            return ActionStatus.COMPLETED
        
        if has_checkbox and not checkbox_checked:
            return ActionStatus.PENDING
        
        status_keywords_ordered = [
            ("已延期", ActionStatus.DELAYED),
            ("延期", ActionStatus.DELAYED),
            ("延后", ActionStatus.DELAYED),
            ("已完成", ActionStatus.COMPLETED),
            ("待处理", ActionStatus.PENDING),
            ("待办", ActionStatus.PENDING),
            ("未开始", ActionStatus.PENDING),
            ("进行中", ActionStatus.IN_PROGRESS),
            ("处理中", ActionStatus.IN_PROGRESS),
            ("已取消", ActionStatus.CANCELLED),
            ("取消", ActionStatus.CANCELLED),
        ]
        
        for keyword, status_value in status_keywords_ordered:
            if keyword in content:
                if keyword == "完成":
                    if re.search(r'(?<![要去未已待需])完成(?!接口|文档|功能|任务|工作)', content):
                        status = status_value
                        break
                else:
                    status = status_value
                    break
        
        return status

    def extract_delay_reason(self, content: str) -> Optional[str]:
        delay_reason = None
        
        for keyword in self.delay_keywords:
            if keyword in content:
                parts = re.split(r'[，。；;.！!]', content)
                for part in parts:
                    if keyword in part:
                        delay_reason = part.strip()
                        break
                if delay_reason:
                    break
        
        return delay_reason

    def merge_persons_by_name(self, names: List[str], persons_db) -> dict:
        name_mapping = {}
        
        for name in names:
            if not name:
                continue
            
            found = False
            for person in persons_db:
                if person.name == name:
                    name_mapping[name] = person.id
                    found = True
                    break
                
                if person.alias:
                    aliases = [a.strip() for a in person.alias.split(',')]
                    if name in aliases:
                        name_mapping[name] = person.id
                        found = True
                        break
            
            if not found:
                name_mapping[name] = None
        
        return name_mapping

parser = MarkdownParser()
