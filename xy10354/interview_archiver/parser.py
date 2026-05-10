import re
from datetime import datetime, date
from pathlib import Path
from typing import List, Optional, Tuple

from .models import ActionItem, InterviewNote, SecurityLevel


class NoteParser:
    SECURITY_LEVELS = {
        "公开": SecurityLevel.PUBLIC,
        "internal": SecurityLevel.INTERNAL,
        "内部": SecurityLevel.INTERNAL,
        "机密": SecurityLevel.CONFIDENTIAL,
        "confidential": SecurityLevel.CONFIDENTIAL,
        "绝密": SecurityLevel.TOP_SECRET,
        "top_secret": SecurityLevel.TOP_SECRET,
    }

    DATE_FORMATS = [
        "%Y-%m-%d",
        "%Y/%m/%d",
        "%Y年%m月%d日",
        "%m-%d",
        "%m/%d",
    ]

    def parse_file(self, file_path: str) -> InterviewNote:
        path = Path(file_path)
        content = path.read_text(encoding='utf-8')
        file_hash = InterviewNote.calculate_hash(content)

        note = InterviewNote(
            file_path=str(path.absolute()),
            file_hash=file_hash,
        )

        note.customer_name = self._extract_customer_name(content)
        note.interviewee = self._extract_interviewee(content)
        note.interview_date = self._extract_date(content)
        note.security_level = self._extract_security_level(content)
        note.key_questions = self._extract_key_questions(content)
        note.action_items = self._extract_action_items(content)

        return note

    def _extract_customer_name(self, content: str) -> Optional[str]:
        patterns = [
            r'(?:客户(?:名称)?|Customer|Client)[:：]\s*(.+?)(?=\n|$)',
            r'^#\s*(.+?)(?:客户访谈纪要|访谈纪要)?$',
        ]
        for pattern in patterns:
            match = re.search(pattern, content, re.MULTILINE | re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None

    def _extract_interviewee(self, content: str) -> Optional[str]:
        patterns = [
            r'(?:访谈对象|被访者|Interviewee)[:：]\s*(.+?)(?=\n|$)',
        ]
        for pattern in patterns:
            match = re.search(pattern, content, re.MULTILINE | re.IGNORECASE)
            if match:
                return match.group(1).strip()
        return None

    def _extract_date(self, content: str) -> Optional[date]:
        patterns = [
            r'(?:日期|Date)[:：]\s*(.+?)(?=\n|$)',
            r'(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)',
        ]
        for pattern in patterns:
            match = re.search(pattern, content, re.MULTILINE | re.IGNORECASE)
            if match:
                date_str = match.group(1).strip()
                parsed = self._parse_date(date_str)
                if parsed:
                    return parsed
        return None

    def _parse_date(self, date_str: str) -> Optional[date]:
        for fmt in self.DATE_FORMATS:
            try:
                parsed = datetime.strptime(date_str, fmt)
                if fmt in ["%m-%d", "%m/%d"]:
                    return date(datetime.now().year, parsed.month, parsed.day)
                return parsed.date()
            except ValueError:
                continue
        return None

    def _extract_security_level(self, content: str) -> SecurityLevel:
        patterns = [
            r'(?:保密级别|机密等级|Security|Confidential)[:：]\s*(.+?)(?=\n|$)',
        ]
        for pattern in patterns:
            match = re.search(pattern, content, re.MULTILINE | re.IGNORECASE)
            if match:
                level_str = match.group(1).strip().lower()
                return self.SECURITY_LEVELS.get(level_str, SecurityLevel.INTERNAL)
        return SecurityLevel.INTERNAL

    def _extract_key_questions(self, content: str) -> List[str]:
        questions: List[str] = []
        
        section_patterns = [
            r'^##\s*(?:关键问题|主要问题|Key Questions?)\s*\n(.*?)(?=\n^##\s|\Z)',
            r'^(?:关键问题|主要问题|Key Questions?)[：:]\s*\n(.*?)(?=\n\n|\Z)',
        ]
        
        for pattern in section_patterns:
            section_match = re.search(
                pattern,
                content,
                re.DOTALL | re.MULTILINE | re.IGNORECASE
            )
            if section_match:
                section_content = section_match.group(1)
                for line in section_content.split('\n'):
                    line = line.strip()
                    if line and not line.startswith('#'):
                        if line.startswith(('-', '*', '•', '1.', '2.', '3.', '4.', '5.', '6.', '7.', '8.', '9.')):
                            question = re.sub(r'^[-*•\d.]+\s*', '', line).strip()
                            if question:
                                questions.append(question)
                        elif line:
                            questions.append(line)
                if questions:
                    break
        
        return questions

    def _extract_action_items(self, content: str) -> List[ActionItem]:
        items: List[ActionItem] = []

        section_patterns = [
            r'^##\s*(?:行动项|待办事项|Action Items?|TODO)\s*\n(.*?)(?=\n^##\s|\Z)',
            r'^(?:行动项|待办事项|Action Items?|TODO)[：:]\s*\n(.*?)(?=\n\n|\Z)',
        ]

        for pattern in section_patterns:
            section_match = re.search(
                pattern,
                content,
                re.DOTALL | re.MULTILINE | re.IGNORECASE
            )

            if section_match:
                section_content = section_match.group(1)
                lines = [line.strip() for line in section_content.split('\n') if line.strip()]

                for line in lines:
                    item = self._parse_action_item_line(line)
                    if item:
                        items.append(item)
                
                if items:
                    break

        return items

    def _parse_action_item_line(self, line: str) -> Optional[ActionItem]:
        line = re.sub(r'^[-*•\d.]+\s*', '', line).strip()
        if not line:
            return None

        owner: Optional[str] = None
        due_date: Optional[date] = None

        owner_match = re.search(r'[@\(（]([^)）]+)[)）]', line)
        if owner_match:
            owner = owner_match.group(1).strip()

        date_match = re.search(
            r'(?:截止|截止日期|due|by)[：:]\s*(\S+)|'
            r'(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)|'
            r'(\d{1,2}[-/]\d{1,2})',
            line,
            re.IGNORECASE
        )
        if date_match:
            date_str = date_match.group(1) or date_match.group(2) or date_match.group(3)
            if date_str:
                due_date = self._parse_date(date_str.strip())

        description = line
        if owner_match:
            description = description.replace(owner_match.group(0), '')
        if date_match:
            description = description.replace(date_match.group(0), '')

        description = re.sub(r'[，,。.\s]+$', '', description).strip()
        description = re.sub(r'\s+', ' ', description)

        if description:
            return ActionItem(
                description=description,
                owner=owner,
                due_date=due_date,
            )

        return None
