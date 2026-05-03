from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any, Set
from collections import defaultdict
import csv
import logging

from .topology import Topology
from .state_machine import (
    TransferStateMachine, TransferState, TransferStatus,
    TransferEvent, EventType
)

logger = logging.getLogger(__name__)


@dataclass
class DowntimeWindow:
    equipment_id: str
    start_time: datetime
    end_time: datetime
    reason: str
    affected_nodes: List[str] = field(default_factory=list)
    
    def is_active_at(self, timestamp: datetime) -> bool:
        return self.start_time <= timestamp <= self.end_time
    
    def overlap_duration(self, start: datetime, end: datetime) -> timedelta:
        overlap_start = max(self.start_time, start)
        overlap_end = min(self.end_time, end)
        if overlap_start > overlap_end:
            return timedelta(0)
        return overlap_end - overlap_start


@dataclass
class TransferAnalysis:
    foup_id: str
    total_duration_seconds: float = 0.0
    queue_time_seconds: float = 0.0
    equipment_occupation_time_seconds: float = 0.0
    reroute_count: int = 0
    failed_reroutes: int = 0
    issues: List[Dict[str, Any]] = field(default_factory=list)
    anomalies: List[str] = field(default_factory=list)
    node_queue_details: List[Dict[str, Any]] = field(default_factory=list)
    timeline: List[Dict[str, Any]] = field(default_factory=list)
    source_node: Optional[str] = None
    target_node: Optional[str] = None
    final_status: TransferStatus = TransferStatus.IDLE
    was_affected_by_downtime: bool = False
    downtime_affected_details: List[Dict[str, Any]] = field(default_factory=list)
    transfer_start_time: Optional[datetime] = None
    transfer_end_time: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'foup_id': self.foup_id,
            'total_duration_seconds': self.total_duration_seconds,
            'queue_time_seconds': self.queue_time_seconds,
            'equipment_occupation_time_seconds': self.equipment_occupation_time_seconds,
            'reroute_count': self.reroute_count,
            'failed_reroutes': self.failed_reroutes,
            'issue_count': len(self.issues),
            'was_affected_by_downtime': self.was_affected_by_downtime,
            'final_status': self.final_status.value,
            'source_node': self.source_node,
            'target_node': self.target_node,
        }


@dataclass
class AnalysisSummary:
    total_transfers: int = 0
    completed_transfers: int = 0
    failed_transfers: int = 0
    total_queue_time_seconds: float = 0.0
    average_queue_time_seconds: float = 0.0
    total_issues: int = 0
    node_queue_issues: int = 0
    reroute_failures: int = 0
    equipment_occupation_issues: int = 0
    missing_arrival_issues: int = 0
    affected_by_downtime: int = 0
    hotspot_nodes: Dict[str, int] = field(default_factory=dict)
    hotspot_equipments: Dict[str, int] = field(default_factory=dict)
    out_of_order_events: int = 0
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'total_transfers': self.total_transfers,
            'completed_transfers': self.completed_transfers,
            'failed_transfers': self.failed_transfers,
            'total_queue_time_seconds': self.total_queue_time_seconds,
            'average_queue_time_seconds': self.average_queue_time_seconds,
            'total_issues': self.total_issues,
            'node_queue_issues': self.node_queue_issues,
            'reroute_failures': self.reroute_failures,
            'equipment_occupation_issues': self.equipment_occupation_issues,
            'missing_arrival_issues': self.missing_arrival_issues,
            'affected_by_downtime': self.affected_by_downtime,
            'hotspot_nodes': dict(sorted(self.hotspot_nodes.items(), key=lambda x: -x[1])[:10]),
            'hotspot_equipments': dict(sorted(self.hotspot_equipments.items(), key=lambda x: -x[1])[:10]),
            'out_of_order_events': self.out_of_order_events,
        }


