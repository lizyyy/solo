import json
import csv
import re
from datetime import datetime
from pathlib import Path
from typing import List, Optional, Dict, Any, Tuple
from models import (
    MigrationItem,
    AlarmRecord,
    InterfaceDoc,
    AuditLog,
)


class BaseParser:
    def __init__(self, file_path: str):
        self.file_path = file_path
        self.file_name = Path(file_path).name

    def parse(self):
        raise NotImplementedError


class MigrationListParser(BaseParser):
    def parse(self) -> List[MigrationItem]:
        items = []
        file_ext = Path(self.file_path).suffix.lower()

        if file_ext == '.json':
            items = self._parse_json()
        elif file_ext == '.csv':
            items = self._parse_csv()
        elif file_ext in ['.txt', '.md']:
            items = self._parse_text()

        for item in items:
            item.source_file = self.file_name
        return items

    def _parse_json(self) -> List[MigrationItem]:
        items = []
        with open(self.file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if isinstance(data, list):
            for idx, record in enumerate(data, 1):
                item = MigrationItem(
                    id=record.get('id', record.get('migration_id', f'MIG-{idx:04d}')),
                    interface_name=record.get('interface_name', record.get('name', '')),
                    old_endpoint=record.get('old_endpoint', record.get('old_api', '')),
                    new_endpoint=record.get('new_endpoint', record.get('new_api', '')),
                    migration_date=self._parse_date(record.get('migration_date', record.get('date', ''))),
                    status=record.get('status', '未知'),
                    owner=record.get('owner', record.get('responsible', '')),
                    remarks=record.get('remarks', record.get('comment', ''))
                )
                item.line_number = idx
                items.append(item)
        return items

    def _parse_csv(self) -> List[MigrationItem]:
        items = []
        with open(self.file_path, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for idx, row in enumerate(reader, 2):
                item = MigrationItem(
                    id=row.get('id', row.get('migration_id', f'MIG-{idx:04d}')),
                    interface_name=row.get('interface_name', row.get('name', '')),
                    old_endpoint=row.get('old_endpoint', row.get('old_api', '')),
                    new_endpoint=row.get('new_endpoint', row.get('new_api', '')),
                    migration_date=self._parse_date(row.get('migration_date', row.get('date', ''))),
                    status=row.get('status', '未知'),
                    owner=row.get('owner', row.get('responsible', '')),
                    remarks=row.get('remarks', row.get('comment', ''))
                )
                item.line_number = idx
                items.append(item)
        return items

    def _parse_text(self) -> List[MigrationItem]:
        items = []
        date_pattern = r'\d{4}[-/]\d{2}[-/]\d{2}'
        interface_pattern = r'([a-zA-Z_][a-zA-Z0-9_]*(?:/[a-zA-Z_][a-zA-Z0-9_]*)*)'

        with open(self.file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        current_entry: Dict[str, Any] = {}
        for idx, line in enumerate(lines, 1):
            line = line.strip()
            if not line:
                continue

            date_match = re.search(date_pattern, line)
            if date_match and '接口' in line:
                if current_entry:
                    items.append(self._dict_to_migration(current_entry))
                current_entry = {
                    'line_number': idx,
                    'id': f'MIG-{idx:04d}',
                    'migration_date': date_match.group()
                }
                name_match = re.search(r'接口[:：]\s*(\S+)', line)
                if name_match:
                    current_entry['interface_name'] = name_match.group(1)
            elif '旧接口' in line or 'old' in line.lower():
                ep_match = re.search(interface_pattern, line)
                if ep_match:
                    current_entry['old_endpoint'] = ep_match.group(1)
            elif '新接口' in line or 'new' in line.lower():
                ep_match = re.search(interface_pattern, line)
                if ep_match:
                    current_entry['new_endpoint'] = ep_match.group(1)
            elif '负责人' in line or 'owner' in line.lower():
                owner_match = re.search(r'负责人[:：]\s*(\S+)', line)
                if owner_match:
                    current_entry['owner'] = owner_match.group(1)
            elif '状态' in line or 'status' in line.lower():
                status_match = re.search(r'状态[:：]\s*(\S+)', line)
                if status_match:
                    current_entry['status'] = status_match.group(1)

        if current_entry:
            items.append(self._dict_to_migration(current_entry))

        return items

    def _dict_to_migration(self, data: Dict[str, Any]) -> MigrationItem:
        return MigrationItem(
            id=data.get('id', ''),
            interface_name=data.get('interface_name', ''),
            old_endpoint=data.get('old_endpoint', ''),
            new_endpoint=data.get('new_endpoint', ''),
            migration_date=self._parse_date(data.get('migration_date', '')),
            status=data.get('status', '未知'),
            owner=data.get('owner', ''),
            line_number=data.get('line_number', 0)
        )

    def _parse_date(self, date_str: str) -> datetime:
        if not date_str:
            return datetime.now()
        for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%Y-%m-%d %H:%M:%S', '%Y/%m/%d %H:%M:%S']:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        return datetime.now()


class AlarmLogParser(BaseParser):
    LOG_PATTERNS = [
        (r'\[(?P<time>[^\]]+)\]\s+(?P<level>\w+)\s+(?P<msg>.+)', 'standard'),
        (r'(?P<time>\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}),\d+\s+(?P<level>\w+)\s+(?P<msg>.+)', 'log4j'),
    ]

    def parse(self) -> List[AlarmRecord]:
        records = []
        file_ext = Path(self.file_path).suffix.lower()

        if file_ext == '.json':
            records = self._parse_json()
        else:
            records = self._parse_log()

        for record in records:
            record.source_file = self.file_name
        return records

    def _parse_json(self) -> List[AlarmRecord]:
        records = []
        with open(self.file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if isinstance(data, list):
            for idx, entry in enumerate(data, 1):
                record = AlarmRecord(
                    id=entry.get('id', f'ALM-{idx:04d}'),
                    timestamp=self._parse_date(entry.get('timestamp', entry.get('time', ''))),
                    interface_name=entry.get('interface_name', entry.get('api', '')),
                    error_type=entry.get('error_type', entry.get('type', '')),
                    error_message=entry.get('error_message', entry.get('message', '')),
                    request_id=entry.get('request_id', entry.get('req_id', '')),
                    idempotency_key=entry.get('idempotency_key', entry.get('idemp_key')),
                    line_number=idx,
                    raw_content=json.dumps(entry, ensure_ascii=False)
                )
                records.append(record)
        return records

    def _parse_log(self) -> List[AlarmRecord]:
        records = []
        with open(self.file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        for idx, line in enumerate(lines, 1):
            line = line.strip()
            if not line:
                continue

            parsed = self._parse_log_line(line, idx)
            if parsed:
                records.append(parsed)

        return records

    def _parse_log_line(self, line: str, line_num: int) -> Optional[AlarmRecord]:
        for pattern, _ in self.LOG_PATTERNS:
            match = re.match(pattern, line)
            if match:
                groups = match.groupdict()
                time_str = groups.get('time', '')
                msg = groups.get('msg', '')

                request_id = self._extract_request_id(msg) or self._extract_request_id(line)
                idempotency_key = self._extract_idempotency_key(msg) or self._extract_idempotency_key(line)

                return AlarmRecord(
                    id=f'ALM-{line_num:04d}',
                    timestamp=self._parse_date(time_str),
                    interface_name=self._extract_interface(msg),
                    error_type=groups.get('level', 'ERROR'),
                    error_message=msg,
                    request_id=request_id,
                    idempotency_key=idempotency_key,
                    line_number=line_num,
                    raw_content=line
                )
        return None

    def _extract_request_id(self, text: str) -> str:
        patterns = [
            r'request_id[=:]\s*([a-f0-9\-]+)',
            r'reqId[=:]\s*([a-f0-9\-]+)',
            r'RequestId[=:]\s*([a-f0-9\-]+)',
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1)
        return ''

    def _extract_idempotency_key(self, text: str) -> Optional[str]:
        patterns = [
            r'idempotency_?key[=:]\s*([a-f0-9\-]+)',
            r'idemp_?key[=:]\s*([a-f0-9\-]+)',
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1)
        return None

    def _extract_interface(self, text: str) -> str:
        patterns = [
            r'interface[=:]\s*([a-zA-Z0-9_/]+)',
            r'api[=:]\s*([a-zA-Z0-9_/]+)',
            r'endpoint[=:]\s*([a-zA-Z0-9_/]+)',
        ]
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                return match.group(1)
        return ''

    def _parse_date(self, date_str: str) -> datetime:
        if not date_str:
            return datetime.now()
        formats = [
            '%Y-%m-%d %H:%M:%S',
            '%Y/%m/%d %H:%M:%S',
            '%Y-%m-%dT%H:%M:%S',
            '%Y-%m-%dT%H:%M:%S%z',
            '%d/%b/%Y:%H:%M:%S %z',
        ]
        for fmt in formats:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        return datetime.now()


class InterfaceDocParser(BaseParser):
    def parse(self) -> List[InterfaceDoc]:
        docs = []
        file_ext = Path(self.file_path).suffix.lower()

        if file_ext in ['.md', '.txt']:
            docs = self._parse_markdown()
        elif file_ext == '.json':
            docs = self._parse_json()

        for doc in docs:
            doc.source_file = self.file_name
        return docs

    def _parse_markdown(self) -> List[InterfaceDoc]:
        docs = []
        with open(self.file_path, 'r', encoding='utf-8') as f:
            content = f.read()

        sections = re.split(r'\n##+\s+', content)
        for idx, section in enumerate(sections[1:], 1):
            lines = section.split('\n')
            title = lines[0].strip() if lines else ''

            doc_data = {
                'interface_name': title,
                'line_number': content.find(section) + 1
            }

            for line in lines[1:]:
                if '版本' in line or 'version' in line.lower():
                    ver_match = re.search(r'版?本?[:：]\s*v?([\d.]+)', line, re.IGNORECASE)
                    if ver_match:
                        doc_data['version'] = ver_match.group(1)
                elif '修改时间' in line or 'modified' in line.lower():
                    date_match = re.search(r'修改时间?[:：]\s*([^\s]+)', line)
                    if date_match:
                        doc_data['last_modified'] = date_match.group(1)
                elif '修改人' in line or 'modified by' in line.lower():
                    person_match = re.search(r'修改人?[:：]\s*(\S+)', line)
                    if person_match:
                        doc_data['modified_by'] = person_match.group(1)
                elif '变更说明' in line or 'change' in line.lower():
                    desc_match = re.search(r'变更说明?[:：]\s*(.+)', line)
                    if desc_match:
                        doc_data['change_description'] = desc_match.group(1)
                elif '端点' in line or 'endpoint' in line.lower():
                    ep_match = re.search(r'端点?[:：]\s*(\S+)', line)
                    if ep_match:
                        doc_data['endpoint'] = ep_match.group(1)
                elif '手工改动' in line or 'manual' in line.lower():
                    doc_data['is_manual_change'] = True

            docs.append(InterfaceDoc(
                interface_name=doc_data.get('interface_name', ''),
                endpoint=doc_data.get('endpoint', ''),
                version=doc_data.get('version', '1.0'),
                last_modified=self._parse_date(doc_data.get('last_modified', '')),
                modified_by=doc_data.get('modified_by', ''),
                change_description=doc_data.get('change_description', ''),
                is_manual_change=doc_data.get('is_manual_change', False)
            ))

        return docs

    def _parse_json(self) -> List[InterfaceDoc]:
        docs = []
        with open(self.file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if isinstance(data, list):
            for entry in data:
                doc = InterfaceDoc(
                    interface_name=entry.get('interface_name', entry.get('name', '')),
                    endpoint=entry.get('endpoint', ''),
                    version=entry.get('version', '1.0'),
                    last_modified=self._parse_date(entry.get('last_modified', '')),
                    modified_by=entry.get('modified_by', ''),
                    change_description=entry.get('change_description', ''),
                    is_manual_change=entry.get('is_manual_change', False)
                )
                docs.append(doc)
        return docs

    def _parse_date(self, date_str: str) -> datetime:
        if not date_str:
            return datetime.now()
        for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%Y-%m-%d %H:%M:%S']:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        return datetime.now()


class AuditLogParser(BaseParser):
    def parse(self) -> List[AuditLog]:
        logs = []
        file_ext = Path(self.file_path).suffix.lower()

        if file_ext == '.json':
            logs = self._parse_json()
        else:
            logs = self._parse_text()

        for log in logs:
            log.source_file = self.file_name
        return logs

    def _parse_json(self) -> List[AuditLog]:
        logs = []
        with open(self.file_path, 'r', encoding='utf-8') as f:
            data = json.load(f)

        if isinstance(data, list):
            for idx, entry in enumerate(data, 1):
                log = AuditLog(
                    id=entry.get('id', f'AUD-{idx:04d}'),
                    timestamp=self._parse_date(entry.get('timestamp', entry.get('time', ''))),
                    operation=entry.get('operation', entry.get('action', '')),
                    operator=entry.get('operator', entry.get('user', '')),
                    file_name=entry.get('file_name', entry.get('filename', '')),
                    file_size=int(entry.get('file_size', entry.get('size', 0)) or 0),
                    status=entry.get('status', ''),
                    request_id=entry.get('request_id', ''),
                    idempotency_key=entry.get('idempotency_key')
                )
                logs.append(log)
        return logs

    def _parse_text(self) -> List[AuditLog]:
        logs = []
        with open(self.file_path, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        for idx, line in enumerate(lines, 1):
            line = line.strip()
            if not line:
                continue

            time_match = re.search(r'(\d{4}[-/]\d{2}[-/]\d{2}\s+\d{2}:\d{2}:\d{2})', line)
            file_match = re.search(r'文件[:：]\s*(\S+)', line)
            op_match = re.search(r'操作[:：]\s*(\S+)', line)
            user_match = re.search(r'操?作?者[:：]\s*(\S+)', line)
            size_match = re.search(r'大小[:：]\s*(\d+)', line)
            status_match = re.search(r'状态[:：]\s*(\S+)', line)
            req_match = re.search(r'request_id[=:]\s*([a-f0-9\-]+)', line, re.IGNORECASE)
            idemp_match = re.search(r'idempotency_?key[=:]\s*([a-f0-9\-]+)', line, re.IGNORECASE)

            if time_match and (file_match or op_match):
                log = AuditLog(
                    id=f'AUD-{idx:04d}',
                    timestamp=self._parse_date(time_match.group(1)),
                    operation=op_match.group(1) if op_match else '',
                    operator=user_match.group(1) if user_match else '',
                    file_name=file_match.group(1) if file_match else '',
                    file_size=int(size_match.group(1)) if size_match else 0,
                    status=status_match.group(1) if status_match else '',
                    request_id=req_match.group(1) if req_match else '',
                    idempotency_key=idemp_match.group(1) if idemp_match else None
                )
                logs.append(log)

        return logs

    def _parse_date(self, date_str: str) -> datetime:
        if not date_str:
            return datetime.now()
        for fmt in ['%Y-%m-%d %H:%M:%S', '%Y/%m/%d %H:%M:%S']:
            try:
                return datetime.strptime(date_str, fmt)
            except ValueError:
                continue
        return datetime.now()
