"""
CSV解析与脱敏模块
负责导入CSV文件，保留原始文件，并对敏感信息进行脱敏处理
"""

import csv
import json
import re
import shutil
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

from .config import Config


@dataclass
class ParsedTicket:
    ticket_id: str
    original_data: Dict[str, Any]
    sanitized_data: Dict[str, Any]
    import_time: datetime
    source_file: str
    row_index: int


class TicketParser:
    PHONE_PATTERN = re.compile(r'\b1[3-9]\d{9}\b')
    EMAIL_PATTERN = re.compile(r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b')
    ORDER_PATTERN = re.compile(r'\b[A-Z0-9]{8,20}\b')
    ID_CARD_PATTERN = re.compile(r'\b[1-9]\d{5}(19|20)\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])\d{3}[\dXx]\b')
    USER_ID_PATTERN = re.compile(r'\b[A-Za-z0-9_]{5,30}\b')

    def __init__(self, config: Config):
        self.config = config

    def import_csv(self, csv_path: Path, import_id: Optional[str] = None) -> List[ParsedTicket]:
        if not csv_path.exists():
            raise FileNotFoundError(f"CSV文件不存在: {csv_path}")
        
        if import_id is None:
            import_id = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        dest_dir = self.config.get_data_path() / "raw"
        dest_dir.mkdir(exist_ok=True)
        
        dest_filename = f"{import_id}_{csv_path.name}"
        dest_path = dest_dir / dest_filename
        shutil.copy2(csv_path, dest_path)
        
        tickets = []
        with open(csv_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row_index, row in enumerate(reader, start=2):
                mapped_row = self._apply_field_mapping(row)
                ticket = self._parse_row(mapped_row, row_index, str(dest_filename), import_id)
                tickets.append(ticket)
        
        return tickets

    def _apply_field_mapping(self, row: Dict[str, Any]) -> Dict[str, Any]:
        if not self.config.field_mapping:
            return row
        
        mapped = {}
        for key, value in row.items():
            if key in self.config.field_mapping:
                mapped[self.config.field_mapping[key]] = value
            else:
                mapped[key] = value
        
        for internal_field, external_field in self.config.field_mapping.items():
            if external_field not in mapped and internal_field in row:
                mapped[external_field] = row[internal_field]
        
        return mapped

    def _parse_row(self, row: Dict[str, Any], row_index: int, source_file: str, import_id: str) -> ParsedTicket:
        original_data = dict(row)
        sanitized_data = self._sanitize_row(row)
        
        ticket_id = sanitized_data.get("工单号", f"{import_id}_{row_index}")
        
        return ParsedTicket(
            ticket_id=ticket_id,
            original_data=original_data,
            sanitized_data=sanitized_data,
            import_time=datetime.now(),
            source_file=source_file,
            row_index=row_index
        )

    def _sanitize_row(self, row: Dict[str, Any]) -> Dict[str, Any]:
        sanitized = {}
        for key, value in row.items():
            if value is None:
                sanitized[key] = value
                continue
            
            if isinstance(value, str):
                value = self._sanitize_text(value, key)
            
            sanitized[key] = value
        
        return sanitized

    def _sanitize_text(self, text: str, field_name: str) -> str:
        if not text:
            return text
        
        is_sensitive_field = any(
            sensitive in field_name or field_name in sensitive
            for sensitive in self.config.sensitive_fields
        )
        
        if is_sensitive_field:
            return self._mask_sensitive_field(text, field_name)
        
        text = self.PHONE_PATTERN.sub('[PHONE]', text)
        text = self.EMAIL_PATTERN.sub('[EMAIL]', text)
        text = self.ORDER_PATTERN.sub('[ORDER]', text)
        text = self.ID_CARD_PATTERN.sub('[ID_CARD]', text)
        
        return text

    def _mask_sensitive_field(self, text: str, field_name: str) -> str:
        if not text:
            return text
        
        text = str(text)
        
        if "手机号" in field_name or "电话" in field_name:
            if len(text) == 11:
                return text[:3] + "****" + text[7:]
            elif len(text) > 4:
                return text[:2] + "*" * (len(text) - 4) + text[-2:]
            return text
        
        if "邮箱" in field_name:
            if "@" in text:
                parts = text.split("@")
                username = parts[0]
                domain = parts[1]
                if len(username) > 2:
                    masked_username = username[:2] + "***"
                else:
                    masked_username = username + "***"
                return f"{masked_username}@{domain}"
            return text
        
        if "订单号" in field_name:
            if len(text) > 8:
                return text[:4] + "****" + text[-4:]
            elif len(text) > 4:
                return text[:2] + "**" + text[-2:]
            return text
        
        if "身份证" in field_name:
            if len(text) == 18:
                return text[:6] + "********" + text[-4:]
            elif len(text) == 15:
                return text[:6] + "***" + text[-4:]
            return text
        
        if "用户ID" in field_name or "user" in field_name.lower():
            if len(text) > 4:
                return text[:2] + "****" + text[-2:]
            return text
        
        return text

    def save_tickets(self, tickets: List[ParsedTicket], import_id: str) -> Path:
        output_data = []
        for ticket in tickets:
            output_data.append({
                "ticket_id": ticket.ticket_id,
                "original_data": ticket.original_data,
                "sanitized_data": ticket.sanitized_data,
                "import_time": ticket.import_time.isoformat(),
                "source_file": ticket.source_file,
                "row_index": ticket.row_index
            })
        
        output_path = self.config.get_data_path() / f"imported_{import_id}.json"
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(output_data, f, ensure_ascii=False, indent=2)
        
        return output_path

    def load_tickets(self, import_id: str) -> List[ParsedTicket]:
        input_path = self.config.get_data_path() / f"imported_{import_id}.json"
        
        if not input_path.exists():
            raise FileNotFoundError(f"导入数据不存在: {input_path}")
        
        with open(input_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        tickets = []
        for item in data:
            ticket = ParsedTicket(
                ticket_id=item["ticket_id"],
                original_data=item["original_data"],
                sanitized_data=item["sanitized_data"],
                import_time=datetime.fromisoformat(item["import_time"]),
                source_file=item["source_file"],
                row_index=item["row_index"]
            )
            tickets.append(ticket)
        
        return tickets

    def list_imports(self) -> List[Dict[str, Any]]:
        data_path = self.config.get_data_path()
        import_files = list(data_path.glob("imported_*.json"))
        
        imports = []
        for file_path in import_files:
            import_id = file_path.stem.replace("imported_", "")
            try:
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                
                if data:
                    first_ticket = data[0]
                    source_file = first_ticket.get("source_file", "unknown")
                    import_time = first_ticket.get("import_time", "")
                    
                    imports.append({
                        "import_id": import_id,
                        "source_file": source_file,
                        "import_time": import_time,
                        "ticket_count": len(data),
                        "file_path": str(file_path)
                    })
            except Exception:
                pass
        
        return sorted(imports, key=lambda x: x["import_time"], reverse=True)


def load_all_tickets(config: Config) -> Tuple[List[ParsedTicket], Dict[str, Any]]:
    parser = TicketParser(config)
    imports = parser.list_imports()
    
    all_tickets = []
    import_info = {}
    
    for import_data in imports:
        try:
            tickets = parser.load_tickets(import_data["import_id"])
            all_tickets.extend(tickets)
            import_info[import_data["import_id"]] = import_data
        except Exception:
            pass
    
    return all_tickets, import_info