class BlockageAnalyzer:
    def __init__(self, topology: Topology, downtime_windows: List[DowntimeWindow]):
        self.topology = topology
        self.downtime_windows = downtime_windows
        self._downtime_by_equipment: Dict[str, List[DowntimeWindow]] = defaultdict(list)
        self._downtime_by_node: Dict[str, List[DowntimeWindow]] = defaultdict(list)
        
        for dt in downtime_windows:
            self._downtime_by_equipment[dt.equipment_id].append(dt)
            for node_id in dt.affected_nodes:
                self._downtime_by_node[node_id].append(dt)
    
    def analyze(self, machines: Dict[str, TransferStateMachine]) -> List[TransferAnalysis]:
        analyses = []
        
        for foup_id, machine in machines.items():
            analysis = self._analyze_single_transfer(foup_id, machine)
            analyses.append(analysis)
        
        return analyses
    
    def _analyze_single_transfer(self, foup_id: str, machine: TransferStateMachine) -> TransferAnalysis:
        state = machine.state
        
        analysis = TransferAnalysis(
            foup_id=foup_id,
            queue_time_seconds=state.total_queue_time_seconds,
            reroute_count=state.reroute_attempts,
            failed_reroutes=state.failed_reroutes,
            issues=state.issues.copy(),
            anomalies=state.anomalies.copy(),
            source_node=state.source_node,
            target_node=state.target_node,
            final_status=state.status,
        )
        
        if state.created_at:
            analysis.transfer_start_time = state.created_at
            if state.last_updated_at:
                analysis.total_duration_seconds = (
                    state.last_updated_at - state.created_at
                ).total_seconds()
                analysis.transfer_end_time = state.last_updated_at
        
        for event in state.events:
            self._add_event_to_timeline(analysis, event)
        
        self._detect_equipment_occupation(state, analysis)
        self._detect_downtime_impact(state, analysis)
        self._extract_node_queues(state, analysis)
        
        return analysis
    
    def _add_event_to_timeline(self, analysis: TransferAnalysis, event: TransferEvent):
        item = {
            'timestamp': event.timestamp.isoformat(),
            'event_type': event.event_type.value,
            'node_id': event.node_id,
            'target_node': event.target_node,
            'equipment_id': event.equipment_id,
            'vehicle_id': event.vehicle_id,
            'reason': event.reason,
        }
        analysis.timeline.append(item)
    
    def _detect_equipment_occupation(self, state: TransferState, analysis: TransferAnalysis):
        occupation_time = 0.0
        current_start = None
        current_eq = None
        
        for event in sorted(state.events, key=lambda e: e.timestamp):
            if event.event_type in (EventType.LOAD_START, EventType.UNLOAD_START):
                current_start = event.timestamp
                current_eq = event.equipment_id
            elif event.event_type in (EventType.LOAD_END, EventType.UNLOAD_END):
                if current_start:
                    duration = (event.timestamp - current_start).total_seconds()
                    occupation_time += duration
                    if duration > 120:
                        analysis.equipment_occupation_time_seconds += duration
                    current_start = None
                    current_eq = None
        
        if occupation_time > 0:
            analysis.equipment_occupation_time_seconds = occupation_time
    
    def _detect_downtime_impact(self, state: TransferState, analysis: TransferAnalysis):
        if not (analysis.transfer_start_time and analysis.transfer_end_time):
            return
        
        transfer_start = analysis.transfer_start_time
        transfer_end = analysis.transfer_end_time
        
        affected_nodes = set()
        affected_equipments = set()
        
        for event in state.events:
            if event.node_id:
                for dt in self._downtime_by_node.get(event.node_id, []):
                    if dt.is_active_at(event.timestamp):
                        affected_nodes.add(event.node_id)
                        affected_equipments.add(dt.equipment_id)
                        analysis.downtime_affected_details.append({
                            'timestamp': event.timestamp.isoformat(),
                            'node_id': event.node_id,
                            'equipment_id': dt.equipment_id,
                            'downtime_reason': dt.reason,
                            'event_type': event.event_type.value,
                        })
        
        analysis.was_affected_by_downtime = len(affected_nodes) > 0
    
    def _extract_node_queues(self, state: TransferState, analysis: TransferAnalysis):
        queue_intervals = []
        queue_start = None
        queue_node = None
        
        for event in sorted(state.events, key=lambda e: e.timestamp):
            if event.event_type == EventType.QUEUE_START:
                queue_start = event.timestamp
                queue_node = event.node_id
            elif event.event_type == EventType.QUEUE_END:
                if queue_start and queue_node:
                    duration = (event.timestamp - queue_start).total_seconds()
                    if duration > 10:
                        queue_intervals.append({
                            'node_id': queue_node,
                            'start_time': queue_start.isoformat(),
                            'end_time': event.timestamp.isoformat(),
                            'duration_seconds': duration,
                        })
                    queue_start = None
                    queue_node = None
        
        for issue in state.issues:
            if issue.get('issue_type') == 'node_queue':
                if issue.get('node_id'):
                    queue_intervals.append({
                        'node_id': issue.get('node_id'),
                        'start_time': issue.get('timestamp'),
                        'end_time': issue.get('timestamp'),
                        'duration_seconds': issue.get('duration_seconds', 0),
                    })
        
        analysis.node_queue_details = queue_intervals
    
    def create_summary(self, analyses: List[TransferAnalysis]) -> AnalysisSummary:
        summary = AnalysisSummary()
        summary.total_transfers = len(analyses)
        
        total_queue = 0.0
        queue_count = 0
        
        for analysis in analyses:
            if analysis.final_status == TransferStatus.COMPLETED:
                summary.completed_transfers += 1
            elif analysis.final_status == TransferStatus.FAILED:
                summary.failed_transfers += 1
            
            total_queue += analysis.queue_time_seconds
            if analysis.queue_time_seconds > 0:
                queue_count += 1
            
            summary.total_issues += len(analysis.issues)
            
            for issue in analysis.issues:
                itype = issue.get('issue_type', '')
                if itype == 'node_queue':
                    summary.node_queue_issues += 1
                    node = issue.get('node_id')
                    if node:
                        summary.hotspot_nodes[node] = summary.hotspot_nodes.get(node, 0) + 1
                elif itype == 'reroute_failed':
                    summary.reroute_failures += 1
                elif itype == 'equipment_occupation':
                    summary.equipment_occupation_issues += 1
                    eq = issue.get('equipment_id')
                    if eq:
                        summary.hotspot_equipments[eq] = summary.hotspot_equipments.get(eq, 0) + 1
                elif itype == 'missing_arrival':
                    summary.missing_arrival_issues += 1
            
            if analysis.was_affected_by_downtime:
                summary.affected_by_downtime += 1
            
            for anomaly in analysis.anomalies:
                if 'Out-of-order' in anomaly:
                    summary.out_of_order_events += 1
        
        summary.total_queue_time_seconds = total_queue
        if queue_count > 0:
            summary.average_queue_time_seconds = total_queue / queue_count
        
        return summary


