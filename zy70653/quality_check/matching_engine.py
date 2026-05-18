from typing import List, Dict, Optional, Set, Tuple
from dataclasses import dataclass
from .file_scanner import RecordingFile
from .data_parser import TicketRow, AgentRow
import re
import hashlib


@dataclass
class MatchResult:
    ticket: TicketRow
    matched_recordings: List[RecordingFile]
    matched_agent: Optional[AgentRow]
    match_status: str
    match_score: int
    issues: List[str]


class MatchingEngine:
    MATCH_STATUS = {
        'FULL_MATCH': '完全匹配',
        'PARTIAL_MATCH': '部分匹配',
        'NO_RECORDING': '无录音',
        'NO_AGENT': '无坐席匹配',
        'MISMATCH': '信息不匹配',
        'INVALID_TICKET': '工单无效'
    }

    def __init__(self, strict_mode: bool = False):
        self.strict_mode = strict_mode
        self.match_results: List[MatchResult] = []
        self.match_hash: str = ""

    def normalize_id(self, id_str: Optional[str]) -> str:
        if not id_str:
            return ""
        return str(id_str).strip().upper().replace('-', '').replace('_', '')

    def is_similar_id(self, id1: Optional[str], id2: Optional[str], threshold: float = 0.8) -> bool:
        norm1 = self.normalize_id(id1)
        norm2 = self.normalize_id(id2)
        
        if not norm1 or not norm2:
            return False
        
        if norm1 == norm2:
            return True
        
        if norm1 in norm2 or norm2 in norm1:
            return True
        
        common_chars = set(norm1) & set(norm2)
        return len(common_chars) / max(len(norm1), len(norm2)) >= threshold

    def match_ticket_with_recording(
        self, 
        ticket: TicketRow, 
        recordings: List[RecordingFile]
    ) -> Tuple[List[RecordingFile], List[str]]:
        matched = []
        issues = []
        
        if not ticket.ticket_id:
            return matched, ["工单无工单号"]
        
        norm_ticket_id = self.normalize_id(ticket.ticket_id)
        
        for recording in recordings:
            rec_ticket_id = self.normalize_id(recording.parsed_ticket_id)
            
            if rec_ticket_id == norm_ticket_id:
                matched.append(recording)
            elif self.is_similar_id(ticket.ticket_id, recording.parsed_ticket_id):
                matched.append(recording)
                issues.append(f"录音工单号模糊匹配: {recording.file_name}")
        
        if not matched:
            issues.append("未找到对应录音文件")
        
        return matched, issues

    def match_ticket_with_agent(
        self,
        ticket: TicketRow,
        agents: List[AgentRow]
    ) -> Tuple[Optional[AgentRow], List[str]]:
        issues = []
        
        if not ticket.agent_id:
            return None, ["工单无坐席号"]
        
        norm_agent_id = self.normalize_id(ticket.agent_id)
        
        for agent in agents:
            if self.normalize_id(agent.agent_id) == norm_agent_id:
                return agent, issues
        
        for agent in agents:
            if self.is_similar_id(ticket.agent_id, agent.agent_id):
                issues.append(f"坐席号模糊匹配: {ticket.agent_id} -> {agent.agent_id}")
                return agent, issues
        
        return None, [f"坐席号{ticket.agent_id}不在坐席表中"]

    def verify_agent_in_recording(
        self,
        recordings: List[RecordingFile],
        agent: Optional[AgentRow]
    ) -> List[str]:
        issues = []
        
        if not agent or not agent.agent_id:
            return issues
        
        norm_agent_id = self.normalize_id(agent.agent_id)
        
        for recording in recordings:
            rec_agent_id = self.normalize_id(recording.parsed_agent_id)
            
            if rec_agent_id and rec_agent_id != norm_agent_id:
                if not self.is_similar_id(recording.parsed_agent_id, agent.agent_id):
                    issues.append(f"录音坐席号与工单不一致: 工单={agent.agent_id}, 录音={recording.parsed_agent_id}")
        
        return issues

    def calculate_match_score(self, issues: List[str], has_recording: bool, has_agent: bool) -> int:
        score = 100
        
        if not has_recording:
            score -= 50
        if not has_agent:
            score -= 30
        
        score -= len(issues) * 5
        
        return max(0, score)

    def determine_match_status(self, match_score: int, has_recording: bool, has_agent: bool) -> str:
        if match_score >= 90:
            return self.MATCH_STATUS['FULL_MATCH']
        elif match_score >= 60 and has_recording:
            return self.MATCH_STATUS['PARTIAL_MATCH']
        elif not has_recording:
            return self.MATCH_STATUS['NO_RECORDING']
        elif not has_agent:
            return self.MATCH_STATUS['NO_AGENT']
        else:
            return self.MATCH_STATUS['MISMATCH']

    def match_all(
        self,
        tickets: List[TicketRow],
        recordings: List[RecordingFile],
        agents: List[AgentRow]
    ) -> List[MatchResult]:
        self.match_results = []
        
        valid_agents = [a for a in agents if a.is_valid]
        
        for ticket in sorted(tickets, key=lambda x: x.ticket_id or ""):
            if not ticket.is_valid:
                self.match_results.append(MatchResult(
                    ticket=ticket,
                    matched_recordings=[],
                    matched_agent=None,
                    match_status=self.MATCH_STATUS['INVALID_TICKET'],
                    match_score=0,
                    issues=[ticket.error_message or "工单数据无效"]
                ))
                continue
            
            all_issues = []
            
            matched_recordings, recording_issues = self.match_ticket_with_recording(ticket, recordings)
            all_issues.extend(recording_issues)
            
            matched_agent, agent_issues = self.match_ticket_with_agent(ticket, valid_agents)
            all_issues.extend(agent_issues)
            
            agent_verify_issues = self.verify_agent_in_recording(matched_recordings, matched_agent)
            all_issues.extend(agent_verify_issues)
            
            has_recording = len(matched_recordings) > 0
            has_agent = matched_agent is not None
            
            match_score = self.calculate_match_score(all_issues, has_recording, has_agent)
            match_status = self.determine_match_status(match_score, has_recording, has_agent)
            
            self.match_results.append(MatchResult(
                ticket=ticket,
                matched_recordings=matched_recordings,
                matched_agent=matched_agent,
                match_status=match_status,
                match_score=match_score,
                issues=all_issues
            ))
        
        self._generate_match_hash()
        return self.match_results

    def _generate_match_hash(self) -> None:
        content = "|".join(sorted(
            f"{r.ticket.ticket_id}:{r.match_status}:{r.match_score}"
            for r in self.match_results
        ))
        self.match_hash = hashlib.md5(content.encode()).hexdigest()

    def get_results_by_status(self, status: str) -> List[MatchResult]:
        return [r for r in self.match_results if r.match_status == status]

    def get_no_recording_results(self) -> List[MatchResult]:
        return self.get_results_by_status(self.MATCH_STATUS['NO_RECORDING'])

    def get_mismatch_results(self) -> List[MatchResult]:
        return self.get_results_by_status(self.MATCH_STATUS['MISMATCH'])
