"""对账状态机模块"""
from dataclasses import asdict
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from collections import defaultdict

from .config import ReconcilerConfig
from .csv_parser import ScanAction, ScanLogEntry, TicketRosterEntry
from .models import (
    AnomalyType,
    AnomalyRecord,
    TicketStatus,
    TicketTimelineEntry,
    TicketLedgerEntry,
    ReconciliationResult,
)
from .rules import RuleEngine


class Reconciler:
    """对账器"""
    
    def __init__(self, config: ReconcilerConfig):
        self.config = config
        self.rule_engine = RuleEngine(config)
    
    def reconcile(
        self,
        roster: Dict[str, TicketRosterEntry],
        scan_logs: List[ScanLogEntry],
        failed_rows: List[Tuple[int, str, Dict]]
    ) -> ReconciliationResult:
        """
        执行对账
        
        Args:
            roster: 票务名单（票号 -> 条目）
            scan_logs: 扫码日志列表
            failed_rows: 解析失败的行
            
        Returns:
            对账结果
        """
        result = ReconciliationResult(
            event_date=self.config.event_date,
            reconciliation_time=datetime.now(),
            total_tickets=len(roster),
        )
        
        # 1. 修正设备时间并按时间排序
        corrected_logs = self._correct_timestamps(scan_logs)
        sorted_logs = sorted(corrected_logs, key=lambda x: x[1])  # 按修正后时间排序
        
        # 2. 初始化台账
        ledger: Dict[str, TicketLedgerEntry] = {}
        for ticket_number, entry in roster.items():
            ledger[ticket_number] = TicketLedgerEntry(
                ticket_number=entry.ticket_number,
                name=entry.name,
                phone_last_four=entry.phone_last_four,
                ticket_type=entry.ticket_type,
                allowed_entries=entry.allowed_entries,
                is_blacklisted=entry.is_blacklisted,
            )
        
        # 3. 处理每个日志条目
        all_anomalies: List[AnomalyRecord] = []
        duplicate_merges = 0
        quarantined_count = 0
        
        for log_entry, corrected_timestamp in sorted_logs:
            ticket_number = log_entry.ticket_number
            
            # 获取或创建台账条目
            if ticket_number in ledger:
                ledger_entry = ledger[ticket_number]
                roster_entry = roster[ticket_number]
            else:
                # 未知票，创建临时条目
                ledger_entry = TicketLedgerEntry(
                    ticket_number=ticket_number,
                    name="未知",
                    phone_last_four="0000",
                    ticket_type="unknown",
                    allowed_entries=[],
                    is_blacklisted=False,
                )
                ledger[ticket_number] = ledger_entry
                roster_entry = None
            
            # 验证动作
            is_valid, anomalies = self._validate_action(
                log_entry, 
                roster_entry, 
                ledger_entry
            )
            
            # 检查是否为重复扫码（同一设备短时间内）
            is_duplicate = self._is_duplicate_scan(log_entry, ledger_entry, corrected_timestamp)
            
            # 创建时间线条目
            timeline_entry = TicketTimelineEntry(
                timestamp=log_entry.timestamp,
                action=log_entry.action,
                entry=log_entry.entry,
                device_id=log_entry.device_id,
                operator=log_entry.operator,
                corrected_timestamp=corrected_timestamp,
                is_duplicate=is_duplicate,
                anomalies=anomalies,
                raw_log=log_entry.raw_data,
            )
            
            # 添加到时间线
            ledger_entry.timeline.append(timeline_entry)
            
            # 记录异常
            all_anomalies.extend(anomalies)
            ledger_entry.anomalies.extend(anomalies)
            
            # 统计
            if is_duplicate:
                duplicate_merges += 1
            else:
                # 更新统计（非重复扫码才统计）
                self._update_stats(result, ledger_entry, log_entry, roster_entry)
            
            # 更新状态
            if not is_duplicate:
                ledger_entry.current_status = self.rule_engine.get_next_status(
                    ledger_entry.current_status,
                    log_entry.action,
                    is_valid
                )
                
                # 更新入场/退场计数
                if log_entry.action in [ScanAction.ENTRY, ScanAction.REENTRY]:
                    ledger_entry.total_entries += 1
                    if ledger_entry.first_entry_time is None:
                        ledger_entry.first_entry_time = corrected_timestamp
                elif log_entry.action == ScanAction.EXIT:
                    ledger_entry.total_exits += 1
                    ledger_entry.last_exit_time = corrected_timestamp
        
        # 4. 检查同时扫码（不同设备）
        simultaneous_anomalies = self.rule_engine.check_simultaneous_scan(scan_logs, roster)
        all_anomalies.extend(simultaneous_anomalies)
        
        # 5. 处理解析失败的行（放入隔离区）
        for line_number, error, raw_data in failed_rows:
            quarantined_count += 1
        
        # 6. 统计最终状态
        tickets_scanned = 0
        tickets_in_venue = 0
        tickets_exited = 0
        
        for ticket_number, entry in ledger.items():
            if entry.timeline:
                tickets_scanned += 1
            
            if entry.current_status == TicketStatus.IN_VENUE:
                tickets_in_venue += 1
            elif entry.current_status == TicketStatus.EXITED:
                tickets_exited += 1
        
        # 统计异常数量
        anomaly_counts: Dict[AnomalyType, int] = defaultdict(int)
        for anomaly in all_anomalies:
            anomaly_counts[anomaly.anomaly_type] += 1
        
        # 构建结果
        result.tickets_scanned = tickets_scanned
        result.tickets_in_venue = tickets_in_venue
        result.tickets_exited = tickets_exited
        result.total_anomalies = len(all_anomalies)
        result.anomaly_counts = dict(anomaly_counts)
        result.quarantined_count = quarantined_count
        result.duplicate_merges = duplicate_merges
        result.ledger = ledger
        result.anomalies = all_anomalies
        
        # 添加额外统计
        result.stats = {
            "total_logs_processed": len(scan_logs),
            "duplicate_scans_merged": duplicate_merges,
            "failed_rows_quarantined": quarantined_count,
            "unknown_tickets_count": sum(
                1 for entry in ledger.values() 
                if entry.ticket_type == "unknown" and entry.timeline
            ),
        }
        
        return result
    
    def _correct_timestamps(
        self, 
        scan_logs: List[ScanLogEntry]
    ) -> List[Tuple[ScanLogEntry, datetime]]:
        """
        修正设备时间戳
        
        Args:
            scan_logs: 扫码日志列表
            
        Returns:
            (日志条目, 修正后时间戳) 列表
        """
        result = []
        
        for log_entry in scan_logs:
            offset = self.config.get_device_offset(log_entry.device_id)
            # 偏移正数表示设备时间快，所以要减去偏移
            corrected_timestamp = log_entry.timestamp - timedelta(seconds=offset)
            result.append((log_entry, corrected_timestamp))
        
        return result
    
    def _validate_action(
        self,
        log_entry: ScanLogEntry,
        roster_entry: Optional[TicketRosterEntry],
        ledger_entry: TicketLedgerEntry
    ) -> Tuple[bool, List[AnomalyRecord]]:
        """
        验证动作是否合法
        
        Returns:
            (是否通过验证, 异常记录列表)
        """
        if log_entry.action == ScanAction.ENTRY:
            return self.rule_engine.validate_entry(
                log_entry, 
                roster_entry, 
                ledger_entry.current_status,
                ledger_entry.timeline
            )
        elif log_entry.action == ScanAction.EXIT:
            return self.rule_engine.validate_exit(
                log_entry, 
                roster_entry, 
                ledger_entry.current_status,
                ledger_entry.timeline
            )
        elif log_entry.action == ScanAction.REENTRY:
            return self.rule_engine.validate_reentry(
                log_entry, 
                roster_entry, 
                ledger_entry.current_status,
                ledger_entry.timeline
            )
        
        return True, []
    
    def _is_duplicate_scan(
        self,
        log_entry: ScanLogEntry,
        ledger_entry: TicketLedgerEntry,
        corrected_timestamp: datetime
    ) -> bool:
        """
        检查是否为重复扫码（同一设备短时间内）
        
        注意：这与规则引擎中的检查不同，这里是用于决定是否合并记录
        """
        if not ledger_entry.timeline:
            return False
        
        window_seconds = self.config.duplicate_scan_window_seconds
        
        # 检查最近的时间线条目
        for entry in reversed(ledger_entry.timeline):
            time_diff = corrected_timestamp - entry.corrected_timestamp
            if time_diff.total_seconds() > window_seconds:
                break
            
            # 同一设备、相同动作类型、短时间内
            if (entry.device_id == log_entry.device_id and 
                entry.action == log_entry.action):
                return True
        
        return False
    
    def _update_stats(
        self,
        result: ReconciliationResult,
        ledger_entry: TicketLedgerEntry,
        log_entry: ScanLogEntry,
        roster_entry: Optional[TicketRosterEntry]
    ):
        """更新统计信息"""
        # 仅统计入场动作
        if log_entry.action in [ScanAction.ENTRY, ScanAction.REENTRY]:
            # 按入口统计
            entry_name = self.config.get_entry_name(log_entry.entry)
            if entry_name not in result.entries_by_gate:
                result.entries_by_gate[entry_name] = 0
            result.entries_by_gate[entry_name] += 1
            
            # 按票种统计
            if roster_entry:
                type_name = self.config.get_ticket_type_name(roster_entry.ticket_type)
                if type_name not in result.entries_by_ticket_type:
                    result.entries_by_ticket_type[type_name] = 0
                result.entries_by_ticket_type[type_name] += 1