def load_downtime_windows(csv_path: Path, topology: Topology) -> List[DowntimeWindow]:
    windows = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            eq_id = row.get('equipment_id', row.get('eq_id', ''))
            start_str = row.get('start_time', row.get('start', ''))
            end_str = row.get('end_time', row.get('end', ''))
            reason = row.get('reason', row.get('downtime_reason', 'maintenance'))
            
            affected_nodes = []
            if eq_id in topology.equipments:
                affected_nodes = topology.equipments[eq_id].port_nodes.copy()
            
            try:
                start_time = datetime.fromisoformat(start_str)
                end_time = datetime.fromisoformat(end_str)
            except ValueError as e:
                logger.warning(f"Failed to parse datetime for downtime {eq_id}: {e}")
                continue
            
            window = DowntimeWindow(
                equipment_id=eq_id,
                start_time=start_time,
                end_time=end_time,
                reason=reason,
                affected_nodes=affected_nodes,
            )
            windows.append(window)
    
    return windows


def analyze_all(
    topology: Topology,
    machines: Dict[str, TransferStateMachine],
    downtime_windows: List[DowntimeWindow]
) -> tuple[List[TransferAnalysis], AnalysisSummary]:
    analyzer = BlockageAnalyzer(topology, downtime_windows)
    analyses = analyzer.analyze(machines)
    summary = analyzer.create_summary(analyses)
    return analyses, summary
