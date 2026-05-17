import pandas as pd
from pathlib import Path
from typing import List, Dict, Optional, Any
from dataclasses import dataclass, field
import hashlib
import chardet


@dataclass
class TicketRow:
    row_index: int
    source_file: str
    ticket_id: Optional[str] = None
    agent_id: Optional[str] = None
    call_duration: Optional[int] = None
    call_time: Optional[str] = None
    customer_phone: Optional[str] = None
    is_valid: bool = True
    error_message: Optional[str] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)


@dataclass
class AgentRow:
    row_index: int
    source_file: str
    agent_id: Optional[str] = None
    agent_name: Optional[str] = None
    team: Optional[str] = None
    is_valid: bool = True
    error_message: Optional[str] = None
    raw_data: Dict[str, Any] = field(default_factory=dict)


class DataParser:
    TICKET_ID_COLUMNS = ['工单号', '工单编号', 'ticket_id', 'ticketid', '工单ID', 'order_id']
    AGENT_ID_COLUMNS = ['坐席号', '坐席编号', 'agent_id', 'agentid', '坐席ID', '工号']
    DURATION_COLUMNS = ['通话时长', '时长', 'duration', 'call_duration', '通话时长(秒)']
    CALL_TIME_COLUMNS = ['通话时间', '呼叫时间', 'call_time', '来电时间']
    PHONE_COLUMNS = ['客户电话', '手机号码', 'phone', 'customer_phone', '来电号码']
    AGENT_NAME_COLUMNS = ['坐席姓名', '姓名', 'agent_name', 'name']
    TEAM_COLUMNS = ['班组', '团队', 'team', '部门']

    def __init__(self):
        self.tickets: List[TicketRow] = []
        self.agents: List[AgentRow] = []
        self.tickets_hash: str = ""
        self.agents_hash: str = ""

    def _detect_encoding(self, file_path: str) -> str:
        with open(file_path, 'rb') as f:
            result = chardet.detect(f.read(10000))
        return result['encoding'] or 'utf-8'

    def _read_file(self, file_path: str, sheet_name: Optional[int] = 0) -> pd.DataFrame:
        path = Path(file_path)
        if path.suffix.lower() in ['.xlsx', '.xls']:
            return pd.read_excel(file_path, sheet_name=sheet_name, dtype=str)
        else:
            encoding = self._detect_encoding(file_path)
            try:
                return pd.read_csv(file_path, encoding=encoding, dtype=str)
            except UnicodeDecodeError:
                return pd.read_csv(file_path, encoding='gbk', dtype=str)

    def _find_column(self, columns: List[str], candidates: List[str]) -> Optional[str]:
        columns_lower = {str(c).lower().strip(): c for c in columns}
        for candidate in candidates:
            candidate_lower = candidate.lower()
            if candidate_lower in columns_lower:
                return columns_lower[candidate_lower]
            for col in columns_lower:
                if candidate_lower in col or col in candidate_lower:
                    return columns_lower[col]
        return None

    def parse_ticket_file(self, file_path: str, sheet_name: Optional[int] = 0) -> List[TicketRow]:
        df = self._read_file(file_path, sheet_name)
        tickets = []
        
        ticket_id_col = self._find_column(df.columns.tolist(), self.TICKET_ID_COLUMNS)
        agent_id_col = self._find_column(df.columns.tolist(), self.AGENT_ID_COLUMNS)
        duration_col = self._find_column(df.columns.tolist(), self.DURATION_COLUMNS)
        call_time_col = self._find_column(df.columns.tolist(), self.CALL_TIME_COLUMNS)
        phone_col = self._find_column(df.columns.tolist(), self.PHONE_COLUMNS)

        for idx, row in df.iterrows():
            ticket = TicketRow(
                row_index=idx + 2,
                source_file=file_path,
                raw_data=row.to_dict()
            )
            
            errors = []
            
            if ticket_id_col:
                ticket.ticket_id = str(row[ticket_id_col]).strip() if pd.notna(row[ticket_id_col]) else None
                if not ticket.ticket_id or ticket.ticket_id in ['nan', 'None', '']:
                    errors.append("工单号为空")
            
            if agent_id_col:
                ticket.agent_id = str(row[agent_id_col]).strip() if pd.notna(row[agent_id_col]) else None
            
            if duration_col and pd.notna(row[duration_col]):
                duration_str = str(row[duration_col]).strip()
                ticket.call_duration = self._parse_duration(duration_str)
            
            if call_time_col and pd.notna(row[call_time_col]):
                ticket.call_time = str(row[call_time_col]).strip()
            
            if phone_col and pd.notna(row[phone_col]):
                ticket.customer_phone = str(row[phone_col]).strip()
            
            if errors:
                ticket.is_valid = False
                ticket.error_message = "; ".join(errors)
            
            tickets.append(ticket)
        
        self.tickets.extend(tickets)
        self._generate_tickets_hash()
        return tickets

    def parse_agent_file(self, file_path: str, sheet_name: Optional[int] = 0) -> List[AgentRow]:
        df = self._read_file(file_path, sheet_name)
        agents = []
        
        agent_id_col = self._find_column(df.columns.tolist(), self.AGENT_ID_COLUMNS)
        agent_name_col = self._find_column(df.columns.tolist(), self.AGENT_NAME_COLUMNS)
        team_col = self._find_column(df.columns.tolist(), self.TEAM_COLUMNS)

        for idx, row in df.iterrows():
            agent = AgentRow(
                row_index=idx + 2,
                source_file=file_path,
                raw_data=row.to_dict()
            )
            
            errors = []
            
            if agent_id_col:
                agent.agent_id = str(row[agent_id_col]).strip() if pd.notna(row[agent_id_col]) else None
                if not agent.agent_id or agent.agent_id in ['nan', 'None', '']:
                    errors.append("坐席编号为空")
            
            if agent_name_col and pd.notna(row[agent_name_col]):
                agent.agent_name = str(row[agent_name_col]).strip()
            
            if team_col and pd.notna(row[team_col]):
                agent.team = str(row[team_col]).strip()
            
            if errors:
                agent.is_valid = False
                agent.error_message = "; ".join(errors)
            
            agents.append(agent)
        
        self.agents.extend(agents)
        self._generate_agents_hash()
        return agents

    def _parse_duration(self, duration_str: str) -> Optional[int]:
        import re
        duration_str = duration_str.strip()
        
        match = re.match(r'(\d+):(\d+):(\d+)', duration_str)
        if match:
            return int(match.group(1)) * 3600 + int(match.group(2)) * 60 + int(match.group(3))
        
        match = re.match(r'(\d+):(\d+)', duration_str)
        if match:
            return int(match.group(1)) * 60 + int(match.group(2))
        
        match = re.match(r'(\d+)m(\d+)s', duration_str)
        if match:
            return int(match.group(1)) * 60 + int(match.group(2))
        
        match = re.match(r'(\d+)', duration_str)
        if match:
            return int(match.group(1))
        
        return None

    def _generate_tickets_hash(self) -> None:
        content = "|".join(sorted(f"{t.source_file}:{t.row_index}:{t.ticket_id or ''}" for t in self.tickets))
        self.tickets_hash = hashlib.md5(content.encode()).hexdigest()

    def _generate_agents_hash(self) -> None:
        content = "|".join(sorted(f"{a.source_file}:{a.row_index}:{a.agent_id or ''}" for a in self.agents))
        self.agents_hash = hashlib.md5(content.encode()).hexdigest()

    def get_valid_tickets(self) -> List[TicketRow]:
        return [t for t in self.tickets if t.is_valid]

    def get_valid_agents(self) -> List[AgentRow]:
        return [a for a in self.agents if a.is_valid]
