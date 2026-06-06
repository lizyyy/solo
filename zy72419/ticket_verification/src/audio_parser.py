import csv
import json
import re
from pathlib import Path
from typing import List, Dict, Any, Optional

from .models import AudioRemark


class AudioRemarkParser:
    def __init__(self):
        self.patterns = {
            'repertoire': [
                r'曲目[:：]\s*(.+?)(?=\s*[，。；\n]|$)',
                r'演奏[:：]\s*(.+?)(?=\s*[，。；\n]|$)',
                r'曲目\s*[为是]\s*(.+?)(?=\s*[，。；\n]|$)',
            ],
            'date': [
                r'(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)',
                r'(\d{1,2}[-/月]\d{1,2}日?)',
            ],
            'status': [
                r'状态[:：]\s*(.+?)(?=\s*[，。；\n]|$)',
                r'核销[:：]\s*(.+?)(?=\s*[，。；\n]|$)',
            ],
            'leave': [
                r'(请假|病假|事假|缺课|没来)',
            ]
        }

    def parse_file(self, file_path: str) -> List[AudioRemark]:
        path = Path(file_path)
        if path.suffix.lower() == '.csv':
            return self._parse_csv(file_path)
        elif path.suffix.lower() == '.json':
            return self._parse_json(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {path.suffix}")

    def _parse_csv(self, file_path: str) -> List[AudioRemark]:
        remarks: List[AudioRemark] = []

        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                remark = self._parse_row(row)
                remarks.append(remark)

        return remarks

    def _parse_json(self, file_path: str) -> List[AudioRemark]:
        remarks: List[AudioRemark] = []

        with open(file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        records = data if isinstance(data, list) else data.get('remarks', data.get('records', []))

        for row in records:
            remark = self._parse_row(row)
            remarks.append(remark)

        return remarks

    def _parse_row(self, row: Dict[str, Any]) -> AudioRemark:
        audio_file = str(row.get('audio_file', row.get('音频文件', row.get('文件名', '')))).strip()
        ticket_id = str(row.get('ticket_id', row.get('票号', row.get('关联票号', '')))).strip()
        student_name = str(row.get('student_name', row.get('学员姓名', row.get('姓名', '')))).strip()

        raw_remark = str(row.get('remark', row.get('备注', row.get('audio_remark', row.get('raw_remark', ''))))).strip()

        parsed_repertoire = self._extract_pattern(raw_remark, 'repertoire')
        parsed_date = self._extract_pattern(raw_remark, 'date')
        parsed_status = self._extract_pattern(raw_remark, 'status')
        parsed_is_leave = bool(self._extract_pattern(raw_remark, 'leave'))

        parsed_extra = self._extract_extra_info(raw_remark)

        return AudioRemark(
            audio_file=audio_file,
            ticket_id=ticket_id,
            student_name=student_name,
            raw_remark=raw_remark,
            parsed_repertoire=parsed_repertoire,
            parsed_date=parsed_date,
            parsed_status=parsed_status,
            parsed_is_leave=parsed_is_leave,
            parsed_extra=parsed_extra
        )

    def _extract_pattern(self, text: str, pattern_type: str) -> Optional[str]:
        if not text:
            return None

        patterns = self.patterns.get(pattern_type, [])
        for pattern in patterns:
            match = re.search(pattern, text)
            if match:
                return match.group(1).strip()
        return None

    def _extract_extra_info(self, text: str) -> Dict[str, Any]:
        extra = {}

        teacher_match = re.search(r'老师[:：]\s*(.+?)(?=\s*[，。；\n]|$)', text)
        if teacher_match:
            extra['teacher'] = teacher_match.group(1).strip()

        duration_match = re.search(r'(\d+)\s*(分钟|min|分)', text)
        if duration_match:
            extra['duration'] = int(duration_match.group(1))

        score_match = re.search(r'得分[:：]\s*(\d+(?:\.\d+)?)', text)
        if score_match:
            extra['score'] = float(score_match.group(1))

        return extra

    def get_raw_remarks_by_ticket(self, remarks: List[AudioRemark]) -> Dict[str, List[AudioRemark]]:
        result: Dict[str, List[AudioRemark]] = {}
        for remark in remarks:
            if remark.ticket_id:
                if remark.ticket_id not in result:
                    result[remark.ticket_id] = []
                result[remark.ticket_id].append(remark)
        return result
