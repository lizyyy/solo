"""规则引擎模块"""
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple

from .config import ReconcilerConfig
from .csv_parser import ScanAction, ScanLogEntry, TicketRosterEntry
from .models import (
    AnomalyType, 
    AnomalyRecord, 
    TicketStatus, 
    TicketTimelineEntry
)


class RuleEngine:
    """规则引擎"""
    
    def __init__(self, config: ReconcilerConfig):
        self.config = config
    
    def validate_entry(
        self,
        log_entry: ScanLogEntry,
        roster_entry: Optional[TicketRosterEntry],
        current_status: TicketStatus,
        timeline: List[TicketTimelineEntry]
    ) -> Tuple[bool, List[AnomalyRecord]]:
        """
        验证入场动作是否合法
        
        Args:
            log_entry: 扫码日志条目
            roster_entry: 票务名单条目（如果是未知票则为None）
            current_status: 当前票状态
            timeline: 时间线历史
            
        Returns:
            (是否通过验证, 异常记录列表)
        """
        anomalies: List[AnomalyRecord] = []
        
        # 1. 检查是否为未知票
        if roster_entry is None:
            anomalies.append(AnomalyRecord(
                anomaly_type=AnomalyType.UNKNOWN_TICKET,
                description=f"未知票号: {log_entry.ticket_number}",
                timestamp=log_entry.timestamp,
                ticket_number=log_entry.ticket_number,
                entry=log_entry.entry,
                device_id=log_entry.device_id,
                operator=log_entry.operator,
                raw_log=log_entry.raw_data,
                severity="error"
            ))
            return False, anomalies
        
        # 2. 检查是否为黑名单
        if roster_entry.is_blacklisted:
            anomalies.append(AnomalyRecord(
                anomaly_type=AnomalyType.BLACKLISTED,
                description=f"黑名单票入场: {log_entry.ticket_number} ({roster_entry.name})",
                timestamp=log_entry.timestamp,
                ticket_number=log_entry.ticket_number,
                entry=log_entry.entry,
                device_id=log_entry.device_id,
                operator=log_entry.operator,
                raw_log=log_entry.raw_data,
                severity="critical"
            ))
            # 黑名单票仍然记录异常，但继续检查其他规则
        
        # 3. 检查入口权限
        if not self._check_entry_permission(log_entry, roster_entry):
            anomalies.append(AnomalyRecord(
                anomaly_type=AnomalyType.WRONG_ENTRY,
                description=f"票种 {roster_entry.ticket_type} 不允许在入口 {log_entry.entry} 通行",
                timestamp=log_entry.timestamp,
                ticket_number=log_entry.ticket_number,
                entry=log_entry.entry,
                device_id=log_entry.device_id,
                operator=log_entry.operator,
                raw_log=log_entry.raw_data,
                severity="error"
            ))
        
        # 4. 检查状态转换
        status_ok, status_anomaly = self._check_status_transition(
            log_entry.action, current_status, roster_entry, log_entry
        )
        if status_anomaly:
            anomalies.append(status_anomaly)
        
        # 5. 检查重复入场
        duplicate_anomaly = self._check_duplicate_entry(
            log_entry, timeline, roster_entry
        )
        if duplicate_anomaly:
            anomalies.append(duplicate_anomaly)
        
        # 判断是否通过
        has_blocking_anomaly = any(
            a.anomaly_type in [
                AnomalyType.UNKNOWN_TICKET,
                AnomalyType.BLACKLISTED,
            ] for a in anomalies
        )
        
        return not has_blocking_anomaly, anomalies
    
    def validate_exit(
        self,
        log_entry: ScanLogEntry,
        roster_entry: Optional[TicketRosterEntry],
        current_status: TicketStatus,
        timeline: List[TicketTimelineEntry]
    ) -> Tuple[bool, List[AnomalyRecord]]:
        """
        验证退场动作是否合法
        
        Args:
            log_entry: 扫码日志条目
            roster_entry: 票务名单条目
            current_status: 当前票状态
            timeline: 时间线历史
            
        Returns:
            (是否通过验证, 异常记录列表)
        """
        anomalies: List[AnomalyRecord] = []
        
        # 1. 检查是否为未知票
        if roster_entry is None:
            anomalies.append(AnomalyRecord(
                anomaly_type=AnomalyType.UNKNOWN_TICKET,
                description=f"未知票号退场: {log_entry.ticket_number}",
                timestamp=log_entry.timestamp,
                ticket_number=log_entry.ticket_number,
                entry=log_entry.entry,
                device_id=log_entry.device_id,
                operator=log_entry.operator,
                raw_log=log_entry.raw_data,
                severity="error"
            ))
            return False, anomalies
        
        # 2. 检查状态：必须已在场内才能退场
        if current_status != TicketStatus.IN_VENUE:
            anomalies.append(AnomalyRecord(
                anomaly_type=AnomalyType.EXIT_BEFORE_ENTRY,
                description=f"退场前未入场，当前状态: {current_status.value}",
                timestamp=log_entry.timestamp,
                ticket_number=log_entry.ticket_number,
                entry=log_entry.entry,
                device_id=log_entry.device_id,
                operator=log_entry.operator,
                raw_log=log_entry.raw_data,
                severity="error"
            ))
        
        # 3. 检查重复退场
        if timeline:
            last_entry = timeline[-1]
            time_diff = log_entry.timestamp - last_entry.corrected_timestamp
            if time_diff.total_seconds() < self.config.duplicate_scan_window_seconds:
                if last_entry.action == ScanAction.EXIT:
                    anomalies.append(AnomalyRecord(
                        anomaly_type=AnomalyType.DUPLICATE_ENTRY,
                        description=f"疑似重复扫码（退场），距上次扫码 {time_diff.total_seconds():.0f} 秒",
                        timestamp=log_entry.timestamp,
                        ticket_number=log_entry.ticket_number,
                        entry=log_entry.entry,
                        device_id=log_entry.device_id,
                        operator=log_entry.operator,
                        raw_log=log_entry.raw_data,
                        severity="warning"
                    ))
        
        return len(anomalies) == 0, anomalies
    
    def validate_reentry(
        self,
        log_entry: ScanLogEntry,
        roster_entry: Optional[TicketRosterEntry],
        current_status: TicketStatus,
        timeline: List[TicketTimelineEntry]
    ) -> Tuple[bool, List[AnomalyRecord]]:
        """
        验证二次入场动作是否合法
        
        Args:
            log_entry: 扫码日志条目
            roster_entry: 票务名单条目
            current_status: 当前票状态
            timeline: 时间线历史
            
        Returns:
            (是否通过验证, 异常记录列表)
        """
        anomalies: List[AnomalyRecord] = []
        
        # 1. 检查是否为未知票
        if roster_entry is None:
            anomalies.append(AnomalyRecord(
                anomaly_type=AnomalyType.UNKNOWN_TICKET,
                description=f"未知票号二次入场: {log_entry.ticket_number}",
                timestamp=log_entry.timestamp,
                ticket_number=log_entry.ticket_number,
                entry=log_entry.entry,
                device_id=log_entry.device_id,
                operator=log_entry.operator,
                raw_log=log_entry.raw_data,
                severity="error"
            ))
            return False, anomalies
        
        # 2. 检查票种是否允许二次入场
        if not self.config.is_reentry_allowed(roster_entry.ticket_type):
            anomalies.append(AnomalyRecord(
                anomaly_type=AnomalyType.REENTRY_NOT_ALLOWED,
                description=f"票种 {roster_entry.ticket_type} 不允许二次入场",
                timestamp=log_entry.timestamp,
                ticket_number=log_entry.ticket_number,
                entry=log_entry.entry,
                device_id=log_entry.device_id,
                operator=log_entry.operator,
                raw_log=log_entry.raw_data,
                severity="error"
            ))
        
        # 3. 检查入口权限
        if not self._check_entry_permission(log_entry, roster_entry):
            anomalies.append(AnomalyRecord(
                anomaly_type=AnomalyType.WRONG_ENTRY,
                description=f"票种 {roster_entry.ticket_type} 不允许在入口 {log_entry.entry} 通行",
                timestamp=log_entry.timestamp,
                ticket_number=log_entry.ticket_number,
                entry=log_entry.entry,
                device_id=log_entry.device_id,
                operator=log_entry.operator,
                raw_log=log_entry.raw_data,
                severity="error"
            ))
        
        # 4. 检查状态：二次入场前必须已退场
        if current_status == TicketStatus.IN_VENUE:
            anomalies.append(AnomalyRecord(
                anomaly_type=AnomalyType.INVALID_ACTION_ORDER,
                description="二次入场前未退场，当前在场内",
                timestamp=log_entry.timestamp,
                ticket_number=log_entry.ticket_number,
                entry=log_entry.entry,
                device_id=log_entry.device_id,
                operator=log_entry.operator,
                raw_log=log_entry.raw_data,
                severity="error"
            ))
        
        # 5. 检查是否有退场记录（如果有时间线）
        if timeline and current_status == TicketStatus.EXITED:
            last_action = timeline[-1].action
            if last_action != ScanAction.EXIT:
                anomalies.append(AnomalyRecord(
                    anomaly_type=AnomalyType.INVALID_ACTION_ORDER,
                    description=f"二次入场前最后动作不是退场，而是: {last_action.value}",
                    timestamp=log_entry.timestamp,
                    ticket_number=log_entry.ticket_number,
                    entry=log_entry.entry,
                    device_id=log_entry.device_id,
                    operator=log_entry.operator,
                    raw_log=log_entry.raw_data,
                    severity="warning"
                ))
        
        return len(anomalies) == 0, anomalies
    
    def _check_entry_permission(
        self, 
        log_entry: ScanLogEntry, 
        roster_entry: TicketRosterEntry
    ) -> bool:
        """检查入口权限"""
        # 1. 检查票种是否允许该入口（基于配置规则）
        if not self.config.can_enter_at(roster_entry.ticket_type, log_entry.entry):
            return False
        
        # 2. 检查票务名单中的允许入口（如果有配置）
        if roster_entry.allowed_entries:
            if log_entry.entry not in roster_entry.allowed_entries:
                return False
        
        return True
    
    def _check_status_transition(
        self,
        action: ScanAction,
        current_status: TicketStatus,
        roster_entry: TicketRosterEntry,
        log_entry: ScanLogEntry
    ) -> Tuple[bool, Optional[AnomalyRecord]]:
        """检查状态转换是否合法"""
        # 合法的状态转换：
        # UNUSED -> ENTRY -> IN_VENUE
        # IN_VENUE -> EXIT -> EXITED
        # EXITED -> REENTRY (如果允许) -> IN_VENUE
        # EXITED -> ENTRY (普通票不允许二次入场)
        
        if action == ScanAction.ENTRY:
            if current_status == TicketStatus.IN_VENUE:
                # 已在场内再次入场
                if self.config.is_reentry_allowed(roster_entry.ticket_type):
                    # VIP票允许二次入场，但需要先退场
                    return False, AnomalyRecord(
                        anomaly_type=AnomalyType.DUPLICATE_ENTRY,
                        description="重复入场：已在场内，未退场前再次入场",
                        timestamp=log_entry.timestamp,
                        ticket_number=log_entry.ticket_number,
                        entry=log_entry.entry,
                        device_id=log_entry.device_id,
                        operator=log_entry.operator,
                        raw_log=log_entry.raw_data,
                        severity="error"
                    )
                else:
                    # 普通票不允许多次入场
                    return False, AnomalyRecord(
                        anomaly_type=AnomalyType.DUPLICATE_ENTRY,
                        description="普通票重复入场：普通票不允许多次入场",
                        timestamp=log_entry.timestamp,
                        ticket_number=log_entry.ticket_number,
                        entry=log_entry.entry,
                        device_id=log_entry.device_id,
                        operator=log_entry.operator,
                        raw_log=log_entry.raw_data,
                        severity="error"
                    )
        
        elif action == ScanAction.EXIT:
            if current_status == TicketStatus.UNUSED:
                return False, AnomalyRecord(
                    anomaly_type=AnomalyType.EXIT_BEFORE_ENTRY,
                    description="退场前未入场",
                    timestamp=log_entry.timestamp,
                    ticket_number=log_entry.ticket_number,
                    entry=log_entry.entry,
                    device_id=log_entry.device_id,
                    operator=log_entry.operator,
                    raw_log=log_entry.raw_data,
                    severity="error"
                )
            elif current_status == TicketStatus.EXITED:
                return False, AnomalyRecord(
                    anomaly_type=AnomalyType.INVALID_ACTION_ORDER,
                    description="重复退场：已退场状态",
                    timestamp=log_entry.timestamp,
                    ticket_number=log_entry.ticket_number,
                    entry=log_entry.entry,
                    device_id=log_entry.device_id,
                    operator=log_entry.operator,
                    raw_log=log_entry.raw_data,
                    severity="warning"
                )
        
        return True, None
    
    def _check_duplicate_entry(
        self,
        log_entry: ScanLogEntry,
        timeline: List[TicketTimelineEntry],
        roster_entry: TicketRosterEntry
    ) -> Optional[AnomalyRecord]:
        """检查是否为重复扫码（同一设备短时间内多次扫码同一张票）"""
        if not timeline:
            return None
        
        # 检查时间窗口内的扫码
        window_seconds = self.config.duplicate_scan_window_seconds
        
        for entry in reversed(timeline):
            time_diff = log_entry.timestamp - entry.corrected_timestamp
            if time_diff.total_seconds() > window_seconds:
                break  # 超过时间窗口，停止检查
            
            # 检查是否为同一设备、同一票号
            if (entry.device_id == log_entry.device_id and 
                entry.action in [ScanAction.ENTRY, ScanAction.REENTRY]):
                return AnomalyRecord(
                    anomaly_type=AnomalyType.DUPLICATE_ENTRY,
                    description=f"疑似重复扫码，距上次扫码 {time_diff.total_seconds():.0f} 秒",
                    timestamp=log_entry.timestamp,
                    ticket_number=log_entry.ticket_number,
                    entry=log_entry.entry,
                    device_id=log_entry.device_id,
                    operator=log_entry.operator,
                    raw_log=log_entry.raw_data,
                    severity="warning"
                )
        
        return None
    
    def check_simultaneous_scan(
        self,
        log_entries: List[ScanLogEntry],
        roster: Dict[str, TicketRosterEntry]
    ) -> List[AnomalyRecord]:
        """
        检查同一票多人同时扫码（不同设备短时间内扫码同一张票）
        
        Args:
            log_entries: 所有日志条目
            roster: 票务名单
            
        Returns:
            异常记录列表
        """
        anomalies: List[AnomalyRecord] = []
        
        # 按票号分组
        tickets_scans: Dict[str, List[ScanLogEntry]] = {}
        for entry in log_entries:
            if entry.ticket_number not in tickets_scans:
                tickets_scans[entry.ticket_number] = []
            tickets_scans[entry.ticket_number].append(entry)
        
        window_seconds = self.config.duplicate_scan_window_seconds
        
        for ticket_number, scans in tickets_scans.items():
            if len(scans) < 2:
                continue
            
            # 按时间排序
            scans_sorted = sorted(scans, key=lambda x: x.timestamp)
            
            # 检查时间窗口内的不同设备扫码
            for i, scan1 in enumerate(scans_sorted):
                for j in range(i + 1, len(scans_sorted)):
                    scan2 = scans_sorted[j]
                    time_diff = scan2.timestamp - scan1.timestamp
                    
                    if time_diff.total_seconds() > window_seconds:
                        break  # 超过时间窗口
                    
                    # 不同设备、短时间内扫码同一张票
                    if scan1.device_id != scan2.device_id:
                        anomalies.append(AnomalyRecord(
                            anomaly_type=AnomalyType.SIMULTANEOUS_SCAN,
                            description=f"同一票在不同设备同时扫码，时间差 {time_diff.total_seconds():.0f} 秒",
                            timestamp=scan2.timestamp,
                            ticket_number=ticket_number,
                            entry=scan2.entry,
                            device_id=scan2.device_id,
                            operator=scan2.operator,
                            raw_log=scan2.raw_data,
                            severity="critical"
                        ))
        
        return anomalies
    
    def get_next_status(
        self, 
        current_status: TicketStatus, 
        action: ScanAction,
        is_valid: bool
    ) -> TicketStatus:
        """
        根据当前状态和动作获取下一个状态
        
        Args:
            current_status: 当前状态
            action: 动作类型
            is_valid: 动作是否合法
            
        Returns:
            下一个状态
        """
        if not is_valid:
            return TicketStatus.ANOMALY
        
        if action == ScanAction.ENTRY or action == ScanAction.REENTRY:
            return TicketStatus.IN_VENUE
        elif action == ScanAction.EXIT:
            return TicketStatus.EXITED
        
        return current_status
