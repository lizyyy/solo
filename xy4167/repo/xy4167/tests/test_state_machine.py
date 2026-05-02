import pytest
from datetime import datetime

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from src.state_machine import (
    UpgradeStateMachine, UpgradeState, UpgradeEvent, StateContext
)
from src.log_parser import LogParser, LogEntry


class TestUpgradeStateMachine:
    def setup_method(self):
        self.sm = UpgradeStateMachine()
        self.log_parser = LogParser()
    
    def test_initial_state(self):
        assert self.sm.context.current_state == UpgradeState.IDLE
    
    def test_reset(self):
        self.sm.transition(UpgradeEvent.HANDSHAKE_START)
        self.sm.reset()
        assert self.sm.context.current_state == UpgradeState.IDLE
    
    def test_handshake_transition(self):
        assert self.sm.can_transition(UpgradeEvent.HANDSHAKE_START)
        self.sm.transition(UpgradeEvent.HANDSHAKE_START)
        assert self.sm.context.current_state == UpgradeState.HANDSHAKING
    
    def test_normal_upgrade_flow(self):
        self.sm.transition(UpgradeEvent.HANDSHAKE_START)
        assert self.sm.context.current_state == UpgradeState.HANDSHAKING
        
        self.sm.transition(UpgradeEvent.VERSION_DETECTED)
        assert self.sm.context.current_state == UpgradeState.VERSION_CHECK
        
        self.sm.transition(UpgradeEvent.TRANSFER_START)
        assert self.sm.context.current_state == UpgradeState.TRANSFERRING
        
        self.sm.transition(UpgradeEvent.TRANSFER_COMPLETE)
        assert self.sm.context.current_state == UpgradeState.CRC_CHECKING
        
        self.sm.transition(UpgradeEvent.CRC_PASS)
        assert self.sm.context.current_state == UpgradeState.FLASHING
        
        self.sm.transition(UpgradeEvent.FLASH_COMPLETE)
        assert self.sm.context.current_state == UpgradeState.REBOOTING
        
        self.sm.transition(UpgradeEvent.SUCCESS)
        assert self.sm.context.current_state == UpgradeState.SUCCESS
    
    def test_crc_fail_transition(self):
        self.sm.transition(UpgradeEvent.HANDSHAKE_START)
        self.sm.transition(UpgradeEvent.VERSION_DETECTED)
        self.sm.transition(UpgradeEvent.TRANSFER_COMPLETE)
        self.sm.transition(UpgradeEvent.CRC_FAIL)
        
        assert self.sm.context.current_state == UpgradeState.FAILED
    
    def test_timeout_transition(self):
        self.sm.transition(UpgradeEvent.HANDSHAKE_START)
        self.sm.transition(UpgradeEvent.TIMEOUT)
        
        assert self.sm.context.current_state == UpgradeState.TIMEOUT
    
    def test_retry_after_timeout(self):
        self.sm.transition(UpgradeEvent.HANDSHAKE_START)
        self.sm.transition(UpgradeEvent.TIMEOUT)
        assert self.sm.context.current_state == UpgradeState.TIMEOUT
        
        self.sm.transition(UpgradeEvent.RETRY)
        assert self.sm.context.current_state == UpgradeState.HANDSHAKING
    
    def test_rollback_flow(self):
        self.sm.transition(UpgradeEvent.HANDSHAKE_START)
        self.sm.transition(UpgradeEvent.VERSION_DETECTED)
        self.sm.transition(UpgradeEvent.TRANSFER_COMPLETE)
        self.sm.transition(UpgradeEvent.CRC_FAIL)
        
        assert self.sm.context.current_state == UpgradeState.FAILED
        
        self.sm.transition(UpgradeEvent.ROLLBACK_START)
        assert self.sm.context.current_state == UpgradeState.ROLLBACK
        
        self.sm.transition(UpgradeEvent.ROLLBACK_COMPLETE)
        assert self.sm.context.current_state == UpgradeState.SUCCESS
    
    def test_invalid_transition(self):
        assert not self.sm.can_transition(UpgradeEvent.CRC_PASS)
        
        initial_state = self.sm.context.current_state
        self.sm.transition(UpgradeEvent.CRC_PASS)
        assert self.sm.context.current_state == initial_state
    
    def test_process_log_entries_success(self):
        content = """2024-01-15 09:30:00.123 [INFO] 握手
2024-01-15 09:30:00.456 [INFO] VER: 1.2.0
2024-01-15 09:30:01.000 [INFO] 开始传输
2024-01-15 09:30:01.500 [INFO] 传输完成
2024-01-15 09:30:21.000 [INFO] CRC: A1B2C3D4 - 校验通过
2024-01-15 09:30:21.500 [INFO] 开始烧录
2024-01-15 09:30:40.500 [INFO] 烧录完成，设备重启
2024-01-15 09:30:45.000 [INFO] 升级成功
"""
        entries = self.log_parser.parse_string(content)
        self.sm.process_log_entries(entries)
        
        summary = self.sm.get_state_summary()
        assert summary["current_state"] == "SUCCESS"
        assert summary["crc_verified"] == True
    
    def test_process_log_entries_crc_fail(self):
        content = """2024-01-15 09:30:00.123 [INFO] 握手
2024-01-15 09:30:00.456 [INFO] VER: 1.2.0
2024-01-15 09:30:01.000 [INFO] 传输完成
2024-01-15 09:30:21.000 [ERROR] CRC校验失败
"""
        entries = self.log_parser.parse_string(content)
        self.sm.process_log_entries(entries)
        
        summary = self.sm.get_state_summary()
        assert summary["current_state"] == "FAILED"
        assert summary["crc_verified"] == False
    
    def test_process_log_entries_interrupted(self):
        content = """2024-01-15 09:30:00.123 [INFO] 握手
2024-01-15 09:30:00.456 [INFO] VER: 1.2.0
2024-01-15 09:30:05.000 [INFO] 传输进度: 50%
"""
        entries = self.log_parser.parse_string(content)
        self.sm.process_log_entries(entries)
        
        summary = self.sm.get_state_summary()
        assert summary["current_state"] == "INTERRUPTED"
    
    def test_get_state_summary(self):
        self.sm.transition(UpgradeEvent.HANDSHAKE_START)
        self.sm.transition(UpgradeEvent.VERSION_DETECTED)
        
        summary = self.sm.get_state_summary()
        assert summary["current_state"] == "VERSION_CHECK"
        assert summary["transition_count"] == 2
    
    def test_transitions_recorded(self):
        self.sm.transition(UpgradeEvent.HANDSHAKE_START)
        self.sm.transition(UpgradeEvent.VERSION_DETECTED)
        
        assert len(self.sm.context.transitions) == 2
        assert self.sm.context.transitions[0].to_state == "HANDSHAKING"
        assert self.sm.context.transitions[1].to_state == "VERSION_CHECK"
